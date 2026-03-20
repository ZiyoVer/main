import { Router } from 'express'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import path from 'path'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'
import { uploadToS3, deleteFromS3, getSignedS3Url } from '../utils/s3'
import { createEmbeddings, hasEmbeddingClient, serializeEmbedding } from '../utils/embeddings'
import { normalizeSubject } from '../utils/subjects'

const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Fayl yuklash limiti. Bir daqiqadan keyin qayta urinib ko\'ring.' },
})

const router = Router()

// Memory storage — faylni S3 ga yuboramiz, diskka emas
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
})

const uploadSingle = (req: any, res: any, next: any) => {
    upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: `Fayl yuklashda xato: ${err.message}` });
        } else if (err) {
            return res.status(500).json({ error: err.message || 'Noma\'lum yuklash xatosi' });
        }
        next();
    });
};

// Admin: Fayl yuklash va chunklarga ajratish
router.post('/upload', authenticate, requireRole('ADMIN'), uploadLimiter, uploadSingle, async (req: AuthRequest, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Fayl topilmadi' })

        const { subject } = req.body
        const normalizedSubject = normalizeSubject(subject)
        const ext = path.extname(req.file.originalname).toLowerCase()
        const buffer = req.file.buffer

        let text = ''

        // PDF parse
        if (ext === '.pdf') {
            const pdfParse = require('pdf-parse')
            const data = await pdfParse(buffer)
            text = data.text
        }
        // Word parse
        else if (ext === '.docx' || ext === '.doc') {
            const mammoth = require('mammoth')
            const result = await mammoth.extractRawText({ buffer })
            text = result.value
        }
        // Plain text
        else if (ext === '.txt') {
            text = buffer.toString('utf-8')
        }
        else {
            return res.status(400).json({ error: 'Faqat PDF, Word yoki TXT fayllar qo\'llab-quvvatlanadi' })
        }

        if (!text.trim()) {
            return res.status(400).json({ error: 'Fayldan matn o\'qib bo\'lmadi' })
        }

        // S3 ga yuklash
        let s3Url = ''
        let s3Key = ''
        let s3Warning = ''
        try {
            const s3Result = await uploadToS3(buffer, req.file.originalname, 'documents')
            s3Url = s3Result.url
            s3Key = s3Result.key
        } catch (e) {
            console.error('S3 upload error:', e)
            s3Warning = 'Fayl S3\'ga yuklanmadi — matn chunklari saqlanadi, lekin fayl yuklab olish imkoni bo\'lmaydi.'
        }

        // Document yozuv
        const doc = await prisma.document.create({
            data: {
                fileName: req.file.originalname,
                fileType: ext.replace('.', ''),
                fileSize: req.file.size,
                subject: normalizedSubject,
                s3Url: s3Url || null,
                s3Key: s3Key || null
            }
        })

        // Chunklarga ajratish — jumlalar bo'yicha (RAG sifati uchun yaxshiroq)
        const sentences = text
            .replace(/([.!?])\s+/g, '$1\n')
            .split('\n')
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 10)

        const chunks: string[] = []
        let current = ''
        for (const sentence of sentences) {
            if ((current + ' ' + sentence).split(/\s+/).length > 500) {
                if (current) chunks.push(current.trim())
                current = sentence
            } else {
                current = current ? current + ' ' + sentence : sentence
            }
        }
        if (current.trim()) chunks.push(current.trim())

        let chunkEmbeddings: Array<string | null> = chunks.map(() => null)
        try {
            const embeddings = await createEmbeddings(chunks)
            if (embeddings?.length) {
                chunkEmbeddings = chunks.map((_, idx) => embeddings[idx] ? serializeEmbedding(embeddings[idx]) : null)
            }
        } catch (embeddingError) {
            console.error('Document embedding error:', embeddingError)
        }

        // Chunklarni saqlash
        await prisma.documentChunk.createMany({
            data: chunks.map((content, idx) => ({
                documentId: doc.id,
                content,
                chunkIndex: idx,
                embedding: chunkEmbeddings[idx]
            }))
        })

        res.status(201).json({
            message: `Fayl yuklandi: ${chunks.length} chunk saqlandi`,
            document: doc,
            chunksCount: chunks.length,
            s3Url: s3Key ? await getSignedS3Url(s3Key) : s3Url,
            ...(s3Warning && { warning: s3Warning })
        })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Fayl qayta ishlashda xato' })
    }
})

