import { Router } from 'express'
import crypto from 'crypto'
import prisma from '../utils/db'
import { authenticate, AuthRequest } from '../middleware/auth'

/* =========================================================================
   DtmMax — To'lov / obuna (Paylov hosted checkout, Octo zaxira)
   ---------------------------------------------------------------------------
   Oqim:
     1) Frontend -> POST /api/billing/checkout (auth) -> Paylov checkout URL qaytadi
     2) User Paylov sahifasida to'laydi (karta/OTP DTMMax serveriga kirmaydi)
     3) Paylov -> POST /api/billing/paylov/callback -> check/perform -> Pro faollashadi
   Kalit yo'q bo'lsa endpointlar INERT (503) — xavfsiz.

   Kerakli Paylov env:
     merchant_id (yoki PAYLOV_MERCHANT_ID), Token (yoki PAYLOV_TOKEN),
     PAYLOV_CALLBACK_LOGIN, PAYLOV_CALLBACK_PASSWORD, PRO_PRICE_UZS, FRONTEND_URL.

   GATING: PRO_ENFORCED !== 'true' bo'lsa hamma uchun Pro ochiq (beta). To'lovni
   yoqish = Paylov callback sozlamalari + PRO_ENFORCED=true. Frontend useIsPro()
   /status ga ulanadi.
   ========================================================================= */

const router = Router()

const PRO_ENFORCED = process.env.PRO_ENFORCED === 'true'
const PRO_PRICE_UZS = Number(process.env.PRO_PRICE_UZS || 35000)
const OCTO_PREPARE_URL = 'https://secure.octo.uz/prepare_payment'
const PAYLOV_CHECKOUT_URL = 'https://my.paylov.uz/checkout/create/'
const MONTH_MS = 30 * 24 * 60 * 60 * 1000

function envAny(...names: string[]): string {
    for (const name of names) {
        const value = process.env[name]
        if (value?.trim()) return value.trim()
    }
    return ''
}

// Paylov emailida aynan `merchant_id` va `Token` nomlari berilgan. Railway'dagi
// mavjud nomlarni buzmaymiz, lekin standart uppercase aliaslarni ham qo'llaymiz.
const PAYLOV_MERCHANT_ID = envAny('PAYLOV_MERCHANT_ID', 'merchant_id')
const PAYLOV_TOKEN = envAny('PAYLOV_TOKEN', 'Token')
const PAYLOV_CALLBACK_LOGIN = envAny('PAYLOV_CALLBACK_LOGIN', 'PAYLOV_CALLBACK_USERNAME')
const PAYLOV_CALLBACK_PASSWORD = envAny('PAYLOV_CALLBACK_PASSWORD')
const configuredProvider = envAny('BILLING_PROVIDER').toLowerCase()
const BILLING_PROVIDER = configuredProvider === 'octo' || configuredProvider === 'paylov'
    ? configuredProvider
    : (PAYLOV_MERCHANT_ID && PAYLOV_TOKEN ? 'paylov' : 'octo')

function secureEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left)
    const rightBuffer = Buffer.from(right)
    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function hasValidPaylovCallbackAuth(authorization?: string): boolean {
    if (!PAYLOV_CALLBACK_LOGIN || !PAYLOV_CALLBACK_PASSWORD || !authorization) return false
    const match = authorization.match(/^Basic\s+(.+)$/i)
    if (!match) return false
    try {
        const decoded = Buffer.from(match[1], 'base64').toString('utf8')
        const separator = decoded.indexOf(':')
        if (separator < 0) return false
        return secureEqual(decoded.slice(0, separator), PAYLOV_CALLBACK_LOGIN)
            && secureEqual(decoded.slice(separator + 1), PAYLOV_CALLBACK_PASSWORD)
    } catch {
        return false
    }
}

function paylovRpcResult(id: unknown, status: string, statusText: string) {
    return { jsonrpc: '2.0', id: id ?? null, result: { status, statusText } }
}

function parsePaymentMeta(meta?: string | null): Record<string, unknown> {
    if (!meta) return {}
    try {
        const parsed = JSON.parse(meta) as unknown
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed as Record<string, unknown>
            : {}
    } catch {
        return {}
    }
}

type PaylovParams = {
    transaction_id?: unknown
    account?: { order_id?: unknown }
    amount?: unknown
    amount_tiyin?: unknown
    currency?: unknown
}

function paylovPaymentMatches(params: PaylovParams, expectedAmount: number): boolean {
    const amount = Number(params.amount)
    const amountTiyin = Number(params.amount_tiyin)
    const currency = Number(params.currency)
    if (currency !== 860) return false

    const hasAmount = Number.isFinite(amount)
    const hasAmountTiyin = Number.isFinite(amountTiyin)
    if (!hasAmount && !hasAmountTiyin) return false
    if (hasAmount && Math.round(amount) !== expectedAmount) return false
    if (hasAmountTiyin && Math.round(amountTiyin) !== expectedAmount * 100) return false
    return true
}

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

