import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../utils/db'
import { authenticate, AuthRequest } from '../middlewares/authMiddleware'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev'

router.post('/register', async (req, res) => {
    try {
        const { email, password, name, role } = req.body

        const existing = await prisma.user.findUnique({ where: { email } })
        if (existing) {
            return res.status(400).json({ error: "Email allaqachon band" })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const userRole = role === 'TEACHER' ? 'TEACHER' : role === 'ADMIN' ? 'ADMIN' : 'STUDENT'

        const user = await prisma.user.create({
            data: { email, name, password: hashedPassword, role: userRole }
        })

        if (userRole === 'STUDENT') {
            await prisma.studentProfile.create({
                data: { userId: user.id, schoolGrade: '', targetGrade: '', studyTime: '' }
            })
        }

        res.status(201).json({ message: "Muvaffaqiyatli ro'yxatdan o'tdingiz" })
    } catch (e) {
        res.status(500).json({ error: "Server xatoligi" })
    }
})

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return res.status(400).json({ error: "Email yoki parol xato" })

        const valid = await bcrypt.compare(password, user.password)
        if (!valid) return res.status(400).json({ error: "Email yoki parol xato" })

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' })

        res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } })
    } catch (e) {
        res.status(500).json({ error: "Server xatoligi" })
    }
})

router.get('/me', authenticate, async (req: AuthRequest, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, email: true, name: true, role: true }
        })
        res.json(user)
    } catch (e) {
        res.status(500).json({ error: "Server xatoligi" })
    }
})

export default router
