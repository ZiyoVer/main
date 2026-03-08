import toast from 'react-hot-toast'

export const API = '/api'

export async function fetchApi(endpoint: string, options: RequestInit & { signal?: AbortSignal } = {}) {
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
            return Promise.reject(new Error('Sessiya muddati tugadi. Qayta kiring.'))
        }
        if (!res.ok) {
            const errName = data?.error || 'Server xatoligi'
            const err = new Error(errName)
            toast.error(err.message, {
                duration: 4000,
                id: 'api-error' // To prevent duplicate toasts
            })
            throw err
        }
        return data
    } catch (e: any) {
        if (e.message !== 'Sessiya muddati tugadi. Qayta kiring.') {
            if (import.meta.env.DEV) {
                console.error('API Error:', e)
            }
        }
        throw e
    }
}

export async function uploadFile(endpoint: string, formData: FormData) {
    const token = localStorage.getItem('token')
    const headers: HeadersInit = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${API}${endpoint}`, { method: 'POST', headers, body: formData })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Yuklashda xato')
    return data
}
