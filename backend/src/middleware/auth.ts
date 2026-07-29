import { Request, Response, NextFunction } from 'express'
import prisma from '../utils/db'
import { tokenBlacklist } from '../utils/tokenBlacklist'
import { AUTH_ERROR_CODES, authError } from '../utils/authErrors'
import { type AuthTokenClaims, verifyAuthToken } from '../utils/authToken'

export interface AuthRequest extends Request {
    user?: any
}

function currentIdentity(decoded: AuthTokenClaims, dbUser: { role: string; emailVerified: boolean }) {
    return {
        ...decoded,
        id: decoded.id,
        role: dbUser.role,
        emailVerified: dbUser.emailVerified,
    }
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json(authError('Token topilmadi', AUTH_ERROR_CODES.TOKEN_MISSING))
        return
    }
    const token = authHeader.split(' ')[1]
    if (!token) {
        res.status(401).json(authError('Token topilmadi', AUTH_ERROR_CODES.TOKEN_MISSING))
        return
    }

    // JWT ni avval tekshiramiz (tez, sinxron)
    let decoded: AuthTokenClaims
    try {
        decoded = verifyAuthToken(token)
    } catch {
        res.status(401).json(authError('Token yaroqsiz', AUTH_ERROR_CODES.TOKEN_INVALID))
        return
    }

    // Redis blacklist tekshiruvi — await bilan to'g'ri ishlaydi
    try {
        const isBlacklisted = await tokenBlacklist.has(token)
        if (isBlacklisted) {
            res.status(401).json(authError('Token yaroqsiz (logout qilingan)', AUTH_ERROR_CODES.TOKEN_REVOKED))
            return
        }
    } catch (redisErr) {
        // Redis ishlamasa — xavfsizlik uchun so'rovni rad etamiz
        // (logout bo'lgan tokenlarni o'tkazib yubormasligi uchun)
        console.error('Redis blacklist tekshiruvida xato:', redisErr)
        res.status(503).json(authError(
            'Autentifikatsiya xizmati vaqtincha ishlamayapti. Qayta urinib ko\'ring.',
            AUTH_ERROR_CODES.SERVICE_UNAVAILABLE
        ))
        return
    }

    // P0-04: Akkaunt statusini DB'dan tekshiramiz. JWT 7 kun amal qiladi — suspend/o'chirish
    // DARHOL kuchga kirsin (aks holda bloklangan yoki o'chirilgan token 7 kungacha ishlardi).
    // requireRole/requireVerified allaqachon shuni qilardi; endi FAQAT-authenticate route'lar
    // (submit, natijalar, checkout, chat ro'yxati) uchun ham markazlashtirildi.
    try {
        const dbUser = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { role: true, status: true, emailVerified: true, authVersion: true }
        })
        if (!dbUser) {
            res.status(401).json(authError('Foydalanuvchi topilmadi', AUTH_ERROR_CODES.USER_NOT_FOUND))
            return
        }
        if (dbUser.status === 'SUSPENDED') {
            res.status(403).json(authError('Akkaunt bloklangan', AUTH_ERROR_CODES.ACCOUNT_SUSPENDED))
            return
        }
        if (dbUser.authVersion !== decoded.ver) {
            res.status(401).json(authError('Sessiya bekor qilingan', AUTH_ERROR_CODES.TOKEN_REVOKED))
            return
        }
        req.user = currentIdentity(decoded, dbUser)
    } catch (dbErr) {
        // DB ishlamasa — Redis bilan bir xil fail-closed siyosat (so'rovni rad etamiz)
        console.error('authenticate status tekshiruvida xato:', dbErr)
        res.status(503).json(authError(
            'Autentifikatsiya xizmati vaqtincha ishlamayapti. Qayta urinib ko\'ring.',
            AUTH_ERROR_CODES.SERVICE_UNAVAILABLE
        ))
        return
    }

    next()
}

