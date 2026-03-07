import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BrainCircuit, ArrowLeft, Mail, CheckCircle } from 'lucide-react'
import { fetchApi } from '@/lib/api'

export default function ForgotPassword() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState('')
    const [sent, setSent] = useState(false)

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setErr('')
        try {
            await fetchApi('/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email })
            })
            setSent(true)
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
                    <span className="font-bold text-xl tracking-tight">BallMax</span>
                </div>

                <div className="card" style={{ padding: '2rem' }}>
                    {sent ? (
                        <div className="text-center">
                            <div className="flex justify-center mb-4">
                                <CheckCircle className="h-12 w-12" style={{ color: 'var(--success)' }} />
                            </div>
                            <h2 className="text-lg font-bold mb-2">Email yuborildi!</h2>
                            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                Agar <strong>{email}</strong> manzili ro'yxatda bo'lsa, parol tiklash havolasi yuborildi.
                                Spam/Junk papkasini ham tekshiring.
                            </p>
                            <Link
                                to="/kirish"
                                className="btn btn-primary"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Kirish sahifasiga qaytish
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-3 mb-5">
                                <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand-light)' }}>
                                    <Mail className="h-5 w-5" style={{ color: 'var(--brand)' }} />
                                </div>
                                <div>
                                    <h1 className="text-lg font-bold">Parolni tiklash</h1>
                                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                        Email manzilingizni kiriting
                                    </p>
                                </div>
                            </div>

                            {err && (
                                <div className="text-sm px-3.5 py-2.5 rounded-lg mb-4" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
                                    {err}
                                </div>
                            )}

                            <form onSubmit={submit} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium block mb-1.5">Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="email@misol.uz"
                                        className="input"
                                        autoFocus
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn btn-primary"
                                    style={{ width: '100%' }}
                                >
                                    {loading ? 'Yuborilmoqda...' : 'Tiklash havolasini yuborish'}
                                </button>
                            </form>
                        </>
                    )}
                </div>

                {!sent && (
                    <p className="text-center text-sm mt-5" style={{ color: 'var(--text-secondary)' }}>
                        <Link to="/kirish" className="font-semibold inline-flex items-center gap-1" style={{ color: 'var(--brand)' }}>
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Kirishga qaytish
                        </Link>
                    </p>
                )}
            </div>
        </div>
    )
}
