import { Router } from 'express'
import multer from 'multer'
import pdfParse from 'pdf-parse'
import OpenAI from 'openai'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'
import { updateAbility } from '../utils/rasch'

const router = Router()

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.OPENAI_API_KEY || ''
})

// Public testlar ro'yxati (barcha o'quvchilar uchun)
router.get('/public', authenticate, async (req: AuthRequest, res) => {
    try {
        const tests = await prisma.test.findMany({
            where: { isPublic: true },
            include: {
                _count: { select: { questions: true, attempts: true } },
                creator: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        })
        res.json(tests)
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// AI yordamida fayl/screenshot dan test savollari yaratish
router.post('/generate-from-file', authenticate, requireRole('TEACHER', 'ADMIN'), upload.single('file'), async (req: AuthRequest, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Fayl yuklanmadi' })
        const { mimetype, buffer } = req.file
        const subject = (req.body.subject as string) || ''
        const jsonPrompt = `Javobni FAQAT JSON array formatda qaytargil, boshqa hech narsa yozma:
[{"text":"Savol matni?","options":["A variant","B variant","C variant","D variant"],"correctIdx":0}]
correctIdx — to'g'ri javob indeksi (0=A, 1=B, 2=C, 3=D). Eng kamida 5 ta, eng ko'pi 20 ta savol.${subject ? ` Fan: ${subject}.` : ''}`

        let messages: any[]

        if (mimetype === 'application/pdf') {
            const data = await pdfParse(buffer)
            const text = data.text.trim().substring(0, 8000)
            messages = [{ role: 'user', content: `Quyidagi matndan test savollari yaratib ber.\n${jsonPrompt}\n\nMatn:\n${text}` }]
        } else if (mimetype.startsWith('image/')) {
            const base64 = buffer.toString('base64')
            messages = [{
                role: 'user',
                content: [
                    { type: 'image_url', image_url: { url: `data:${mimetype};base64,${base64}` } },
                    { type: 'text', text: `Bu rasmdagi test savollarini ajratib ol va yangi formatda qaytargil.\n${jsonPrompt}` }
                ]
            }]
        } else {
            return res.status(400).json({ error: 'Faqat PDF va rasm fayllari qo\'llab-quvvatlanadi' })
        }

        const completion = await openai.chat.completions.create({
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: 'Siz test savollari generatorisiz. FAQAT JSON formatda javob bering.' },
                ...messages
            ],
            max_tokens: 4096,
            temperature: 0.2
        })

        const content = completion.choices[0]?.message?.content || '[]'
        const jsonMatch = content.match(/\[[\s\S]*\]/)
        if (!jsonMatch) return res.status(500).json({ error: 'AI savollarni ajrata olmadi, PDF formatda yuklang' })

        const questions = JSON.parse(jsonMatch[0])
        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(500).json({ error: 'AI hech qanday savol topa olmadi' })
        }
        res.json({ questions })
    } catch (e: any) {
        console.error('AI test generation error:', e.message)
        res.status(500).json({ error: 'AI test yarata olmadi. PDF formatini sinab ko\'ring.' })
    }
})

