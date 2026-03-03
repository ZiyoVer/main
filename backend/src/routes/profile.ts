import { Router } from 'express'
import prisma from '../utils/db'
import { authenticate, AuthRequest } from '../middleware/auth'

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
        const { subject, examType, targetScore, weakTopics, strongTopics, concerns, examDate, studyHoursPerDay, onboardingDone } = req.body

        let profile = await prisma.studentProfile.findUnique({
            where: { userId: req.user.id }
        })

        if (!profile) {
            profile = await prisma.studentProfile.create({
                data: {
                    userId: req.user.id,
                    subject, examType, targetScore, concerns, studyHoursPerDay,
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
                    subject, examType, targetScore, concerns, studyHoursPerDay,
                    weakTopics: weakTopics ? JSON.stringify(weakTopics) : undefined,
                    strongTopics: strongTopics ? JSON.stringify(strongTopics) : undefined,
                    examDate: examDate ? new Date(examDate) : undefined,
                    onboardingDone: onboardingDone !== undefined ? onboardingDone : true
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
