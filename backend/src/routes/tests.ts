import { Router } from 'express'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'
import { updateAbility } from '../utils/rasch'

const router = Router()

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

// Public testlar ro'yxati (o'quvchilar uchun)
router.get('/public', authenticate, async (req: AuthRequest, res) => {
    try {
        const tests = await prisma.test.findMany({
            where: { isPublic: true },
            select: {
                id: true, title: true, description: true, subject: true,
                createdAt: true, _count: { select: { questions: true } },
                creator: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        })
        res.json(tests)
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Test olish (link bo'yicha ham)
router.get('/by-link/:shareLink', authenticate, async (req: AuthRequest, res) => {
    try {
        const test = await prisma.test.findUnique({
            where: { shareLink: req.params.shareLink as string },
            include: {
                questions: { orderBy: { orderIdx: 'asc' }, select: { id: true, text: true, options: true, orderIdx: true } },
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

// Test o'chirish (o'qituvchi/admin)
router.delete('/:testId', authenticate, requireRole('TEACHER', 'ADMIN'), async (req: AuthRequest, res) => {
    try {
        await prisma.test.deleteMany({
            where: { id: req.params.testId as string, creatorId: req.user.id }
        })
        res.json({ message: 'Test o\'chirildi' })
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

export default router
