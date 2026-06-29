import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import dns from 'dns/promises'
import crypto from 'crypto'
import { OAuth2Client } from 'google-auth-library'
import rateLimit from 'express-rate-limit'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'
import { tokenBlacklist } from '../utils/tokenBlacklist'
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email'
import { updateOnline } from '../utils/onlineTracker'
import { normalizeSubject } from '../utils/subjects'
import { parseOptionalExamDate, parseOptionalExamType, validateTargetScore } from '../utils/profileValidation'
import { isValidDtmPair } from '../utils/dtmPairs'
import { logAdminAction } from '../utils/adminAudit'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET!

// Google OAuth — GOOGLE_CLIENT_ID o'rnatilmasa inert (endpoint 503 qaytaradi)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null
const PRESENCE_LOG_INTERVAL_MS = 2 * 60 * 1000
const PRESENCE_RETENTION_DAYS = 90
const PRESENCE_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000
const lastPresenceWrite = new Map<string, number>()
let lastPresenceCleanupAt = 0

function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex')
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
        if (typeof name !== 'string' || name.trim().length < 2) {
            return res.status(400).json({ error: 'Ism kamida 2 ta belgi bo\'lishi kerak' })
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Parol kamida 8 ta belgi bo\'lishi kerak' })
        }
        if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
            return res.status(400).json({ error: 'Parolda kamida bitta harf va bitta raqam bo\'lishi shart' })
        }

        const normalizedEmail = email.trim().toLowerCase()

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

        const user = await prisma.user.create({
            data: {
                email: normalizedEmail,
                password: hashed,
                name: name.trim(),
                role: 'STUDENT',
                emailVerified: false,
                verificationToken: hashedVerificationToken,
                verificationTokenExpiry,
            }
        })

        // Profil yaratish
        await prisma.studentProfile.create({
            data: {
                userId: user.id,
                subject: normalizedSubject,
                subject2: normalizedSubject2,
                examType: normalizedExamType ?? null,
                examDate: normalizedExamDate ?? null,
                targetScore: normalizedTargetScore ?? null,
                onboardingDone: false,
            }
        })

        // Visit log
        await prisma.visitLog.create({ data: { userId: user.id, action: 'register' } })

        // Verification email yuboramiz (xato bo'lsa ham ro'yxatdan o'tadi)
        try {
            await sendVerificationEmail(user.email, user.name, verificationToken)
        } catch (emailErr) {
            console.error('Verification email yuborishda xato:', emailErr)
        }

        // Token darhol qaytaramiz — alohida login chaqiruvi shart emas
        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' })

        res.status(201).json({
            token,
            user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: false }
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

// Email mavjudligini tekshirish (register step 1 uchun)
router.get('/check-email', authLimiter, async (req, res) => {
    try {
        const email = String(req.query.email || '').trim().toLowerCase()
        if (!email) return res.json({ available: true })
        const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
        res.json({ available: !existing })
    } catch {
        // Xato bo'lsa bloklamaymiz — ro'yxatdan o'tishda baribir dublikat tekshiriladi
        res.json({ available: true })
    }
})

// Login
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body
        if (!email || !password) {
            return res.status(400).json({ error: 'Email va parol majburiy' })
        }
        const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
        if (!user) return res.status(400).json({ error: 'Email yoki parol xato' })

        const valid = await bcrypt.compare(password, user.password)
        if (!valid) return res.status(400).json({ error: 'Email yoki parol xato' })

        // Bloklangan (SUSPENDED) akkauntga token berilmaydi
        if (user.status === 'SUSPENDED') {
            return res.status(403).json({ error: 'Akkauntingiz bloklangan. Administrator bilan bog\'laning.' })
        }

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' })

        // Visit log
        await prisma.visitLog.create({ data: { userId: user.id, action: 'login' } })

        res.json({
            token,
            user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: user.emailVerified }
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
        if (!payload?.email || payload.email_verified === false) {
            return res.status(401).json({ error: 'Google email tasdiqlanmadi' })
        }
        // Redirect (implicit) oqimida id_token ichida nonce bo'ladi — replay'ga qarshi
        // MAJBURIY tekshiramiz: token nonce bilan kelgan bo'lsa, klient ham aynan o'shani
        // yuborishi shart (yo'qligi tekshiruvni o'chirib qo'ymasligi uchun).
        if (payload.nonce) {
            if (typeof nonce !== 'string' || nonce !== payload.nonce) {
                return res.status(401).json({ error: 'Google nonce mos kelmadi' })
            }
        }
        const email = payload.email.trim().toLowerCase()
        const name = (payload.name || payload.given_name || email.split('@')[0]).slice(0, 80)

        let user = await prisma.user.findUnique({ where: { email } })
        if (!user) {
            // Yangi user — Google orqali → parol ishlatilmaydi (random hash), email tasdiqlangan
            const randomPwd = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10)
            user = await prisma.user.create({
                data: { email, name, password: randomPwd, role: 'STUDENT', emailVerified: true }
            })
        } else if (!user.emailVerified) {
            // Mavjud user Google bilan kirsa — email egaligi tasdiqlangani uchun verified qilamiz
            user = await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } })
        }

        if (user.status === 'SUSPENDED') {
            return res.status(403).json({ error: 'Akkauntingiz bloklangan. Administrator bilan bog\'laning.' })
        }

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
        try { await prisma.visitLog.create({ data: { userId: user.id, action: 'login' } }) } catch { }
        res.json({
            token,
            user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: user.emailVerified }
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
            select: { id: true, email: true, name: true, role: true, emailVerified: true },
        })
        if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' })
        res.json(user)
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
        if (typeof name !== 'string' || name.trim().length < 2) {
            return res.status(400).json({ error: 'Ism kamida 2 ta belgi bo\'lishi kerak' })
        }
        const teacherEmail = email?.trim().toLowerCase()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teacherEmail)) {
            return res.status(400).json({ error: 'Email manzil noto\'g\'ri' })
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Parol kamida 8 ta belgi bo\'lishi kerak' })
        }
        if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
            return res.status(400).json({ error: 'Parolda kamida bitta harf va bitta raqam bo\'lishi shart' })
        }
        const existing = await prisma.user.findUnique({ where: { email: teacherEmail } })
        if (existing) return res.status(400).json({ error: 'Bu email allaqachon band' })

        const hashed = await bcrypt.hash(password, 10)
        const created = await prisma.user.create({
            data: { email: teacherEmail, password: hashed, name: name.trim(), role: 'TEACHER' }
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

        const data: { role?: 'STUDENT' | 'TEACHER' | 'ADMIN'; name?: string; status?: 'ACTIVE' | 'SUSPENDED' } = {}

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
            if (typeof name !== 'string' || name.trim().length < 2) {
                return res.status(400).json({ error: 'Ism kamida 2 ta belgi bo\'lishi kerak' })
            }
            data.name = name.trim()
        }

        const target = await prisma.user.findUnique({ where: { id: uid } })
        if (!target) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' })

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
        const roleChanged = data.role !== undefined && data.role !== target.role
        const statusChanged = data.status !== undefined && data.status !== target.status
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

        const verificationToken = crypto.randomBytes(32).toString('hex')
        const hashedVerificationToken = hashToken(verificationToken)
        const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 soat
        await prisma.user.update({
            where: { id: target.id },
            data: { verificationToken: hashedVerificationToken, verificationTokenExpiry }
        })
        await sendVerificationEmail(target.email, target.name, verificationToken)

        // AUDIT (best-effort)
        await logAdminAction(req.user.id, await getActorEmail(req.user.id), 'USER_RESEND_VERIFICATION', 'USER', target.id, {
            email: target.email,
        })

        res.json({ ok: true })
    } catch (e) {
        console.error('admin resend-verification error:', e)
        res.status(500).json({ error: 'Email yuborishda xato. Qayta urinib ko\'ring.' })
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

        const resetToken = crypto.randomBytes(32).toString('hex')
        const hashedResetToken = hashToken(resetToken)
        const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 soat
        await prisma.user.update({
            where: { id: target.id },
            data: { resetToken: hashedResetToken, resetTokenExpiry }
        })
        await sendPasswordResetEmail(target.email, target.name, resetToken)

        // AUDIT (best-effort)
        await logAdminAction(req.user.id, await getActorEmail(req.user.id), 'USER_RESET_PASSWORD', 'USER', target.id, {
            email: target.email,
        })

        res.json({ ok: true })
    } catch (e) {
        console.error('admin reset-password error:', e)
        res.status(500).json({ error: 'Email yuborishda xato. Qayta urinib ko\'ring.' })
    }
})

