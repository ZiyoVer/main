import { create } from 'zustand'

export interface AuthUser {
    id: string
    email: string
    name: string
    role: string
    status?: string
    emailVerified?: boolean
    passwordConfigured?: boolean
}

function readStoredUser(): AuthUser | null {
    try {
        return JSON.parse(localStorage.getItem('user') || 'null')
    } catch {
        return null
    }
}

interface AuthState {
    token: string | null
    user: AuthUser | null
    // localStorage keshi server tomonidan tekshirilmaguncha route qarori chiqarmaymiz.
    hydrated: boolean
    login: (token: string, user: AuthUser) => void
    restore: (token: string, user: AuthUser) => void
    beginHydration: () => void
    markHydrated: () => void
    syncFromStorage: () => void
    // Sessiyani redirect'siz tozalaydi (login sahifalarida eski sessiya izini o'chirish uchun)
    clearSession: () => void
    // To'liq chiqish: sessiya tozalanadi va bosh sahifaga qaytadi
    logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
    token: localStorage.getItem('token'),
    user: readStoredUser(),
    hydrated: false,
    login: (token, user) => {
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(user))
        set({ token, user, hydrated: true })
    },
    // Boot-time /auth/me natijasi. `login`dan alohida: bu boshqa tablarda
    // storage-event loop hosil qilmaydi va faqat server tasdiqlagan userni saqlaydi.
    restore: (token, user) => {
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(user))
        set({ token, user, hydrated: true })
    },
    beginHydration: () => set({ hydrated: false }),
    markHydrated: () => set({ hydrated: true }),
    syncFromStorage: () => {
        const token = localStorage.getItem('token')
        set(state => ({
            token,
            user: readStoredUser(),
            // Xuddi shu token uchun boshqa tab serverdan yangilangan userni yozgan
            // bo'lishi mumkin. Bunda joriy tabni qayta loaderda qotirmaymiz. Token
            // haqiqatan almashsa esa yangi session `/auth/me` orqali tekshiriladi.
            hydrated: token === state.token ? state.hydrated : !token,
        }))
    },
    clearSession: () => {
        // localStorage BILAN birga store state ham tozalanadi — faqat localStorage
        // tozalansa xotiradagi eski user/token bilan desync bo'lardi
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        set({ token: null, user: null, hydrated: true })
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
        set({ token: null, user: null, hydrated: true })
        window.location.href = '/'
    }
}))
