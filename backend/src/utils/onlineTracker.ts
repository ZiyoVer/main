import Redis from 'ioredis'

// Real-time online foydalanuvchilarni Redis + in-memory fallback bilan kuzatish
// 5 daqiqa ichida ping yuborgan user — "online" hisoblanadi

interface OnlineEntry {
    userId: string
    name: string
    email: string
    role: string
    lastSeen: number
    page?: string
}

const onlineMap = new Map<string, OnlineEntry>()

const ONLINE_TIMEOUT = 5 * 60 * 1000 // 5 daqiqa
const ONLINE_TIMEOUT_SECONDS = Math.ceil(ONLINE_TIMEOUT / 1000)
const ONLINE_ZSET_KEY = 'online:users'
const ONLINE_DATA_PREFIX = 'online:user:'
const REDIS_TIMEOUT_MS = 2000

let redis: Redis | null = null
let redisHealthy = true

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
        if (redisHealthy) console.error('[OnlineTracker Redis] Ulanishda xato:', err.message)
        redisHealthy = false
    })
    redis.on('connect', () => { redisHealthy = true })
    redis.on('close', () => { redisHealthy = false })
}

export async function updateOnline(userId: string, name: string, email: string, role: string, page?: string) {
    if (redis && redisHealthy) {
        try {
            const entry: OnlineEntry = { userId, name, email, role, lastSeen: Date.now(), page }
            await withTimeout(
                redis.multi()
                    .zadd(ONLINE_ZSET_KEY, String(entry.lastSeen), userId)
                    .set(`${ONLINE_DATA_PREFIX}${userId}`, JSON.stringify(entry), 'EX', ONLINE_TIMEOUT_SECONDS)
                    .exec(),
                REDIS_TIMEOUT_MS
            )
            return
        } catch {
            // Redis xato — in-memory fallback
        }
    }
    onlineMap.set(userId, { userId, name, email, role, lastSeen: Date.now(), page })
}

export async function getOnlineUsers(): Promise<OnlineEntry[]> {
    if (redis && redisHealthy) {
        try {
            const cutoff = Date.now() - ONLINE_TIMEOUT
            await withTimeout(redis.zremrangebyscore(ONLINE_ZSET_KEY, '-inf', String(cutoff)), REDIS_TIMEOUT_MS)
            const userIds = await withTimeout(redis.zrevrangebyscore(ONLINE_ZSET_KEY, '+inf', String(cutoff)), REDIS_TIMEOUT_MS)
            if (userIds.length === 0) return []

            const pipeline = redis.pipeline()
            userIds.forEach(userId => pipeline.get(`${ONLINE_DATA_PREFIX}${userId}`))
            const rows = await withTimeout(pipeline.exec(), REDIS_TIMEOUT_MS)

            const result: OnlineEntry[] = []
            rows?.forEach((row) => {
                const [, value] = row || []
                if (!value || typeof value !== 'string') return
                try {
                    const entry = JSON.parse(value) as OnlineEntry
                    if (entry.lastSeen >= cutoff) result.push(entry)
                } catch {
                    // ignore broken row
                }
            })

            return result.sort((a, b) => b.lastSeen - a.lastSeen)
        } catch {
            // Redis xato — in-memory fallback
        }
    }

    const cutoff = Date.now() - ONLINE_TIMEOUT
    const result: OnlineEntry[] = []
    for (const [id, entry] of onlineMap.entries()) {
        if (entry.lastSeen >= cutoff) {
            result.push(entry)
        } else {
            onlineMap.delete(id)
        }
    }
    return result.sort((a, b) => b.lastSeen - a.lastSeen)
}

// Har 10 daqiqada eskirgan yozuvlarni tozalash (memory leak oldini olish)
setInterval(() => {
    const cutoff = Date.now() - ONLINE_TIMEOUT
    for (const [id, entry] of onlineMap.entries()) {
        if (entry.lastSeen < cutoff) {
            onlineMap.delete(id)
        }
    }
}, 10 * 60 * 1000)
