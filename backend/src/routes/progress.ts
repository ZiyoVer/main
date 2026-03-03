import { Router } from 'express'
import prisma from '../utils/db'
import { authenticate } from '../middleware/auth'

const router = Router()

// Barcha endpointlar uchun auth talab
router.use(authenticate)

// ────────────────────────────────────────────────────────────
// GET /api/progress/me — XP, streak, prognoz
// ────────────────────────────────────────────────────────────
router.get('/me', async (req: any, res) => {
    try {
        const userId = req.user.id

        // UserProgress mavjud bo'lmasa yaratamiz (upsert)
        const progress = await prisma.userProgress.upsert({
            where: { userId },
            create: { userId },
            update: {},
        })

        // Zaif mavzular
        const weakTopics = await prisma.topicStat.findMany({
            where: { userId },
            orderBy: [{ total: 'desc' }],
            take: 10,
        })

        // So'nggi 10 test natijasi
        const recentTests = await prisma.testAttempt.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { test: { select: { title: true, subject: true } } },
        })

        // Ball prognozi (so'nggi 5 test o'rtachasi * 0.9 = taxminiy DTM ball)
        const avgScore = recentTests.length > 0
            ? recentTests.reduce((s, a) => s + a.score, 0) / recentTests.length
            : 0

        // Haftalik faollik — so'nggi 7 kun (TestAttempt sanaları bo'yicha)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        const weeklyAttempts = await prisma.testAttempt.findMany({
            where: { userId, createdAt: { gte: sevenDaysAgo } },
            select: { createdAt: true }
        })
        const dayMap: Record<string, number> = {}
        for (const a of weeklyAttempts) {
            const key = a.createdAt.toISOString().split('T')[0]
            dayMap[key] = (dayMap[key] || 0) + 1
        }
        const DAY_NAMES = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh']
        const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000)
            const key = d.toISOString().split('T')[0]
            return { day: DAY_NAMES[d.getDay()], count: dayMap[key] || 0 }
        })

        res.json({
            xp: progress.xp,
            streak: progress.streak,
            longestStreak: progress.longestStreak,
            lastActiveDate: progress.lastActiveDate,
            avgScore: Math.round(avgScore),
            weeklyActivity,
            recentTests: recentTests.map(a => ({
                id: a.id,
                title: a.test.title,
                subject: a.test.subject,
                score: Math.round(a.score),
                date: a.createdAt,
            })),
            weakTopics: weakTopics
                .filter(t => t.total >= 3)
                .map(t => ({
                    subject: t.subject,
                    topic: t.topic,
                    accuracy: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0,
                    total: t.total,
                }))
                .sort((a, b) => a.accuracy - b.accuracy)
                .slice(0, 5),
        })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// ────────────────────────────────────────────────────────────
// POST /api/progress/activity — Kunlik faollik qayd qilish
// Streak yangilash + XP qo'shish
// ────────────────────────────────────────────────────────────
router.post('/activity', async (req: any, res) => {
    try {
        const userId = req.user.id
        const { xpGained = 10 } = req.body

        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

        const progress = await prisma.userProgress.upsert({
            where: { userId },
            create: { userId, xp: xpGained, streak: 1, longestStreak: 1, lastActiveDate: now },
            update: {},
        })

        // Streak mantiq
        let streak = progress.streak
        let longestStreak = progress.longestStreak
        let xp = progress.xp + xpGained

        if (progress.lastActiveDate) {
            const lastDate = new Date(progress.lastActiveDate)
            const lastDay = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate())
            const diffDays = Math.floor((today.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24))

            if (diffDays === 0) {
                // Bugun allaqachon faol — faqat XP qo'shamiz, streak o'zgarmaydi
                xp = progress.xp + xpGained
            } else if (diffDays === 1) {
                // Ketma-ket kun — streak o'sadi
                streak = progress.streak + 1
                longestStreak = Math.max(streak, progress.longestStreak)
                // Streak bonus XP
                if (streak % 7 === 0) xp += 50  // Haftalik bonus
                else if (streak % 3 === 0) xp += 15  // 3 kunlik bonus
            } else {
                // Gap — streak sıfırlanadi
                streak = 1
            }
        }

        const updated = await prisma.userProgress.update({
            where: { userId },
            data: { xp, streak, longestStreak, lastActiveDate: now },
        })

        res.json({
            xp: updated.xp,
            streak: updated.streak,
            longestStreak: updated.longestStreak,
            xpGained: xpGained,
        })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// ────────────────────────────────────────────────────────────
// POST /api/progress/topic — Mavzu statistikasini yangilash
// Body: { subject, topic, correct, total }
// ────────────────────────────────────────────────────────────
router.post('/topic', async (req: any, res) => {
    try {
        const userId = req.user.id
        const { subject, topic, correct, total } = req.body

        if (!subject || !topic || total === undefined) {
            return res.status(400).json({ error: 'subject, topic, total majburiy' })
        }

        const stat = await prisma.topicStat.upsert({
            where: { userId_subject_topic: { userId, subject, topic } },
            create: {
                userId,
                subject,
                topic,
                correct: correct || 0,
                total,
                lastPracticed: new Date(),
            },
            update: {
                correct: { increment: correct || 0 },
                total: { increment: total },
                lastPracticed: new Date(),
            },
        })

        res.json(stat)
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

export default router
