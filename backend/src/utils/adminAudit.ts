import prisma from './db'

/**
 * Admin amallari uchun audit yozuvi yaratadi (AdminAuditLog).
 *
 * BEST-EFFORT: bu funksiya hech qachon asosiy amalni bloklamasligi kerak.
 * Ichkarida try/catch bilan o'ralgan — log yozish muvaffaqiyatsiz bo'lsa,
 * faqat konsolga ogohlantirish chiqaradi va sukut bilan davom etadi.
 *
 * @param actorId    Amalni bajargan admin foydalanuvchi id'si (req.user.id)
 * @param actorEmail Admin email'i (ixtiyoriy — bo'lsa keyinchalik ko'rsatish uchun saqlanadi)
 * @param action     Amal kodi, masalan: "USER_DELETE", "USER_ROLE_CHANGE", "USER_SUSPEND"
 * @param targetType Nishon turi, masalan: "USER", "TEST"
 * @param targetId   Nishon id'si (ixtiyoriy)
 * @param meta       Qo'shimcha kontekst — JSON string sifatida saqlanadi (ixtiyoriy)
 */
export async function logAdminAction(
    actorId: string,
    actorEmail: string | null | undefined,
    action: string,
    targetType: string,
    targetId?: string | null,
    meta?: Record<string, unknown> | string | null
): Promise<void> {
    try {
        let metaStr: string | null = null
        if (meta != null) {
            if (typeof meta === 'string') {
                metaStr = meta
            } else {
                try {
                    metaStr = JSON.stringify(meta)
                } catch {
                    // Serializatsiya bo'lmasa — logni baribir yozamiz, meta'siz
                    metaStr = null
                }
            }
        }

        await prisma.adminAuditLog.create({
            data: {
                actorId,
                actorEmail: actorEmail ?? null,
                action,
                targetType,
                targetId: targetId ?? null,
                meta: metaStr,
            }
        })
    } catch (err) {
        // Best-effort: audit yozuvi asosiy amalni hech qachon bloklamaydi
        console.warn('logAdminAction muvaffaqiyatsiz (e\'tiborsiz qoldirildi):', err)
    }
}
