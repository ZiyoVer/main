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

        // UserProgress mavjud bo'lmasa yaratamiz
        let progress = await prisma.userProgress.upsert({
            where: { userId },
            create: {
                userId,
                xp: 0,
                streak: 0,
                longestStreak: 0
            },
            update: {}
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

        // Haftalik faollik — so'nggi 7 kun (VisitLog "activity" yozuvlari bo'yicha)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        const weeklyLogs = await prisma.visitLog.findMany({
            where: { userId, action: 'activity', createdAt: { gte: sevenDaysAgo } },
            select: { createdAt: true }
        })
        const dayMap: Record<string, number> = {}
        for (const a of weeklyLogs) {
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
        const XP_PER_ACTIVITY = 10
        const xpGained = XP_PER_ACTIVITY

        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

        // Bitta UPSERT orqali xavfsiz qilib yozish (race-condition ni oldini oladi)
        const updated = await prisma.$transaction(async (tx) => {
            const current = await tx.userProgress.findUnique({ where: { userId } })

            let xp = (current?.xp || 0) + xpGained
            let streak = current ? current.streak : 1
            let longestStreak = current ? current.longestStreak : 1

            if (current?.lastActiveDate) {
                const lastDate = new Date(current.lastActiveDate)
                const lastDay = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate())
                const diffDays = Math.floor((today.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24))

                if (diffDays === 1) {
                    streak += 1
                    longestStreak = Math.max(streak, longestStreak)
                    if (streak % 7 === 0) xp += 50
                    else if (streak % 3 === 0) xp += 15
                } else if (diffDays > 1) {
                    streak = 1
                }
            }

            await tx.visitLog.create({ data: { userId, action: 'activity' } })
            return await tx.userProgress.upsert({
                where: { userId },
                create: { userId, xp, streak, longestStreak, lastActiveDate: now },
                update: { xp, streak, longestStreak, lastActiveDate: now }
            })
        })

        res.json({
            xp: updated.xp,
            streak: updated.streak,
            longestStreak: updated.longestStreak,
            xpGained: xpGained,
        })
    } catch (e) {
        console.error('Progress activity error:', e)
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
            create: { userId, subject, topic, correct: correct || 0, total, lastPracticed: new Date() },
            update: { correct: { increment: correct || 0 }, total: { increment: total }, lastPracticed: new Date() }
        })

        res.json(stat)
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

export default router
