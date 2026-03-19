import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuid } from 'uuid'
import path from 'path'

if (!process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY) {
    console.warn('⚠️ S3 credentials topilmadi, yuklashlar ishlamasligi mumkin')
}

const s3Endpoint = process.env.S3_ENDPOINT || 'https://s3.eu-central-2.wasabisys.com'
const s3 = new S3Client({
    region: process.env.S3_REGION || 'eu-central-2',
    endpoint: s3Endpoint,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || ''
    },
    forcePathStyle: true // Wasabi uchun kerak
})

const BUCKET = process.env.S3_BUCKET || 'dtmmax'
const S3_REF_PREFIX = 's3key:'

function getBaseUrl(): string {
    return s3Endpoint.endsWith('/') ? s3Endpoint.slice(0, -1) : s3Endpoint
}

export function buildS3Url(key: string): string {
    return `${getBaseUrl()}/${BUCKET}/${key}`
}

export function toStoredS3Ref(key: string): string {
    return `${S3_REF_PREFIX}${key}`
}

export function extractS3Key(value?: string | null): string | null {
    if (!value) return null
    if (value.startsWith(S3_REF_PREFIX)) return value.slice(S3_REF_PREFIX.length)

    const bucketPrefix = `${getBaseUrl()}/${BUCKET}/`
    if (value.startsWith(bucketPrefix)) {
        return decodeURIComponent(value.slice(bucketPrefix.length))
    }

    return null
}

export async function getSignedS3Url(key: string, expiresIn = 60 * 60): Promise<string> {
    return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn })
}

export async function resolveStoredS3Url(value?: string | null, expiresIn = 60 * 60): Promise<string | null> {
    if (!value) return null
    if (value.startsWith('data:')) return value

    const key = extractS3Key(value)
    if (!key) return value

    return getSignedS3Url(key, expiresIn)
}

/**
 * Faylni S3 ga yuklash
 * @returns Stable storage URL
 */
export async function uploadToS3(
    buffer: Buffer,
    originalName: string,
    folder: string = 'uploads',
    contentType?: string
): Promise<{ key: string; url: string }> {
    const ext = path.extname(originalName)
    const key = `${folder}/${uuid()}${ext}`

    await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType || getMimeType(ext),
    }))

    const url = buildS3Url(key)
    return { key, url }
}

/**
 * Faylni S3 dan o'chirish
 */
export async function deleteFromS3(key: string): Promise<void> {
    await s3.send(new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key
    }))
}

/**
 * MIME type aniqlash
 */
function getMimeType(ext: string): string {
    const types: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.txt': 'text/plain',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml'
    }
    return types[ext.toLowerCase()] || 'application/octet-stream'
}

export default s3
