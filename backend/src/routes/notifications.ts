import { Router } from 'express'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// GET /api/notifications — o'z bildirishnomalarini olish (student)
// count: faqat ?count=true bo'lsa o'qilmagan sonini qaytaradi
router.get('/', async (req: AuthRequest, res) => {
  const userId = req.user.id
  const countOnly = req.query.count === 'true'

  if (countOnly) {
    const count = await prisma.notification.count({ where: { userId, isRead: false } })
    return res.json({ count })
  }

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { sender: { select: { name: true, role: true } } }
  })
  res.json(notifications)
})

// PATCH /api/notifications/read-all — barchasini o'qilgan deb belgilash
// Bu route /:id/read dan OLDIN bo'lishi kerak, aks holda "read-all" id sifatida tushadi
router.patch('/read-all', async (req: AuthRequest, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user.id, isRead: false },
    data: { isRead: true }
  })
  res.json({ ok: true })
})

// PATCH /api/notifications/:id/read — o'qilgan deb belgilash
router.patch('/:id/read', async (req: AuthRequest, res) => {
  const id = String(req.params.id)
  await prisma.notification.updateMany({
    where: { id, userId: req.user.id },
    data: { isRead: true }
  })
  res.json({ ok: true })
})

// POST /api/notifications/send — teacher/admin xabar yuboradi
router.post('/send', requireRole('TEACHER', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { userIds, title, message } = req.body
    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'title va message kerak' })
    }

    // Agar userIds bo'lmasa — barcha STUDENTlarga yuborish
    let targetIds: string[] = userIds
    if (!targetIds?.length) {
      const students = await prisma.user.findMany({
        where: { role: 'STUDENT' },
        select: { id: true }
      })
      targetIds = students.map(s => s.id)
    }

    await prisma.notification.createMany({
      data: targetIds.map(userId => ({
        userId,
        senderId: req.user.id,
        title: title.trim(),
        message: message.trim()
      }))
    })

    res.json({ ok: true, sent: targetIds.length })
  } catch (e: any) {
    console.error('notifications send error:', e)
    res.status(500).json({ error: 'Server xatoligi' })
  }
})

export default router
