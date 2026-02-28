import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { BrainCircuit } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

export default function Register() {
    const nav = useNavigate()
    const { token, user } = useAuthStore()

    // Already logged in — redirect
    useEffect(() => {
        if (token && user) nav('/chat', { replace: true })
    }, [])
    const [form, setForm] = useState({ name: '', email: '', password: '' })
    const [err, setErr] = useState('')
    const [loading, setLoading] = useState(false)

    const submit = async (e: React.FormEvent) => {
        e.preventDefault(); setLoading(true); setErr('')
        try {
            await fetchApi('/auth/register', { method: 'POST', body: JSON.stringify(form) })
            nav('/login')
        } catch (e: any) { setErr(e.message) }
        setLoading(false)
    }

    return (
        <div className="min-h-screen bg-[#fafafa] flex">
            <div className="hidden lg:flex flex-1 bg-mesh-dark items-center justify-center relative overflow-hidden">
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-emerald-500/8 rounded-full blur-3xl anim-float d2" />
                <div className="text-center z-10 anim-up">
                    <div className="h-16 w-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-xl shadow-blue-500/30">
                        <BrainCircuit className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-white mb-3">msert</h2>
                    <p className="text-gray-400 font-light max-w-xs">AI yordamida o'qib, milliy sertifikat oling</p>
                </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-sm anim-up">
                    <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Akkaunt yarating</h1>
                    <p className="text-gray-500 mb-7 text-sm">Bepul ro'yxatdan o'ting</p>
                    {err && <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl mb-4">{err}</div>}
                    <form onSubmit={submit} className="space-y-4">
                        <div><label className="text-sm font-medium text-gray-700 block mb-1">Ism</label>
                            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition text-sm" />
                        </div>
                        <div><label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
                            <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition text-sm" />
                        </div>
                        <div><label className="text-sm font-medium text-gray-700 block mb-1">Parol</label>
                            <input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition text-sm" />
                        </div>
                        <button type="submit" disabled={loading} className="w-full h-11 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/25 disabled:opacity-50 transition">
                            {loading ? 'Yaratilmoqda...' : 'Ro\'yxatdan O\'tish'}
                        </button>
                    </form>
                    <p className="mt-6 text-center text-sm text-gray-500">Akkauntingiz bormi? <Link to="/login" className="font-semibold text-blue-600">Kirish</Link></p>
                </div>
            </div>
        </div>
    )
}
