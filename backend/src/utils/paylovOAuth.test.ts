import assert from 'node:assert/strict'
import test from 'node:test'
import { PaylovOAuthTokenError, PaylovOAuthTokenManager, PaylovTokenGrant } from './paylovOAuth'

const credentials = {
    consumerKey: 'consumer-key',
    consumerSecret: 'consumer-secret',
    username: 'merchant-user',
    password: 'Strong@Password1',
}

function tokenResponse(access: string, refresh: string) {
    return {
        access_token: access,
        refresh_token: refresh,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_expires_in: 604800,
    }
}

test('parallel so‘rovlar uchun faqat bitta password grant ishlatadi va tokenni cache qiladi', async () => {
    const grants: PaylovTokenGrant[] = []
    const manager = new PaylovOAuthTokenManager({
        credentials,
        requestToken: async grant => {
            grants.push(grant)
            return tokenResponse('access-token-1', 'refresh-token-1')
        },
    })

    const tokens = await Promise.all([
        manager.getAccessToken(),
        manager.getAccessToken(),
        manager.getAccessToken(),
    ])
    assert.deepEqual(tokens, ['access-token-1', 'access-token-1', 'access-token-1'])
    assert.equal(grants.length, 1)
    assert.equal(grants[0].grantType, 'password')
    assert.equal(await manager.getAccessToken(), 'access-token-1')
    assert.equal(grants.length, 1)
})

test('access token eskirganda refresh grant va rotatsiyalangan refresh tokenni ishlatadi', async () => {
    let now = 1_000_000
    const grants: PaylovTokenGrant[] = []
    const manager = new PaylovOAuthTokenManager({
        credentials,
        now: () => now,
        refreshSkewMs: 0,
        requestToken: async grant => {
            grants.push(grant)
            return grant.grantType === 'password'
                ? { ...tokenResponse('access-token-1', 'refresh-token-1'), expires_in: 1 }
                : tokenResponse('access-token-2', 'refresh-token-2')
        },
    })

    assert.equal(await manager.getAccessToken(), 'access-token-1')
    now += 2_000
    assert.equal(await manager.getAccessToken(), 'access-token-2')
    assert.deepEqual(grants[1], { grantType: 'refresh_token', refreshToken: 'refresh-token-1' })
})

test('refresh token rad etilsa password grant bilan xavfsiz qayta autentifikatsiya qiladi', async () => {
    let now = 1_000_000
    const grants: PaylovTokenGrant[] = []
    const manager = new PaylovOAuthTokenManager({
        credentials,
        now: () => now,
        refreshSkewMs: 0,
        requestToken: async grant => {
            grants.push(grant)
            if (grants.length === 1) return { ...tokenResponse('access-token-1', 'refresh-token-1'), expires_in: 1 }
            if (grant.grantType === 'refresh_token') throw new Error('invalid_grant')
            return tokenResponse('access-token-2', 'refresh-token-2')
        },
    })

    await manager.getAccessToken()
    now += 2_000
    assert.equal(await manager.getAccessToken(), 'access-token-2')
    assert.deepEqual(grants.map(grant => grant.grantType), ['password', 'refresh_token', 'password'])
})

test('noto‘liq credential va buzilgan token javobini fail-closed rad etadi', async () => {
    const missing = new PaylovOAuthTokenManager({
        credentials: { ...credentials, consumerSecret: '' },
        requestToken: async () => tokenResponse('access-token-1', 'refresh-token-1'),
    })
    await assert.rejects(
        missing.getAccessToken(),
        (error: unknown) => error instanceof PaylovOAuthTokenError && error.code === 'paylov_oauth_credentials_missing',
    )

    const malformed = new PaylovOAuthTokenManager({
        credentials,
        requestToken: async () => ({ access_token: 'short', refresh_token: 'refresh-token-1' }),
    })
    await assert.rejects(
        malformed.getAccessToken(),
        (error: unknown) => error instanceof PaylovOAuthTokenError && error.code === 'paylov_oauth_invalid_token_response',
    )
})
