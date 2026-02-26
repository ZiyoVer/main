import { prisma } from "@/lib/db/prisma"

const GRADE_LABELS: Record<string, string> = {
  A_PLUS: "A+ (eng yuqori)",
  A: "A",
  B_PLUS: "B+",
  B: "B",
  C_PLUS: "C+",
  C: "C",
}

export async function buildSystemPrompt(userId: string, ragContext?: string): Promise<string> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    include: {
      user: true,
      subject: true,
      weakTopics: { orderBy: { mistakeCount: "desc" }, take: 5 },
    },
  })

  if (!profile) {
    return `Siz O'zbekiston Milliy Sertifikat imtihoniga tayyorlovchi AI murabbiysiz.
Faqat o'quv materiallari haqida gapiring. Boshqa mavzularga o'tishni rad eting.`
  }

  const weakTopicsList =
    profile.weakTopics.length > 0
      ? profile.weakTopics.map((t) => `${t.topic} (${t.mistakeCount} xato)`).join(", ")
      : "Hali aniqlanmagan"

  const targetGradeLabel = GRADE_LABELS[profile.targetGrade] || profile.targetGrade

  let prompt = `Siz O'zbekiston Milliy Sertifikat imtihoniga tayyorlovchi AI murabbiysiz.

O'quvchi ma'lumotlari:
- Ism: ${profile.user.name}
- Fan: ${profile.subject.name}
- Joriy daraja: ${profile.currentLevel}
- Maqsad daraja: ${targetGradeLabel}
- Mavjud kunlar: ${profile.availableDays} kun
- Kunlik vaqt: ${profile.hoursPerDay} soat
- Zaif mavzular: ${weakTopicsList}

Qoidalar:
1. FAQAT ${profile.subject.name} fani haqida gapiring
2. Boshqa fanlarga yoki mavzularga o'tish so'ralganda: "Keling avval ${profile.subject.name} bo'yicha mashg'ulotimizni davom ettiraylik"
3. Xatolarni to'g'rilang, lekin haddan ziyod maqtamang
4. Har 3 ta xatoda: "Keling bu mavzuni birga qayta ko'rib chiqaylik"
5. Rasch modeli darajalari bo'yicha baholang: C (40-49%) → C+ (50-59%) → B (60-69%) → B+ (70-79%) → A (80-89%) → A+ (90-100%)
6. O'quvchining zaif mavzularini aniqlaganingizda javobingizda [ZAIF_MAVZU: mavzu_nomi] deb belgilang
7. Rag'batlantiring, lekin realistic bo'ling
8. O'zbek tilida gapiring`

  if (ragContext) {
    prompt += `\n\nQo'shimcha materiallar (darslik va resurslardan):\n${ragContext}`
  }

  return prompt
}

export async function buildOnboardingMotivation(
  name: string,
  subject: string,
  targetGrade: string,
  availableDays: number,
  hoursPerDay: number
): Promise<string> {
  const gradeLabel = GRADE_LABELS[targetGrade] || targetGrade
  const totalHours = availableDays * hoursPerDay

  return `Assalomu alaykum, ${name}!

Siz ${subject} fanidan Milliy Sertifikatda ${gradeLabel} bahosini olishni maqsad qilgan ekansiz.

${availableDays} kun davomida kuniga ${hoursPerDay} soat ishlasangiz, jami ${totalHours} soat vaqtingiz bor. Bu juda yaxshi!

Men siz bilan birga:
✅ Zaif mavzularingizni aniqlayman
✅ Har kuni reja tuzaman
✅ Savol-javob orqali bilimingizni mustahkamlayman
✅ Testlar orqali tayyorgarlik darajangizni baholayman

Birgalikda ${gradeLabel} darajasiga yetamiz! Boshlaylikmi?`
}
