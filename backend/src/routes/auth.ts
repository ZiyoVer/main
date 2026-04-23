import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import dns from 'dns/promises'
import crypto from 'crypto'
import rateLimit from 'express-rate-limit'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'
import { tokenBlacklist } from '../utils/tokenBlacklist'
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email'
import { updateOnline } from '../utils/onlineTracker'
import { normalizeSubject } from '../utils/subjects'
import { parseOptionalExamDate, parseOptionalExamType, parseOptionalTargetScore } from '../utils/profileValidation'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET!
const PRESENCE_LOG_INTERVAL_MS = 2 * 60 * 1000
const PRESENCE_RETENTION_DAYS = 90
const PRESENCE_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000
const lastPresenceWrite = new Map<string, number>()
let lastPresenceCleanupAt = 0

function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex')
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
        const normalizedTargetScore = parseOptionalTargetScore(targetScore)

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
                onboardingDone: true,
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
        const isValidationError = /examType|examDate|targetScore/.test(message)
        res.status(isValidationError ? 400 : 500).json({ error: isValidationError ? message : 'Server xatoligi. Qayta urinib ko\'ring.' })
    }
})

// Email mavjudligini tekshirish (register step 1 uchun)
router.get('/check-email', authLimiter, async (req, res) => {
    try {
        res.json({ available: true })
    } catch {
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
        await prisma.user.create({
            data: { email: teacherEmail, password: hashed, name: name.trim(), role: 'TEACHER' }
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
                    id: true, email: true, name: true, role: true, createdAt: true,
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

        res.json({ message: 'Foydalanuvchi o\'chirildi' })
    } catch (e: any) {
        console.error('delete user error:', e)
        res.status(500).json({ error: 'Server xatoligi' })
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
