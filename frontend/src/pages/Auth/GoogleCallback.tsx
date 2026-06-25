import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { fetchApi } from '@/lib/api'
import { readGoogleCallback, readGoogleError } from '@/lib/googleAuth'

/* Google redirect oqimining qaytish nuqtasi (/auth/google/callback).
   URL fragment'dan id_token olinadi → /auth/google'ga yuboriladi → JWT → tizimga kirish. */

export default function GoogleCallback() {
    const nav = useNavigate()
    const login = useAuthStore(s => s.login)
    const ran = useRef(false)
    const [err, setErr] = useState<string | null>(null)

    useEffect(() => {
        if (ran.current) return
        ran.current = true

        const gErr = readGoogleError()
        if (gErr) {
            setErr('Google rad etdi: ' + gErr)
            setTimeout(() => nav('/kirish', { replace: true }), 2500)
            return
        }

        const cb = readGoogleCallback()
        if (!cb) {
            setErr('Kirish ma\'lumotlari topilmadi yoki muddati o\'tdi.')
            setTimeout(() => nav('/kirish', { replace: true }), 2500)
            return
        }

        fetchApi('/auth/google', {
            method: 'POST',
            body: JSON.stringify({ credential: cb.idToken, nonce: cb.nonce }),
        })
            .then((data: { token: string; user: { role?: string } }) => {
                login(data.token, data.user as never)
                const role = data.user?.role
                const to = role === 'ADMIN' ? '/boshqaruv' : role === 'TEACHER' ? '/oqituvchi' : '/suhbat'
                nav(to, { replace: true })
            })
            .catch((e: unknown) => {
                setErr(e instanceof Error ? e.message : 'Google orqali kirish amalga oshmadi')
                setTimeout(() => nav('/kirish', { replace: true }), 2500)
            })
    }, [login, nav])

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
                <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>{err}<br />Kirish sahifasiga qaytmoqda…</p>
            )}
        </div>
    )
}
