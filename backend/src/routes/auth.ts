import { Router } from 'express'
import bcrypt from 'bcryptjs'
import dns from 'dns/promises'
import crypto from 'crypto'
import { OAuth2Client } from 'google-auth-library'
import rateLimit from 'express-rate-limit'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'
import { tokenBlacklist } from '../utils/tokenBlacklist'
import { EmailDeliveryError, sendVerificationEmail, sendPasswordResetEmail } from '../utils/email'
import { updateOnline } from '../utils/onlineTracker'
import { normalizeSubject } from '../utils/subjects'
import { parseOptionalExamDate, parseOptionalExamType, validateTargetScore } from '../utils/profileValidation'
import { isValidDtmPair } from '../utils/dtmPairs'
import { logAdminAction } from '../utils/adminAudit'
import { getAiQuotaStatus } from '../utils/aiQuota'
import { AUTH_ERROR_CODES, authError } from '../utils/authErrors'
import { signAuthToken } from '../utils/authToken'

const router = Router()

// Google OAuth — GOOGLE_CLIENT_ID o'rnatilmasa inert (endpoint 503 qaytaradi)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null
const PRESENCE_LOG_INTERVAL_MS = 2 * 60 * 1000
const PRESENCE_RETENTION_DAYS = 90
const PRESENCE_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000
const lastPresenceWrite = new Map<string, number>()
let lastPresenceCleanupAt = 0

const EMAIL_MAX_LENGTH = 254
const NAME_MAX_LENGTH = 80
const BCRYPT_MAX_BYTES = 72

function normalizeEmailInput(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const email = value.trim().toLowerCase()
    if (!email || email.length > EMAIL_MAX_LENGTH) return null
    return email
}

function normalizeNameInput(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const name = value.trim()
    if (name.length < 2 || name.length > NAME_MAX_LENGTH) return null
    return name
}

function passwordValidationError(value: unknown, label = 'Parol'): string | null {
    if (typeof value !== 'string' || value.length < 8) {
        return `${label} kamida 8 ta belgi bo'lishi kerak`
    }
    // bcrypt 72 byte'dan keyingi qismini xavfsiz farqlamaydi; yashirin truncationga yo'l qo'ymaymiz.
    if (Buffer.byteLength(value, 'utf8') > BCRYPT_MAX_BYTES) {
        return `${label} juda uzun (ko'pi bilan 72 bayt)`
    }
    if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
        return `${label}da kamida bitta harf va bitta raqam bo'lishi shart`
    }
    return null
}

function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex')
}

function logEmailError(context: string, error: unknown): void {
    if (error instanceof EmailDeliveryError) {
        console.error(context, error.toSafeLog())
        return
    }
    console.error(context, {
        code: 'EMAIL_DELIVERY_UNEXPECTED',
        errorName: error instanceof Error ? error.name : 'UnknownError',
    })
}

function emailErrorResponse(error: unknown, message: string) {
    return error instanceof EmailDeliveryError
        ? authError(message, AUTH_ERROR_CODES.EMAIL_DELIVERY_FAILED)
        : { error: message }
}

type EmailTarget = {
    id: string
    email: string
    name: string
    verificationToken?: string | null
    verificationTokenExpiry?: Date | null
    resetToken?: string | null
    resetTokenExpiry?: Date | null
}

async function issueVerificationEmail(target: EmailTarget): Promise<void> {
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashToken(token)
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.user.update({
        where: { id: target.id },
        data: { verificationToken: tokenHash, verificationTokenExpiry: tokenExpiry }
    })

    try {
        await sendVerificationEmail(target.email, target.name, token)
    } catch (error) {
        // Provider rad etsa oldingi ishlaydigan havolani yo'qotmaymiz. updateMany
        // concurrency guard'i keyingi resend tokenini tasodifan orqaga qaytarmaydi.
        await prisma.user.updateMany({
            where: { id: target.id, verificationToken: tokenHash },
            data: {
                verificationToken: target.verificationToken ?? null,
                verificationTokenExpiry: target.verificationTokenExpiry ?? null,
            }
        }).catch(() => undefined)
        throw error
    }
}

async function issuePasswordResetEmail(target: EmailTarget): Promise<void> {
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashToken(token)
    const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000)

    await prisma.user.update({
        where: { id: target.id },
        data: { resetToken: tokenHash, resetTokenExpiry: tokenExpiry }
    })

    try {
        await sendPasswordResetEmail(target.email, target.name, token)
    } catch (error) {
        await prisma.user.updateMany({
            where: { id: target.id, resetToken: tokenHash },
            data: {
                resetToken: target.resetToken ?? null,
                resetTokenExpiry: target.resetTokenExpiry ?? null,
            }
        }).catch(() => undefined)
        throw error
    }
}

// Audit log uchun admin (actor) email'ini DB dan oladi. JWT faqat {id, role}
// saqlaydi, shuning uchun email'ni shu yerda qidiramiz. Best-effort: topilmasa
// yoki xato bo'lsa null qaytaradi (audit yozuvini bloklamaydi).
async function getActorEmail(actorId: string): Promise<string | null> {
    try {
        const actor = await prisma.user.findUnique({
            where: { id: actorId },
            select: { email: true }
        })
        return actor?.email ?? null
    } catch (err) {
        console.warn('getActorEmail muvaffaqiyatsiz:', err)
        return null
    }
}

