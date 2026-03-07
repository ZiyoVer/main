import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrainCircuit, Users, UserCheck, GraduationCap, Clock, CalendarDays, CalendarRange, BarChart3, MessageSquare, FileText, Layers, Target, LogOut, Upload, Trash2, Activity, Bot, Save, Globe, Lock, TrendingUp, UserPlus, BookOpen } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fetchApi, uploadFile } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

export default function AdminPanel() {
    const nav = useNavigate()
    const { logout } = useAuthStore()
    const [tab, setTab] = useState<'stats' | 'users' | 'teachers' | 'docs' | 'tests' | 'ai' | 'knowledge'>('stats')
    const [stats, setStats] = useState<any>(null)
    const [users, setUsers] = useState<any[]>([])
    const [docs, setDocs] = useState<any[]>([])
    const [tests, setTests] = useState<any[]>([])
    const [tf, setTf] = useState({ name: '', email: '', password: '' })
    const [uploading, setUploading] = useState(false)
    const [docSubject, setDocSubject] = useState('Matematika')
    const [msg, setMsg] = useState('')
    const [creating, setCreating] = useState(false)
    const [aiConfig, setAiConfig] = useState({ temperature: '0.7', max_tokens: '4096', extra_rules: '', prompt_role: '', prompt_teaching: '', prompt_format: '', prompt_math: '', prompt_english: '', prompt_file: '', prompt_donts: '' })
    const [promptSection, setPromptSection] = useState('extra_rules')
    const [defaults, setDefaults] = useState<Record<string, string>>({})
    const [showDefault, setShowDefault] = useState(false)
    const [aiSaving, setAiSaving] = useState(false)
    const [aiMsg, setAiMsg] = useState('')
    const [loading, setLoading] = useState(true)
    const [loginTrend, setLoginTrend] = useState<any[]>([])
    const [registerTrend, setRegisterTrend] = useState<any[]>([])
    const [newUsers24h, setNewUsers24h] = useState<any[]>([])
    const [recentRegs, setRecentRegs] = useState<any[]>([])
    const [knowledgeItems, setKnowledgeItems] = useState<any[]>([])
    const [knowledgeLoading, setKnowledgeLoading] = useState(false)
    const [knowledgeForm, setKnowledgeForm] = useState({ subject: 'Matematika', title: '', content: '', source: '' })
    const [editingKnowledge, setEditingKnowledge] = useState<string | null>(null)
    const [knowledgeFilter, setKnowledgeFilter] = useState('all')

    const KNOWLEDGE_SUBJECTS = ['Matematika', 'Fizika', 'Kimyo', 'Biologiya', 'Ona tili', 'Tarix', 'Ingliz tili', 'Geografiya']

    // Users pagination
    const [usersPage, setUsersPage] = useState(1)
    const [usersTotal, setUsersTotal] = useState(0)
    const [usersPages, setUsersPages] = useState(1)
    const [usersSearch, setUsersSearch] = useState('')
    const USERS_PER_PAGE = 50

    useEffect(() => { loadStats() }, [tab])
    useEffect(() => { if (tab === 'users') loadUsers() }, [tab, usersPage, usersSearch])
    useEffect(() => { if (tab === 'knowledge') loadKnowledge() }, [tab])

    async function loadStats() {
        setLoading(true)
        try { setStats(await fetchApi('/analytics/stats')) } catch { setStats({}) }
        try { setDocs(await fetchApi('/documents/list')) } catch { setDocs([]) }
        try { setTests(await fetchApi('/tests/all')) } catch { setTests([]) }
        try { const ai = await fetchApi('/ai-settings'); setAiConfig(ai) } catch { }
        try { const d = await fetchApi('/ai-settings/defaults'); setDefaults(d) } catch { }
        try { setLoginTrend(await fetchApi('/analytics/login-trend')) } catch { setLoginTrend([]) }
        try { setRegisterTrend(await fetchApi('/analytics/register-trend')) } catch { setRegisterTrend([]) }
        try { setNewUsers24h(await fetchApi('/analytics/new-users-24h')) } catch { setNewUsers24h([]) }
        try { setRecentRegs(await fetchApi('/analytics/recent-registrations')) } catch { setRecentRegs([]) }
        setLoading(false)
    }

    async function loadUsers() {
        try {
            const params = new URLSearchParams({ page: String(usersPage), limit: String(USERS_PER_PAGE) })
            if (usersSearch.trim()) params.set('search', usersSearch.trim())
            const data = await fetchApi(`/auth/users?${params}`)
            setUsers(data.users || [])
            setUsersTotal(data.total || 0)
            setUsersPages(data.pages || 1)
        } catch { setUsers([]) }
    }

    // loadAll ni boshqa joylarda ishlatish uchun saqlaymiz
    async function loadAll() { await loadStats(); await loadUsers() }

    async function createTeacher(e: React.FormEvent) {
        e.preventDefault()
        if (creating) return
        setCreating(true); setMsg('')
        try {
            await fetchApi('/auth/create-teacher', { method: 'POST', body: JSON.stringify(tf) })
            setMsg('\u2713 O\'qituvchi muvaffaqiyatli yaratildi!')
            setTf({ name: '', email: '', password: '' })
            loadAll()
        } catch (e: any) { setMsg('\u2717 ' + e.message) }
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
        } catch (e: any) {
            toast.error('Hujjat yuklashda xato: ' + (e?.message || "Qayta urinib ko'ring"))
        }
        setUploading(false)
        e.target.value = ''
    }

    const loadKnowledge = async () => {
        setKnowledgeLoading(true)
        try {
            const data = await fetchApi('/knowledge')
            setKnowledgeItems(data)
        } catch (e: any) { toast.error(e.message) }
        finally { setKnowledgeLoading(false) }
    }

    const saveKnowledge = async () => {
        if (!knowledgeForm.title.trim() || !knowledgeForm.content.trim()) {
            return toast.error("Fan, sarlavha va mazmun kerak")
        }
        try {
            if (editingKnowledge) {
                await fetchApi('/knowledge/' + editingKnowledge, { method: 'PUT', body: JSON.stringify(knowledgeForm) })
                toast.success("Yangilandi")
            } else {
                await fetchApi('/knowledge', { method: 'POST', body: JSON.stringify(knowledgeForm) })
                toast.success("Qo'shildi")
            }
            setKnowledgeForm({ subject: 'Matematika', title: '', content: '', source: '' })
            setEditingKnowledge(null)
            loadKnowledge()
        } catch (e: any) { toast.error(e.message) }
    }

    const deleteKnowledge = async (id: string) => {
        if (!confirm("O'chirishni tasdiqlaysizmi?")) return
        try {
            await fetchApi('/knowledge/' + id, { method: 'DELETE' })
            setKnowledgeItems(prev => prev.filter(i => i.id !== id))
            toast.success("O'chirildi")
        } catch (e: any) { toast.error(e.message) }
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
        { k: 'knowledge' as const, l: 'Bilim Bazasi', icon: BookOpen },
    ]

    // Helper: card style
    const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)' }
    const mutedText = { color: 'var(--text-muted)' }
    const secondaryText = { color: 'var(--text-secondary)' }

    return (
        <div className="h-screen overflow-y-auto w-full" style={{ background: 'var(--bg-page)' }}>
            {/* Header */}
            <header className="sticky top-0 z-40" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
                <div className="max-w-6xl mx-auto flex items-center justify-between py-3 px-5">
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand)' }}>
                            <BrainCircuit className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className="text-sm font-bold">BallMax</span>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md" style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)' }}>Admin</span>
                    </div>
                    <button onClick={() => { logout(); nav('/') }} className="h-8 w-8 flex items-center justify-center rounded-lg transition"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-light)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}>
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-5 py-5">
                {/* Tabs */}
                <div className="flex gap-0.5 mb-5 rounded-xl p-1 w-fit overflow-x-auto" style={{ background: 'var(--bg-surface)' }}>
                    {tabs.map(t => (
                        <button key={t.k} onClick={() => setTab(t.k)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium transition whitespace-nowrap"
                            style={tab === t.k ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : { color: 'var(--text-secondary)' }}>
                            <t.icon className="h-3.5 w-3.5" /> {t.l}
                        </button>
                    ))}
                </div>

                {/* === STATS === */}
                {tab === 'stats' && loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <div className="w-7 h-7 border-2 rounded-full animate-spin mx-auto mb-2" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--brand)' }} />
                            <p className="text-sm" style={mutedText}>Yuklanmoqda...</p>
                        </div>
                    </div>
                )}
                {tab === 'stats' && !loading && stats && (
                    <div className="space-y-4">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={mutedText}>Kirish statistikasi</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                                {[
                                    { n: stats.logins24h, l: 'Oxirgi 24 soat', icon: Clock, color: 'var(--brand)' },
                                    { n: stats.loginsWeek, l: '7 kun', icon: CalendarDays, color: 'var(--success)' },
                                    { n: stats.loginsMonth, l: '30 kun', icon: CalendarRange, color: '#06b6d4' },
                                    { n: stats.totalVisits, l: 'Jami tashriflar', icon: Activity, color: '#f59e0b' },
                                ].map((s, i) => (
                                    <div key={i} className="rounded-xl p-4 flex items-center gap-3" style={cardStyle}>
                                        <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ color: s.color, background: `color-mix(in srgb, ${s.color} 12%, transparent)` }}>
                                            <s.icon className="h-3.5 w-3.5" />
                                        </div>
                                        <div>
                                            <p className="text-xl font-bold tabular-nums leading-none">{s.n ?? 0}</p>
                                            <p className="text-[11px] mt-0.5" style={mutedText}>{s.l}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                            {[
                                { n: stats.totalUsers, l: 'Jami foydalanuvchi', icon: Users, color: 'var(--text-secondary)' },
                                { n: stats.students, l: 'O\'quvchilar', icon: GraduationCap, color: 'var(--brand)' },
                                { n: stats.teachers, l: 'O\'qituvchilar', icon: UserCheck, color: 'var(--success)' },
                                { n: stats.totalChats, l: 'AI suhbatlar', icon: MessageSquare, color: '#06b6d4' },
                            ].map((s, i) => (
                                <div key={i} className="rounded-xl p-4 flex items-center gap-3" style={cardStyle}>
                                    <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ color: s.color, background: `color-mix(in srgb, ${s.color} 12%, transparent)` }}>
                                        <s.icon className="h-3.5 w-3.5" />
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold tabular-nums leading-none">{s.n ?? 0}</p>
                                        <p className="text-[11px] mt-0.5" style={mutedText}>{s.l}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                            {[
                                { n: stats.totalMessages, l: 'Xabarlar', icon: MessageSquare, color: 'var(--brand)' },
                                { n: stats.totalTests, l: 'Testlar', icon: Target, color: '#6366f1' },
                                { n: stats.totalAttempts, l: 'Test urinishlar', icon: BarChart3, color: '#f59e0b' },
                                { n: `${stats.avgScore ?? 0}%`, l: 'O\'rtacha ball', icon: Target, color: 'var(--success)' },
                            ].map((s, i) => (
                                <div key={i} className="rounded-xl p-4 flex items-center gap-3" style={cardStyle}>
                                    <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ color: s.color, background: `color-mix(in srgb, ${s.color} 12%, transparent)` }}>
                                        <s.icon className="h-3.5 w-3.5" />
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold tabular-nums leading-none">{s.n ?? 0}</p>
                                        <p className="text-[11px] mt-0.5" style={mutedText}>{s.l}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="grid md:grid-cols-2 gap-2.5">
                            <div className="rounded-xl p-4 flex items-center gap-3" style={cardStyle}>
                                <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ color: 'var(--success)', background: 'color-mix(in srgb, var(--success) 12%, transparent)' }}><FileText className="h-3.5 w-3.5" /></div>
                                <div>
                                    <p className="text-xl font-bold tabular-nums leading-none">{stats.totalDocuments ?? 0}</p>
                                    <p className="text-[11px] mt-0.5" style={mutedText}>RAG hujjatlar · {stats.totalChunks ?? 0} chunk</p>
                                </div>
                            </div>
                            <div className="rounded-xl p-4" style={cardStyle}>
                                <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={mutedText}>Oxirgi ro'yxatdan o'tganlar</p>
                                <div className="space-y-1.5">
                                    {(stats.recentUsers || []).slice(0, 3).map((u: any) => (
                                        <div key={u.id} className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>{u.name?.[0]?.toUpperCase()}</div>
                                            <span className="text-[12px] flex-1 truncate" style={secondaryText}>{u.name}</span>
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                                style={u.role === 'TEACHER' ? { background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)' } : { background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>{u.role}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ═══════════════ CHARTS ═══════════════ */}
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={mutedText}>Grafik tahlil</p>

                            {/* Row 1: Login trend + Register trend */}
                            <div className="grid md:grid-cols-2 gap-3 mb-3">
                                {/* 7-day Login Trend */}
                                <div className="rounded-xl p-4" style={cardStyle}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)' }}>
                                            <TrendingUp className="h-3.5 w-3.5" />
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-semibold">7 kunlik kirishlar</p>
                                            <p className="text-[11px]" style={mutedText}>Oxirgi 7 kun davomida tizimga kirganlar</p>
                                        </div>
                                    </div>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <AreaChart data={loginTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="loginGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.25} />
                                                    <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                            <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                                            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
                                            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                                            <Area type="monotone" dataKey="count" name="Kirishlar" stroke="var(--brand)" fill="url(#loginGrad)" strokeWidth={2} dot={{ r: 3, fill: 'var(--brand)' }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* 7-day Register Trend */}
                                <div className="rounded-xl p-4" style={cardStyle}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' }}>
                                            <UserPlus className="h-3.5 w-3.5" />
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-semibold">7 kunlik ro'yxatdan o'tishlar</p>
                                            <p className="text-[11px]" style={mutedText}>Har kunda yangi foydalanuvchilar</p>
                                        </div>
                                    </div>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <BarChart data={registerTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                            <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                                            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
                                            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                                            <Bar dataKey="count" name="Yangi foydalanuvchi" fill="var(--success)" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Row 2: 24h activity chart + 24h new users list */}
                            <div className="grid md:grid-cols-2 gap-3">
                                {/* 24h new users hourly */}
                                <div className="rounded-xl p-4" style={cardStyle}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, #6366f1 12%, transparent)', color: '#6366f1' }}>
                                            <Activity className="h-3.5 w-3.5" />
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-semibold">24 soatlik faollik</p>
                                            <p className="text-[11px]" style={mutedText}>Soat bo'yicha yangi a'zolar</p>
                                        </div>
                                    </div>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <LineChart data={newUsers24h} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                            <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} interval={3} />
                                            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
                                            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                                            <Line type="monotone" dataKey="count" name="Yangi a'zo" stroke="#6366f1" strokeWidth={2} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* 24h registrations list */}
                                <div className="rounded-xl p-4" style={cardStyle}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, #f59e0b 12%, transparent)', color: '#f59e0b' }}>
                                            <Users className="h-3.5 w-3.5" />
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-semibold">24 soatda ro'yxatdan o'tganlar</p>
                                            <p className="text-[11px]" style={mutedText}>{recentRegs.length} ta yangi foydalanuvchi</p>
                                        </div>
                                    </div>
                                    <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 160 }}>
                                        {recentRegs.length === 0 ? (
                                            <p className="text-[12px] text-center py-6" style={mutedText}>24 soatda yangi foydalanuvchi yo'q</p>
                                        ) : recentRegs.map((u: any) => (
                                            <div key={u.id} className="flex items-center gap-2.5 py-1">
                                                <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                                                    style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                                                    {u.name?.[0]?.toUpperCase() || '?'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[12px] font-medium truncate">{u.name}</p>
                                                    <p className="text-[10px] truncate" style={mutedText}>{u.email}</p>
                                                </div>
                                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0"
                                                    style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                                                    {new Date(u.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* === USERS === */}
                {tab === 'users' && (
                    <div>
                        <div className="flex items-center justify-between mb-3 gap-3">
                            <p className="text-[11px]" style={mutedText}>{usersTotal} ta foydalanuvchi</p>
                            <input
                                type="search" placeholder="Ism yoki email bo'yicha qidirish..."
                                value={usersSearch}
                                onChange={e => { setUsersSearch(e.target.value); setUsersPage(1) }}
                                className="input" style={{ height: '2rem', fontSize: '12px', width: '240px' }}
                            />
                        </div>
                        <div className="rounded-xl overflow-hidden" style={cardStyle}>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                                        <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>Ism</th>
                                        <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>Email</th>
                                        <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>Rol</th>
                                        <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>Sana</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id} className="transition" style={{ borderBottom: '1px solid var(--border)' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td className="py-2.5 px-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>{u.name?.[0]?.toUpperCase()}</div>
                                                    <span className="text-[13px] font-medium">{u.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-4 text-[13px]" style={secondaryText}>{u.email}</td>
                                            <td className="py-2.5 px-4">
                                                <span className="px-2 py-0.5 rounded text-[11px] font-medium"
                                                    style={u.role === 'ADMIN' ? { background: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)' } : u.role === 'TEACHER' ? { background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)' } : { background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>{u.role}</span>
                                            </td>
                                            <td className="py-2.5 px-4 text-[12px] tabular-nums" style={mutedText}>{new Date(u.createdAt).toLocaleDateString('uz')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination */}
                        {usersPages > 1 && (
                            <div className="flex items-center justify-between mt-3">
                                <p className="text-[11px]" style={mutedText}>
                                    {(usersPage - 1) * USERS_PER_PAGE + 1}–{Math.min(usersPage * USERS_PER_PAGE, usersTotal)} / {usersTotal}
                                </p>
                                <div className="flex gap-1">
                                    <button onClick={() => setUsersPage(p => Math.max(1, p - 1))} disabled={usersPage <= 1}
                                        className="h-7 px-3 rounded-lg text-[12px] font-medium transition disabled:opacity-40"
                                        style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                                        ← Oldingi
                                    </button>
                                    {Array.from({ length: Math.min(5, usersPages) }, (_, i) => {
                                        const p = Math.max(1, Math.min(usersPages - 4, usersPage - 2)) + i
                                        return (
                                            <button key={p} onClick={() => setUsersPage(p)}
                                                className="h-7 w-7 rounded-lg text-[12px] font-medium transition"
                                                style={p === usersPage ? { background: 'var(--brand)', color: '#fff' } : { background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                                                {p}
                                            </button>
                                        )
                                    })}
                                    <button onClick={() => setUsersPage(p => Math.min(usersPages, p + 1))} disabled={usersPage >= usersPages}
                                        className="h-7 px-3 rounded-lg text-[12px] font-medium transition disabled:opacity-40"
                                        style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                                        Keyingi →
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* === CREATE TEACHER === */}
                {tab === 'teachers' && (
                    <div className="max-w-md">
                        <div className="rounded-xl p-5" style={cardStyle}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)' }}>
                                    <UserCheck className="h-4.5 w-4.5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm">Yangi O'qituvchi</h3>
                                    <p className="text-xs" style={mutedText}>Login/parol yaratib berasiz</p>
                                </div>
                            </div>
                            {msg && <div className="text-sm px-4 py-2.5 rounded-xl mb-3" style={msg.startsWith('\u2713') ? { background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' } : { background: 'var(--danger-light)', color: 'var(--danger)' }}>{msg}</div>}
                            <form onSubmit={createTeacher} className="space-y-2.5">
                                <input placeholder="Ism" required value={tf.name} onChange={e => setTf({ ...tf, name: e.target.value })} className="input" />
                                <input type="email" placeholder="Email" required value={tf.email} onChange={e => setTf({ ...tf, email: e.target.value })} className="input" />
                                <input type="password" placeholder="Parol (kamida 6 ta belgi)" required minLength={6} value={tf.password} onChange={e => setTf({ ...tf, password: e.target.value })} className="input" />
                                <button type="submit" disabled={creating} className="btn btn-primary" style={{ width: '100%' }}>
                                    {creating ? 'Yaratilmoqda...' : 'O\'qituvchi yaratish'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* === TESTS === */}
                {tab === 'tests' && (
                    <div>
                        <p className="text-[11px] mb-3" style={mutedText}>{tests.length} ta test</p>
                        <div className="rounded-xl overflow-hidden" style={cardStyle}>
                            {tests.length === 0 && <p className="text-sm text-center py-10" style={mutedText}>Hozircha testlar yo'q</p>}
                            {tests.map(t => (
                                <div key={t.id} className="flex items-center gap-3 px-4 py-3 transition"
                                    style={{ borderBottom: '1px solid var(--border)' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-[13px] font-medium truncate">{t.title}</p>
                                            <span className="flex-shrink-0 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium"
                                                style={t.isPublic ? { background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' } : { background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                                                {t.isPublic ? <Globe className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                                                {t.isPublic ? 'Ochiq' : 'Yopiq'}
                                            </span>
                                        </div>
                                        <p className="text-[11px] mt-0.5" style={mutedText}>{t.subject} · {t._count?.questions || 0} savol · {t._count?.attempts || 0} urinish · {t.creator?.name}</p>
                                    </div>
                                    <button onClick={() => deleteTest(t.id)} className="h-7 w-7 flex items-center justify-center rounded-lg transition flex-shrink-0"
                                        style={{ color: 'var(--text-muted)' }}
                                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-light)' }}
                                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}>
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
                        <div className="rounded-xl p-5" style={cardStyle}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' }}>
                                    <Upload className="h-4.5 w-4.5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm">Material Yuklash</h3>
                                    <p className="text-xs" style={mutedText}>PDF, Word yoki TXT — RAG tizimiga qo'shiladi</p>
                                </div>
                            </div>
                            <div className="flex gap-2.5 items-end">
                                <div className="flex-1">
                                    <label className="text-xs font-medium block mb-1" style={secondaryText}>Fan</label>
                                    <select value={docSubject} onChange={e => setDocSubject(e.target.value)} className="input" style={{ cursor: 'pointer' }}>
                                        {['Matematika', 'Fizika', 'Kimyo', 'Biologiya', 'Ona tili', 'Ingliz tili', 'Tarix', 'Geografiya', 'Umumiy'].map(f =>
                                            <option key={f} value={f}>{f}</option>
                                        )}
                                    </select>
                                </div>
                                <label className="btn btn-primary cursor-pointer flex items-center gap-2" style={{ height: '2.25rem', fontSize: '0.875rem' }}>
                                    <Upload className="h-3.5 w-3.5" />
                                    {uploading ? 'Yuklanmoqda...' : 'Fayl tanlash'}
                                    <input type="file" accept=".pdf,.docx,.doc,.txt" onChange={uploadDoc} className="hidden" disabled={uploading} />
                                </label>
                            </div>
                        </div>
                        {docs.length === 0 && (
                            <div className="text-center py-10 text-sm" style={mutedText}>Hozircha hech qanday material yuklanmagan</div>
                        )}
                        {docs.map(d => (
                            <div key={d.id} className="rounded-xl p-3.5 flex items-center gap-3" style={cardStyle}>
                                <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-surface)' }}>
                                    <FileText className="h-4 w-4" style={mutedText} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-medium truncate">{d.fileName}</p>
                                    <p className="text-[11px] mt-0.5" style={mutedText}>{d._count?.chunks || 0} chunk · {d.fileType} · {new Date(d.createdAt).toLocaleDateString('uz')}</p>
                                </div>
                                <button onClick={() => deleteDoc(d.id)} className="h-7 w-7 flex items-center justify-center rounded-lg transition"
                                    style={{ color: 'var(--text-muted)' }}
                                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-light)' }}
                                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* === KNOWLEDGE BASE === */}
                {tab === 'knowledge' && (
                    <div>
                        <h2 className="text-base font-bold mb-1">Bilim Bazasi — Fan bo'yicha AI Xotira</h2>
                        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                            DTM va Milliy Sertifikat savollarini, qoidalarni qo'shing. AI chat jarayonida shu ma'lumotlardan foydalanadi.
                        </p>

                        {/* Yangi qo'shish / tahrirlash formasi */}
                        <div className="rounded-xl p-4 mb-6" style={cardStyle}>
                            <h3 className="font-semibold mb-4">{editingKnowledge ? 'Tahrirlash' : "Yangi ma'lumot qo'shish"}</h3>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label className="text-sm font-medium block mb-1">Fan</label>
                                    <select className="input" value={knowledgeForm.subject}
                                        onChange={e => setKnowledgeForm(f => ({ ...f, subject: e.target.value }))}>
                                        {KNOWLEDGE_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium block mb-1">Manba (ixtiyoriy)</label>
                                    <input className="input" placeholder="DTM 2023, MS 2022, Darslik..."
                                        value={knowledgeForm.source}
                                        onChange={e => setKnowledgeForm(f => ({ ...f, source: e.target.value }))} />
                                </div>
                            </div>
                            <div className="mb-3">
                                <label className="text-sm font-medium block mb-1">Sarlavha</label>
                                <input className="input" placeholder="Masalan: DTM 2023 - Kvadrat tenglama"
                                    value={knowledgeForm.title}
                                    onChange={e => setKnowledgeForm(f => ({ ...f, title: e.target.value }))} />
                            </div>
                            <div className="mb-4">
                                <label className="text-sm font-medium block mb-1">
                                    Mazmun <span style={{ color: 'var(--text-muted)' }}>(savollar, formulalar, qoidalar)</span>
                                </label>
                                <textarea className="input" rows={8}
                                    placeholder="Savollar va javoblarni kiriting. AI shu ma'lumotlardan foydalanadi..."
                                    value={knowledgeForm.content}
                                    onChange={e => setKnowledgeForm(f => ({ ...f, content: e.target.value }))}
                                    style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }} />
                            </div>
                            <div className="flex gap-2">
                                <button className="btn btn-primary" onClick={saveKnowledge}>
                                    {editingKnowledge ? 'Saqlash' : "Qo'shish"}
                                </button>
                                {editingKnowledge && (
                                    <button className="btn btn-outline" onClick={() => {
                                        setEditingKnowledge(null)
                                        setKnowledgeForm({ subject: 'Matematika', title: '', content: '', source: '' })
                                    }}>Bekor qilish</button>
                                )}
                            </div>
                        </div>

                        {/* Filter */}
                        <div className="flex gap-2 mb-4 flex-wrap">
                            <button className={`btn btn-sm ${knowledgeFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => setKnowledgeFilter('all')}>Barchasi</button>
                            {KNOWLEDGE_SUBJECTS.map(s => (
                                <button key={s}
                                    className={`btn btn-sm ${knowledgeFilter === s ? 'btn-primary' : 'btn-outline'}`}
                                    onClick={() => setKnowledgeFilter(s)}>{s}</button>
                            ))}
                        </div>

                        {/* Ro'yxat */}
                        {knowledgeLoading ? (
                            <div className="text-center py-8" style={mutedText}>Yuklanmoqda...</div>
                        ) : (
                            <div className="space-y-3">
                                {knowledgeItems
                                    .filter(item => knowledgeFilter === 'all' || item.subject === knowledgeFilter)
                                    .map(item => (
                                        <div key={item.id} className="rounded-xl p-4" style={cardStyle}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <span className="text-xs font-semibold px-2 py-0.5 rounded"
                                                            style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)' }}>
                                                            {item.subject}
                                                        </span>
                                                        {item.source && (
                                                            <span className="text-xs px-2 py-0.5 rounded"
                                                                style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                                                                {item.source}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="font-medium text-sm mb-1">{item.title}</p>
                                                    <p className="text-xs" style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                                                        {item.content.substring(0, 200)}{item.content.length > 200 ? '...' : ''}
                                                    </p>
                                                    <p className="text-[10px] mt-1" style={mutedText}>
                                                        {item.content.length} belgi · {new Date(item.createdAt).toLocaleDateString('uz')}
                                                    </p>
                                                </div>
                                                <div className="flex gap-1 flex-shrink-0">
                                                    <button className="btn btn-sm btn-outline" onClick={() => {
                                                        setEditingKnowledge(item.id)
                                                        setKnowledgeForm({ subject: item.subject, title: item.title, content: item.content, source: item.source || '' })
                                                        window.scrollTo(0, 0)
                                                    }}>Tahrir</button>
                                                    <button className="btn btn-sm" style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none' }}
                                                        onClick={() => deleteKnowledge(item.id)}>O'chir</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                {knowledgeItems.filter(i => knowledgeFilter === 'all' || i.subject === knowledgeFilter).length === 0 && (
                                    <div className="text-center py-8" style={mutedText}>
                                        Hali ma'lumot yo'q. Yuqoridagi forma orqali qo'shing.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* === AI SETTINGS === */}
                {tab === 'ai' && (() => {
                    const SECTIONS = [
                        { key: 'extra_rules', label: 'Qo\'shimcha qoidalar', desc: 'Har doim qo\'shiladigan ko\'rsatmalar' },
                        { key: 'prompt_role', label: 'Rol va shaxsiyat', desc: '🎓 AI kim — "Sen BallMax platformasi..."' },
                        { key: 'prompt_teaching', label: 'O\'qitish metodikasi', desc: '\uD83D\uDCD6 Avval tushuntir, dialog, diagnostika' },
                        { key: 'prompt_format', label: 'Formatlash qoidalari', desc: '\uD83D\uDCDD LaTeX, jadval, flashcard, test format' },
                        { key: 'prompt_math', label: 'Matematika bo\'limi', desc: '\uD83C\uDFC6 Milliy Sertifikat Matematika' },
                        { key: 'prompt_english', label: 'Ingliz tili bo\'limi', desc: '\uD83C\uDFC6 Milliy Sertifikat Ingliz tili' },
                        { key: 'prompt_file', label: 'Fayl tahlili', desc: '\uD83D\uDCCE PDF/rasm yuklanganda' },
                        { key: 'prompt_donts', label: 'Qilma qoidalar', desc: '\u26A0\uFE0F AI qilmasligi kerak narsalar' },
                    ]
                    const activeSection = SECTIONS.find(s => s.key === promptSection)!
                    const currentVal = (aiConfig as any)[promptSection] as string
                    return (
                        <div className="max-w-xl space-y-4">
                            {/* Main AI settings card */}
                            <div className="rounded-xl p-5 space-y-5" style={cardStyle}>
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)' }}>
                                        <Bot className="h-4.5 w-4.5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm">AI Xulq-atvor sozlamalari</h3>
                                        <p className="text-xs" style={mutedText}>AI ustozning javob berish uslubini sozlang</p>
                                    </div>
                                </div>
                                {aiMsg && <div className="text-sm px-4 py-2.5 rounded-xl" style={aiMsg.includes('\u2713') ? { background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' } : { background: 'var(--danger-light)', color: 'var(--danger)' }}>{aiMsg}</div>}
                                <div>
                                    <label className="text-sm font-medium block mb-1.5" style={secondaryText}>Harorat (Temperature): {aiConfig.temperature}</label>
                                    <input type="range" min="0" max="2" step="0.1" value={aiConfig.temperature}
                                        onChange={e => setAiConfig({ ...aiConfig, temperature: e.target.value })}
                                        className="w-full" style={{ accentColor: 'var(--brand)' }} />
                                    <div className="flex justify-between text-[11px] mt-1" style={mutedText}><span>0 — aniq</span><span>1 — kreativ</span><span>2 — juda kreativ</span></div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium block mb-1.5" style={secondaryText}>Max tokenlar</label>
                                    <input type="number" min="1000" max="8000" step="500" value={aiConfig.max_tokens}
                                        onChange={e => setAiConfig({ ...aiConfig, max_tokens: e.target.value })}
                                        className="input" />
                                    <p className="text-[11px] mt-1" style={mutedText}>AI javobining maksimal uzunligi (1000-8000)</p>
                                </div>
                                <button onClick={async () => {
                                    setAiSaving(true); setAiMsg('')
                                    try {
                                        await fetchApi('/ai-settings', { method: 'PUT', body: JSON.stringify(aiConfig) })
                                        setAiMsg('\u2713 Sozlamalar saqlandi!')
                                    } catch (e: any) { setAiMsg(e.message) }
                                    setAiSaving(false)
                                }} disabled={aiSaving} className="btn btn-primary flex items-center justify-center gap-2" style={{ width: '100%' }}>
                                    <Save className="h-4 w-4" /> {aiSaving ? 'Saqlanmoqda...' : 'Sozlamalarni saqlash'}
                                </button>
                            </div>

                            {/* Prompt sections editor card */}
                            <div className="rounded-xl p-5 space-y-4" style={cardStyle}>
                                <div>
                                    <h3 className="font-semibold text-sm mb-0.5">Prompt bo'limlari (override)</h3>
                                    <p className="text-[11px]" style={mutedText}>Bo'sh = standart kod ishlatiladi. Matn yozsangiz — AI o'sha matndan foydalanadi.</p>
                                </div>

                                {/* Section chip tabs */}
                                <div className="flex flex-wrap gap-1.5">
                                    {SECTIONS.map(s => (
                                        <button key={s.key} onClick={() => { setPromptSection(s.key); setShowDefault(false) }}
                                            className="px-2.5 py-1 rounded-lg text-[12px] font-medium transition"
                                            style={promptSection === s.key ? { background: 'var(--text-primary)', color: 'var(--bg-card)', border: '1px solid var(--text-primary)' } : { background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                                            {s.label}
                                            {(aiConfig as any)[s.key] ? <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full align-middle" style={{ background: 'var(--brand)' }} /> : null}
                                        </button>
                                    ))}
                                </div>

                                {/* Active section info */}
                                <div>
                                    <p className="text-[11px] mb-2" style={mutedText}>{activeSection.desc}</p>
                                    <textarea
                                        value={currentVal}
                                        onChange={e => setAiConfig({ ...aiConfig, [promptSection]: e.target.value } as any)}
                                        rows={10}
                                        placeholder={`Bo'sh qoldirsangiz standart "${activeSection.label}" bo'limi ishlatiladi...`}
                                        className="input font-mono resize-y"
                                        style={{ height: 'auto', padding: '0.625rem 0.875rem', fontSize: '13px' }}
                                    />
                                </div>

                                {/* Default view + clear */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setShowDefault(v => !v)}
                                            className="text-[12px] font-medium" style={{ color: 'var(--brand)' }}>
                                            {showDefault ? 'Yopish \u25B2' : 'Standartni ko\'rish \u25BC'}
                                        </button>
                                        {currentVal && (
                                            <button onClick={() => { setAiConfig({ ...aiConfig, [promptSection]: '' } as any); setShowDefault(false) }}
                                                className="text-[12px] font-medium" style={{ color: 'var(--danger)' }}>
                                                Tozalash
                                            </button>
                                        )}
                                    </div>
                                    {showDefault && defaults[promptSection] && (
                                        <textarea
                                            readOnly
                                            value={defaults[promptSection]}
                                            rows={8}
                                            className="input font-mono resize-y"
                                            style={{ height: 'auto', padding: '0.625rem 0.875rem', fontSize: '12px', background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
                                        />
                                    )}
                                </div>

                                <button onClick={async () => {
                                    setAiSaving(true); setAiMsg('')
                                    try {
                                        await fetchApi('/ai-settings', { method: 'PUT', body: JSON.stringify(aiConfig) })
                                        setAiMsg('\u2713 Sozlamalar saqlandi!')
                                    } catch (e: any) { setAiMsg(e.message) }
                                    setAiSaving(false)
                                }} disabled={aiSaving} className="btn btn-primary flex items-center justify-center gap-2" style={{ width: '100%' }}>
                                    <Save className="h-4 w-4" /> {aiSaving ? 'Saqlanmoqda...' : 'Sozlamalarni saqlash'}
                                </button>
                            </div>
                        </div>
                    )
                })()}
            </div>
        </div>
    )
}
