import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"
import { buildOnboardingMotivation } from "@/lib/ai/systemPrompt"
import { getAIClient, getAIConfig } from "@/lib/ai/client"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userId = (session.user as { id: string }).id
    const { subjectId, currentLevel, targetGrade, availableDays, hoursPerDay } = await req.json()

    const existing = await prisma.studentProfile.findUnique({ where: { userId } })
    if (existing) return NextResponse.json({ error: "Profile already exists" }, { status: 400 })

    const subject = await prisma.subject.findUnique({ where: { id: subjectId } })
    if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 })

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const profile = await prisma.studentProfile.create({
      data: { userId, subjectId, currentLevel, targetGrade, availableDays, hoursPerDay },
    })

    await prisma.conversation.create({ data: { userId } })

    let motivation = await buildOnboardingMotivation(
      user.name,
      subject.name,
      targetGrade,
      availableDays,
      hoursPerDay
    )

    try {
      const client = await getAIClient()
      const config = await getAIConfig()
      const aiRes = await client.chat.completions.create({
        model: config.modelName,
        messages: [
          {
            role: "system",
            content: `Siz O'quvchiga rag'batlantiruvchi xabar yozayapsiz. Qisqa, iliqlik bilan yozing.`,
          },
          {
            role: "user",
            content: `O'quvchi ma'lumotlari: Ism: ${user.name}, Fan: ${subject.name}, Maqsad: ${targetGrade}, Kunlar: ${availableDays}, Kunlik soat: ${hoursPerDay}. Rag'batlantiruvchi xabar yoz.`,
          },
        ],
        max_tokens: 300,
      })
      const aiMotivation = aiRes.choices[0]?.message?.content
      if (aiMotivation) motivation = aiMotivation
    } catch {
      // AI xatoligida fallback motivatsiya ishlatiladi
    }

    return NextResponse.json({ profileId: profile.id, motivation })
  } catch (error) {
    console.error("Onboarding error:", error)
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 })
  }
}
