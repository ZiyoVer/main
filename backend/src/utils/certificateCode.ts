import crypto from 'crypto'

const CERTIFICATE_CODE_PREFIX = 'DMS1'
const CERTIFICATE_CONTEXT = 'dtmmax:milliy-sertifikat:v1'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CODE_PATTERN = /^DMS1-([0-9A-F]{32})-([0-9A-F]{20})$/i

function normalizeAttemptId(attemptId: string): string {
    const normalized = attemptId.trim().toLowerCase()
    if (!UUID_PATTERN.test(normalized)) {
        throw new Error('Sertifikat urinish ID formati noto‘g‘ri')
    }
    return normalized
}
function compactAttemptId(attemptId: string): string {
    return attemptId.replace(/-/g, '').toUpperCase()
}

function expandAttemptId(compactId: string): string {
    const value = compactId.toLowerCase()
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
}

function createSignature(attemptId: string, secret: string): string {
    return crypto
        .createHmac('sha256', secret)
        .update(`${CERTIFICATE_CONTEXT}:${attemptId}`)
        .digest('hex')
        .slice(0, 20)
        .toUpperCase()
}

function safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left)
    const rightBuffer = Buffer.from(right)
    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

export function getCertificateSecret(): string {
    const secret = process.env.CERTIFICATE_SECRET || process.env.JWT_SECRET
    if (!secret || secret.length < 32) {
        throw new Error('CERTIFICATE_SECRET yoki JWT_SECRET kamida 32 ta belgidan iborat bo‘lishi kerak')
    }
    return secret
}

export function createCertificateCode(attemptId: string, secret = getCertificateSecret()): string {
    const normalizedAttemptId = normalizeAttemptId(attemptId)
    return `${CERTIFICATE_CODE_PREFIX}-${compactAttemptId(normalizedAttemptId)}-${createSignature(normalizedAttemptId, secret)}`
}

export function verifyCertificateCode(code: string, secret = getCertificateSecret()): string | null {
    const match = CODE_PATTERN.exec(code.trim())
    if (!match) return null

    const attemptId = expandAttemptId(match[1])
    try {
        const normalizedAttemptId = normalizeAttemptId(attemptId)
        const expectedSignature = createSignature(normalizedAttemptId, secret)
        return safeEqual(match[2].toUpperCase(), expectedSignature) ? normalizedAttemptId : null
    } catch {
        return null
    }
}
