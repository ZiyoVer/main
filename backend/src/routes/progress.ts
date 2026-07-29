import { Router } from 'express'
import prisma from '../utils/db'
import { authenticate } from '../middleware/auth'
import { tashkentDayDifference, tashkentDayKey, tashkentDayWindow } from '../utils/activityDay'

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

        // Zaif mavzular — KENG oламиз (take:50), aks holda eng zaif (past accuracy, kam
        // yechilgan) mavzu top-10 total'ga tushmay tushib qoladi. Accuracy bo'yicha saralash
        // quyida JS'da (computed correct/total) qilinadi.
        const weakTopics = await prisma.topicStat.findMany({
            where: { userId },
            orderBy: [{ total: 'desc' }],
            take: 50,
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
            const key = tashkentDayKey(a.createdAt)
            dayMap[key] = (dayMap[key] || 0) + 1
        }
        const DAY_NAMES = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh']
        const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000)
            const shifted = new Date(d.getTime() + 5 * 60 * 60 * 1000)
            const key = tashkentDayKey(d)
            return { day: DAY_NAMES[shifted.getUTCDay()], count: dayMap[key] || 0 }
        })

        // Streak hisoblash (barcha activity loglari asosida)
        const activityLogs = await prisma.visitLog.findMany({
            where: { userId, action: 'activity' },
            select: { createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 400
        })

        const sortedDays = Array.from(new Set(
            activityLogs.map((l: any) => tashkentDayKey(l.createdAt))
        )).sort((a: string, b: string) => b.localeCompare(a))

        const todayStr = tashkentDayKey(new Date())
        const yesterdayStr = tashkentDayKey(new Date(Date.now() - 86400000))

        let currentStreak = 0
        let longestStreak = 0
        let tempStreak = 0
        let prevDay = ''

        for (const day of sortedDays) {
            if (!prevDay) {
                if (day === todayStr || day === yesterdayStr) {
                    tempStreak = 1
                } else {
                    break
                }
            } else {
                const prev = new Date(prevDay)
                const curr = new Date(day)
                const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000)
                if (diff === 1) {
                    tempStreak++
                } else {
                    break
                }
            }
            prevDay = day
        }
        currentStreak = tempStreak

        let maxStreak = 0
        let runStreak = 0
        let lastDay = ''
        for (const day of [...sortedDays].reverse()) {
            if (!lastDay) {
                runStreak = 1
            } else {
                const prev = new Date(lastDay)
                const curr = new Date(day)
                const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000)
                runStreak = diff === 1 ? runStreak + 1 : 1
            }
            if (runStreak > maxStreak) maxStreak = runStreak
            lastDay = day
        }
        longestStreak = maxStreak

        res.json({
            xp: progress.xp,
            streak: progress.streak,
            longestStreak: progress.longestStreak,
            lastActiveDate: progress.lastActiveDate,
            avgScore: Math.round(avgScore),
            weeklyActivity,
            currentStreak,
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

        const now = new Date()
        const day = tashkentDayWindow(now)

        // Advisory lock barcha Railway replica/processlarida shu user+Tashkent kuni uchun
        // faqat bitta requestni o'tkazadi. Recheck lock ichida — parallel POST ikki marta XP bermaydi.
        const result = await prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'activity:' + userId + ':' + day.key}, 0))`
            const alreadyActive = await tx.visitLog.findFirst({
                where: {
                    userId,
                    action: 'activity',
                    createdAt: { gte: day.start, lt: day.end },
                },
                select: { id: true },
            })
            if (alreadyActive) {
                const current = await tx.userProgress.findUnique({ where: { userId } })
                return { progress: current, xpGained: 0, alreadyDone: true }
            }

            const current = await tx.userProgress.findUnique({ where: { userId } })
            let streak = current ? current.streak : 1
            let longestStreak = current ? current.longestStreak : 1
            let xpGained = XP_PER_ACTIVITY

            if (current?.lastActiveDate) {
                const diffDays = tashkentDayDifference(now, current.lastActiveDate)

                if (diffDays === 1) {
                    streak += 1
                    longestStreak = Math.max(streak, longestStreak)
                    if (streak % 7 === 0) xpGained += 50
                    else if (streak % 3 === 0) xpGained += 15
                } else if (diffDays > 1) {
                    streak = 1
                }
            }

            await tx.visitLog.create({ data: { userId, action: 'activity' } })
            const progress = await tx.userProgress.upsert({
                where: { userId },
                create: { userId, xp: xpGained, streak, longestStreak, lastActiveDate: now },
                // XP boshqa qonuniy manba (masalan flashcard) bilan bir vaqtda yozilsa ham
                // read-modify-write orqali uni bosib yubormaydi.
                update: { xp: { increment: xpGained }, streak, longestStreak, lastActiveDate: now },
            })
            return { progress, xpGained, alreadyDone: false }
        })

        res.json({
            xp: result.progress?.xp || 0,
            streak: result.progress?.streak || 0,
            longestStreak: result.progress?.longestStreak || 0,
            xpGained: result.xpGained,
            alreadyDone: result.alreadyDone,
            ...(result.alreadyDone ? { message: 'Bugun allaqachon faollik qayd etildi' } : {}),
        })
    } catch (e) {
        console.error('Progress activity error:', e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// ────────────────────────────────────────────────────────────
// POST /api/progress/topic — legacy client-write endpoint.
// TopicStat faqat server baholagan test/checkpoint natijalaridan yangilanadi.
// Klient yuborgan correct/total qiymatlarini persist qilish learning profilini
// soxtalashtirishga imkon berardi, shuning uchun endpoint ataylab yopilgan.
// ────────────────────────────────────────────────────────────
router.post('/topic', (_req, res) => {
    res.status(410).json({
        error: 'Mavzu statistikasi faqat server baholagan test natijalaridan yangilanadi.',
        code: 'CLIENT_TOPIC_STATS_DISABLED',
    })
})

export default router
