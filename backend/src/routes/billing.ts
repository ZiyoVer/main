import { Router } from 'express'
import crypto from 'crypto'
import prisma from '../utils/db'
import { authenticate, AuthRequest } from '../middleware/auth'

/* =========================================================================
   DtmMax — To'lov / obuna (OCTO agregator)
   ---------------------------------------------------------------------------
   Oqim:
     1) Frontend  -> POST /api/billing/checkout  (auth)  -> Octo pay URL qaytadi
     2) User Octo sahifasida to'laydi
     3) Octo -> POST /api/billing/octo/notify (webhook) -> obuna faollashadi
   Kalit yo'q bo'lsa (OCTO_SHOP_ID/OCTO_SECRET) endpointlar INERT (503) — xavfsiz.

   Kerakli env (Octo MChJ onboarding'idan keyin):
     OCTO_SHOP_ID, OCTO_SECRET, OCTO_NOTIFY_SECRET (webhook unique_key — Octo beradi),
     OCTO_TEST=true (sandbox), PRO_PRICE_UZS (default 35000), FRONTEND_URL.

   GATING: PRO_ENFORCED !== 'true' bo'lsa hamma uchun Pro ochiq (beta). To'lovni
   yoqish = OCTO_* env + PRO_ENFORCED=true. Frontend useIsPro() /status ga ulanadi.
   ========================================================================= */

const router = Router()

const PRO_ENFORCED = process.env.PRO_ENFORCED === 'true'
const PRO_PRICE_UZS = Number(process.env.PRO_PRICE_UZS || 35000)
const OCTO_PREPARE_URL = 'https://secure.octo.uz/prepare_payment'
const MONTH_MS = 30 * 24 * 60 * 60 * 1000

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

/** Express middleware: enforcement yoqilgan bo'lsa Pro talab qiladi. */
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

/** Obunani 30 kunga ochish yoki uzaytirish (provider-agnostik). */
async function extendProSubscription(userId: string, provider: string) {
    const now = new Date()
    const active = await prisma.subscription.findFirst({
        where: { userId, status: 'ACTIVE', expiresAt: { gt: now } },
        orderBy: { expiresAt: 'desc' },
    })
    const base = active?.expiresAt && active.expiresAt > now ? active.expiresAt : now
    const expiresAt = new Date(base.getTime() + MONTH_MS)
    return active
        ? prisma.subscription.update({ where: { id: active.id }, data: { expiresAt, provider, status: 'ACTIVE' } })
        : prisma.subscription.create({
            data: { userId, plan: 'PRO', status: 'ACTIVE', startedAt: now, expiresAt, provider },
        })
}

