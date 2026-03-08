import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { tokenBlacklist } from '../utils/tokenBlacklist'

const JWT_SECRET = process.env.JWT_SECRET!

export interface AuthRequest extends Request {
    user?: any
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token topilmadi' })
        return
    }
    const token = authHeader.split(' ')[1]
    tokenBlacklist.has(token).then(isBlacklisted => {
        if (isBlacklisted) {
            res.status(401).json({ error: 'Token yaroqsiz (logout qilingan)' })
            return
        }
        try {
            const decoded = jwt.verify(token, JWT_SECRET)
            req.user = decoded
            next()
        } catch {
            res.status(401).json({ error: 'Token yaroqsiz' })
        }
    }).catch(() => {
        // Redis xato — token tekshiruvisiz davom etamiz
        try {
            const decoded = jwt.verify(token, JWT_SECRET)
            req.user = decoded
            next()
        } catch {
            res.status(401).json({ error: 'Token yaroqsiz' })
        }
    })
}

export const optionalAuthenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) return next()
    const token = header.split(' ')[1]
    tokenBlacklist.has(token).then(isBlacklisted => {
        if (!isBlacklisted) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET) as any
                req.user = decoded
            } catch { /* ignore */ }
        }
        next()
    }).catch(() => {
        try {
            const decoded = jwt.verify(token, JWT_SECRET) as any
            req.user = decoded
        } catch { /* ignore */ }
        next()
    })
}

export function requireRole(...roles: string[]) {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({ error: 'Ruxsat yo\'q' })
            return
        }
        next()
    }
}
