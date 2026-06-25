import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { fetchApi } from '@/lib/api'

/* Google bilan kirish (Google Identity Services).
   VITE_GOOGLE_CLIENT_ID o'rnatilmasa — hech narsa render qilmaydi (inert).
   GSI tugmasi → ID-token → POST /auth/google → login + yo'naltirish. */

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

interface GoogleIdApi {
    accounts: {
        id: {
            initialize: (cfg: { client_id: string; callback: (r: { credential?: string }) => void }) => void
            renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void
        }
    }
}
declare global {
    interface Window { google?: GoogleIdApi }
}

let gsiPromise: Promise<void> | null = null
function loadGsi(): Promise<void> {
    if (gsiPromise) return gsiPromise
    gsiPromise = new Promise<void>((resolve, reject) => {
        if (window.google?.accounts?.id) return resolve()
        const s = document.createElement('script')
        s.src = 'https://accounts.google.com/gsi/client'
        s.async = true
        s.defer = true
        s.onload = () => resolve()
        s.onerror = () => reject(new Error('GSI yuklanmadi'))
        document.head.appendChild(s)
    })
    return gsiPromise
}

export default function GoogleSignInButton() {
    const nav = useNavigate()
    const { login } = useAuthStore()
    const ref = useRef<HTMLDivElement>(null)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!GOOGLE_CLIENT_ID) return
        let cancelled = false
        loadGsi()
            .then(() => {
                if (cancelled || !window.google?.accounts?.id || !ref.current) return
                window.google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: async (resp) => {
                        if (!resp.credential) return
                        setBusy(true)
                        try {
                            const data = await fetchApi('/auth/google', { method: 'POST', body: JSON.stringify({ credential: resp.credential }) }) as { token: string; user: { role?: string } }
                            login(data.token, data.user as never)
                            const to = data.user?.role === 'ADMIN' ? '/boshqaruv' : data.user?.role === 'TEACHER' ? '/oqituvchi' : '/suhbat'
                            nav(to, { replace: true })
                        } catch (e) {
                            toast.error(e instanceof Error ? e.message : 'Google orqali kirish amalga oshmadi')
                        } finally {
                            setBusy(false)
                        }
                    },
                })
                const width = Math.min(ref.current.offsetWidth || 320, 400)
                window.google.accounts.id.renderButton(ref.current, {
                    type: 'standard', theme: 'outline', size: 'large', width,
                    text: 'continue_with', shape: 'pill', logo_alignment: 'center',
                })
            })
            .catch(() => { /* GSI yuklanmadi — tugma chiqmaydi */ })
        return () => { cancelled = true }
    }, [login, nav])

    if (!GOOGLE_CLIENT_ID) return null
    return (
        <div className="w-full flex justify-center" style={{ opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto' }}>
            <div ref={ref} className="w-full" style={{ minHeight: 44 }} />
        </div>
    )
}