export const optionalAuthenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
        next()
        return
    }
    const token = header.split(' ')[1]
    // Bu middleware bir router zanjirida bir necha marta ishlashi mumkin. Yangi
    // tekshiruv tugamaguncha oldingi req.user qiymatiga ishonmaymiz.
    req.user = undefined
    if (!token) {
        next()
        return
    }

    let decoded: AuthTokenClaims
    try {
        decoded = verifyAuthToken(token)
    } catch {
        // Optional auth: yaroqsiz token guest sifatida davom etadi.
        next()
        return
    }

    try {
        if (await tokenBlacklist.has(token)) {
            next()
            return
        }
    } catch (redisErr) {
        // Revocation holatini bilmasak tokenni authenticated deb qabul qilmaymiz.
        console.error('optionalAuthenticate blacklist tekshiruvida xato:', redisErr)
        next()
        return
    }

    try {
        const dbUser = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { role: true, status: true, emailVerified: true, authVersion: true }
        })
        if (dbUser && dbUser.status !== 'SUSPENDED' && dbUser.authVersion === decoded.ver) {
            req.user = currentIdentity(decoded, dbUser)
        }
    } catch (dbErr) {
        // Optional endpoint guest sifatida ishlashi mumkin; stale identity bermaymiz.
        console.error('optionalAuthenticate user tekshiruvida xato:', dbErr)
    }
    next()
}

export function requireRole(...roles: string[]) {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json(authError('Ruxsat yo\'q', AUTH_ERROR_CODES.FORBIDDEN))
            return
        }
        try {
            const dbUser = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { role: true, status: true }
            })
            if (!dbUser || !roles.includes(dbUser.role)) {
                res.status(403).json(authError('Ruxsat yo\'q', AUTH_ERROR_CODES.FORBIDDEN))
                return
            }
            // Bloklangan akkaunt — token muddati o'tmasa ham darhol rad etamiz
            if (dbUser.status === 'SUSPENDED') {
                res.status(403).json(authError('Akkaunt bloklangan', AUTH_ERROR_CODES.ACCOUNT_SUSPENDED))
                return
            }
            req.user = { ...req.user, role: dbUser.role }
        } catch (err) {
            console.error('requireRole DB tekshiruvida xato:', err)
            res.status(503).json(authError(
                'Ruxsat tekshiruvi vaqtincha ishlamayapti',
                AUTH_ERROR_CODES.SERVICE_UNAVAILABLE
            ))
            return
        }
        next()
    }
}

// Email tasdiqlangan bo'lishini talab qiladi. JWT faqat {id, role} saqlagani uchun
// emailVerified ni DB dan tekshiramiz (requireRole patterni kabi).
// Faqat STUDENT uchun majburiy — TEACHER/ADMIN admin tomonidan yaratiladi.
export async function requireVerified(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    if (!req.user) {
        res.status(401).json(authError('Token topilmadi', AUTH_ERROR_CODES.TOKEN_MISSING))
        return
    }
    if (req.user.role !== 'STUDENT') {
        next()
        return
    }
    // SOFT-GATE (default): email tasdiqlash MAJBURLANMAYDI — tasdiqlanmaganlar ham
    // platformaga kiradi, frontend banner orqali eslatadi (odam qotib qolmaydi).
    // Hard-gate kerak bo'lsa Railway'da EMAIL_VERIFICATION_ENFORCED=true qo'y.
    const enforced = process.env.EMAIL_VERIFICATION_ENFORCED === 'true'
    try {
        const dbUser = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { emailVerified: true, status: true }
        })
        // User o'chirilgan, lekin token hali amal qilyapti — rad etamiz (requireRole kabi)
        if (!dbUser) {
            res.status(401).json(authError('Foydalanuvchi topilmadi', AUTH_ERROR_CODES.USER_NOT_FOUND))
            return
        }
        // Bloklangan akkaunt — har doim darhol rad (soft-gate'da ham ban ishlaydi)
        if (dbUser.status === 'SUSPENDED') {
            res.status(403).json(authError('Akkaunt bloklangan', AUTH_ERROR_CODES.ACCOUNT_SUSPENDED))
            return
        }
        // Email tasdiqlanmagan — FAQAT enforced rejimda bloklaymiz. Legacy (null/undefined) bloklanmaydi.
        if (enforced && dbUser.emailVerified === false) {
            // code: frontend buni oddiy 403 dan ajratishi uchun (api.ts shu kodga tayanadi)
            res.status(403).json(authError('Email tasdiqlanmagan', AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED))
            return
        }
    } catch (err) {
        console.error('requireVerified DB tekshiruvida xato:', err)
        res.status(503).json(authError(
            'Tekshiruv vaqtincha ishlamayapti',
            AUTH_ERROR_CODES.SERVICE_UNAVAILABLE
        ))
        return
    }
    next()
}