function isTemporaryDnsError(code?: string): boolean {
    return ['EAI_AGAIN', 'ETIMEOUT', 'ESERVFAIL', 'SERVFAIL', 'REFUSED', 'ECONNREFUSED'].includes(code || '')
}

async function hasResolvableEmailDomain(domain: string): Promise<boolean> {
    let dnsTemporarilyUnavailable = false

    try {
        const mxRecords = await dns.resolveMx(domain)
        if (mxRecords?.length) return true
    } catch (dnsErr: any) {
        if (isTemporaryDnsError(dnsErr?.code)) {
            console.warn('MX lookup temporary failed:', domain, dnsErr?.code)
            dnsTemporarilyUnavailable = true
        }
    }

    const addressLookups = await Promise.allSettled([
        dns.resolve4(domain),
        dns.resolve6(domain),
    ])

    const hasAddressRecord = addressLookups.some((result) =>
        result.status === 'fulfilled' && Array.isArray(result.value) && result.value.length > 0
    )
    if (hasAddressRecord) return true

    const temporaryAddressFailure = addressLookups.some((result) =>
        result.status === 'rejected' && isTemporaryDnsError((result.reason as any)?.code)
    )

    if (dnsTemporarilyUnavailable || temporaryAddressFailure) {
        console.warn('DNS lookup skipped for email domain due to temporary resolver issue:', domain)
        return true
    }

    return false
}

async function recordPresence(userId: string) {
    const lastLocalWrite = lastPresenceWrite.get(userId)
    if (lastLocalWrite && Date.now() - lastLocalWrite < PRESENCE_LOG_INTERVAL_MS) {
        return
    }

    const lastPresence = await prisma.visitLog.findFirst({
        where: { userId, action: 'presence' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
    })

    if (lastPresence && Date.now() - lastPresence.createdAt.getTime() < PRESENCE_LOG_INTERVAL_MS) {
        lastPresenceWrite.set(userId, lastPresence.createdAt.getTime())
        return
    }

    await prisma.visitLog.create({ data: { userId, action: 'presence' } })
    lastPresenceWrite.set(userId, Date.now())

    const now = Date.now()
    if (now - lastPresenceCleanupAt >= PRESENCE_CLEANUP_INTERVAL_MS) {
        lastPresenceCleanupAt = now
        const cutoff = new Date(now - PRESENCE_RETENTION_DAYS * 24 * 60 * 60 * 1000)
        try {
            await prisma.visitLog.deleteMany({
                where: {
                    action: 'presence',
                    createdAt: { lt: cutoff }
                }
            })
        } catch (cleanupErr) {
            console.warn('Presence log cleanup failed:', cleanupErr)
        }
    }
}

const emailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3,
    message: { error: 'Juda ko\'p urinish. 15 daqiqadan keyin qayta urinib ko\'ring.' },
    standardHeaders: true,
    legacyHeaders: false,
})

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Juda ko\'p urinish. 15 daqiqadan keyin qayta urinib ko\'ring.' },
    standardHeaders: true,
    legacyHeaders: false,
})