// Email tasdiqlash — token orqali
router.get('/verify-email/:token', async (req, res) => {
    try {
        const { token } = req.params
        if (!token || token.length !== 64) {
            return res.status(400).json({ error: 'Noto\'g\'ri tasdiqlash havolasi' })
        }
        const user = await prisma.user.findUnique({ where: { verificationToken: hashToken(token) } })
        if (!user) return res.status(400).json({ error: 'Havola noto\'g\'ri yoki muddati o\'tgan' })
        if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
            return res.status(400).json({ error: 'Tasdiqlash havolasi muddati o\'tgan. Yangi havola so\'rang.' })
        }
        await prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: true, verificationToken: null, verificationTokenExpiry: null }
        })
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

        const verificationToken = crypto.randomBytes(32).toString('hex')
        const hashedVerificationToken = hashToken(verificationToken)
        const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
        await prisma.user.update({
            where: { id: user.id },
            data: { verificationToken: hashedVerificationToken, verificationTokenExpiry }
        })
        await sendVerificationEmail(user.email, user.name, verificationToken)
        res.json({ message: 'Tasdiqlash emaili yuborildi' })
    } catch (e) {
        console.error('resend-verification error:', e)
        res.status(500).json({ error: 'Email yuborishda xato. Qayta urinib ko\'ring.' })
    }
})

