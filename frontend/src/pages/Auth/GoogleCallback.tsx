import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { fetchApi } from '@/lib/api'
import { consumeGoogleReturnTo, readGoogleCallback, readGoogleError, startGoogleLogin } from '@/lib/googleAuth'

/* Google redirect oqimining qaytish nuqtasi (/auth/google/callback).
   URL fragment'dan id_token olinadi → /auth/google'ga yuboriladi → JWT → tizimga kirish.
   Xato bo'lsa — avtomatik yo'naltirmaymiz; foydalanuvchi o'qib, tugma orqali qaror qiladi. */

export default function GoogleCallback() {
    const nav = useNavigate()
    const login = useAuthStore(s => s.login)
    const ran = useRef(false)
    const [err, setErr] = useState<string | null>(null)
    const [retrying, setRetrying] = useState(false)

    useEffect(() => {
        if (ran.current) return
        ran.current = true

        const gErr = readGoogleError()
        if (gErr) { setErr('Google rad etdi: ' + gErr); return }

        const cb = readGoogleCallback()
        if (!cb) { setErr('Kirish ma\'lumotlari topilmadi yoki muddati o\'tdi.'); return }

        fetchApi('/auth/google', {
            method: 'POST',
            body: JSON.stringify({ credential: cb.idToken, nonce: cb.nonce }),
            authFailure: 'throw',
        })
            .then((data: { token: string; user: { role?: string } }) => {
                login(data.token, data.user as never)
                const role = data.user?.role
                const returnTo = role === 'STUDENT' ? consumeGoogleReturnTo() : null
                const hasGuestResult = !!localStorage.getItem('dtmmax_guest_test_result')
                const to = role === 'ADMIN'
                    ? '/boshqaruv'
                    : role === 'TEACHER'
                        ? '/oqituvchi'
                        : returnTo || (hasGuestResult ? '/suhbat?analyzeTest=1' : '/bugun')
                nav(to, { replace: true })
            })
            .catch((e: unknown) => {
                setErr(e instanceof Error ? e.message : 'Google orqali kirish amalga oshmadi')
            })
    }, [login, nav])

    async function retry() {
        setRetrying(true)
        try {
            const cfg = await fetchApi('/auth/config') as { googleClientId?: string | null }
            if (cfg?.googleClientId) { startGoogleLogin(cfg.googleClientId); return }
        } catch { /* config olinmadi — kirish sahifasiga qaytamiz */ }
        setRetrying(false)
        nav('/kirish', { replace: true })
    }

    return (
        <div className="kelviq min-h-screen flex flex-col items-center justify-center gap-4 p-5" style={{ background: 'var(--bg-page)' }}>
            {!err ? (
                <>
                    <div style={{
                        width: 40, height: 40, border: '3px solid var(--border)',
                        borderTopColor: 'var(--brand)', borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                    }} />
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Google orqali kirilmoqda…</p>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </>
            ) : (
                <div className="w-full max-w-sm card text-center" style={{ padding: '1.75rem' }}>
                    <p className="text-sm mb-4" style={{ color: 'var(--danger)' }}>{err}</p>
                    <div className="flex flex-col gap-2">
                        <button onClick={retry} disabled={retrying} className="btn btn-primary" style={{ width: '100%' }}>
                            {retrying ? 'Yo\'naltirilmoqda…' : 'Qaytadan urinish'}
                        </button>
                        <button onClick={() => nav('/kirish', { replace: true })} className="btn" style={{ width: '100%' }}>
                            Kirish sahifasiga qaytish
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
