export interface PaylovOAuthCredentials {
    consumerKey: string
    consumerSecret: string
    username: string
    password: string
}

export type PaylovTokenGrant =
    | { grantType: 'password'; username: string; password: string }
    | { grantType: 'refresh_token'; refreshToken: string }

export interface PaylovTokenResponse {
    access_token?: unknown
    refresh_token?: unknown
    token_type?: unknown
    expires_in?: unknown
    refresh_expires_in?: unknown
}

interface PaylovTokenState {
    accessToken: string
    refreshToken: string
    accessExpiresAt: number
    refreshExpiresAt: number
}

export class PaylovOAuthTokenError extends Error {
    constructor(public readonly code: string) {
        super(code)
        this.name = 'PaylovOAuthTokenError'
    }
}

interface PaylovOAuthTokenManagerOptions {
    credentials: PaylovOAuthCredentials
    requestToken: (grant: PaylovTokenGrant) => Promise<PaylovTokenResponse>
    shouldFallbackFromRefresh?: (error: unknown) => boolean
    now?: () => number
    refreshSkewMs?: number
}

function validSecret(value: unknown): value is string {
    return typeof value === 'string'
        && value.length >= 8
        && value.length <= 8192
        && !/\s|[\u0000-\u001f\u007f]/.test(value)
}

function lifetimeMs(value: unknown, fallbackSeconds: number): number {
    const seconds = Number(value)
    if (!Number.isFinite(seconds) || seconds <= 0) return fallbackSeconds * 1000
    return Math.min(Math.floor(seconds), 31 * 24 * 60 * 60) * 1000
}

export class PaylovOAuthTokenManager {
    private readonly now: () => number
    private readonly refreshSkewMs: number
    private state: PaylovTokenState | null = null
    private inFlight: Promise<string> | null = null

    constructor(private readonly options: PaylovOAuthTokenManagerOptions) {
        this.now = options.now || Date.now
        this.refreshSkewMs = options.refreshSkewMs ?? 60_000
    }

    isConfigured(): boolean {
        const { consumerKey, consumerSecret, username, password } = this.options.credentials
        return [consumerKey, consumerSecret, username, password].every(value => value.trim().length > 0)
    }

    clearAccessToken(): void {
        if (!this.state) return
        this.state.accessExpiresAt = 0
    }

    clearAll(): void {
        this.state = null
    }

    async getAccessToken(): Promise<string> {
        if (!this.isConfigured()) throw new PaylovOAuthTokenError('paylov_oauth_credentials_missing')
        const now = this.now()
        if (this.state && now + this.refreshSkewMs < this.state.accessExpiresAt) {
            return this.state.accessToken
        }
        if (this.inFlight) return this.inFlight

        this.inFlight = this.obtainAccessToken().finally(() => {
            this.inFlight = null
        })
        return this.inFlight
    }

    private async obtainAccessToken(): Promise<string> {
        const now = this.now()
        if (this.state && now + this.refreshSkewMs < this.state.refreshExpiresAt) {
            try {
                return await this.exchange({
                    grantType: 'refresh_token',
                    refreshToken: this.state.refreshToken,
                })
            } catch (error) {
                if (this.options.shouldFallbackFromRefresh
                    && !this.options.shouldFallbackFromRefresh(error)) {
                    throw error
                }
                // Refresh token bekor qilingan/eskirgan bo'lsa password grant bilan
                // yangi token juftligi olinadi. Ikkala token chaqiruvi ham idempotent.
                this.state = null
            }
        }

        return this.exchange({
            grantType: 'password',
            username: this.options.credentials.username,
            password: this.options.credentials.password,
        })
    }

    private async exchange(grant: PaylovTokenGrant): Promise<string> {
        const response = await this.options.requestToken(grant)
        if (!validSecret(response.access_token) || !validSecret(response.refresh_token)) {
            throw new PaylovOAuthTokenError('paylov_oauth_invalid_token_response')
        }
        if (response.token_type != null && String(response.token_type).toLowerCase() !== 'bearer') {
            throw new PaylovOAuthTokenError('paylov_oauth_invalid_token_type')
        }

        const issuedAt = this.now()
        this.state = {
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
            accessExpiresAt: issuedAt + lifetimeMs(response.expires_in, 3600),
            refreshExpiresAt: issuedAt + lifetimeMs(response.refresh_expires_in, 604800),
        }
        return this.state.accessToken
    }
}
