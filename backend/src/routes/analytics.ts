import { Router } from 'express'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'
import { getOnlineUsers } from '../utils/onlineTracker'

const router = Router()
const PRESENCE_INTERVAL_MINUTES = 2

// GET /public-stats — autentifikatsiya talab qilinmaydi (landing page uchun)
router.get('/public-stats', async (_req, res) => {
    try {
        const [totalUsers, totalPublicTests] = await Promise.all([
            prisma.user.count({ where: { role: 'STUDENT' } }),
            prisma.test.count({ where: { isPublic: true } }),
        ])
        res.json({ totalStudents: totalUsers, totalPublicTests })
    } catch {
        res.json({ totalStudents: 0, totalPublicTests: 0 })
    }
})

// Admin: Platformaga to'liq statistikalar
router.get('/stats', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const now = new Date()
        const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const w1 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const m1 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

        const [
            totalUsers, students, teachers,
            last24h, lastWeek, lastMonth, totalVisits,
            totalTests, totalChats, totalMessages, messages7d,
            totalDocuments, totalChunks, totalAttempts, attempts30d,
            recentUsers,
            emailVerifiedCount,
            avgAbilityResult,
            newUsers24h,
            activeUsers7d,
            activeUsers30d,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { role: 'STUDENT' } }),
            prisma.user.count({ where: { role: 'TEACHER' } }),
            prisma.visitLog.count({ where: { action: 'login', createdAt: { gte: h24 } } }),
            prisma.visitLog.count({ where: { action: 'login', createdAt: { gte: w1 } } }),
            prisma.visitLog.count({ where: { action: 'login', createdAt: { gte: m1 } } }),
            prisma.visitLog.count(),
            prisma.test.count(),
            prisma.chat.count(),
            prisma.message.count(),
            prisma.message.count({ where: { createdAt: { gte: w1 } } }),
            prisma.document.count(),
            prisma.documentChunk.count(),
            prisma.testAttempt.count(),
            prisma.testAttempt.count({ where: { createdAt: { gte: m1 } } }),
            prisma.user.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: { id: true, name: true, email: true, role: true, createdAt: true }
            }),
            prisma.user.count({ where: { emailVerified: true } }),
            prisma.studentProfile.aggregate({ _avg: { abilityLevel: true } }),
            prisma.user.count({ where: { createdAt: { gte: h24 } } }),
            prisma.visitLog.findMany({
                where: { userId: { not: null }, createdAt: { gte: w1 }, action: { in: ['login', 'register', 'activity', 'presence'] } },
                select: { userId: true },
                distinct: ['userId']
            }),
            prisma.visitLog.findMany({
                where: { userId: { not: null }, createdAt: { gte: m1 }, action: { in: ['login', 'register', 'activity', 'presence'] } },
                select: { userId: true },
                distinct: ['userId']
            }),
        ])

        // O'rtacha test ball
        const avgScoreResult = await prisma.testAttempt.aggregate({ _avg: { score: true } })

        const onlineUsers = await getOnlineUsers()

        res.json({
            totalUsers, students, teachers,
            logins24h: last24h, loginsWeek: lastWeek, loginsMonth: lastMonth, totalVisits,
            totalTests, totalChats, totalMessages, messages7d,
            totalDocuments, totalChunks, totalAttempts, attempts30d,
            avgScore: Math.round((avgScoreResult._avg.score || 0) * 100) / 100,
            recentUsers,
            emailVerifiedCount,
            avgAbility: Math.round((avgAbilityResult._avg.abilityLevel || 0) * 100) / 100,
            onlineNow: onlineUsers.length,
            newUsers24h,
            activeUsers7d: activeUsers7d.length,
            activeUsers30d: activeUsers30d.length,
        })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Admin: 7 kunlik kirish trendi (har kun nechi marta kirgan)
