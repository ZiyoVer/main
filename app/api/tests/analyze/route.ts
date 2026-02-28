import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { updatePersonAbility, recalibrateItemDifficulty } from "@/lib/rasch-model"

export async function POST(req: Request) {
    try {
        const data = await req.json()
        const { studentProfileId, responses, testId } = data
        // responses: Array of { questionId, isCorrect, topic }

        let currentStudent = await prisma.studentProfile.findUnique({
            where: { id: studentProfileId }
        })

        if (!currentStudent) return NextResponse.json({ error: "Student not found" }, { status: 404 })

        let ability = currentStudent.abilityLevel
        let score = 0

        // Analyze each response using Rasch formulation
        for (const response of responses) {
            if (response.isCorrect) score++

            const question = await prisma.testQuestion.findUnique({
                where: { id: response.questionId }
            })

            if (question) {
                // 1. Update Student Ability iteratively based on this question's difficulty
                ability = updatePersonAbility(ability, response.isCorrect, question.difficulty)

                // 2. Adjust Question Difficulty based on population data 
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

                // Track weak topics for the student
                if (!response.isCorrect) {
                    const weakTopic = await prisma.weakTopic.findFirst({
                        where: { studentProfileId, topicName: response.topic }
                    })
                    if (weakTopic) {
                        await prisma.weakTopic.update({
                            where: { id: weakTopic.id },
                            data: { failCount: { increment: 1 }, lastFailed: new Date() }
                        })
                    } else {
                        await prisma.weakTopic.create({
                            data: { studentProfileId, topicName: response.topic }
                        })
                    }
                }
            }
        }

        // Save final ability logit
        await prisma.studentProfile.update({
            where: { id: studentProfileId },
            data: { abilityLevel: ability }
        })

        // Record the attempt
        const attempt = await prisma.testAttempt.create({
            data: {
                testId,
                studentProfileId,
                score,
                totalQuestions: responses.length
            }
        })

        return NextResponse.json({ success: true, attemptId: attempt.id })
    } catch (error) {
        return NextResponse.json({ error: "Analysis failed" }, { status: 500 })
    }
}
