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

export default router