router.get('/login-trend', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const now = new Date()
        const sevenDaysAgo = new Date(now)
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
        sevenDaysAgo.setHours(0, 0, 0, 0)

        const logs = await prisma.visitLog.findMany({
            where: { action: 'login', createdAt: { gte: sevenDaysAgo } },
            select: { createdAt: true }
        })

        // Kunlar bo'yicha guruhlash
        const countMap: Record<string, number> = {}
        for (const log of logs) {
            const key = log.createdAt.toISOString().split('T')[0]
            countMap[key] = (countMap[key] || 0) + 1
        }

        const days: { day: string; count: number }[] = []
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now)
            d.setDate(d.getDate() - i)
            d.setHours(0, 0, 0, 0)
            const key = d.toISOString().split('T')[0]
            const label = d.toLocaleDateString('uz-UZ', { weekday: 'short', day: 'numeric' })
            days.push({ day: label, count: countMap[key] || 0 })
        }

        res.json(days)
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Admin: 7 kunlik yangi ro'yxatdan o'tganlar trendi
router.get('/register-trend', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const now = new Date()
        const w7Ago = new Date(now)
        w7Ago.setDate(w7Ago.getDate() - 6)
        w7Ago.setHours(0, 0, 0, 0)

        const users = await prisma.user.findMany({
            where: { createdAt: { gte: w7Ago } },
            select: { createdAt: true }
        })

        const countMap: Record<string, number> = {}
        for (const u of users) {
            const key = u.createdAt.toISOString().split('T')[0]
            countMap[key] = (countMap[key] || 0) + 1
        }

        const days: { day: string; count: number }[] = []
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now)
            d.setDate(d.getDate() - i)
            d.setHours(0, 0, 0, 0)
            const key = d.toISOString().split('T')[0]
            const label = d.toLocaleDateString('uz-UZ', { weekday: 'short', day: 'numeric' })
            days.push({ day: label, count: countMap[key] || 0 })
        }

        res.json(days)
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Admin: So'nggi 24 soatdagi yangi foydalanuvchilar (soat bo'yicha)
router.get('/new-users-24h', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const now = new Date()
        const h24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        h24Ago.setMinutes(0, 0, 0)

        const users = await prisma.user.findMany({
            where: { createdAt: { gte: h24Ago } },
            select: { createdAt: true }
        })

        // Soatlar bo'yicha guruhlash
        const countMap: Record<number, number> = {}
        for (const u of users) {
            const h = u.createdAt.getHours()
            countMap[h] = (countMap[h] || 0) + 1
        }

        const hours: { hour: string; count: number }[] = []
        for (let i = 23; i >= 0; i--) {
            const d = new Date(now)
            d.setHours(d.getHours() - i, 0, 0, 0)
            const label = `${d.getHours()}:00`
            hours.push({ hour: label, count: countMap[d.getHours()] || 0 })
        }

        res.json(hours)
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Admin: So'nggi 24 soatdagi ro'yxatdan o'tganlar ro'yxati
router.get('/recent-registrations', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const users = await prisma.user.findMany({
            where: { createdAt: { gte: h24 } },
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, email: true, role: true, createdAt: true }
        })
        res.json(users)
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Admin: Faollik logi — kim qachon kirdi/chiqdi
router.get('/activity-log', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1)
        const limit = 50
        const action = req.query.action as string | undefined

        const where = action ? { action } : { action: { not: 'presence' } }

        const [logs, total] = await Promise.all([
            prisma.visitLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: (page - 1) * limit,
                include: {
                    user: { select: { name: true, email: true, role: true } }
                }
            }),
            prisma.visitLog.count({ where })
        ])

        res.json({ logs, total, pages: Math.ceil(total / limit) })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Admin: foydalanuvchilar platformada taxminan qancha vaqt bo'lganini ko'rsatish
