import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import dns from 'dns/promises'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'
import { tokenBlacklist } from '../utils/tokenBlacklist'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'ballmax-dev-secret'

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
        const user = await prisma.user.create({
            data: { email: normalizedEmail, password: hashed, name: name.trim(), role: 'STUDENT' }
        })

        // Profil yaratish
        await prisma.studentProfile.create({
            data: {
                userId: user.id,
                subject: subject || null,
                examType: examType || null,
                examDate: examDate ? new Date(examDate) : null,
                targetScore: targetScore ? parseInt(targetScore) : null,
                // Ro'yxatdan o'tgan — onboarding tugagan deb hisoblaymiz
                // (kerak bo'lsa sozlamalardan o'zgartiradi)
                onboardingDone: true,
            }
        })

        // Visit log
        await prisma.visitLog.create({ data: { userId: user.id, action: 'register' } })

        // Token darhol qaytaramiz — alohida login chaqiruvi shart emas
        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' })

        res.status(201).json({
            token,
            user: { id: user.id, email: user.email, name: user.name, role: user.role }
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
            user: { id: user.id, email: user.email, name: user.name, role: user.role }
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
            select: { id: true, email: true, name: true, role: true },
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
