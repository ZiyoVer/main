import crypto from 'crypto'
import jwt, { type JwtPayload } from 'jsonwebtoken'

const JWT_ISSUER = 'dtmmax-api'
const JWT_AUDIENCE = 'dtmmax-web'
const JWT_ALGORITHM = 'HS256' as const

export interface AuthTokenClaims extends JwtPayload {
    id: string
    role: string
    ver: number
}

type TokenUser = {
    id: string
    role: string
    authVersion: number
}

function jwtSecret(): string {
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET topilmadi')
    return secret
}

export function signAuthToken(user: TokenUser): string {
    return jwt.sign(
        { id: user.id, role: user.role, ver: user.authVersion },
        jwtSecret(),
        {
            algorithm: JWT_ALGORITHM,
            audience: JWT_AUDIENCE,
            issuer: JWT_ISSUER,
            subject: user.id,
            jwtid: crypto.randomUUID(),
            expiresIn: '7d',
        }
    )
}

export function verifyAuthToken(token: string): AuthTokenClaims {
    const decoded = jwt.verify(token, jwtSecret(), {
        algorithms: [JWT_ALGORITHM],
        audience: JWT_AUDIENCE,
        issuer: JWT_ISSUER,
    })

    if (
        typeof decoded === 'string'
        || typeof decoded.id !== 'string'
        || !decoded.id
        || decoded.sub !== decoded.id
        || typeof decoded.role !== 'string'
        || !Number.isInteger(decoded.ver)
        || typeof decoded.jti !== 'string'
        || !decoded.jti
    ) {
        throw new Error('JWT claimlari noto\'g\'ri')
    }

    return decoded as AuthTokenClaims
}
