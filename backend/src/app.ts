import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import path from 'path'
import prisma from './utils/db'
import bcrypt from 'bcryptjs'

dotenv.config()

// Muhim env varlarni tekshirish
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'OPENAI_API_KEY']
for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        console.error(`❌ Muhim env var topilmadi: ${key}`)
        process.exit(1)
    }
}
if (process.env.JWT_SECRET === 'msert-dev-secret') {
    console.error('❌ JWT_SECRET hali dev qiymati bilan turibdi! O\'zgartiring.')
    process.exit(1)
}

const app = express()

// Security headers
app.use(helmet({ contentSecurityPolicy: false }))

// CORS — faqat o'z domenimiz
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000']

app.use(cors({
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.some(o => origin.startsWith(o))) return cb(null, true)
        cb(new Error('CORS: ruxsat berilmagan domen'))
    },
    credentials: true
}))

app.use(express.json({ limit: '10mb' }))

// Auth endpointlari uchun rate limiting (brute force himoyasi)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 daqiqa
    max: 20,
    message: { error: 'Juda ko\'p urinish. 15 daqiqadan keyin qayta urinib ko\'ring.' },
    standardHeaders: true,
    legacyHeaders: false,
})

// Fayl yuklash uchun rate limiting
const uploadLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 daqiqa
    max: 10,
    message: { error: 'Fayl yuklash limiti. Bir daqiqadan keyin qayta urinib ko\'ring.' },
})

// Umumiy API uchun rate limiting
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    message: { error: 'Juda ko\'p so\'rov. Biroz kuting.' },
})

// Routes
import authRoutes from './routes/auth'
import chatRoutes from './routes/chat'
import testRoutes from './routes/tests'
import docRoutes from './routes/documents'
import analyticsRoutes from './routes/analytics'
import profileRoutes from './routes/profile'
import aiSettingsRoutes from './routes/aiSettings'

app.get('/api/health', async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`
        res.json({ status: 'ok', db: 'ok', time: new Date().toISOString() })
    } catch {
        res.status(500).json({ status: 'error', db: 'fail' })
    }
})

app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/chat', apiLimiter, chatRoutes)
app.use('/api/tests', apiLimiter, testRoutes)
app.use('/api/documents', uploadLimiter, docRoutes)
app.use('/api/analytics', apiLimiter, analyticsRoutes)
app.use('/api/profile', apiLimiter, profileRoutes)
app.use('/api/ai-settings', apiLimiter, aiSettingsRoutes)

// 404 handler (API)
app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint topilmadi' })
})

// Static frontend (production)
if (process.env.NODE_ENV === 'production') {
    const frontendDist = path.join(__dirname, '../../frontend/dist')
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
    const adminExists = await prisma.user.findUnique({ where: { email: 'admin@msert.uz' } })
    if (!adminExists) {
        const pw = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10)
        await prisma.user.create({
            data: { email: 'admin@msert.uz', password: pw, name: 'Administrator', role: 'ADMIN' }
        })
        console.log('✅ Admin yaratildi')
    }

    const server = app.listen(PORT, () => {
        console.log(`🚀 msert server: port ${PORT}`)
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
