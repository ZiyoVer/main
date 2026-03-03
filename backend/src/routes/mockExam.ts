import { Router } from 'express'
import prisma from '../utils/db'
import { authenticate, AuthRequest } from '../middleware/auth'
import OpenAI from 'openai'

const router = Router()
router.use(authenticate)

const hasDeepseek = !!process.env.DEEPSEEK_API_KEY
const aiClient = new OpenAI({
    baseURL: hasDeepseek ? 'https://api.deepseek.com' : undefined,
    apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || ''
})
const aiModel = hasDeepseek ? 'deepseek-chat' : 'gpt-4o-mini'

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
- LaTeX formulalar uchun $...$ va $$...$$ ishlatamiz

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
- LaTeX formulalar uchun $...$ va $$...$$ ishlatamiz

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
router.post('/generate', async (req: AuthRequest, res) => {
    try {
        const { subject, examType = 'DTM' } = req.body

        if (!subject) {
            return res.status(400).json({ error: 'subject majburiy' })
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

        // JSON parsing — markdown code block ni tozalash
        let jsonStr = raw.trim()
        const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (match) jsonStr = match[1].trim()

        let questions: any[]
        try {
            questions = JSON.parse(jsonStr)
        } catch {
            return res.status(500).json({ error: 'AI to\'g\'ri format qaytarmadi, qayta urinib ko\'ring' })
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(500).json({ error: 'Savollar generatsiya qilinmadi' })
        }

        // Savollarni tekshirish va normallashtirish
        const normalized = questions.slice(0, config.count).map((q: any, i: number) => ({
            id: i,
            question: q.question || q.text || '',
            options: Array.isArray(q.options) ? q.options.slice(0, 4) : ['A', 'B', 'C', 'D'],
            correct: q.correct || q.correctIdx || 'A',
            explanation: q.explanation || ''
        })).filter(q => q.question.trim().length > 0)

        // Mock exam natijasini saqlash uchun Test yaratamiz (isPublic: false)
        const test = await prisma.test.create({
            data: {
                title: `${examType} Mock: ${subject} — ${new Date().toLocaleDateString('uz-UZ')}`,
                subject,
                isPublic: false,
                creatorId: req.user.id,
                timeLimit: config.timeMinutes,
                questions: {
                    create: normalized.map((q, idx) => ({
                        text: q.question,
                        options: JSON.stringify(q.options),
                        correctIdx: ['A', 'B', 'C', 'D'].indexOf(q.correct),
                        difficulty: 0.0,
                        orderIdx: idx
                    }))
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
            questions: normalized,
            count: normalized.length
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
