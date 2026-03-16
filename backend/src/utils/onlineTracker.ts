// Real-time online foydalanuvchilarni in-memory kuzatish
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

export function updateOnline(userId: string, name: string, email: string, role: string, page?: string) {
    onlineMap.set(userId, { userId, name, email, role, lastSeen: Date.now(), page })
}

export function getOnlineUsers(): OnlineEntry[] {
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
