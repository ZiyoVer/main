import { Router } from 'express'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'

const router = Router()

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
                name: user.name,
                email: user.email,
                role: user.role,
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

export default router