// Register — faqat STUDENT, token qaytaradi (alohida login shart emas)
router.post('/register', authLimiter, async (req, res) => {
    try {
        const { email, password, name, subject, subject2, examDate, targetScore, examType } = req.body

        // Majburiy maydonlar
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Ism, email va parol majburiy' })
        }
        const normalizedName = normalizeNameInput(name)
        if (!normalizedName) return res.status(400).json({ error: 'Ism 2–80 ta belgi bo\'lishi kerak' })
        const passwordError = passwordValidationError(password)
        if (passwordError) return res.status(400).json({ error: passwordError })

        const normalizedEmail = normalizeEmailInput(email)
        if (!normalizedEmail) return res.status(400).json({ error: 'Email manzil noto\'g\'ri' })

        // Email format tekshiruv
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return res.status(400).json({ error: 'Email manzil noto\'g\'ri' })
        }

        // Domen DNS tekshiruvi: MX bo'lmasa A/AAAA ga ham qaraymiz.
        // Temporary DNS xatolari valid registratsiyani bloklamasin.
        const domain = normalizedEmail.split('@')[1];
        const hasDomain = await hasResolvableEmailDomain(domain)
        if (!hasDomain) {
            return res.status(400).json({ error: 'Bunday email domen mavjud emas yoxud xat qabul qila olmaydi.' })
        }

        const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
        if (existing) return res.status(400).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tilgan' })

        // bcrypt cost 10 — tez va xavfsiz
        const hashed = await bcrypt.hash(password, 10)
        const verificationToken = crypto.randomBytes(32).toString('hex')
        const hashedVerificationToken = hashToken(verificationToken)
        const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 soat

        const normalizedSubject = normalizeSubject(subject)
        const normalizedSubject2 = normalizeSubject(subject2)
        const normalizedExamType = parseOptionalExamType(examType)
        const normalizedExamDate = parseOptionalExamDate(examDate)
        const normalizedTargetScore = validateTargetScore(targetScore, normalizedExamType)

        // DTM ixtisos fanlari ENDI MUSTAQIL tanlanadi — yo'nalish juftligi majburlanmaydi
        // (o'quvchi 1-fan va 2-fanni erkin tanlaydi, masalan Matematika + Kimyo).

        // User, profil va register audit yozuvi bitta atomik birlik: oraliq qadam
        // yiqilsa email band bo'lib qolgan yarim akkaunt yaratilmaydi.
        const user = await prisma.$transaction(async (tx) => {
            const createdUser = await tx.user.create({
                data: {
                    email: normalizedEmail,
                    password: hashed,
                    name: normalizedName,
                    role: 'STUDENT',
                    emailVerified: false,
                    verificationToken: hashedVerificationToken,
                    verificationTokenExpiry,
                }
            })

            await tx.studentProfile.create({
                data: {
                    userId: createdUser.id,
                    subject: normalizedSubject,
                    subject2: normalizedSubject2,
                    examType: normalizedExamType ?? null,
                    examDate: normalizedExamDate ?? null,
                    targetScore: normalizedTargetScore ?? null,
                    onboardingDone: false,
                }
            })

            await tx.visitLog.create({ data: { userId: createdUser.id, action: 'register' } })
            return createdUser
        })

        // Verification email yuboramiz (xato bo'lsa ham ro'yxatdan o'tadi)
        try {
            await sendVerificationEmail(user.email, user.name, verificationToken)
        } catch (emailErr) {
            logEmailError('Verification email yuborishda xato:', emailErr)
        }

        // Token darhol qaytaramiz — alohida login chaqiruvi shart emas
        const token = signAuthToken(user)

        res.status(201).json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                emailVerified: false,
                passwordConfigured: true,
            }
        })
    } catch (e: any) {
        console.error('Register error:', e)
        // Prisma unique constraint xatoligi
        if (e?.code === 'P2002') {
            return res.status(400).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tilgan' })
        }
        const message = e?.message || 'Server xatoligi. Qayta urinib ko\'ring.'
        const isValidationError = /examType|examDate|targetScore|ball|juftligi/.test(message)
        res.status(isValidationError ? 400 : 500).json({ error: isValidationError ? message : 'Server xatoligi. Qayta urinib ko\'ring.' })
    }
})

// Login
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body
        if (!email || !password) {
            return res.status(400).json({ error: 'Email va parol majburiy' })
        }
        const normalizedEmail = normalizeEmailInput(email)
        if (!normalizedEmail || typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > BCRYPT_MAX_BYTES) {
            return res.status(400).json({ error: 'Email yoki parol xato' })
        }
        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
        if (!user) return res.status(400).json({ error: 'Email yoki parol xato' })

        const valid = await bcrypt.compare(password, user.password)
        if (!valid) return res.status(400).json({ error: 'Email yoki parol xato' })

        // Bloklangan (SUSPENDED) akkauntga token berilmaydi
        if (user.status === 'SUSPENDED') {
            return res.status(403).json(authError(
                'Akkauntingiz bloklangan. Administrator bilan bog\'laning.',
                AUTH_ERROR_CODES.ACCOUNT_SUSPENDED
            ))
        }

        const token = signAuthToken(user)

        // Analytics authning o'zini bloklamaydi.
        try {
            await prisma.visitLog.create({ data: { userId: user.id, action: 'login' } })
        } catch (visitError) {
            console.warn('Login visit log yozilmadi:', visitError instanceof Error ? visitError.name : 'UnknownError')
        }

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                emailVerified: user.emailVerified,
                passwordConfigured: user.passwordConfigured,
            }
        })
    } catch (e) {
        console.error('Login error:', e)
        res.status(500).json({ error: 'Server xatoligi. Qayta urinib ko\'ring.' })
    }
})

// Public config — frontend runtime'da o'qiydi (build-time VITE_GOOGLE_CLIENT_ID shart emas).
// Faqat Client ID (maxfiy emas) qaytadi; yo'q bo'lsa null → tugma ko'rinmaydi.
router.get('/config', (_req, res) => {
    res.json({ googleClientId: GOOGLE_CLIENT_ID || null })
})

