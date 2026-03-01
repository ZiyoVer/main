import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrainCircuit, Users, UserCheck, GraduationCap, Clock, CalendarDays, CalendarRange, BarChart3, MessageSquare, FileText, Layers, Target, LogOut, Upload, Trash2, Activity, Bot, Save, Globe, Lock } from 'lucide-react'
import { fetchApi, uploadFile } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

export default function AdminPanel() {
    const nav = useNavigate()
    const { logout } = useAuthStore()
    const [tab, setTab] = useState<'stats' | 'users' | 'teachers' | 'docs' | 'tests' | 'ai'>('stats')
    const [stats, setStats] = useState<any>(null)
    const [users, setUsers] = useState<any[]>([])
    const [docs, setDocs] = useState<any[]>([])
    const [tests, setTests] = useState<any[]>([])
    const [tf, setTf] = useState({ name: '', email: '', password: '' })
    const [uploading, setUploading] = useState(false)
    const [docSubject, setDocSubject] = useState('Matematika')
    const [msg, setMsg] = useState('')
    const [creating, setCreating] = useState(false)
    const [aiConfig, setAiConfig] = useState({ temperature: '0.7', max_tokens: '4096', extra_rules: '' })
    const [aiSaving, setAiSaving] = useState(false)
    const [aiMsg, setAiMsg] = useState('')
    const [loading, setLoading] = useState(true)

    useEffect(() => { loadAll() }, [])
    async function loadAll() {
        setLoading(true)
        try { setStats(await fetchApi('/analytics/stats')) } catch { setStats({}) }
        try { setUsers(await fetchApi('/auth/users')) } catch { setUsers([]) }
        try { setDocs(await fetchApi('/documents/list')) } catch { setDocs([]) }
        try { setTests(await fetchApi('/tests/all')) } catch { setTests([]) }
        try { const ai = await fetchApi('/ai-settings'); setAiConfig(ai) } catch { }
        setLoading(false)
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

    async function deleteTest(id: string) {
        if (!confirm('Testni o\'chirmoqchimisiz?')) return
        try { await fetchApi(`/tests/${id}`, { method: 'DELETE' }); loadAll() } catch { }
    }

    const tabs = [
        { k: 'stats' as const, l: 'Statistika', icon: BarChart3 },
        { k: 'users' as const, l: 'Foydalanuvchilar', icon: Users },
        { k: 'teachers' as const, l: 'O\'qituvchi', icon: UserCheck },
        { k: 'tests' as const, l: 'Testlar', icon: Layers },
        { k: 'docs' as const, l: 'Materiallar', icon: FileText },
        { k: 'ai' as const, l: 'AI Sozlamalar', icon: Bot },
    ]

    return (
        <div className="h-screen bg-[#fafafa] overflow-y-auto">
            {/* Header */}
            <header className="bg-white/90 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-40">
                <div className="max-w-6xl mx-auto flex items-center justify-between py-3 px-5">
                    <div className="flex items-center gap-2">
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

            <div className="max-w-6xl mx-auto px-5 py-5">
                {/* Tabs */}
                <div className="flex gap-0.5 mb-5 bg-gray-100 rounded-xl p-1 w-fit overflow-x-auto">
                    {tabs.map(t => (
                        <button key={t.k} onClick={() => setTab(t.k)}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium transition whitespace-nowrap ${tab === t.k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            <t.icon className="h-3.5 w-3.5" /> {t.l}
                        </button>
                    ))}
                </div>

                {/* === STATS === */}
                {tab === 'stats' && loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <div className="w-7 h-7 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                            <p className="text-sm text-gray-400">Yuklanmoqda...</p>
                        </div>
                    </div>
                )}
                {tab === 'stats' && !loading && stats && (
                    <div className="space-y-4">
                        <div>
                            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Kirish statistikasi</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                                {[
                                    { n: stats.logins24h, l: 'Oxirgi 24 soat', icon: Clock, color: 'text-blue-600 bg-blue-50' },
                                    { n: stats.loginsWeek, l: '7 kun', icon: CalendarDays, color: 'text-emerald-600 bg-emerald-50' },
                                    { n: stats.loginsMonth, l: '30 kun', icon: CalendarRange, color: 'text-cyan-600 bg-cyan-50' },
                                    { n: stats.totalVisits, l: 'Jami tashriflar', icon: Activity, color: 'text-amber-600 bg-amber-50' },
                                ].map((s, i) => (
                                    <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-3">
                                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${s.color}`}>
                                            <s.icon className="h-3.5 w-3.5" />
                                        </div>
                                        <div>
                                            <p className="text-xl font-bold text-gray-900 tabular-nums leading-none">{s.n ?? 0}</p>
                                            <p className="text-[11px] text-gray-400 mt-0.5">{s.l}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                            {[
                                { n: stats.totalUsers, l: 'Jami foydalanuvchi', icon: Users, color: 'text-gray-600 bg-gray-50' },
                                { n: stats.students, l: 'O\'quvchilar', icon: GraduationCap, color: 'text-blue-600 bg-blue-50' },
                                { n: stats.teachers, l: 'O\'qituvchilar', icon: UserCheck, color: 'text-emerald-600 bg-emerald-50' },
                                { n: stats.totalChats, l: 'AI suhbatlar', icon: MessageSquare, color: 'text-cyan-600 bg-cyan-50' },
                            ].map((s, i) => (
                                <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-3">
                                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${s.color}`}>
                                        <s.icon className="h-3.5 w-3.5" />
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold text-gray-900 tabular-nums leading-none">{s.n ?? 0}</p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">{s.l}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                            {[
                                { n: stats.totalMessages, l: 'Xabarlar', icon: MessageSquare, color: 'text-blue-600 bg-blue-50' },
                                { n: stats.totalTests, l: 'Testlar', icon: Target, color: 'text-indigo-600 bg-indigo-50' },
                                { n: stats.totalAttempts, l: 'Test urinishlar', icon: BarChart3, color: 'text-amber-600 bg-amber-50' },
                                { n: `${stats.avgScore ?? 0}%`, l: 'O\'rtacha ball', icon: Target, color: 'text-emerald-600 bg-emerald-50' },
                            ].map((s, i) => (
                                <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-3">
                                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${s.color}`}>
                                        <s.icon className="h-3.5 w-3.5" />
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold text-gray-900 tabular-nums leading-none">{s.n ?? 0}</p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">{s.l}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="grid md:grid-cols-2 gap-2.5">
                            <div className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 text-emerald-600 bg-emerald-50"><FileText className="h-3.5 w-3.5" /></div>
                                <div>
                                    <p className="text-xl font-bold text-gray-900 tabular-nums leading-none">{stats.totalDocuments ?? 0}</p>
                                    <p className="text-[11px] text-gray-400 mt-0.5">RAG hujjatlar · {stats.totalChunks ?? 0} chunk</p>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl p-4 border border-gray-100">
                                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Oxirgi ro'yxatdan o'tganlar</p>
                                <div className="space-y-1.5">
                                    {(stats.recentUsers || []).slice(0, 3).map((u: any) => (
                                        <div key={u.id} className="flex items-center gap-2">
                                            <div className="h-6 w-6 bg-gray-100 rounded-full flex items-center justify-center text-[10px] font-semibold text-gray-500 flex-shrink-0">{u.name?.[0]?.toUpperCase()}</div>
                                            <span className="text-[12px] text-gray-700 flex-1 truncate">{u.name}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${u.role === 'TEACHER' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500'}`}>{u.role}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* === USERS === */}
                {tab === 'users' && (
                    <div>
                        <p className="text-[11px] text-gray-400 mb-3">{users.length} ta foydalanuvchi</p>
                        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-50 bg-gray-50/50">
                                        <th className="text-left py-2.5 px-4 font-medium text-gray-400 text-[11px] uppercase">Ism</th>
                                        <th className="text-left py-2.5 px-4 font-medium text-gray-400 text-[11px] uppercase">Email</th>
                                        <th className="text-left py-2.5 px-4 font-medium text-gray-400 text-[11px] uppercase">Rol</th>
                                        <th className="text-left py-2.5 px-4 font-medium text-gray-400 text-[11px] uppercase">Sana</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition">
                                            <td className="py-2.5 px-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-6 w-6 bg-gray-100 rounded-full flex items-center justify-center text-[10px] font-semibold text-gray-500">{u.name?.[0]?.toUpperCase()}</div>
                                                    <span className="text-[13px] font-medium text-gray-900">{u.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-4 text-[13px] text-gray-500">{u.email}</td>
                                            <td className="py-2.5 px-4">
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${u.role === 'ADMIN' ? 'bg-red-50 text-red-600' : u.role === 'TEACHER' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500'}`}>{u.role}</span>
                                            </td>
                                            <td className="py-2.5 px-4 text-[12px] text-gray-400 tabular-nums">{new Date(u.createdAt).toLocaleDateString('uz')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* === CREATE TEACHER === */}
                {tab === 'teachers' && (
                    <div className="max-w-md">
                        <div className="bg-white rounded-xl border border-gray-100 p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-9 w-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                    <UserCheck className="h-4.5 w-4.5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 text-sm">Yangi O'qituvchi</h3>
                                    <p className="text-xs text-gray-400">Login/parol yaratib berasiz</p>
                                </div>
                            </div>
                            {msg && <div className={`text-sm px-4 py-2.5 rounded-xl mb-3 ${msg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg}</div>}
                            <form onSubmit={createTeacher} className="space-y-2.5">
                                <input placeholder="Ism" required value={tf.name} onChange={e => setTf({ ...tf, name: e.target.value })} className="w-full h-10 px-3.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none text-sm transition" />
                                <input type="email" placeholder="Email" required value={tf.email} onChange={e => setTf({ ...tf, email: e.target.value })} className="w-full h-10 px-3.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none text-sm transition" />
                                <input type="password" placeholder="Parol (kamida 6 ta belgi)" required minLength={6} value={tf.password} onChange={e => setTf({ ...tf, password: e.target.value })} className="w-full h-10 px-3.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none text-sm transition" />
                                <button type="submit" disabled={creating} className="w-full h-10 rounded-lg text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition disabled:opacity-50">
                                    {creating ? 'Yaratilmoqda...' : 'O\'qituvchi yaratish'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* === TESTS === */}
                {tab === 'tests' && (
                    <div>
                        <p className="text-[11px] text-gray-400 mb-3">{tests.length} ta test</p>
                        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                            {tests.length === 0 && <p className="text-sm text-gray-400 text-center py-10">Hozircha testlar yo'q</p>}
                            {tests.map(t => (
                                <div key={t.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-[13px] font-medium text-gray-900 truncate">{t.title}</p>
                                            <span className={`flex-shrink-0 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${t.isPublic ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
                                                {t.isPublic ? <Globe className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                                                {t.isPublic ? 'Ochiq' : 'Yopiq'}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-gray-400 mt-0.5">{t.subject} · {t._count?.questions || 0} savol · {t._count?.attempts || 0} urinish · {t.creator?.name}</p>
                                    </div>
                                    <button onClick={() => deleteTest(t.id)} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition flex-shrink-0">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* === RAG DOCS === */}
                {tab === 'docs' && (
                    <div className="space-y-3">
                        <div className="bg-white rounded-xl border border-gray-100 p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-9 w-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                                    <Upload className="h-4.5 w-4.5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 text-sm">Material Yuklash</h3>
                                    <p className="text-xs text-gray-400">PDF, Word yoki TXT — RAG tizimiga qo'shiladi</p>
                                </div>
                            </div>
                            <div className="flex gap-2.5 items-end">
                                <div className="flex-1">
                                    <label className="text-xs font-medium text-gray-500 block mb-1">Fan</label>
                                    <select value={docSubject} onChange={e => setDocSubject(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm">
                                        {['Matematika', 'Fizika', 'Kimyo', 'Biologiya', 'Ona tili', 'Ingliz tili', 'Tarix', 'Geografiya', 'Umumiy'].map(f =>
                                            <option key={f} value={f}>{f}</option>
                                        )}
                                    </select>
                                </div>
                                <label className="h-9 px-4 inline-flex items-center gap-2 rounded-lg text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 cursor-pointer transition">
                                    <Upload className="h-3.5 w-3.5" />
                                    {uploading ? 'Yuklanmoqda...' : 'Fayl tanlash'}
                                    <input type="file" accept=".pdf,.docx,.doc,.txt" onChange={uploadDoc} className="hidden" disabled={uploading} />
                                </label>
                            </div>
                        </div>
                        {docs.length === 0 && (
                            <div className="text-center py-10 text-sm text-gray-400">Hozircha hech qanday material yuklanmagan</div>
                        )}
                        {docs.map(d => (
                            <div key={d.id} className="bg-white rounded-xl border border-gray-100 p-3.5 flex items-center gap-3">
                                <div className="h-9 w-9 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <FileText className="h-4 w-4 text-gray-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-medium text-gray-900 truncate">{d.fileName}</p>
                                    <p className="text-[11px] text-gray-400 mt-0.5">{d._count?.chunks || 0} chunk · {d.fileType} · {new Date(d.createdAt).toLocaleDateString('uz')}</p>
                                </div>
                                <button onClick={() => deleteDoc(d.id)} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition">
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* === AI SETTINGS === */}
                {tab === 'ai' && (
                    <div className="max-w-xl">
                        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-5">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                    <Bot className="h-4.5 w-4.5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 text-sm">AI Xulq-atvor sozlamalari</h3>
                                    <p className="text-xs text-gray-400">AI ustozning javob berish uslubini sozlang</p>
                                </div>
                            </div>
                            {aiMsg && <div className={`text-sm px-4 py-2.5 rounded-xl ${aiMsg.includes('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{aiMsg}</div>}
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1.5">Harorat (Temperature): {aiConfig.temperature}</label>
                                <input type="range" min="0" max="2" step="0.1" value={aiConfig.temperature}
                                    onChange={e => setAiConfig({ ...aiConfig, temperature: e.target.value })}
                                    className="w-full accent-blue-600" />
                                <div className="flex justify-between text-[11px] text-gray-400 mt-1"><span>0 — aniq</span><span>1 — kreativ</span><span>2 — juda kreativ</span></div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1.5">Max tokenlar</label>
                                <input type="number" min="1000" max="8000" step="500" value={aiConfig.max_tokens}
                                    onChange={e => setAiConfig({ ...aiConfig, max_tokens: e.target.value })}
                                    className="w-full h-10 px-3.5 rounded-lg border border-gray-200 focus:border-blue-500 outline-none text-sm" />
                                <p className="text-[11px] text-gray-400 mt-1">AI javobining maksimal uzunligi (1000-8000)</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1.5">Qo'shimcha qoidalar</label>
                                <textarea value={aiConfig.extra_rules}
                                    onChange={e => setAiConfig({ ...aiConfig, extra_rules: e.target.value })}
                                    rows={5} placeholder="Masalan: O'quvchilarga doimo motivatsion gaplar ayt..."
                                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 outline-none text-sm resize-none" />
                                <p className="text-[11px] text-gray-400 mt-1">Bu qoidalar AI system promptga qo'shiladi</p>
                            </div>
                            <button onClick={async () => {
                                setAiSaving(true); setAiMsg('')
                                try {
                                    await fetchApi('/ai-settings', { method: 'PUT', body: JSON.stringify(aiConfig) })
                                    setAiMsg('✓ Sozlamalar saqlandi!')
                                } catch (e: any) { setAiMsg(e.message) }
                                setAiSaving(false)
                            }} disabled={aiSaving} className="w-full h-10 rounded-lg text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition disabled:opacity-50 flex items-center justify-center gap-2">
                                <Save className="h-4 w-4" /> {aiSaving ? 'Saqlanmoqda...' : 'Sozlamalarni saqlash'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
