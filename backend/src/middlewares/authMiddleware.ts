import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
    user?: any
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization
    if (!authHeader) {
        return res.status(401).json({ error: 'Ruxsat yo\'q. Token kiritilmagan.' })
    }

    const token = authHeader.split(' ')[1]

    try {
        const secret = process.env.JWT_SECRET || 'fallback-secret-for-dev'
        const decoded = jwt.verify(token, secret)
        req.user = decoded
        next()
    } catch (err) {
        return res.status(401).json({ error: 'Yaroqsiz yoki eskirgan token.' })
    }
}