// Google bilan kirish — frontend GSI'dan ID-token (credential) keladi, biz tekshiramiz.
// GOOGLE_CLIENT_ID yo'q bo'lsa inert (503). Google email tasdiqlangani uchun emailVerified=true.
router.post('/google', authLimiter, async (req, res) => {
    if (!googleClient || !GOOGLE_CLIENT_ID) {
        return res.status(503).json({ error: 'Google orqali kirish hali sozlanmagan' })
    }
    try {
        const { credential, nonce } = req.body
        if (!credential || typeof credential !== 'string') {
            return res.status(400).json({ error: 'Google credential kerak' })
        }
        const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID })
        const payload = ticket.getPayload()
        if (!payload?.email || !payload.sub || payload.email_verified !== true) {
            return res.status(401).json({ error: 'Google email tasdiqlanmadi' })
        }
        // Redirect oqimida nonce ikkala tomonda ham majburiy. Token nonce'siz kelsa ham
        // qabul qilmaymiz — replay himoyasi requestga qarab o'chib qolmaydi.
        if (typeof payload.nonce !== 'string' || typeof nonce !== 'string' || nonce !== payload.nonce) {
            return res.status(401).json({ error: 'Google nonce mos kelmadi' })
        }
        const email = normalizeEmailInput(payload.email)
        if (!email) return res.status(401).json({ error: 'Google email noto\'g\'ri' })
        const name = normalizeNameInput(payload.name || payload.given_name)
            || email.split('@')[0].slice(0, NAME_MAX_LENGTH)

        let user = await prisma.user.findUnique({ where: { googleSubject: payload.sub } })
        if (!user) {
            const emailOwner = await prisma.user.findUnique({ where: { email } })
            if (emailOwner) {
                // Privileged accountni faqat email mosligi bilan avtomatik linklamaymiz.
                // Alohida recent-password re-auth linking oqimi ishlab chiqilmaguncha
                // admin/o'qituvchi xavfsiz mavjud parol orqali kiradi.
                if (emailOwner.role !== 'STUDENT') {
                    return res.status(403).json(authError(
                        'Admin va o\'qituvchi uchun Google orqali kirish hozircha yoqilmagan. Parol bilan kiring.',
                        AUTH_ERROR_CODES.GOOGLE_LINK_REQUIRED
                    ))
                }
                if (emailOwner.googleSubject && emailOwner.googleSubject !== payload.sub) {
                    return res.status(409).json(authError(
                        'Bu email boshqa Google akkauntiga bog\'langan.',
                        AUTH_ERROR_CODES.GOOGLE_IDENTITY_CONFLICT
                    ))
                }
                user = await prisma.user.update({
                    where: { id: emailOwner.id },
                    data: { googleSubject: payload.sub, emailVerified: true }
                })
            } else {
                // Google-only student: random hash login uchun ishlatilmaydi; user keyin
                // authenticated "set password" oqimi orqali o'z parolini yaratishi mumkin.
                const randomPwd = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10)
                user = await prisma.$transaction(async (tx) => {
                    const created = await tx.user.create({
                        data: {
                            email,
                            name,
                            password: randomPwd,
                            role: 'STUDENT',
                            emailVerified: true,
                            googleSubject: payload.sub,
                            passwordConfigured: false,
                        }
                    })
                    await tx.studentProfile.create({ data: { userId: created.id, onboardingDone: false } })
                    await tx.visitLog.create({ data: { userId: created.id, action: 'register' } })
                    return created
                })
            }
        } else if (user.email !== email) {
            // `sub` asosiy identity; email o'zgarishini hozir avtomatik ko'chirmaymiz,
            // chunki yangi email boshqa lokal userga tegishli bo'lishi mumkin.
            return res.status(409).json(authError(
                'Google akkaunt emaili DTMMax akkaunti bilan mos emas.',
                AUTH_ERROR_CODES.GOOGLE_IDENTITY_CONFLICT
            ))
        }

        if (user.status === 'SUSPENDED') {
            return res.status(403).json(authError(
                'Akkauntingiz bloklangan. Administrator bilan bog\'laning.',
                AUTH_ERROR_CODES.ACCOUNT_SUSPENDED
            ))
        }

        const token = signAuthToken(user)
        try { await prisma.visitLog.create({ data: { userId: user.id, action: 'login' } }) } catch { }
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                emailVerified: user.emailVerified,
                passwordConfigured: user.passwordConfigured,
            }
        })
    } catch (e) {
        console.error('Google auth error:', e)
        res.status(401).json({ error: 'Google orqali kirish amalga oshmadi' })
    }
})

