import { Router } from 'express'
import prisma from '../utils/db'
import { authenticate } from '../middleware/auth'
import { calculateFlashcardReview, parseFlashcardQuality } from '../utils/flashcardReview'

const router = Router()
router.use(authenticate)

class FlashcardNotFoundError extends Error { }

class FlashcardNotDueError extends Error {
    constructor(readonly nextReview: Date) {
        super('Flashcard is not due')
    }
}

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
        const quality = parseFlashcardQuality(req.body?.quality)

        if (quality === null) {
            return res.status(400).json({
                error: 'quality 0-5 oralig\'idagi butun son bo\'lishi kerak',
                code: 'INVALID_FLASHCARD_QUALITY',
            })
        }

        const reviewedAt = new Date()
        const result = await prisma.$transaction(async (tx) => {
            const card = await tx.flashcard.findFirst({ where: { id, userId } })
            if (!card) throw new FlashcardNotFoundError()
            if (card.nextReview.getTime() > reviewedAt.getTime()) {
                throw new FlashcardNotDueError(card.nextReview)
            }

            const schedule = calculateFlashcardReview(card, quality, reviewedAt)

            // Optimistic claim: bir vaqtda kelgan ikkita review bir xil eski nextReview'ni
            // o'qishi mumkin, ammo faqat bittasi shu qiymatni yangilay oladi. Ikkinchi
            // transaction count=0 oladi va XP yozilishidan OLDIN rollback bo'ladi.
            const claimed = await tx.flashcard.updateMany({
                where: { id, userId, nextReview: card.nextReview },
                data: {
                    ease: schedule.ease,
                    interval: schedule.interval,
                    repetitions: schedule.repetitions,
                    nextReview: schedule.nextReview,
                },
            })
            if (claimed.count !== 1) {
                const current = await tx.flashcard.findFirst({ where: { id, userId }, select: { nextReview: true } })
                if (!current) throw new FlashcardNotFoundError()
                throw new FlashcardNotDueError(current.nextReview)
            }

            // Increment atomik: boshqa qonuniy XP manbasi bilan bir vaqtda yozilsa ham
            // read-modify-write orqali uning XP sini bosib yubormaydi.
            const progress = await tx.userProgress.upsert({
                where: { userId },
                create: {
                    userId,
                    xp: 5,
                    streak: 0,
                    longestStreak: 0,
                    lastActiveDate: reviewedAt,
                },
                update: {
                    xp: { increment: 5 },
                    lastActiveDate: reviewedAt,
                },
                select: { xp: true },
            })

            return { schedule, xp: progress.xp }
        })

        res.json({
            interval: result.schedule.interval,
            nextReview: result.schedule.nextReview,
            ease: Math.round(result.schedule.ease * 100) / 100,
            xp: result.xp,
            xpGained: 5,
        })
    } catch (e) {
        if (e instanceof FlashcardNotFoundError) {
            return res.status(404).json({ error: 'Kartochka topilmadi', code: 'FLASHCARD_NOT_FOUND' })
        }
        if (e instanceof FlashcardNotDueError) {
            return res.status(409).json({
                error: 'Bu kartochka hali takrorlash uchun tayyor emas.',
                code: 'FLASHCARD_NOT_DUE',
                nextReview: e.nextReview,
                xpGained: 0,
            })
        }
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
