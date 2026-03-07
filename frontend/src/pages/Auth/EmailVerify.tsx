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
                // authStore da user ni yangilash
                if (user && authToken) {
                    login(authToken, { ...user, emailVerified: true })
                }
            })
            .catch((e: any) => {
                setStatus('error')
                setMessage(e.message || 'Havola noto\'g\'ri yoki muddati o\'tgan')
            })
    }, [token])

    return (
        <div className="min-h-screen flex items-center justify-center p-5" style={{ background: 'var(--bg-page)' }}>
            <div className="w-full max-w-sm anim-up">
                <div className="flex items-center gap-2 justify-center mb-8">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--brand)' }}>
                        <BrainCircuit className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-bold text-xl tracking-tight">DTMMax</span>
                </div>

                <div className="card text-center" style={{ padding: '2.5rem 2rem' }}>
                    {status === 'loading' && (
                        <>
                            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin" style={{ color: 'var(--brand)' }} />
                            <h2 className="text-lg font-bold mb-2">Tekshirilmoqda...</h2>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                Email manzil tasdiqlanmoqda, kuting...
                            </p>
                        </>
                    )}
                    {status === 'success' && (
                        <>
                            <CheckCircle className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--success)' }} />
                            <h2 className="text-lg font-bold mb-2">Email tasdiqlandi!</h2>
                            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                                Email manzilingiz muvaffaqiyatli tasdiqlandi. Endi barcha imkoniyatlar ochiq!
                            </p>
                            <Link to="/suhbat" className="btn btn-primary">
                                Platformaga kirish
                            </Link>
                        </>
                    )}
                    {status === 'error' && (
                        <>
                            <XCircle className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--danger)' }} />
                            <h2 className="text-lg font-bold mb-2">Tasdiqlash muvaffaqiyatsiz</h2>
                            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                                {message}
                            </p>
                            <div className="flex flex-col gap-3">
                                <Link to="/suhbat" className="btn btn-primary">
                                    Platformaga kirish
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
