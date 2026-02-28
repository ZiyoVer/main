import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

import authRoutes from './routes/auth'
import testRoutes from './routes/test'
import chatRoutes from './routes/chat'

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)
app.use('/api/tests', testRoutes)
app.use('/api/chat', chatRoutes)
// Serve React Frontend in Production
if (process.env.NODE_ENV === 'production') {
    const frontendDistPath = path.join(__dirname, '../../frontend/dist')
    app.use(express.static(frontendDistPath))

    app.get(/.*/, (req, res) => {
        res.sendFile(path.join(frontendDistPath, 'index.html'))
    })
}

import prisma from './utils/db'
import bcrypt from 'bcryptjs'

const PORT = process.env.PORT || 8080

async function bootstrap() {
    // Ensure default admin exists
    const adminExists = await prisma.user.findUnique({ where: { email: 'admin@msert.uz' } })
    if (!adminExists) {
        const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123'
        const hashedPassword = await bcrypt.hash(defaultPassword, 10)
        await prisma.user.create({
            data: {
                name: 'Asosiy Administrator',
                email: 'admin@msert.uz',
                password: hashedPassword,
                role: 'ADMIN'
            }
        })
        console.log('Seeded default admin: admin@msert.uz')
    }

    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`)
    })
}

bootstrap()
