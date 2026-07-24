import path from 'path'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_LONG_EDGE = 2200
const MAX_DECODED_PIXELS = 40_000_000
const OPTIMIZE_FROM_BYTES = 750 * 1024
const WEBP_QUALITY = 92

export class QuestionImageValidationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'QuestionImageValidationError'
    }
}

export interface PreparedQuestionImage {
    buffer: Buffer
    fileName: string
    contentType: string
    width: number
    height: number
    optimized: boolean
    originalBytes: number
}

function safeBaseName(originalName: string): string {
    const parsed = path.parse(originalName)
    const base = parsed.name
        .normalize('NFKC')
        .replace(/[^\p{L}\p{N}._-]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
    return base || 'savol-rasmi'
}

/**
 * Savol rasmini browser uchun tayyorlaydi.
 *
 * Kichik rasm sifatini aslicha saqlaydi. Katta screenshot/fotolarni esa uzun
 * tomoni 2200px dan oshmaydigan WebP'ga aylantiradi. 92 quality formulalar va
 * mayda matn uchun ataylab yuqori tanlangan.
 */
export async function prepareQuestionImage(
    input: Buffer,
    originalName: string,
    contentType: string,
): Promise<PreparedQuestionImage> {
    if (!ALLOWED_MIME_TYPES.has(contentType)) {
        throw new QuestionImageValidationError('Faqat PNG, JPG yoki WebP rasm yuklang')
    }
    if (!Buffer.isBuffer(input) || input.length === 0) {
        throw new QuestionImageValidationError('Rasm fayli bo‘sh')
    }

    let image: Awaited<ReturnType<typeof loadImage>>
    try {
        image = await loadImage(input)
    } catch {
        throw new QuestionImageValidationError('Rasm fayli buzilgan yoki o‘qib bo‘lmaydi')
    }

    const width = Number(image.width)
    const height = Number(image.height)
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
        throw new QuestionImageValidationError('Rasm o‘lchami aniqlanmadi')
    }
    if (width * height > MAX_DECODED_PIXELS) {
        throw new QuestionImageValidationError('Rasm o‘lchami juda katta. 40 megapikseldan kichik rasm yuklang')
    }

    const scale = Math.min(1, MAX_LONG_EDGE / Math.max(width, height))
    const targetWidth = Math.max(1, Math.round(width * scale))
    const targetHeight = Math.max(1, Math.round(height * scale))
    const shouldOptimize = scale < 1 || input.length >= OPTIMIZE_FROM_BYTES

    if (!shouldOptimize) {
        return {
            buffer: input,
            fileName: originalName,
            contentType,
            width,
            height,
            optimized: false,
            originalBytes: input.length,
        }
    }

    const canvas = createCanvas(targetWidth, targetHeight)
    const context = canvas.getContext('2d')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, targetWidth, targetHeight)
    const optimized = canvas.toBuffer('image/webp', WEBP_QUALITY)

    return {
        buffer: optimized,
        fileName: `${safeBaseName(originalName)}.webp`,
        contentType: 'image/webp',
        width: targetWidth,
        height: targetHeight,
        optimized: true,
        originalBytes: input.length,
    }
}
