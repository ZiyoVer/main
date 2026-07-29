// localStorage cheksiz o'sishining oldini olish: dtmmax_* per-test kalitlaridan
// har turdan eng yangi KEEP_PER_PREFIX tasi qoladi, eskilari o'chiriladi.
// "Yangi/eski" tartibi yengil LRU jurnalida (dtmmax_key_lru_v1) yuritiladi —
// jurnalda yo'q kalitlar eng eski hisoblanadi (hash'gacha yozilgan meros yozuvlar).

const LRU_KEY = 'dtmmax_key_lru_v1'
const PRUNE_PREFIXES = ['dtmmax_ans_', 'dtmmax_pub_ans_', 'dtmmax_correct_', 'dtmmax_tp_ans_']
const KEEP_PER_PREFIX = 50

export function isUserScopedDtmmaxKey(key: string, userId: string): boolean {
    if (!userId) return false

    const exactKeys = new Set([
        `dtmmax_done_tests_${userId}`,
        `dtmmax_done_ai_tests_${userId}`,
        `dtmmax_seen_tests_${userId}`,
        `dtmmax_test_result_${userId}`,
        `dtmmax_analysis_chat_id_${userId}`,
        `dtmmax_essay_draft_${userId}`,
        `dtmmax_teacher_draft_${userId}_v1`,
        `dtmmax_todo_items_v1_${userId}`,
    ])
    if (exactKeys.has(key)) return true

    return [
        `dtmmax_ans_${userId}_`,
        `dtmmax_pub_ans_${userId}_`,
        `dtmmax_tp_ans_${userId}_`,
        `dtmmax_todo_items_v1_${userId}_`,
    ].some(prefix => key.startsWith(prefix))
}

function readLru(): Record<string, number> {
    try {
        const parsed = JSON.parse(localStorage.getItem(LRU_KEY) || '{}')
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
        return {}
    }
}

function writeLru(lru: Record<string, number>): void {
    try { localStorage.setItem(LRU_KEY, JSON.stringify(lru)) } catch { /* jurnal saqlanmasa ham ish davom etadi */ }
}

export function pruneDtmmaxStorage(): void {
    try {
        const lru = readLru()
        for (const prefix of PRUNE_PREFIXES) {
            const keys: string[] = []
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i)
                if (k && k.startsWith(prefix)) keys.push(k)
            }
            if (keys.length <= KEEP_PER_PREFIX) continue
            keys.sort((a, b) => (lru[b] || 0) - (lru[a] || 0)) // yangi birinchi
            for (const k of keys.slice(KEEP_PER_PREFIX)) {
                localStorage.removeItem(k)
                delete lru[k]
            }
        }
        // Jurnalning o'zini ham tozalaymiz — allaqachon o'chirilgan kalitlar yig'ilib qolmasin
        for (const k of Object.keys(lru)) {
            if (localStorage.getItem(k) === null) delete lru[k]
        }
        writeLru(lru)
    } catch { /* prune hech qachon ilovani yiqitmasin */ }
}

// Logout, account switch va account delete paytida boshqa userga sizishi mumkin
// bo'lgan o'quv/test keshlarini bitta joydan tozalaydi. Theme va onboarding tour
// kabi qurilmaga tegishli sozlamalar ataylab saqlanadi.
export function clearUserLocalArtifacts(userId?: string | null): void {
    if (!userId) return
    try {
        const keysToRemove: string[] = []
        for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index)
            if (key && isUserScopedDtmmaxKey(key, userId)) keysToRemove.push(key)
        }

        // Flashcard signature'lari ilgari global saqlangan. Ularni sessiyalar
        // orasida qoldirish yangi akkauntda kartani noto'g'ri "allaqachon saqlandi"
        // deb belgilashi mumkin.
        keysToRemove.push('dtmmax_flash_posted_v1')
        const uniqueKeys = [...new Set(keysToRemove)]
        uniqueKeys.forEach(key => localStorage.removeItem(key))

        const lru = readLru()
        let lruChanged = false
        for (const key of uniqueKeys) {
            if (Object.prototype.hasOwnProperty.call(lru, key)) {
                delete lru[key]
                lruChanged = true
            }
        }
        if (lruChanged) writeLru(lru)
    } catch { /* storage mavjud bo'lmasa logout baribir davom etadi */ }
}

// Per-test kalitlarni yozishning yagona yo'li: LRU belgisi + quota to'lsa prune qilib qayta urinish
export function saveScopedItem(fullKey: string, value: string): void {
    try {
        localStorage.setItem(fullKey, value)
    } catch {
        pruneDtmmaxStorage()
        try { localStorage.setItem(fullKey, value) } catch { /* baribir sig'masa jim — UX buzilmasin */ }
    }
    const lru = readLru()
    lru[fullKey] = Date.now()
    writeLru(lru)
}
