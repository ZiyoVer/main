import { Router } from 'express'
import prisma from '../utils/db'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()

// AI sozlamalarini olish
router.get('/', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const settings = await prisma.aISetting.findMany()
        const result: Record<string, string> = {}
        for (const s of settings) {
            result[s.key] = s.value
        }
        // Defaults
        if (!result.temperature) result.temperature = '0.7'
        if (!result.max_tokens) result.max_tokens = '4096'
        if (!result.extra_rules) result.extra_rules = ''
        res.json(result)
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// AI sozlamalarini yangilash
router.put('/', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const { temperature, max_tokens, extra_rules } = req.body

        const updates = [
            { key: 'temperature', value: String(temperature ?? 0.7) },
            { key: 'max_tokens', value: String(max_tokens ?? 4096) },
            { key: 'extra_rules', value: String(extra_rules ?? '') },
        ]

        for (const u of updates) {
            await prisma.aISetting.upsert({
                where: { key: u.key },
                update: { value: u.value },
                create: { key: u.key, value: u.value }
            })
        }

        res.json({ message: 'Sozlamalar saqlandi' })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

export default router
