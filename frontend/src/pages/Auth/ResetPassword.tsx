import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { BrainCircuit, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react'
import { fetchApi } from '@/lib/api'

export default function ResetPassword() {
    const { token } = useParams<{ token: string }>()
    const nav = useNavigate()
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [showPw, setShowPw] = useState(false)
    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState('')
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        if (!token) nav('/kirish', { replace: true })
    }, [token])

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password !== confirm) {
            setErr('Parollar bir-biriga mos kelmaydi')
            return
        }
        setLoading(true)
        setErr('')
        try {
            await fetchApi('/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({ token, password })
            })
            setSuccess(true)
            setTimeout(() => nav('/kirish', { replace: true }), 3000)
        } catch (e: any) {
            setErr(e.message)
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-5" style={{ background: 'var(--bg-page)' }}>
            <div className="w-full max-w-sm anim-up">
                <div className="flex items-center gap-2 justify-center mb-8">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--brand)' }}>
                        <BrainCircuit className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-bold text-xl tracking-tight">DTMMax</span>
                </div>

                <div className="card" style={{ padding: '2rem' }}>
                    {success ? (
                        <div className="text-center">
                            <div className="flex justify-center mb-4">
                                <CheckCircle className="h-12 w-12" style={{ color: 'var(--success)' }} />
                            </div>
                            <h2 className="text-lg font-bold mb-2">Parol yangilandi!</h2>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                Yangi parolingiz o'rnatildi. Kirish sahifasiga yo'naltirilmoqda...
                            </p>
                        </div>
                    ) : (
                        <>
                            <h1 className="text-xl font-bold mb-1">Yangi parol o'rnatish</h1>
                            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                                Kamida 8 ta belgi, harf va raqam bo'lishi shart
                            </p>

                            {err && (
                                <div className="text-sm px-3.5 py-2.5 rounded-lg mb-4 flex items-start gap-2" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
                                    <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                    {err}
                                </div>
                            )}

                            <form onSubmit={submit} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium block mb-1.5">Yangi parol</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showPw ? 'text' : 'password'}
                                            required
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="input"
                                            style={{ paddingRight: '2.75rem' }}
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPw(!showPw)}
                                            style={{
                                                position: 'absolute', right: '0.75rem', top: '50%',
                                                transform: 'translateY(-50%)', color: 'var(--text-muted)',
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center'
                                            }}
                                        >
                                            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium block mb-1.5">Parolni tasdiqlash</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showPw ? 'text' : 'password'}
                                            required
                                            value={confirm}
                                            onChange={e => setConfirm(e.target.value)}
                                            placeholder="••••••••"
                                            className="input"
                                            style={{ paddingRight: '2.75rem' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPw(!showPw)}
                                            style={{
                                                position: 'absolute', right: '0.75rem', top: '50%',
                                                transform: 'translateY(-50%)', color: 'var(--text-muted)',
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center'
                                            }}
                                        >
                                            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn btn-primary"
                                    style={{ width: '100%' }}
                                >
                                    {loading ? 'Saqlanmoqda...' : 'Parolni yangilash'}
                                </button>
                            </form>
                        </>
                    )}
                </div>

                {!success && (
                    <p className="text-center text-sm mt-5" style={{ color: 'var(--text-secondary)' }}>
                        <Link to="/kirish" className="font-semibold" style={{ color: 'var(--brand)' }}>
                            Kirishga qaytish
                        </Link>
                    </p>
                )}
            </div>
        </div>
    )
}