/** Joriy foydalanuvchining obuna holati. */
router.get('/status', authenticate, async (req: AuthRequest, res) => {
    try {
        const ent = await getEntitlement(req.user!.id)
        res.json({ ...ent, priceUzs: PRO_PRICE_UZS })
    } catch {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

interface OctoPrepareResponse {
    error?: number
    errMessage?: string | null
    data?: { octo_pay_url?: string; octo_payment_UUID?: string; status?: string }
}

/**
 * To'lovni boshlash — Octo prepare_payment chaqiradi, checkout URL qaytaradi.
 * Frontend qaytgan payUrl'ga redirect qiladi.
 */
router.post('/checkout', authenticate, async (req: AuthRequest, res) => {
    try {
        const shopId = Number(process.env.OCTO_SHOP_ID || 0)
        const secret = process.env.OCTO_SECRET || ''
        if (!shopId || !secret) return res.status(503).json({ error: 'billing_not_configured' })
        if (!req.user) return res.status(401).json({ error: 'Avval kiring' })

        // shop_transaction_id — biz generatsiya qilamiz, webhook shu bo'yicha topadi (idempotentlik kaliti)
        const shopTxnId = `dtmmax_${req.user.id}_${Date.now()}`
        await prisma.payment.create({
            data: { userId: req.user.id, amount: PRO_PRICE_UZS, currency: 'UZS', status: 'CREATED', provider: 'octo', providerTxnId: shopTxnId },
        })

        const notifyUrl = `${req.protocol}://${req.get('host')}/api/billing/octo/notify`
        const returnUrl = `${process.env.FRONTEND_URL || 'https://www.dtmmax.uz'}/pro/natija?tx=${encodeURIComponent(shopTxnId)}`
        const initTime = new Date().toISOString().slice(0, 19).replace('T', ' ') // "YYYY-MM-DD HH:mm:ss"

        const payload = {
            octo_shop_id: shopId,
            octo_secret: secret,
            shop_transaction_id: shopTxnId,
            auto_capture: true,
            test: process.env.OCTO_TEST === 'true',
            init_time: initTime,
            user_data: { user_id: req.user.id },
            total_sum: PRO_PRICE_UZS,
            currency: 'UZS',
            description: 'DTMMax Pro obuna (1 oy)',
            payment_methods: [{ method: 'bank_card' }, { method: 'uzcard' }, { method: 'humo' }],
            return_url: returnUrl,
            notify_url: notifyUrl,
            language: 'uz',
            ttl: 15,
        }

        const r = await fetch(OCTO_PREPARE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        const data = (await r.json()) as OctoPrepareResponse
        const payUrl = data?.data?.octo_pay_url
        if (!payUrl) {
            console.error('octo prepare_payment xato:', JSON.stringify(data))
            return res.status(502).json({ error: 'payment_init_failed', detail: data?.errMessage || null })
        }

        // octo_payment_UUID — notify'da to'lovga BOG'LASH uchun saqlanadi (replay himoyasi).
        // FAIL-CLOSED: uuid saqlanmasa checkout to'xtaydi — foydalanuvchi hali to'lamagan,
        // qayta urinishi mumkin; uuid'siz to'lovni esa notify'da tekshirib bo'lmaydi.
        const octoUuid = String(data?.data?.octo_payment_UUID || '')
        if (!octoUuid) {
            console.error('octo checkout: octo_payment_UUID kelmadi:', JSON.stringify(data))
            return res.status(502).json({ error: 'payment_init_failed' })
        }
        await prisma.payment.update({
            where: { providerTxnId: shopTxnId },
            data: { meta: JSON.stringify({ octo_payment_UUID: octoUuid }) },
        })

        res.json({ payUrl, shopTransactionId: shopTxnId })
    } catch (e) {
        console.error('checkout xato:', e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

/** To'lovdan qaytgach (/pro/natija) holatni ko'rsatish uchun — faqat o'z to'lovi. */
router.get('/payment/:txnId', authenticate, async (req: AuthRequest, res) => {
    try {
        const txnId = String(req.params.txnId || '')
        if (!txnId) return res.status(400).json({ error: 'txnId kerak' })
        const p = await prisma.payment.findUnique({ where: { providerTxnId: txnId } })
        if (!p || p.userId !== req.user!.id) return res.status(404).json({ error: 'To\'lov topilmadi' })
        res.json({ status: p.status, amount: p.amount, currency: p.currency, createdAt: p.createdAt })
    } catch {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

/**
 * Octo webhook (notify_url) — to'lov natijasi shu yerga keladi.
 * Imzo: sha1(unique_key + octo_payment_UUID + status). Muvaffaqiyat -> obuna 30 kun.
 */
router.post('/octo/notify', async (req, res) => {
    const notifySecret = process.env.OCTO_NOTIFY_SECRET || process.env.OCTO_SECRET || ''
    if (!notifySecret) return res.status(503).json({ error: 'billing_not_configured' })
    try {
        const body = (req.body || {}) as Record<string, unknown>
        const uuid = String(body.octo_payment_UUID || '')
        const status = String(body.status || '')
        const shopTxnId = String(body.shop_transaction_id || '')
        const signature = String(body.signature || '')
        if (!uuid || !shopTxnId) return res.status(400).json({ error: 'invalid_payload' })

        // MUHIM: imzo formulasi Octo hujjatiga ko'ra sha1(unique_key+uuid+status).
        // Sandbox'da TASDIQLA — agar mos kelmasa Octo notify hujjatidagi aniq tartibga
        // moslang. OCTO_VERIFY_SIGNATURE=false faqat PRODUCTION'DAN TASHQARIDA ishlaydi —
        // prod'da imzo har doim majburiy (tasodifan o'chirib qo'yish pul teshigi edi).
        const expected = crypto.createHash('sha1').update(`${notifySecret}${uuid}${status}`).digest('hex')
        const verifyOn = process.env.NODE_ENV === 'production' || process.env.OCTO_VERIFY_SIGNATURE !== 'false'
        if (verifyOn && signature !== expected) {
            console.warn('octo notify imzo mos emas — kutilgan:', expected, '| kelgan:', signature)
            return res.status(401).json({ error: 'bad_signature' })
        }

        const payment = await prisma.payment.findUnique({ where: { providerTxnId: shopTxnId } })
        if (!payment) return res.status(404).json({ error: 'payment_not_found' })
        if (payment.status === 'PAID') return res.json({ ok: true, idempotent: true })

        // REPLAY HIMOYASI: Octo imzosi faqat (uuid+status)ga bog'liq — shop_transaction_id
        // va summani qamramaydi. Shuning uchun uuid checkout'da saqlangan qiymat bilan
        // AYNAN mos kelishi shart: birovning to'g'ri imzoli notify'sini boshqa to'lovga
        // qayta o'ynatib bepul Pro olib bo'lmasin.
        let storedUuid = ''
        try { storedUuid = String((JSON.parse(payment.meta || '{}') as { octo_payment_UUID?: string })?.octo_payment_UUID || '') } catch { /* meta buzuq — quyida rad etiladi */ }
        if (!storedUuid || storedUuid !== uuid) {
            console.warn('octo notify: uuid to\'lovga mos emas', { shopTxnId, uuid, storedUuid })
            return res.status(400).json({ error: 'uuid_mismatch' })
        }

        // Summa tekshiruvi (notify'da kelsa) — qisman to'lov to'liq obuna ochmasin
        const notifiedSum = Number((body as { total_sum?: unknown }).total_sum ?? NaN)
        if (Number.isFinite(notifiedSum) && Math.round(notifiedSum) < payment.amount) {
            console.warn('octo notify: summa yetarli emas', { shopTxnId, notifiedSum, expected: payment.amount })
            return res.status(400).json({ error: 'amount_mismatch' })
        }

        const paid = status === 'succeeded'
        if (!paid) {
            // uuid meta'da SAQLAB QOLINADI — keyingi notify'lar ham tekshirila olishi uchun
            await prisma.payment.update({
                where: { providerTxnId: shopTxnId },
                data: { status: 'FAILED', meta: JSON.stringify({ octo_payment_UUID: storedUuid, notify: body }) },
            })
            return res.json({ ok: true })
        }

        const sub = await extendProSubscription(payment.userId, 'octo')
        await prisma.payment.update({
            where: { providerTxnId: shopTxnId },
            data: { status: 'PAID', subscriptionId: sub.id, meta: JSON.stringify({ octo_payment_UUID: storedUuid, notify: body }) },
        })
        res.json({ ok: true })
    } catch (e) {
        console.error('octo notify xato:', e)
        res.status(500).json({ error: 'server_error' })
    }
})

/**
 * Umumiy provider webhook (eski skelet — boshqa agregator uchun zaxira).
 * BILLING_WEBHOOK_SECRET sozlanmagan bo'lsa INERT.
 */
router.post('/webhook', async (req, res) => {
    const secret = process.env.BILLING_WEBHOOK_SECRET
    if (!secret) return res.status(503).json({ error: 'billing_not_configured' })
    try {
        if (req.header('x-webhook-secret') !== secret) {
            return res.status(401).json({ error: 'unauthorized' })
        }
        const body = (req.body || {}) as Record<string, unknown>
        const providerTxnId = String(body.transactionId || body.id || '')
        const userId = String(body.userId || '')
        const amount = Number(body.amount || PRO_PRICE_UZS)
        const provider = String(body.provider || 'octo')
        const paid = body.status === 'paid' || body.status === 'success'
        if (!providerTxnId || !userId) return res.status(400).json({ error: 'invalid_payload' })

        const existing = await prisma.payment.findUnique({ where: { providerTxnId } })
        if (existing) return res.json({ ok: true, idempotent: true })

        if (!paid) {
            await prisma.payment.create({
                data: { userId, amount, provider, providerTxnId, status: 'FAILED', meta: JSON.stringify(body) },
            })
            return res.json({ ok: true })
        }

        const sub = await extendProSubscription(userId, provider)
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
