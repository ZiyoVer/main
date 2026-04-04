import { Router } from 'express'
import prisma from '../utils/db'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// ────────────────────────────────────────────────────────────
// GET /api/flashcards/due — Bugun ko'rish kerak bo'lgan kartochkalar
// ────────────────────────────────────────────────────────────
router.get('/due', async (req: any, res) => {
    try {
        const userId = req.user.id
        const { subject } = req.query
        const now = new Date()

        const where: any = { userId, nextReview: { lte: now } }
        if (subject) where.subject = subject

        const cards = await prisma.flashcard.findMany({
            where,
            orderBy: { nextReview: 'asc' },
            take: 20,
        })

        const total = await prisma.flashcard.count({ where: { userId } })
        const dueCount = await prisma.flashcard.count({ where })

        res.json({ cards, total, dueCount })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// ────────────────────────────────────────────────────────────
// GET /api/flashcards — Barcha kartochkalar (fan bo'yicha)
// ────────────────────────────────────────────────────────────
router.get('/', async (req: any, res) => {
    try {
        const userId = req.user.id
        const { subject } = req.query

        const where: any = { userId }
        if (subject) where.subject = subject

        const cards = await prisma.flashcard.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        })

        res.json(cards)
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// ────────────────────────────────────────────────────────────
// POST /api/flashcards — Yangi kartochkalar saqlash (AI dan)
// Body: { subject, cards: [{ front, back }] }
// ────────────────────────────────────────────────────────────
router.post('/', async (req: any, res) => {
    try {
        const userId = req.user.id
        const { subject, cards } = req.body

        const normalizedSubject = typeof subject === 'string' ? subject.trim() : ''
        if (!normalizedSubject || !Array.isArray(cards) || cards.length === 0) {
            return res.status(400).json({ error: 'subject va cards[] majburiy' })
        }

        const sanitizedCards = cards
            .map((card: unknown) => {
                if (!card || typeof card !== 'object') return null
                const front = typeof (card as { front?: unknown }).front === 'string' ? (card as { front: string }).front.trim() : ''
                const back = typeof (card as { back?: unknown }).back === 'string' ? (card as { back: string }).back.trim() : ''
                if (!front) return null
                return { front, back }
            })
            .filter((card): card is { front: string; back: string } => Boolean(card))

        if (sanitizedCards.length === 0) {
            return res.status(400).json({ error: 'cards ichida yaroqli kartochka topilmadi' })
        }

        // Mavjud kartlarning front textlarini olish (duplicate oldini olish)
        const existing = await prisma.flashcard.findMany({
            where: { userId, subject: normalizedSubject },
            select: { front: true }
        })
        const existingFronts = new Set(existing.map(c => c.front.toLowerCase().trim()))

        // Faqat yangi (duplicate bo'lmagan) kartlarni saqlash
        const newCards = sanitizedCards.filter(card =>
            !existingFronts.has(card.front.toLowerCase().trim())
        )

        if (newCards.length === 0) {
            return res.json({ created: 0, skipped: sanitizedCards.length, message: 'Barcha kartalar allaqachon mavjud' })
        }

        const created = await prisma.flashcard.createMany({
            data: newCards.map((c: { front: string; back: string }) => ({
                userId,
                subject: normalizedSubject,
                front: c.front,
                back: c.back,
            })),
        })

        res.json({ created: created.count, skipped: sanitizedCards.length - created.count })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// ────────────────────────────────────────────────────────────
// POST /api/flashcards/:id/review — Kartochkani baholash (SM-2)
// Body: { quality: 0-5 }  (0-2 = failed, 3-5 = passed)
// ────────────────────────────────────────────────────────────
router.post('/:id/review', async (req: any, res) => {
    try {
        const userId = req.user.id
        const { id } = req.params
        const { quality } = req.body  // 0-5

        if (quality === undefined || quality < 0 || quality > 5) {
            return res.status(400).json({ error: 'quality 0-5 orasida bo\'lishi kerak' })
        }

        const card = await prisma.flashcard.findFirst({ where: { id, userId } })
        if (!card) return res.status(404).json({ error: 'Kartochka topilmadi' })

        // SM-2 algoritm
        let { ease, interval, repetitions } = card

        if (quality < 3) {
            // Noto'g'ri javob — boshidan
            repetitions = 0
            interval = 1
        } else {
            // To'g'ri javob
            if (repetitions === 0) interval = 1
            else if (repetitions === 1) interval = 6
            else interval = Math.round(interval * ease)

            repetitions += 1
        }

        // Easiness factor yangilash (SM-2 formula)
        ease = Math.max(1.3, ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))

        // Keyingi ko'rish vaqti
        const nextReview = new Date()
        nextReview.setDate(nextReview.getDate() + interval)

        const { updated } = await prisma.$transaction(async (tx) => {
            const updatedCard = await tx.flashcard.update({
                where: { id },
                data: { ease, interval, repetitions, nextReview },
            })

            // XP qo'shish
            const progress = await tx.userProgress.findUnique({ where: { userId } })

            if (!progress) {
                await tx.userProgress.create({
                    data: {
                        userId,
                        xp: 5,
                        streak: 0,
                        longestStreak: 0,
                        lastActiveDate: new Date()
                    }
                })
            } else {
                await tx.userProgress.update({
                    where: { userId },
                    data: { xp: progress.xp + 5, lastActiveDate: new Date() }
                })
            }

            return { updated: updatedCard }
        })

        res.json({
            interval,
            nextReview: updated.nextReview,
            ease: Math.round(ease * 100) / 100,
        })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// ────────────────────────────────────────────────────────────
// DELETE /api/flashcards — Barcha kartochkalarni o'chirish
// ────────────────────────────────────────────────────────────
router.delete('/', async (req: any, res) => {
    try {
        const userId = req.user.id
        await prisma.flashcard.deleteMany({ where: { userId } })
        res.json({ ok: true })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// ────────────────────────────────────────────────────────────
// DELETE /api/flashcards/:id — Kartochkani o'chirish
// ────────────────────────────────────────────────────────────
router.delete('/:id', async (req: any, res) => {
    try {
        const userId = req.user.id
        const { id } = req.params

        const card = await prisma.flashcard.findFirst({ where: { id, userId } })
        if (!card) return res.status(404).json({ error: 'Kartochka topilmadi' })

        await prisma.flashcard.delete({ where: { id } })
        res.json({ ok: true })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

export default router
