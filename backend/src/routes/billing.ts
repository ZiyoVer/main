import { Router } from 'express'
import prisma from '../utils/db'
import { authenticate, AuthRequest } from '../middleware/auth'

/* =========================================================================
   DtmMax — To'lov / obuna (SCAFFOLDING)
   ---------------------------------------------------------------------------
   Bu modul to'lov POYDEVORI: entitlement hisobi, /status va provider-agnostik
   /webhook skeleti. AMALDA to'lov yoqilishi quyidagilarni kutadi:
     - To'lov agregatori (Octo/Multicard) hisobi + SANDBOX kalit
     - BILLING_WEBHOOK_SECRET env o'rnatilishi
     - Tanlangan agregator protokoli bo'yicha imzo/payload tekshiruvi (pastdagi TODO)
   Kalit yo'q bo'lsa webhook INERT (503) — production'da xavfsiz, hech narsa o'zgarmaydi.

   GATING: PRO_ENFORCED !== 'true' bo'lsa, hamma uchun Pro ochiq (hozirgi beta holati).
   Frontend useIsPro() shu /status ga keyin ulanadi; hozircha xulq-atvor o'zgarmaydi.
   ========================================================================= */

const router = Router()

const PRO_ENFORCED = process.env.PRO_ENFORCED === 'true'
const PRO_PRICE_UZS = Number(process.env.PRO_PRICE_UZS || 35000)

export interface Entitlement {
    isPro: boolean
    enforced: boolean
    until: string | null
    plan: string
}

/** Foydalanuvchining joriy entitlement holati: faol obuna + amal muddati. */
export async function getEntitlement(userId: string): Promise<Entitlement> {
    // Enforcement o'chiq bo'lsa — hamma Pro (beta). Hech narsa bloklanmaydi.
    if (!PRO_ENFORCED) {
        return { isPro: true, enforced: false, until: null, plan: 'BETA' }
    }
    const sub = await prisma.subscription.findFirst({
        where: { userId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
        orderBy: { expiresAt: 'desc' },
    })
    return {
        isPro: !!sub,
        enforced: true,
        until: sub?.expiresAt ? sub.expiresAt.toISOString() : null,
        plan: sub ? sub.plan : 'FREE',
    }
}

/** Express middleware: enforcement yoqilgan bo'lsa Pro talab qiladi (hozircha hech qayerda ishlatilmaydi). */
export async function requirePro(req: AuthRequest, res: import('express').Response, next: import('express').NextFunction) {
    try {
        if (!PRO_ENFORCED) return next()
        if (!req.user) return res.status(401).json({ error: 'Avval kiring' })
        const ent = await getEntitlement(req.user.id)
        if (!ent.isPro) {
            return res.status(402).json({ error: 'Pro obuna talab qilinadi', code: 'PRO_REQUIRED' })
        }
        next()
    } catch {
        res.status(500).json({ error: 'Server xatoligi' })
    }
}

/** Joriy foydalanuvchining obuna holati. */
router.get('/status', authenticate, async (req: AuthRequest, res) => {
    try {
        const ent = await getEntitlement(req.user.id)
        res.json({ ...ent, priceUzs: PRO_PRICE_UZS })
    } catch {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

/**
 * Provider webhook (Octo/Multicard) — to'lov tasdig'i shu yerda keladi.
 * Kalit sozlanmaган bo'lsa INERT. Sozlangach: imzoni tekshir → Payment'ni
 * idempotent yozib (providerTxnId unique) → Subscription'ni faollashtir.
 */
router.post('/webhook', async (req, res) => {
    const secret = process.env.BILLING_WEBHOOK_SECRET
    if (!secret) {
        // Hali sozlanmagan — production'da xavfsiz no-op.
        return res.status(503).json({ error: 'billing_not_configured' })
    }
    try {
        // TODO(agregator): tanlangan provider (Octo/Multicard) imzo/auth tekshiruvi.
        // Hozircha oddiy umumiy-sir sarlavhasi orqali himoya (sandbox uchun).
        const provided = req.header('x-webhook-secret')
        if (provided !== secret) {
            return res.status(401).json({ error: 'unauthorized' })
        }

        // Normalizatsiyalangan payload (real provider maydonlari TODO bilan moslanadi):
        const body = (req.body || {}) as Record<string, unknown>
        const providerTxnId = String(body.transactionId || body.id || '')
        const userId = String(body.userId || '')
        const amount = Number(body.amount || PRO_PRICE_UZS)
        const provider = String(body.provider || 'octo')
        const paid = body.status === 'paid' || body.status === 'success'
        if (!providerTxnId || !userId) {
            return res.status(400).json({ error: 'invalid_payload' })
        }

        // Idempotentlik: bir tranzaksiya bir marta qayta ishlanadi.
        const existing = await prisma.payment.findUnique({ where: { providerTxnId } })
        if (existing) return res.json({ ok: true, idempotent: true })

        if (!paid) {
            await prisma.payment.create({
                data: { userId, amount, provider, providerTxnId, status: 'FAILED', meta: JSON.stringify(body) },
            })
            return res.json({ ok: true })
        }

        // To'lov muvaffaqiyatli → obunani 1 oyga faollashtir/uzaytir.
        const now = new Date()
        const active = await prisma.subscription.findFirst({
            where: { userId, status: 'ACTIVE', expiresAt: { gt: now } },
            orderBy: { expiresAt: 'desc' },
        })
        const base = active?.expiresAt && active.expiresAt > now ? active.expiresAt : now
        const expiresAt = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000)

        const sub = active
            ? await prisma.subscription.update({ where: { id: active.id }, data: { expiresAt, provider, status: 'ACTIVE' } })
            : await prisma.subscription.create({
                data: { userId, plan: 'PRO', status: 'ACTIVE', startedAt: now, expiresAt, provider },
            })

        await prisma.payment.create({
            data: { userId, subscriptionId: sub.id, amount, provider, providerTxnId, status: 'PAID', meta: JSON.stringify(body) },
        })

        res.json({ ok: true })
    } catch (e) {
        console.error('billing webhook:', e)
        res.status(500).json({ error: 'server_error' })
    }
})

export default router
