export const API = '/api'

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('token')
    const headers = new Headers(options.headers || {})
    headers.set('Content-Type', 'application/json')
    if (token) headers.set('Authorization', `Bearer ${token}`)

    const res = await fetch(`${API}${endpoint}`, { ...options, headers })
    const text = await res.text()
    let data: any
    try { data = text ? JSON.parse(text) : {} } catch { data = text }
    if (!res.ok) throw new Error(data?.error || 'Server xatoligi')
    return data
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
