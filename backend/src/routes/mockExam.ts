import { Router } from 'express'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import prisma from '../utils/db'
import { authenticate, AuthRequest } from '../middleware/auth'
import OpenAI from 'openai'

const router = Router()
router.use(authenticate)

// Mock exam generatsiya uchun qattiq rate limit (har user uchun 5 ta/daqiqa)
const mockExamLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 2,
    keyGenerator: (req: any) => req.user?.id || ipKeyGenerator(req),
    message: { error: 'Mock exam yaratish limiti (2 ta/daqiqa). Biroz kuting.' },
    standardHeaders: true,
    legacyHeaders: false,
})

const hasDeepseek = !!process.env.DEEPSEEK_API_KEY
const aiClient = new OpenAI({
    baseURL: hasDeepseek ? 'https://api.deepseek.com' : undefined,
    apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || ''
})
const aiModel = hasDeepseek ? 'deepseek-chat' : 'gpt-4.1-mini'

function repairAiJson(raw: string): string {
    return raw
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, '\'')
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
}

function parseGeneratedQuestions(raw: string): any[] {
    let jsonStr = raw.trim()
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    if (codeBlockMatch?.[1]) {
        jsonStr = codeBlockMatch[1].trim()
    } else {
        const arrayMatch = jsonStr.match(/\[\s*[\s\S]*\]/)
        if (arrayMatch?.[0]) jsonStr = arrayMatch[0].trim()
    }

    try {
        return JSON.parse(jsonStr)
    } catch {
        const repaired = repairAiJson(jsonStr)
        try {
            return JSON.parse(repaired)
        } catch {
            throw new Error('AI to\'g\'ri format qaytarmadi, qayta urinib ko\'ring')
        }
    }
}

// DTM va Milliy Sertifikat mock exam formatini aniqlash
function getMockExamConfig(subject: string, examType: 'DTM' | 'MS'): { count: number; timeMinutes: number; prompt: string } {
    if (examType === 'DTM') {
        return {
            count: 30,
            timeMinutes: 60,
            prompt: `Sen DTM (Davlat Test Markazi) imtihoni simulyatorisin. ${subject} fanidan 30 ta test savol yarat.
Qoidalar:
- Har bir savol to'liq va aniq bo'lsin
- 4 ta variant (A, B, C, D)
- Faqat bitta to'g'ri javob
- Qiyinlik darajasi: 40% oson, 40% o'rta, 20% qiyin
- Barcha savollar DTM dasturi doirasida
- Matematik ifodalarni MAJBURIY LaTeX bilan yoz: ildiz=$\\sqrt{x}$, kasr=$\\frac{a}{b}$, daraja=$x^{2}$, indeks=$a_{n}$, pi=$\\pi$, ko'paytma=$a \\cdot b$
- Inline: $formula$, blok: $$formula$$

Qat'iy JSON formatda qaytarishin kerak:
[
  {
    "question": "savol matni (LaTeX ishlatilishi mumkin)",
    "options": ["A variant", "B variant", "C variant", "D variant"],
    "correct": "A",
    "explanation": "qisqa tushuntirish (1-2 satr)"
  }
]
Faqat JSON qaytargin, boshqa hech narsa yozma.`
        }
    }
    // Milliy Sertifikat
    return {
        count: 30,
        timeMinutes: 90,
        prompt: `Sen Milliy Sertifikat imtihoni simulyatorisin. ${subject} fanidan 30 ta test savol yarat.
Qoidalar:
- Milliy Sertifikat standartlariga mos
- 4 ta variant (A, B, C, D)
- Faqat bitta to'g'ri javob
- Qiyinlik darajasi: 30% oson, 50% o'rta, 20% qiyin
- Matematik ifodalarni MAJBURIY LaTeX bilan yoz: ildiz=$\\sqrt{x}$, kasr=$\\frac{a}{b}$, daraja=$x^{2}$, indeks=$a_{n}$, pi=$\\pi$, ko'paytma=$a \\cdot b$
- Inline: $formula$, blok: $$formula$$

Qat'iy JSON formatda qaytarishin kerak:
[
  {
    "question": "savol matni",
    "options": ["A variant", "B variant", "C variant", "D variant"],
    "correct": "A",
    "explanation": "qisqa tushuntirish"
  }
]
Faqat JSON qaytargin, boshqa hech narsa yozma.`
    }
}