router.get('/time-spent', authenticate, requireRole('ADMIN'), async (_req: AuthRequest, res) => {
    try {
        const now = new Date()
        const startOfToday = new Date(now)
        startOfToday.setHours(0, 0, 0, 0)
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

        const [presenceLogs, onlineUsers] = await Promise.all([
            prisma.visitLog.findMany({
                where: { action: 'presence', userId: { not: null } },
                select: { userId: true, createdAt: true },
                orderBy: [{ userId: 'asc' }, { createdAt: 'asc' }]
            }),
            getOnlineUsers()
        ])

        const userIds = Array.from(new Set(
            presenceLogs.map(row => row.userId).filter((userId): userId is string => !!userId)
        ))
        if (userIds.length === 0) {
            return res.json({ users: [], trackedUsers: 0, intervalMinutes: PRESENCE_INTERVAL_MINUTES })
        }

        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true, role: true, createdAt: true }
        })

        const userMap = new Map(users.map(user => [user.id, user]))
        const onlineMap = new Map(onlineUsers.map(user => [user.userId, user.lastSeen]))

        const intervalMs = PRESENCE_INTERVAL_MINUTES * 60 * 1000
        const overlapMinutes = (segmentStart: Date, segmentEnd: Date, periodStart: Date) => {
            const start = Math.max(segmentStart.getTime(), periodStart.getTime())
            const end = Math.min(segmentEnd.getTime(), now.getTime())
            if (end <= start) return 0
            return (end - start) / (60 * 1000)
        }

        const totals = new Map<string, { totalMinutes: number; todayMinutes: number; weekMinutes: number; lastSeen: Date | null }>()
        const previousSeen = new Map<string, Date>()

        for (const row of presenceLogs) {
            if (!row.userId) continue
            const previous = previousSeen.get(row.userId)
            const current = row.createdAt
            const aggregate = totals.get(row.userId) || { totalMinutes: 0, todayMinutes: 0, weekMinutes: 0, lastSeen: null }

            if (previous) {
                const deltaMs = Math.min(intervalMs, Math.max(0, current.getTime() - previous.getTime()))
                const segmentStart = new Date(current.getTime() - deltaMs)
                aggregate.totalMinutes += deltaMs / (60 * 1000)
                aggregate.todayMinutes += overlapMinutes(segmentStart, current, startOfToday)
                aggregate.weekMinutes += overlapMinutes(segmentStart, current, sevenDaysAgo)
            }

            aggregate.lastSeen = current
            totals.set(row.userId, aggregate)
            previousSeen.set(row.userId, current)
        }

        for (const [userId, onlineLastSeen] of onlineMap.entries()) {
            const lastPresence = previousSeen.get(userId)
            if (!lastPresence) continue
            const aggregate = totals.get(userId)
            if (!aggregate) continue

            const liveEnd = new Date(Math.max(onlineLastSeen, now.getTime()))
            const deltaMs = Math.min(intervalMs, Math.max(0, liveEnd.getTime() - lastPresence.getTime()))
            if (deltaMs <= 0) continue

            const segmentStart = new Date(liveEnd.getTime() - deltaMs)
            aggregate.totalMinutes += deltaMs / (60 * 1000)
            aggregate.todayMinutes += overlapMinutes(segmentStart, liveEnd, startOfToday)
            aggregate.weekMinutes += overlapMinutes(segmentStart, liveEnd, sevenDaysAgo)
            aggregate.lastSeen = new Date(Math.max(aggregate.lastSeen?.getTime() || 0, onlineLastSeen))
            totals.set(userId, aggregate)
        }

        const timeSpentUsers = Array.from(totals.entries())
            .map(([userId, aggregate]) => {
                const user = userMap.get(userId)
                if (!user) return null

                const totalMinutes = Math.round(aggregate.totalMinutes)
                const todayMinutes = Math.round(aggregate.todayMinutes)
                const weekMinutes = Math.round(aggregate.weekMinutes)

                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    createdAt: user.createdAt,
                    totalMinutes,
                    todayMinutes,
                    weekMinutes,
                    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
                    lastSeen: aggregate.lastSeen,
                    isOnline: onlineMap.has(user.id),
                    onlineLastSeen: onlineMap.get(user.id) || null,
                }
            })
            .filter((user): user is NonNullable<typeof user> => !!user)
            .sort((a, b) => {
                if (b.totalMinutes !== a.totalMinutes) return b.totalMinutes - a.totalMinutes
                return (b.todayMinutes || 0) - (a.todayMinutes || 0)
            })

        res.json({
            users: timeSpentUsers,
            trackedUsers: timeSpentUsers.length,
            intervalMinutes: PRESENCE_INTERVAL_MINUTES
        })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Admin: Hozir online foydalanuvchilar (so'nggi 5 daqiqada ping yuborgan)
router.get('/online-users', authenticate, requireRole('ADMIN'), async (_req, res) => {
    try {
        res.json(await getOnlineUsers())
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Admin: Davr bo'yicha trend (login + register) — ?days=7|30
router.get('/period-trend', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const days = Math.min(90, Math.max(7, parseInt(req.query.days as string) || 30))
        const now = new Date()
        const startDate = new Date(now)
        startDate.setDate(startDate.getDate() - (days - 1))
        startDate.setHours(0, 0, 0, 0)

        const [loginLogs, registerUsers] = await Promise.all([
            prisma.visitLog.findMany({
                where: { action: 'login', createdAt: { gte: startDate } },
                select: { createdAt: true }
            }),
            prisma.user.findMany({
                where: { createdAt: { gte: startDate } },
                select: { createdAt: true }
            })
        ])

        // Kunlar bo'yicha guruhlash
        const loginMap: Record<string, number> = {}
        const registerMap: Record<string, number> = {}

        for (const log of loginLogs) {
            const key = log.createdAt.toISOString().split('T')[0]
            loginMap[key] = (loginMap[key] || 0) + 1
        }
        for (const u of registerUsers) {
            const key = u.createdAt.toISOString().split('T')[0]
            registerMap[key] = (registerMap[key] || 0) + 1
        }

        const result: { date: string; day: string; logins: number; registers: number }[] = []
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now)
            d.setDate(d.getDate() - i)
            d.setHours(0, 0, 0, 0)
            const key = d.toISOString().split('T')[0]
            const label = days <= 14
                ? d.toLocaleDateString('uz-UZ', { weekday: 'short', day: 'numeric' })
                : d.toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' })
            result.push({ date: key, day: label, logins: loginMap[key] || 0, registers: registerMap[key] || 0 })
        }

        res.json(result)
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Admin: Test statistikasi — umumiy, eng ko'p urinilganlar, fanlar bo'yicha
router.get('/test-stats', authenticate, requireRole('ADMIN'), async (_req, res) => {
    try {
        const [
            totalTests, publicTests, privateTests,
            totalAttempts,
            topTests,
            subjectBreakdown,
            recentAttempts,
            avgScoreResult,
        ] = await Promise.all([
            prisma.test.count(),
            prisma.test.count({ where: { isPublic: true } }),
            prisma.test.count({ where: { isPublic: false } }),
            prisma.testAttempt.count(),
            // Eng ko'p urinilgan 5 ta test
            prisma.test.findMany({
                include: {
                    _count: { select: { attempts: true, questions: true } },
                    creator: { select: { name: true } }
                },
                orderBy: { attempts: { _count: 'desc' } },
                take: 5,
            }),
            // Fanlar bo'yicha test soni
            prisma.test.groupBy({
                by: ['subject'],
                _count: true,
                orderBy: { _count: { id: 'desc' } },
                take: 8,
            }),
            // So'nggi 10 ta urinish
            prisma.testAttempt.findMany({
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: {
                    user: { select: { name: true } },
                    test: { select: { title: true, subject: true } }
                }
            }),
            prisma.testAttempt.aggregate({ _avg: { score: true } }),
        ])

        res.json({
            totalTests, publicTests, privateTests,
            totalAttempts,
            avgScore: Math.round((avgScoreResult._avg.score || 0) * 10) / 10,
            topTests,
            subjectBreakdown,
            recentAttempts,
        })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

export default router
