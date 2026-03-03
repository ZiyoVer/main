import { useState } from 'react'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

export default function AdminLogin() {
    const nav = useNavigate()
    const login = useAuthStore(s => s.login)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPw, setShowPw] = useState(false)
    const [err, setErr] = useState('')
    const [loading, setLoading] = useState(false)

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setErr('')
        localStorage.removeItem('token')
        try {
            const data = await fetchApi('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
            if (data.user.role === 'STUDENT') {
                setErr("Faqat Admin va O'qituvchilar kirishi mumkin")
                setLoading(false)
                return
            }
            login(data.token, data.user)
            nav(data.user.role === 'ADMIN' ? '/boshqaruv' : '/oqituvchi')
        } catch (e: any) {
            setErr(e.message)
        }
        setLoading(false)
    }

    return (
        <div
            className="min-h-screen flex items-center justify-center p-5"
            style={{ background: 'var(--bg-page)' }}
        >
            <div className="w-full max-w-sm anim-up">

                {/* Icon */}
                <div className="flex justify-center mb-8">
                    <div
                        className="h-14 w-14 rounded-2xl flex items-center justify-center"
                        style={{ background: 'var(--bg-surface)', border: '1.5px solid var(--border)' }}
                    >
                        <ShieldCheck className="h-7 w-7" style={{ color: 'var(--brand)' }} />
                    </div>
                </div>

                <div className="card" style={{ padding: '2rem' }}>
                    <div className="text-center mb-6">
                        <h1 className="text-xl font-bold mb-1">Boshqaruv Kirishi</h1>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Faqat Admin va O'qituvchilar uchun
                        </p>
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
                                placeholder="admin@misol.uz"
                                className="input"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium block mb-1.5">Parol</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
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
                            {loading ? 'Tekshirilmoqda...' : 'Kirish'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
