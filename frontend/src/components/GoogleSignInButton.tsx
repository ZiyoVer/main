import { useEffect, useState } from 'react'
import { fetchApi } from '@/lib/api'
import { startGoogleLogin } from '@/lib/googleAuth'

/* "Google bilan kirish" tugmasi — to'liq sahifa redirect oqimi (popup/iframe/cookie YO'Q).
   Client ID runtime'da /auth/config'dan olinadi. Client ID bo'lmasa hech narsa ko'rinmaydi. */

function GoogleG() {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" />
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z" />
        </svg>
    )
}

export default function GoogleSignInButton() {
    const [clientId, setClientId] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        fetchApi('/auth/config')
            .then((cfg: { googleClientId?: string | null }) => {
                if (!cancelled && cfg?.googleClientId) setClientId(cfg.googleClientId)
            })
            .catch(() => { /* config olinmadi — tugma chiqmaydi */ })
        return () => { cancelled = true }
    }, [])

    if (!clientId) return null

    return (
        <>
            <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>yoki</span>
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>
            <button
                type="button"
                onClick={() => startGoogleLogin(clientId)}
                className="w-full flex items-center justify-center gap-2.5 rounded-full font-medium transition-colors"
                style={{
                    height: 44,
                    background: 'var(--bg-card, #fff)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-page)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card, #fff)' }}
            >
                <GoogleG />
                Google bilan kirish
            </button>
        </>
    )
}
