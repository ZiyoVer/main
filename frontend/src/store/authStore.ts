import { create } from 'zustand'

interface User { id: string; email: string; name: string; role: string; emailVerified?: boolean }

interface AuthState {
    token: string | null
    user: User | null
    login: (token: string, user: User) => void
    // Sessiyani redirect'siz tozalaydi (login sahifalarida eski sessiya izini o'chirish uchun)
    clearSession: () => void
    // To'liq chiqish: sessiya tozalanadi va bosh sahifaga qaytadi
    logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
    token: localStorage.getItem('token'),
    user: (() => { try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null } })(),
    login: (token, user) => {
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(user))
        set({ token, user })
    },
    clearSession: () => {
        // localStorage BILAN birga store state ham tozalanadi — faqat localStorage
        // tozalansa xotiradagi eski user/token bilan desync bo'lardi
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        set({ token: null, user: null })
    },
    logout: () => {
        // P0-04: serverda tokenni blacklist qilamiz — o'g'irlangan/eski token qayta ishlatilmasin.
        // keepalive: redirect darhol bo'lsa ham request yetkaziladi; offline bo'lsa .catch bilan
        // yutiladi va lokal chiqish baribir bajariladi (user "chiqolmay" qolmaydi).
        const token = localStorage.getItem('token')
        if (token) {
            fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                keepalive: true,
            }).catch(() => { /* offline yoki server xato — lokal chiqish davom etadi */ })
        }
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/'
    }
}))
