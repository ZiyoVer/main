import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import dns from 'dns/promises'
import crypto from 'crypto'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'
import { tokenBlacklist } from '../utils/tokenBlacklist'
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET!

// Register — faqat STUDENT, token qaytaradi (alohida login shart emas)
router.post('/register', async (req, res) => {
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

        // --- B-VARIANT: DOMEN TEKSHIRUVI (MX Records) ---
        const domain = normalizedEmail.split('@')[1];
        try {
            const mxRecords = await dns.resolveMx(domain);
            if (!mxRecords || mxRecords.length === 0) {
                return res.status(400).json({ error: 'Bunday email domen mavjud emas yoxud xat qabul qila olmaydi.' })
            }
        } catch (dnsErr) {
            return res.status(400).json({ error: 'Email domenini (masalan @gmail.com) tasdiqlab bo\'lmadi. Haqiqiy email kiriting.' })
        }

        const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
        if (existing) return res.status(400).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tilgan' })

        // bcrypt cost 10 — tez va xavfsiz
        const hashed = await bcrypt.hash(password, 10)
        const verificationToken = crypto.randomBytes(32).toString('hex')
        const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 soat

        const user = await prisma.user.create({
            data: {
                email: normalizedEmail,
                password: hashed,
                name: name.trim(),
                role: 'STUDENT',
                emailVerified: false,
                verificationToken,
                verificationTokenExpiry,
            }
        })

        // Profil yaratish
        await prisma.studentProfile.create({
            data: {
                userId: user.id,
                subject: subject || null,
                examType: examType || null,
                examDate: examDate ? new Date(examDate) : null,
                targetScore: targetScore ? parseInt(targetScore) : null,
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
        res.status(500).json({ error: 'Server xatoligi. Qayta urinib ko\'ring.' })
    }
})

// Email mavjudligini tekshirish (register step 1 uchun)
router.get('/check-email', async (req, res) => {
    try {
        const email = (req.query.email as string)?.trim().toLowerCase()
        if (!email) return res.json({ available: true })
        const existing = await prisma.user.findUnique({ where: { email } })
        res.json({ available: !existing })
    } catch {
        res.json({ available: true })
    }
})

// Login
router.post('/login', async (req, res) => {
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
        if (password.length < 8) {
            return res.status(400).json({ error: 'Parol kamida 8 ta belgi bo\'lishi kerak' })
        }
        if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
            return res.status(400).json({ error: 'Parolda kamida bitta harf va bitta raqam bo\'lishi shart' })
        }
        const teacherEmail = email?.trim().toLowerCase()
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
        const skip = (page - 1) * limit

        const where = search ? {
            OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } }
            ]
        } : {}

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: { id: true, email: true, name: true, role: true, createdAt: true },
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

// Email tasdiqlash — token orqali
router.get('/verify-email/:token', async (req, res) => {
    try {
        const { token } = req.params
        if (!token || token.length !== 64) {
            return res.status(400).json({ error: 'Noto\'g\'ri tasdiqlash havolasi' })
        }
        const user = await prisma.user.findUnique({ where: { verificationToken: token } })
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
router.post('/resend-verification', authenticate, async (req: AuthRequest, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } })
        if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' })
        if (user.emailVerified) return res.status(400).json({ error: 'Email allaqachon tasdiqlangan' })

        const verificationToken = crypto.randomBytes(32).toString('hex')
        const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
        await prisma.user.update({
            where: { id: user.id },
            data: { verificationToken, verificationTokenExpiry }
        })
        await sendVerificationEmail(user.email, user.name, verificationToken)
        res.json({ message: 'Tasdiqlash emaili yuborildi' })
    } catch (e) {
        console.error('resend-verification error:', e)
        res.status(500).json({ error: 'Email yuborishda xato. Qayta urinib ko\'ring.' })
    }
})

// Parolni unutdim — reset email yuborish
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body
        if (!email) return res.status(400).json({ error: 'Email manzil kiritilmagan' })
        const normalizedEmail = email.trim().toLowerCase()
        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
        // Xavfsizlik: topilmasa ham muvaffaqiyatli javob qaytaramiz
        if (!user) return res.json({ message: 'Agar bu email ro\'yxatda bo\'lsa, parol tiklash havolasi yuborildi.' })

        const resetToken = crypto.randomBytes(32).toString('hex')
        const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 soat
        await prisma.user.update({
            where: { id: user.id },
            data: { resetToken, resetTokenExpiry }
        })
        await sendPasswordResetEmail(user.email, user.name, resetToken)
        res.json({ message: 'Agar bu email ro\'yxatda bo\'lsa, parol tiklash havolasi yuborildi.' })
    } catch (e) {
        console.error('forgot-password error:', e)
        res.status(500).json({ error: 'Email yuborishda xato. Qayta urinib ko\'ring.' })
    }
})

// Parolni tiklash — token + yangi parol
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body
        if (!token || !password) return res.status(400).json({ error: 'Token va yangi parol kiritilmagan' })
        if (password.length < 8) return res.status(400).json({ error: 'Parol kamida 8 ta belgi bo\'lishi kerak' })
        if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
            return res.status(400).json({ error: 'Parolda kamida bitta harf va bitta raqam bo\'lishi shart' })
        }

        const user = await prisma.user.findUnique({ where: { resetToken: token } })
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

// Logout — token ni blacklist ga qo'shish
router.post('/logout', authenticate, async (req: AuthRequest, res) => {
    try {
        const authHeader = req.headers.authorization
        if (authHeader) {
            const token = authHeader.split(' ')[1]
            tokenBlacklist.add(token)
        }
        res.json({ message: 'Tizimdan chiqdingiz' })
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

export default router
