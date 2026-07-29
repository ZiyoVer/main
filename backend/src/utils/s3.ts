import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuid } from 'uuid'
import path from 'path'

// Env o'zgaruvchisini bir nechta nom variantidan o'qiydi — Railway Bucket ACCESS_KEY_ID/
// SECRET_ACCESS_KEY/BUCKET/ENDPOINT/REGION beradi, AWS SDK esa AWS_* kutadi, bizniki S3_*.
// Shu tufayli qaysi nom bilan ulansa ham ishlaydi (sozlash osonlashadi).
function envAny(...names: string[]): string {
    for (const n of names) {
        const v = process.env[n]
        if (v && v.trim()) return v.trim()
    }
    return ''
}

const S3_ACCESS_KEY = envAny('S3_ACCESS_KEY', 'ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID')
const S3_SECRET_KEY = envAny('S3_SECRET_KEY', 'SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY')
const s3Endpoint = envAny('S3_ENDPOINT', 'ENDPOINT', 'AWS_ENDPOINT_URL_S3', 'AWS_ENDPOINT_URL') || 'https://s3.eu-central-2.wasabisys.com'
// Railway Bucket va ko'p S3-mos xizmatlar (R2 h.k.) region uchun 'auto' ishlatadi
const s3Region = envAny('S3_REGION', 'REGION', 'AWS_REGION') || 'auto'

/** Storage sozlanganmi (kalitlar bormi) — endpointlar 503 berish uchun tekshiradi. */
export const isStorageConfigured = !!(S3_ACCESS_KEY && S3_SECRET_KEY)

if (!isStorageConfigured) {
    console.warn('⚠️ S3/Bucket kalitlari topilmadi (S3_ACCESS_KEY/S3_SECRET_KEY yoki Railway Bucket ACCESS_KEY_ID) — rasm yuklash ishlamaydi')
}

const s3 = new S3Client({
    region: s3Region,
    endpoint: s3Endpoint,
    credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY
    },
    forcePathStyle: true // S3-mos xizmatlar (Railway Bucket / Wasabi / MinIO) uchun path-style
})

const BUCKET = envAny('S3_BUCKET', 'BUCKET', 'AWS_S3_BUCKET', 'BUCKET_NAME') || 'dtmmax'
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

function decodeS3Key(rawKey: string): string | null {
    try {
        const key = decodeURIComponent(rawKey).replace(/^\/+/, '')
        return key && !key.includes('\0') ? key : null
    } catch {
        return null
    }
}

export function extractS3Key(value?: string | null): string | null {
    if (!value) return null
    if (value.startsWith(S3_REF_PREFIX)) {
        return decodeS3Key(value.slice(S3_REF_PREFIX.length).split(/[?#]/, 1)[0])
    }

    try {
        const target = new URL(value)
        const endpoint = new URL(getBaseUrl())
        if (target.origin !== endpoint.origin) return null

        const endpointPath = endpoint.pathname.replace(/\/+$/, '')
        const bucketPath = `${endpointPath}/${encodeURIComponent(BUCKET)}/`
        if (!target.pathname.startsWith(bucketPath)) return null

        // URL.search ataylab olinmaydi: eski signed URL'larda query keyga
        // qo'shilib, DeleteObject noto'g'ri obyektga ketmasligi kerak.
        return decodeS3Key(target.pathname.slice(bucketPath.length))
    } catch {
        return null
    }
}

export function extractS3KeysFromText(value?: string | null): string[] {
    if (!value) return []

    const candidates = new Set<string>([value])
    for (const match of value.matchAll(/!\[[^\]]*]\(([^)]+)\)/g)) {
        if (match[1]) candidates.add(match[1])
    }
    for (const match of value.matchAll(/s3key:[^"',)\]\s]+/g)) {
        candidates.add(match[0])
    }
    for (const match of value.matchAll(/https?:\/\/[^"')\]\s]+/g)) {
        candidates.add(match[0])
    }

    return [...new Set(
        [...candidates]
            .map(candidate => extractS3Key(candidate))
            .filter((key): key is string => Boolean(key))
    )]
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
 * Chat xabaridagi markdown rasm manzillarini yangi signed URL'ga aylantiradi.
 * Yangi xabarlar `s3key:` stable ref saqlaydi; eski xabarlardagi muddati o'tgan
 * bucket signed URL'lari ham extractS3Key orqali yangilanadi.
 */
export async function resolveS3RefsInMarkdown(
    content: string,
    expiresIn = 60 * 60,
): Promise<string> {
    const markdownImage = /(!\[[^\]]*]\()([^)]+)(\))/g
    const targets = Array.from(content.matchAll(markdownImage))
        .map(match => match[2])
        .filter((target): target is string => Boolean(target))
    const uniqueTargets = [...new Set(targets)]

    if (uniqueTargets.length === 0) return content

    const resolved = new Map<string, string>()
    await Promise.all(uniqueTargets.map(async (target) => {
        const key = extractS3Key(target)
        if (!key) return
        resolved.set(target, await getSignedS3Url(key, expiresIn))
    }))
    if (resolved.size === 0) return content

    return content.replace(markdownImage, (full, prefix: string, target: string, suffix: string) => {
        return `${prefix}${resolved.get(target) ?? target}${suffix}`
    })
}

/**
 * Faylni S3 ga yuklash
 * @returns Stable storage URL
 */
export async function uploadToS3(
    buffer: Buffer,
    originalName: string,
    folder: string = 'uploads',
    contentType?: string,
    options?: { cacheControl?: string },
): Promise<{ key: string; url: string }> {
    const ext = path.extname(originalName)
    const key = `${folder}/${uuid()}${ext}`

    await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType || getMimeType(ext),
        ...(options?.cacheControl ? { CacheControl: options.cacheControl } : {}),
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
