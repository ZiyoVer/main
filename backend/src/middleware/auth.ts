import { Request, Response, NextFunction } from 'express'
import jwt, { JwtPayload } from 'jsonwebtoken'
import prisma from '../utils/db'
import { tokenBlacklist } from '../utils/tokenBlacklist'

const JWT_SECRET = process.env.JWT_SECRET!

interface DecodedToken extends JwtPayload {
    id: string
    role: string
}

export interface AuthRequest extends Request {
    user?: any
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token topilmadi' })
        return
    }
    const token = authHeader.split(' ')[1]

    // JWT ni avval tekshiramiz (tez, sinxron)
    let decoded: DecodedToken
    try {
        decoded = jwt.verify(token, JWT_SECRET) as DecodedToken
    } catch {
        res.status(401).json({ error: 'Token yaroqsiz' })
        return
    }

    // Redis blacklist tekshiruvi — await bilan to'g'ri ishlaydi
    try {
        const isBlacklisted = await tokenBlacklist.has(token)
        if (isBlacklisted) {
            res.status(401).json({ error: 'Token yaroqsiz (logout qilingan)' })
            return
        }
    } catch (redisErr) {
        // Redis ishlamasa — xavfsizlik uchun so'rovni rad etamiz
        // (logout bo'lgan tokenlarni o'tkazib yubormasligi uchun)
        console.error('Redis blacklist tekshiruvida xato:', redisErr)
        res.status(503).json({ error: 'Autentifikatsiya xizmati vaqtincha ishlamayapti. Qayta urinib ko\'ring.' })
        return
    }

    req.user = decoded
    next()
}

export const optionalAuthenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
        next()
        return
    }
    const token = header.split(' ')[1]
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken
        try {
            const isBlacklisted = await tokenBlacklist.has(token)
            if (!isBlacklisted) {
                req.user = decoded
            }
        } catch {
            // Optional auth da Redis xatosi — token ni qabul qilamiz
            req.user = decoded
        }
    } catch { /* token yaroqsiz — ignore */ }
    next()
}

export function requireRole(...roles: string[]) {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({ error: 'Ruxsat yo\'q' })
            return
        }
        try {
            const dbUser = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { role: true }
            })
            if (!dbUser || !roles.includes(dbUser.role)) {
                res.status(403).json({ error: 'Ruxsat yo\'q' })
                return
            }
            req.user = { ...req.user, role: dbUser.role }
        } catch (err) {
            console.error('requireRole DB tekshiruvida xato:', err)
            res.status(503).json({ error: 'Ruxsat tekshiruvi vaqtincha ishlamayapti' })
            return
        }
        next()
    }
}
