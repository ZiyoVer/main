import { AI_MODELS } from './aiModels'

export type GeminiVisionImage = {
    data: string
    mimeType: string
}

type GeminiVisionOptions = {
    apiKey: string
    systemPrompt?: string
    prompt: string
    images: GeminiVisionImage[]
    maxOutputTokens?: number
    temperature?: number
    timeoutMs?: number
    fetchImpl?: typeof fetch
    models?: readonly string[]
}

type GeminiVisionResult = {
    model: string
    text: string
    usage: unknown
}

const DEFAULT_MODELS = [
    AI_MODELS.geminiFlash,
    AI_MODELS.geminiFlashLite,
    AI_MODELS.geminiLegacyFlashLite,
] as const

const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504])

export class GeminiVisionRequestError extends Error {
    status: number | null

    constructor(message: string, status: number | null = null) {
        super(message)
        this.name = 'GeminiVisionRequestError'
        this.status = status
    }
}

function responseText(payload: any): string {
    const parts = payload?.candidates?.[0]?.content?.parts
    if (!Array.isArray(parts)) return ''

    return parts
        .filter((part: any) => typeof part?.text === 'string' && part.thought !== true)
        .map((part: any) => part.text)
        .join('\n')
        .trim()
}

function errorMessage(payload: any, fallback: string): string {
    const message = payload?.error?.message
    return typeof message === 'string' && message.trim() ? message.trim() : fallback
}

/**
 * Gemini OpenAI-compatibility endpoint vision so'rovlarida ba'zan bo'sh 503
 * qaytaradi. Native generateContent endpointi provider xatosini aniq beradi va
 * bir model band bo'lsa barqaror Flash-Lite modellariga o'tishga imkon beradi.
 */
export async function generateGeminiVisionContent(options: GeminiVisionOptions): Promise<GeminiVisionResult> {
    const {
        apiKey,
        systemPrompt,
        prompt,
        images,
        maxOutputTokens = 8000,
        temperature = 0.1,
        timeoutMs = 90_000,
        fetchImpl = fetch,
        models = DEFAULT_MODELS,
    } = options

    if (!apiKey) throw new GeminiVisionRequestError('Gemini API kaliti topilmadi')
    if (!prompt.trim()) throw new GeminiVisionRequestError('Vision prompt bo‘sh')
    if (images.length === 0) throw new GeminiVisionRequestError('Vision uchun rasm topilmadi')

    let lastError: GeminiVisionRequestError | null = null

    for (const model of models) {
        try {
            const response = await fetchImpl(
                `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
                {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'x-goog-api-key': apiKey,
                    },
                    signal: AbortSignal.timeout(timeoutMs),
                    body: JSON.stringify({
                        ...(systemPrompt?.trim()
                            ? { systemInstruction: { parts: [{ text: systemPrompt.trim() }] } }
                            : {}),
                        contents: [{
                            role: 'user',
                            parts: [
                                { text: prompt.trim() },
                                ...images.map(image => ({
                                    inlineData: {
                                        mimeType: image.mimeType,
                                        data: image.data,
                                    },
                                })),
                            ],
                        }],
                        generationConfig: {
                            maxOutputTokens,
                            responseMimeType: 'application/json',
                            temperature,
                        },
                    }),
                },
            )

            const raw = await response.text()
            let payload: any = null
            try {
                payload = raw ? JSON.parse(raw) : null
            } catch {
                throw new GeminiVisionRequestError(`Gemini ${model} JSON bo‘lmagan javob qaytardi`, response.status)
            }

            if (!response.ok) {
                const requestError = new GeminiVisionRequestError(
                    errorMessage(payload, `Gemini ${model} ${response.status} qaytardi`),
                    response.status,
                )
                lastError = requestError
                if (TRANSIENT_STATUSES.has(response.status)) continue
                throw requestError
            }

            const text = responseText(payload)
            if (!text) {
                lastError = new GeminiVisionRequestError(`Gemini ${model} bo‘sh javob qaytardi`, response.status)
                continue
            }

            return {
                model,
                text,
                usage: payload?.usageMetadata ?? null,
            }
        } catch (error: any) {
            if (error instanceof GeminiVisionRequestError) {
                lastError = error
                if (error.status !== null && !TRANSIENT_STATUSES.has(error.status)) throw error
                continue
            }

            lastError = new GeminiVisionRequestError(
                error?.name === 'TimeoutError'
                    ? `Gemini vision ${model} timeout`
                    : String(error?.message || error || 'Gemini vision transport xatosi'),
            )
        }
    }

    throw lastError || new GeminiVisionRequestError('Gemini vision modellari javob bermadi')
}
