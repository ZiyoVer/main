import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'msert-dev-secret'

// Register — faqat STUDENT
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, subject, subject2, examDate, targetScore, examType } = req.body
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Barcha maydonlarni to\'ldiring' })
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Parol kamida 8 ta belgi bo\'lishi kerak' })
        }
        if (!/[a-zA-Z]/.test(password)) {
            return res.status(400).json({ error: 'Parolda kamida bitta harf bo\'lishi kerak' })
        }
        // Email ni kichik harfga normallashtirish
        const normalizedEmail = email.trim().toLowerCase()
        const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
        if (existing) return res.status(400).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tilgan' })

        const hashed = await bcrypt.hash(password, 12)
        const user = await prisma.user.create({
            data: { email: normalizedEmail, password: hashed, name: name.trim(), role: 'STUDENT' }
        })

        // Profil yaratish — ro'yxatdan o'tishda to'ldirilgan ma'lumotlar bilan
        await prisma.studentProfile.create({
            data: {
                userId: user.id,
                subject: subject || null,
                examType: examType || null,
                examDate: examDate ? new Date(examDate) : null,
                targetScore: targetScore ? parseInt(targetScore) : null,
                onboardingDone: !!(subject && examDate),
            }
        })

        // Visit log
        await prisma.visitLog.create({ data: { userId: user.id, action: 'register' } })

        res.status(201).json({ message: 'Muvaffaqiyatli ro\'yxatdan o\'tdingiz' })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body
        const user = await prisma.user.findUnique({ where: { email: email?.trim().toLowerCase() } })
        if (!user) return res.status(400).json({ error: 'Email yoki parol xato' })

        const valid = await bcrypt.compare(password, user.password)
        if (!valid) return res.status(400).json({ error: 'Email yoki parol xato' })

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' })

        // Visit log
        await prisma.visitLog.create({ data: { userId: user.id, action: 'login' } })

        res.json({
            token,
            user: { id: user.id, email: user.email, name: user.name, role: user.role }
        })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
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

        const hashed = await bcrypt.hash(password, 12)
        await prisma.user.create({
            data: { email: teacherEmail, password: hashed, name: name.trim(), role: 'TEACHER' }
        })
        res.status(201).json({ message: 'O\'qituvchi yaratildi' })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Admin: Barcha foydalanuvchilar
router.get('/users', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, email: true, name: true, role: true, createdAt: true },
            orderBy: { createdAt: 'desc' }
        })
        res.json(users)
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

export default router
