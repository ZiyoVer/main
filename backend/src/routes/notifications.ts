import { Router } from 'express'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// GET /api/notifications — o'z bildirishnomalarini olish (student)
// count: faqat ?count=true bo'lsa o'qilmagan sonini qaytaradi
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user.id
    const countOnly = req.query.count === 'true'

    if (countOnly) {
      const count = await prisma.notification.count({ where: { userId, isRead: false } })
      return res.json({ count })
    }

    const notifications = await prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { sender: { select: { name: true, role: true } } }
    })
    res.json(notifications)
  } catch (e) {
    console.error('notifications get error:', e)
    res.status(500).json({ error: 'Server xatoligi' })
  }
})

// PATCH /api/notifications/read-all — barchasini o'qilgan deb belgilash
// Bu route /:id/read dan OLDIN bo'lishi kerak, aks holda "read-all" id sifatida tushadi
router.patch('/read-all', async (req: AuthRequest, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true }
    })
    res.json({ ok: true })
  } catch (e) {
    console.error('notifications read-all error:', e)
    res.status(500).json({ error: 'Server xatoligi' })
  }
})

// PATCH /api/notifications/:id/read — o'qilgan deb belgilash
router.patch('/:id/read', async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id)
    await prisma.notification.updateMany({
      where: { id, userId: req.user.id },
      data: { isRead: true }
    })
    res.json({ ok: true })
  } catch (e) {
    console.error('notifications read error:', e)
    res.status(500).json({ error: 'Server xatoligi' })
  }
})

// DELETE /api/notifications/:id — o'quvchi o'z bildirishnomасini o'chiradi
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id)
    await prisma.notification.deleteMany({
      where: { id, userId: req.user.id }
    })
    res.json({ ok: true })
  } catch (e) {
    console.error('notifications delete error:', e)
    res.status(500).json({ error: 'Server xatoligi' })
  }
})

// POST /api/notifications/send — teacher/admin xabar yuboradi
router.post('/send', requireRole('TEACHER', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { userIds, title, message, broadcastAll } = req.body
    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'title va message kerak' })
    }

    // Barcha o'quvchilarga yuborishda explicit tasdiqlash talab qilinadi
    let targetIds = Array.isArray(userIds)
      ? userIds.map((userId: unknown) => String(userId || '').trim()).filter(Boolean)
      : []

    if (!targetIds.length) {
      if (!broadcastAll) {
        return res.status(400).json({
          error: 'userIds bo\'sh. Barcha foydalanuvchilarga yuborish uchun broadcastAll: true ni yuboring.'
        })
      }
      const students = await prisma.user.findMany({
        where: { role: 'STUDENT' },
        select: { id: true }
      })
      targetIds = students.map(s => s.id)
    }

    targetIds = Array.from(new Set(targetIds))
    if (targetIds.length === 0) {
      return res.status(400).json({ error: 'Yuborish uchun o\'quvchi topilmadi' })
    }

    const targetStudents = await prisma.user.findMany({
      where: {
        id: { in: targetIds },
        role: 'STUDENT'
      },
      select: { id: true }
    })
    const validTargetIds = targetStudents.map(student => student.id)
    if (validTargetIds.length === 0) {
      return res.status(400).json({ error: 'Faqat o\'quvchilarga xabar yuborish mumkin' })
    }

    await prisma.notification.createMany({
      data: validTargetIds.map(userId => ({
        userId,
        senderId: req.user.id,
        title: title.trim(),
        message: message.trim()
      }))
    })

    res.json({ ok: true, sent: validTargetIds.length })
  } catch (e: any) {
    console.error('notifications send error:', e)
    res.status(500).json({ error: 'Server xatoligi' })
  }
})

export default router
