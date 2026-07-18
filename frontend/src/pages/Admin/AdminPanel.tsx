import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrainCircuit, Users, UserCheck, GraduationCap, BarChart3, MessageSquare, FileText, Layers, Target, LogOut, Upload, Trash2, Activity, Bot, Save, Globe, Lock, TrendingUp, UserPlus, BookOpen, RefreshCw, Wifi, Search, Filter, ClipboardList, CheckCircle2, Award, Clock3, ExternalLink, Send, Download, Mail, KeyRound, MoreVertical, AlertTriangle, Bell, X, Shield, Flame, Zap, CalendarClock, Gauge, ThumbsUp, ThumbsDown, Pencil, ScrollText, Ban, ShieldCheck, CreditCard } from 'lucide-react'
import { AreaChart, Area, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { fetchApi, uploadFile } from '@/lib/api'
import { SUBJECTS } from '@/constants'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import PaylovSandboxPanel from './PaylovSandboxPanel'
import '../../styles/operations-workspace.css'

interface TimeSpentUser {
    id: string
    name: string
    email: string
    role: 'STUDENT' | 'TEACHER' | 'ADMIN'
    createdAt: string
    totalMinutes: number
    todayMinutes: number
    weekMinutes: number
    totalHours: number
    lastSeen: string | null
    isOnline: boolean
    onlineLastSeen: number | null
}

// Faol foydalanuvchilar metrikalari — kontrakt bo'yicha /stats yoki /admin/active-users
interface ActiveUsersMetrics {
    dau: number
    wau: number
    mau: number
}

// Stats yoki active-users javobidan dau/wau/mau ni xavfsiz ajratib oladi.
// Backend hali bermasa null qaytaradi (UI kartalarni ko'rsatmaydi — crash bo'lmaydi).
function pickActiveUsers(source: unknown): ActiveUsersMetrics | null {
    if (!source || typeof source !== 'object') return null
    const obj = source as Record<string, unknown>
    const dau = obj.dau
    const wau = obj.wau
    const mau = obj.mau
    if (typeof dau === 'number' && typeof wau === 'number' && typeof mau === 'number') {
        return { dau, wau, mau }
    }
    return null
}

interface DeleteConfirmInfo {
    requiresConfirmation?: boolean
    testsCount?: number
    notificationsCount?: number
    studentsCount?: number
    [key: string]: unknown
}

// ── Branded confirm modal ──────────────────────────────────────────────
type ConfirmRole = 'STUDENT' | 'TEACHER' | 'ADMIN'

interface ConfirmOptions {
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
}

interface ConfirmState extends ConfirmOptions {
    open: boolean
    resolve: ((value: boolean) => void) | null
    busy: boolean
}

// Promise-asoslangan branded confirm — window.confirm() o'rnini bosadi.
function useConfirm() {
    const [state, setState] = useState<ConfirmState>({
        open: false, title: '', message: '', resolve: null, busy: false,
    })

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise<boolean>(resolve => {
            setState({ ...options, open: true, resolve, busy: false })
        })
    }, [])

    const handleClose = useCallback((result: boolean) => {
        setState(prev => {
            prev.resolve?.(result)
            return { ...prev, open: false, resolve: null, busy: false }
        })
    }, [])

    return { state, confirm, handleClose }
}

