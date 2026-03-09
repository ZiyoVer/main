import { Router } from 'express'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'
import { getOnlineUsers } from '../utils/onlineTracker'

const router = Router()

// GET /public-stats — autentifikatsiya talab qilinmaydi (landing page uchun)
router.get('/public-stats', async (_req, res) => {
    try {
        const [totalUsers, totalPublicTests] = await Promise.all([
            prisma.user.count(),
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
            totalTests, totalChats, totalMessages,
            totalDocuments, totalChunks, totalAttempts,
            recentUsers,
            emailVerifiedCount,
            avgAbilityResult
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
            prisma.document.count(),
            prisma.documentChunk.count(),
            prisma.testAttempt.count(),
            prisma.user.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: { id: true, name: true, email: true, role: true, createdAt: true }
            }),
            prisma.user.count({ where: { emailVerified: true } }),
            prisma.studentProfile.aggregate({ _avg: { abilityLevel: true } })
        ])

        // O'rtacha test ball
        const avgScoreResult = await prisma.testAttempt.aggregate({ _avg: { score: true } })

        res.json({
            totalUsers, students, teachers,
            logins24h: last24h, loginsWeek: lastWeek, loginsMonth: lastMonth, totalVisits,
            totalTests, totalChats, totalMessages,
            totalDocuments, totalChunks, totalAttempts,
            avgScore: Math.round((avgScoreResult._avg.score || 0) * 100) / 100,
            recentUsers,
            emailVerifiedCount,
            avgAbility: Math.round((avgAbilityResult._avg.abilityLevel || 0) * 100) / 100
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

        const where = action ? { action } : {}

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

// Admin: Hozir online foydalanuvchilar (so'nggi 5 daqiqada ping yuborgan)
router.get('/online-users', authenticate, requireRole('ADMIN'), async (_req, res) => {
    try {
        res.json(getOnlineUsers())
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

export default router
