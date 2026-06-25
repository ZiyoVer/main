import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { fetchApi } from '@/lib/api'

/* Google bilan kirish (Google Identity Services).
   Client ID build-time VITE'dan EMAS — runtime'da backend /auth/config'dan olinadi.
   Shu sabab faqat 1 ta env kerak (GOOGLE_CLIENT_ID) va build kesh muammosi bo'lmaydi.
   Client ID bo'lmasa — hech narsa render qilmaydi (na divider, na tugma). */

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
    const [clientId, setClientId] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    // 1) Client ID'ni runtime'da backend'dan ol (build-time VITE shart emas)
    useEffect(() => {
        let cancelled = false
        fetchApi('/auth/config')
            .then((cfg: { googleClientId?: string | null }) => {
                if (!cancelled && cfg?.googleClientId) setClientId(cfg.googleClientId)
            })
            .catch(() => { /* config olinmadi — tugma chiqmaydi */ })
        return () => { cancelled = true }
    }, [])

    // 2) Client ID kelgach GSI tugmasini chizamiz
    useEffect(() => {
        if (!clientId) return
        let cancelled = false
        loadGsi()
            .then(() => {
                if (cancelled || !window.google?.accounts?.id || !ref.current) return
                window.google.accounts.id.initialize({
                    client_id: clientId,
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
                    locale: 'uz', // tugma matni o'zbekcha (brauzer tilidan qat'i nazar)
                })
            })
            .catch(() => { /* GSI yuklanmadi — tugma chiqmaydi */ })
        return () => { cancelled = true }
    }, [clientId, login, nav])

    // Client ID hali yo'q yoki sozlanmagan — na divider, na tugma
    if (!clientId) return null

    return (
        <>
            <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>yoki</span>
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>
            <div className="w-full flex justify-center" style={{ opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto' }}>
                <div ref={ref} className="w-full" style={{ minHeight: 44 }} />
            </div>
        </>
    )
}
