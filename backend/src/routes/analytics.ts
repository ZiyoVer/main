import { Router } from 'express'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'

const router = Router()

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
            recentUsers
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
            })
        ])

        // O'rtacha test ball
        const avgScoreResult = await prisma.testAttempt.aggregate({ _avg: { score: true } })

        res.json({
            totalUsers, students, teachers,
            logins24h: last24h, loginsWeek: lastWeek, loginsMonth: lastMonth, totalVisits,
            totalTests, totalChats, totalMessages,
            totalDocuments, totalChunks, totalAttempts,
            avgScore: Math.round((avgScoreResult._avg.score || 0) * 100) / 100,
            recentUsers
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
        const days: { day: string; count: number }[] = []

        for (let i = 6; i >= 0; i--) {
            const from = new Date(now)
            from.setDate(from.getDate() - i)
            from.setHours(0, 0, 0, 0)

            const to = new Date(from)
            to.setHours(23, 59, 59, 999)

            const count = await prisma.visitLog.count({
                where: { action: 'login', createdAt: { gte: from, lte: to } }
            })

            const label = from.toLocaleDateString('uz-UZ', { weekday: 'short', day: 'numeric' })
            days.push({ day: label, count })
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
        const days: { day: string; count: number }[] = []

        for (let i = 6; i >= 0; i--) {
            const from = new Date(now)
            from.setDate(from.getDate() - i)
            from.setHours(0, 0, 0, 0)

            const to = new Date(from)
            to.setHours(23, 59, 59, 999)

            const count = await prisma.user.count({
                where: { createdAt: { gte: from, lte: to } }
            })

            const label = from.toLocaleDateString('uz-UZ', { weekday: 'short', day: 'numeric' })
            days.push({ day: label, count })
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
        const hours: { hour: string; count: number }[] = []

        for (let i = 23; i >= 0; i--) {
            const from = new Date(now)
            from.setHours(from.getHours() - i, 0, 0, 0)

            const to = new Date(from)
            to.setMinutes(59, 59, 999)

            const count = await prisma.user.count({
                where: { createdAt: { gte: from, lte: to } }
            })

            const label = `${from.getHours()}:00`
            hours.push({ hour: label, count })
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

export default router
