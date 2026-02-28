import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import prisma from './utils/db'
import bcrypt from 'bcryptjs'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Routes
import authRoutes from './routes/auth'
import chatRoutes from './routes/chat'
import testRoutes from './routes/tests'
import docRoutes from './routes/documents'
import analyticsRoutes from './routes/analytics'
import profileRoutes from './routes/profile'
import aiSettingsRoutes from './routes/aiSettings'

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() })
})

app.use('/api/auth', authRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/tests', testRoutes)
app.use('/api/documents', docRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/ai-settings', aiSettingsRoutes)

// Static frontend (production)
if (process.env.NODE_ENV === 'production') {
    const frontendDist = path.join(__dirname, '../../frontend/dist')
    app.use(express.static(frontendDist))
    app.get(/.*/, (req, res) => {
        res.sendFile(path.join(frontendDist, 'index.html'))
    })
}

const PORT = process.env.PORT || 8080

async function bootstrap() {
    // Seed admin
    const adminExists = await prisma.user.findUnique({ where: { email: 'admin@msert.uz' } })
    if (!adminExists) {
        const pw = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10)
        await prisma.user.create({
            data: { email: 'admin@msert.uz', password: pw, name: 'Administrator', role: 'ADMIN' }
        })
        console.log('✅ Admin yaratildi: admin@msert.uz')
    }

    app.listen(PORT, () => {
        console.log(`🚀 msert server ishlayapti: port ${PORT}`)
    })
}

bootstrap()