// Ping — real-time online tracking (har 60 soniyada frontend chaqiradi)
router.post('/ping', authenticate, async (req: AuthRequest, res) => {
    try {
        const { page } = req.body
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { name: true, email: true, role: true }
        })
        if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' })

        await Promise.all([
            updateOnline(req.user.id, user.name, user.email, user.role, page),
            recordPresence(req.user.id)
        ])
        res.json({ ok: true })
    } catch (e) {
        console.error('Ping error:', e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Me
router.get('/me', authenticate, async (req: AuthRequest, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                status: true,
                emailVerified: true,
                passwordConfigured: true,
            },
        })
        if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' })
        res.json(user)
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// AI kvota holati — frontend limit bar uchun (faqat o'qiydi, kvota yemaydi)
router.get('/ai-quota', authenticate, async (req: AuthRequest, res) => {
    try {
        res.json(await getAiQuotaStatus(req.user.id, req.user.role))
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Admin: O'qituvchi yaratish
router.post('/create-teacher', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const { email, password, name } = req.body
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Barcha maydonlarni to\'ldiring' })
        }
        const teacherName = normalizeNameInput(name)
        if (!teacherName) return res.status(400).json({ error: 'Ism 2–80 ta belgi bo\'lishi kerak' })
        const teacherEmail = normalizeEmailInput(email)
        if (!teacherEmail) return res.status(400).json({ error: 'Email manzil noto\'g\'ri' })
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teacherEmail)) {
            return res.status(400).json({ error: 'Email manzil noto\'g\'ri' })
        }
        const passwordError = passwordValidationError(password)
        if (passwordError) return res.status(400).json({ error: passwordError })
        const existing = await prisma.user.findUnique({ where: { email: teacherEmail } })
        if (existing) return res.status(400).json({ error: 'Bu email allaqachon band' })

        const hashed = await bcrypt.hash(password, 10)
        const created = await prisma.user.create({
            data: { email: teacherEmail, password: hashed, name: teacherName, role: 'TEACHER' }
        })

        // AUDIT (best-effort)
        await logAdminAction(req.user.id, await getActorEmail(req.user.id), 'TEACHER_CREATE', 'USER', created.id, {
            email: teacherEmail,
        })

        res.status(201).json({ message: 'O\'qituvchi yaratildi' })
    } catch (e: any) {
        console.error(e)
        if (e?.code === 'P2002') return res.status(400).json({ error: 'Bu email allaqachon band' })
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Admin: Barcha foydalanuvchilar (pagination + qidiruv)
router.get('/users', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1)
        const limit = Math.min(100, Math.max(10, parseInt(req.query.limit as string) || 50))
        const search = ((req.query.search as string) || '').trim()
        const roleFilter = (req.query.role as string) || ''
        const skip = (page - 1) * limit

        const where: any = {}
        if (roleFilter && ['STUDENT', 'TEACHER', 'ADMIN'].includes(roleFilter.toUpperCase())) {
            where.role = roleFilter.toUpperCase()
        }
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } }
            ]
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true, email: true, name: true, role: true, status: true, createdAt: true,
                    _count: { select: { testsCreated: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.user.count({ where })
        ])

        res.json({ users, total, page, pages: Math.ceil(total / limit) })
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Admin: Foydalanuvchini o'chirish
router.delete('/users/:userId', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const uid = String(req.params.userId)
        const target = await prisma.user.findUnique({ where: { id: uid } })
        if (!target) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' })
        if (target.role === 'ADMIN') return res.status(403).json({ error: 'Admin akkauntini o\'chirib bo\'lmaydi' })

        // O'qituvchini o'chirish kaskadli: uning testlari (Test.creator onDelete: Cascade) va
        // shu testlardagi BOSHQA o'quvchilarning urinishlari (TestAttempt.test onDelete: Cascade)
        // jimgina o'chib ketadi. Bu ommaviy ma'lumot yo'qotilishini oldini olish uchun, agar
        // kollateral (boshqalarning ma'lumotlari) bo'lsa, aniq tasdiq (force/confirm) bo'lmaguncha
        // 409 bilan rad etamiz. Admin xohlasa ataylab majburiy o'chira oladi.
        if (target.role === 'TEACHER') {
            const force = req.query.force === 'true' || req.body?.confirm === true
            if (!force) {
                const teacherTests = await prisma.test.findMany({
                    where: { creatorId: uid },
                    select: { id: true }
                })
                const testIds = teacherTests.map((t: { id: string }) => t.id)
                // Faqat BOSHQA o'quvchilarning urinishlari kollateral hisoblanadi
                const collateralAttempts = testIds.length > 0
                    ? await prisma.testAttempt.count({
                        where: { testId: { in: testIds }, userId: { not: uid } }
                    })
                    : 0

                if (teacherTests.length > 0 && collateralAttempts > 0) {
                    return res.status(409).json({
                        error: `Bu o'qituvchini o'chirish ${teacherTests.length} ta testni va boshqa o'quvchilarning ${collateralAttempts} ta test urinishini ham o'chirib yuboradi. Bu amalni bajarish uchun majburiy tasdiq kerak.`,
                        requiresConfirmation: true,
                        tests: teacherTests.length,
                        attempts: collateralAttempts
                    })
                }
            }
        }

        // Avval chatlar ID larini olamiz (message delete uchun)
        const userChats = await prisma.chat.findMany({ where: { userId: uid }, select: { id: true } })
        const chatIds = userChats.map(c => c.id)

        await prisma.$transaction([
            prisma.notification.deleteMany({ where: { userId: uid } }),
            prisma.visitLog.deleteMany({ where: { userId: uid } }),
            prisma.message.deleteMany({ where: { chatId: { in: chatIds } } }),
            prisma.chat.deleteMany({ where: { userId: uid } }),
            prisma.testAttempt.deleteMany({ where: { userId: uid } }),
            prisma.flashcard.deleteMany({ where: { userId: uid } }),
            prisma.topicStat.deleteMany({ where: { userId: uid } }),
            prisma.userProgress.deleteMany({ where: { userId: uid } }),
            prisma.studentProfile.deleteMany({ where: { userId: uid } }),
            prisma.user.delete({ where: { id: uid } })
        ])

        // AUDIT (best-effort)
        await logAdminAction(req.user.id, await getActorEmail(req.user.id), 'USER_DELETE', 'USER', uid, {
            email: target.email,
            role: target.role,
        })

        res.json({ message: 'Foydalanuvchi o\'chirildi' })
    } catch (e: any) {
        console.error('delete user error:', e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Admin: Foydalanuvchining rolini, ismini va/yoki holatini (status) yangilash
// PATCH /api/auth/users/:userId — body { role?, name?, status? }
// GUARD: admin o'z rolini o'zgartira olmaydi (req.user.id === userId → 400),
// admin o'zini bloklay olmaydi (status, req.user.id === userId → 400),
// bo'sh ism rad etiladi. Parol bu yerda o'zgartirilmaydi. Yangilangan user qaytariladi.
// AUDIT: rol o'zgarishi va suspend/activate uchun AdminAuditLog yoziladi (best-effort).
router.patch('/users/:userId', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const uid = String(req.params.userId)
        const { role, name, status } = req.body as { role?: unknown; name?: unknown; status?: unknown }

        // Kamida bitta maydon kelishi kerak
        if (role === undefined && name === undefined && status === undefined) {
            return res.status(400).json({ error: 'O\'zgartirish uchun rol, ism yoki holat kiriting' })
        }

        const data: {
            role?: 'STUDENT' | 'TEACHER' | 'ADMIN'
            name?: string
            status?: 'ACTIVE' | 'SUSPENDED'
            authVersion?: { increment: number }
        } = {}

        // Rol — faqat ruxsat etilgan qiymatlar (whitelist)
        const ALLOWED_ROLES = ['STUDENT', 'TEACHER', 'ADMIN'] as const
        if (role !== undefined) {
            if (typeof role !== 'string' || !ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
                return res.status(400).json({ error: 'Rol noto\'g\'ri' })
            }
            // GUARD: admin o'z rolini o'zgartira olmaydi (o'zini bloklab qo'yishdan saqlanish)
            if (req.user.id === uid) {
                return res.status(400).json({ error: 'O\'z rolingizni o\'zgartira olmaysiz' })
            }
            data.role = role as (typeof ALLOWED_ROLES)[number]
        }

        // Status — faqat ACTIVE | SUSPENDED (whitelist)
        const ALLOWED_STATUSES = ['ACTIVE', 'SUSPENDED'] as const
        if (status !== undefined) {
            if (typeof status !== 'string' || !ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
                return res.status(400).json({ error: 'Holat noto\'g\'ri (ACTIVE yoki SUSPENDED bo\'lishi kerak)' })
            }
            // GUARD: admin o'zini bloklay (yoki holatini o'zgartira) olmaydi
            if (req.user.id === uid) {
                return res.status(400).json({ error: 'O\'z holatingizni o\'zgartira olmaysiz' })
            }
            data.status = status as (typeof ALLOWED_STATUSES)[number]
        }

        // Ism — bo'sh bo'lmasligi kerak
        if (name !== undefined) {
            const normalizedName = normalizeNameInput(name)
            if (!normalizedName) return res.status(400).json({ error: 'Ism 2–80 ta belgi bo\'lishi kerak' })
            data.name = normalizedName
        }

        const target = await prisma.user.findUnique({ where: { id: uid } })
        if (!target) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' })

        const roleChanged = data.role !== undefined && data.role !== target.role
        const statusChanged = data.status !== undefined && data.status !== target.status
        if (roleChanged || statusChanged) {
            // Reactivate ham eski, ehtimol o'g'irlangan tokenni qayta tiriltirmaydi.
            data.authVersion = { increment: 1 }
        }

        const updated = await prisma.user.update({
            where: { id: uid },
            data,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                status: true,
                emailVerified: true,
                createdAt: true,
            }
        })

        // AUDIT (best-effort) — rol o'zgarishi va suspend/activate.
        // JWT faqat {id, role} saqlagani uchun actor email'ini DB dan olamiz.
        if (roleChanged || statusChanged) {
            const actorEmail = await getActorEmail(req.user.id)
            if (roleChanged) {
                await logAdminAction(req.user.id, actorEmail, 'USER_ROLE_CHANGE', 'USER', uid, {
                    email: target.email,
                    from: target.role,
                    to: data.role,
                })
            }
            if (statusChanged) {
                await logAdminAction(
                    req.user.id,
                    actorEmail,
                    data.status === 'SUSPENDED' ? 'USER_SUSPEND' : 'USER_ACTIVATE',
                    'USER',
                    uid,
                    { email: target.email, from: target.status, to: data.status }
                )
            }
        }

        res.json({ user: updated })
    } catch (e: any) {
        console.error('admin update user error:', e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Admin: Foydalanuvchiga tasdiqlash emailini qayta yuborish
// Token-gen naqshи register/resend-verification bilan bir xil (hashlangan token saqlanadi,
// emailga ochiq token yuboriladi). 200 { ok: true }.
router.post('/users/:userId/resend-verification', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const uid = String(req.params.userId)
        const target = await prisma.user.findUnique({ where: { id: uid } })
        if (!target) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' })
        if (target.emailVerified) return res.status(400).json({ error: 'Email allaqachon tasdiqlangan' })

        await issueVerificationEmail(target)

        // AUDIT (best-effort)
        await logAdminAction(req.user.id, await getActorEmail(req.user.id), 'USER_RESEND_VERIFICATION', 'USER', target.id, {
            email: target.email,
        })

        res.json({ ok: true })
    } catch (e) {
        logEmailError('admin resend-verification error:', e)
        res.status(500).json(emailErrorResponse(e, 'Email yuborishda xato. Qayta urinib ko\'ring.'))
    }
})

// Admin: Foydalanuvchiga parol tiklash emailini yuborish
// Ochiq parol HECH QACHON qaytarilmaydi/o'rnatilmaydi — faqat reset token generatsiya qilinadi
// va emailga tiklash havolasi yuboriladi (forgot-password naqshi). 200 { ok: true }.
router.post('/users/:userId/reset-password', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const uid = String(req.params.userId)
        const target = await prisma.user.findUnique({ where: { id: uid } })
        if (!target) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' })

        await issuePasswordResetEmail(target)

        // AUDIT (best-effort)
        await logAdminAction(req.user.id, await getActorEmail(req.user.id), 'USER_RESET_PASSWORD', 'USER', target.id, {
            email: target.email,
        })

        res.json({ ok: true })
    } catch (e) {
        logEmailError('admin reset-password error:', e)
        res.status(500).json(emailErrorResponse(e, 'Email yuborishda xato. Qayta urinib ko\'ring.'))
    }
})

