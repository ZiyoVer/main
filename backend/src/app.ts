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

const PORT = process.env.PORT || 8080
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`)
})