// Parolni unutdim — reset email yuborish
router.post('/forgot-password', authLimiter, emailLimiter, async (req, res) => {
    try {
        const { email } = req.body
        if (!email) return res.status(400).json({ error: 'Email manzil kiritilmagan' })
        const normalizedEmail = email.trim().toLowerCase()
        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
        // Xavfsizlik: topilmasa ham muvaffaqiyatli javob qaytaramiz
        if (!user) return res.json({ message: 'Agar bu email ro\'yxatda bo\'lsa, parol tiklash havolasi yuborildi.' })

        const resetToken = crypto.randomBytes(32).toString('hex')
        const hashedResetToken = hashToken(resetToken)
        const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 soat
        await prisma.user.update({
            where: { id: user.id },
            data: { resetToken: hashedResetToken, resetTokenExpiry }
        })
        await sendPasswordResetEmail(user.email, user.name, resetToken)
        res.json({ message: 'Agar bu email ro\'yxatda bo\'lsa, parol tiklash havolasi yuborildi.' })
    } catch (e) {
        console.error('forgot-password error:', e)
        res.status(500).json({ error: 'Email yuborishda xato. Qayta urinib ko\'ring.' })
    }
})

// Parolni tiklash — token + yangi parol
router.post('/reset-password', authLimiter, async (req, res) => {
    try {
        const { token, password } = req.body
        if (!token || !password) return res.status(400).json({ error: 'Token va yangi parol kiritilmagan' })
        if (password.length < 8) return res.status(400).json({ error: 'Parol kamida 8 ta belgi bo\'lishi kerak' })
        if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
            return res.status(400).json({ error: 'Parolda kamida bitta harf va bitta raqam bo\'lishi shart' })
        }

        const user = await prisma.user.findUnique({ where: { resetToken: hashToken(token) } })
        if (!user) return res.status(400).json({ error: 'Havola noto\'g\'ri yoki muddati o\'tgan' })
        if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
            return res.status(400).json({ error: 'Parol tiklash havolasi muddati o\'tgan. Yangi havola so\'rang.' })
        }

        const hashed = await bcrypt.hash(password, 10)
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashed, resetToken: null, resetTokenExpiry: null }
        })
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
        if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Barcha maydonlar to\'ldirilishi shart' })
        if (newPassword.length < 8) return res.status(400).json({ error: 'Yangi parol kamida 8 ta belgi bo\'lishi kerak' })
        if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            return res.status(400).json({ error: 'Parolda kamida bitta harf va bitta raqam bo\'lishi shart' })
        }
        const user = await prisma.user.findUnique({ where: { id: req.user.id } })
        if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' })
        const valid = await bcrypt.compare(currentPassword, user.password)
        if (!valid) return res.status(400).json({ error: 'Joriy parol noto\'g\'ri' })
        const hashed = await bcrypt.hash(newPassword, 10)
        await prisma.user.update({ where: { id: user.id }, data: { password: hashed } })
        res.json({ message: 'Parol muvaffaqiyatli yangilandi' })
    } catch (e) {
        console.error('change-password error:', e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Akkauntni o'chirish
router.delete('/account', authenticate, async (req: AuthRequest, res) => {
    try {
        const { password } = req.body
        if (!password) return res.status(400).json({ error: 'Parolni kiriting' })
        const user = await prisma.user.findUnique({ where: { id: req.user.id } })
        if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' })
        if (user.role === 'ADMIN') return res.status(403).json({ error: 'Admin akkauntni o\'chirish mumkin emas' })
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
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

export default router
