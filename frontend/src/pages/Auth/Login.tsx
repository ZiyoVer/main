import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { BrainCircuit, Eye, EyeOff } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

export default function Login() {
    const nav = useNavigate()
    const location = useLocation()
    const from = (location.state as any)?.from
    const login = useAuthStore(s => s.login)
    const { token, user } = useAuthStore()

    useEffect(() => {
        if (token && user) {
            if (from) nav(from, { replace: true })
            else if (user.role === 'ADMIN') nav('/admin', { replace: true })
            else if (user.role === 'TEACHER') nav('/teacher', { replace: true })
            else nav('/chat', { replace: true })
        }
    }, [])

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
            login(data.token, data.user)
            if (from) nav(from, { replace: true })
            else if (data.user.role === 'ADMIN') nav('/admin')
            else if (data.user.role === 'TEACHER') nav('/teacher')
            else nav('/chat')
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

                {/* Logo */}
                <div className="flex items-center gap-2 justify-center mb-8">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--brand)' }}>
                        <BrainCircuit className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-bold text-xl tracking-tight">msert</span>
                </div>

                {/* Card */}
                <div className="card" style={{ padding: '2rem' }}>
                    <h1 className="text-xl font-bold mb-1">Xush kelibsiz!</h1>
                    <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                        Platformaga kirish
                    </p>

                    {err && (
                        <div
                            className="text-sm px-3.5 py-2.5 rounded-lg mb-4"
                            style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}
                        >
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
                                    {showPw
                                        ? <EyeOff className="h-4 w-4" />
                                        : <Eye className="h-4 w-4" />
                                    }
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

                <p className="text-center text-sm mt-5" style={{ color: 'var(--text-secondary)' }}>
                    Akkaunt yo'qmi?{' '}
                    <Link to="/royxat" className="font-semibold" style={{ color: 'var(--brand)' }}>
                        Ro'yxatdan o'tish
                    </Link>
                </p>
            </div>
        </div>
    )
}