// ────────────────────────────────────────────────────────────
// POST /api/mock-exam/generate
// Body: { subject, examType: 'DTM' | 'MS' }
// ────────────────────────────────────────────────────────────
router.post('/generate', mockExamLimiter, async (req: AuthRequest, res) => {
    try {
        const { subject, examType = 'DTM' } = req.body

        if (!subject) {
            return res.status(400).json({ error: 'subject majburiy' })
        }

        if (!['DTM', 'MS'].includes(examType)) {
            return res.status(400).json({ error: 'examType faqat "DTM" yoki "MS" bo\'lishi mumkin' })
        }

        const config = getMockExamConfig(subject, examType as 'DTM' | 'MS')

        const completion = await aiClient.chat.completions.create({
            model: aiModel,
            messages: [
                { role: 'system', content: config.prompt },
                { role: 'user', content: `${subject} fanidan ${config.count} ta ${examType} format test savol yarat.` }
            ],
            temperature: 0.7,
            max_tokens: 8000,
        })

        const raw = completion.choices[0]?.message?.content || ''

        let questions: any[]
        try {
            questions = parseGeneratedQuestions(raw)
        } catch (parseErr: any) {
            return res.status(500).json({ error: parseErr?.message || 'AI to\'g\'ri format qaytarmadi, qayta urinib ko\'ring' })
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(500).json({ error: 'Savollar generatsiya qilinmadi' })
        }

        // Savollarni tekshirish va normallashtirish
        const LETTERS = ['A', 'B', 'C', 'D']
        const normalized = questions.slice(0, config.count).map((q: any, i: number) => {
            // correct: 'A'/'B'/'C'/'D' yoki 'a'/'b'/'c'/'d' — katta harfga normalize qilamiz
            let correct = 'A'
            if (typeof q.correct === 'string') {
                const upper = q.correct.toUpperCase()
                correct = LETTERS.includes(upper) ? upper : 'A'
            }
            return {
                id: i,
                question: q.question || q.text || '',
                options: Array.isArray(q.options) ? q.options.slice(0, 4) : ['A variant', 'B variant', 'C variant', 'D variant'],
                correct,         // DB ga yozish uchun saqlanadi
                explanation: q.explanation || '' // DB ga yozish uchun saqlanadi
            }
        }).filter(q => q.question.trim().length > 0)

        // Clientga yuboriladigan versiya — correct/explanation yo'q (xavfsizlik)
        const normalizedForClient = normalized.map(({ correct: _c, explanation: _e, ...rest }) => rest)

        if (normalized.length === 0) {
            return res.status(500).json({ error: 'Yaroqli savollar generatsiya qilinmadi' })
        }

        // Mock exam natijasini saqlash uchun Test yaratamiz (isPublic: false)
        const test = await prisma.test.create({
            data: {
                title: `${examType} Mock: ${subject} — ${new Date().toLocaleDateString('uz-UZ')}`,
                subject,
                isPublic: false,
                creatorId: req.user.id,
                timeLimit: config.timeMinutes,
                questions: {
                    create: normalized.map((q, idx) => {
                        const correctIdx = LETTERS.indexOf(q.correct)
                        return {
                            text: q.question,
                            options: JSON.stringify(q.options),
                            correctIdx: correctIdx >= 0 ? correctIdx : 0,
                            difficulty: 0.0,
                            orderIdx: idx
                        }
                    })
                }
            },
            include: { questions: { orderBy: { orderIdx: 'asc' } } }
        })

        res.json({
            testId: test.id,
            title: test.title,
            subject,
            examType,
            timeMinutes: config.timeMinutes,
            questions: normalizedForClient,
            count: normalizedForClient.length
        })
    } catch (e) {
        console.error('Mock exam generate error:', e)
        res.status(500).json({ error: 'Mock exam yaratishda xatolik yuz berdi' })
    }
})

// ────────────────────────────────────────────────────────────
// GET /api/mock-exam/history
// O'quvchining barcha mock exam urinishlari
// ────────────────────────────────────────────────────────────
router.get('/history', async (req: AuthRequest, res) => {
    try {
        const userId = req.user.id

        // Mock exam testlari — "DTM Mock:" yoki "MS Mock:" bilan boshlanadi
        const attempts = await prisma.testAttempt.findMany({
            where: {
                userId,
                test: {
                    OR: [
                        { title: { startsWith: 'DTM Mock:' } },
                        { title: { startsWith: 'MS Mock:' } }
                    ]
                }
            },
            include: {
                test: {
                    select: {
                        title: true,
                        subject: true,
                        timeLimit: true,
                        _count: { select: { questions: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        })

        res.json(attempts.map(a => ({
            id: a.id,
            title: a.test.title,
            subject: a.test.subject,
            score: Math.round(a.score),
            raschAbility: a.raschAbility,
            totalQuestions: a.test._count.questions,
            date: a.createdAt
        })))
    } catch (e) {
        console.error('Mock exam history error:', e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

export default router
