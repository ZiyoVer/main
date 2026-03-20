import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrainCircuit, Users, UserCheck, GraduationCap, BarChart3, MessageSquare, FileText, Layers, Target, LogOut, Upload, Trash2, Activity, Bot, Save, Globe, Lock, TrendingUp, UserPlus, BookOpen, RefreshCw, Wifi, Search, Filter, ClipboardList, CheckCircle2, Award, Clock3, ExternalLink } from 'lucide-react'
import { AreaChart, Area, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { fetchApi, uploadFile } from '@/lib/api'
import { SUBJECTS } from '@/constants'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

function formatDuration(minutes: number) {
    if (!minutes || minutes <= 0) return '0 daq'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins} daq`
    if (mins === 0) return `${hours} soat`
    return `${hours} soat ${mins} daq`
}

export default function AdminPanel() {
    const nav = useNavigate()
    const { logout } = useAuthStore()
    const [tab, setTab] = useState<'stats' | 'users' | 'teachers' | 'docs' | 'tests' | 'ai' | 'knowledge' | 'activity'>('stats')
    const [stats, setStats] = useState<any>(null)
    const [users, setUsers] = useState<any[]>([])
    const [docs, setDocs] = useState<any[]>([])
    const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null)
    const [backfillingDocs, setBackfillingDocs] = useState(false)
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
    // Period trend (login+register combined)
    const [chartPeriod, setChartPeriod] = useState<7 | 30>(30)
    const [periodTrend, setPeriodTrend] = useState<any[]>([])
    // Test stats
    const [testStats, setTestStats] = useState<any>(null)
    // Tests tab
    const [testsSearch, setTestsSearch] = useState('')
    const [testsVisibility, setTestsVisibility] = useState<'all' | 'public' | 'private'>('all')
    const [testsSubject, setTestsSubject] = useState('')
    const [testsSortBy, setTestsSortBy] = useState('createdAt')
    const [testsPage, setTestsPage] = useState(1)
    const [testsPages, setTestsPages] = useState(1)
    const [testsTotal, setTestsTotal] = useState(0)
    const [testsSummary, setTestsSummary] = useState<any>(null)
    const [knowledgeItems, setKnowledgeItems] = useState<any[]>([])
    const [knowledgeLoading, setKnowledgeLoading] = useState(false)
    const [backfillingKnowledge, setBackfillingKnowledge] = useState(false)
    const [knowledgeForm, setKnowledgeForm] = useState({ subject: 'Matematika', title: '', content: '', source: '' })
    const [editingKnowledge, setEditingKnowledge] = useState<string | null>(null)
    const [knowledgeFilter, setKnowledgeFilter] = useState('all')

    // Online users
    const [onlineUsers, setOnlineUsers] = useState<any[]>([])
    const onlineTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const [timeSpentUsers, setTimeSpentUsers] = useState<any[]>([])
    const [trackedUsers, setTrackedUsers] = useState(0)
    const [presenceIntervalMinutes, setPresenceIntervalMinutes] = useState(5)
    const [timeSpentLoading, setTimeSpentLoading] = useState(false)

    // Activity log
    const [activityLogs, setActivityLogs] = useState<any[]>([])
    const [activityTotal, setActivityTotal] = useState(0)
    const [activityPages, setActivityPages] = useState(1)
    const [activityPage, setActivityPage] = useState(1)
    const [activityFilter, setActivityFilter] = useState('all')
    const [activityLoading, setActivityLoading] = useState(false)
    const activityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const KNOWLEDGE_SUBJECTS = SUBJECTS

    // Users pagination
    const [usersPage, setUsersPage] = useState(1)
    const [usersTotal, setUsersTotal] = useState(0)
    const [usersPages, setUsersPages] = useState(1)
    const [usersSearch, setUsersSearch] = useState('')
    const USERS_PER_PAGE = 50

    // Teachers tab
    const [teachers, setTeachers] = useState<any[]>([])
    const [teachersLoading, setTeachersLoading] = useState(false)
    const [teacherSearch, setTeacherSearch] = useState('')
    const [deletingTeacher, setDeletingTeacher] = useState<string | null>(null)

    useEffect(() => {
        loadStats()
        loadPeriodTrend(30)
        // Online users — darhol va har 30 soniyada yangilanadi
        const loadOnline = () => fetchApi('/analytics/online-users').then(setOnlineUsers).catch(() => {})
        loadOnline()
        onlineTimerRef.current = setInterval(loadOnline, 30000)
        return () => { if (onlineTimerRef.current) clearInterval(onlineTimerRef.current) }
    }, []) // faqat birinchi marta yuklanadi
    useEffect(() => {
        const sendPing = () => fetchApi('/auth/ping', { method: 'POST', body: JSON.stringify({ page: 'admin' }), silent: true }).catch(() => { })
        sendPing()
        const pingInterval = setInterval(sendPing, 60000)
        return () => clearInterval(pingInterval)
    }, [])
    useEffect(() => { loadPeriodTrend(chartPeriod) }, [chartPeriod])
    useEffect(() => { if (tab === 'users') loadUsers() }, [tab, usersPage, usersSearch])
    useEffect(() => { if (tab === 'tests') loadTests() }, [tab, testsPage, testsSearch, testsVisibility, testsSubject, testsSortBy])
    useEffect(() => { if (tab === 'knowledge') loadKnowledge() }, [tab])
    useEffect(() => { if (tab === 'teachers') loadTeachers() }, [tab])
    useEffect(() => {
        if (tab === 'activity') {
            loadActivity()
            activityTimerRef.current = setInterval(loadActivity, 30000)
        } else {
            if (activityTimerRef.current) clearInterval(activityTimerRef.current)
        }
        return () => { if (activityTimerRef.current) clearInterval(activityTimerRef.current) }
    }, [tab, activityPage, activityFilter])

    async function loadStats() {
        setLoading(true)
        try { setStats(await fetchApi('/analytics/stats')) } catch { setStats({}) }
        try {
            setTimeSpentLoading(true)
            const data = await fetchApi('/analytics/time-spent')
            setTimeSpentUsers(data.users || [])
            setTrackedUsers(data.trackedUsers || 0)
            setPresenceIntervalMinutes(data.intervalMinutes || 5)
        } catch {
            setTimeSpentUsers([])
            setTrackedUsers(0)
        } finally {
            setTimeSpentLoading(false)
        }
        try { setDocs(await fetchApi('/documents/list')) } catch { setDocs([]) }
        try { const ai = await fetchApi('/ai-settings'); setAiConfig(ai) } catch { }
        try { const d = await fetchApi('/ai-settings/defaults'); setDefaults(d) } catch { }
        try { setTestStats(await fetchApi('/analytics/test-stats')) } catch { setTestStats(null) }
        setLoading(false)
    }

    async function loadPeriodTrend(days: number) {
        try { setPeriodTrend(await fetchApi(`/analytics/period-trend?days=${days}`)) } catch { setPeriodTrend([]) }
    }

    async function loadTests() {
        try {
            const params = new URLSearchParams({ page: String(testsPage), sortBy: testsSortBy })
            if (testsSearch.trim()) params.set('search', testsSearch.trim())
            if (testsVisibility !== 'all') params.set('visibility', testsVisibility)
            if (testsSubject) params.set('subject', testsSubject)
            const data = await fetchApi(`/tests/all?${params}`)
            setTests(data.tests || [])
            setTestsTotal(data.total || 0)
            setTestsPages(data.pages || 1)
            setTestsSummary(data.summary || null)
        } catch { setTests([]) }
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

    async function deleteUser(userId: string, userName: string) {
        if (!confirm(`"${userName}" foydalanuvchisini o'chirishni tasdiqlaysizmi? Bu amalni qaytarib bo'lmaydi.`)) return
        try {
            await fetchApi(`/auth/users/${userId}`, { method: 'DELETE' })
            toast.success(`${userName} o'chirildi`)
            loadUsers()
        } catch (e: any) {
            toast.error(e.message || 'O\'chirishda xatolik')
        }
    }

    // loadAll ni boshqa joylarda ishlatish uchun saqlaymiz
    async function loadAll() { await loadStats(); await loadUsers() }

    async function loadActivity() {
        setActivityLoading(true)
        try {
            const params = new URLSearchParams({ page: String(activityPage) })
            if (activityFilter !== 'all') params.set('action', activityFilter)
            const data = await fetchApi(`/analytics/activity-log?${params}`)
            setActivityLogs(data.logs || [])
            setActivityTotal(data.total || 0)
            setActivityPages(data.pages || 1)
        } catch { setActivityLogs([]) }
        setActivityLoading(false)
    }

    async function loadTeachers() {
        setTeachersLoading(true)
        try {
            const data = await fetchApi('/auth/users?role=TEACHER&limit=100')
            setTeachers(data.users || [])
        } catch { setTeachers([]) }
        setTeachersLoading(false)
    }

    async function createTeacher(e: React.FormEvent) {
        e.preventDefault()
        if (creating) return
        setCreating(true); setMsg('')
        try {
            await fetchApi('/auth/create-teacher', { method: 'POST', body: JSON.stringify(tf) })
            setMsg('\u2713 O\'qituvchi muvaffaqiyatli yaratildi!')
            setTf({ name: '', email: '', password: '' })
            loadAll()
            loadTeachers()
        } catch (e: any) { setMsg('\u2717 ' + e.message) }
        setCreating(false)
    }

    async function deleteTeacher(userId: string) {
        if (!window.confirm('O\'qituvchini o\'chirishni tasdiqlaysizmi? Bu amal qaytarib bo\'lmaydi.')) return
        setDeletingTeacher(userId)
        try {
            await fetchApi(`/auth/users/${userId}`, { method: 'DELETE' })
            toast.success('O\'qituvchi o\'chirildi')
            loadTeachers()
            loadStats()
        } catch (e: any) { toast.error(e.message || 'O\'chirishda xatolik') }
        setDeletingTeacher(null)
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

    async function backfillDocumentEmbeddings() {
        try {
            setBackfillingDocs(true)
            const data = await fetchApi('/documents/backfill-embeddings?limit=120', { method: 'POST' })
            toast.success(`${data.updated || 0} ta document chunk yangilandi. Qoldi: ${data.remaining || 0}`)
            loadAll()
        } catch (e: any) {
            toast.error(e?.message || 'Document embedding backfill xatoligi')
        } finally {
            setBackfillingDocs(false)
        }
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

    const [pdfImporting, setPdfImporting] = useState(false)
    const [pdfForm, setPdfForm] = useState({ subject: 'Tarix', title: '', source: '' })
    const [showPdfImport, setShowPdfImport] = useState(false)

    const importKnowledgePdf = async (file: File) => {
        if (!pdfForm.title.trim()) return toast.error('Sarlavha kiriting')
        setPdfImporting(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('subject', pdfForm.subject)
            formData.append('title', pdfForm.title)
            formData.append('source', pdfForm.source || file.name)
            const token = localStorage.getItem('token')
            const res = await fetch('/api/knowledge/pdf-import', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            toast.success(data.message)
            setPdfForm({ subject: 'Tarix', title: '', source: '' })
            setShowPdfImport(false)
            loadKnowledge()
        } catch (e: any) { toast.error(e.message) }
        finally { setPdfImporting(false) }
    }

    const backfillKnowledgeEmbeddings = async () => {
        try {
            setBackfillingKnowledge(true)
            const data = await fetchApi('/knowledge/backfill-embeddings?limit=120', { method: 'POST' })
            toast.success(`${data.updated || 0} ta knowledge item yangilandi. Qoldi: ${data.remaining || 0}`)
            loadKnowledge()
        } catch (e: any) {
            toast.error(e?.message || 'Knowledge embedding backfill xatoligi')
        } finally {
            setBackfillingKnowledge(false)
        }
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

    async function openDocument(docId: string) {
        const popup = window.open('', '_blank')
        try {
            setDownloadingDocId(docId)
            const data = await fetchApi(`/documents/${docId}/download-url`)
            if (!data?.url) throw new Error('Hujjat manzili topilmadi')
            if (popup) {
                popup.opener = null
                popup.location.href = data.url
            } else {
                window.open(data.url, '_blank', 'noopener,noreferrer')
            }
        } catch (e: any) {
            if (popup && !popup.closed) popup.close()
            toast.error(e?.message || 'Hujjatni ochishda xatolik')
        } finally {
            setDownloadingDocId(null)
        }
    }

    async function deleteTest(id: string) {
        if (!confirm('Testni o\'chirmoqchimisiz?')) return
        try { await fetchApi(`/tests/${id}`, { method: 'DELETE' }); toast.success('Test o\'chirildi'); loadTests() } catch { toast.error('Xatolik') }
    }

    const tabs = [
        { k: 'stats' as const, l: 'Statistika', icon: BarChart3 },
        { k: 'activity' as const, l: 'Faollik', icon: Activity },
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
                        <span className="text-sm font-bold">DTMMax</span>
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
                    <div className="space-y-5">

                        {/* === HOZIR ONLAYN === */}
                        <div className="rounded-xl overflow-hidden" style={{ border: '1.5px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.04)' }}>
                            <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(16,185,129,0.15)' }}>
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-[12px] font-bold" style={{ color: '#059669' }}>Hozir onlayn — {onlineUsers.length} ta</span>
                                </div>
                                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>30s yangilanadi</span>
                            </div>
                            {onlineUsers.length === 0 ? (
                                <div className="px-4 py-3 text-[12px]" style={{ color: 'var(--text-muted)' }}>Hozircha hech kim onlayn emas</div>
                            ) : (
                                <div className="divide-y" style={{ borderColor: 'rgba(16,185,129,0.1)' }}>
                                    {onlineUsers.map((u: any, i: number) => {
                                        const ago = Math.round((Date.now() - u.lastSeen) / 1000)
                                        const agoStr = ago < 60 ? `${ago}s oldin` : `${Math.round(ago/60)}min oldin`
                                        const roleColor = u.role === 'ADMIN' ? '#6366f1' : u.role === 'TEACHER' ? '#d97706' : '#059669'
                                        return (
                                            <div key={i} className="flex items-center gap-3 px-4 py-2">
                                                <div className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0" style={{ background: roleColor }}>{u.name?.[0]?.toUpperCase() || '?'}</div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[12px] font-semibold truncate">{u.name}</p>
                                                    <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${roleColor}18`, color: roleColor }}>{u.role}</span>
                                                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{agoStr}</span>
                                                    <Wifi className="h-3 w-3" style={{ color: '#059669' }} />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* === ASOSIY METRIKALAR === */}
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2.5" style={mutedText}>Foydalanuvchilar</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                                {[
                                    { n: stats.totalUsers, l: 'Jami', icon: Users, color: 'var(--text-secondary)' },
                                    { n: stats.students, l: 'O\'quvchilar', icon: GraduationCap, color: 'var(--brand)' },
                                    { n: stats.teachers, l: 'O\'qituvchilar', icon: UserCheck, color: '#d97706' },
                                    { n: stats.emailVerifiedCount, l: 'Email tasdiqlangan', icon: CheckCircle2, color: 'var(--success)' },
                                ].map((s, i) => (
                                    <div key={i} className="rounded-xl p-4 flex items-center gap-3" style={cardStyle}>
                                        <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ color: s.color, background: `color-mix(in srgb, ${s.color} 12%, transparent)` }}>
                                            <s.icon className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold tabular-nums leading-none">{s.n ?? 0}</p>
                                            <p className="text-[11px] mt-0.5" style={mutedText}>{s.l}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2.5" style={mutedText}>Faollik</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                                {[
                                    { n: stats.onlineNow ?? onlineUsers.length, l: 'Hozir onlayn', icon: Wifi, color: '#059669' },
                                    { n: stats.newUsers24h, l: 'Yangi userlar (24h)', icon: UserPlus, color: '#6366f1' },
                                    { n: stats.activeUsers7d, l: 'Faol userlar (7 kun)', icon: Activity, color: '#06b6d4' },
                                    { n: stats.messages7d, l: 'Xabarlar (7 kun)', icon: MessageSquare, color: '#f59e0b' },
                                ].map((s, i) => (
                                    <div key={i} className="rounded-xl p-4 flex items-center gap-3" style={cardStyle}>
                                        <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ color: s.color, background: `color-mix(in srgb, ${s.color} 12%, transparent)` }}>
                                            <s.icon className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold tabular-nums leading-none">{s.n ?? 0}</p>
                                            <p className="text-[11px] mt-0.5" style={mutedText}>{s.l}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* === TREND CHART === */}
                        <div className="rounded-xl p-4" style={cardStyle}>
                            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)' }}>
                                        <TrendingUp className="h-3.5 w-3.5" />
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-semibold">Kirish va ro'yxatdan o'tish trendi</p>
                                        <p className="text-[11px]" style={mutedText}>{chartPeriod} kunlik ko'rsatgich</p>
                                    </div>
                                </div>
                                <div className="flex gap-1 rounded-lg p-0.5" style={{ background: 'var(--bg-surface)' }}>
                                    {([7, 30] as const).map(d => (
                                        <button key={d} onClick={() => setChartPeriod(d)}
                                            className="px-3 py-1.5 rounded-md text-[12px] font-medium transition"
                                            style={chartPeriod === d ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : { color: 'var(--text-muted)' }}>
                                            {d} kun
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <ResponsiveContainer width="100%" height={220}>
                                <ComposedChart data={periodTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="loginGrad2" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={chartPeriod <= 14 ? 0 : Math.floor(chartPeriod / 10)} />
                                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
                                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                                    <Area type="monotone" dataKey="logins" name="Kirishlar" stroke="var(--brand)" fill="url(#loginGrad2)" strokeWidth={2} dot={false} />
                                    <Bar dataKey="registers" name="Yangi a'zolar" fill="var(--success)" radius={[3, 3, 0, 0]} opacity={0.85} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>

                        {/* === TEST STATISTIKASI === */}
                        {testStats && (
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wider mb-2.5" style={mutedText}>Test statistikasi</p>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mb-3">
                                    {[
                                        { n: testStats.totalTests, l: 'Jami testlar', icon: ClipboardList, color: '#6366f1' },
                                        { n: testStats.publicTests, l: 'Ochiq (public)', icon: Globe, color: 'var(--success)' },
                                        { n: testStats.privateTests, l: 'Yopiq (private)', icon: Lock, color: 'var(--text-muted)' },
                                        { n: testStats.totalAttempts, l: 'Jami urinishlar', icon: BarChart3, color: 'var(--brand)' },
                                        { n: `${testStats.avgScore ?? 0}%`, l: 'O\'rtacha ball', icon: Award, color: '#f59e0b' },
                                    ].map((s, i) => (
                                        <div key={i} className="rounded-xl p-3.5 flex items-center gap-2.5" style={cardStyle}>
                                            <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ color: s.color, background: `color-mix(in srgb, ${s.color} 12%, transparent)` }}>
                                                <s.icon className="h-3.5 w-3.5" />
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold tabular-nums leading-none">{s.n ?? 0}</p>
                                                <p className="text-[10px] mt-0.5" style={mutedText}>{s.l}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Top testlar + so'nggi urinishlar */}
                                <div className="grid md:grid-cols-2 gap-3">
                                    <div className="rounded-xl overflow-hidden" style={cardStyle}>
                                        <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                                            <BarChart3 className="h-3.5 w-3.5" style={{ color: 'var(--brand)' }} />
                                            <p className="text-[12px] font-semibold">Eng ko'p yechilgan testlar</p>
                                        </div>
                                        {(testStats.topTests || []).map((t: any, i: number) => (
                                            <div key={t.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: i < testStats.topTests.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                                <span className="text-[11px] font-mono w-4 flex-shrink-0 text-right" style={mutedText}>{i + 1}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[12px] font-medium truncate">{t.title}</p>
                                                    <p className="text-[10px]" style={mutedText}>{t.creator?.name} · {t.subject}</p>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--brand)' }}>{t._count?.attempts}</span>
                                                    <span className="text-[10px]" style={mutedText}>urinish</span>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={t.isPublic ? { background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' } : { background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
                                                        {t.isPublic ? 'Ochiq' : 'Yopiq'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="rounded-xl overflow-hidden" style={cardStyle}>
                                        <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                                            <Activity className="h-3.5 w-3.5" style={{ color: 'var(--brand)' }} />
                                            <p className="text-[12px] font-semibold">So'nggi urinishlar</p>
                                        </div>
                                        {(testStats.recentAttempts || []).map((a: any, i: number) => (
                                            <div key={a.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: i < testStats.recentAttempts.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                                <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                                                    {a.user?.name?.[0]?.toUpperCase() || '?'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[12px] font-medium truncate">{a.user?.name}</p>
                                                    <p className="text-[10px] truncate" style={mutedText}>{a.test?.title}</p>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className="text-[12px] font-bold tabular-nums" style={{ color: a.score >= 70 ? 'var(--success)' : a.score >= 50 ? '#f59e0b' : 'var(--danger)' }}>
                                                        {Math.round(a.score)}%
                                                    </span>
                                                    <span className="text-[10px]" style={mutedText}>
                                                        {new Date(a.createdAt).toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' })}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* === OXIRGI RO'YXATDAN O'TGANLAR === */}
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
                                    {(stats.recentUsers || []).slice(0, 4).map((u: any) => (
                                        <div key={u.id} className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>{u.name?.[0]?.toUpperCase()}</div>
                                            <span className="text-[12px] flex-1 truncate" style={secondaryText}>{u.name}</span>
                                            <span className="text-[10px]" style={mutedText}>{new Date(u.createdAt).toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' })}</span>
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                                style={u.role === 'TEACHER' ? { background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)' } : { background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>{u.role}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl overflow-hidden" style={cardStyle}>
                            <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)' }}>
                                        <Clock3 className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-semibold">Platformada o‘tkazilgan vaqt</p>
                                        <p className="text-[11px]" style={mutedText}>{trackedUsers} ta user · {presenceIntervalMinutes} daqiqalik aktivlik pulsi asosida taxminiy hisob</p>
                                    </div>
                                </div>
                                <button onClick={loadStats} className="btn btn-sm btn-outline flex items-center gap-1.5">
                                    <RefreshCw className={`h-3 w-3 ${timeSpentLoading ? 'animate-spin' : ''}`} /> Yangilash
                                </button>
                            </div>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                                        <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>Foydalanuvchi</th>
                                        <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>Bugun</th>
                                        <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>7 kun</th>
                                        <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>Jami</th>
                                        <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>So‘nggi faollik</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {timeSpentLoading && timeSpentUsers.length === 0 ? (
                                        <tr><td colSpan={5} className="text-center py-10 text-[12px]" style={mutedText}>Yuklanmoqda...</td></tr>
                                    ) : timeSpentUsers.length === 0 ? (
                                        <tr><td colSpan={5} className="text-center py-10 text-[12px]" style={mutedText}>Hali vaqt statistikasi to‘planmagan</td></tr>
                                    ) : timeSpentUsers.slice(0, 12).map((user: any) => (
                                        <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-[var(--bg-surface)] transition-colors">
                                            <td className="py-2.5 px-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                                                        {user.name?.[0]?.toUpperCase() || '?'}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="text-[12px] font-medium truncate">{user.name}</p>
                                                            {user.isOnline && <span className="h-2 w-2 rounded-full" style={{ background: '#10b981' }} />}
                                                        </div>
                                                        <p className="text-[10px] truncate" style={mutedText}>{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-4 text-[12px] font-medium tabular-nums">{formatDuration(user.todayMinutes || 0)}</td>
                                            <td className="py-2.5 px-4 text-[12px] font-medium tabular-nums">{formatDuration(user.weekMinutes || 0)}</td>
                                            <td className="py-2.5 px-4">
                                                <div>
                                                    <p className="text-[12px] font-semibold tabular-nums">{formatDuration(user.totalMinutes || 0)}</p>
                                                    <p className="text-[10px]" style={mutedText}>{user.totalHours || 0} soat</p>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-4 text-[11px] tabular-nums" style={mutedText}>
                                                {user.lastSeen
                                                    ? new Date(user.lastSeen).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                                                    : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
                                        <th className="py-2.5 px-2 font-medium text-[11px] uppercase" style={mutedText}></th>
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
                                            <td className="py-2.5 px-2">
                                                {u.role !== 'ADMIN' && (
                                                    <button onClick={() => deleteUser(u.id, u.name)}
                                                        className="h-6 w-6 flex items-center justify-center rounded transition"
                                                        style={{ color: 'var(--border-strong)' }}
                                                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-light)' }}
                                                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--border-strong)'; e.currentTarget.style.background = 'transparent' }}
                                                        title="O'chirish">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </td>
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

                {/* === TEACHERS === */}
                {tab === 'teachers' && (
                    <div className="space-y-5">
                        {/* ── Summary bar ── */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={cardStyle}>
                                <UserCheck className="h-4 w-4" style={{ color: '#d97706' }} />
                                <span className="text-sm font-semibold">{teachers.length} ta o'qituvchi</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={cardStyle}>
                                <ClipboardList className="h-4 w-4" style={{ color: 'var(--brand)' }} />
                                <span className="text-sm font-semibold">{teachers.reduce((s, t) => s + (t._count?.testsCreated ?? 0), 0)} ta test</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 items-start">
                            {/* ── LEFT: Create form ── */}
                            <div className="rounded-2xl p-5 space-y-4" style={cardStyle}>
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, #d97706 14%, transparent)' }}>
                                        <UserPlus className="h-5 w-5" style={{ color: '#d97706' }} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm">Yangi O'qituvchi qo'shish</h3>
                                        <p className="text-[12px]" style={mutedText}>Login va parol siz yaratib berasiz</p>
                                    </div>
                                </div>

                                {msg && (
                                    <div className="text-[13px] px-3.5 py-2.5 rounded-xl" style={msg.startsWith('✓') ? { background: 'color-mix(in srgb, var(--success) 10%, transparent)', color: 'var(--success)', border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)' } : { background: 'var(--danger-light)', color: 'var(--danger)' }}>
                                        {msg}
                                    </div>
                                )}

                                <form onSubmit={createTeacher} className="space-y-2.5">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: 'var(--text-muted)' }}>👤</span>
                                        <input placeholder="To'liq ism" required value={tf.name} onChange={e => setTf({ ...tf, name: e.target.value })} className="input pl-8" />
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: 'var(--text-muted)' }}>✉</span>
                                        <input type="email" placeholder="Email manzil" required value={tf.email} onChange={e => setTf({ ...tf, email: e.target.value })} className="input pl-8" />
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: 'var(--text-muted)' }}>🔑</span>
                                        <input type="password" placeholder="Parol (kamida 6 ta belgi)" required minLength={6} value={tf.password} onChange={e => setTf({ ...tf, password: e.target.value })} className="input pl-8" />
                                    </div>
                                    <button type="submit" disabled={creating}
                                        className="w-full h-10 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
                                        style={{ background: 'var(--text-primary)' }}>
                                        {creating
                                            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Yaratilmoqda...</>
                                            : <><UserPlus className="h-4 w-4" /> O'qituvchi yaratish</>}
                                    </button>
                                </form>

                                {/* Info note */}
                                <div className="rounded-xl px-3.5 py-3 text-[12px] leading-relaxed" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                                    💡 O'qituvchi ro'yxatdan o'tgandan so'ng test yaratishi, o'quvchilariga ulashishi va natijalarni ko'rishi mumkin bo'ladi.
                                </div>
                            </div>

                            {/* ── RIGHT: Teachers list ── */}
                            <div className="space-y-3">
                                {/* Search */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                                    <input type="search" placeholder="Ism yoki email bo'yicha qidirish..."
                                        value={teacherSearch}
                                        onChange={e => setTeacherSearch(e.target.value)}
                                        className="input pl-9 w-full" style={{ height: '2.25rem', fontSize: '13px' }} />
                                </div>

                                {teachersLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--border-strong)', borderTopColor: 'var(--brand)' }} />
                                    </div>
                                ) : teachers.length === 0 ? (
                                    <div className="text-center py-12 rounded-2xl" style={cardStyle}>
                                        <UserCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm" style={mutedText}>Hali o'qituvchilar qo'shilmagan</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {teachers
                                            .filter(t => {
                                                const q = teacherSearch.toLowerCase()
                                                return !q || t.name?.toLowerCase().includes(q) || t.email?.toLowerCase().includes(q)
                                            })
                                            .map(teacher => {
                                                const initials = teacher.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'
                                                const testCount = teacher._count?.testsCreated ?? 0
                                                const joined = new Date(teacher.createdAt).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'short', day: 'numeric' })
                                                return (
                                                    <div key={teacher.id} className="rounded-xl p-4 flex flex-col gap-3 transition" style={cardStyle}>
                                                        {/* Top row: avatar + info */}
                                                        <div className="flex items-center gap-3">
                                                            {/* Avatar */}
                                                            <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-[13px] text-white"
                                                                style={{ background: `hsl(${(teacher.name?.charCodeAt(0) || 65) * 6 % 360}, 55%, 52%)` }}>
                                                                {initials}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[13px] font-semibold truncate">{teacher.name}</p>
                                                                <p className="text-[11px] truncate" style={mutedText}>{teacher.email}</p>
                                                            </div>
                                                            {/* Delete */}
                                                            <button
                                                                onClick={() => deleteTeacher(teacher.id)}
                                                                disabled={deletingTeacher === teacher.id}
                                                                className="h-7 w-7 flex items-center justify-center rounded-lg transition flex-shrink-0"
                                                                style={{ color: 'var(--text-muted)' }}
                                                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-light)' }}
                                                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}>
                                                                {deletingTeacher === teacher.id
                                                                    ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                                                    : <Trash2 className="h-3.5 w-3.5" />}
                                                            </button>
                                                        </div>

                                                        {/* Stats row */}
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
                                                                <ClipboardList className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--brand)' }} />
                                                                <span className="text-[11px] font-semibold">{testCount}</span>
                                                                <span className="text-[11px]" style={mutedText}>test</span>
                                                            </div>
                                                            <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
                                                                <GraduationCap className="h-3 w-3 flex-shrink-0" style={{ color: '#d97706' }} />
                                                                <span className="text-[11px]" style={mutedText}>{joined}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* === TESTS === */}
                {tab === 'tests' && (
                    <div className="space-y-3">
                        {/* Summary cards */}
                        {testsSummary && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                                {[
                                    { n: testsTotal, l: 'Jami (filtr)', icon: ClipboardList, color: '#6366f1' },
                                    { n: testsSummary.totalPublic, l: 'Ochiq testlar', icon: Globe, color: 'var(--success)' },
                                    { n: testsSummary.totalPrivate, l: 'Yopiq testlar', icon: Lock, color: 'var(--text-muted)' },
                                    { n: testsSummary.totalAttempts, l: 'Jami urinishlar', icon: BarChart3, color: 'var(--brand)' },
                                ].map((s, i) => (
                                    <div key={i} className="rounded-xl p-3.5 flex items-center gap-2.5" style={cardStyle}>
                                        <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ color: s.color, background: `color-mix(in srgb, ${s.color} 12%, transparent)` }}>
                                            <s.icon className="h-3.5 w-3.5" />
                                        </div>
                                        <div>
                                            <p className="text-lg font-bold tabular-nums leading-none">{s.n ?? 0}</p>
                                            <p className="text-[10px] mt-0.5" style={mutedText}>{s.l}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Search + filter controls */}
                        <div className="flex flex-wrap gap-2 items-center">
                            <div className="relative flex-1" style={{ minWidth: 200 }}>
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                                <input type="search" placeholder="Test nomi yoki mualif bo'yicha..."
                                    value={testsSearch}
                                    onChange={e => { setTestsSearch(e.target.value); setTestsPage(1) }}
                                    className="input pl-8" style={{ height: '2rem', fontSize: '12px' }} />
                            </div>
                            {/* Visibility filter */}
                            <div className="flex gap-0.5 rounded-lg p-0.5" style={{ background: 'var(--bg-surface)' }}>
                                {(['all', 'public', 'private'] as const).map(v => (
                                    <button key={v} onClick={() => { setTestsVisibility(v); setTestsPage(1) }}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition"
                                        style={testsVisibility === v ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : { color: 'var(--text-muted)' }}>
                                        {v === 'all' ? 'Barchasi' : v === 'public' ? <><Globe className="h-3 w-3" /> Ochiq</> : <><Lock className="h-3 w-3" /> Yopiq</>}
                                    </button>
                                ))}
                            </div>
                            {/* Subject filter */}
                            <select value={testsSubject} onChange={e => { setTestsSubject(e.target.value); setTestsPage(1) }}
                                className="input" style={{ height: '2rem', fontSize: '12px', width: 'auto' }}>
                                <option value="">Barcha fanlar</option>
                                {KNOWLEDGE_SUBJECTS.map(s =>
                                    <option key={s} value={s}>{s}</option>
                                )}
                            </select>
                            {/* Sort */}
                            <select value={testsSortBy} onChange={e => setTestsSortBy(e.target.value)}
                                className="input" style={{ height: '2rem', fontSize: '12px', width: 'auto' }}>
                                <option value="createdAt">Yangi → Eski</option>
                                <option value="attempts">Ko'p urinilgan</option>
                                <option value="questions">Ko'p savollar</option>
                            </select>
                            <span className="text-[11px]" style={mutedText}>{testsTotal} ta natija</span>
                        </div>

                        {/* Table */}
                        <div className="rounded-xl overflow-hidden" style={cardStyle}>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                                        <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>Test nomi</th>
                                        <th className="text-left py-2.5 px-3 font-medium text-[11px] uppercase" style={mutedText}>Muallif</th>
                                        <th className="text-left py-2.5 px-3 font-medium text-[11px] uppercase" style={mutedText}>Fan</th>
                                        <th className="text-center py-2.5 px-2 font-medium text-[11px] uppercase" style={mutedText}>Holat</th>
                                        <th className="text-right py-2.5 px-3 font-medium text-[11px] uppercase" style={mutedText}>Savollar</th>
                                        <th className="text-right py-2.5 px-3 font-medium text-[11px] uppercase" style={mutedText}>Urinishlar</th>
                                        <th className="text-right py-2.5 px-3 font-medium text-[11px] uppercase" style={mutedText}>O'rt ball</th>
                                        <th className="text-right py-2.5 px-3 font-medium text-[11px] uppercase" style={mutedText}>Sana</th>
                                        <th className="py-2.5 px-2" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {tests.length === 0 ? (
                                        <tr><td colSpan={9} className="text-center py-10 text-[12px]" style={mutedText}>Testlar topilmadi</td></tr>
                                    ) : tests.map((t: any) => (
                                        <tr key={t.id} className="transition" style={{ borderBottom: '1px solid var(--border)' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td className="py-2.5 px-4 max-w-[200px]">
                                                <p className="text-[13px] font-medium truncate">{t.title}</p>
                                                {t.testType && <p className="text-[10px]" style={mutedText}>{t.testType}</p>}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0" style={{
                                                        background: t.creator?.role === 'ADMIN' ? 'color-mix(in srgb, #6366f1 20%, transparent)' : 'var(--bg-muted)',
                                                        color: t.creator?.role === 'ADMIN' ? '#6366f1' : 'var(--text-secondary)'
                                                    }}>
                                                        {t.creator?.name?.[0]?.toUpperCase() || '?'}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[12px] truncate max-w-[100px]">{t.creator?.name || '—'}</p>
                                                        {t.creator?.role && t.creator.role !== 'STUDENT' && (
                                                            <p className="text-[10px]" style={{ color: t.creator.role === 'ADMIN' ? '#6366f1' : '#d97706' }}>{t.creator.role}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <span className="text-[11px]" style={mutedText}>{t.subject || '—'}</span>
                                            </td>
                                            <td className="py-2.5 px-2 text-center">
                                                <span className="flex items-center justify-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium w-fit mx-auto"
                                                    style={t.isPublic ? { background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' } : { background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
                                                    {t.isPublic ? <Globe className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                                                    {t.isPublic ? 'Ochiq' : 'Yopiq'}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-right">
                                                <span className="text-[13px] font-semibold tabular-nums">{t._count?.questions || 0}</span>
                                            </td>
                                            <td className="py-2.5 px-3 text-right">
                                                <span className="text-[13px] font-semibold tabular-nums" style={{ color: (t._count?.attempts || 0) > 0 ? 'var(--brand)' : 'var(--text-muted)' }}>
                                                    {t._count?.attempts || 0}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-right">
                                                {t.avgScore != null ? (
                                                    <span className="text-[12px] font-semibold tabular-nums"
                                                        style={{ color: t.avgScore >= 70 ? 'var(--success)' : t.avgScore >= 50 ? '#f59e0b' : 'var(--danger)' }}>
                                                        {t.avgScore}%
                                                    </span>
                                                ) : <span className="text-[11px]" style={mutedText}>—</span>}
                                            </td>
                                            <td className="py-2.5 px-3 text-right">
                                                <span className="text-[11px] tabular-nums" style={mutedText}>
                                                    {new Date(t.createdAt).toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' })}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-2">
                                                <button onClick={() => deleteTest(t.id)} className="h-7 w-7 flex items-center justify-center rounded-lg transition flex-shrink-0"
                                                    style={{ color: 'var(--text-muted)' }}
                                                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-light)' }}
                                                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {testsPages > 1 && (
                            <div className="flex items-center justify-between">
                                <p className="text-[11px]" style={mutedText}>{(testsPage - 1) * 50 + 1}–{Math.min(testsPage * 50, testsTotal)} / {testsTotal}</p>
                                <div className="flex gap-1">
                                    <button onClick={() => setTestsPage(p => Math.max(1, p - 1))} disabled={testsPage <= 1}
                                        className="h-7 px-3 rounded-lg text-[12px] font-medium transition disabled:opacity-40"
                                        style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>← Oldingi</button>
                                    <span className="h-7 px-3 flex items-center text-[12px]" style={mutedText}>{testsPage} / {testsPages}</span>
                                    <button onClick={() => setTestsPage(p => Math.min(testsPages, p + 1))} disabled={testsPage >= testsPages}
                                        className="h-7 px-3 rounded-lg text-[12px] font-medium transition disabled:opacity-40"
                                        style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>Keyingi →</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* === RAG DOCS === */}
                {tab === 'docs' && (
                    <div className="space-y-3">
                        <div className="rounded-xl p-5" style={cardStyle}>
                            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' }}>
                                        <Upload className="h-4.5 w-4.5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm">Material Yuklash</h3>
                                        <p className="text-xs" style={mutedText}>PDF, Word yoki TXT — RAG tizimiga qo'shiladi</p>
                                    </div>
                                </div>
                                <button onClick={backfillDocumentEmbeddings} disabled={backfillingDocs} className="btn btn-outline flex items-center gap-2 text-xs">
                                    <RefreshCw className={`h-3.5 w-3.5 ${backfillingDocs ? 'animate-spin' : ''}`} />
                                    {backfillingDocs ? 'Backfill...' : 'Embedding backfill'}
                                </button>
                            </div>
                            <div className="flex gap-2.5 items-end">
                                <div className="flex-1">
                                    <label className="text-xs font-medium block mb-1" style={secondaryText}>Fan</label>
                                    <select value={docSubject} onChange={e => setDocSubject(e.target.value)} className="input" style={{ cursor: 'pointer' }}>
                                        {[...KNOWLEDGE_SUBJECTS, 'Umumiy'].map(f =>
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
                                {d.hasFile && (
                                    <button
                                        onClick={() => openDocument(d.id)}
                                        disabled={downloadingDocId === d.id}
                                        className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg transition text-[11px] font-medium disabled:opacity-50"
                                        style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        {downloadingDocId === d.id ? 'Ochilyapti...' : 'Ochish'}
                                    </button>
                                )}
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

                {/* === FAOLLIK LOGI === */}
                {tab === 'activity' && (
                    <div>
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                                <p className="text-[11px]" style={mutedText}>{activityTotal} ta yozuv</p>
                                <button onClick={loadActivity} className="btn btn-sm btn-outline flex items-center gap-1.5">
                                    <RefreshCw className={`h-3 w-3 ${activityLoading ? 'animate-spin' : ''}`} /> Yangilash
                                </button>
                            </div>
                            <div className="flex gap-1.5">
                                {['all', 'login', 'register', 'activity'].map(f => (
                                    <button key={f} onClick={() => { setActivityFilter(f); setActivityPage(1) }}
                                        className={`btn btn-sm ${activityFilter === f ? 'btn-primary' : 'btn-outline'}`}>
                                        {f === 'all' ? 'Barchasi' : f === 'login' ? 'Kirish' : f === 'register' ? 'Ro\'yxat' : 'Faollik'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-xl overflow-hidden" style={cardStyle}>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                                        <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>Foydalanuvchi</th>
                                        <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>Harakat</th>
                                        <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>IP</th>
                                        <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>Vaqt</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activityLoading && activityLogs.length === 0 ? (
                                        <tr><td colSpan={4} className="text-center py-10 text-[12px]" style={mutedText}>Yuklanmoqda...</td></tr>
                                    ) : activityLogs.length === 0 ? (
                                        <tr><td colSpan={4} className="text-center py-10 text-[12px]" style={mutedText}>Yozuvlar yo'q</td></tr>
                                    ) : activityLogs.map((log: any) => (
                                        <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-[var(--bg-surface)] transition-colors">
                                            <td className="py-2.5 px-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                                                        style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                                                        {log.user?.name?.[0]?.toUpperCase() || '?'}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[12px] font-medium truncate">{log.user?.name || '—'}</p>
                                                        <p className="text-[10px] truncate" style={mutedText}>{log.user?.email || 'Mehmon'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-4">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={
                                                    log.action === 'login' ? { background: 'color-mix(in srgb, var(--brand) 15%, transparent)', color: 'var(--brand)' } :
                                                    log.action === 'register' ? { background: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)' } :
                                                    { background: 'var(--bg-surface)', color: 'var(--text-muted)' }
                                                }>
                                                    {log.action === 'login' ? '🔑 kirish' : log.action === 'register' ? '✨ ro\'yxat' : log.action}
                                                </span>
                                                {log.user?.role && (
                                                    <span className="ml-1.5 text-[10px]" style={mutedText}>{log.user.role}</span>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-4 text-[11px]" style={mutedText}>{log.ip || '—'}</td>
                                            <td className="py-2.5 px-4 text-[11px] tabular-nums" style={mutedText}>
                                                {new Date(log.createdAt).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {activityPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-3">
                                <button disabled={activityPage <= 1} onClick={() => setActivityPage(p => p - 1)} className="btn btn-sm btn-outline">← Oldingi</button>
                                <span className="text-[12px]" style={mutedText}>{activityPage} / {activityPages}</span>
                                <button disabled={activityPage >= activityPages} onClick={() => setActivityPage(p => p + 1)} className="btn btn-sm btn-outline">Keyingi →</button>
                            </div>
                        )}
                    </div>
                )}

                {/* === KNOWLEDGE BASE === */}
                {tab === 'knowledge' && (
                    <div>
                        <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
                            <div>
                                <h2 className="text-base font-bold mb-1">📚 Kutubxona — Kitoblar va Materiallar</h2>
                                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    Darsliklar, DTM materiallarini yuklang — AI chat jarayonida ulardan foydalanadi.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    onClick={backfillKnowledgeEmbeddings}
                                    disabled={backfillingKnowledge}
                                    className="btn btn-outline flex items-center gap-2 flex-shrink-0"
                                >
                                    <RefreshCw className={`h-4 w-4 ${backfillingKnowledge ? 'animate-spin' : ''}`} />
                                    {backfillingKnowledge ? 'Backfill...' : 'Embedding backfill'}
                                </button>
                                <button
                                    onClick={() => setShowPdfImport(v => !v)}
                                    className="btn btn-primary flex items-center gap-2 flex-shrink-0"
                                >
                                    <Upload className="h-4 w-4" />
                                    PDF/Kitob yuklash
                                </button>
                            </div>
                        </div>

                        {/* PDF Import Panel */}
                        {showPdfImport && (
                            <div className="rounded-xl p-5 mb-5 border-2" style={{ borderColor: 'var(--brand)', background: 'color-mix(in srgb, var(--brand) 4%, var(--bg-card))' }}>
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                    <Upload className="h-4 w-4" style={{ color: 'var(--brand)' }} />
                                    Kitob / Material yuklab import qilish
                                </h3>
                                <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                                    PDF, Word yoki TXT fayl yuklang — AI uchun avtomatik bo'laklarga bo'linadi. Tarix, Biologiya darsliklari, Milliy Sertifikat materiallari va boshqalar.
                                </p>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label className="text-sm font-medium block mb-1">Fan</label>
                                        <select className="input" value={pdfForm.subject} onChange={e => setPdfForm(f => ({ ...f, subject: e.target.value }))}>
                                            {KNOWLEDGE_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium block mb-1">Manba (ixtiyoriy)</label>
                                        <input className="input" placeholder="Mas: O'zbek tarixi 10-sinf"
                                            value={pdfForm.source} onChange={e => setPdfForm(f => ({ ...f, source: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="mb-4">
                                    <label className="text-sm font-medium block mb-1">Sarlavha <span style={{ color: 'var(--danger)' }}>*</span></label>
                                    <input className="input" placeholder="Mas: O'zbek tarixi darsligi — 10-sinf"
                                        value={pdfForm.title} onChange={e => setPdfForm(f => ({ ...f, title: e.target.value }))} />
                                </div>
                                <label className={`btn flex items-center gap-2 cursor-pointer w-fit ${pdfImporting ? 'opacity-50 pointer-events-none' : ''}`}
                                    style={{ background: 'var(--brand)', color: '#fff' }}>
                                    <input type="file" accept=".pdf,.docx,.doc,.txt" className="hidden"
                                        onChange={e => { const f = e.target.files?.[0]; if (f) importKnowledgePdf(f); e.target.value = '' }} />
                                    {pdfImporting ? (
                                        <><div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.4)', borderTopColor: 'transparent' }} /> Import qilinmoqda...</>
                                    ) : (
                                        <><Upload className="h-4 w-4" /> Faylni tanlang va import qiling</>
                                    )}
                                </label>
                            </div>
                        )}

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
                        { key: 'prompt_role', label: 'Rol va shaxsiyat', desc: '🎓 AI kim — "Sen DTMMax platformasi..."' },
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
