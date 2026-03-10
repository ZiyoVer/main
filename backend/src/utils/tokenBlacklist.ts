import Redis from 'ioredis'

// Redis mavjud bo'lsa Redis, aks holda in-memory fallback
let redis: Redis | null = null
let redisHealthy = true

// Redis operatsiyasi uchun max kutish vaqti (ms)
const REDIS_TIMEOUT_MS = 2000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), ms))
    ])
}

if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        enableOfflineQueue: false,
        connectTimeout: 3000,
        commandTimeout: 2000,
    })
    redis.on('error', (err) => {
        if (redisHealthy) console.error('[Redis] Ulanishda xato:', err.message)
        redisHealthy = false
    })
    redis.on('connect', () => {
        console.log('[Redis] Ulandi')
        redisHealthy = true
    })
    redis.on('close', () => { redisHealthy = false })
}

// Fallback: in-memory (Redis yo'q yoki ishlamayotgan muhit uchun)
const memoryBlacklist = new Set<string>()

// Token muddati: 7 kun (JWT bilan bir xil)
const TOKEN_TTL = 7 * 24 * 60 * 60 // soniyada

export const tokenBlacklist = {
    async add(token: string): Promise<void> {
        if (redis && redisHealthy) {
            try {
                await withTimeout(redis.set(`bl:${token}`, '1', 'EX', TOKEN_TTL), REDIS_TIMEOUT_MS)
                return
            } catch {
                // Redis xato — in-memory fallback
            }
        }
        memoryBlacklist.add(token)
    },

    async has(token: string): Promise<boolean> {
        if (redis && redisHealthy) {
            try {
                const val = await withTimeout(redis.get(`bl:${token}`), REDIS_TIMEOUT_MS)
                return val !== null
            } catch {
                // Redis xato — in-memory fallback
            }
        }
        return memoryBlacklist.has(token)
    }
}