function ConfirmModal({ state, onClose }: { state: ConfirmState; onClose: (result: boolean) => void }) {
    // Escape bilan bekor qilish
    useEffect(() => {
        if (!state.open) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(false) }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [state.open, onClose])

    if (!state.open) return null
    const accent = state.danger ? 'var(--danger)' : 'var(--brand)'
    const accentLight = state.danger ? 'var(--danger-light)' : 'var(--brand-light)'

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="absolute inset-0 k-fade-in" style={{ background: 'rgba(10,10,16,0.45)', backdropFilter: 'blur(2px)' }}
                onClick={() => onClose(false)} />
            <div className="relative w-full max-w-sm rounded-2xl p-5 k-fade-in"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 20px 50px rgba(10,10,16,0.25)' }}>
                <div className="flex items-start gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: accentLight, color: accent }}>
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                        <h3 className="text-[15px] font-bold leading-snug">{state.title}</h3>
                    </div>
                </div>
                <p className="text-[13px] leading-relaxed mb-5 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                    {state.message}
                </p>
                <div className="flex items-center justify-end gap-2">
                    <button onClick={() => onClose(false)}
                        className="h-9 px-4 rounded-xl text-[13px] font-semibold transition"
                        style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                        {state.cancelLabel || 'Bekor qilish'}
                    </button>
                    <button onClick={() => onClose(true)} autoFocus
                        className="h-9 px-4 rounded-xl text-[13px] font-semibold text-white transition"
                        style={{ background: accent }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '0.9' }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
                        {state.confirmLabel || 'Tasdiqlash'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Moderatsiya (kutilayotgan testlar) tiplari ─────────────────────────
interface PendingTestCreator {
    id?: string
    name?: string | null
    email?: string | null
    role?: ConfirmRole
}
interface PendingTest {
    id: string
    title: string
    subject?: string | null
    testType?: string | null
    createdAt: string
    creator?: PendingTestCreator | null
    _count?: { questions?: number } | null
}

// ── User detail (drawer) tiplari ───────────────────────────────────────
type UserStatus = 'ACTIVE' | 'SUSPENDED'

interface UserDetailUser {
    id: string
    name: string
    email: string
    role: ConfirmRole
    createdAt: string
    emailVerified?: boolean
    status?: UserStatus
}

// ── Audit log (admin amallari tarixi) tiplari ──────────────────────────
interface AuditActor {
    id?: string
    name?: string | null
    email?: string | null
    role?: ConfirmRole
}
interface AuditLogRow {
    id: string
    actorId: string
    actorEmail?: string | null
    action: string
    targetType: string
    targetId?: string | null
    meta?: string | null
    createdAt: string
    actor?: AuditActor | null
}
interface UserDetailProfile {
    examType?: 'DTM' | 'MS' | null
    subject?: string | null
    subject2?: string | null
    examDate?: string | null
    targetScore?: number | null
    abilityLevel?: number | null
    weakTopics?: string[] | null
    strongTopics?: string[] | null
}
interface UserDetailProgress {
    xp?: number
    streak?: number
    totalTests?: number
    avgScore?: number
}
interface UserDetailAttempt {
    testTitle?: string
    score?: number
    scoreMax?: number
    createdAt?: string
}
interface UserDetailTopicStat {
    topic?: string
    correct?: number
    total?: number
}
interface UserDetail {
    user: UserDetailUser
    profile?: UserDetailProfile | null
    progress?: UserDetailProgress | null
    recentAttempts?: UserDetailAttempt[]
    topicStats?: UserDetailTopicStat[]
}

const ROLE_OPTIONS: ConfirmRole[] = ['STUDENT', 'TEACHER', 'ADMIN']
const ROLE_LABELS: Record<ConfirmRole, string> = { STUDENT: "O'quvchi", TEACHER: "O'qituvchi", ADMIN: 'Admin' }

// Audit amallarining o'zbekcha ko'rinishi — har biriga matn + rang ohangi
const AUDIT_ACTIONS: Record<string, { label: string; tone: string }> = {
    'USER_DELETE': { label: 'Foydalanuvchi o‘chirildi', tone: 'var(--danger)' },
    'USER_ROLE_CHANGE': { label: 'Rol o‘zgartirildi', tone: 'var(--info)' },
    'USER_SUSPEND': { label: 'Bloklandi', tone: 'var(--danger)' },
    'USER_ACTIVATE': { label: 'Blokdan chiqarildi', tone: 'var(--success)' },
    'TEACHER_CREATE': { label: 'O‘qituvchi yaratildi', tone: 'var(--success)' },
    'USER_RESET_PASSWORD': { label: 'Parol tiklandi', tone: 'var(--brand)' },
    'USER_RESEND_VERIFICATION': { label: 'Tasdiq qayta yuborildi', tone: 'var(--brand)' },
    'TEST_DELETE': { label: 'Test o‘chirildi', tone: 'var(--danger)' },
}
const AUDIT_TARGET_LABELS: Record<string, string> = {
    USER: 'Foydalanuvchi',
    TEST: 'Test',
    TEACHER: 'O‘qituvchi',
}
function auditActionInfo(action: string): { label: string; tone: string } {
    return AUDIT_ACTIONS[action] || { label: action, tone: 'var(--text-muted)' }
}

// Imtihon sanasiga qolgan kun (manfiy bo'lsa o'tib ketgan)
function daysUntil(dateStr?: string | null): number | null {
    if (!dateStr) return null
    const target = new Date(dateStr)
    if (Number.isNaN(target.getTime())) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    target.setHours(0, 0, 0, 0)
    return Math.round((target.getTime() - today.getTime()) / 86400000)
}

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
    const { logout, user: currentUser } = useAuthStore()
    const pageRef = useRef<HTMLDivElement | null>(null)
    // Tablar uchun ref'lar (klaviatura navigatsiyasi — fokusni ko'chirish)
    const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

    // Branded confirm modal
    const { state: confirmState, confirm, handleClose: closeConfirm } = useConfirm()

    // User detail drawer
    const [detailUserId, setDetailUserId] = useState<string | null>(null)
    const [detail, setDetail] = useState<UserDetail | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [detailError, setDetailError] = useState('')
    // Drawer ichidagi rol/ism tahrirlash
    const [editRole, setEditRole] = useState<ConfirmRole>('STUDENT')
    const [editName, setEditName] = useState('')
    const [editNameDirty, setEditNameDirty] = useState(false)
    const [savingUser, setSavingUser] = useState(false)
    const [tab, setTab] = useState<'stats' | 'presence' | 'users' | 'teachers' | 'docs' | 'tests' | 'ai' | 'knowledge' | 'activity' | 'audit' | 'moderation' | 'broadcast' | 'billing'>('stats')
    const [stats, setStats] = useState<any>(null)
    const [statsError, setStatsError] = useState('')
    // Kunlik AI sarfi (bepul limitlar hisobi) — xarajat ko'zgusi
    const [aiUsage, setAiUsage] = useState<{ limits: { chat: number; vision: number }; today: { users: number; chat: number; vision: number; atChatLimit: number; atVisionLimit: number }; days: Array<{ day: string; users: number; chat: number; vision: number }> } | null>(null)
    // Faol foydalanuvchilar: DAU / WAU / MAU (kontrakt: /stats yoki /admin/active-users)
    const [activeUsers, setActiveUsers] = useState<ActiveUsersMetrics | null>(null)
    const [users, setUsers] = useState<any[]>([])
    const [docs, setDocs] = useState<any[]>([])
    const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null)
    const [backfillingDocs, setBackfillingDocs] = useState(false)
    const [tests, setTests] = useState<any[]>([])
    const [testsLoading, setTestsLoading] = useState(false)
    const [tf, setTf] = useState({ name: '', email: '', password: '' })

    // Broadcast (Xabarnoma)
    const [bcTitle, setBcTitle] = useState('')
    const [bcMessage, setBcMessage] = useState('')
    const [bcTarget, setBcTarget] = useState<'all' | 'specific'>('all')
    const [bcEmails, setBcEmails] = useState('')
    const [bcSending, setBcSending] = useState(false)
    const [bcResult, setBcResult] = useState<{ ok: boolean; text: string } | null>(null)

    // Users list — CSV export + row action menu + per-row busy state
    const [exportingUsers, setExportingUsers] = useState(false)
    const [openUserMenu, setOpenUserMenu] = useState<string | null>(null)
    const [userActionBusy, setUserActionBusy] = useState<string | null>(null)
    // Bloklash/blokdan chiqarish davom etayotgan user (drawer tugmasi uchun alohida)
    const [statusBusy, setStatusBusy] = useState<string | null>(null)
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
    // AI prompt: standartga qaytarish (reset) holati + inline validatsiya xatosi
    const [aiResetting, setAiResetting] = useState(false)
    const [aiError, setAiError] = useState('')
    const [loading, setLoading] = useState(true)
    // Period trend (login+register combined)
    const [chartPeriod, setChartPeriod] = useState<7 | 30>(30)
    const [periodTrend, setPeriodTrend] = useState<any[]>([])
    // Test stats
    const [testStats, setTestStats] = useState<any>(null)
    // Tests tab
    const [testsSearch, setTestsSearch] = useState('')
    const [debouncedTestsSearch, setDebouncedTestsSearch] = useState('')
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
    const [knowledgeSearch, setKnowledgeSearch] = useState('')
    const KNOWLEDGE_PER_PAGE = 20
    const [knowledgeVisible, setKnowledgeVisible] = useState(KNOWLEDGE_PER_PAGE)

    // Online users
    const [onlineUsers, setOnlineUsers] = useState<any[]>([])
    const onlineTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const [timeSpentUsers, setTimeSpentUsers] = useState<TimeSpentUser[]>([])
    const [trackedUsers, setTrackedUsers] = useState(0)
    const [presenceIntervalMinutes, setPresenceIntervalMinutes] = useState(5)
    const [timeSpentLoading, setTimeSpentLoading] = useState(false)
    const [timeSpentError, setTimeSpentError] = useState('')
    const [timeSpentSearch, setTimeSpentSearch] = useState('')
    const [timeSpentSort, setTimeSpentSort] = useState<'today' | 'week' | 'total'>('today')
    const PRESENCE_PER_PAGE = 25
    const [presenceVisible, setPresenceVisible] = useState(PRESENCE_PER_PAGE)

    // Activity log
    const [activityLogs, setActivityLogs] = useState<any[]>([])
    const [activityTotal, setActivityTotal] = useState(0)
    const [activityPages, setActivityPages] = useState(1)
    const [activityPage, setActivityPage] = useState(1)
    const [activityFilter, setActivityFilter] = useState('all')
    const [activityLoading, setActivityLoading] = useState(false)
    const activityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Audit log (admin amallari) — paginatsiya
    const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([])
    const [auditTotal, setAuditTotal] = useState(0)
    const [auditPages, setAuditPages] = useState(1)
    const [auditPage, setAuditPage] = useState(1)
    const [auditLoading, setAuditLoading] = useState(false)
    const [auditError, setAuditError] = useState('')

    // Moderatsiya — kutilayotgan (tasdiqlanmagan) testlar
    const [pendingTests, setPendingTests] = useState<PendingTest[]>([])
    const [pendingCount, setPendingCount] = useState(0)
    const [pendingLoading, setPendingLoading] = useState(false)
    const [pendingError, setPendingError] = useState('')
    const [moderationBusy, setModerationBusy] = useState<string | null>(null)

    const KNOWLEDGE_SUBJECTS = SUBJECTS

    // Users pagination
    const [usersPage, setUsersPage] = useState(1)
    const [usersTotal, setUsersTotal] = useState(0)
    const [usersPages, setUsersPages] = useState(1)
    const [usersSearch, setUsersSearch] = useState('')
    const [debouncedUsersSearch, setDebouncedUsersSearch] = useState('')
    const [usersLoading, setUsersLoading] = useState(false)
    const USERS_PER_PAGE = 50

    // Teachers tab
    const [teachers, setTeachers] = useState<any[]>([])
    const [teachersLoading, setTeachersLoading] = useState(false)
    const [teacherSearch, setTeacherSearch] = useState('')
    const [deletingTeacher, setDeletingTeacher] = useState<string | null>(null)

    useEffect(() => {
        loadStats()
        loadPeriodTrend(30)
        // Tab badge uchun kutilayotgan testlar sonini darhol yuklaymiz
        loadPending()
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
    useEffect(() => {
        const id = setTimeout(() => setDebouncedUsersSearch(usersSearch.trim()), 300)
        return () => clearTimeout(id)
    }, [usersSearch])
    useEffect(() => {
        const id = setTimeout(() => setDebouncedTestsSearch(testsSearch.trim()), 300)
        return () => clearTimeout(id)
    }, [testsSearch])
    useEffect(() => { if (tab === 'users') loadUsers() }, [tab, usersPage, debouncedUsersSearch])
    useEffect(() => { if (tab === 'tests') loadTests() }, [tab, testsPage, debouncedTestsSearch, testsVisibility, testsSubject, testsSortBy])
    useEffect(() => { if (tab === 'knowledge') loadKnowledge() }, [tab])
    // Presence ro'yxati filtr/saralash o'zgarganda load-more hisoblagichini qayta tiklaymiz
    useEffect(() => { setPresenceVisible(PRESENCE_PER_PAGE) }, [timeSpentSearch, timeSpentSort, tab])
    // Knowledge ro'yxati filtr/qidiruv o'zgarganda load-more hisoblagichini qayta tiklaymiz
    useEffect(() => { setKnowledgeVisible(KNOWLEDGE_PER_PAGE) }, [knowledgeFilter, knowledgeSearch, tab])
    useEffect(() => { if (tab === 'teachers') loadTeachers() }, [tab])
    useEffect(() => { if (tab === 'presence') loadTimeSpent() }, [tab])
    useEffect(() => {
        if (tab === 'activity') {
            loadActivity()
            activityTimerRef.current = setInterval(loadActivity, 30000)
        } else {
            if (activityTimerRef.current) {
                clearInterval(activityTimerRef.current)
                activityTimerRef.current = null
            }
        }
        return () => {
            if (activityTimerRef.current) {
                clearInterval(activityTimerRef.current)
                activityTimerRef.current = null
            }
        }
    }, [tab, activityPage, activityFilter])
    useEffect(() => { if (tab === 'audit') loadAudit() }, [tab, auditPage])
    useEffect(() => { if (tab === 'moderation') loadPending() }, [tab])

    async function loadStats() {
        setLoading(true)
        setTimeSpentLoading(true)
        const [statsRes, timeSpentRes, docsRes, aiRes, defaultsRes, testStatsRes, aiUsageRes] = await Promise.allSettled([
            fetchApi('/analytics/stats'),
            fetchApi('/analytics/time-spent'),
            fetchApi('/documents/list'),
            fetchApi('/ai-settings'),
            fetchApi('/ai-settings/defaults'),
            fetchApi('/analytics/test-stats'),
            fetchApi('/admin/ai-usage'),
        ])

        if (statsRes.status === 'fulfilled') { setStats(statsRes.value); setStatsError('') }
        else { setStats(null); setStatsError('Statistikani yuklab boʻlmadi') }
        if (aiUsageRes.status === 'fulfilled') setAiUsage(aiUsageRes.value)

        // DAU/WAU/MAU — avval /stats javobidan, bo'lmasa /admin/active-users dan
        const fromStats = statsRes.status === 'fulfilled' ? pickActiveUsers(statsRes.value) : null
        if (fromStats) {
            setActiveUsers(fromStats)
        } else {
            try {
                const au = await fetchApi('/admin/active-users', { silent: true })
                setActiveUsers(pickActiveUsers(au))
            } catch {
                setActiveUsers(null)
            }
        }

        if (timeSpentRes.status === 'fulfilled') {
            applyTimeSpentPayload(timeSpentRes.value)
            setTimeSpentError('')
        } else {
            setTimeSpentError('Online vaqt maʼlumotini yuklab bo‘lmadi')
        }
        setTimeSpentLoading(false)

        if (docsRes.status === 'fulfilled') setDocs(docsRes.value)
        else setDocs([])

        if (aiRes.status === 'fulfilled') setAiConfig(aiRes.value)
        if (defaultsRes.status === 'fulfilled') setDefaults(defaultsRes.value)
        if (testStatsRes.status === 'fulfilled') setTestStats(testStatsRes.value)
        else setTestStats(null)
        setLoading(false)
    }

    function applyTimeSpentPayload(payload: {
        users?: TimeSpentUser[]
        trackedUsers?: number
        intervalMinutes?: number
    }) {
        setTimeSpentUsers(payload.users || [])
        setTrackedUsers(payload.trackedUsers || 0)
        setPresenceIntervalMinutes(payload.intervalMinutes || 5)
    }

    async function loadTimeSpent() {
        setTimeSpentLoading(true)
        try {
            const data = await fetchApi('/analytics/time-spent')
            applyTimeSpentPayload(data)
            setTimeSpentError('')
        } catch {
            setTimeSpentError('Online vaqt maʼlumotini yangilab bo‘lmadi')
        } finally {
            setTimeSpentLoading(false)
        }
    }

    async function loadPeriodTrend(days: number) {
        try { setPeriodTrend(await fetchApi(`/analytics/period-trend?days=${days}`)) } catch { setPeriodTrend([]) }
    }

    async function loadTests() {
        setTestsLoading(true)
        try {
            const params = new URLSearchParams({ page: String(testsPage), sortBy: testsSortBy })
            if (debouncedTestsSearch) params.set('search', debouncedTestsSearch)
            if (testsVisibility !== 'all') params.set('visibility', testsVisibility)
            if (testsSubject) params.set('subject', testsSubject)
            const data = await fetchApi(`/tests/all?${params}`)
            setTests(data.tests || [])
            setTestsTotal(data.total || 0)
            setTestsPages(data.pages || 1)
            setTestsSummary(data.summary || null)
        } catch { setTests([]) }
        finally { setTestsLoading(false) }
    }

    async function loadUsers() {
        setUsersLoading(true)
        try {
            const params = new URLSearchParams({ page: String(usersPage), limit: String(USERS_PER_PAGE) })
            if (debouncedUsersSearch) params.set('search', debouncedUsersSearch)
            const data = await fetchApi(`/auth/users?${params}`)
            setUsers(data.users || [])
            setUsersTotal(data.total || 0)
            setUsersPages(data.pages || 1)
        } catch { setUsers([]) }
        finally { setUsersLoading(false) }
    }

    // 409 collateral matnini tuzadi (TEACHER o'chirilganda bog'liq ma'lumotlar)
    function collateralText(info: DeleteConfirmInfo): string {
        const parts: string[] = []
        if (typeof info.testsCount === 'number' && info.testsCount > 0) parts.push(`${info.testsCount} ta test`)
        if (typeof info.studentsCount === 'number' && info.studentsCount > 0) parts.push(`${info.studentsCount} ta o'quvchi bog'lanishi`)
        if (typeof info.notificationsCount === 'number' && info.notificationsCount > 0) parts.push(`${info.notificationsCount} ta bildirishnoma`)
        return parts.length ? parts.join(', ') : 'unga bog\'liq barcha ma\'lumotlar'
    }

    // DELETE — 409 requiresConfirmation bo'lsa collateral ko'rsatib, ?force=true bilan qayta urinadi
    async function deleteUserWithForce(userId: string): Promise<boolean> {
        try {
            await fetchApi(`/auth/users/${userId}`, { method: 'DELETE', silent: true })
            return true
        } catch (e: any) {
            if (e?.status === 409 && e?.data?.requiresConfirmation) {
                const info = e.data as DeleteConfirmInfo
                const ok = await confirm({
                    title: 'Bog\'liq ma\'lumotlar ham o\'chadi',
                    message: `Diqqat! Bu foydalanuvchi bilan birga ${collateralText(info)} ham o'chiriladi.\n\nDavom etamizmi? Bu amalni qaytarib bo'lmaydi.`,
                    confirmLabel: 'Ha, o\'chirish',
                    danger: true,
                })
                if (!ok) return false
                await fetchApi(`/auth/users/${userId}?force=true`, { method: 'DELETE' })
                return true
            }
            // Boshqa xato — foydalanuvchiga ko'rsatamiz (silent bo'lgani uchun bu yerda toast)
            toast.error(e?.message || 'O\'chirishda xatolik')
            throw e
        }
    }

    async function deleteUser(userId: string, userName: string) {
        const ok = await confirm({
            title: 'Foydalanuvchini o\'chirish',
            message: `"${userName}" foydalanuvchisini o'chirishni tasdiqlaysizmi? Bu amalni qaytarib bo'lmaydi.`,
            confirmLabel: 'O\'chirish',
            danger: true,
        })
        if (!ok) return
        try {
            const done = await deleteUserWithForce(userId)
            if (done) {
                toast.success(`${userName} o'chirildi`)
                loadUsers()
            }
        } catch { /* xato deleteUserWithForce ichida ko'rsatildi */ }
    }

    async function resetUserPassword(userId: string, userName: string) {
        setOpenUserMenu(null)
        const ok = await confirm({
            title: 'Parolni tiklash',
            message: `"${userName}" uchun parolni tiklash havolasi emailga yuborilsinmi?`,
            confirmLabel: 'Yuborish',
        })
        if (!ok) return
        setUserActionBusy(userId)
        try {
            await fetchApi(`/auth/users/${userId}/reset-password`, { method: 'POST' })
            toast.success('Parolni tiklash havolasi emailga yuborildi')
        } catch (e: any) {
            toast.error(e?.message || 'Parolni tiklashda xatolik')
        } finally {
            setUserActionBusy(null)
        }
    }

    async function resendVerification(userId: string, userName: string) {
        setOpenUserMenu(null)
        setUserActionBusy(userId)
        try {
            await fetchApi(`/auth/users/${userId}/resend-verification`, { method: 'POST' })
            toast.success(`${userName} uchun tasdiqlash xati qayta yuborildi`)
        } catch (e: any) {
            toast.error(e?.message || 'Tasdiqlash xatini yuborishda xatolik')
        } finally {
            setUserActionBusy(null)
        }
    }

    async function exportUsersCsv() {
        setExportingUsers(true)
        try {
            const token = localStorage.getItem('token')
            const params = new URLSearchParams()
            if (debouncedUsersSearch) params.set('search', debouncedUsersSearch)
            const qs = params.toString()
            const res = await fetch(`/api/admin/export/users${qs ? `?${qs}` : ''}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            })
            if (!res.ok) throw new Error('CSV eksport qilishda xatolik')
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `dtmmax-users-${new Date().toISOString().slice(0, 10)}.csv`
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
            toast.success('CSV yuklab olindi')
        } catch (e: any) {
            toast.error(e?.message || 'CSV eksport qilishda xatolik')
        } finally {
            setExportingUsers(false)
        }
    }

    // Email(lar)ni userId(lar)ga aylantiradi — /notifications/send userIds kutadi
    async function resolveEmailsToIds(emails: string[]): Promise<{ ids: string[]; notFound: string[] }> {
        const ids: string[] = []
        const notFound: string[] = []
        for (const email of emails) {
            try {
                const params = new URLSearchParams({ search: email, limit: '10' })
                const data = await fetchApi(`/auth/users?${params}`, { silent: true })
                const match = (data.users || []).find(
                    (u: { id: string; email: string }) => u.email?.toLowerCase() === email.toLowerCase()
                )
                if (match) ids.push(match.id)
                else notFound.push(email)
            } catch {
                notFound.push(email)
            }
        }
        return { ids, notFound }
    }

    async function sendBroadcast(e: React.FormEvent) {
        e.preventDefault()
        if (bcSending) return
        setBcResult(null)
        if (!bcTitle.trim() || !bcMessage.trim()) {
            setBcResult({ ok: false, text: 'Sarlavha va matn kerak' })
            return
        }
        setBcSending(true)
        try {
            if (bcTarget === 'all') {
                const data = await fetchApi('/notifications/send', {
                    method: 'POST',
                    body: JSON.stringify({ title: bcTitle.trim(), message: bcMessage.trim(), broadcastAll: true }),
                })
                setBcResult({ ok: true, text: `Xabar ${data.sent ?? 0} ta foydalanuvchiga yuborildi` })
                setBcTitle(''); setBcMessage('')
            } else {
                const emails = bcEmails
                    .split(/[\s,;]+/)
                    .map(s => s.trim())
                    .filter(Boolean)
                if (emails.length === 0) {
                    setBcResult({ ok: false, text: 'Kamida bitta email kiriting' })
                    setBcSending(false)
                    return
                }
                const { ids, notFound } = await resolveEmailsToIds(emails)
                if (ids.length === 0) {
                    setBcResult({ ok: false, text: 'Hech qaysi email topilmadi' })
                    setBcSending(false)
                    return
                }
                const data = await fetchApi('/notifications/send', {
                    method: 'POST',
                    body: JSON.stringify({ title: bcTitle.trim(), message: bcMessage.trim(), userIds: ids }),
                })
                const sent = data.sent ?? ids.length
                const warn = notFound.length ? ` (${notFound.length} ta email topilmadi: ${notFound.join(', ')})` : ''
                setBcResult({ ok: true, text: `Xabar ${sent} ta foydalanuvchiga yuborildi${warn}` })
                setBcTitle(''); setBcMessage(''); setBcEmails('')
            }
        } catch (err: any) {
            setBcResult({ ok: false, text: err?.message || 'Xabar yuborishda xatolik' })
        } finally {
            setBcSending(false)
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

    // GET /admin/audit — admin amallari tarixi (yangi → eski)
    async function loadAudit() {
        setAuditLoading(true)
        try {
            const params = new URLSearchParams({ page: String(auditPage) })
            const data = await fetchApi(`/admin/audit?${params}`, { silent: true })
            setAuditLogs(Array.isArray(data.logs) ? data.logs : [])
            setAuditTotal(data.total || 0)
            setAuditPages(data.pages || 1)
            setAuditError('')
        } catch (e: any) {
            setAuditLogs([])
            setAuditError(e?.message || 'Audit jurnalini yuklab boʻlmadi')
        } finally {
            setAuditLoading(false)
        }
    }

    // GET /admin/tests/pending — kutilayotgan (tasdiqlanmagan) testlar ro'yxati
    async function loadPending() {
        setPendingLoading(true)
        try {
            const data = await fetchApi('/admin/tests/pending', { silent: true })
            const list: PendingTest[] = Array.isArray(data) ? data : (data.tests || [])
            setPendingTests(list)
            setPendingCount(typeof data.total === 'number' ? data.total : list.length)
            setPendingError('')
        } catch (e: any) {
            setPendingTests([])
            setPendingError(e?.message || 'Kutilayotgan testlarni yuklab boʻlmadi')
        } finally {
            setPendingLoading(false)
        }
    }

    // POST /admin/tests/:id/approve — testni tasdiqlash (ommaga ochiladi)
    async function approveTest(test: PendingTest) {
        const ok = await confirm({
            title: 'Testni tasdiqlash',
            message: `"${test.title}" testini tasdiqlaysizmi? Tasdiqlangach barcha o'quvchilarga ochiladi.`,
            confirmLabel: 'Tasdiqlash',
        })
        if (!ok) return
        setModerationBusy(test.id)
        try {
            await fetchApi(`/admin/tests/${test.id}/approve`, { method: 'POST' })
            toast.success(`"${test.title}" tasdiqlandi`)
            // Ro'yxatdan darhol olib tashlaymiz va badge'ni yangilaymiz
            setPendingTests(prev => prev.filter(t => t.id !== test.id))
            setPendingCount(prev => Math.max(0, prev - 1))
        } catch (e: any) {
            toast.error(e?.message || 'Tasdiqlashda xatolik')
        } finally {
            setModerationBusy(null)
        }
    }

    // POST /admin/tests/:id/reject — testni rad etish (yopiq qoladi)
    async function rejectTest(test: PendingTest) {
        const ok = await confirm({
            title: 'Testni rad etish',
            message: `"${test.title}" testini rad etasizmi? Test yopiq qoladi va muallifga xabar beriladi.`,
            confirmLabel: 'Rad etish',
            danger: true,
        })
        if (!ok) return
        setModerationBusy(test.id)
        try {
            await fetchApi(`/admin/tests/${test.id}/reject`, { method: 'POST' })
            toast.success(`"${test.title}" rad etildi`)
            setPendingTests(prev => prev.filter(t => t.id !== test.id))
            setPendingCount(prev => Math.max(0, prev - 1))
        } catch (e: any) {
            toast.error(e?.message || 'Rad etishda xatolik')
        } finally {
            setModerationBusy(null)
        }
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
        const ok = await confirm({
            title: 'O\'qituvchini o\'chirish',
            message: 'O\'qituvchini o\'chirishni tasdiqlaysizmi? Bu amal qaytarib bo\'lmaydi.',
            confirmLabel: 'O\'chirish',
            danger: true,
        })
        if (!ok) return
        setDeletingTeacher(userId)
        try {
            const done = await deleteUserWithForce(userId)
            if (done) {
                toast.success('O\'qituvchi o\'chirildi')
                loadTeachers()
                loadStats()
            }
        } catch { /* xato deleteUserWithForce ichida ko'rsatildi */ }
        finally { setDeletingTeacher(null) }
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
        const ok = await confirm({
            title: 'Ma\'lumotni o\'chirish',
            message: "Bu bilim bazasi yozuvini o'chirishni tasdiqlaysizmi?",
            confirmLabel: 'O\'chirish',
            danger: true,
        })
        if (!ok) return
        try {
            await fetchApi('/knowledge/' + id, { method: 'DELETE' })
            setKnowledgeItems(prev => prev.filter(i => i.id !== id))
            toast.success("O'chirildi")
        } catch (e: any) { toast.error(e.message) }
    }

    async function deleteDoc(id: string) {
        const ok = await confirm({
            title: 'Hujjatni o\'chirish',
            message: 'Hujjatni o\'chirmoqchimisiz? RAG indeksidan ham o\'chiriladi.',
            confirmLabel: 'O\'chirish',
            danger: true,
        })
        if (!ok) return
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
        const ok = await confirm({
            title: 'Testni o\'chirish',
            message: 'Testni o\'chirmoqchimisiz? Bu amalni qaytarib bo\'lmaydi.',
            confirmLabel: 'O\'chirish',
            danger: true,
        })
        if (!ok) return
        try { await fetchApi(`/tests/${id}`, { method: 'DELETE' }); toast.success('Test o\'chirildi'); loadTests() } catch { toast.error('Xatolik') }
    }

    // ── User detail drawer ─────────────────────────────────────────────
    async function openUserDetail(userId: string) {
        setOpenUserMenu(null)
        setDetailUserId(userId)
        setDetail(null)
        setDetailError('')
        setEditNameDirty(false)
        setDetailLoading(true)
        try {
            const data: UserDetail = await fetchApi(`/admin/users/${userId}`, { silent: true })
            setDetail(data)
            setEditRole(data.user.role)
            setEditName(data.user.name || '')
        } catch (e: any) {
            setDetailError(e?.message || 'Foydalanuvchi maʼlumotini yuklab boʻlmadi')
        } finally {
            setDetailLoading(false)
        }
    }

    function closeUserDetail() {
        setDetailUserId(null)
        setDetail(null)
        setDetailError('')
        setEditNameDirty(false)
    }

    // PATCH /auth/users/:id — rol va/yoki ism yangilash
    async function saveUserChanges() {
        if (!detail) return
        const target = detail.user
        const isSelf = currentUser?.id === target.id
        const trimmedName = editName.trim()
        const roleChanged = editRole !== target.role && !isSelf
        const nameChanged = editNameDirty && trimmedName !== target.name

        if (!roleChanged && !nameChanged) {
            toast('Hech narsa oʻzgartirilmadi', { icon: 'ℹ️' })
            return
        }
        if (nameChanged && !trimmedName) {
            toast.error('Ism boʻsh boʻlishi mumkin emas')
            return
        }
        // Rol o'zgarishi uchun branded confirm
        if (roleChanged) {
            const ok = await confirm({
                title: 'Rolni oʻzgartirish',
                message: `"${target.name}" foydalanuvchisi roli ${ROLE_LABELS[target.role]} → ${ROLE_LABELS[editRole]} ga oʻzgartiriladi.\n\nTasdiqlaysizmi?`,
                confirmLabel: 'Oʻzgartirish',
                danger: editRole === 'ADMIN',
            })
            if (!ok) return
        }

        const body: { role?: ConfirmRole; name?: string } = {}
        if (roleChanged) body.role = editRole
        if (nameChanged) body.name = trimmedName

        setSavingUser(true)
        try {
            const updated: UserDetailUser = await fetchApi(`/auth/users/${target.id}`, {
                method: 'PATCH',
                body: JSON.stringify(body),
            })
            toast.success('Foydalanuvchi yangilandi')
            // Drawer va ro'yxatlarni yangilaymiz
            setDetail(prev => prev ? { ...prev, user: { ...prev.user, ...updated } } : prev)
            setEditRole(updated.role)
            setEditName(updated.name || '')
            setEditNameDirty(false)
            setUsers(prev => prev.map(u => u.id === target.id ? { ...u, role: updated.role, name: updated.name } : u))
            if (tab === 'users') loadUsers()
            if (tab === 'teachers') loadTeachers()
        } catch (e: any) {
            toast.error(e?.message || 'Yangilashda xatolik')
        } finally {
            setSavingUser(false)
        }
    }

    // PATCH /auth/users/:id { status } — bloklash / blokdan chiqarish.
    // Backenddagi guard: admin o'zini bloklay olmaydi. Frontda ham oldini olamiz.
    async function toggleUserStatus(userId: string, userName: string, current: UserStatus) {
        setOpenUserMenu(null)
        if (currentUser?.id === userId) {
            toast.error('Oʻzingizni bloklay olmaysiz')
            return
        }
        const next: UserStatus = current === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED'
        const suspending = next === 'SUSPENDED'
        const ok = await confirm({
            title: suspending ? 'Foydalanuvchini bloklash' : 'Blokdan chiqarish',
            message: suspending
                ? `"${userName}" bloklanadi — u tizimga kira olmaydi.\n\nTasdiqlaysizmi?`
                : `"${userName}" blokdan chiqariladi va yana tizimga kira oladi.\n\nTasdiqlaysizmi?`,
            confirmLabel: suspending ? 'Bloklash' : 'Blokdan chiqarish',
            danger: suspending,
        })
        if (!ok) return
        setStatusBusy(userId)
        try {
            await fetchApi(`/auth/users/${userId}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: next }),
                silent: true,
            })
            toast.success(suspending ? `${userName} bloklandi` : `${userName} blokdan chiqarildi`)
            // Drawer va ro'yxat holatini darhol yangilaymiz (server javob shaklidan mustaqil)
            setDetail(prev => prev && prev.user.id === userId ? { ...prev, user: { ...prev.user, status: next } } : prev)
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: next } : u))
            if (tab === 'users') loadUsers()
        } catch (e: any) {
            toast.error(e?.message || (suspending ? 'Bloklashda xatolik' : 'Blokdan chiqarishda xatolik'))
        } finally {
            setStatusBusy(null)
        }
    }

    // AI sozlamalarini saqlash — backend validatsiya xatosini (bo'sh / juda uzun) inline ko'rsatadi
    async function saveAiSettings() {
        setAiSaving(true); setAiMsg(''); setAiError('')
        try {
            await fetchApi('/ai-settings', { method: 'PUT', body: JSON.stringify(aiConfig), silent: true })
            setAiMsg('✓ Sozlamalar saqlandi!')
        } catch (e: any) {
            // 400 — validatsiya (bo'sh yoki juda uzun matn): inline xato sifatida ko'rsatamiz
            const data = e?.data as { error?: string } | undefined
            setAiError(data?.error || e?.message || 'Sozlamalarni saqlashda xatolik')
        } finally {
            setAiSaving(false)
        }
    }

    // Joriy prompt bo'limini standart matnga qaytaradi (backend reset, branded confirm bilan)
    async function resetAiPromptSection(sectionKey: string, sectionLabel: string) {
        const ok = await confirm({
            title: 'Standartga qaytarish',
            message: `"${sectionLabel}" boʻlimi standart (kodga kiritilgan) matnga qaytariladi. Sizning oʻzgartirishlaringiz oʻchadi.\n\nDavom etamizmi?`,
            confirmLabel: 'Qaytarish',
            danger: true,
        })
        if (!ok) return
        setAiResetting(true); setAiMsg(''); setAiError('')
        try {
            const updated = await fetchApi('/ai-settings/reset', {
                method: 'POST',
                body: JSON.stringify({ section: sectionKey }),
                silent: true,
            })
            // Backend yangilangan sozlamalarni qaytarsa — to'g'ridan-to'g'ri ishlatamiz.
            // Aks holda joriy bo'limni bo'shatamiz (bo'sh = standart kod ishlatiladi).
            if (updated && typeof updated === 'object' && typeof (updated as Record<string, unknown>)[sectionKey] === 'string') {
                setAiConfig(prev => ({ ...prev, ...(updated as Partial<typeof prev>) }))
            } else {
                setAiConfig(prev => ({ ...prev, [sectionKey]: '' }) as typeof prev)
            }
            setShowDefault(false)
            setAiMsg('✓ Standartga qaytarildi!')
        } catch (e: any) {
            const data = e?.data as { error?: string } | undefined
            setAiError(data?.error || e?.message || 'Standartga qaytarishda xatolik')
        } finally {
            setAiResetting(false)
        }
    }

    const tabs = [
        { k: 'stats' as const, l: 'Statistika', icon: BarChart3 },
        { k: 'presence' as const, l: 'Online vaqt', icon: Clock3 },
        { k: 'activity' as const, l: 'Faollik', icon: Activity },
        { k: 'users' as const, l: 'Foydalanuvchilar', icon: Users },
        { k: 'teachers' as const, l: 'O‘qituvchilar', icon: UserCheck },
        { k: 'broadcast' as const, l: 'Xabarnoma', icon: Bell },
        { k: 'tests' as const, l: 'Testlar', icon: Layers },
        { k: 'docs' as const, l: 'Materiallar', icon: FileText },
        { k: 'moderation' as const, l: 'Moderatsiya', icon: ShieldCheck },
        { k: 'billing' as const, l: 'To‘lov', icon: CreditCard },
        { k: 'ai' as const, l: 'AI sozlamalari', icon: Bot },
        { k: 'knowledge' as const, l: 'Bilim bazasi', icon: BookOpen },
        { k: 'audit' as const, l: 'Audit', icon: ScrollText },
    ]
    type TabKey = (typeof tabs)[number]['k']
    const tabGroups: Array<{ label: string; keys: TabKey[] }> = [
        { label: 'Statistika', keys: ['stats', 'presence', 'activity'] },
        { label: 'Foydalanuvchilar', keys: ['users', 'teachers', 'broadcast'] },
        { label: 'Kontent', keys: ['tests', 'docs', 'moderation'] },
        { label: 'To‘lovlar', keys: ['billing'] },
        { label: 'AI boshqaruvi', keys: ['ai', 'knowledge'] },
        { label: 'Audit', keys: ['audit'] },
    ]
    const tabDescriptions: Record<TabKey, string> = {
        stats: 'Platformaning asosiy ko‘rsatkichlari, AI sarfi va foydalanish dinamikasi.',
        presence: 'Foydalanuvchilarning platformada o‘tkazgan vaqti va hozirgi holati.',
        activity: 'Kirishlar, xabarlar va foydalanuvchi faolligi bo‘yicha voqealar.',
        users: 'Hisoblar, rollar, holatlar va foydalanuvchi tafsilotlarini boshqaring.',
        teachers: 'O‘qituvchi hisoblarini yarating va ularning ruxsatlarini kuzating.',
        tests: 'Platformadagi testlarni qidiring, tartiblang va boshqaring.',
        docs: 'O‘quv materiallari va yuklangan hujjatlarni boshqaring.',
        moderation: 'Ommaviy testlarni tekshiring va nashrga tasdiqlang.',
        billing: 'Paylov sandbox oqimi va billing konfiguratsiyasi holatini tekshiring.',
        broadcast: 'Barcha yoki tanlangan foydalanuvchilarga xabarnoma yuboring.',
        ai: 'AI ustoz xulqi, prompt bo‘limlari va javob parametrlarini sozlang.',
        knowledge: 'AI foydalanadigan fan materiallari va bilim bazasini boshqaring.',
        audit: 'Muhim administrator amallari va xavfsizlik tarixini ko‘ring.',
    }
    const activeAdminTab = tabs.find(item => item.k === tab) || tabs[0]

    // Tablist klaviatura navigatsiyasi: ←/→ qo'shni tab, Home/End — chekka tablar.
    // Fokus ko'chgan tabni darhol faollashtiramiz (roving tabindex naqshi).
    function onTabKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
        const keys: TabKey[] = tabs.map(t => t.k)
        const currentIndex = keys.indexOf(tab)
        if (currentIndex < 0) return
        let nextIndex: number | null = null
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIndex = (currentIndex + 1) % keys.length
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIndex = (currentIndex - 1 + keys.length) % keys.length
        else if (e.key === 'Home') nextIndex = 0
        else if (e.key === 'End') nextIndex = keys.length - 1
        if (nextIndex === null) return
        e.preventDefault()
        const nextKey = keys[nextIndex]
        setTab(nextKey)
        tabRefs.current[nextKey]?.focus()
    }

    // Helper: card style
    const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)' }
    const mutedText = { color: 'var(--text-muted)' }
    const secondaryText = { color: 'var(--text-secondary)' }
    const normalizedTimeSpentSearch = timeSpentSearch.trim().toLowerCase()
    const sortedTimeSpentUsers = [...timeSpentUsers]
        .sort((left, right) => {
            const leftValue = timeSpentSort === 'week'
                ? (left.weekMinutes || 0)
                : timeSpentSort === 'total'
                    ? (left.totalMinutes || 0)
                    : (left.todayMinutes || 0)
            const rightValue = timeSpentSort === 'week'
                ? (right.weekMinutes || 0)
                : timeSpentSort === 'total'
                    ? (right.totalMinutes || 0)
                    : (right.todayMinutes || 0)
            if (rightValue !== leftValue) return rightValue - leftValue
            if (right.isOnline !== left.isOnline) return Number(right.isOnline) - Number(left.isOnline)
            return left.name.localeCompare(right.name, 'uz')
        })
    const filteredTimeSpentUsers = sortedTimeSpentUsers
        .filter(user => {
            if (!normalizedTimeSpentSearch) return true
            return (
                user.name?.toLowerCase().includes(normalizedTimeSpentSearch) ||
                user.email?.toLowerCase().includes(normalizedTimeSpentSearch)
            )
        })
    // "Hozir onlayn" YAGONA manbasi — /analytics/online-users (onlineUsers holati, 30s da yangilanadi)
    const onlineNowCount = onlineUsers.length
    const totalTodayMinutes = timeSpentUsers.reduce((sum, user) => sum + (user.todayMinutes || 0), 0)
    const totalWeekMinutes = timeSpentUsers.reduce((sum, user) => sum + (user.weekMinutes || 0), 0)
    // Knowledge — fan filtri + matn qidiruv (sarlavha/manba/mazmun) + load-more uchun bir marta hisoblanadi
    const normalizedKnowledgeSearch = knowledgeSearch.trim().toLowerCase()
    const filteredKnowledge = knowledgeItems
        .filter(item => knowledgeFilter === 'all' || item.subject === knowledgeFilter)
        .filter(item => {
            if (!normalizedKnowledgeSearch) return true
            return (
                item.title?.toLowerCase().includes(normalizedKnowledgeSearch) ||
                item.source?.toLowerCase().includes(normalizedKnowledgeSearch) ||
                item.content?.toLowerCase().includes(normalizedKnowledgeSearch)
            )
        })

    return (
        <div ref={pageRef} className="kelviq operations-workspace operations-workspace--admin h-screen overflow-y-auto w-full">
            <header className="operations-topbar">
                <div className="operations-topbar__inner">
                    <div className="operations-brand">
                        <img src="/dtmmax-logo.png" alt="DTMMax" className="operations-brand__logo" />
                        <div className="operations-brand__copy">
                            <span className="operations-brand__name">DTMMax</span>
                            <span className="operations-role">Admin</span>
                        </div>
                    </div>
                    <div className="operations-topbar__account">
                        {currentUser?.name && <span className="operations-account-name">{currentUser.name}</span>}
                        <button onClick={() => { logout(); nav('/') }} className="operations-topbar__action" aria-label="Tizimdan chiqish" title="Tizimdan chiqish">
                            <LogOut className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </header>

            <div className="operations-shell">
                <div className="operations-grid">
                    <aside role="tablist" aria-label="Admin paneli bo'limlari"
                        className="operations-sidebar"
                        onKeyDown={onTabKeyDown}>
                        {tabGroups.map(group => (
                            <div key={group.label} className="operations-nav-group">
                                <p className="operations-nav-group__label">{group.label}</p>
                                <div className="operations-nav">
                                    {group.keys.map(key => tabs.find(item => item.k === key)).filter((item): item is (typeof tabs)[number] => Boolean(item)).map(t => {
                                        const selected = tab === t.k
                                        return (
                                            <button key={t.k} onClick={() => setTab(t.k)}
                                                role="tab"
                                                id={`admin-tab-${t.k}`}
                                                aria-selected={selected}
                                                aria-controls={`admin-tabpanel-${t.k}`}
                                                tabIndex={selected ? 0 : -1}
                                                ref={el => { tabRefs.current[t.k] = el }}
                                                className={`operations-nav__item ${selected ? 'is-active' : ''}`}>
                                                <t.icon className="h-4 w-4" /> {t.l}
                                                {t.k === 'moderation' && pendingCount > 0 && (
                                                    <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-none text-[#171717]"
                                                        style={{ background: 'var(--brand)' }}>
                                                        {pendingCount > 99 ? '99+' : pendingCount}
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </aside>

                    <main className="operations-main">
                        <div className="operations-page-heading">
                            <div>
                                <h1>{activeAdminTab.l}</h1>
                                <p>{tabDescriptions[tab]}</p>
                            </div>
                        </div>
                        {/* Tab paneli — faqat faol bo'lim render qilinadi, ARIA bilan bog'langan */}
                        <div role="tabpanel" id={`admin-tabpanel-${tab}`} aria-labelledby={`admin-tab-${tab}`} tabIndex={0} className="operations-tabpanel focus:outline-none">

                {/* === STATS === */}
                {tab === 'stats' && loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <div className="w-7 h-7 border-2 rounded-full animate-spin mx-auto mb-2" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--brand)' }} />
                            <p className="text-sm" style={mutedText}>Yuklanmoqda...</p>
                        </div>
                    </div>
                )}
                {tab === 'stats' && !loading && !stats && (
                    <div className="flex items-center justify-center py-20">
                        <div className="rounded-2xl px-6 py-8 text-center max-w-sm" style={cardStyle}>
                            <div className="h-11 w-11 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <p className="text-sm font-semibold mb-1">Statistikani yuklab boʻlmadi</p>
                            <p className="text-[12px] mb-4" style={mutedText}>{statsError || 'Server bilan bogʻlanishda xatolik yuz berdi'}</p>
                            <button onClick={loadStats} className="btn btn-primary flex items-center gap-2 mx-auto">
                                <RefreshCw className="h-3.5 w-3.5" /> Qayta urinish
                            </button>
                        </div>
                    </div>
                )}
                {tab === 'stats' && !loading && stats && (
                    <div className="space-y-5">

                        {/* === AI SARFI (bepul kunlik limitlar hisobi) === */}
                        {aiUsage && (
                            <div className="rounded-xl p-4" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                                    <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>AI sarfi — bugun</p>
                                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>limit: {aiUsage.limits.chat} so'rov · {aiUsage.limits.vision} rasm / kun</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[
                                        { label: 'Faol user', value: aiUsage.today.users },
                                        { label: "AI so'rovlar", value: aiUsage.today.chat },
                                        { label: 'Rasm tahlili', value: aiUsage.today.vision },
                                        { label: 'Limitga urilgan', value: aiUsage.today.atChatLimit + aiUsage.today.atVisionLimit },
                                    ].map(item => (
                                        <div key={item.label} className="rounded-lg px-3 py-2" style={{ background: 'var(--bg-surface)' }}>
                                            <p className="text-lg font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
                                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                                        </div>
                                    ))}
                                </div>
                                {aiUsage.days.length > 1 && (
                                    <div className="mt-3 space-y-1">
                                        {aiUsage.days.map(d => {
                                            const maxChat = Math.max(...aiUsage.days.map(x => x.chat), 1)
                                            return (
                                                <div key={d.day} className="flex items-center gap-2">
                                                    <span className="text-[10px] w-12 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{d.day.slice(5)}</span>
                                                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                                                        <div className="h-full rounded-full" style={{ width: `${Math.round((d.chat / maxChat) * 100)}%`, background: 'var(--brand)' }} />
                                                    </div>
                                                    <span className="text-[10px] w-20 flex-shrink-0 text-right" style={{ color: 'var(--text-muted)' }}>{d.chat} so'rov · {d.users} user</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* === HOZIR ONLAYN === */}
                        <div className="rounded-xl overflow-hidden" style={{ border: '1.5px solid color-mix(in srgb, var(--success) 30%, transparent)', background: 'color-mix(in srgb, var(--success) 4%, transparent)' }}>
                            <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid color-mix(in srgb, var(--success) 15%, transparent)' }}>
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-[12px] font-bold" style={{ color: 'var(--success)' }}>Hozir onlayn — {onlineUsers.length} ta</span>
                                </div>
                                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>30s yangilanadi</span>
                            </div>
                            {onlineUsers.length === 0 ? (
                                <div className="px-4 py-3 text-[12px]" style={{ color: 'var(--text-muted)' }}>Hozircha hech kim onlayn emas</div>
                            ) : (
                                <div className="divide-y" style={{ borderColor: 'color-mix(in srgb, var(--success) 10%, transparent)' }}>
                                    {onlineUsers.map((u: any, i: number) => {
                                        const ago = Math.round((Date.now() - u.lastSeen) / 1000)
                                        const agoStr = ago < 60 ? `${ago}s oldin` : `${Math.round(ago/60)}min oldin`
                                        const roleColor = u.role === 'ADMIN' ? 'var(--info)' : u.role === 'TEACHER' ? 'var(--brand)' : 'var(--success)'
                                        return (
                                            <div key={i} className="flex items-center gap-3 px-4 py-2">
                                                <div className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0" style={{ background: roleColor }}>{u.name?.[0]?.toUpperCase() || '?'}</div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[12px] font-semibold truncate">{u.name}</p>
                                                    <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `color-mix(in srgb, ${roleColor} 12%, transparent)`, color: roleColor }}>{u.role}</span>
                                                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{agoStr}</span>
                                                    <Wifi className="h-3 w-3" style={{ color: 'var(--success)' }} />
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
                                    { n: stats.teachers, l: 'O\'qituvchilar', icon: UserCheck, color: 'var(--brand)' },
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

                        {/* Faollik — bitta toza qator. "Hozir onlayn" yashil bannerда bor;
                            avval "Faollik" + "Faol foydalanuvchilar" 7-kun metrikasini takrorlardi. */}
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2.5" style={mutedText}>Faollik</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-2.5">
                                {[
                                    { n: activeUsers?.dau ?? null, l: 'Bugun faol', icon: Activity, color: 'var(--brand)' },
                                    { n: activeUsers?.wau ?? stats.activeUsers7d, l: 'Faol (7 kun)', icon: CalendarClock, color: '#06b6d4' },
                                    { n: activeUsers?.mau ?? null, l: 'Faol (30 kun)', icon: TrendingUp, color: 'var(--success)' },
                                    { n: stats.newUsers24h, l: 'Yangi (24h)', icon: UserPlus, color: 'var(--info)' },
                                    { n: stats.messages7d, l: 'Xabarlar (7 kun)', icon: MessageSquare, color: 'var(--brand)' },
                                ].filter(s => s.n != null).map((s, i) => (
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
                                        { n: testStats.totalTests, l: 'Jami testlar', icon: ClipboardList, color: 'var(--info)' },
                                        { n: testStats.publicTests, l: 'Ochiq (public)', icon: Globe, color: 'var(--success)' },
                                        { n: testStats.privateTests, l: 'Yopiq (private)', icon: Lock, color: 'var(--text-muted)' },
                                        { n: testStats.totalAttempts, l: 'Jami urinishlar', icon: BarChart3, color: 'var(--brand)' },
                                        { n: `${testStats.avgScore ?? 0}%`, l: 'O\'rtacha ball', icon: Award, color: 'var(--brand)' },
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
                                                    <span className="text-[12px] font-bold tabular-nums" style={{ color: a.score >= 70 ? 'var(--success)' : a.score >= 50 ? 'var(--brand)' : 'var(--danger)' }}>
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

                    </div>
                )}


                {/* === USERS === */}
                {tab === 'users' && (
                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
                            <p className="text-[11px]" style={mutedText}>{usersTotal} ta foydalanuvchi</p>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <input
                                    type="search" placeholder="Ism yoki email bo'yicha qidirish..."
                                    value={usersSearch}
                                    onChange={e => { setUsersSearch(e.target.value); setUsersPage(1) }}
                                    className="input flex-1 sm:flex-none" style={{ height: '2rem', fontSize: '12px' }}
                                />
                                <button onClick={exportUsersCsv} disabled={exportingUsers}
                                    className="btn btn-sm btn-outline flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50">
                                    <Download className={`h-3.5 w-3.5 ${exportingUsers ? 'animate-pulse' : ''}`} />
                                    {exportingUsers ? 'Yuklanmoqda...' : 'CSV yuklab olish'}
                                </button>
                            </div>
                        </div>
                        <div className="rounded-xl overflow-hidden" style={cardStyle}>
                            <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[760px]">
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
                                    {usersLoading ? (
                                        <tr><td colSpan={5} className="text-center py-10 text-[12px]" style={mutedText}>Yuklanmoqda...</td></tr>
                                    ) : users.length === 0 ? (
                                        <tr><td colSpan={5} className="text-center py-10 text-[12px]" style={mutedText}>Foydalanuvchilar topilmadi</td></tr>
                                    ) : users.map(u => (
                                        <tr key={u.id} className="transition" style={{ borderBottom: '1px solid var(--border)' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td className="py-2.5 px-4">
                                                <button onClick={() => openUserDetail(u.id)}
                                                    className="flex items-center gap-2 text-left transition group"
                                                    title="Batafsil koʻrish">
                                                    <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>{u.name?.[0]?.toUpperCase()}</div>
                                                    <span className="text-[13px] font-medium group-hover:underline" style={{ textDecorationColor: 'var(--brand)' }}>{u.name}</span>
                                                </button>
                                            </td>
                                            <td className="py-2.5 px-4 text-[13px]" style={secondaryText}>{u.email}</td>
                                            <td className="py-2.5 px-4">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="px-2 py-0.5 rounded text-[11px] font-medium"
                                                        style={u.role === 'ADMIN' ? { background: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)' } : u.role === 'TEACHER' ? { background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)' } : { background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>{u.role}</span>
                                                    {u.status === 'SUSPENDED' && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold"
                                                            style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
                                                            <Ban className="h-2.5 w-2.5" /> Bloklangan
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-4 text-[12px] tabular-nums" style={mutedText}>{new Date(u.createdAt).toLocaleDateString('uz')}</td>
                                            <td className="py-2.5 px-2">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => openUserDetail(u.id)}
                                                        className="h-6 px-2 flex items-center gap-1 rounded text-[11px] font-medium transition"
                                                        style={{ color: 'var(--text-secondary)' }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.color = 'var(--brand)' }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                                                        title="Batafsil">
                                                        <ExternalLink className="h-3 w-3" /> Batafsil
                                                    </button>
                                                    {u.role !== 'ADMIN' && (<>
                                                        <div className="relative">
                                                            <button onClick={() => setOpenUserMenu(prev => prev === u.id ? null : u.id)}
                                                                disabled={userActionBusy === u.id || statusBusy === u.id}
                                                                className="h-6 w-6 flex items-center justify-center rounded transition disabled:opacity-50"
                                                                style={{ color: 'var(--text-muted)' }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface)' }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                                                                title="Amallar">
                                                                {(userActionBusy === u.id || statusBusy === u.id)
                                                                    ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                                                    : <MoreVertical className="h-3.5 w-3.5" />}
                                                            </button>
                                                            {openUserMenu === u.id && (
                                                                <>
                                                                    <div className="fixed inset-0 z-40" onClick={() => setOpenUserMenu(null)} />
                                                                    <div className="absolute right-0 top-7 z-50 w-52 rounded-xl py-1 shadow-lg"
                                                                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                                                        <button onClick={() => resetUserPassword(u.id, u.name)}
                                                                            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left transition hover:bg-[var(--bg-surface)]">
                                                                            <KeyRound className="h-3.5 w-3.5" style={{ color: 'var(--brand)' }} /> Parolni tiklash
                                                                        </button>
                                                                        <button onClick={() => resendVerification(u.id, u.name)}
                                                                            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left transition hover:bg-[var(--bg-surface)]">
                                                                            <Mail className="h-3.5 w-3.5" style={{ color: 'var(--info)' }} /> Tasdiqni qayta yuborish
                                                                        </button>
                                                                        {currentUser?.id !== u.id && (
                                                                            <>
                                                                                <div className="my-1 mx-2" style={{ borderTop: '1px solid var(--border)' }} />
                                                                                {u.status === 'SUSPENDED' ? (
                                                                                    <button onClick={() => toggleUserStatus(u.id, u.name, 'SUSPENDED')}
                                                                                        className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left transition hover:bg-[var(--bg-surface)]">
                                                                                        <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--success)' }} /> Blokdan chiqarish
                                                                                    </button>
                                                                                ) : (
                                                                                    <button onClick={() => toggleUserStatus(u.id, u.name, 'ACTIVE')}
                                                                                        className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left transition hover:bg-[var(--bg-surface)]"
                                                                                        style={{ color: 'var(--danger)' }}>
                                                                                        <Ban className="h-3.5 w-3.5" /> Bloklash
                                                                                    </button>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                        <button onClick={() => deleteUser(u.id, u.name)}
                                                            className="h-6 w-6 flex items-center justify-center rounded transition"
                                                            style={{ color: 'var(--border-strong)' }}
                                                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-light)' }}
                                                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--border-strong)'; e.currentTarget.style.background = 'transparent' }}
                                                            title="O'chirish">
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </>)}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>
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
                                <UserCheck className="h-4 w-4" style={{ color: 'var(--brand)' }} />
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
                                    <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--brand) 14%, transparent)' }}>
                                        <UserPlus className="h-5 w-5" style={{ color: 'var(--brand)' }} />
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
                                        <label htmlFor="admin-teacher-name" className="sr-only">O‘qituvchining to‘liq ismi</label>
                                        <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: 'var(--text-muted)' }}>👤</span>
                                        <input id="admin-teacher-name" name="teacherName" autoComplete="name" placeholder="To'liq ism" required value={tf.name} onChange={e => setTf({ ...tf, name: e.target.value })} className="input pl-8" />
                                    </div>
                                    <div className="relative">
                                        <label htmlFor="admin-teacher-email" className="sr-only">O‘qituvchining email manzili</label>
                                        <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: 'var(--text-muted)' }}>✉</span>
                                        <input id="admin-teacher-email" name="teacherEmail" autoComplete="email" type="email" placeholder="Email manzil" required value={tf.email} onChange={e => setTf({ ...tf, email: e.target.value })} className="input pl-8" />
                                    </div>
                                    <div className="relative">
                                        <label htmlFor="admin-teacher-password" className="sr-only">O‘qituvchi uchun vaqtinchalik parol</label>
                                        <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: 'var(--text-muted)' }}>🔑</span>
                                        <input
                                            id="admin-teacher-password"
                                            name="teacherPassword"
                                            autoComplete="new-password"
                                            type="password"
                                            placeholder="Parol (kamida 8 ta, harf va raqam)"
                                            required
                                            minLength={8}
                                            pattern="(?=.*[A-Za-z])(?=.*\d).{8,}"
                                            title="Parolda kamida 8 ta belgi, bitta harf va bitta raqam bo'lishi shart"
                                            value={tf.password}
                                            onChange={e => setTf({ ...tf, password: e.target.value })}
                                            className="input pl-8"
                                        />
                                    </div>
                                    <button type="submit" disabled={creating}
                                        className="w-full h-11 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        style={{ background: 'var(--brand)', color: '#171717' }}>
                                        {creating
                                            ? <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Yaratilmoqda...</>
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
                                                                <GraduationCap className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--brand)' }} />
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
                                    { n: testsTotal, l: 'Jami (filtr)', icon: ClipboardList, color: 'var(--info)' },
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
                        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center">
                            <div className="relative w-full sm:flex-1" style={{ minWidth: 0 }}>
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                                <input type="search" placeholder="Test nomi yoki mualif bo'yicha..."
                                    value={testsSearch}
                                    onChange={e => { setTestsSearch(e.target.value); setTestsPage(1) }}
                                    className="input pl-8 w-full" style={{ height: '2rem', fontSize: '12px' }} />
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
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
                                    className="input flex-1 sm:flex-none" style={{ height: '2rem', fontSize: '12px', minWidth: 120 }}>
                                    <option value="">Barcha fanlar</option>
                                    {KNOWLEDGE_SUBJECTS.map(s =>
                                        <option key={s} value={s}>{s}</option>
                                    )}
                                </select>
                                {/* Sort */}
                                <select value={testsSortBy} onChange={e => setTestsSortBy(e.target.value)}
                                    className="input flex-1 sm:flex-none" style={{ height: '2rem', fontSize: '12px', minWidth: 120 }}>
                                    <option value="createdAt">Yangi → Eski</option>
                                    <option value="attempts">Ko'p urinilgan</option>
                                    <option value="questions">Ko'p savollar</option>
                                </select>
                                <span className="text-[11px]" style={mutedText}>{testsTotal} ta natija</span>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="rounded-xl overflow-hidden" style={cardStyle}>
                            <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[900px]">
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
                                    {testsLoading && tests.length === 0 ? (
                                        <tr><td colSpan={9} className="text-center py-10 text-[12px]" style={mutedText}>Yuklanmoqda...</td></tr>
                                    ) : tests.length === 0 ? (
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
                                                        background: t.creator?.role === 'ADMIN' ? 'color-mix(in srgb, var(--info) 20%, transparent)' : 'var(--bg-muted)',
                                                        color: t.creator?.role === 'ADMIN' ? 'var(--info)' : 'var(--text-secondary)'
                                                    }}>
                                                        {t.creator?.name?.[0]?.toUpperCase() || '?'}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[12px] truncate max-w-[100px]">{t.creator?.name || '—'}</p>
                                                        {t.creator?.role && t.creator.role !== 'STUDENT' && (
                                                            <p className="text-[10px]" style={{ color: t.creator.role === 'ADMIN' ? 'var(--info)' : 'var(--brand)' }}>{t.creator.role}</p>
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
                                                        style={{ color: t.avgScore >= 70 ? 'var(--success)' : t.avgScore >= 50 ? 'var(--brand)' : 'var(--danger)' }}>
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

                {/* === ONLINE VAQT === */}
                {tab === 'presence' && (
                    <div className="space-y-5">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                                <h2 className="text-base font-bold">Platformada o‘tkazilgan vaqt</h2>
                                <p className="text-[12px] mt-1" style={mutedText}>
                                    {trackedUsers} ta user · {presenceIntervalMinutes} daqiqalik aktivlik pulsi asosida taxminiy hisob
                                </p>
                            </div>
                            <button onClick={loadTimeSpent} className="btn btn-sm btn-outline flex items-center gap-1.5">
                                <RefreshCw className={`h-3 w-3 ${timeSpentLoading ? 'animate-spin' : ''}`} /> Yangilash
                            </button>
                        </div>

                        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5">
                            {[
                                { label: 'Kuzatilayotgan foydalanuvchilar', value: trackedUsers, tone: 'var(--brand)' },
                                { label: 'Hozir onlayn', value: onlineNowCount, tone: 'var(--success)' },
                                { label: 'Bugungi umumiy vaqt', value: formatDuration(totalTodayMinutes), tone: 'var(--brand)' },
                                { label: '7 kunlik umumiy vaqt', value: formatDuration(totalWeekMinutes), tone: 'var(--info)' },
                            ].map(item => (
                                <div key={item.label} className="rounded-xl p-4" style={cardStyle}>
                                    <p className="text-[10px] uppercase tracking-wide mb-1" style={mutedText}>{item.label}</p>
                                    <p className="text-xl font-bold" style={{ color: item.tone }}>{item.value}</p>
                                </div>
                            ))}
                        </div>

                        <div className="rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap" style={cardStyle}>
                            <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                                    <input
                                        type="search"
                                        placeholder="Ism yoki email bo‘yicha qidirish..."
                                        value={timeSpentSearch}
                                        onChange={event => setTimeSpentSearch(event.target.value)}
                                        className="input pl-9 w-full"
                                        style={{ height: '2.25rem', fontSize: '13px' }}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Filter className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                                <select
                                    value={timeSpentSort}
                                    onChange={event => setTimeSpentSort(event.target.value as 'today' | 'week' | 'total')}
                                    className="input"
                                    style={{ height: '2.25rem', fontSize: '13px', cursor: 'pointer', minWidth: '170px' }}
                                >
                                    <option value="today">Bugungi vaqt bo‘yicha</option>
                                    <option value="week">7 kun bo‘yicha</option>
                                    <option value="total">Jami vaqt bo‘yicha</option>
                                </select>
                            </div>
                        </div>

                        {timeSpentError && (
                            <div className="rounded-xl px-4 py-3 text-[12px]" style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)' }}>
                                {timeSpentError}
                            </div>
                        )}

                        <div className="rounded-xl overflow-hidden" style={cardStyle}>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[980px]">
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                                            <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>Foydalanuvchi</th>
                                            <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>Rol</th>
                                            <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>Bugun</th>
                                            <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>7 kun</th>
                                            <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>Jami</th>
                                            <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>Holat</th>
                                            <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>So‘nggi faollik</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {timeSpentLoading && filteredTimeSpentUsers.length === 0 ? (
                                            <tr><td colSpan={7} className="text-center py-10 text-[12px]" style={mutedText}>Yuklanmoqda...</td></tr>
                                        ) : filteredTimeSpentUsers.length === 0 ? (
                                            <tr><td colSpan={7} className="text-center py-10 text-[12px]" style={mutedText}>Mos foydalanuvchi topilmadi</td></tr>
                                        ) : filteredTimeSpentUsers.slice(0, presenceVisible).map(user => (
                                            <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-[var(--bg-surface)] transition-colors">
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                                                            {user.name?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-[12px] font-medium truncate">{user.name}</p>
                                                            <p className="text-[10px] truncate" style={mutedText}>{user.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="px-2 py-1 rounded-full text-[10px] font-semibold" style={
                                                        user.role === 'ADMIN'
                                                            ? { background: 'color-mix(in srgb, var(--info) 12%, transparent)', color: 'var(--info)' }
                                                            : user.role === 'TEACHER'
                                                                ? { background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)' }
                                                                : { background: 'var(--bg-surface)', color: 'var(--text-muted)' }
                                                    }>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-[12px] font-medium tabular-nums">{formatDuration(user.todayMinutes || 0)}</td>
                                                <td className="py-3 px-4 text-[12px] font-medium tabular-nums">{formatDuration(user.weekMinutes || 0)}</td>
                                                <td className="py-3 px-4">
                                                    <div>
                                                        <p className="text-[12px] font-semibold tabular-nums">{formatDuration(user.totalMinutes || 0)}</p>
                                                        <p className="text-[10px]" style={mutedText}>{user.totalHours || 0} soat</p>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold" style={user.isOnline ? { background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' } : { background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                                                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: user.isOnline ? 'var(--success)' : 'var(--text-muted)' }} />
                                                        {user.isOnline ? 'Onlayn' : 'Offlayn'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-[11px] tabular-nums" style={mutedText}>
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

                        {/* Load more / hisob */}
                        {filteredTimeSpentUsers.length > 0 && (
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <p className="text-[11px]" style={mutedText}>
                                    {Math.min(presenceVisible, filteredTimeSpentUsers.length)} / {filteredTimeSpentUsers.length} koʻrsatilmoqda
                                </p>
                                {presenceVisible < filteredTimeSpentUsers.length && (
                                    <button onClick={() => setPresenceVisible(v => v + PRESENCE_PER_PAGE)}
                                        className="btn btn-sm btn-outline flex items-center gap-1.5">
                                        Yana koʻrsatish ({Math.min(PRESENCE_PER_PAGE, filteredTimeSpentUsers.length - presenceVisible)} ta)
                                    </button>
                                )}
                            </div>
                        )}
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
                                        <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>Vaqt</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activityLoading && activityLogs.length === 0 ? (
                                        <tr><td colSpan={3} className="text-center py-10 text-[12px]" style={mutedText}>Yuklanmoqda...</td></tr>
                                    ) : activityLogs.length === 0 ? (
                                        <tr><td colSpan={3} className="text-center py-10 text-[12px]" style={mutedText}>Yozuvlar yo'q</td></tr>
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

                {/* === AUDIT LOGI (admin amallari tarixi) === */}
                {tab === 'audit' && (
                    <div>
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                                <p className="text-[11px]" style={mutedText}>{auditTotal} ta yozuv</p>
                                <button onClick={loadAudit} className="btn btn-sm btn-outline flex items-center gap-1.5">
                                    <RefreshCw className={`h-3 w-3 ${auditLoading ? 'animate-spin' : ''}`} /> Yangilash
                                </button>
                            </div>
                            <p className="text-[11px] flex items-center gap-1.5" style={mutedText}>
                                <ScrollText className="h-3.5 w-3.5" style={{ color: 'var(--brand)' }} />
                                Admin amallari tarixi (yangi → eski)
                            </p>
                        </div>

                        {auditError && (
                            <div className="rounded-xl px-4 py-3 text-[12px] mb-3 flex items-center justify-between gap-3" style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)' }}>
                                <span>{auditError}</span>
                                <button onClick={loadAudit} className="btn btn-sm btn-outline flex items-center gap-1.5 flex-shrink-0">
                                    <RefreshCw className="h-3 w-3" /> Qayta urinish
                                </button>
                            </div>
                        )}

                        <div className="rounded-xl overflow-hidden" style={cardStyle}>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[720px]">
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                                            <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>Admin</th>
                                            <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>Amal</th>
                                            <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>Obyekt</th>
                                            <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>Vaqt</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {auditLoading && auditLogs.length === 0 ? (
                                            <tr><td colSpan={4} className="text-center py-10 text-[12px]" style={mutedText}>Yuklanmoqda...</td></tr>
                                        ) : auditLogs.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="text-center py-12">
                                                    <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                                    <p className="text-[12px]" style={mutedText}>Hali audit yozuvlari yoʻq</p>
                                                </td>
                                            </tr>
                                        ) : auditLogs.map(log => {
                                            const info = auditActionInfo(log.action)
                                            const actorName = log.actor?.name || log.actorEmail || '—'
                                            const actorEmail = log.actor?.email || log.actorEmail || ''
                                            const targetLabel = AUDIT_TARGET_LABELS[log.targetType] || log.targetType
                                            return (
                                                <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-[var(--bg-surface)] transition-colors">
                                                    <td className="py-2.5 px-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                                                                style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                                                                {actorName?.[0]?.toUpperCase() || '?'}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-[12px] font-medium truncate">{actorName}</p>
                                                                {actorEmail && <p className="text-[10px] truncate" style={mutedText}>{actorEmail}</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 px-4">
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                                            style={{ background: `color-mix(in srgb, ${info.tone} 14%, transparent)`, color: info.tone }}>
                                                            {info.label}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-4">
                                                        <div className="min-w-0">
                                                            <p className="text-[12px] font-medium">{targetLabel}</p>
                                                            {log.targetId && <p className="text-[10px] truncate font-mono" style={mutedText}>{log.targetId}</p>}
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 px-4 text-[11px] tabular-nums" style={mutedText}>
                                                        {new Date(log.createdAt).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Pagination */}
                        {auditPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-3">
                                <button disabled={auditPage <= 1} onClick={() => setAuditPage(p => Math.max(1, p - 1))} className="btn btn-sm btn-outline">← Oldingi</button>
                                <span className="text-[12px]" style={mutedText}>{auditPage} / {auditPages}</span>
                                <button disabled={auditPage >= auditPages} onClick={() => setAuditPage(p => Math.min(auditPages, p + 1))} className="btn btn-sm btn-outline">Keyingi →</button>
                            </div>
                        )}
                    </div>
                )}

                {/* === MODERATSIYA (kutilayotgan testlar) === */}
                {tab === 'moderation' && (
                    <div>
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                                <p className="text-[11px]" style={mutedText}>{pendingCount} ta kutilmoqda</p>
                                <button onClick={loadPending} className="btn btn-sm btn-outline flex items-center gap-1.5">
                                    <RefreshCw className={`h-3 w-3 ${pendingLoading ? 'animate-spin' : ''}`} /> Yangilash
                                </button>
                            </div>
                            <p className="text-[11px] flex items-center gap-1.5" style={mutedText}>
                                <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--brand)' }} />
                                Tasdiqlanmagan testlar — ommaga chiqishidan oldin koʻrib chiqing
                            </p>
                        </div>

                        {pendingError && (
                            <div className="rounded-xl px-4 py-3 text-[12px] mb-3 flex items-center justify-between gap-3" style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)' }}>
                                <span>{pendingError}</span>
                                <button onClick={loadPending} className="btn btn-sm btn-outline flex items-center gap-1.5 flex-shrink-0">
                                    <RefreshCw className="h-3 w-3" /> Qayta urinish
                                </button>
                            </div>
                        )}

                        <div className="rounded-xl overflow-hidden" style={cardStyle}>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[760px]">
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                                            <th className="text-left py-2.5 px-4 font-medium text-[11px] uppercase" style={mutedText}>Test nomi</th>
                                            <th className="text-left py-2.5 px-3 font-medium text-[11px] uppercase" style={mutedText}>Muallif</th>
                                            <th className="text-left py-2.5 px-3 font-medium text-[11px] uppercase" style={mutedText}>Fan</th>
                                            <th className="text-left py-2.5 px-3 font-medium text-[11px] uppercase" style={mutedText}>Sana</th>
                                            <th className="py-2.5 px-3" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingLoading && pendingTests.length === 0 ? (
                                            <tr><td colSpan={5} className="text-center py-10 text-[12px]" style={mutedText}>Yuklanmoqda...</td></tr>
                                        ) : pendingTests.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="text-center py-12">
                                                    <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-30" style={{ color: 'var(--success)' }} />
                                                    <p className="text-[12px]" style={mutedText}>Kutilayotgan testlar yoʻq — hammasi koʻrib chiqilgan</p>
                                                </td>
                                            </tr>
                                        ) : pendingTests.map(t => {
                                            const creatorName = t.creator?.name || t.creator?.email || '—'
                                            const creatorEmail = t.creator?.email || ''
                                            const busy = moderationBusy === t.id
                                            return (
                                                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-[var(--bg-surface)] transition-colors">
                                                    <td className="py-2.5 px-4 max-w-[240px]">
                                                        <p className="text-[13px] font-medium truncate">{t.title}</p>
                                                        <p className="text-[10px]" style={mutedText}>
                                                            {t.testType || 'REGULAR'} · {t._count?.questions || 0} ta savol
                                                        </p>
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                                                                style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                                                                {creatorName?.[0]?.toUpperCase() || '?'}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-[12px] font-medium truncate max-w-[140px]">{creatorName}</p>
                                                                {creatorEmail && <p className="text-[10px] truncate max-w-[140px]" style={mutedText}>{creatorEmail}</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        <span className="text-[11px]" style={mutedText}>{t.subject || '—'}</span>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-[11px] tabular-nums" style={mutedText}>
                                                        {new Date(t.createdAt).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', year: '2-digit' })}
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button onClick={() => approveTest(t)} disabled={busy}
                                                                className="inline-flex items-center gap-1 h-7 px-3 rounded-lg text-[12px] font-semibold text-white transition disabled:opacity-50"
                                                                style={{ background: 'var(--success)' }}>
                                                                <CheckCircle2 className="h-3.5 w-3.5" /> Tasdiqlash
                                                            </button>
                                                            <button onClick={() => rejectTest(t)} disabled={busy}
                                                                className="inline-flex items-center gap-1 h-7 px-3 rounded-lg text-[12px] font-semibold transition disabled:opacity-50"
                                                                style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)' }}>
                                                                <Ban className="h-3.5 w-3.5" /> Rad etish
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
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

                        {/* Qidiruv (sarlavha / manba / mazmun bo'yicha — mavjud ro'yxat ustidan) */}
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                            <input type="search" placeholder="Sarlavha, manba yoki mazmun bo'yicha qidirish..."
                                value={knowledgeSearch}
                                onChange={e => { setKnowledgeSearch(e.target.value); setKnowledgeVisible(KNOWLEDGE_PER_PAGE) }}
                                className="input pl-9 w-full" style={{ height: '2.25rem', fontSize: '13px' }} />
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
                                {filteredKnowledge
                                    .slice(0, knowledgeVisible)
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
                                                        pageRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
                                                    }}>Tahrir</button>
                                                    <button className="btn btn-sm" style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none' }}
                                                        onClick={() => deleteKnowledge(item.id)}>O'chir</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                {filteredKnowledge.length === 0 && (
                                    <div className="text-center py-8" style={mutedText}>
                                        {normalizedKnowledgeSearch || knowledgeFilter !== 'all'
                                            ? 'Qidiruv yoki filtrga mos maʼlumot topilmadi.'
                                            : "Hali ma'lumot yo'q. Yuqoridagi forma orqali qo'shing."}
                                    </div>
                                )}
                                {/* Load more / hisob */}
                                {filteredKnowledge.length > 0 && (
                                    <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                                        <p className="text-[11px]" style={mutedText}>
                                            {Math.min(knowledgeVisible, filteredKnowledge.length)} / {filteredKnowledge.length} koʻrsatilmoqda
                                        </p>
                                        {knowledgeVisible < filteredKnowledge.length && (
                                            <button onClick={() => setKnowledgeVisible(v => v + KNOWLEDGE_PER_PAGE)}
                                                className="btn btn-sm btn-outline flex items-center gap-1.5">
                                                Yana koʻrsatish ({Math.min(KNOWLEDGE_PER_PAGE, filteredKnowledge.length - knowledgeVisible)} ta)
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* === PAYLOV BILLING === */}
                {tab === 'billing' && <PaylovSandboxPanel />}

                {/* === XABARNOMA (BROADCAST) === */}
                {tab === 'broadcast' && (
                    <div className="max-w-xl">
                        <div className="rounded-2xl p-5 space-y-5" style={cardStyle}>
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--brand) 14%, transparent)', color: 'var(--brand)' }}>
                                    <Bell className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm">Xabarnoma yuborish</h3>
                                    <p className="text-[12px]" style={mutedText}>O'quvchilarga bildirishnoma joʻnating</p>
                                </div>
                            </div>

                            {bcResult && (
                                <div className="text-[13px] px-3.5 py-2.5 rounded-xl flex items-start gap-2"
                                    style={bcResult.ok
                                        ? { background: 'color-mix(in srgb, var(--success) 10%, transparent)', color: 'var(--success)', border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)' }
                                        : { background: 'var(--danger-light)', color: 'var(--danger)' }}>
                                    {bcResult.ok ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                                    <span>{bcResult.text}</span>
                                </div>
                            )}

                            <form onSubmit={sendBroadcast} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium block mb-1.5" style={secondaryText}>Sarlavha</label>
                                    <input className="input" placeholder="Masalan: Yangi test qoʻshildi"
                                        value={bcTitle} onChange={e => setBcTitle(e.target.value)} maxLength={120} />
                                </div>
                                <div>
                                    <label className="text-sm font-medium block mb-1.5" style={secondaryText}>Matn</label>
                                    <textarea className="input resize-y" rows={5} placeholder="Xabar matnini kiriting..."
                                        value={bcMessage} onChange={e => setBcMessage(e.target.value)}
                                        style={{ height: 'auto', padding: '0.625rem 0.875rem' }} />
                                </div>
                                <div>
                                    <label className="text-sm font-medium block mb-1.5" style={secondaryText}>Kimga</label>
                                    <div className="flex gap-0.5 rounded-lg p-0.5 w-fit" style={{ background: 'var(--bg-surface)' }}>
                                        {([
                                            { k: 'all' as const, l: 'Hammaga' },
                                            { k: 'specific' as const, l: 'Aniq foydalanuvchi(lar)' },
                                        ]).map(opt => (
                                            <button key={opt.k} type="button" onClick={() => { setBcTarget(opt.k); setBcResult(null) }}
                                                className="px-3 py-1.5 rounded-md text-[12px] font-medium transition"
                                                style={bcTarget === opt.k ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : { color: 'var(--text-muted)' }}>
                                                {opt.l}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {bcTarget === 'specific' && (
                                    <div>
                                        <label className="text-sm font-medium block mb-1.5" style={secondaryText}>Email manzillar</label>
                                        <textarea className="input resize-y" rows={3}
                                            placeholder="Email manzillarni vergul, boʻshliq yoki yangi qatordan ajrating&#10;ali@mail.com, vali@mail.com"
                                            value={bcEmails} onChange={e => setBcEmails(e.target.value)}
                                            style={{ height: 'auto', padding: '0.625rem 0.875rem' }} />
                                        <p className="text-[11px] mt-1" style={mutedText}>Faqat oʻquvchilarga xabar yuboriladi.</p>
                                    </div>
                                )}
                                {bcTarget === 'all' && (
                                    <div className="rounded-xl px-3.5 py-3 text-[12px] flex items-start gap-2" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--brand)' }} />
                                        <span>Bu xabar barcha oʻquvchilarga yuboriladi.</span>
                                    </div>
                                )}
                                <button type="submit" disabled={bcSending}
                                    className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
                                    {bcSending
                                        ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Yuborilmoqda...</>
                                        : <><Send className="h-4 w-4" /> Yuborish</>}
                                </button>
                            </form>
                        </div>
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
                                {aiError && (
                                    <div className="text-[13px] px-4 py-2.5 rounded-xl flex items-start gap-2" role="alert"
                                        style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)' }}>
                                        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                        <span>{aiError}</span>
                                    </div>
                                )}
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
                                <button onClick={saveAiSettings} disabled={aiSaving} className="btn btn-primary flex items-center justify-center gap-2" style={{ width: '100%' }}>
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
                                        <button key={s.key} onClick={() => { setPromptSection(s.key); setShowDefault(false); setAiError('') }}
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

                                {/* Default view + clear + reset-to-default */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3 flex-wrap">
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
                                        <button onClick={() => resetAiPromptSection(promptSection, activeSection.label)}
                                            disabled={aiResetting}
                                            className="inline-flex items-center gap-1.5 text-[12px] font-medium disabled:opacity-50"
                                            style={{ color: 'var(--text-secondary)' }}
                                            title="Bu bo'limni standart matnga qaytaradi">
                                            <RefreshCw className={`h-3 w-3 ${aiResetting ? 'animate-spin' : ''}`} />
                                            {aiResetting ? 'Qaytarilmoqda...' : 'Standartga qaytarish'}
                                        </button>
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

                                <button onClick={saveAiSettings} disabled={aiSaving} className="btn btn-primary flex items-center justify-center gap-2" style={{ width: '100%' }}>
                                    <Save className="h-4 w-4" /> {aiSaving ? 'Saqlanmoqda...' : 'Sozlamalarni saqlash'}
                                </button>
                            </div>
                        </div>
                    )
                })()}
                        </div>
                    </main>
                </div>
            </div>

            {/* === USER DETAIL DRAWER === */}
            {detailUserId && (
                <div className="fixed inset-0 z-[90] flex justify-end">
                    <div className="absolute inset-0 k-fade-in" style={{ background: 'rgba(10,10,16,0.40)', backdropFilter: 'blur(2px)' }}
                        onClick={closeUserDetail} />
                    <aside className="relative h-full w-full max-w-md k-slide-in-right overflow-y-auto"
                        style={{ background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', boxShadow: '-12px 0 40px rgba(10,10,16,0.18)' }}>
                        {/* Drawer header */}
                        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3.5"
                            style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" style={{ color: 'var(--brand)' }} />
                                <span className="text-[13px] font-bold">Foydalanuvchi maʼlumotlari</span>
                            </div>
                            <button onClick={closeUserDetail}
                                className="h-8 w-8 flex items-center justify-center rounded-lg transition"
                                style={{ color: 'var(--text-muted)' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                                aria-label="Yopish">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="px-5 py-4">
                            {detailLoading ? (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <div className="w-7 h-7 border-2 rounded-full animate-spin mb-3" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--brand)' }} />
                                    <p className="text-[12px]" style={mutedText}>Yuklanmoqda...</p>
                                </div>
                            ) : detailError ? (
                                <div className="rounded-xl px-4 py-8 text-center" style={cardStyle}>
                                    <div className="h-10 w-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
                                        <AlertTriangle className="h-5 w-5" />
                                    </div>
                                    <p className="text-[13px] font-semibold mb-1">Maʼlumotni yuklab boʻlmadi</p>
                                    <p className="text-[12px] mb-4" style={mutedText}>{detailError}</p>
                                    <button onClick={() => detailUserId && openUserDetail(detailUserId)} className="btn btn-sm btn-outline flex items-center gap-1.5 mx-auto">
                                        <RefreshCw className="h-3.5 w-3.5" /> Qayta urinish
                                    </button>
                                </div>
                            ) : detail ? (() => {
                                const u = detail.user
                                const p = detail.profile
                                const pr = detail.progress
                                const isSelf = currentUser?.id === u.id
                                const examLabel = p?.examType === 'DTM' ? 'DTM' : p?.examType === 'MS' ? 'Milliy Sertifikat' : null
                                const directionParts = [p?.subject, p?.subject2].filter(Boolean) as string[]
                                const dLeft = daysUntil(p?.examDate)
                                const weak = p?.weakTopics ?? []
                                const strong = p?.strongTopics ?? []
                                const roleColor = u.role === 'ADMIN' ? 'var(--info)' : u.role === 'TEACHER' ? 'var(--brand)' : 'var(--success)'
                                const userStatus: UserStatus = u.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE'
                                const isSuspended = userStatus === 'SUSPENDED'
                                // Bloklash faqat o'zga ADMIN bo'lmagan foydalanuvchilar uchun ko'rsatiladi
                                const canSuspend = !isSelf && u.role !== 'ADMIN'
                                return (
                                    <div className="space-y-4">
                                        {/* Identity */}
                                        <div className="flex items-center gap-3">
                                            <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white text-[20px] font-bold flex-shrink-0" style={{ background: roleColor }}>
                                                {u.name?.[0]?.toUpperCase() || '?'}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[15px] font-bold truncate">{u.name}</p>
                                                <p className="text-[12px] truncate" style={mutedText}>{u.email}</p>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: `color-mix(in srgb, ${roleColor} 14%, transparent)`, color: roleColor }}>{ROLE_LABELS[u.role]}</span>
                                                    {u.emailVerified
                                                        ? <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' }}><CheckCircle2 className="h-2.5 w-2.5" /> Tasdiqlangan</span>
                                                        : <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}><Mail className="h-2.5 w-2.5" /> Tasdiqlanmagan</span>}
                                                    {isSuspended && (
                                                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}><Ban className="h-2.5 w-2.5" /> Bloklangan</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Progress metrics */}
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { label: 'XP', value: pr?.xp ?? 0, icon: Zap, color: 'var(--brand)' },
                                                { label: 'Streak', value: `${pr?.streak ?? 0} kun`, icon: Flame, color: '#EA580C' },
                                                { label: 'Testlar', value: pr?.totalTests ?? 0, icon: ClipboardList, color: 'var(--info)' },
                                                { label: "O'rtacha ball", value: `${Math.round(pr?.avgScore ?? 0)}%`, icon: Award, color: 'var(--success)' },
                                            ].map(item => (
                                                <div key={item.label} className="rounded-xl p-3 flex items-center gap-2.5" style={cardStyle}>
                                                    <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ color: item.color, background: `color-mix(in srgb, ${item.color} 12%, transparent)` }}>
                                                        <item.icon className="h-3.5 w-3.5" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[15px] font-bold tabular-nums leading-none">{item.value}</p>
                                                        <p className="text-[10px] mt-0.5" style={mutedText}>{item.label}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Exam / profile */}
                                        <div className="rounded-xl p-4 space-y-2.5" style={cardStyle}>
                                            <p className="text-[11px] font-semibold uppercase tracking-wider" style={mutedText}>Imtihon profili</p>
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-[12px]">
                                                    <Target className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--brand)' }} />
                                                    <span style={mutedText}>Imtihon turi:</span>
                                                    <span className="font-medium ml-auto">{examLabel || '—'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[12px]">
                                                    <BookOpen className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--brand)' }} />
                                                    <span style={mutedText}>Yoʻnalish:</span>
                                                    <span className="font-medium ml-auto text-right truncate">{directionParts.length ? directionParts.join(' + ') : '—'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[12px]">
                                                    <CalendarClock className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--info)' }} />
                                                    <span style={mutedText}>Imtihongacha:</span>
                                                    <span className="font-medium ml-auto">
                                                        {dLeft === null ? '—' : dLeft > 0 ? `${dLeft} kun qoldi` : dLeft === 0 ? 'Bugun!' : `${Math.abs(dLeft)} kun oldin oʻtdi`}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[12px]">
                                                    <Award className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--success)' }} />
                                                    <span style={mutedText}>Maqsad ball:</span>
                                                    <span className="font-medium ml-auto">{p?.targetScore ?? '—'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[12px]">
                                                    <Gauge className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--brand)' }} />
                                                    <span style={mutedText}>Daraja (ability):</span>
                                                    <span className="font-medium ml-auto tabular-nums">{p?.abilityLevel != null ? p.abilityLevel.toFixed(2) : '—'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Weak / strong topics */}
                                        {(weak.length > 0 || strong.length > 0) && (
                                            <div className="rounded-xl p-4 space-y-3" style={cardStyle}>
                                                {weak.length > 0 && (
                                                    <div>
                                                        <p className="text-[11px] font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--danger)' }}>
                                                            <ThumbsDown className="h-3 w-3" /> Qiyin mavzular
                                                        </p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {weak.map((t, i) => (
                                                                <span key={i} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>{t}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {strong.length > 0 && (
                                                    <div>
                                                        <p className="text-[11px] font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--success)' }}>
                                                            <ThumbsUp className="h-3 w-3" /> Kuchli mavzular
                                                        </p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {strong.map((t, i) => (
                                                                <span key={i} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' }}>{t}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Recent attempts */}
                                        <div className="rounded-xl overflow-hidden" style={cardStyle}>
                                            <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                                                <Activity className="h-3.5 w-3.5" style={{ color: 'var(--brand)' }} />
                                                <p className="text-[12px] font-semibold">Soʻnggi urinishlar</p>
                                            </div>
                                            {(detail.recentAttempts && detail.recentAttempts.length > 0) ? (
                                                detail.recentAttempts.map((a, i) => {
                                                    const pct = a.score != null && a.scoreMax ? Math.round((a.score / a.scoreMax) * 100) : null
                                                    return (
                                                        <div key={i} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: i < (detail.recentAttempts!.length - 1) ? '1px solid var(--border)' : 'none' }}>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[12px] font-medium truncate">{a.testTitle || 'Test'}</p>
                                                                <p className="text-[10px]" style={mutedText}>
                                                                    {a.createdAt ? new Date(a.createdAt).toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' }) : '—'}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                                <span className="text-[12px] font-bold tabular-nums" style={{ color: pct == null ? 'var(--text-muted)' : pct >= 70 ? 'var(--success)' : pct >= 50 ? 'var(--brand)' : 'var(--danger)' }}>
                                                                    {pct != null ? `${pct}%` : '—'}
                                                                </span>
                                                                {a.scoreMax != null && (
                                                                    <span className="text-[10px] tabular-nums" style={mutedText}>{a.score ?? 0}/{a.scoreMax}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            ) : (
                                                <div className="px-4 py-6 text-center text-[12px]" style={mutedText}>Hali test yechilmagan</div>
                                            )}
                                        </div>

                                        {/* Edit: name + role */}
                                        <div className="rounded-xl p-4 space-y-3" style={cardStyle}>
                                            <p className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={mutedText}>
                                                <Pencil className="h-3 w-3" /> Tahrirlash
                                            </p>
                                            <div>
                                                <label className="text-[12px] font-medium block mb-1" style={secondaryText}>Ism</label>
                                                <input className="input" value={editName}
                                                    onChange={e => { setEditName(e.target.value); setEditNameDirty(true) }}
                                                    placeholder="Foydalanuvchi ismi" />
                                            </div>
                                            <div>
                                                <label className="text-[12px] font-medium block mb-1 flex items-center gap-1.5" style={secondaryText}>
                                                    <Shield className="h-3 w-3" /> Rol
                                                </label>
                                                {isSelf ? (
                                                    <div className="rounded-xl px-3.5 py-2.5 text-[12px] flex items-start gap-2" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                                                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--brand)' }} />
                                                        <span>Oʻz rolingizni oʻzgartira olmaysiz.</span>
                                                    </div>
                                                ) : (
                                                    <select className="input" value={editRole} onChange={e => setEditRole(e.target.value as ConfirmRole)} style={{ cursor: 'pointer' }}>
                                                        {ROLE_OPTIONS.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                                                    </select>
                                                )}
                                            </div>
                                            <button onClick={saveUserChanges} disabled={savingUser}
                                                className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
                                                {savingUser
                                                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saqlanmoqda...</>
                                                    : <><Save className="h-4 w-4" /> Saqlash</>}
                                            </button>
                                        </div>

                                        {/* Holat: bloklash / blokdan chiqarish (faqat o'zga STUDENT/TEACHER uchun) */}
                                        {canSuspend && (
                                            <div className="rounded-xl p-4 space-y-3" style={cardStyle}>
                                                <p className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={mutedText}>
                                                    <Shield className="h-3 w-3" /> Holat
                                                </p>
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2 text-[12px]">
                                                        <span className="h-2 w-2 rounded-full" style={{ background: isSuspended ? 'var(--danger)' : 'var(--success)' }} />
                                                        <span style={secondaryText}>{isSuspended ? 'Bloklangan — tizimga kira olmaydi' : 'Faol — tizimga kira oladi'}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => toggleUserStatus(u.id, u.name, userStatus)}
                                                    disabled={statusBusy === u.id}
                                                    className="btn w-full flex items-center justify-center gap-2 disabled:opacity-50"
                                                    style={isSuspended
                                                        ? { background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)', border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)' }
                                                        : { background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)' }}>
                                                    {statusBusy === u.id
                                                        ? <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Bajarilmoqda...</>
                                                        : isSuspended
                                                            ? <><ShieldCheck className="h-4 w-4" /> Blokdan chiqarish</>
                                                            : <><Ban className="h-4 w-4" /> Bloklash</>}
                                                </button>
                                            </div>
                                        )}

                                        <p className="text-[10px] text-center pt-1" style={mutedText}>
                                            Roʻyxatdan oʻtgan: {new Date(u.createdAt).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </p>
                                    </div>
                                )
                            })() : null}
                        </div>
                    </aside>
                </div>
            )}

            {/* === BRANDED CONFIRM MODAL === */}
            <ConfirmModal state={confirmState} onClose={closeConfirm} />
        </div>
    )
}
