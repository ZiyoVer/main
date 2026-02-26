import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"
import { getAIClient, getAIConfig } from "@/lib/ai/client"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userId = (session.user as { id: string }).id
    const { testId, answers } = await req.json()

    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: { questions: true },
    })
    if (!test) return NextResponse.json({ error: "Test topilmadi" }, { status: 404 })

    // Calculate score
    let correct = 0
    const mcQuestions = test.questions.filter((q) => q.type === "MULTIPLE_CHOICE")
    for (const q of mcQuestions) {
      if (answers[q.id] === q.correctAnswer) correct++
    }
    const score = mcQuestions.length > 0 ? correct / mcQuestions.length : 0

    const attempt = await prisma.testAttempt.create({
      data: { testId, userId, answers, score, finishedAt: new Date() },
    })

    // Update weak topics based on wrong answers
    const profile = await prisma.studentProfile.findUnique({ where: { userId } })
    if (profile) {
      for (const q of test.questions) {
        if (q.type === "MULTIPLE_CHOICE" && q.topic && answers[q.id] !== q.correctAnswer) {
          await prisma.weakTopic.upsert({
            where: { studentId_topic: { studentId: profile.id, topic: q.topic } },
            create: { studentId: profile.id, topic: q.topic },
            update: { mistakeCount: { increment: 1 }, lastSeen: new Date() },
          })
        }
      }
    }

    // AI analysis
    let analysis = ""
    try {
      const wrongQuestions = test.questions.filter(
        (q) => q.type === "MULTIPLE_CHOICE" && answers[q.id] !== q.correctAnswer
      )

      if (wrongQuestions.length > 0) {
        const client = await getAIClient()
        const config = await getAIConfig()
        const wrongList = wrongQuestions
          .slice(0, 5)
          .map((q) => `Savol: ${q.questionText}\nNoto'g'ri javob: ${answers[q.id]}\nTo'g'ri javob: ${q.correctAnswer}`)
          .join("\n\n")

        const res = await client.chat.completions.create({
          model: config.modelName,
          messages: [
            {
              role: "system",
              content: "Siz o'quvchiga test natijalarini tahlil qiluvchi AI murabbiysiz. Qisqa, foydali tahlil bering.",
            },
            {
              role: "user",
              content: `O'quvchi testda ${Math.round(score * 100)}% to'g'ri javob berdi.\n\nNoto'g'ri javob berilgan savollar:\n${wrongList}\n\nQisqa tahlil va maslahat ber.`,
            },
          ],
          max_tokens: 400,
        })
        analysis = res.choices[0]?.message?.content || ""
      }
    } catch {
      // AI tahlilsiz ham natija qaytariladi
    }

    await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: { analyzed: true },
    })

    return NextResponse.json({ score, analysis })
  } catch (error) {
    console.error("Submit error:", error)
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 })
  }
}
