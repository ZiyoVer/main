import { AI_MODELS } from './aiModels'

const MAX_SPEECH_TEXT_LENGTH = 2400
const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'

type TtsOptions = {
    apiKey: string
    text: string
    fetchImpl?: typeof fetch
    timeoutMs?: number
}

export type CharonSpeechResult = {
    audio: Buffer
    mimeType: 'audio/wav'
    model: string
    sampleRate: number
    usage: unknown
    voice: 'Charon'
}

export class GeminiTtsError extends Error {
    status: number | null
    clientFault: boolean

    constructor(message: string, status: number | null = null, clientFault = false) {
        super(message)
        this.name = 'GeminiTtsError'
        this.status = status
        this.clientFault = clientFault
    }
}

export function sanitizeSpeechText(value: unknown): string {
    if (typeof value !== 'string') return ''

    return value
        // Interaktiv testning yashirin javob kalitini ovoz chiqarib o'qimaymiz.
        .replace(/```test\s*[\s\S]*?```/gi, ' ')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
        .replace(/\[([^\]]+)]\((?:[^()]|\([^)]*\))*\)/g, '$1')
        .replace(/<\/?[^>]+>/g, ' ')
        .replace(/^[\t ]{0,3}#{1,6}[\t ]+/gm, '')
        .replace(/[*_~`>|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_SPEECH_TEXT_LENGTH)
}

function extractAudio(payload: any): { data: string; mimeType: string; sampleRate: number } | null {
    if (!Array.isArray(payload?.steps)) return null

    for (let stepIndex = payload.steps.length - 1; stepIndex >= 0; stepIndex--) {
        const step = payload.steps[stepIndex]
        if (step?.type !== 'model_output' || !Array.isArray(step.content)) continue
        for (let contentIndex = step.content.length - 1; contentIndex >= 0; contentIndex--) {
            const content = step.content[contentIndex]
            if (content?.type === 'audio' && typeof content.data === 'string' && content.data) {
                return {
                    data: content.data,
                    mimeType: typeof content.mime_type === 'string' ? content.mime_type : 'audio/l16',
                    sampleRate: Number.isFinite(content.sample_rate) ? content.sample_rate : 24000,
                }
            }
        }
    }
    return null
}

function pcmToWav(pcm: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
    const header = Buffer.alloc(44)
    const byteRate = sampleRate * channels * bitsPerSample / 8
    const blockAlign = channels * bitsPerSample / 8

    header.write('RIFF', 0)
    header.writeUInt32LE(36 + pcm.length, 4)
    header.write('WAVE', 8)
    header.write('fmt ', 12)
    header.writeUInt32LE(16, 16)
    header.writeUInt16LE(1, 20)
    header.writeUInt16LE(channels, 22)
    header.writeUInt32LE(sampleRate, 24)
    header.writeUInt32LE(byteRate, 28)
    header.writeUInt16LE(blockAlign, 32)
    header.writeUInt16LE(bitsPerSample, 34)
    header.write('data', 36)
    header.writeUInt32LE(pcm.length, 40)
    return Buffer.concat([header, pcm])
}

export async function generateCharonSpeech(options: TtsOptions): Promise<CharonSpeechResult> {
    const {
        apiKey,
        fetchImpl = fetch,
        timeoutMs = 90_000,
    } = options
    const text = sanitizeSpeechText(options.text)

    if (!apiKey) throw new GeminiTtsError('Gemini API kaliti topilmadi')
    if (!text) throw new GeminiTtsError('Ovozga aylantirish uchun matn topilmadi', 400, true)

    let lastError: GeminiTtsError | null = null
    for (let attempt = 0; attempt < 2; attempt++) {
        let response: Response
        try {
            response = await fetchImpl(GEMINI_INTERACTIONS_URL, {
                method: 'POST',
                headers: {
                    'Api-Revision': '2026-05-20',
                    'content-type': 'application/json',
                    'x-goog-api-key': apiKey,
                },
                signal: AbortSignal.timeout(timeoutMs),
                body: JSON.stringify({
                    model: AI_MODELS.geminiTts,
                    input: `Read the transcript exactly as written. Use an informative, calm, natural pace. Preserve the transcript's original language.\n\nTranscript:\n${text}`,
                    response_format: {
                        type: 'audio',
                    },
                    generation_config: {
                        speech_config: [{ voice: 'Charon' }],
                    },
                    store: false,
                }),
            })
        } catch (error: any) {
            lastError = new GeminiTtsError(
                error?.name === 'TimeoutError' ? 'Gemini TTS timeout' : String(error?.message || error),
            )
            continue
        }

        const raw = await response.text()
        let payload: any = null
        try {
            payload = raw ? JSON.parse(raw) : null
        } catch {
            lastError = new GeminiTtsError('Gemini TTS noto‘g‘ri javob qaytardi', response.status)
            continue
        }

        if (!response.ok) {
            const message = typeof payload?.error?.message === 'string'
                ? payload.error.message
                : `Gemini TTS ${response.status} qaytardi`
            lastError = new GeminiTtsError(message, response.status)
            if (![408, 429, 500, 502, 503, 504].includes(response.status)) throw lastError
            continue
        }

        const audioBlock = extractAudio(payload)
        if (!audioBlock) {
            lastError = new GeminiTtsError('Gemini TTS audio qaytarmadi', response.status)
            continue
        }

        const decoded = Buffer.from(audioBlock.data, 'base64')
        if (decoded.length === 0 || decoded.length > 20 * 1024 * 1024) {
            throw new GeminiTtsError('Gemini TTS audio hajmi noto‘g‘ri', response.status)
        }
        const isWav = audioBlock.mimeType === 'audio/wav'
            && decoded.length >= 12
            && decoded.subarray(0, 4).toString('ascii') === 'RIFF'
            && decoded.subarray(8, 12).toString('ascii') === 'WAVE'

        return {
            audio: isWav ? decoded : pcmToWav(decoded, audioBlock.sampleRate),
            mimeType: 'audio/wav',
            model: AI_MODELS.geminiTts,
            sampleRate: audioBlock.sampleRate,
            usage: payload?.usage ?? null,
            voice: 'Charon',
        }
    }

    throw lastError || new GeminiTtsError('Gemini TTS javob bermadi')
}
