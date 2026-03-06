import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { tokenBlacklist } from '../utils/tokenBlacklist'

const JWT_SECRET = process.env.JWT_SECRET || 'ballmax-dev-secret'

export interface AuthRequest extends Request {
    user?: any
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token topilmadi' })
        return
    }
    try {
        const token = authHeader.split(' ')[1]
        if (tokenBlacklist.has(token)) {
            res.status(401).json({ error: 'Token yaroqsiz (logout qilingan)' })
            return
        }
        const decoded = jwt.verify(token, JWT_SECRET)
        req.user = decoded
        next()
    } catch {
        res.status(401).json({ error: 'Token yaroqsiz' })
    }
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
