import { Router } from 'express'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'

const router = Router()

const SUBJECTS = ['Matematika', 'Fizika', 'Kimyo', 'Biologiya', 'Ona tili', 'Tarix', 'Ingliz tili', 'Geografiya']

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
    if (!subject || !title?.trim() || !content?.trim()) {
      return res.status(400).json({ error: 'subject, title, content kerak' })
    }
    if (!SUBJECTS.includes(subject)) {
      return res.status(400).json({ error: "Noto'g'ri fan nomi" })
    }
    const item = await prisma.knowledgeItem.create({
      data: { subject, title: title.trim(), content: content.trim(), source: source?.trim() || null }
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
    const item = await prisma.knowledgeItem.update({
      where: { id: String(req.params.id) },
      data: {
        subject: subject || undefined,
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

export default router
