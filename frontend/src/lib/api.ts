import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'

export const API = '/api'

type ApiError = Error & {
    status?: number
    data?: any
}

type ApiOptions = RequestInit & {
    signal?: AbortSignal
    silent?: boolean
    // Public auth flowlar (login/Google) 401 javobini sahifaning o'zi ko'rsatadi.
    authFailure?: 'redirect' | 'throw'
}

function makeApiError(status: number, data: any, fallback: string): ApiError {
    const err = new Error(data?.error || fallback) as ApiError
    err.status = status
    err.data = data
    return err
}

function handleSessionFailure(status: number, data: any, token: string | null, mode: 'redirect' | 'throw'): never {
    const err = makeApiError(status, data, status === 401 ? 'Sessiya yaroqsiz' : 'Ruxsat yo‘q')

    if (mode === 'redirect' && token) {
        useAuthStore.getState().clearSession()
        const reason = data?.code === 'ACCOUNT_SUSPENDED' ? 'blocked' : 'session'
        if (window.location.pathname !== '/kirish') {
            window.location.assign(`/kirish?reason=${reason}`)
        }
    }

    throw err
}

export async function fetchApi(endpoint: string, options: ApiOptions = {}) {
    const token = localStorage.getItem('token')
    const { silent = false, authFailure = 'redirect', ...requestOptions } = options
    const headers = new Headers(requestOptions.headers || {})
    headers.set('Content-Type', 'application/json')
    if (token) headers.set('Authorization', `Bearer ${token}`)

    try {
        const res = await fetch(`${API}${endpoint}`, { ...requestOptions, headers })
        const text = await res.text()
        let data: any
        try { data = text ? JSON.parse(text) : {} } catch { data = text }
        if (res.status === 401) {
            handleSessionFailure(401, data, token, authFailure)
        }
        if (res.status === 403 && data?.code === 'ACCOUNT_SUSPENDED') {
            handleSessionFailure(403, data, token, authFailure)
        }
        if (res.status === 403 && data?.code === 'EMAIL_NOT_VERIFIED') {
            // Email tasdiqlanmagan — bloklash ekraniga yo'naltiramiz, generic toast ko'rsatmaymiz
            if (window.location.pathname !== '/email-tasdiqlang') {
                window.location.href = '/email-tasdiqlang'
            }
            const err = new Error('Email tasdiqlanmagan') as ApiError
            err.status = 403
            err.data = data
            return Promise.reject(err)
        }
        if (!res.ok) {
            const errName = data?.error || 'Server xatoligi'
            const err = new Error(errName) as ApiError
            err.status = res.status
            err.data = data
            if (!silent) {
                toast.error(err.message, { duration: 4000, id: 'api-error' })
            }
            throw err
        }
        return data
    } catch (e: any) {
        // AbortError — foydalanuvchi yoki cleanup tomonidan bekor qilingan, xabar ko'rsatmaymiz
        if (e.name === 'AbortError') throw e

        if (e?.status !== 401 && e?.data?.code !== 'ACCOUNT_SUSPENDED') {
            if (import.meta.env.DEV) {
                console.error('API Error:', e)
            }
            // Network xatoligi (offline)
            if (e instanceof TypeError && e.message === 'Failed to fetch') {
                if (!silent) {
                    toast.error('Internet aloqasi yo\'q', { id: 'network-error', duration: 3000 })
                }
            }
        }
        throw e
    }
}

export async function uploadFile(endpoint: string, formData: FormData, signal?: AbortSignal) {
    const token = localStorage.getItem('token')
    const headers: HeadersInit = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${API}${endpoint}`, { method: 'POST', headers, body: formData, signal })
    const text = await res.text()
    let data: any
    try { data = text ? JSON.parse(text) : {} } catch { data = text }
    if (res.status === 401 || (res.status === 403 && data?.code === 'ACCOUNT_SUSPENDED')) {
        handleSessionFailure(res.status, data, token, 'redirect')
    }
    if (res.status === 403 && data?.code === 'EMAIL_NOT_VERIFIED') {
        if (window.location.pathname !== '/email-tasdiqlang') {
            window.location.assign('/email-tasdiqlang')
        }
        throw makeApiError(403, data, 'Email tasdiqlanmagan')
    }
    if (!res.ok) {
        throw makeApiError(res.status, data, 'Yuklashda xato')
    }
    return data
}
