import test from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { signAuthToken, verifyAuthToken } from './authToken'

const TEST_SECRET = 'test-only-secret-at-least-thirty-two-characters-long'

test.before(() => {
    process.env.JWT_SECRET = TEST_SECRET
})

test('signAuthToken creates a strict, versioned DTMMax token', () => {
    const token = signAuthToken({ id: 'user-1', role: 'STUDENT', authVersion: 3 })
    const claims = verifyAuthToken(token)

    assert.equal(claims.id, 'user-1')
    assert.equal(claims.sub, 'user-1')
    assert.equal(claims.role, 'STUDENT')
    assert.equal(claims.ver, 3)
    assert.equal(claims.iss, 'dtmmax-api')
    assert.deepEqual(claims.aud, 'dtmmax-web')
    assert.equal(typeof claims.jti, 'string')
    assert.ok(claims.jti)
    assert.ok((claims.exp || 0) > Math.floor(Date.now() / 1000))
})

test('legacy token without issuer, audience, jti and authVersion is rejected', () => {
    const legacy = jwt.sign({ id: 'user-1', role: 'STUDENT' }, TEST_SECRET, { expiresIn: '7d' })
    assert.throws(() => verifyAuthToken(legacy))
})

test('token for another audience is rejected', () => {
    const foreign = jwt.sign(
        { id: 'user-1', role: 'STUDENT', ver: 0 },
        TEST_SECRET,
        {
            algorithm: 'HS256',
            issuer: 'dtmmax-api',
            audience: 'another-client',
            subject: 'user-1',
            jwtid: 'foreign-jti',
            expiresIn: '1h',
        }
    )
    assert.throws(() => verifyAuthToken(foreign))
})

test('tampered token is rejected', () => {
    const token = signAuthToken({ id: 'user-1', role: 'STUDENT', authVersion: 0 })
    const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`
    assert.throws(() => verifyAuthToken(tampered))
})
