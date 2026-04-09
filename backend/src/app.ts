import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import prisma from './utils/db'
import bcrypt from 'bcryptjs'
import { optionalAuthenticate } from './middleware/auth'

dotenv.config()

// Muhim env varlarni tekshirish
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'ADMIN_PASSWORD', 'ADMIN_EMAIL']
for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        console.error(`❌ Muhim env var topilmadi: ${key}`)
        process.exit(1)
    }
}
if (process.env.JWT_SECRET === 'dtmmax-dev-secret') {
    console.error('❌ JWT_SECRET hali dev qiymati bilan turibdi! O\'zgartiring.')
    process.exit(1)
}
if (process.env.JWT_SECRET!.length < 32) {
    console.error('❌ JWT_SECRET kamida 32 ta belgi bo\'lishi kerak! Hozir:', process.env.JWT_SECRET!.length, 'ta belgi.')
    process.exit(1)
}

const app = express()

function getRateLimitKey(req: express.Request): string {
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim()
        if (token) {
            return `token:${crypto.createHash('sha256').update(token).digest('hex')}`
        }
    }
    return ipKeyGenerator(req.ip || req.socket.remoteAddress || '')
}

// Railway va boshqa reverse proxy-lar uchun trust proxy
app.set('trust proxy', 1)

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            connectSrc: ["'self'", 'https://api.deepseek.com', 'https://api.openai.com'],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
        }
    }
}))

// CORS — faqat o'z domenimiz
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000']

app.use(cors({
    origin: (origin, cb) => {
        // Same-origin (origin yo'q) — to'g'ridan-to'g'ri ruxsat
        if (!origin) return cb(null, true)

        // Aniq mos kelish tekshiruvi (startsWith zaif — dtmmax.uz.evil.com ni o'tkazib yuboradi)
        if (allowedOrigins.some(o => origin === o)) {
            return cb(null, true)
        }

        // Railway ichki URL lari — *.up.railway.app
        // Xavfsiz: faqat exactly *.up.railway.app domenlar, localhost emas
        try {
            const parsed = new URL(origin)
            if (parsed.hostname.endsWith('.up.railway.app')) {
                return cb(null, true)
            }
        } catch { /* noto'g'ri URL */ }

        return cb(null, false)
    },
    credentials: true
}))

app.use(express.json({ limit: '10mb' }))

// Umumiy API uchun rate limiting
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    message: { error: 'Juda ko\'p so\'rov. Biroz kuting.' },
    keyGenerator: getRateLimitKey,
    standardHeaders: true,
    legacyHeaders: false,
})

// Routes
import authRoutes from './routes/auth'
import chatRoutes from './routes/chat'
import testRoutes from './routes/tests'
import docRoutes from './routes/documents'
import analyticsRoutes from './routes/analytics'
import profileRoutes from './routes/profile'
import aiSettingsRoutes from './routes/aiSettings'
import progressRoutes from './routes/progress'
import flashcardsRoutes from './routes/flashcards'
import mockExamRoutes from './routes/mockExam'
import notificationsRoutes from './routes/notifications'
import knowledgeRoutes from './routes/knowledge'

app.get('/api/health', async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`
        res.json({ status: 'ok', db: 'ok', time: new Date().toISOString() })
    } catch {
        res.status(500).json({ status: 'error', db: 'fail' })
    }
})

app.use('/api/auth', authRoutes)
app.use('/api/chat', optionalAuthenticate, apiLimiter, chatRoutes)
app.use('/api/tests', optionalAuthenticate, apiLimiter, testRoutes)
app.use('/api/documents', optionalAuthenticate, apiLimiter, docRoutes)
app.use('/api/analytics', optionalAuthenticate, apiLimiter, analyticsRoutes)
app.use('/api/profile', optionalAuthenticate, apiLimiter, profileRoutes)
app.use('/api/ai-settings', optionalAuthenticate, apiLimiter, aiSettingsRoutes)
app.use('/api/progress', optionalAuthenticate, apiLimiter, progressRoutes)
app.use('/api/flashcards', optionalAuthenticate, apiLimiter, flashcardsRoutes)
app.use('/api/mock-exam', optionalAuthenticate, apiLimiter, mockExamRoutes)
app.use('/api/notifications', optionalAuthenticate, apiLimiter, notificationsRoutes)
app.use('/api/knowledge', optionalAuthenticate, apiLimiter, knowledgeRoutes)

// 404 handler (API)
app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint topilmadi' })
})

// Static frontend — NODE_ENV ga bog'liq emas, dist mavjud bo'lsa serve qiladi
const frontendDist = path.join(__dirname, '../../frontend/dist')
if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist))
    app.get(/.*/, (_req, res) => {
        res.sendFile(path.join(frontendDist, 'index.html'))
    })
}

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (process.env.NODE_ENV !== 'production') console.error(err)
    res.status(err.status || 500).json({ error: err.message || 'Server xatoligi' })
})

const PORT = process.env.PORT || 8080

async function bootstrap() {
    const adminEmail = process.env.ADMIN_EMAIL!
    const adminExists = await prisma.user.findUnique({ where: { email: adminEmail } })
    if (!adminExists) {
        const pw = await bcrypt.hash(process.env.ADMIN_PASSWORD!, 10)
        await prisma.user.create({
            data: { email: adminEmail, password: pw, name: 'Administrator', role: 'ADMIN' }
        })
        console.log('✅ Admin yaratildi')
    } else {
        // Parol env var bilan mos kelmasligini tekshirib, yangilaymiz
        const passwordMatch = await bcrypt.compare(process.env.ADMIN_PASSWORD!, adminExists.password)
        if (!passwordMatch) {
            const pw = await bcrypt.hash(process.env.ADMIN_PASSWORD!, 10)
            await prisma.user.update({ where: { email: adminEmail }, data: { password: pw } })
            console.log('✅ Admin paroli yangilandi')
        }
    }

    const server = app.listen(PORT, () => {
        console.log(`🚀 DTMMax server: port ${PORT}`)
    })

    // Graceful shutdown
    const shutdown = async () => {
        server.close(async () => {
            await prisma.$disconnect()
            process.exit(0)
        })
    }
    process.on('SIGTERM', shutdown)
    process.on('SIGINT', shutdown)
}

bootstrap().catch(e => { console.error(e); process.exit(1) })
