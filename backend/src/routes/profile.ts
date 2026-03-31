import { Router } from 'express'
import prisma from '../utils/db'
import { authenticate, AuthRequest } from '../middleware/auth'
import { normalizeSubject } from '../utils/subjects'
import { parseOptionalExamDate, parseOptionalExamType, parseOptionalStudyHours, parseOptionalTargetScore } from '../utils/profileValidation'

const router = Router()
const MAX_PROFILE_TEXT_LENGTH = 1000
const MAX_TOPIC_ITEMS = 30
const MAX_TOPIC_LENGTH = 120

function clampText(value: unknown, fieldName: string) {
    if (value === undefined) return undefined
    if (value === null || value === '') return null
    if (typeof value !== 'string') {
        throw new Error(`${fieldName} matn bo'lishi kerak`)
    }
    const trimmed = value.trim()
    if (trimmed.length > MAX_PROFILE_TEXT_LENGTH) {
        throw new Error(`${fieldName} juda uzun`)
    }
    return trimmed || null
}

function normalizeTopicList(value: unknown, fieldName: string) {
    if (value === undefined) return undefined
    if (value === null || value === '') return null
    if (!Array.isArray(value)) {
        throw new Error(`${fieldName} array bo'lishi kerak`)
    }
    if (value.length > MAX_TOPIC_ITEMS) {
        throw new Error(`${fieldName} juda ko'p elementdan iborat`)
    }
    const items = value
        .map(item => typeof item === 'string' ? item.trim() : '')
        .filter(Boolean)
    if (items.some(item => item.length > MAX_TOPIC_LENGTH)) {
        throw new Error(`${fieldName} ichidagi element juda uzun`)
    }
    return items.length > 0 ? JSON.stringify(items) : null
}

// Profil olish
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const profile = await prisma.studentProfile.findUnique({
            where: { userId: req.user.id }
        })
        res.json(profile)
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Profil yangilash (onboarding)
router.put('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const { subject, subject2, examType, targetScore, weakTopics, strongTopics, concerns, examDate, studyHoursPerDay, onboardingDone } = req.body
        const normalizedSubject = subject !== undefined ? normalizeSubject(subject) : undefined
        const normalizedSubject2 = subject2 !== undefined ? normalizeSubject(subject2) : undefined
        const normalizedExamType = parseOptionalExamType(examType)
        const normalizedTargetScore = parseOptionalTargetScore(targetScore)
        const normalizedExamDate = parseOptionalExamDate(examDate)
        const normalizedStudyHours = parseOptionalStudyHours(studyHoursPerDay)
        const normalizedConcerns = clampText(concerns, 'concerns')
        const normalizedWeakTopics = normalizeTopicList(weakTopics, 'weakTopics')
        const normalizedStrongTopics = normalizeTopicList(strongTopics, 'strongTopics')

        let profile = await prisma.studentProfile.findUnique({
            where: { userId: req.user.id }
        })

        if (!profile) {
            profile = await prisma.studentProfile.create({
                data: {
                    userId: req.user.id,
                    subject: normalizedSubject ?? null,
                    subject2: normalizedSubject2 ?? null,
                    examType: normalizedExamType ?? null,
                    targetScore: normalizedTargetScore ?? null,
                    concerns: normalizedConcerns,
                    studyHoursPerDay: normalizedStudyHours ?? null,
                    weakTopics: normalizedWeakTopics,
                    strongTopics: normalizedStrongTopics,
                    examDate: normalizedExamDate ?? null,
                    onboardingDone: onboardingDone !== undefined ? onboardingDone : true
                }
            })
        } else {
            profile = await prisma.studentProfile.update({
                where: { userId: req.user.id },
                data: {
                    ...(subject !== undefined && { subject: normalizedSubject }),
                    ...(subject2 !== undefined && { subject2: normalizedSubject2 }),
                    ...(examType !== undefined && { examType: normalizedExamType }),
                    ...(targetScore !== undefined && { targetScore: normalizedTargetScore }),
                    ...(concerns !== undefined && { concerns: normalizedConcerns }),
                    ...(studyHoursPerDay !== undefined && { studyHoursPerDay: normalizedStudyHours }),
                    ...(weakTopics !== undefined && { weakTopics: normalizedWeakTopics }),
                    ...(strongTopics !== undefined && { strongTopics: normalizedStrongTopics }),
                    ...(examDate !== undefined && { examDate: normalizedExamDate }),
                    ...(onboardingDone !== undefined && { onboardingDone })
                }
            })
        }
        res.json(profile)
    } catch (e: any) {
        console.error(e)
        const message = e?.message || 'Server xatoligi'
        const isValidationError = /matn bo'lishi kerak|juda uzun|array bo'lishi kerak|juda ko'p element|examType|examDate|targetScore|studyHoursPerDay/.test(message)
        res.status(isValidationError ? 400 : 500).json({ error: isValidationError ? message : 'Server xatoligi' })
    }
})

export default router