// Email tasdiqlash — mutation GET emas, POST. Email link frontend sahifasini ochadi,
// sahifa keyin explicit POST yuboradi; link-preview scanner oddiy GET bilan consume qilmaydi.
router.post('/verify-email/:token', async (req, res) => {
    try {
        const { token } = req.params
        if (!token || token.length !== 64) {
            return res.status(400).json({ error: 'Noto\'g\'ri tasdiqlash havolasi' })
        }
        const user = await prisma.user.findUnique({ where: { verificationToken: hashToken(token) } })
        if (!user) return res.status(400).json({ error: 'Havola noto\'g\'ri yoki muddati o\'tgan' })
        if (!user.verificationTokenExpiry || user.verificationTokenExpiry < new Date()) {
            return res.status(400).json({ error: 'Tasdiqlash havolasi muddati o\'tgan. Yangi havola so\'rang.' })
        }
        const consumed = await prisma.user.updateMany({
            where: {
                id: user.id,
                verificationToken: hashToken(token),
                verificationTokenExpiry: { gt: new Date() },
            },
            data: { emailVerified: true, verificationToken: null, verificationTokenExpiry: null }
        })
        if (consumed.count !== 1) {
            return res.status(400).json({ error: 'Havola noto\'g\'ri yoki allaqachon ishlatilgan' })
        }
        res.json({ message: 'Email muvaffaqiyatli tasdiqlandi!' })
    } catch (e) {
        console.error('verify-email error:', e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Verification emailni qayta yuborish
router.post('/resend-verification', emailLimiter, authenticate, async (req: AuthRequest, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } })
        if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' })
        if (user.emailVerified) return res.status(400).json({ error: 'Email allaqachon tasdiqlangan' })

        await issueVerificationEmail(user)
        res.json({ message: 'Tasdiqlash emaili yuborildi' })
    } catch (e) {
        logEmailError('resend-verification error:', e)
        res.status(500).json(emailErrorResponse(e, 'Email yuborishda xato. Qayta urinib ko\'ring.'))
    }
})

