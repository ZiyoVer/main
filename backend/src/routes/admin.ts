import { Router } from 'express'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'
import { logAdminAction } from '../utils/adminAudit'
import { FREE_DAILY_LIMITS, tashkentDay } from '../utils/aiQuota'

const router = Router()

// GET /api/admin/ai-usage — kunlik AI sarfi ko'zgusi (faqat ADMIN).
// Bugun + oxirgi 7 kun: faol userlar, so'rovlar, limitga urilganlar.
// Xarajatni ko'z bilan kuzatish uchun — DeepSeek/OpenAI hisobiga syurpriz bo'lmasin.
router.get('/ai-usage', authenticate, requireRole('ADMIN'), async (_req: AuthRequest, res) => {
    try {
        const today = tashkentDay()
        const weekAgo = tashkentDay(-6)
        const [dayRows, atChatLimit, atVisionLimit] = await Promise.all([
            prisma.aiDailyUsage.groupBy({
                by: ['day'],
                where: { day: { gte: weekAgo } },
                _sum: { chatCount: true, visionCount: true },
                _count: { _all: true },
                orderBy: { day: 'asc' },
            }),
            prisma.aiDailyUsage.count({ where: { day: today, chatCount: { gte: FREE_DAILY_LIMITS.chat } } }),
            prisma.aiDailyUsage.count({ where: { day: today, visionCount: { gte: FREE_DAILY_LIMITS.vision } } }),
        ])
        const days = dayRows.map(row => ({
            day: row.day,
            users: row._count._all,
            chat: row._sum.chatCount ?? 0,
            vision: row._sum.visionCount ?? 0,
        }))
        const todayRow = days.find(d => d.day === today) || { day: today, users: 0, chat: 0, vision: 0 }
        res.json({ limits: FREE_DAILY_LIMITS, today: { ...todayRow, atChatLimit, atVisionLimit }, days })
    } catch (e) {
        console.error('ai-usage:', e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// CSV maydonini xavfsiz qochirish (escape): vergul, qo'shtirnoq yoki yangi qator bo'lsa
// butun maydonni qo'shtirnoqqa olamiz va ichki qo'shtirnoqlarni ikkilantiramiz (RFC 4180).
function csvEscape(value: string | null | undefined): string {
    const str = value == null ? '' : String(value)
    if (/[",\r\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`
    }
    return str
}

function formatDate(date: Date | null | undefined): string {
    if (!date) return ''
    // ISO sanasi (YYYY-MM-DD) — Excel/Sheets uchun barqaror
    return date.toISOString().slice(0, 10)
}

// GET /api/admin/export/users — foydalanuvchilar CSV eksport (faqat ADMIN)
// ?search — ism/email contains (users ro'yxati bilan bir xil filtr).
// StudentProfile bilan qo'shilgan: examType, targetScore, examDate.
router.get('/export/users', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const search = ((req.query.search as string) || '').trim()

        const where: { OR?: Array<Record<string, { contains: string; mode: 'insensitive' }>> } = {}
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ]
        }

        const users = await prisma.user.findMany({
            where,
            select: {
                name: true,
                email: true,
                role: true,
                createdAt: true,
                profile: {
                    select: { examType: true, targetScore: true, examDate: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        const header = ['Ism', 'Email', 'Rol', 'Ro\'yxatdan o\'tgan', 'Imtihon turi', 'Maqsad ball', 'Imtihon sanasi']
        const rows = users.map((u) => [
            csvEscape(u.name),
            csvEscape(u.email),
            csvEscape(u.role),
            csvEscape(formatDate(u.createdAt)),
            csvEscape(u.profile?.examType ?? ''),
            csvEscape(u.profile?.targetScore != null ? String(u.profile.targetScore) : ''),
            csvEscape(formatDate(u.profile?.examDate))
        ].join(','))

        // BOM — Excel UTF-8 (o'zbek belgilari) to'g'ri ko'rinishi uchun
        const csv = '﻿' + [header.join(','), ...rows].join('\r\n') + '\r\n'

        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', 'attachment; filename="users.csv"')
        res.status(200).send(csv)
    } catch (e) {
        console.error('admin export users error:', e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// GET /api/admin/users/:id — bitta foydalanuvchining boyitilgan tafsiloti (faqat ADMIN)
// Faqat o'qish (read-only): User + StudentProfile + UserProgress + so'nggi ~10 TestAttempt + TopicStat.
// Topilmasa 404. Hech qanday maxfiy maydon (password/token) qaytarilmaydi.
router.get('/users/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const uid = String(req.params.id)

        const user = await prisma.user.findUnique({
            where: { id: uid },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                status: true,
                createdAt: true,
                emailVerified: true,
                profile: {
                    select: {
                        examType: true,
                        subject: true,
                        subject2: true,
                        examDate: true,
                        targetScore: true,
                        abilityLevel: true,
                        weakTopics: true,
                        strongTopics: true,
                        totalTests: true,
                        avgScore: true,
                    }
                },
                progress: {
                    select: { xp: true, streak: true }
                }
            }
        })

        if (!user) {
            return res.status(404).json({ error: 'Foydalanuvchi topilmadi' })
        }

        // So'nggi ~10 ta test urinishi (eng yangidan eskiga)
        const attempts = await prisma.testAttempt.findMany({
            where: { userId: uid },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
                score: true,
                scoreMax: true,
                createdAt: true,
                test: { select: { title: true } }
            }
        })

        // Mavzu bo'yicha statistika (bor bo'lsa) — eng so'nggi mashq qilingan tartibda
        const topicStats = await prisma.topicStat.findMany({
            where: { userId: uid },
            orderBy: [{ lastPracticed: 'desc' }, { total: 'desc' }],
            select: {
                subject: true,
                topic: true,
                correct: true,
                total: true,
                lastPracticed: true,
            }
        })

        const recentAttempts = attempts.map((a) => ({
            testTitle: a.test?.title ?? null,
            score: a.score,
            scoreMax: a.scoreMax,
            createdAt: a.createdAt,
        }))

        // progress: xp/streak UserProgress'dan, totalTests/avgScore StudentProfile'dan (kontrakt birlashtiradi)
        const progress = {
            xp: user.progress?.xp ?? 0,
            streak: user.progress?.streak ?? 0,
            totalTests: user.profile?.totalTests ?? 0,
            avgScore: user.profile?.avgScore ?? 0,
        }

        res.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                createdAt: user.createdAt,
                emailVerified: user.emailVerified,
            },
            profile: user.profile
                ? {
                    examType: user.profile.examType,
                    subject: user.profile.subject,
                    subject2: user.profile.subject2,
                    examDate: user.profile.examDate,
                    targetScore: user.profile.targetScore,
                    abilityLevel: user.profile.abilityLevel,
                    weakTopics: user.profile.weakTopics,
                    strongTopics: user.profile.strongTopics,
                }
                : null,
            progress,
            recentAttempts,
            topicStats,
        })
    } catch (e) {
        console.error('admin user detail error:', e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// GET /api/admin/audit — admin audit jurnali (faqat ADMIN)
// Sahifalangan (pagination), eng yangidan eskiga. Har yozuvda actor ma'lumoti
// (audit yozilgan paytdagi snapshot email + agar mavjud bo'lsa joriy actor ism/email).
// Query: ?page (1+), ?limit (10..100, default 50).
router.get('/audit', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1)
        const limit = Math.min(100, Math.max(10, parseInt(req.query.limit as string) || 50))
        const skip = (page - 1) * limit

        const [logs, total] = await Promise.all([
            prisma.adminAuditLog.findMany({
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                select: {
                    id: true,
                    actorId: true,
                    actorEmail: true,
                    action: true,
                    targetType: true,
                    targetId: true,
                    meta: true,
                    createdAt: true,
                }
            }),
            prisma.adminAuditLog.count()
        ])

        // Actor ma'lumotini boyitish: shu sahifadagi actorId'lar bo'yicha joriy
        // foydalanuvchini bir martalik so'rov bilan olamiz (o'chirilgan bo'lishi mumkin).
        const actorIds = Array.from(new Set(logs.map((l) => l.actorId)))
        const actors = actorIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: actorIds } },
                select: { id: true, name: true, email: true, role: true }
            })
            : []
        const actorMap = new Map(actors.map((a) => [a.id, a]))

        const items = logs.map((l) => {
            const actor = actorMap.get(l.actorId)
            return {
                id: l.id,
                action: l.action,
                targetType: l.targetType,
                targetId: l.targetId,
                meta: l.meta,
                createdAt: l.createdAt,
                actor: {
                    id: l.actorId,
                    // Snapshot email (audit yozilgan paytdagi) — actor o'chirilgan bo'lsa ham qoladi
                    email: l.actorEmail ?? actor?.email ?? null,
                    name: actor?.name ?? null,
                    role: actor?.role ?? null,
                    exists: !!actor,
                }
            }
        })

        res.json({ items, total, page, pages: Math.ceil(total / limit) })
    } catch (e) {
        console.error('admin audit list error:', e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// ============ TEST MODERATSIYASI (faqat ADMIN) ============
// Public testlar admin tasdig'idan o'tishi kerak. TEACHER yaratgan/qayta nashr qilgan
// public testlar approved=false bo'ladi va shu navbatga tushadi.

// GET /api/admin/tests/pending — tasdiq kutayotgan public testlar (approved=false).
// Eng eskidan yangiga (FIFO navbat). Query: ?page (1+), sahifada 50 ta.
router.get('/tests/pending', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1)
        const limit = 50
        const where = { isPublic: true, approved: false }

        const [tests, total] = await Promise.all([
            prisma.test.findMany({
                where,
                include: {
                    _count: { select: { questions: true, attempts: true } },
                    creator: { select: { id: true, name: true, email: true, role: true } }
                },
                orderBy: { createdAt: 'asc' },
                take: limit,
                skip: (page - 1) * limit,
            }),
            prisma.test.count({ where })
        ])

        res.json({
            tests,
            total,
            page,
            pages: Math.ceil(total / limit)
        })
    } catch (e) {
        console.error('admin tests pending error:', e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// POST /api/admin/tests/:testId/approve — testni tasdiqlash.
// approved=true qiladi, approvedAt/approvedById yozadi, studentlarga bildirishnoma yuboradi,
// audit log (TEST_APPROVE). Allaqachon tasdiqlangan bo'lsa qayta bildirishnoma yubormaydi.
router.post('/tests/:testId/approve', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const testId = req.params.testId as string
        const test = await prisma.test.findUnique({
            where: { id: testId },
            select: { id: true, title: true, subject: true, isPublic: true, approved: true, creatorId: true }
        })
        if (!test) return res.status(404).json({ error: 'Test topilmadi' })
        if (!test.isPublic) {
            return res.status(400).json({ error: 'Faqat public testlar tasdiqlanadi. Bu test private.' })
        }

        const alreadyApproved = test.approved

        const updated = await prisma.test.update({
            where: { id: test.id },
            data: {
                approved: true,
                approvedAt: new Date(),
                approvedById: req.user.id,
            }
        })

        // Studentlarga bildirishnoma — faqat birinchi marta tasdiqlanganda yuboramiz
        // (idempotentlik: qayta approve bosilsa spam bo'lmasin).
        let notified = 0
        if (!alreadyApproved) {
            try {
                const students = await prisma.user.findMany({
                    where: { role: 'STUDENT' },
                    select: { id: true }
                })
                if (students.length > 0) {
                    const created = await prisma.notification.createMany({
                        data: students.map((s: { id: string }) => ({
                            userId: s.id,
                            senderId: req.user.id,
                            title: `📚 Yangi test: ${test.title}`,
                            message: `"${test.title}" nomli yangi ${test.subject || ''} testi qo'shildi. Hoziroq yechib ko'ring!`,
                            targetType: 'test',
                            targetId: test.id
                        }))
                    })
                    notified = created.count
                }
            } catch (notifErr) {
                console.error('Notification send error (approve):', notifErr)
                // Bildirishnoma xatosi tasdiqlashni to'xtatmasin
            }
        }

        // AUDIT (best-effort)
        const actor = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { email: true }
        }).catch(() => null)
        await logAdminAction(req.user.id, actor?.email ?? null, 'TEST_APPROVE', 'TEST', test.id, {
            title: test.title,
            creatorId: test.creatorId,
            notified,
        })

        res.json({ ...updated, notified })
    } catch (e) {
        console.error('admin test approve error:', e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// POST /api/admin/tests/:testId/reject — testni rad etish.
// Testni private qiladi (isPublic=false) va approved=false qoldiradi — shunda u
// public ro'yxatdan ham, kutilayotganlar navbatidan ham chiqib ketadi, lekin
// o'chmaydi (egasi tahrirlab qayta yuborishi mumkin). Egasiga sabab bilan bildirishnoma.
// Body: { reason?: string }. Audit log (TEST_REJECT).
router.post('/tests/:testId/reject', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const testId = req.params.testId as string
        const rawReason = req.body?.reason
        const reason = typeof rawReason === 'string' ? rawReason.trim().slice(0, 500) : ''

        const test = await prisma.test.findUnique({
            where: { id: testId },
            select: { id: true, title: true, creatorId: true }
        })
        if (!test) return res.status(404).json({ error: 'Test topilmadi' })

        const updated = await prisma.test.update({
            where: { id: test.id },
            data: {
                isPublic: false,
                approved: false,
                approvedAt: null,
                approvedById: null,
            }
        })

        // Egasiga (test yaratuvchisiga) bildirishnoma — o'ziga o'zi yubormaslik uchun tekshiramiz
        if (test.creatorId && test.creatorId !== req.user.id) {
            try {
                await prisma.notification.create({
                    data: {
                        userId: test.creatorId,
                        senderId: req.user.id,
                        title: `❌ Test rad etildi: ${test.title}`,
                        message: reason
                            ? `"${test.title}" testi admin tomonidan rad etildi. Sabab: ${reason}`
                            : `"${test.title}" testi admin tomonidan rad etildi. Iltimos, qayta ko'rib chiqing.`,
                        targetType: 'test',
                        targetId: test.id
                    }
                })
            } catch (notifErr) {
                console.error('Notification send error (reject):', notifErr)
                // Bildirishnoma xatosi rad etishni to'xtatmasin
            }
        }

        // AUDIT (best-effort)
        const actor = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { email: true }
        }).catch(() => null)
        await logAdminAction(req.user.id, actor?.email ?? null, 'TEST_REJECT', 'TEST', test.id, {
            title: test.title,
            creatorId: test.creatorId,
            reason: reason || null,
        })

        res.json({ ...updated, message: 'Test rad etildi' })
    } catch (e) {
        console.error('admin test reject error:', e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

export default router
