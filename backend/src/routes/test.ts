import { Router } from 'express'
import prisma from '../utils/db'
import { authenticate, AuthRequest } from '../middlewares/authMiddleware'
import { updatePersonAbility, recalibrateItemDifficulty } from '../utils/rasch'

const router = Router()

// Default fallback test
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const tests = await prisma.test.findMany({
            include: { questions: true }
        })
        res.json(tests)
    } catch (e) {
        res.status(500).json({ error: "Server xatoligi" })
    }
})

// Analyze test via Rasch ML 
router.post('/analyze', authenticate, async (req: AuthRequest, res) => {
    try {
        const { responses, testId } = req.body

        let currentStudent = await prisma.studentProfile.findUnique({
            where: { userId: req.user.id }
        })

        if (!currentStudent) return res.status(404).json({ error: "Student not found" })

        let ability = currentStudent.abilityLevel
        let score = 0

        for (const response of responses) {
            if (response.isCorrect) score++

            const question = await prisma.testQuestion.findUnique({
                where: { id: response.questionId }
            })

            if (question) {
                ability = updatePersonAbility(ability, response.isCorrect, question.difficulty)

                const newAttemptCount = question.attemptCount + 1
                const newCorrectCount = question.correctCount + (response.isCorrect ? 1 : 0)
                const updatedDifficulty = recalibrateItemDifficulty(question.difficulty, newAttemptCount, newCorrectCount)

                await prisma.testQuestion.update({
                    where: { id: question.id },
                    data: {
                        attemptCount: newAttemptCount,
                        correctCount: newCorrectCount,
                        difficulty: updatedDifficulty
                    }
                })

                if (!response.isCorrect) {
                    const weakTopic = await prisma.weakTopic.findFirst({
                        where: { studentProfileId: currentStudent.id, topicName: response.topic }
                    })
                    if (weakTopic) {
                        await prisma.weakTopic.update({
                            where: { id: weakTopic.id },
                            data: { failCount: { increment: 1 }, lastFailed: new Date() }
                        })
                    } else {
                        await prisma.weakTopic.create({
                            data: { studentProfileId: currentStudent.id, topicName: response.topic }
                        })
                    }
                }
            }
        }

        await prisma.studentProfile.update({
            where: { id: currentStudent.id },
            data: { abilityLevel: ability }
        })

        const attempt = await prisma.testAttempt.create({
            data: {
                testId,
                studentProfileId: currentStudent.id,
                score,
                totalQuestions: responses.length
            }
        })

        res.json({ success: true, attemptId: attempt.id })
    } catch (e) {
        res.status(500).json({ error: "Analysis failed" })
    }
})

export default router