// Parolni unutdim — reset email yuborish
router.post('/forgot-password', authLimiter, emailLimiter, async (req, res) => {
    try {
        const { email } = req.body
        if (!email) return res.status(400).json({ error: 'Email manzil kiritilmagan' })
        const normalizedEmail = normalizeEmailInput(email)
        if (!normalizedEmail) return res.status(400).json({ error: 'Email manzil noto\'g\'ri' })
        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
        // Xavfsizlik: topilmasa ham muvaffaqiyatli javob qaytaramiz
        if (!user) return res.json({ message: 'Agar bu email ro\'yxatda bo\'lsa, parol tiklash havolasi yuborildi.' })

        try {
            await issuePasswordResetEmail(user)
        } catch (emailError) {
            // Email bor/yo'qligini response orqali ajratib bo'lmasin. Delivery xatosi
            // server log/monitoringda qoladi, public javob esa doim bir xil.
            logEmailError('forgot-password delivery error:', emailError)
        }
        res.json({ message: 'Agar bu email ro\'yxatda bo\'lsa, parol tiklash havolasi yuborildi.' })
    } catch (e) {
        logEmailError('forgot-password error:', e)
        res.status(500).json(emailErrorResponse(e, 'Email yuborishda xato. Qayta urinib ko\'ring.'))
    }
})

