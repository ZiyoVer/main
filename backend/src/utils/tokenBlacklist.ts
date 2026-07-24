import Redis from 'ioredis'
import crypto from 'crypto'

// Redis sozlanmagan bo'lsa in-memory fallback ishlaydi. Redis sozlangan, lekin
// vaqtincha ishlamayotgan bo'lsa auth fail-closed bo'lishi uchun xato qaytaramiz.
let redis: Redis | null = null
let redisHealthy = false
const requirePersistentBlacklist = process.env.REDIS_REQUIRED === 'true'

// Redis operatsiyasi uchun max kutish vaqti (ms)
const REDIS_TIMEOUT_MS = 2000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Redis timeout')), ms)
        promise.then(
            value => {
                clearTimeout(timer)
                resolve(value)
            },
            error => {
                clearTimeout(timer)
                reject(error)
            }
        )
    })
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

function ensurePersistentStoreAvailable(): void {
    if (requirePersistentBlacklist && (!redis || !redisHealthy)) {
        throw new Error('Token blacklist uchun Redis majburiy')
    }
}

function redisUnavailable(): Error {
    return new Error('Token blacklist xizmati vaqtincha ishlamayapti')
}

function tokenKey(token: string): string {
    return `bl:${crypto.createHash('sha256').update(token).digest('hex')}`
}

export const tokenBlacklist = {
    async ready(): Promise<void> {
        if (!redis) {
            ensurePersistentStoreAvailable()
            return
        }
        try {
            if (redis.status === 'wait') {
                await withTimeout(redis.connect(), REDIS_TIMEOUT_MS)
            }
            await withTimeout(redis.ping(), REDIS_TIMEOUT_MS)
            redisHealthy = true
        } catch {
            redisHealthy = false
            throw redisUnavailable()
        }
    },

    async add(token: string): Promise<void> {
        if (redis) {
            try {
                await withTimeout(redis.set(tokenKey(token), '1', 'EX', TOKEN_TTL), REDIS_TIMEOUT_MS)
                return
            } catch {
                throw redisUnavailable()
            }
        }
        ensurePersistentStoreAvailable()
        memoryBlacklist.add(tokenKey(token))
    },

    async has(token: string): Promise<boolean> {
        if (redis) {
            try {
                const val = await withTimeout(redis.get(tokenKey(token)), REDIS_TIMEOUT_MS)
                return val !== null
            } catch {
                throw redisUnavailable()
            }
        }
        ensurePersistentStoreAvailable()
        return memoryBlacklist.has(tokenKey(token))
    }
}
