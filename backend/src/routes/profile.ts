import { Router } from 'express'
import prisma from '../utils/db'
import { authenticate, AuthRequest } from '../middleware/auth'
import { normalizeSubject } from '../utils/subjects'

const router = Router()

// Profil olish
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const profile = await prisma.studentProfile.findUnique({
            where: { userId: req.user.id }
        })
        res.json(profile)
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Profil yangilash (onboarding)
router.put('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const { subject, subject2, examType, targetScore, weakTopics, strongTopics, concerns, examDate, studyHoursPerDay, onboardingDone } = req.body
        const normalizedSubject = subject !== undefined ? normalizeSubject(subject) : undefined
        const normalizedSubject2 = subject2 !== undefined ? normalizeSubject(subject2) : undefined

        let profile = await prisma.studentProfile.findUnique({
            where: { userId: req.user.id }
        })

        if (!profile) {
            profile = await prisma.studentProfile.create({
                data: {
                    userId: req.user.id,
                    subject: normalizedSubject ?? null, subject2: normalizedSubject2 ?? null, examType, targetScore, concerns, studyHoursPerDay,
                    weakTopics: weakTopics ? JSON.stringify(weakTopics) : null,
                    strongTopics: strongTopics ? JSON.stringify(strongTopics) : null,
                    examDate: examDate ? new Date(examDate) : null,
                    onboardingDone: onboardingDone !== undefined ? onboardingDone : true
                }
            })
        } else {
            profile = await prisma.studentProfile.update({
                where: { userId: req.user.id },
                data: {
                    ...(subject !== undefined && { subject: normalizedSubject }),
                    ...(subject2 !== undefined && { subject2: normalizedSubject2 }),
                    ...(examType !== undefined && { examType }),
                    ...(targetScore !== undefined && { targetScore }),
                    ...(concerns !== undefined && { concerns }),
                    ...(studyHoursPerDay !== undefined && { studyHoursPerDay }),
                    ...(weakTopics !== undefined && { weakTopics: weakTopics ? JSON.stringify(weakTopics) : null }),
                    ...(strongTopics !== undefined && { strongTopics: strongTopics ? JSON.stringify(strongTopics) : null }),
                    ...(examDate !== undefined && { examDate: examDate ? new Date(examDate) : null }),
                    ...(onboardingDone !== undefined && { onboardingDone })
                }
            })
        }
        res.json(profile)
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

export default router