// Parolni tiklash — token + yangi parol
router.post('/reset-password', authLimiter, async (req, res) => {
    try {
        const { token, password } = req.body
        if (!token || !password) return res.status(400).json({ error: 'Token va yangi parol kiritilmagan' })
        if (typeof token !== 'string' || token.length !== 64) return res.status(400).json({ error: 'Token noto\'g\'ri' })
        const passwordError = passwordValidationError(password)
        if (passwordError) return res.status(400).json({ error: passwordError })

        const user = await prisma.user.findUnique({ where: { resetToken: hashToken(token) } })
        if (!user) return res.status(400).json({ error: 'Havola noto\'g\'ri yoki muddati o\'tgan' })
        if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
            return res.status(400).json({ error: 'Parol tiklash havolasi muddati o\'tgan. Yangi havola so\'rang.' })
        }

        const hashed = await bcrypt.hash(password, 10)
        const consumed = await prisma.user.updateMany({
            where: {
                id: user.id,
                resetToken: hashToken(token),
                resetTokenExpiry: { gt: new Date() },
            },
            data: {
                password: hashed,
                passwordConfigured: true,
                resetToken: null,
                resetTokenExpiry: null,
                authVersion: { increment: 1 },
            }
        })
        if (consumed.count !== 1) {
            return res.status(400).json({ error: 'Havola noto\'g\'ri yoki allaqachon ishlatilgan' })
        }
        res.json({ message: 'Parol muvaffaqiyatli yangilandi! Endi kirish mumkin.' })
    } catch (e) {
        console.error('reset-password error:', e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Parolni o'zgartirish (login bo'lgan holda)
router.put('/change-password', authenticate, async (req: AuthRequest, res) => {
    try {
        const { currentPassword, newPassword } = req.body
        if (!newPassword) return res.status(400).json({ error: 'Yangi parolni kiriting' })
        const passwordError = passwordValidationError(newPassword, 'Yangi parol')
        if (passwordError) return res.status(400).json({ error: passwordError })
        const user = await prisma.user.findUnique({ where: { id: req.user.id } })
        if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' })
        if (user.passwordConfigured) {
            if (typeof currentPassword !== 'string' || Buffer.byteLength(currentPassword, 'utf8') > BCRYPT_MAX_BYTES) {
                return res.status(400).json({ error: 'Joriy parol noto\'g\'ri' })
            }
            const valid = await bcrypt.compare(currentPassword, user.password)
            if (!valid) return res.status(400).json({ error: 'Joriy parol noto\'g\'ri' })
        }
        const hashed = await bcrypt.hash(newPassword, 10)
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashed, passwordConfigured: true, authVersion: { increment: 1 } }
        })
        res.json({
            message: user.passwordConfigured
                ? 'Parol muvaffaqiyatli yangilandi. Barcha sessiyalardan chiqildi.'
                : 'Parol yaratildi. Xavfsizlik uchun qayta kiring.',
            sessionRevoked: true,
        })
    } catch (e) {
        console.error('change-password error:', e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Akkauntni o'chirish
router.delete('/account', authenticate, async (req: AuthRequest, res) => {
    try {
        const { password } = req.body
        const user = await prisma.user.findUnique({ where: { id: req.user.id } })
        if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' })
        if (user.role === 'ADMIN') return res.status(403).json({ error: 'Admin akkauntni o\'chirish mumkin emas' })
        if (!user.passwordConfigured) {
            return res.status(409).json(authError(
                'Akkauntni o\'chirishdan oldin xavfsizlik bo\'limida parol yarating.',
                AUTH_ERROR_CODES.PASSWORD_SETUP_REQUIRED
            ))
        }
        if (!password) return res.status(400).json({ error: 'Parolni kiriting' })
        if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > BCRYPT_MAX_BYTES) {
            return res.status(400).json({ error: 'Parol noto\'g\'ri' })
        }
        const valid = await bcrypt.compare(password, user.password)
        if (!valid) return res.status(400).json({ error: 'Parol noto\'g\'ri' })
        const uid = user.id
        const userChats = await prisma.chat.findMany({ where: { userId: uid }, select: { id: true } })
        const chatIds = userChats.map((c: { id: string }) => c.id)
        await prisma.$transaction([
            prisma.notification.deleteMany({ where: { userId: uid } }),
            prisma.visitLog.deleteMany({ where: { userId: uid } }),
            prisma.message.deleteMany({ where: { chatId: { in: chatIds } } }),
            prisma.chat.deleteMany({ where: { userId: uid } }),
            prisma.testAttempt.deleteMany({ where: { userId: uid } }),
            prisma.flashcard.deleteMany({ where: { userId: uid } }),
            prisma.topicStat.deleteMany({ where: { userId: uid } }),
            prisma.userProgress.deleteMany({ where: { userId: uid } }),
            prisma.studentProfile.deleteMany({ where: { userId: uid } }),
            prisma.user.delete({ where: { id: uid } })
        ])
        res.json({ message: 'Akkaunt o\'chirildi' })
    } catch (e) {
        console.error('delete account error:', e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Logout — token ni blacklist ga qo'shish
router.post('/logout', authenticate, async (req: AuthRequest, res) => {
    try {
        const authHeader = req.headers.authorization
        if (authHeader) {
            const token = authHeader.split(' ')[1]
            await tokenBlacklist.add(token)
        }
        res.json({ message: 'Tizimdan chiqdingiz' })
    } catch (e) {
        console.error('logout blacklist error:', e)
        res.status(503).json(authError(
            'Autentifikatsiya xizmati vaqtincha ishlamayapti. Qayta urinib ko\'ring.',
            AUTH_ERROR_CODES.SERVICE_UNAVAILABLE
        ))
    }
})

export default router
