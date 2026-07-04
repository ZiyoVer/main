// localStorage cheksiz o'sishining oldini olish: dtmmax_* per-test kalitlaridan
// har turdan eng yangi KEEP_PER_PREFIX tasi qoladi, eskilari o'chiriladi.
// "Yangi/eski" tartibi yengil LRU jurnalida (dtmmax_key_lru_v1) yuritiladi —
// jurnalda yo'q kalitlar eng eski hisoblanadi (hash'gacha yozilgan meros yozuvlar).

const LRU_KEY = 'dtmmax_key_lru_v1'
const PRUNE_PREFIXES = ['dtmmax_ans_', 'dtmmax_pub_ans_', 'dtmmax_correct_', 'dtmmax_tp_ans_']
const KEEP_PER_PREFIX = 50

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
