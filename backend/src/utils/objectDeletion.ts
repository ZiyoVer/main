import { Prisma } from '@prisma/client'
import prisma from './db'
import {
    deleteFromS3,
    extractS3KeysFromText,
    isStorageConfigured,
} from './s3'

type QuestionObjectRefs = {
    imageUrl?: string | null
    optionImages?: string | null
    solutionImageUrl?: string | null
}

type MessageObjectRefs = {
    content?: string | null
    fileUrl?: string | null
}

const DELETE_BATCH_SIZE = 25
const DELETE_LEASE_MS = 5 * 60 * 1000
const DELETE_POLL_MS = 5 * 60 * 1000
const MAX_BACKOFF_MS = 24 * 60 * 60 * 1000

let activeDrain: Promise<void> | null = null

function uniqueKeys(values: Array<string | null | undefined>): string[] {
    return [...new Set(values.flatMap(value => extractS3KeysFromText(value)))]
}

export function collectObjectKeys(
    messages: MessageObjectRefs[],
    questions: QuestionObjectRefs[],
): string[] {
    return uniqueKeys([
        ...messages.flatMap(message => [message.content, message.fileUrl]),
        ...questions.flatMap(question => [
            question.imageUrl,
            question.optionImages,
            question.solutionImageUrl,
        ]),
    ])
}

export async function collectUserObjectKeys(userId: string): Promise<string[]> {
    const [messages, questions] = await Promise.all([
        prisma.message.findMany({
            where: { chat: { userId } },
            select: { content: true, fileUrl: true },
        }),
        prisma.testQuestion.findMany({
            where: { test: { creatorId: userId } },
            select: {
                imageUrl: true,
                optionImages: true,
                solutionImageUrl: true,
            },
        }),
    ])
    return collectObjectKeys(messages, questions)
}

export async function collectTestObjectKeys(testId: string): Promise<string[]> {
    const questions = await prisma.testQuestion.findMany({
        where: { testId },
        select: {
            imageUrl: true,
            optionImages: true,
            solutionImageUrl: true,
        },
    })
    return collectObjectKeys([], questions)
}

export async function enqueueObjectDeletions(
    tx: Pick<Prisma.TransactionClient, 'objectDeletionJob'>,
    keys: string[],
): Promise<number> {
    const unique = [...new Set(keys.filter(Boolean))]
    if (unique.length === 0) return 0

    const result = await tx.objectDeletionJob.createMany({
        data: unique.map(objectKey => ({ objectKey })),
        skipDuplicates: true,
    })
    return result.count
}

export function objectDeletionBackoffMs(attempt: number): number {
    const exponent = Math.max(0, Math.min(12, attempt - 1))
    return Math.min(60_000 * (2 ** exponent), MAX_BACKOFF_MS)
}

async function isObjectKeyStillReferenced(objectKey: string): Promise<boolean> {
    const [messages, questions, documents] = await Promise.all([
        prisma.message.count({
            where: {
                OR: [
                    { content: { contains: objectKey } },
                    { fileUrl: { contains: objectKey } },
                ],
            },
        }),
        prisma.testQuestion.count({
            where: {
                OR: [
                    { imageUrl: { contains: objectKey } },
                    { optionImages: { contains: objectKey } },
                    { solutionImageUrl: { contains: objectKey } },
                ],
            },
        }),
        prisma.document.count({
            where: {
                OR: [
                    { s3Key: objectKey },
                    { s3Url: { contains: objectKey } },
                ],
            },
        }),
    ])
    return messages + questions + documents > 0
}

async function claimDeletionJob(
    id: string,
    now: Date,
): Promise<boolean> {
    const claimed = await prisma.objectDeletionJob.updateMany({
        where: {
            id,
            OR: [
                { status: 'PENDING', nextAttemptAt: { lte: now } },
                { status: 'PROCESSING', leaseExpiresAt: { lte: now } },
            ],
        },
        data: {
            status: 'PROCESSING',
            attempts: { increment: 1 },
            leaseExpiresAt: new Date(now.getTime() + DELETE_LEASE_MS),
            lastError: null,
        },
    })
    return claimed.count === 1
}

export async function drainObjectDeletionJobs(limit = DELETE_BATCH_SIZE): Promise<void> {
    if (!isStorageConfigured) return

    const now = new Date()
    const jobs = await prisma.objectDeletionJob.findMany({
        where: {
            OR: [
                { status: 'PENDING', nextAttemptAt: { lte: now } },
                { status: 'PROCESSING', leaseExpiresAt: { lte: now } },
            ],
        },
        orderBy: { nextAttemptAt: 'asc' },
        take: Math.max(1, Math.min(limit, 100)),
    })

    for (const job of jobs) {
        if (!(await claimDeletionJob(job.id, now))) continue
        const attempt = job.attempts + 1

        try {
            // Bir xil object boshqa test/xabarda ishlatilsa, uni o'chirmaymiz.
            // Reference keyin o'chirilsa yangi outbox job qayta yaratiladi.
            if (!(await isObjectKeyStillReferenced(job.objectKey))) {
                await deleteFromS3(job.objectKey)
            }
            await prisma.objectDeletionJob.delete({ where: { id: job.id } })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown storage deletion error'
            await prisma.objectDeletionJob.updateMany({
                where: { id: job.id, status: 'PROCESSING' },
                data: {
                    status: 'PENDING',
                    leaseExpiresAt: null,
                    nextAttemptAt: new Date(Date.now() + objectDeletionBackoffMs(attempt)),
                    lastError: message.slice(0, 500),
                },
            })
        }
    }
}

export function triggerObjectDeletionDrain(): void {
    if (!isStorageConfigured || activeDrain) return
    activeDrain = drainObjectDeletionJobs()
        .catch(error => {
            console.error(
                'Object deletion queue xatosi:',
                error instanceof Error ? error.message : 'UnknownError',
            )
        })
        .finally(() => {
            activeDrain = null
        })
}

export function startObjectDeletionWorker(): () => void {
    triggerObjectDeletionDrain()
    const timer = setInterval(triggerObjectDeletionDrain, DELETE_POLL_MS)
    timer.unref()
    return () => clearInterval(timer)
}
