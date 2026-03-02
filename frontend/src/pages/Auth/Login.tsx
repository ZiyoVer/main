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
    const [email, setEmail] = useState('')

    // Already logged in — redirect
    useEffect(() => {
        if (token && user) {
            if (from) nav(from, { replace: true })
            else if (user.role === 'ADMIN') nav('/admin', { replace: true })
            else if (user.role === 'TEACHER') nav('/teacher', { replace: true })
            else nav('/chat', { replace: true })
        }
    }, [])
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [err, setErr] = useState('')
    const [loading, setLoading] = useState(false)

    const submit = async (e: React.FormEvent) => {
        e.preventDefault(); setLoading(true); setErr('');

        // Ensure stale tokens are cleared before initiating new login
        localStorage.removeItem('token')

        try {
            const data = await fetchApi('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
            login(data.token, data.user)
            if (from) nav(from, { replace: true })
            else if (data.user.role === 'ADMIN') nav('/admin')
            else if (data.user.role === 'TEACHER') nav('/teacher')
            else nav('/chat')
        } catch (e: any) { setErr(e.message) }
        setLoading(false)
    }

    return (
        <div className="min-h-screen bg-[#fafafa] flex">
            <div className="hidden lg:flex flex-1 bg-mesh-dark items-center justify-center relative overflow-hidden">
                <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl anim-float" />
                <div className="text-center z-10 anim-up">
                    <div className="h-16 w-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-xl shadow-blue-500/30">
                        <BrainCircuit className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-white mb-3">msert</h2>
                    <p className="text-gray-400 font-light max-w-xs">Milliy Sertifikat imtihonlariga aqlli tayyorgarlik</p>
                </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-sm anim-up">
                    <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Xush kelibsiz!</h1>
                    <p className="text-gray-500 mb-7 text-sm">Platformaga kirish</p>
                    {err && <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl mb-4">{err}</div>}
                    <form onSubmit={submit} className="space-y-4">
                        <div><label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
                            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition text-sm" />
                        </div>
                        <div><label className="text-sm font-medium text-gray-700 block mb-1">Parol</label>
                            <div className="relative">
                                <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className="w-full h-11 px-4 pr-10 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition text-sm" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <button type="submit" disabled={loading} className="w-full h-11 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/25 disabled:opacity-50 transition">
                            {loading ? 'Tekshirilmoqda...' : 'Kirish'}
                        </button>
                    </form>
                    <p className="mt-6 text-center text-sm text-gray-500">Akkaunt yo'qmi? <Link to="/register" className="font-semibold text-blue-600">Ro'yxatdan o'tish</Link></p>
                </div>
            </div>
        </div>
    )
}
