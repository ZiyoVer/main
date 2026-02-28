import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'

const router = Router()

// Uploads papkasi
const uploadDir = path.join(__dirname, '../../uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
})
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }) // 50MB

// Admin: Fayl yuklash va chunklarga ajratish
router.post('/upload', authenticate, requireRole('ADMIN'), upload.single('file'), async (req: AuthRequest, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Fayl topilmadi' })

        const { subject } = req.body
        const ext = path.extname(req.file.originalname).toLowerCase()

        let text = ''

        // PDF parse
        if (ext === '.pdf') {
            const pdfParse = require('pdf-parse')
            const dataBuffer = fs.readFileSync(req.file.path)
            const data = await pdfParse(dataBuffer)
            text = data.text
        }
        // Word parse
        else if (ext === '.docx' || ext === '.doc') {
            const mammoth = require('mammoth')
            const result = await mammoth.extractRawText({ path: req.file.path })
            text = result.value
        }
        // Plain text
        else if (ext === '.txt') {
            text = fs.readFileSync(req.file.path, 'utf-8')
        }
        else {
            return res.status(400).json({ error: 'Faqat PDF, Word yoki TXT fayllar qo\'llab-quvvatlanadi' })
        }

        if (!text.trim()) {
            return res.status(400).json({ error: 'Fayldan matn o\'qib bo\'lmadi' })
        }

        // Document yozuv
        const doc = await prisma.document.create({
            data: {
                fileName: req.file.originalname,
                fileType: ext.replace('.', ''),
                fileSize: req.file.size,
                subject: subject || null
            }
        })

        // Chunklarga ajratish (500 so'z)
        const words = text.split(/\s+/)
        const chunkSize = 500
        const chunks: string[] = []
        for (let i = 0; i < words.length; i += chunkSize) {
            chunks.push(words.slice(i, i + chunkSize).join(' '))
        }

        // Chunklarni saqlash
        await prisma.documentChunk.createMany({
            data: chunks.map((content, idx) => ({
                documentId: doc.id,
                content,
                chunkIndex: idx
            }))
        })

        // Faylni o'chirish (disk tozalash)
        fs.unlinkSync(req.file.path)

        res.status(201).json({
            message: `Fayl yuklandi: ${chunks.length} chunk saqlandi`,
            document: doc,
            chunksCount: chunks.length
        })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Fayl qayta ishlashda xato' })
    }
})

// Admin: Yuklangan hujjatlar ro'yxati
router.get('/list', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const docs = await prisma.document.findMany({
            include: { _count: { select: { chunks: true } } },
            orderBy: { createdAt: 'desc' }
        })
        res.json(docs)
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Admin: Hujjat o'chirish
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        await prisma.document.delete({ where: { id: req.params.id as string } })
        res.json({ message: 'Hujjat o\'chirildi' })
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

export default router
