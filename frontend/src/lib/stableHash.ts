// Barqaror kalit yasash — AI-test JSON'i va shunga o'xshash kontentdan localStorage kaliti.
// FNV-1a (ikki xil seed bilan 2x32-bit) — butun matn qatnashadi, shuning uchun eski
// "birinchi 500 belgi" usulidagi to'qnashuv xavfi yo'q. Kriptografik EMAS.

function fnv1a(input: string, seed: number): number {
    let h = seed >>> 0
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i)
        h = Math.imul(h, 0x01000193)
    }
    return h >>> 0
}

export function stableHash(input: string): string {
    return fnv1a(input, 0x811c9dc5).toString(36) + '-' + fnv1a(input, 0x7ee3623b).toString(36)
}

// Orqaga moslik: hash'gacha ishlatilgan eski kalit (JSON'ning dastlabki 500 belgisi).
// Yangi kalit topilmaganda eski yozuvlarni o'qish uchun — foydalanuvchi tarixi yo'qolmasin.
export function legacyTestKey(stableJson: string): string {
    return stableJson.substring(0, 500)
}