/** Frontend uchun maxfiy bo'lmagan billing konfiguratsiyasi. */
router.get('/config', (_req, res) => {
    const checkoutConfigured = BILLING_PROVIDER === 'paylov'
        ? Boolean(PAYLOV_MERCHANT_ID && PAYLOV_TOKEN && PAYLOV_CALLBACK_LOGIN && PAYLOV_CALLBACK_PASSWORD)
        : Boolean(process.env.OCTO_SHOP_ID && process.env.OCTO_SECRET)
    res.json({
        enforced: PRO_ENFORCED,
        priceUzs: PRO_PRICE_UZS,
        provider: BILLING_PROVIDER,
        checkoutConfigured,
    })
})

/** Joriy foydalanuvchining obuna holati. */
router.get('/status', authenticate, async (req: AuthRequest, res) => {
    try {
        const ent = await getEntitlement(req.user!.id)
        res.json({ ...ent, priceUzs: PRO_PRICE_UZS, provider: BILLING_PROVIDER })
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
        // FAIL-CLOSED: enforcement o'chiq (beta) bo'lsa hamma Pro bepul va UI ham
        // "bepul" deb e'lon qiladi — bu holatda real to'lov OLINMASLIGI shart, aks holda
        // foydalanuvchi ochiq imkoniyat uchun pul to'lab, refund/ishonch muammosi chiqadi.
        if (!PRO_ENFORCED) return res.status(503).json({ error: 'billing_disabled_beta' })
        if (!req.user) return res.status(401).json({ error: 'Avval kiring' })

        if (BILLING_PROVIDER === 'paylov') {
            const merchantUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            if (!merchantUuid.test(PAYLOV_MERCHANT_ID) || !PAYLOV_TOKEN
                || !PAYLOV_CALLBACK_LOGIN || !PAYLOV_CALLBACK_PASSWORD) {
                return res.status(503).json({ error: 'billing_not_configured' })
            }

            // Paylov account.order_id callback'da aynan shu qiymat bilan qaytadi.
            // UUID taxmin qilinmaydi va Payment.providerTxnId unique bo'lgani uchun
            // bir checkout ikkinchi buyurtmaga ulanib qolmaydi.
            const orderId = crypto.randomUUID()
            const returnUrl = `${process.env.FRONTEND_URL || 'https://www.dtmmax.uz'}/pro/natija?tx=${encodeURIComponent(orderId)}`
            const query = new URLSearchParams({
                merchant_id: PAYLOV_MERCHANT_ID,
                amount: String(PRO_PRICE_UZS),
                currency_id: '860',
                amount_in_tiyin: 'False',
                return_url: returnUrl,
                'account.order_id': orderId,
            })
            const encodedQuery = Buffer.from(query.toString(), 'utf8').toString('base64')

            await prisma.payment.create({
                data: {
                    userId: req.user.id,
                    amount: PRO_PRICE_UZS,
                    currency: 'UZS',
                    status: 'CREATED',
                    provider: 'paylov',
                    providerTxnId: orderId,
                    // OAuth token bu yerga ham, linkka ham yozilmaydi.
                    meta: JSON.stringify({ checkout: 'hosted', createdBy: 'dtmmax' }),
                },
            })

            return res.json({
                payUrl: `${PAYLOV_CHECKOUT_URL}${encodedQuery}`,
                shopTransactionId: orderId,
                provider: 'paylov',
            })
        }

        const shopId = Number(process.env.OCTO_SHOP_ID || 0)
        const secret = process.env.OCTO_SECRET || ''
        if (!shopId || !secret) return res.status(503).json({ error: 'billing_not_configured' })

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
 * Paylov hosted checkout callback'i (JSON-RPC 2.0).
 * Paylov bu endpointni avval transaction.check, keyin transaction.perform bilan
 * chaqiradi. Pro faqat perform kelib, summa/valyuta/order tekshirilgach ochiladi.
 */
router.post('/paylov/callback', async (req, res) => {
    if (!PAYLOV_CALLBACK_LOGIN || !PAYLOV_CALLBACK_PASSWORD) {
        return res.status(503).json({ error: 'billing_callback_not_configured' })
    }
    if (!hasValidPaylovCallbackAuth(req.header('authorization'))) {
        res.setHeader('WWW-Authenticate', 'Basic realm="DTMMax Paylov callback"')
        return res.status(401).json({ error: 'unauthorized' })
    }

    try {
        const payload = req.body && typeof req.body === 'object'
            ? req.body as Record<string, unknown>
            : {}
        const id = payload.id
        const method = typeof payload.method === 'string' ? payload.method : ''
        const rawParams = payload.params
        const params = rawParams && typeof rawParams === 'object' && !Array.isArray(rawParams)
            ? rawParams as PaylovParams
            : {}
        const rawAccount = params.account
        const orderId = rawAccount && typeof rawAccount === 'object'
            ? String(rawAccount.order_id || '')
            : ''

        if (!orderId) return res.json(paylovRpcResult(id, '303', 'Order not found'))

        const payment = await prisma.payment.findUnique({ where: { providerTxnId: orderId } })
        if (!payment || payment.provider !== 'paylov') {
            return res.json(paylovRpcResult(id, '303', 'Order not found'))
        }
        if (!paylovPaymentMatches(params, payment.amount)) {
            return res.json(paylovRpcResult(id, '5', 'Invalid amount'))
        }
        if (payment.status === 'REFUNDED') {
            return res.json(paylovRpcResult(id, '+1', 'order_refunded'))
        }

        if (method === 'transaction.check') {
            return res.json(paylovRpcResult(id, '0', 'OK'))
        }
        if (method !== 'transaction.perform') {
            return res.json(paylovRpcResult(id, '+1', 'unsupported_method'))
        }

        const paylovTransactionId = typeof params.transaction_id === 'string'
            ? params.transaction_id.trim()
            : ''
        const transactionUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        if (!transactionUuid.test(paylovTransactionId)) {
            return res.json(paylovRpcResult(id, '+1', 'invalid_transaction_id'))
        }

        const outcome = await prisma.$transaction(async tx => {
            const current = await tx.payment.findUnique({ where: { id: payment.id } })
            if (!current) return 'not_found' as const

            const currentMeta = parsePaymentMeta(current.meta)
            const storedTransactionId = typeof currentMeta.paylovTransactionId === 'string'
                ? currentMeta.paylovTransactionId
                : ''
            if (current.status === 'PAID') {
                return storedTransactionId === paylovTransactionId ? 'paid' as const : 'already_paid' as const
            }
            if (current.status === 'REFUNDED') return 'refunded' as const

            // Bir Paylov transaction_id boshqa DTMMax order'ga replay qilinmasin.
            const duplicate = await tx.payment.findFirst({
                where: {
                    id: { not: current.id },
                    provider: 'paylov',
                    status: 'PAID',
                    meta: { contains: `"paylovTransactionId":"${paylovTransactionId}"` },
                },
                select: { id: true },
            })
            if (duplicate) return 'duplicate_transaction' as const

            // Atomic claim: parallel perform callback'lar obunani ikki marta uzaytirmaydi.
            const claimed = await tx.payment.updateMany({
                where: { id: current.id, status: { in: ['CREATED', 'FAILED'] } },
                data: { status: 'PROCESSING' },
            })
            if (claimed.count !== 1) {
                const refreshed = await tx.payment.findUnique({ where: { id: current.id } })
                const refreshedMeta = parsePaymentMeta(refreshed?.meta)
                const refreshedTransactionId = typeof refreshedMeta.paylovTransactionId === 'string'
                    ? refreshedMeta.paylovTransactionId
                    : ''
                if (refreshed?.status === 'PAID') {
                    return refreshedTransactionId === paylovTransactionId ? 'paid' as const : 'already_paid' as const
                }
                return 'busy' as const
            }

            // Bir user bir vaqtda ikki checkout to'lasa ham oylar yo'qolmasin:
            // PostgreSQL transaction-level advisory lock obuna uzaytirishni ketma-ket qiladi.
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${current.userId}))`

            const now = new Date()
            const active = await tx.subscription.findFirst({
                where: { userId: current.userId, status: 'ACTIVE', expiresAt: { gt: now } },
                orderBy: { expiresAt: 'desc' },
            })
            const base = active?.expiresAt && active.expiresAt > now ? active.expiresAt : now
            const expiresAt = new Date(base.getTime() + MONTH_MS)
            const subscription = active
                ? await tx.subscription.update({
                    where: { id: active.id },
                    data: { expiresAt, provider: 'paylov', status: 'ACTIVE' },
                })
                : await tx.subscription.create({
                    data: {
                        userId: current.userId,
                        plan: 'PRO',
                        status: 'ACTIVE',
                        startedAt: now,
                        expiresAt,
                        provider: 'paylov',
                    },
                })

            await tx.payment.update({
                where: { id: current.id },
                data: {
                    status: 'PAID',
                    subscriptionId: subscription.id,
                    meta: JSON.stringify({
                        ...currentMeta,
                        paylovTransactionId,
                        performedAt: now.toISOString(),
                        callback: {
                            rpcId: id ?? null,
                            amount: params.amount,
                            amountTiyin: params.amount_tiyin,
                            currency: params.currency,
                        },
                    }),
                },
            })
            return 'activated' as const
        })

        if (outcome === 'not_found') return res.json(paylovRpcResult(id, '303', 'Order not found'))
        if (outcome === 'refunded') return res.json(paylovRpcResult(id, '+1', 'order_refunded'))
        if (outcome === 'already_paid') return res.json(paylovRpcResult(id, '+1', 'order_already_paid'))
        if (outcome === 'duplicate_transaction') return res.json(paylovRpcResult(id, '+1', 'duplicate_transaction'))
        if (outcome === 'busy') return res.json(paylovRpcResult(id, '+1', 'transaction_processing'))
        return res.json(paylovRpcResult(id, '0', 'OK'))
    } catch (error) {
        console.error('paylov callback xato:', error)
        return res.status(500).json({ error: 'server_error' })
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
