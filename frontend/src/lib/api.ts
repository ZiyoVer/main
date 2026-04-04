import toast from 'react-hot-toast'

export const API = '/api'

type ApiError = Error & {
    status?: number
    data?: any
}

export async function fetchApi(endpoint: string, options: RequestInit & { signal?: AbortSignal; silent?: boolean } = {}) {
    const token = localStorage.getItem('token')
    const headers = new Headers(options.headers || {})
    headers.set('Content-Type', 'application/json')
    if (token) headers.set('Authorization', `Bearer ${token}`)

    try {
        const res = await fetch(`${API}${endpoint}`, { ...options, headers, signal: options.signal })
        const text = await res.text()
        let data: any
        try { data = text ? JSON.parse(text) : {} } catch { data = text }
        if (res.status === 401) {
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            window.location.href = '/kirish'
            const err = new Error('Sessiya muddati tugadi. Qayta kiring.') as ApiError
            err.status = 401
            err.data = data
            return Promise.reject(err)
        }
        if (!res.ok) {
            const errName = data?.error || 'Server xatoligi'
            const err = new Error(errName) as ApiError
            err.status = res.status
            err.data = data
            if (!options.silent) {
                toast.error(err.message, { duration: 4000, id: 'api-error' })
            }
            throw err
        }
        return data
    } catch (e: any) {
        // AbortError — foydalanuvchi yoki cleanup tomonidan bekor qilingan, xabar ko'rsatmaymiz
        if (e.name === 'AbortError') throw e

        if (e.message !== 'Sessiya muddati tugadi. Qayta kiring.') {
            if (import.meta.env.DEV) {
                console.error('API Error:', e)
            }
            // Network xatoligi (offline)
            if (e instanceof TypeError && e.message === 'Failed to fetch') {
                if (!options.silent) {
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
    if (!res.ok) {
        const err = new Error(data?.error || 'Yuklashda xato') as ApiError
        err.status = res.status
        err.data = data
        throw err
    }
    return data
}