// Chat uchun fayl/rasm yuklash
router.post('/chat-upload', authenticate, uploadSingle, async (req: AuthRequest, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Fayl topilmadi' })

        const ext = path.extname(req.file.originalname).toLowerCase()
        const ALLOWED_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.doc', '.docx', '.txt', '.mp4', '.mp3']
        if (!ALLOWED_EXTS.includes(ext)) {
            return res.status(400).json({ error: 'Bu fayl turi ruxsat etilmagan' })
        }
        const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)
        const folder = isImage ? 'chat-images' : 'chat-files'

        const s3Result = await uploadToS3(req.file.buffer, req.file.originalname, folder)

        res.json({
            url: await getSignedS3Url(s3Result.key),
            storageUrl: s3Result.url,
            key: s3Result.key,
            fileName: req.file.originalname,
            fileType: isImage ? 'image' : ext.replace('.', ''),
            fileSize: req.file.size
        })
    } catch (e) {
        console.error('Chat upload error:', e)
        res.status(500).json({ error: 'Fayl yuklashda xato' })
    }
})

// Admin: eski document chunklar uchun embedding backfill
router.post('/backfill-embeddings', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        if (!hasEmbeddingClient()) {
            return res.status(400).json({ error: 'OpenAI embedding client ulanmagan' })
        }

        const rawLimit = parseInt(req.query.limit as string) || 100
        const limit = Math.min(Math.max(rawLimit, 1), 200)
        const where = { OR: [{ embedding: null }, { embedding: '' }] }

        const chunks = await prisma.documentChunk.findMany({
            where,
            orderBy: { createdAt: 'asc' },
            take: limit,
            select: { id: true, content: true }
        })

        if (chunks.length === 0) {
            return res.json({ updated: 0, remaining: 0 })
        }

        const embeddings = await createEmbeddings(chunks.map(chunk => chunk.content))
        if (!embeddings?.length) {
            return res.status(500).json({ error: 'Embedding yaratib bo\'lmadi' })
        }

        let updated = 0
        await Promise.all(chunks.map((chunk, index) => {
            const vector = embeddings[index]
            if (!vector) return Promise.resolve()
            updated++
            return prisma.documentChunk.update({
                where: { id: chunk.id },
                data: { embedding: serializeEmbedding(vector) }
            })
        }))

        const remaining = await prisma.documentChunk.count({ where })
        res.json({ updated, remaining })
    } catch (e) {
        console.error('document embedding backfill error:', e)
        res.status(500).json({ error: 'Embedding backfill xatoligi' })
    }
})

// Admin: Yuklangan hujjatlar ro'yxati
router.get('/list', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const docs = await prisma.document.findMany({
            include: { _count: { select: { chunks: true } } },
            orderBy: { createdAt: 'desc' }
        })
        res.json(docs.map(doc => ({
            ...doc,
            hasFile: Boolean(doc.s3Key || doc.s3Url)
        })))
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Admin: Private hujjat uchun yangi signed URL olish
router.get('/:id/download-url', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const doc = await prisma.document.findUnique({ where: { id: req.params.id as string } })
        if (!doc) return res.status(404).json({ error: 'Hujjat topilmadi' })

        const url = doc.s3Key ? await getSignedS3Url(doc.s3Key) : doc.s3Url
        if (!url) return res.status(404).json({ error: 'Bu hujjat uchun yuklab olish manzili yo\'q' })

        res.json({
            url,
            fileName: doc.fileName
        })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Admin: Hujjat o'chirish
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        // S3 dan ham o'chirish
        const doc = await prisma.document.findUnique({ where: { id: req.params.id as string } })
        if (doc?.s3Key) {
            try { await deleteFromS3(doc.s3Key) } catch { }
        }
        await prisma.document.delete({ where: { id: req.params.id as string } })
        res.json({ message: 'Hujjat o\'chirildi' })
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

export default router