// O'qituvchi: Test yaratish
router.post('/create', authenticate, requireRole('TEACHER', 'ADMIN'), async (req: AuthRequest, res) => {
    try {
        const { title, description, subject, isPublic, questions } = req.body
        if (!title || !questions?.length) {
            return res.status(400).json({ error: 'Test nomi va savollar kerak' })
        }

        const test = await prisma.test.create({
            data: {
                title,
                description: description || null,
                subject: subject || null,
                isPublic: isPublic || false,
                creatorId: req.user.id,
                questions: {
                    create: questions.map((q: any, i: number) => ({
                        text: q.text,
                        options: JSON.stringify(q.options),
                        correctIdx: q.correctIdx,
                        difficulty: q.difficulty || 0.0,
                        orderIdx: i
                    }))
                }
            },
            include: { questions: true }
        })

        res.status(201).json(test)
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})


// Test olish (link bo'yicha ham)
router.get('/by-link/:shareLink', authenticate, async (req: AuthRequest, res) => {
    try {
        const test = await prisma.test.findUnique({
            where: { shareLink: req.params.shareLink as string },
            include: {
                questions: { orderBy: { orderIdx: 'asc' }, select: { id: true, text: true, options: true, orderIdx: true, correctIdx: true } },
                creator: { select: { name: true } }
            }
        })
        if (!test) return res.status(404).json({ error: 'Test topilmadi' })
        res.json(test)
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Test yechish va Rasch baholash
router.post('/:testId/submit', authenticate, async (req: AuthRequest, res) => {
    try {
        const { answers } = req.body // [{questionId, selectedIdx}]
        const test = await prisma.test.findUnique({
            where: { id: req.params.testId as string },
            include: { questions: true }
        })
        if (!test) return res.status(404).json({ error: 'Test topilmadi' })

        // Javoblarni tekshirish
        const results = answers.map((a: any) => {
            const q = test.questions.find(q => q.id === a.questionId)
            return {
                questionId: a.questionId,
                selectedIdx: a.selectedIdx,
                isCorrect: q ? q.correctIdx === a.selectedIdx : false,
                difficulty: q?.difficulty || 0.0
            }
        })

        const correct = results.filter((r: any) => r.isCorrect).length
        const score = test.questions.length > 0 ? (correct / test.questions.length) * 100 : 0

        // Rasch ability hisoblash
        const profile = await prisma.studentProfile.findUnique({
            where: { userId: req.user.id }
        })
        const currentAbility = profile?.abilityLevel || 0.0
        const newAbility = updateAbility(currentAbility, results.map((r: any) => ({
            difficulty: r.difficulty,
            isCorrect: r.isCorrect
        })))

        // Natijani saqlash
        const attempt = await prisma.testAttempt.create({
            data: {
                testId: test.id,
                userId: req.user.id,
                answers: JSON.stringify(results),
                score: Math.round(score * 100) / 100,
                raschAbility: newAbility
            }
        })

        // Profilni yangilash
        if (profile) {
            await prisma.studentProfile.update({
                where: { userId: req.user.id },
                data: {
                    abilityLevel: newAbility,
                    totalTests: { increment: 1 },
                    avgScore: Math.round(((profile.avgScore * profile.totalTests + score) / (profile.totalTests + 1)) * 100) / 100
                }
            })
        }

        res.json({
            attempt,
            score: Math.round(score * 100) / 100,
            correct,
            total: test.questions.length,
            newAbility,
            results
        })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// O'qituvchining testlari
router.get('/my-tests', authenticate, requireRole('TEACHER', 'ADMIN'), async (req: AuthRequest, res) => {
    try {
        const tests = await prisma.test.findMany({
            where: { creatorId: req.user.id },
            include: { _count: { select: { questions: true, attempts: true } } },
            orderBy: { createdAt: 'desc' }
        })
        res.json(tests)
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Admin: barcha testlar
router.get('/all', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const tests = await prisma.test.findMany({
            include: {
                _count: { select: { questions: true, attempts: true } },
                creator: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        })
        res.json(tests)
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// O'quvchining test natijalari
router.get('/my-results', authenticate, async (req: AuthRequest, res) => {
    try {
        const attempts = await prisma.testAttempt.findMany({
            where: { userId: req.user.id },
            include: { test: { select: { title: true, subject: true } } },
            orderBy: { createdAt: 'desc' }
        })
        res.json(attempts)
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Test statistikasi (o'qituvchi/admin)
router.get('/:testId/analytics', authenticate, requireRole('TEACHER', 'ADMIN'), async (req: AuthRequest, res) => {
    try {
        const where = req.user.role === 'ADMIN'
            ? { id: req.params.testId as string }
            : { id: req.params.testId as string, creatorId: req.user.id }

        const test = await prisma.test.findFirst({
            where,
            include: {
                questions: { orderBy: { orderIdx: 'asc' } },
                attempts: {
                    include: { user: { select: { name: true, email: true } } },
                    orderBy: { createdAt: 'desc' }
                }
            }
        })
        if (!test) return res.status(404).json({ error: 'Test topilmadi yoki ruxsat yo\'q' })

        // Har bir savol bo'yicha statistika
        const questionStats = test.questions.map(q => {
            const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
            let totalAnswered = 0
            let correctCount = 0
            const optionCounts = [0, 0, 0, 0]

            for (const attempt of test.attempts) {
                let answers: any[] = []
                try { answers = JSON.parse(attempt.answers as string) } catch { }
                const ans = answers.find((a: any) => a.questionId === q.id)
                if (ans != null) {
                    totalAnswered++
                    if (ans.isCorrect) correctCount++
                    const idx = ans.selectedIdx
                    if (idx >= 0 && idx < 4) optionCounts[idx]++
                }
            }
            return {
                id: q.id, text: q.text, correctIdx: q.correctIdx, options: opts,
                totalAnswered, correctCount,
                errorRate: totalAnswered > 0 ? Math.round((1 - correctCount / totalAnswered) * 100) : 0,
                optionCounts
            }
        })

        const totalAttempts = test.attempts.length
        const avgScore = totalAttempts > 0
            ? Math.round(test.attempts.reduce((s: number, a: any) => s + a.score, 0) / totalAttempts * 10) / 10
            : 0

        res.json({
            test: { id: test.id, title: test.title, subject: test.subject },
            totalAttempts, avgScore,
            students: test.attempts.map((a: any) => ({
                name: a.user?.name || 'Noma\'lum',
                score: a.score,
                createdAt: a.createdAt
            })),
            questionStats
        })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Test o'chirish (o'qituvchi/admin)
router.delete('/:testId', authenticate, requireRole('TEACHER', 'ADMIN'), async (req: AuthRequest, res) => {
    try {
        // Admin har qanday testni o'chira oladi, o'qituvchi faqat o'zinikini
        const where = req.user.role === 'ADMIN'
            ? { id: req.params.testId as string }
            : { id: req.params.testId as string, creatorId: req.user.id }
        const deleted = await prisma.test.deleteMany({ where })
        if (deleted.count === 0) return res.status(404).json({ error: 'Test topilmadi yoki ruxsat yo\'q' })
        res.json({ message: 'Test o\'chirildi' })
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

export default router
