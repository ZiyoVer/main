import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { BrainCircuit, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

export default function EmailVerify() {
    const { token } = useParams<{ token: string }>()
    const { user, login, token: authToken } = useAuthStore()
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
    const [message, setMessage] = useState('')

    useEffect(() => {
        if (!token) { setStatus('error'); setMessage('Noto\'g\'ri havola'); return }
        fetchApi(`/auth/verify-email/${token}`, { method: 'GET' })
            .then(() => {
                setStatus('success')
                // authStore da user ni yangilash — /auth/me orqali yangi user'ni olib kelamiz,
                // shunda VerifyEmailNotice polling'i ham, ProtectedRoute ham yangilangan holatni ko'radi.
                if (authToken) {
                    fetchApi('/auth/me', { silent: true })
                        .then(me => login(authToken, me))
                        .catch(() => {
                            // /auth/me muvaffaqiyatsiz bo'lsa — mavjud user'ni patch qilamiz
                            if (user) login(authToken, { ...user, emailVerified: true })
                        })
                }
            })
            .catch((e: unknown) => {
                setStatus('error')
                const msg = e instanceof Error ? e.message : ''
                setMessage(msg || 'Havola noto\'g\'ri yoki muddati o\'tgan')
            })
    }, [token])

    // Havola qaysi brauzerda ochilganiga qarab CTA: token bo'lsa to'g'ridan-to'g'ri
    // platformaga (/suhbat); token bo'lmasa (mobil pochta-brauzeri) /kirish'ga —
    // aks holda ProtectedRoute jim ravishda /kirish'ga otib, chalkash dead-end bo'ladi.
    const hasToken = !!authToken
    const successTo = hasToken ? '/suhbat' : '/kirish'
    const successCta = hasToken ? 'Platformaga kirish' : 'Kirish sahifasiga o\'tish'

    return (
        <div className="kelviq min-h-screen flex items-center justify-center p-5" style={{ background: 'var(--bg-page)', position: 'relative', overflow: 'hidden' }}>
            {/* Faint technical texture behind the card */}
            <div
                className="k-tex-dots"
                aria-hidden="true"
                style={{ position: 'absolute', inset: 0, zIndex: 0 }}
            />

            <div className="w-full max-w-sm anim-up" style={{ position: 'relative', zIndex: 1 }}>
                <div className="flex items-center gap-2 justify-center mb-8">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--k-accent-grad)' }}>
                        <BrainCircuit className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-bold text-xl tracking-tight">DTM<span className="k-italic">Max</span></span>
                </div>

                <div className="card text-center" style={{ padding: '2.5rem 2rem' }}>
                    {status === 'loading' && (
                        <>
                            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin" style={{ color: 'var(--brand)' }} />
                            <span className="k-eyebrow">TASDIQLASH</span>
                            <h2 className="text-lg font-bold mb-2 mt-2">Tekshi<span className="k-italic">rilmoqda</span>...</h2>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                Email manzil tasdiqlanmoqda, kuting...
                            </p>
                        </>
                    )}
                    {status === 'success' && (
                        <>
                            <CheckCircle className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--success)' }} />
                            <h2 className="text-lg font-bold mb-2">Email <span className="k-italic">tasdiqlandi</span>!</h2>
                            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                                {hasToken
                                    ? 'Email manzilingiz muvaffaqiyatli tasdiqlandi. Endi barcha imkoniyatlar ochiq!'
                                    : 'Email manzilingiz tasdiqlandi. Endi kirib, davom etishingiz mumkin.'}
                            </p>
                            <Link to={successTo} className="btn btn-primary">
                                {successCta}
                            </Link>
                        </>
                    )}
                    {status === 'error' && (
                        <>
                            <XCircle className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--danger)' }} />
                            <h2 className="text-lg font-bold mb-2">Tasdiqlash <span className="k-italic">muvaffaqiyatsiz</span></h2>
                            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                                {message}
                            </p>
                            <div className="flex flex-col gap-3">
                                <Link to={successTo} className="btn btn-primary">
                                    {successCta}
                                </Link>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    Platformaga kirib, yangi tasdiqlash havolasini so'rashingiz mumkin.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
