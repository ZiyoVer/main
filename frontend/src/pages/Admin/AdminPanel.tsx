import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrainCircuit, Users, UserCheck, GraduationCap, Clock, CalendarDays, CalendarRange, BarChart3, MessageSquare, FileText, Layers, Target, LogOut, Upload, Trash2, Plus, Activity } from 'lucide-react'
import { fetchApi, uploadFile } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

export default function AdminPanel() {
    const nav = useNavigate()
    const { logout } = useAuthStore()
    const [tab, setTab] = useState<'stats' | 'users' | 'teachers' | 'docs'>('stats')
    const [stats, setStats] = useState<any>(null)
    const [users, setUsers] = useState<any[]>([])
    const [docs, setDocs] = useState<any[]>([])
    const [tf, setTf] = useState({ name: '', email: '', password: '' })
    const [uploading, setUploading] = useState(false)
    const [docSubject, setDocSubject] = useState('Matematika')
    const [msg, setMsg] = useState('')
    const [creating, setCreating] = useState(false)

    useEffect(() => { loadAll() }, [])
    async function loadAll() {
        try { setStats(await fetchApi('/analytics/stats')) } catch { }
        try { setUsers(await fetchApi('/auth/users')) } catch { }
        try { setDocs(await fetchApi('/documents/list')) } catch { }
    }

    async function createTeacher(e: React.FormEvent) {
        e.preventDefault()
        if (creating) return
        setCreating(true); setMsg('')
        try {
            await fetchApi('/auth/create-teacher', { method: 'POST', body: JSON.stringify(tf) })
            setMsg('✓ O\'qituvchi muvaffaqiyatli yaratildi!')
            setTf({ name: '', email: '', password: '' })
            loadAll()
        } catch (e: any) { setMsg('✗ ' + e.message) }
        setCreating(false)
    }

    async function uploadDoc(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]; if (!file) return
        setUploading(true)
        try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('subject', docSubject)
            await uploadFile('/documents/upload', fd)
            loadAll()
        } catch { }
        setUploading(false)
        e.target.value = ''
    }

    async function deleteDoc(id: string) {
        if (!confirm('Hujjatni o\'chirmoqchimisiz?')) return
        try { await fetchApi(`/documents/${id}`, { method: 'DELETE' }); loadAll() } catch { }
    }

    const tabs = [
        { k: 'stats' as const, l: 'Statistika', icon: BarChart3 },
        { k: 'users' as const, l: 'Foydalanuvchilar', icon: Users },
        { k: 'teachers' as const, l: 'O\'qituvchi +', icon: UserCheck },
        { k: 'docs' as const, l: 'RAG Materiallar', icon: FileText },
    ]

    return (
        <div className="min-h-screen bg-[#fafafa]">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-40">
                <div className="max-w-6xl mx-auto flex items-center justify-between py-3 px-6">
                    <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center">
                            <BrainCircuit className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className="text-sm font-bold text-gray-900">msert</span>
                        <span className="text-[11px] text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-md">Admin</span>
                    </div>
                    <button onClick={() => { logout(); nav('/') }} className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100 transition">
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-6 py-8">
                {/* Tabs */}
                <div className="flex gap-1 mb-8 bg-gray-100 rounded-xl p-1 w-fit">
                    {tabs.map(t => (
                        <button key={t.k} onClick={() => setTab(t.k)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t.k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            <t.icon className="h-4 w-4" /> {t.l}
                        </button>
                    ))}
                </div>

                {/* === STATS === */}
                {tab === 'stats' && stats && (
                    <div className="space-y-6 anim-up">
                        {/* Kirish statistikasi */}
                        <div>
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Kirish statistikasi</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { n: stats.logins24h, l: 'Oxirgi 24 soat', icon: Clock, color: 'text-blue-600 bg-blue-50' },
                                    { n: stats.loginsWeek, l: 'Oxirgi 7 kun', icon: CalendarDays, color: 'text-emerald-600 bg-emerald-50' },
                                    { n: stats.loginsMonth, l: 'Oxirgi 30 kun', icon: CalendarRange, color: 'text-purple-600 bg-purple-50' },
                                    { n: stats.totalVisits, l: 'Jami tashriflar', icon: Activity, color: 'text-amber-600 bg-amber-50' },
                                ].map((s, i) => (
                                    <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100">
                                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
                                            <s.icon className="h-4 w-4" />
                                        </div>
                                        <p className="text-2xl font-bold text-gray-900 tabular-nums">{s.n}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{s.l}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Foydalanuvchilar */}
                        <div>
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Foydalanuvchilar</h3>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { n: stats.totalUsers, l: 'Jami', icon: Users, color: 'text-gray-600 bg-gray-50' },
                                    { n: stats.students, l: 'O\'quvchilar', icon: GraduationCap, color: 'text-blue-600 bg-blue-50' },
                                    { n: stats.teachers, l: 'O\'qituvchilar', icon: UserCheck, color: 'text-emerald-600 bg-emerald-50' },
                                ].map((s, i) => (
                                    <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100">
                                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
                                            <s.icon className="h-4 w-4" />
                                        </div>
                                        <p className="text-2xl font-bold text-gray-900 tabular-nums">{s.n}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{s.l}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Kontent */}
                        <div>
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Kontent va faollik</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { n: stats.totalChats, l: 'AI suhbatlar', icon: MessageSquare, color: 'text-blue-600 bg-blue-50' },
                                    { n: stats.totalMessages, l: 'Xabarlar', icon: MessageSquare, color: 'text-cyan-600 bg-cyan-50' },
                                    { n: stats.totalTests, l: 'Testlar', icon: Target, color: 'text-purple-600 bg-purple-50' },
                                    { n: stats.totalAttempts, l: 'Test urinishlar', icon: BarChart3, color: 'text-amber-600 bg-amber-50' },
                                ].map((s, i) => (
                                    <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100">
                                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
                                            <s.icon className="h-4 w-4" />
                                        </div>
                                        <p className="text-2xl font-bold text-gray-900 tabular-nums">{s.n}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{s.l}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* RAG va Ball */}
                        <div className="grid md:grid-cols-2 gap-3">
                            <div className="bg-white rounded-2xl p-5 border border-gray-100">
                                <div className="flex items-center gap-3 mb-1">
                                    <div className="h-9 w-9 rounded-xl flex items-center justify-center text-emerald-600 bg-emerald-50">
                                        <FileText className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900 tabular-nums">{stats.totalDocuments}</p>
                                        <p className="text-xs text-gray-400">RAG hujjatlar</p>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400 mt-2 pl-12">{stats.totalChunks} ta matn bo'lagi indekslangan</p>
                            </div>
                            <div className="bg-white rounded-2xl p-5 border border-gray-100">
                                <div className="flex items-center gap-3 mb-1">
                                    <div className="h-9 w-9 rounded-xl flex items-center justify-center text-orange-600 bg-orange-50">
                                        <BarChart3 className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900 tabular-nums">{stats.avgScore}%</p>
                                        <p className="text-xs text-gray-400">O'rtacha test bali</p>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400 mt-2 pl-12">{stats.totalAttempts} ta test urinishdan</p>
                            </div>
                        </div>
                        {/* Oxirgi ro'yxatdan o'tganlar */}
                        {stats.recentUsers?.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Oxirgi ro'yxatdan o'tganlar</h3>
                                <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                                    {stats.recentUsers.map((u: any) => (
                                        <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                                            <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-semibold text-gray-500">{u.name?.[0]?.toUpperCase()}</div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                                                <p className="text-xs text-gray-400">{u.email}</p>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${u.role === 'ADMIN' ? 'bg-red-50 text-red-600' : u.role === 'TEACHER' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500'}`}>{u.role}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* === USERS === */}
                {tab === 'users' && (
                    <div className="anim-up">
                        <div className="text-xs text-gray-400 mb-3">{users.length} ta foydalanuvchi</div>
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-50 bg-gray-50/50">
                                        <th className="text-left py-3 px-4 font-medium text-gray-400 text-xs">Ism</th>
                                        <th className="text-left py-3 px-4 font-medium text-gray-400 text-xs">Email</th>
                                        <th className="text-left py-3 px-4 font-medium text-gray-400 text-xs">Rol</th>
                                        <th className="text-left py-3 px-4 font-medium text-gray-400 text-xs">Sana</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition">
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-7 w-7 bg-gray-100 rounded-full flex items-center justify-center text-[11px] font-semibold text-gray-500">{u.name?.[0]?.toUpperCase()}</div>
                                                    <span className="font-medium text-gray-900">{u.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-gray-500">{u.email}</td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${u.role === 'ADMIN' ? 'bg-red-50 text-red-600' : u.role === 'TEACHER' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500'}`}>{u.role}</span>
                                            </td>
                                            <td className="py-3 px-4 text-gray-400 text-xs tabular-nums">{new Date(u.createdAt).toLocaleDateString('uz')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* === CREATE TEACHER === */}
                {tab === 'teachers' && (
                    <div className="max-w-md anim-up">
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                    <UserCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">Yangi O'qituvchi</h3>
                                    <p className="text-xs text-gray-400">Login/parol yaratib berasiz</p>
                                </div>
                            </div>
                            {msg && <div className={`text-sm px-4 py-2.5 rounded-xl mb-4 ${msg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg}</div>}
                            <form onSubmit={createTeacher} className="space-y-3">
                                <input placeholder="Ism" required value={tf.name} onChange={e => setTf({ ...tf, name: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none text-sm transition" />
                                <input type="email" placeholder="Email" required value={tf.email} onChange={e => setTf({ ...tf, email: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none text-sm transition" />
                                <input type="password" placeholder="Parol (kamida 6 ta belgi)" required minLength={6} value={tf.password} onChange={e => setTf({ ...tf, password: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none text-sm transition" />
                                <button type="submit" disabled={creating} className="w-full h-11 rounded-xl text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition disabled:opacity-50">
                                    {creating ? 'Yaratilmoqda...' : 'O\'qituvchi yaratish'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* === RAG DOCS === */}
                {tab === 'docs' && (
                    <div className="space-y-4 anim-up">
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                                    <Upload className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">Material Yuklash</h3>
                                    <p className="text-xs text-gray-400">PDF, Word yoki TXT — chunklarga bo'linib RAG tizimiga qo'shiladi</p>
                                </div>
                            </div>
                            <div className="flex gap-3 items-end">
                                <div className="flex-1">
                                    <label className="text-xs font-medium text-gray-500 block mb-1">Fan</label>
                                    <select value={docSubject} onChange={e => setDocSubject(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm">
                                        {['Matematika', 'Fizika', 'Kimyo', 'Biologiya', 'Ona tili', 'Ingliz tili', 'Tarix', 'Geografiya', 'Umumiy'].map(f =>
                                            <option key={f} value={f}>{f}</option>
                                        )}
                                    </select>
                                </div>
                                <label className="h-10 px-5 inline-flex items-center gap-2 rounded-lg text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 cursor-pointer transition">
                                    <Upload className="h-4 w-4" />
                                    {uploading ? 'Yuklanmoqda...' : 'Fayl tanlash'}
                                    <input type="file" accept=".pdf,.docx,.doc,.txt" onChange={uploadDoc} className="hidden" disabled={uploading} />
                                </label>
                            </div>
                        </div>
                        {docs.length === 0 && (
                            <div className="text-center py-12 text-sm text-gray-400">Hozircha hech qanday material yuklanmagan</div>
                        )}
                        {docs.map(d => (
                            <div key={d.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
                                <div className="h-10 w-10 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <FileText className="h-4 w-4 text-gray-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{d.fileName}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{d._count?.chunks || 0} chunk · {d.fileType} · {new Date(d.createdAt).toLocaleDateString('uz')}</p>
                                </div>
                                <button onClick={() => deleteDoc(d.id)} className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
