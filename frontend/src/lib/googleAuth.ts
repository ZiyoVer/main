/* Google bilan kirish — to'liq sahifa redirect (OpenID Connect implicit, response_type=id_token).
   Popup/iframe/third-party cookie ISHLATMAYDI → Safari, Telegram/Instagram in-app va
   barcha brauzerlarда ishlaydi. Google o'z sahifasida akkaunt tanlatadi, so'ng bizning
   /auth/google/callback ga id_token bilan qaytaradi. Client secret kerak emas. */

function randomString(len = 32): string {
    const bytes = new Uint8Array(len)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

const STATE_KEY = 'g_oauth_state'
const NONCE_KEY = 'g_oauth_nonce'
const RETURN_KEY = 'g_oauth_return_to'

export function safeGoogleReturnTo(value: unknown): string | null {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null
    if (value === '/bugun' || value === '/suhbat' || value === '/chat') return value
    if (value.startsWith('/suhbat/') || value.startsWith('/chat/') || value.startsWith('/test/')) return value
    return null
}

export function startGoogleLogin(clientId: string, returnTo?: unknown) {
    const state = randomString()
    const nonce = randomString()
    sessionStorage.setItem(STATE_KEY, state)
    sessionStorage.setItem(NONCE_KEY, nonce)
    const safeReturnTo = safeGoogleReturnTo(returnTo)
    if (safeReturnTo) sessionStorage.setItem(RETURN_KEY, safeReturnTo)
    else sessionStorage.removeItem(RETURN_KEY)

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: window.location.origin + '/auth/google/callback',
        response_type: 'id_token',
        scope: 'openid email profile',
        nonce,
        state,
        prompt: 'select_account',
    })
    window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString()
}

export function consumeGoogleReturnTo(): string | null {
    const value = safeGoogleReturnTo(sessionStorage.getItem(RETURN_KEY))
    sessionStorage.removeItem(RETURN_KEY)
    return value
}

/* Callback sahifasida URL fragment'ini o'qish + state tekshirish.
   { idToken, nonce } qaytaradi yoki xato bo'lsa null. */
export function readGoogleCallback(): { idToken: string; nonce: string } | null {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const idToken = hash.get('id_token')
    const state = hash.get('state')
    const expectedState = sessionStorage.getItem(STATE_KEY)
    const nonce = sessionStorage.getItem(NONCE_KEY) || ''
    sessionStorage.removeItem(STATE_KEY)
    sessionStorage.removeItem(NONCE_KEY)
    if (!idToken || !state || state !== expectedState) return null
    return { idToken, nonce }
}

/* Google qaytargan xatoni (#error=...) o'qish — diagnostika uchun. */
export function readGoogleError(): string | null {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    return hash.get('error')
}
