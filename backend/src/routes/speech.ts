import { Router } from 'express'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { authenticate, AuthRequest } from '../middleware/auth'
import { consumeAiQuota, quotaExceededMessage, refundAiQuota } from '../utils/aiQuota'
import { GeminiTtsError, generateCharonSpeech, sanitizeSpeechText } from '../utils/geminiTts'

const router = Router()

const speechLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 12,
    keyGenerator: (req: any) => req.user?.id || ipKeyGenerator(req),
    message: { error: 'Audio limiti. Bir necha daqiqadan keyin qayta urinib ko‘ring.' },
    standardHeaders: true,
    legacyHeaders: false,
})

router.post('/speech', authenticate, speechLimiter, async (req: AuthRequest, res) => {
    const text = sanitizeSpeechText(req.body?.text)
    if (!text) return res.status(400).json({ error: 'Ovozga aylantirish uchun matn kerak' })
    if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'Audio xizmati sozlanmagan', code: 'TTS_NOT_CONFIGURED' })
    }

    const quota = await consumeAiQuota(req.user.id, req.user.role, 'tts')
    if (!quota.ok) {
        return res.status(429).json({
            error: quotaExceededMessage('tts'),
            code: 'DAILY_AI_LIMIT',
        })
    }

    try {
        const result = await generateCharonSpeech({
            apiKey: process.env.GEMINI_API_KEY,
            text,
        })
        console.info('AI_TTS_GENERATION', {
            userId: req.user.id,
            model: result.model,
            voice: result.voice,
            textLength: text.length,
            audioBytes: result.audio.length,
            usage: result.usage,
        })

        res.set({
            'Cache-Control': 'private, no-store',
            'Content-Length': String(result.audio.length),
            'Content-Type': result.mimeType,
            'X-DTMMax-TTS-Model': result.model,
            'X-DTMMax-Voice': result.voice,
        })
        return res.send(result.audio)
    } catch (error: any) {
        await refundAiQuota(req.user.id, req.user.role, 'tts').catch(refundError => {
            console.error('TTS quota refund xato:', refundError)
        })
        console.error('Charon TTS xato:', error?.message || error)

        if (error instanceof GeminiTtsError && error.status === 400) {
            return res.status(400).json({ error: error.message })
        }
        return res.status(503).json({
            error: 'Audio vaqtincha tayyorlanmadi. Bir ozdan keyin qayta urinib ko‘ring.',
            code: 'TTS_TEMPORARILY_UNAVAILABLE',
        })
    }
})

export default router
