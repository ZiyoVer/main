import { Router } from 'express'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'

const router = Router()

// Admin: Platformaga statistikalar
router.get('/stats', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const now = new Date()
        const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const w1 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const m1 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

        const [totalUsers, last24h, lastWeek, lastMonth, totalVisits, totalTests, totalChats] = await Promise.all([
            prisma.user.count(),
            prisma.visitLog.count({ where: { action: 'login', createdAt: { gte: h24 } } }),
            prisma.visitLog.count({ where: { action: 'login', createdAt: { gte: w1 } } }),
            prisma.visitLog.count({ where: { action: 'login', createdAt: { gte: m1 } } }),
            prisma.visitLog.count(),
            prisma.test.count(),
            prisma.chat.count(),
        ])

        res.json({
            totalUsers,
            logins24h: last24h,
            loginsWeek: lastWeek,
            loginsMonth: lastMonth,
            totalVisits,
            totalTests,
            totalChats
        })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

export default router
