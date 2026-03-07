import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
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

/**
 * Faylni S3 ga yuklash
 * @returns Public URL
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
        ACL: 'public-read'
    }))

    // Use dynamic endpoint depending on if it has trailing slash
    const baseUrl = s3Endpoint.endsWith('/') ? s3Endpoint.slice(0, -1) : s3Endpoint
    const url = `${baseUrl}/${BUCKET}/${key}`
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
