import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

export default function AdminLogin() {
    const nav = useNavigate()
    const login = useAuthStore(s => s.login)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [err, setErr] = useState('')
    const [loading, setLoading] = useState(false)

    const submit = async (e: React.FormEvent) => {
        e.preventDefault(); setLoading(true); setErr('')
        localStorage.removeItem('token')
        try {
            const data = await fetchApi('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
            if (data.user.role === 'STUDENT') { setErr('Faqat admin va o\'qituvchilar kirishi mumkin'); setLoading(false); return }
            login(data.token, data.user)
            nav(data.user.role === 'ADMIN' ? '/admin' : '/teacher')
        } catch (e: any) { setErr(e.message) }
        setLoading(false)
    }

    return (
        <div className="h-screen bg-gray-950 flex items-center justify-center p-6 relative overflow-y-auto w-full">
            <div className="absolute top-10 left-20 w-72 h-72 bg-red-500/10 rounded-full blur-3xl" />
            <div className="w-full max-w-sm glass rounded-3xl p-8 anim-up">
                <div className="text-center mb-7">
                    <div className="text-3xl mb-2">🛡️</div>
                    <h1 className="text-xl font-bold text-white">Boshqaruv Paneli</h1>
                    <p className="text-sm text-gray-400">Faqat Admin va O'qituvchilar</p>
                </div>
                {err && <div className="bg-red-500/10 text-red-400 text-sm px-4 py-2.5 rounded-xl mb-4">{err}</div>}
                <form onSubmit={submit} className="space-y-4">
                    <input type="email" placeholder="Email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:border-red-500 outline-none text-sm" />
                    <div className="relative">
                        <input type={showPassword ? "text" : "password"} placeholder="Parol" required value={password} onChange={e => setPassword(e.target.value)} className="w-full h-11 px-4 pr-10 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:border-red-500 outline-none text-sm" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition">
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    <button type="submit" disabled={loading} className="w-full h-11 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50">
                        {loading ? 'Tekshirilmoqda...' : 'Kirish'}
                    </button>
                </form>
            </div>
        </div>
    )
}
