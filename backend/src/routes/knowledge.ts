import { Router } from 'express'
import multer from 'multer'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'
import { SUBJECTS, isCanonicalSubject, normalizeSubject } from '../utils/subjects'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } })

// GET /api/knowledge — barchasi (admin)
router.get('/', authenticate, requireRole('ADMIN'), async (_req, res) => {
  const items = await prisma.knowledgeItem.findMany({
    orderBy: [{ subject: 'asc' }, { createdAt: 'desc' }]
  })
  res.json(items)
})

// GET /api/knowledge/subjects — fanlar ro'yxati
router.get('/subjects', async (_req, res) => {
  res.json(SUBJECTS)
})

// POST /api/knowledge — yangi qo'shish (admin)
router.post('/', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { subject, title, content, source } = req.body
    const normalizedSubject = normalizeSubject(subject)
    if (!subject || !title?.trim() || !content?.trim()) {
      return res.status(400).json({ error: 'subject, title, content kerak' })
    }
    if (!isCanonicalSubject(normalizedSubject)) {
      return res.status(400).json({ error: "Noto'g'ri fan nomi" })
    }
    const item = await prisma.knowledgeItem.create({
      data: { subject: normalizedSubject, title: title.trim(), content: content.trim(), source: source?.trim() || null }
    })
    res.json(item)
  } catch (e: any) {
    console.error('knowledge POST error:', e)
    res.status(500).json({ error: 'Server xatoligi' })
  }
})

// PUT /api/knowledge/:id — tahrirlash (admin)
router.put('/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { subject, title, content, source } = req.body
    const normalizedSubject = subject !== undefined ? normalizeSubject(subject) : undefined
    if (subject !== undefined && !isCanonicalSubject(normalizedSubject)) {
      return res.status(400).json({ error: "Noto'g'ri fan nomi" })
    }
    const item = await prisma.knowledgeItem.update({
      where: { id: String(req.params.id) },
      data: {
        subject: normalizedSubject || undefined,
        title: title?.trim() || undefined,
        content: content?.trim() || undefined,
        source: source?.trim() ?? undefined
      }
    })
    res.json(item)
  } catch (e: any) {
    console.error('knowledge PUT error:', e)
    res.status(500).json({ error: 'Server xatoligi' })
  }
})

// DELETE /api/knowledge/:id — o'chirish (admin)
router.delete('/:id', authenticate, requireRole('ADMIN'), async (_req, res) => {
  await prisma.knowledgeItem.delete({ where: { id: String(_req.params.id) } })
  res.json({ ok: true })
})

// POST /api/knowledge/pdf-import — PDF/docx dan matn olib knowledge item yaratish
router.post('/pdf-import', authenticate, requireRole('ADMIN'), upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fayl yuklanmadi' })
    const { subject, title, source } = req.body
    const normalizedSubject = normalizeSubject(subject)
    if (!subject || !title?.trim()) {
      return res.status(400).json({ error: 'subject va title kerak' })
    }
    if (!isCanonicalSubject(normalizedSubject)) {
      return res.status(400).json({ error: "Noto'g'ri fan nomi" })
    }

    const ext = req.file.originalname.split('.').pop()?.toLowerCase()
    let text = ''

    if (ext === 'pdf') {
      const data = await pdfParse(req.file.buffer)
      text = data.text
    } else if (ext === 'docx' || ext === 'doc') {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer })
      text = result.value
    } else if (ext === 'txt') {
      text = req.file.buffer.toString('utf-8')
    } else {
      return res.status(400).json({ error: 'Faqat PDF, Word yoki TXT fayllar' })
    }

    if (!text.trim()) {
      return res.status(400).json({ error: 'Fayldan matn o\'qib bo\'lmadi. Skanerdan o\'tkazilgan PDF bo\'lmasin.' })
    }

    // Har bir 4000 belgilik bo'lakka ajratib, alohida knowledge item sifatida saqlash
    const CHUNK_SIZE = 4000
    const cleanText = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    const chunks: string[] = []
    for (let i = 0; i < cleanText.length; i += CHUNK_SIZE) {
      const chunk = cleanText.slice(i, i + CHUNK_SIZE).trim()
      if (chunk.length > 100) chunks.push(chunk)
    }

    if (chunks.length === 0) {
      return res.status(400).json({ error: 'Fayldan yetarli matn topilmadi' })
    }

    // Barcha chunklarni knowledge item sifatida saqlaymiz
    const items = await Promise.all(chunks.map((content, idx) =>
      prisma.knowledgeItem.create({
        data: {
          subject: normalizedSubject,
          title: chunks.length === 1 ? title.trim() : `${title.trim()} (${idx + 1}/${chunks.length})`,
          content,
          source: source?.trim() || req.file!.originalname
        }
      })
    ))

    res.json({
      ok: true,
      created: items.length,
      totalChars: cleanText.length,
      message: `${items.length} ta bo'lak yaratildi (${Math.round(cleanText.length / 1000)}K belgi)`
    })
  } catch (e: any) {
    console.error('knowledge pdf-import error:', e)
    res.status(500).json({ error: 'Fayl qayta ishlashda xato: ' + e.message })
  }
})

export default router
