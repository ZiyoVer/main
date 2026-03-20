import { Router } from 'express'
import multer from 'multer'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'
import { createEmbedding, createEmbeddings, hasEmbeddingClient, serializeEmbedding } from '../utils/embeddings'
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
    let embedding: number[] | null = null
    try {
      embedding = await createEmbedding(`${title.trim()}\n\n${content.trim()}`)
    } catch (embeddingErr) {
      console.error('knowledge POST embedding error:', embeddingErr)
    }
    const item = await prisma.knowledgeItem.create({
      data: {
        subject: normalizedSubject,
        title: title.trim(),
        content: content.trim(),
        source: source?.trim() || null,
        embedding: embedding ? serializeEmbedding(embedding) : null
      }
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
    const nextTitle = title?.trim()
    const nextContent = content?.trim()
    const existingItem = await prisma.knowledgeItem.findUnique({ where: { id: String(req.params.id) } })
    if (!existingItem) return res.status(404).json({ error: 'Item topilmadi' })

    const finalTitle = nextTitle || existingItem.title
    const finalContent = nextContent || existingItem.content
    let embedding: number[] | null = null
    try {
      embedding = await createEmbedding(`${finalTitle}\n\n${finalContent}`)
    } catch (embeddingErr) {
      console.error('knowledge PUT embedding error:', embeddingErr)
    }

    const item = await prisma.knowledgeItem.update({
      where: { id: String(req.params.id) },
      data: {
        subject: normalizedSubject || undefined,
        title: finalTitle,
        content: finalContent,
        source: source?.trim() ?? undefined,
        embedding: embedding ? serializeEmbedding(embedding) : existingItem.embedding
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

// POST /api/knowledge/backfill-embeddings — eski knowledge itemlar uchun embedding yaratish
router.post('/backfill-embeddings', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    if (!hasEmbeddingClient()) {
      return res.status(400).json({ error: 'OpenAI embedding client ulanmagan' })
    }

    const rawLimit = parseInt(req.query.limit as string) || 100
    const limit = Math.min(Math.max(rawLimit, 1), 200)
    const where = { OR: [{ embedding: null }, { embedding: '' }] }

    const items = await prisma.knowledgeItem.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true, title: true, content: true }
    })

    if (items.length === 0) {
      return res.json({ updated: 0, remaining: 0 })
    }

    const embeddings = await createEmbeddings(items.map(item => `${item.title}\n\n${item.content}`))
    if (!embeddings?.length) {
      return res.status(500).json({ error: 'Embedding yaratib bo\'lmadi' })
    }

    let updated = 0
    await Promise.all(items.map((item, index) => {
      const vector = embeddings[index]
      if (!vector) return Promise.resolve()
      updated++
      return prisma.knowledgeItem.update({
        where: { id: item.id },
        data: { embedding: serializeEmbedding(vector) }
      })
    }))

    const remaining = await prisma.knowledgeItem.count({ where })
    res.json({ updated, remaining })
  } catch (e: any) {
    console.error('knowledge backfill embeddings error:', e)
    res.status(500).json({ error: 'Embedding backfill xatoligi' })
  }
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
    const titles = chunks.map((_, idx) => chunks.length === 1 ? title.trim() : `${title.trim()} (${idx + 1}/${chunks.length})`)
    let embeddings: Array<string | null> = chunks.map(() => null)
    try {
      const vectors = await createEmbeddings(chunks.map((content, idx) => `${titles[idx]}\n\n${content}`))
      if (vectors?.length) {
        embeddings = chunks.map((_, idx) => vectors[idx] ? serializeEmbedding(vectors[idx]) : null)
      }
    } catch (embeddingErr) {
      console.error('knowledge embedding error:', embeddingErr)
    }

    const items = await Promise.all(chunks.map((content, idx) =>
      prisma.knowledgeItem.create({
        data: {
          subject: normalizedSubject,
          title: titles[idx],
          content,
          source: source?.trim() || req.file!.originalname,
          embedding: embeddings[idx]
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
