import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { updatePersonAbility, recalibrateItemDifficulty } from "@/lib/rasch-model";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
    try {
        const data = await req.json();
        const { studentId, testId, answers } = data;
        // answers is expected to be an array of: { questionId: string, isCorrect: boolean }

        // Fetch current student profile
        const student = await prisma.studentProfile.findUnique({
            where: { userId: studentId }
        });

        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        let updatedAbility = student.abilityLevel;
        let correctCount = 0;

        // Process each answer
        for (const answer of answers) {
            const question = await prisma.testQuestion.findUnique({
                where: { id: answer.questionId }
            });

            if (!question) continue;

            if (answer.isCorrect) correctCount++;

            // 1. Update Student Ability iteratively
            updatedAbility = updatePersonAbility(updatedAbility, question.difficulty, answer.isCorrect);

            // 2. Track Weak Topics if wrong
            if (!answer.isCorrect && question.topic) {
                await prisma.weakTopic.upsert({
                    where: {
                        studentId_topic: {
                            studentId: student.id,
                            topic: question.topic,
                        }
                    },
                    update: { mistakeCount: { increment: 1 }, lastSeen: new Date() },
                    create: {
                        studentId: student.id,
                        topic: question.topic,
                        mistakeCount: 1,
                    }
                });
            }

            // 3. Recalibrate Item Difficulty in the background
            const newTotalAttempts = question.attemptCount + 1;
            const newCorrectCount = question.correctCount + (answer.isCorrect ? 1 : 0);
            const newDifficulty = recalibrateItemDifficulty(question.difficulty, newTotalAttempts, newCorrectCount);

            await prisma.testQuestion.update({
                where: { id: question.id },
                data: {
                    difficulty: newDifficulty,
                    attemptCount: newTotalAttempts,
                    correctCount: newCorrectCount,
                }
            });
        }

        // Save final student ability
        await prisma.studentProfile.update({
            where: { id: student.id },
            data: { abilityLevel: updatedAbility }
        });

        // Record the attempt
        await prisma.testAttempt.create({
            data: {
                testId,
                userId: studentId,
                answers,
                score: (correctCount / answers.length) * 100,
                analyzed: true,
                finishedAt: new Date()
            }
        });

        return NextResponse.json({
            success: true,
            message: "Test analyzed and Rasch parameters updated."
        });

    } catch (error) {
        console.error("Analysis Error:", error);
        return NextResponse.json({ error: "Failed to analyze test" }, { status: 500 });
    }
}
