import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
    const [msg, setMsg] = useState('')

    useEffect(() => { loadAll() }, [])
    async function loadAll() {
        try { setStats(await fetchApi('/analytics/stats')) } catch { }
        try { setUsers(await fetchApi('/auth/users')) } catch { }
        try { setDocs(await fetchApi('/documents/list')) } catch { }
    }

    async function createTeacher(e: React.FormEvent) {
        e.preventDefault(); setMsg('')
        try { await fetchApi('/auth/create-teacher', { method: 'POST', body: JSON.stringify(tf) }); setMsg('O\'qituvchi yaratildi!'); setTf({ name: '', email: '', password: '' }); loadAll() }
        catch (e: any) { setMsg(e.message) }
    }

    async function uploadDoc(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]; if (!file) return
        setUploading(true)
        try {
            const fd = new FormData(); fd.append('file', file); fd.append('subject', 'Matematika')
            await uploadFile('/documents/upload', fd); loadAll()
        } catch { }
        setUploading(false)
    }

    async function deleteDoc(id: string) {
        try { await fetchApi(`/documents/${id}`, { method: 'DELETE' }); loadAll() } catch { }
    }

    const tabs = [
        { k: 'stats' as const, l: '📊 Statistika' },
        { k: 'users' as const, l: '👥 Foydalanuvchilar' },
        { k: 'teachers' as const, l: '👨‍🏫 O\'qituvchi yaratish' },
        { k: 'docs' as const, l: '📄 RAG Materiallar' },
    ]

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b sticky top-0 z-40">
                <div className="max-w-6xl mx-auto flex items-center justify-between py-3 px-6">
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">msert</span>
                        <span className="text-xs text-gray-400 font-medium">Admin</span>
                    </div>
                    <button onClick={() => { logout(); nav('/login') }} className="text-sm text-gray-400 hover:text-gray-600">Chiqish</button>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-6 py-8">
                <h1 className="text-2xl font-extrabold text-gray-900 mb-6">Boshqaruv Paneli</h1>

                {/* Tabs */}
                <div className="flex gap-2 mb-8 overflow-x-auto">
                    {tabs.map(t => (
                        <button key={t.k} onClick={() => setTab(t.k)} className={`px-5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition ${tab === t.k ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}>{t.l}</button>
                    ))}
                </div>

                {/* Stats */}
                {tab === 'stats' && stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 anim-up">
                        {[
                            { n: stats.totalUsers, l: 'Jami foydalanuvchilar', c: 'from-blue-500 to-blue-600' },
                            { n: stats.logins24h, l: 'Oxirgi 24 soat', c: 'from-emerald-500 to-emerald-600' },
                            { n: stats.loginsWeek, l: 'Oxirgi 1 hafta', c: 'from-purple-500 to-purple-600' },
                            { n: stats.loginsMonth, l: 'Oxirgi 1 oy', c: 'from-orange-500 to-orange-600' },
                        ].map((s, i) => (
                            <div key={i} className="bg-white rounded-2xl p-5 border shadow-sm">
                                <div className={`h-10 w-10 bg-gradient-to-br ${s.c} rounded-xl mb-3`} />
                                <p className="text-2xl font-bold text-gray-900">{s.n}</p>
                                <p className="text-xs text-gray-400">{s.l}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Users */}
                {tab === 'users' && (
                    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden anim-up">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b bg-gray-50"><th className="text-left py-3 px-4 font-medium text-gray-500">Ism</th><th className="text-left py-3 px-4 font-medium text-gray-500">Email</th><th className="text-left py-3 px-4 font-medium text-gray-500">Rol</th><th className="text-left py-3 px-4 font-medium text-gray-500">Sana</th></tr></thead>
                            <tbody>{users.map(u => (
                                <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50"><td className="py-3 px-4 font-medium">{u.name}</td><td className="py-3 px-4 text-gray-500">{u.email}</td><td className="py-3 px-4"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.role === 'ADMIN' ? 'bg-red-100 text-red-700' : u.role === 'TEACHER' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{u.role}</span></td><td className="py-3 px-4 text-gray-400 text-xs">{new Date(u.createdAt).toLocaleDateString('uz')}</td></tr>
                            ))}</tbody>
                        </table>
                    </div>
                )}

                {/* Create Teacher */}
                {tab === 'teachers' && (
                    <div className="max-w-md anim-up">
                        <div className="bg-white rounded-2xl border shadow-sm p-6">
                            <h3 className="text-lg font-bold mb-4">Yangi O'qituvchi</h3>
                            {msg && <div className="bg-blue-50 text-blue-700 text-sm px-4 py-2.5 rounded-xl mb-4">{msg}</div>}
                            <form onSubmit={createTeacher} className="space-y-4">
                                <input placeholder="Ism" required value={tf.name} onChange={e => setTf({ ...tf, name: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-sm" />
                                <input type="email" placeholder="Email" required value={tf.email} onChange={e => setTf({ ...tf, email: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-sm" />
                                <input type="password" placeholder="Parol" required value={tf.password} onChange={e => setTf({ ...tf, password: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-sm" />
                                <button type="submit" className="w-full h-11 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/25">Yaratish</button>
                            </form>
                        </div>
                    </div>
                )}

                {/* RAG Docs */}
                {tab === 'docs' && (
                    <div className="space-y-4 anim-up">
                        <div className="bg-white rounded-2xl border shadow-sm p-6">
                            <h3 className="text-lg font-bold mb-3">Material Yuklash</h3>
                            <p className="text-sm text-gray-400 mb-4">PDF, Word yoki TXT fayllar qabul qilinadi. Fayllar chunklarga bo'linib RAG tizimiga qo'shiladi.</p>
                            <label className="h-11 px-6 inline-flex items-center rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 cursor-pointer shadow-lg shadow-blue-500/25">
                                {uploading ? 'Yuklanmoqda...' : '📤 Fayl Yuklash'}
                                <input type="file" accept=".pdf,.docx,.doc,.txt" onChange={uploadDoc} className="hidden" />
                            </label>
                        </div>
                        {docs.map(d => (
                            <div key={d.id} className="bg-white rounded-2xl border shadow-sm p-5 flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-sm">{d.fileName}</p>
                                    <p className="text-xs text-gray-400">{d._count?.chunks || 0} chunk · {d.fileType} · {new Date(d.createdAt).toLocaleDateString('uz')}</p>
                                </div>
                                <button onClick={() => deleteDoc(d.id)} className="text-red-400 hover:text-red-600 text-sm">O'chirish</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
