import prisma from './db'

/**
 * Bepul foydalanuvchi uchun kunlik AI limitlari — xarajat shipi.
 * MAQSAD: 1000 ta bepul user ham DeepSeek/OpenAI hisobini portlata olmasin.
 *
 * chat   — barcha DeepSeek so'rovlari: chat xabari, test/essay/flashcard yaratish
 *          (ular chat oqimi orqali keladi), xato tushuntirish.
 * vision — rasm/OCR tahlili (OpenAI orqali, eng qimmat yo'l) — alohida, qattiqroq.
 *
 * Tayyor public testlarni yechish AI ishlatmaydi — CHEKSIZ, bu yerga kirmaydi.
 */
export const FREE_DAILY_LIMITS = { chat: 30, vision: 5 } as const
export type AiQuotaKind = keyof typeof FREE_DAILY_LIMITS

// Kun chegarasi foydalanuvchi yashaydigan vaqt bo'yicha (Asia/Tashkent, UTC+5) —
// UTC bo'yicha bo'lsa limit kechki 5 da yangilanib chalkashtirardi
export function tashkentDay(offsetDays = 0): string {
    return new Date(Date.now() + 5 * 3600 * 1000 + offsetDays * 86400 * 1000).toISOString().slice(0, 10)
}

async function hasActiveSubscription(userId: string): Promise<boolean> {
    const sub = await prisma.subscription.findFirst({
        where: { userId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
        select: { id: true },
    })
    return !!sub
}

/**
 * Bitta AI amal uchun kvota yeydi. ok=false bo'lsa limit tugagan — 429 qaytaring.
 * DIQQAT: getEntitlement ishlatilmaydi — beta'da (PRO_ENFORCED=false) u hammani
 * "Pro" deydi va limit umuman ishlamay qolardi. Bu yerda REAL obuna tekshiriladi:
 * Pro sotib olganlar (Octo ulangach) limitsiz, qolganlar kunlik chegarada.
 */
export async function consumeAiQuota(
    userId: string,
    role: string,
    kind: AiQuotaKind
): Promise<{ ok: boolean; limit: number }> {
    const limit = FREE_DAILY_LIMITS[kind]
    if (role === 'ADMIN' || role === 'TEACHER') return { ok: true, limit }
    if (await hasActiveSubscription(userId)) return { ok: true, limit }

    const day = tashkentDay()
    const field = kind === 'chat' ? 'chatCount' : 'visionCount'
    // Upsert + shartli increment: ikki parallel so'rov ham limitdan oshira olmaydi
    // (updateMany faqat count < limit bo'lsa yozadi — poyga-xavfsiz)
    await prisma.aiDailyUsage.upsert({
        where: { userId_day: { userId, day } },
        create: { userId, day },
        update: {},
    })
    const updated = await prisma.aiDailyUsage.updateMany({
        where: { userId, day, [field]: { lt: limit } },
        data: { [field]: { increment: 1 } },
    })
    return { ok: updated.count > 0, limit }
}

/**
 * Frontend limit bar uchun joriy holat — hech narsa YEMAYDI, faqat o'qiydi.
 * resetsAt = keyingi Toshkent yarim tuni (limit shu paytda yangilanadi).
 */
export async function getAiQuotaStatus(userId: string, role: string) {
    const resetsAt = `${tashkentDay(1)}T00:00:00+05:00`
    const unlimited = role === 'ADMIN' || role === 'TEACHER' || (await hasActiveSubscription(userId))
    if (unlimited) {
        return {
            unlimited: true,
            chat: { used: 0, limit: FREE_DAILY_LIMITS.chat },
            vision: { used: 0, limit: FREE_DAILY_LIMITS.vision },
            resetsAt,
        }
    }
    const usage = await prisma.aiDailyUsage.findUnique({
        where: { userId_day: { userId, day: tashkentDay() } },
        select: { chatCount: true, visionCount: true },
    })
    return {
        unlimited: false,
        // clamp: poyga tufayli count limitdan oshib yozilgan bo'lsa ham barda maks limit ko'rinsin
        chat: { used: Math.min(usage?.chatCount ?? 0, FREE_DAILY_LIMITS.chat), limit: FREE_DAILY_LIMITS.chat },
        vision: { used: Math.min(usage?.visionCount ?? 0, FREE_DAILY_LIMITS.vision), limit: FREE_DAILY_LIMITS.vision },
        resetsAt,
    }
}

export function quotaExceededMessage(kind: AiQuotaKind): string {
    if (kind === 'vision') {
        return `Bugungi bepul rasm tahlili limiti tugadi (${FREE_DAILY_LIMITS.vision} ta). Ertaga yangilanadi.`
    }
    return `Bugungi bepul AI so'rovlari limiti tugadi (${FREE_DAILY_LIMITS.chat} ta). Ertaga yangilanadi — tayyor testlarni esa cheksiz yechishingiz mumkin.`
}
