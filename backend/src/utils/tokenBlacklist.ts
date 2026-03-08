import Redis from 'ioredis'

// Redis mavjud bo'lsa Redis, aks holda in-memory fallback
let redis: Redis | null = null

if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableOfflineQueue: false,
    })
    redis.on('error', (err) => {
        console.error('[Redis] Ulanishda xato:', err.message)
    })
    redis.on('connect', () => {
        console.log('[Redis] Ulandi')
    })
}

// Fallback: in-memory (Redis yo'q muhit uchun)
const memoryBlacklist = new Set<string>()

// Token muddati: 30 kun (JWT bilan bir xil)
const TOKEN_TTL = 30 * 24 * 60 * 60 // soniyada

export const tokenBlacklist = {
    async add(token: string): Promise<void> {
        if (redis) {
            try {
                await redis.set(`bl:${token}`, '1', 'EX', TOKEN_TTL)
                return
            } catch {
                // Redis xato — fallback
            }
        }
        memoryBlacklist.add(token)
    },

    async has(token: string): Promise<boolean> {
        if (redis) {
            try {
                const val = await redis.get(`bl:${token}`)
                return val !== null
            } catch {
                // Redis xato — fallback
            }
        }
        return memoryBlacklist.has(token)
    }
}
