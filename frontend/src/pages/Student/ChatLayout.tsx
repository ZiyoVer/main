import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BrainCircuit, Plus, Trash2, LogOut, Send, Menu, X, GraduationCap, ClipboardList, Settings, BookOpen, Target, Flame, MessageSquare, FileText, Zap, Square, Lightbulb, Maximize2, Minimize2, Paperclip, Layers, ChevronLeft, ChevronRight, RotateCcw, Sun, Moon, Search, AlertTriangle, TrendingUp, Brain, PenLine, CheckCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import katex from 'katex'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

interface Chat { id: string; title: string; subject?: string; updatedAt: string }
interface Msg { id: string; role: string; content: string; createdAt: string }
interface Profile { onboardingDone: boolean; subject?: string; examDate?: string; targetScore?: number; weakTopics?: string; strongTopics?: string; concerns?: string; totalTests?: number; avgScore?: number; abilityLevel?: number }

// Test paneli uchun inline KaTeX renderer (ReactMarkdown ishlatmaymiz, tez va engil)
function MathText({ text }: { text: string }) {
    if (!text?.includes('$')) return <>{text}</>
    try {
        const html = text
            .replace(/\$\$([^$]+)\$\$/g, (_, m) => katex.renderToString(m.trim(), { displayMode: true, throwOnError: false }))
            .replace(/\$([^$\n]+)\$/g, (_, m) => katex.renderToString(m.trim(), { throwOnError: false }))
        return <span dangerouslySetInnerHTML={{ __html: html }} />
    } catch { return <>{text}</> }
}

// MdMessage komponentni tashqarida va memo bilan ta'riflaymiz —
// shunda har keystrokeda re-render bo'lmaydi (ReactMarkdown+KaTeX qimmat!)
const MdMessage = memo(({ content, onOpenTest, isStreaming, onProfileUpdate, onOpenFlash }: {
    content: string
    onOpenTest: (s: string) => void
    isStreaming?: boolean
    onProfileUpdate?: (data: { weakTopics?: string[]; strongTopics?: string[] }) => void
    onOpenFlash?: (jsonStr: string) => void
}) => (
    <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} components={{
        img: ({ src, alt }) => <img src={src} alt={alt || ''} className="max-h-48 max-w-xs rounded-xl object-contain my-1" style={{ border: '1px solid var(--border)' }} />,
        p: ({ children }) => <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold" style={{ color: 'var(--text-primary)' }}>{children}</strong>,
        em: ({ children }) => <em style={{ color: 'var(--text-secondary)' }}>{children}</em>,
        ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1.5">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        h1: ({ children }) => <h3 className="text-[15px] font-bold mt-4 mb-2 pb-1" style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}>{children}</h3>,
        h2: ({ children }) => <h3 className="text-[15px] font-bold mt-4 mb-2 pb-1" style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}>{children}</h3>,
        h3: ({ children }) => <h4 className="text-[14px] font-bold mt-3 mb-1.5" style={{ color: 'var(--text-primary)' }}>{children}</h4>,
        table: ({ children }) => <div className="overflow-x-auto my-3"><table className="w-full text-[13px] border-collapse">{children}</table></div>,
        thead: ({ children }) => <thead style={{ background: 'var(--bg-surface)' }}>{children}</thead>,
        th: ({ children }) => <th className="px-3 py-2 text-left font-semibold" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{children}</th>,
        td: ({ children }) => <td className="px-3 py-2" style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}>{children}</td>,
        code: ({ children, className }: any) => {
            if (className?.includes('language-test')) {
                const jsonStr = String(children).trim()
                let qCount = 0
                try { qCount = JSON.parse(jsonStr).length } catch { }
                // 0 savol bo'lsa ko'rsatmaymiz — hali to'liq yuklanmagan
                if (qCount === 0) return null
                return (
                    <div className="my-3 rounded-2xl overflow-hidden" style={{
                        background: 'linear-gradient(135deg, rgba(224, 123, 57, 0.1) 0%, rgba(224, 123, 57, 0.04) 100%)',
                        border: '1.5px solid rgba(224, 123, 57, 0.3)',
                    }}>
                        <div className="p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand)' }}>
                                        <ClipboardList className="h-5 w-5 text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Test tayyor!</p>
                                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--brand)', color: '#fff' }}>
                                                {qCount} ta savol
                                            </span>
                                        </div>
                                        <p className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>Yon oynada istalgan vaqtda yechishingiz mumkin</p>
                                    </div>
                                </div>
                                {!isStreaming && (
                                    <button
                                        onClick={() => onOpenTest(jsonStr)}
                                        className="flex-shrink-0 h-9 px-4 rounded-xl text-[13px] font-bold text-white flex items-center gap-2 transition-all"
                                        style={{ background: 'var(--brand)' }}
                                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                                    >
                                        <BookOpen className="h-4 w-4" /> Boshlash
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
            if (className?.includes('language-profile-update')) {
                let data: { weakTopics?: string[]; strongTopics?: string[] } = {}
                try { data = JSON.parse(String(children).trim()) } catch { }
                const hasWeak = (data.weakTopics?.length ?? 0) > 0
                const hasStrong = (data.strongTopics?.length ?? 0) > 0
                return (
                    <div className="my-3 rounded-xl p-4" style={{ background: 'var(--success-light)', border: '1px solid var(--success)' }}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--success)' }}>
                                <GraduationCap className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold">Profilni yangilash taklifi</p>
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Suhbat asosida aniqlandi — tasdiqlaysizmi?</p>
                            </div>
                        </div>
                        <div className="space-y-1 mb-3">
                            {hasWeak && <p className="text-xs flex items-start gap-1.5"><AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} /><span><strong>Qiyin mavzular:</strong> {data.weakTopics!.join(', ')}</span></p>}
                            {hasStrong && <p className="text-xs flex items-start gap-1.5"><CheckCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--success)' }} /><span><strong>Kuchli mavzular:</strong> {data.strongTopics!.join(', ')}</span></p>}
                        </div>
                        {onProfileUpdate && !isStreaming && (
                            <button onClick={() => onProfileUpdate(data)}
                                className="h-8 px-4 rounded-lg text-[13px] font-semibold text-white transition" style={{ background: 'var(--success)' }}>
                                Tasdiqlash va saqlash
                            </button>
                        )}
                    </div>
                )
            }
            if (className?.includes('language-flashcard')) {
                const jsonStr = String(children).trim()
                let count = 0
                try { count = JSON.parse(jsonStr).length } catch { }
                return (
                    <div className="my-3 rounded-xl p-4 flex items-center justify-between" style={{ background: 'var(--brand-light)', border: '1px solid var(--border-strong)' }}>
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand)' }}>
                                <Layers className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold">{count} ta kartochka tayyor</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Bosib aylantiring — formula/javob ko'ring</p>
                            </div>
                        </div>
                        {!isStreaming && onOpenFlash && (
                            <button onClick={() => onOpenFlash(jsonStr)} className="h-9 px-4 rounded-xl text-sm font-semibold text-white transition flex items-center gap-2" style={{ background: 'var(--brand)' }}>
                                <Layers className="h-4 w-4" /> Ochish
                            </button>
                        )}
                    </div>
                )
            }
            const isBlock = className?.includes('language-')
            return isBlock
                ? <pre className="rounded-xl p-4 text-[13px] overflow-x-auto my-3 font-mono leading-relaxed" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}><code>{children}</code></pre>
                : <code className="px-1.5 py-0.5 rounded-md text-[13px] font-mono" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--brand)' }}>{children}</code>
        },
        blockquote: ({ children }) => <blockquote className="border-l-[3px] pl-4 pr-3 py-2 my-3" style={{ borderColor: 'var(--brand)', background: 'var(--brand-light)', color: 'var(--text-secondary)', borderRadius: '0 0.75rem 0.75rem 0' }}>{children}</blockquote>,
        hr: () => <hr className="my-4" style={{ borderColor: 'var(--border)' }} />,
    }}>{content}</ReactMarkdown>
))

export default function ChatLayout() {
    const { chatId } = useParams()
    const nav = useNavigate()
    const { user, logout } = useAuthStore()
    const [chats, setChats] = useState<Chat[]>([])
    const [messages, setMessages] = useState<Msg[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [creating, setCreating] = useState(false)
    const [streaming, setStreaming] = useState('')
    const [sideOpen, setSideOpen] = useState(true)
    const [currentChat, setCurrentChat] = useState<Chat | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [showOnboarding, setShowOnboarding] = useState(false)
    const [sideTab, setSideTab] = useState<'chats' | 'tests' | 'progress' | 'flashcards' | 'settings'>('chats')
    const [darkMode, setDarkMode] = useState<boolean>(() => {
        const saved = localStorage.getItem('darkMode')
        return saved === 'true'
    })
    const [publicTests, setPublicTests] = useState<any[]>([])
    const [myResults, setMyResults] = useState<any[]>([])
    const [stats, setStats] = useState({ chats: 0, messages: 0, streak: 0 })
    const [progressData, setProgressData] = useState<{ xp: number; streak: number; longestStreak: number; avgScore: number; weeklyActivity: Array<{ day: string; count: number }> } | null>(null)
    const [dueFlashcards, setDueFlashcards] = useState<Array<{ id: string; front: string; back: string; subject: string }>>([])
    const [dueCount, setDueCount] = useState(0)
    const [totalFlashcards, setTotalFlashcards] = useState(0)
    const [flashIsReview, setFlashIsReview] = useState(false)
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    const [onboardingForm, setOnboardingForm] = useState({
        subject: 'Matematika', targetScore: 80, examDate: '',
        weakTopics: '', strongTopics: '', concerns: ''
    })
    const [savingProfile, setSavingProfile] = useState(false)
    const [thinkingMode, setThinkingMode] = useState(false)
    const [thinkingText, setThinkingText] = useState('')
    const scrollRef = useRef<HTMLDivElement>(null)
    const abortRef = useRef<AbortController | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const profileRef = useRef<Profile | null>(null)
    const [testPanel, setTestPanel] = useState<string | null>(null)
    const [testAnswers, setTestAnswers] = useState<Record<number, string>>({})
    const [testSubmitted, setTestSubmitted] = useState(false)
    const [testPanelMaximized, setTestPanelMaximized] = useState(false)
    const [attachedFiles, setAttachedFiles] = useState<{ id: string; name: string; text: string; type: string; previewUrl?: string }[]>([])
    const [uploadingFile, setUploadingFile] = useState(false)
    const [loadingPublicTest, setLoadingPublicTest] = useState(false)
    const [activeTestId, setActiveTestId] = useState<string | null>(null)
    const [activeTestQuestions, setActiveTestQuestions] = useState<any[]>([])
    const [testReadOnly, setTestReadOnly] = useState(false)
    // Yechilgan testlar IDlarini localStorage da saqlaymiz
    const completedTestIdsRef = useRef<Set<string>>((() => {
        try { return new Set(JSON.parse(localStorage.getItem('msert_done_tests') || '[]')) } catch { return new Set() }
    })())
    // AI tomonidan yaratilgan yechilgan testlarni saqlash (JSON kaliti bo'yicha)
    const completedAiTestsRef = useRef<Set<string>>((() => {
        try { return new Set(JSON.parse(localStorage.getItem('msert_done_ai_tests') || '[]')) } catch { return new Set() }
    })())
    // Flashcard panel state
    const [flashPanel, setFlashPanel] = useState<Array<{ id?: string; front: string; back: string; subject?: string }> | null>(null)
    const [flashIdx, setFlashIdx] = useState(0)
    const [flashFlipped, setFlashFlipped] = useState(false)
    const [flashMaximized, setFlashMaximized] = useState(false)
    const [flashWidth, setFlashWidth] = useState(384)
    const flashDragRef = useRef(false)
    const [testWidth, setTestWidth] = useState(384)
    const testDragRef = useRef(false)
    const [sidebarWidth, setSidebarWidth] = useState(288)
    const sidebarDragRef = useRef(false)
    const [isSidebarDragging, setIsSidebarDragging] = useState(false)
    const [testTimeLeft, setTestTimeLeft] = useState<number | null>(null)
    const [raschFeedback, setRaschFeedback] = useState<{ prev: number; next: number } | null>(null)

    // Auto-close sidebar on mobile + isMobile track
    useEffect(() => {
        const checkWidth = () => {
            const mobile = window.innerWidth < 768
            setIsMobile(mobile)
            if (mobile) setSideOpen(false)
        }
        checkWidth()
        window.addEventListener('resize', checkWidth)
        return () => window.removeEventListener('resize', checkWidth)
    }, [])

    // Dark mode — DOM va localStorage bilan sinxronlashtirish
    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
        localStorage.setItem('darkMode', String(darkMode))
    }, [darkMode])

    useEffect(() => { loadChats(); loadProfile(); loadPublicTests(); loadMyResults(); loadProgress(); loadDueFlashcards(); logActivity() }, [])
    useEffect(() => { if (chatId) loadMessages(chatId) }, [chatId])

    // Panel drag-to-resize (flashcard + test)
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (flashDragRef.current) setFlashWidth(Math.max(280, Math.min(900, window.innerWidth - e.clientX)))
            if (testDragRef.current) setTestWidth(Math.max(280, Math.min(900, window.innerWidth - e.clientX)))
            if (sidebarDragRef.current) setSidebarWidth(Math.max(240, Math.min(600, e.clientX)))
        }
        const onUp = () => {
            flashDragRef.current = false; testDragRef.current = false;
            if (sidebarDragRef.current) {
                sidebarDragRef.current = false;
                setIsSidebarDragging(false);
            }
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    }, [])
    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        // Foydalanuvchi yuqoriga scroll qilmagan bo'lsa avtomatik pastga tush
        const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 180
        if (isNearBottom) el.scrollTop = el.scrollHeight
    }, [messages, streaming, attachedFiles.length])

    // Test panel yopilganda timerni tozalash
    useEffect(() => {
        if (!testPanel) { setTestTimeLeft(null); setRaschFeedback(null) }
    }, [testPanel])

    // Timer countdown (chain effect — har sekund 1 ta kamayadi)
    useEffect(() => {
        if (testTimeLeft === null || testTimeLeft <= 0) return
        const id = setTimeout(() => setTestTimeLeft(t => (t !== null && t > 0) ? t - 1 : null), 1000)
        return () => clearTimeout(id)
    }, [testTimeLeft])

    // Vaqt tugaganda avtomatik topshirish
    useEffect(() => {
        if (testTimeLeft === 0 && testPanel && !testSubmitted && !testReadOnly) {
            submitTestPanel()
            setTestTimeLeft(null)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [testTimeLeft])

    async function loadProfile() {
        try {
            const p = await fetchApi('/profile')
            setProfile(p)
            profileRef.current = p
            if (p && !p.onboardingDone) setShowOnboarding(true)
            if (p) {
                const weak = p.weakTopics ? JSON.parse(p.weakTopics) : []
                const strong = p.strongTopics ? JSON.parse(p.strongTopics) : []
                setOnboardingForm({
                    subject: p.subject || 'Matematika',
                    targetScore: p.targetScore || 80,
                    examDate: p.examDate ? new Date(p.examDate).toISOString().split('T')[0] : '',
                    weakTopics: weak.join(', '),
                    strongTopics: strong.join(', '),
                    concerns: p.concerns || ''
                })
            }
        } catch { setShowOnboarding(true) }
    }

    async function loadPublicTests() {
        try { setPublicTests(await fetchApi('/tests/public')) } catch { }
    }

    async function loadMyResults() {
        try { setMyResults(await fetchApi('/tests/my-results')) } catch { }
    }

    async function loadProgress() {
        try {
            const data = await fetchApi('/progress/me')
            setProgressData(data)
        } catch { }
    }

    async function loadDueFlashcards() {
        try {
            const data = await fetchApi('/flashcards/due')
            setDueFlashcards(data.cards || [])
            setDueCount(data.dueCount || 0)
            setTotalFlashcards(data.total || 0)
        } catch { }
    }

    async function logActivity(xpGained = 5) {
        try { await fetchApi('/progress/activity', { method: 'POST', body: JSON.stringify({ xpGained }) }) } catch { }
    }

    async function saveOnboarding(e: React.FormEvent) {
        e.preventDefault(); setSavingProfile(true)
        try {
            const data = {
                ...onboardingForm,
                weakTopics: onboardingForm.weakTopics ? onboardingForm.weakTopics.split(',').map(s => s.trim()).filter(Boolean) : [],
                strongTopics: onboardingForm.strongTopics ? onboardingForm.strongTopics.split(',').map(s => s.trim()).filter(Boolean) : [],
                onboardingDone: true,
            }
            await fetchApi('/profile', { method: 'PUT', body: JSON.stringify(data) })
            setShowOnboarding(false)
            await loadProfile()
            // Birinchi marta onboarding — avtomatik chat ochib AI tabriklash xabari
            if (!profile?.onboardingDone) {
                const firstChat = await fetchApi('/chat/new', {
                    method: 'POST',
                    body: JSON.stringify({ title: 'Salom!', subject: onboardingForm.subject })
                })
                await loadChats()
                nav(`/suhbat/${firstChat.id}`)
                setTimeout(() => {
                    const welcomePrompt = `O'quvchi ${user?.name?.split(' ')[0]} platformaga yangi ro'yxatdan o'tdi. Fan: ${onboardingForm.subject}. Imtihon sanasi: ${onboardingForm.examDate || "belgilanmagan"}. Maqsad ball: ${onboardingForm.targetScore || 80}. Ularni shaxsiy, qisqa va samimiy tabriklang. Fan bo'yicha birinchi darsni taklif qiling. 3-4 jumladan oshirmang.`
                    streamToChat(firstChat.id, welcomePrompt, 'Salom! 👋')
                }, 300)
            }
        } catch { }
        setSavingProfile(false)
    }

    async function loadChats() {
        try {
            const c = await fetchApi('/chat/list')
            setChats(c)
            setStats(prev => ({ ...prev, chats: c.length }))
        } catch { }
    }

    async function loadMessages(id: string) {
        try {
            const data = await fetchApi(`/chat/${id}/messages`)
            setMessages(data.messages)
            setCurrentChat(data.chat)
            // Yangi chatga kirganda pastga scroll qilish
            setTimeout(() => {
                const el = scrollRef.current
                if (el) el.scrollTop = el.scrollHeight
            }, 50)
        } catch { }
    }

    const createChat = useCallback(async () => {
        if (creating) return
        setCreating(true)
        try {
            const data = await fetchApi('/chat/new', {
                method: 'POST',
                body: JSON.stringify({ title: 'Yangi suhbat', subject: profile?.subject, forceNew: true })
            })
            await loadChats()
            nav(`/suhbat/${data.id}`)
        } catch { }
        setCreating(false)
    }, [creating, profile])

    // Stream helper — displayText ixtiyoriy: chatda ko'rinadigan matn (prompt AI ga yuboriladi)
    async function streamToChat(targetChatId: string, prompt: string, displayText?: string) {
        const shown = displayText !== undefined ? displayText : prompt
        setLoading(true); setStreaming(''); setThinkingText('')
        const controller = new AbortController()
        abortRef.current = controller
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`/api/chat/${targetChatId}/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ content: prompt, thinking: thinkingMode, ...(displayText !== undefined && { displayText }) }),
                signal: controller.signal
            })
            if (!res.ok) {
                let msg = 'AI javob bera olmadi. Qayta urinib ko\'ring.'
                try { const j = await res.json(); if (j?.error) msg = j.error } catch { }
                throw new Error(msg)
            }
            const reader = res.body?.getReader()
            const decoder = new TextDecoder()
            let fullText = ''
            let thinkBuf = ''
            if (reader) {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    const chunk = decoder.decode(value, { stream: true })
                    for (const line of chunk.split('\n')) {
                        if (line.startsWith('data: ')) {
                            try {
                                const d = JSON.parse(line.slice(6))
                                if (d.error) {
                                    setMessages(prev => {
                                        const filtered = prev.filter(m => m.id !== 'temp-u')
                                        return [...filtered,
                                        { id: 'u-' + Date.now(), role: 'user', content: shown, createdAt: new Date().toISOString() },
                                        { id: 'err-' + Date.now(), role: 'assistant', content: `⚠️ ${d.error}`, createdAt: new Date().toISOString() }
                                        ]
                                    })
                                    setStreaming(''); setThinkingText('')
                                    break
                                }
                                if (d.thinking) { thinkBuf += d.thinking; setThinkingText(thinkBuf) }
                                if (d.content) { fullText += d.content; setStreaming(fullText) }
                                if (d.done) {
                                    setMessages(prev => {
                                        const filtered = prev.filter(m => m.id !== 'temp-u')
                                        return [...filtered,
                                        { id: 'u-' + Date.now(), role: 'user', content: shown, createdAt: new Date().toISOString() },
                                        { id: d.id || 'a-' + Date.now(), role: 'assistant', content: fullText, createdAt: new Date().toISOString() }
                                        ]
                                    })
                                    setStreaming(''); setThinkingText(''); loadChats()
                                    // Test avtomatik ochish
                                    const testMatch = fullText.match(/```test\n([\s\S]*?)```/)
                                    if (testMatch) {
                                        try {
                                            JSON.parse(testMatch[1].trim())
                                            setTimeout(() => openTestPanel(testMatch[1].trim()), 400)
                                        } catch { }
                                    }
                                }
                            } catch { }
                        }
                    }
                }
            }
        } catch (err: any) {
            if (err?.name === 'AbortError') {
                // User stopped — keep partial
                if (streaming) {
                    setMessages(prev => {
                        const filtered = prev.filter(m => m.id !== 'temp-u')
                        return [...filtered,
                        { id: 'u-' + Date.now(), role: 'user', content: shown, createdAt: new Date().toISOString() },
                        { id: 'a-' + Date.now(), role: 'assistant', content: streaming + '\n\n*[To\'xtatildi]*', createdAt: new Date().toISOString() }
                        ]
                    })
                }
            } else {
                const errText = `⚠️ ${err?.message || 'AI javob bera olmadi. Qayta urinib ko\'ring.'}`
                setMessages(prev => {
                    const filtered = prev.filter(m => m.id !== 'temp-u')
                    return [...filtered,
                    { id: 'u-' + Date.now(), role: 'user', content: shown, createdAt: new Date().toISOString() },
                    { id: 'err-' + Date.now(), role: 'assistant', content: errText, createdAt: new Date().toISOString() }
                    ]
                })
            }
            setStreaming(''); setThinkingText('')
        }
        setLoading(false); setInput(''); abortRef.current = null
    }

    function stopGeneration() {
        abortRef.current?.abort()
        abortRef.current = null
    }

    async function sendMessage(e: React.FormEvent) {
        e.preventDefault()
        if ((!input.trim() && attachedFiles.length === 0) || !chatId || loading) return
        setInput('')
        logActivity(5) // Har xabar uchun +5 XP
        if (attachedFiles.length > 0) {
            const userInput = input.trim()
            let promptText = ''
            let displayText = ''

            attachedFiles.forEach(file => {
                promptText += `📎 **${file.name}** faylidan:\n\n${file.text}\n\n`
                if (file.previewUrl) {
                    displayText += `![${file.name}](${file.previewUrl}) `
                } else {
                    displayText += `📎 **${file.name}** `
                }
            })

            if (userInput) {
                promptText += `\n\n${userInput}`
                displayText += `\n\n${userInput}`
            }

            setAttachedFiles([])
            setMessages(prev => [...prev, { id: 'temp-u', role: 'user', content: displayText.trim(), createdAt: new Date().toISOString() }])
            await streamToChat(chatId, promptText.trim(), displayText.trim())
        } else {
            const text = input.trim() || ''
            setMessages(prev => [...prev, { id: 'temp-u', role: 'user', content: text, createdAt: new Date().toISOString() }])
            await streamToChat(chatId, text)
        }
    }

    async function quickAction(prompt: string) {
        if (!chatId || loading) return
        setMessages(prev => [...prev, { id: 'temp-u', role: 'user', content: prompt, createdAt: new Date().toISOString() }])
        await streamToChat(chatId, prompt)
    }

    async function deleteChat(id: string, e: React.MouseEvent) {
        e.stopPropagation()
        try {
            await fetchApi(`/chat/${id}`, { method: 'DELETE' })
            if (chatId === id) { nav('/suhbat'); setMessages([]); setCurrentChat(null) }
            loadChats()
        } catch { }
    }

    // Days until exam
    const daysLeft = profile?.examDate ? Math.max(0, Math.ceil((new Date(profile.examDate).getTime() - Date.now()) / 86400000)) : null

    function markTestCompleted(testId: string) {
        completedTestIdsRef.current.add(testId)
        try { localStorage.setItem('msert_done_tests', JSON.stringify([...completedTestIdsRef.current])) } catch { }
    }

    function markAiTestCompleted(key: string) {
        completedAiTestsRef.current.add(key)
        try { localStorage.setItem('msert_done_ai_tests', JSON.stringify([...completedAiTestsRef.current])) } catch { }
    }

    // AI taklif qilgan profil yangilashni tasdiqlash
    const handleProfileUpdate = useCallback(async (data: { weakTopics?: string[]; strongTopics?: string[] }) => {
        try {
            await fetchApi('/profile', { method: 'PUT', body: JSON.stringify(data) })
            await loadProfile()
            // AI ga xabar ber — profil yangilandi deb
            if (chatId) {
                const notice = '✅ Profil yangilandi'
                setMessages(prev => [...prev, { id: 'sys-' + Date.now(), role: 'user', content: notice, createdAt: new Date().toISOString() }])
                streamToChat(chatId, 'O\'quvchi profil yangilashni tasdiqladi. Yangi mavzular ro\'yxati: ' + JSON.stringify(data) + '. Buni e\'tirof etib davom et.', notice)
            }
        } catch { }
    }, [chatId])

    // Open test in side panel
    const openTestPanel = useCallback((jsonStr: string) => {
        const aiKey = jsonStr.substring(0, 120)
        setRaschFeedback(null)
        setTestTimeLeft(null)
        if (completedAiTestsRef.current.has(aiKey)) {
            // Allaqachon yechilgan — saqlangan javoblar bilan ko'rish rejimi
            let savedAnswers: Record<number, string> = {}
            try { savedAnswers = JSON.parse(localStorage.getItem('msert_ans_' + aiKey) || '{}') } catch { }
            setTestPanel(jsonStr)
            setTestAnswers(savedAnswers)
            setTestSubmitted(true)
            setTestReadOnly(true)
            setTestPanelMaximized(false)
            return
        }
        setTestPanel(jsonStr)
        setTestAnswers({})
        setTestSubmitted(false)
        setTestPanelMaximized(false)
        setTestReadOnly(false)
    }, [])

    // Flashcard panelni ochish
    const openFlashPanel = useCallback((jsonStr: string) => {
        try {
            const cards = JSON.parse(jsonStr)
            if (!Array.isArray(cards) || cards.length === 0) return
            setTestPanel(null) // testni yopamiz
            setFlashPanel(cards)
            setFlashIdx(0)
            setFlashFlipped(false)
            setFlashIsReview(false) // AI chatdan kelgan — review rejimi emas
            // DB ga saqlaymiz — Kartochkalar tabida ko'rinishi uchun (background)
            const subj = profileRef.current?.subject || 'Umumiy'
            fetchApi('/flashcards', {
                method: 'POST',
                body: JSON.stringify({ subject: subj, cards: cards.map((c: any) => ({ front: String(c.front || ''), back: String(c.back || '') })) })
            }).then(() => loadDueFlashcards()).catch(() => { })
        } catch { }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Public test ochish (sidebar dan)
    async function openPublicTest(t: any) {
        setLoadingPublicTest(true)
        try {
            const data = await fetchApi(`/tests/by-link/${t.shareLink}`)
            const rawQuestions = data.questions || []
            // correctIdx submit qaytarmaguncha ko'rsatilmaydi — default 'a' (submit keyin yangilanadi)
            const converted = rawQuestions.map((q: any) => {
                const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
                return {
                    id: q.id,
                    q: q.text,
                    a: opts[0] || '', b: opts[1] || '', c: opts[2] || '', d: opts[3] || '',
                    correct: 'a' // placeholder — submit dan keyin correctAnswers bilan yangilanadi
                }
            })
            setActiveTestId(t.id)
            setActiveTestQuestions(rawQuestions)
            if (completedTestIdsRef.current.has(t.id)) {
                // Avval yechilgan — faqat ko'rish rejimi
                setTestPanel(JSON.stringify(converted))
                setTestAnswers({})
                setTestSubmitted(true)
                setTestReadOnly(true)
                setTestPanelMaximized(false)
                setRaschFeedback(null)
                setTestTimeLeft(null)
            } else {
                openTestPanel(JSON.stringify(converted))
                // Vaqt chegarasi bo'lsa timerni boshlash
                if (data.timeLimit) {
                    setTestTimeLeft(data.timeLimit * 60)
                }
            }
        } catch { }
        setLoadingPublicTest(false)
    }

    async function uploadFiles(filesToUpload: File[]) {
        if (!chatId) return
        setUploadingFile(true)
        try {
            const token = localStorage.getItem('token')
            // Barcha fayllarni bir vaqtda (parallel) yuklaymiz
            const newAttachments = await Promise.all(filesToUpload.map(async (file) => {
                const formData = new FormData()
                formData.append('file', file)
                const res = await fetch(`/api/chat/${chatId}/upload-file`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData
                })
                const data = await res.json()
                const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
                return { id: Math.random().toString(), name: file.name, text: data.text, type: data.fileType, previewUrl }
            }))
            setAttachedFiles(prev => [...prev, ...newAttachments])
        } catch (e: any) {
            alert('Fayl yuklashda xato: ' + (e?.message || 'Qayta urinib ko\'ring'))
        }
        setUploadingFile(false)
    }

    async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files || [])
        if (!files.length) return
        if (attachedFiles.length + files.length > 5) {
            alert("Kechirasiz, birdaniga eng ko'pi bilan 5 ta rasm/fayl yuborishingiz mumkin!")
            if (fileInputRef.current) fileInputRef.current.value = ''
            return
        }
        await uploadFiles(files)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    async function handlePaste(e: React.ClipboardEvent) {
        if (!chatId || loading || uploadingFile) return
        const items = Array.from(e.clipboardData.items)
        const imageItems = items.filter(item => item.type.startsWith('image/'))
        if (!imageItems.length) return
        e.preventDefault()

        const filesToUpload: File[] = []
        for (const item of imageItems) {
            const file = item.getAsFile()
            if (file) {
                filesToUpload.push(new File([file], `screenshot-${Date.now()}-${Math.floor(Math.random() * 1000)}.png`, { type: file.type }))
            }
        }

        if (attachedFiles.length + filesToUpload.length > 5) {
            alert("Kechirasiz, birdaniga eng ko'pi bilan 5 ta rasm/fayl yuborishingiz mumkin!")
            return
        }

        await uploadFiles(filesToUpload)
    }

    function submitTestPanel() {
        if (!testPanel) return
        let questions: any[] = []
        try { questions = JSON.parse(testPanel) } catch { return }
        setTestSubmitted(true)
        const results = questions.map((q: any, i: number) => {
            const correct = testAnswers[i] === q.correct
            return `${i + 1}. ${q.q} — Javob: ${(testAnswers[i] || '?').toUpperCase()}) ${correct ? '✅ to\'g\'ri' : '❌ xato (to\'g\'ri: ' + q.correct.toUpperCase() + ')'}`
        }).join('\n')
        const score = questions.filter((q: any, i: number) => testAnswers[i] === q.correct).length

        // Mavzu statistikasini yangilash + XP qo'shish
        const testSubject = currentChat?.subject || profile?.subject || 'Umumiy'
        fetchApi('/progress/topic', {
            method: 'POST',
            body: JSON.stringify({
                subject: testSubject,
                topic: currentChat?.title?.split(' ').slice(0, 4).join(' ') || 'Umumiy',
                correct: score,
                total: questions.length
            })
        }).then(() => loadProgress()).catch(() => { })
        logActivity(20) // Test uchun +20 XP
        const summary = `--- YANGI TEST NATIJASI (bu mustaqil test) ---\nJami savol: ${questions.length}\nTo'g'ri javoblar: ${score}/${questions.length}\n\n${results}\n\nFaqat shu ${questions.length} ta savol bo'yicha tahlil qil va qaysi mavzularni qayta o'rganishim kerakligini ayt. Oldingi testlar bilan aralashma.`
        const displayMsg = `📊 Test natijasi: ${score}/${questions.length} — AI tahlil qilmoqda...`

        if (chatId) {
            // Chat allaqachon ochiq — to'g'ridan-to'g'ri yubor
            setTimeout(() => {
                setMessages(prev => [...prev, { id: 'temp-u', role: 'user', content: displayMsg, createdAt: new Date().toISOString() }])
                streamToChat(chatId, summary, displayMsg)
            }, 500)
        } else {
            // Chat yo'q — yangi chat ochib, o'sha yerga yubor
            setTimeout(async () => {
                try {
                    const data = await fetchApi('/chat/new', { method: 'POST', body: JSON.stringify({ title: 'Test tahlili', subject: profile?.subject }) })
                    await loadChats()
                    nav(`/suhbat/${data.id}`)
                    setTimeout(() => {
                        setMessages([{ id: 'temp-u', role: 'user', content: displayMsg, createdAt: new Date().toISOString() }])
                        streamToChat(data.id, summary, displayMsg)
                    }, 300)
                } catch { }
            }, 500)
        }
        // Public test bo'lsa backendga ham yuborish (Rasch tracking)
        if (activeTestId && activeTestQuestions.length > 0) {
            const backendAnswers = activeTestQuestions.map((q: any, i: number) => ({
                questionId: q.id,
                selectedIdx: ['a', 'b', 'c', 'd'].indexOf(testAnswers[i] || '')
            })).filter((a: any) => a.selectedIdx !== -1)
            fetchApi(`/tests/${activeTestId}/submit`, { method: 'POST', body: JSON.stringify({ answers: backendAnswers }) })
                .then((res: any) => {
                    if (res?.newAbility !== undefined) {
                        const prevAbility = profile?.abilityLevel ?? 0
                        setRaschFeedback({ prev: prevAbility, next: res.newAbility })
                        loadProfile()
                        loadMyResults()
                    }
                    // Submit dan keyin to'g'ri javoblarni ko'rsatish
                    if (res?.correctAnswers) {
                        setTestPanel(prev => {
                            if (!prev) return prev
                            try {
                                const qs = JSON.parse(prev)
                                const updated = qs.map((q: any) => {
                                    const ca = res.correctAnswers.find((c: any) => c.id === q.id)
                                    return ca ? { ...q, correct: (['a', 'b', 'c', 'd'] as const)[ca.correctIdx] ?? 'a' } : q
                                })
                                return JSON.stringify(updated)
                            } catch { return prev }
                        })
                    }
                })
                .catch(() => { })
            markTestCompleted(activeTestId)
        } else if (testPanel) {
            // AI tomonidan yaratilgan test — javoblarni va yechilgan holatni saqlash
            const aiKey = testPanel.substring(0, 120)
            markAiTestCompleted(aiKey)
            try { localStorage.setItem('msert_ans_' + aiKey, JSON.stringify(testAnswers)) } catch { }
            // AI test natijasini Rasch ga yuborish
            const scorePercent = (score / questions.length) * 100
            const raschResults = questions.map((q: any, i: number) => ({
                difficulty: 0.0,
                isCorrect: testAnswers[i] === q.correct
            }))
            fetchApi('/tests/submit-ai', {
                method: 'POST',
                body: JSON.stringify({ score: scorePercent, totalQuestions: questions.length, results: raschResults })
            }).then(() => { loadProfile(); loadMyResults() }).catch(() => { })
        }
    }

    // Onboarding
    if (showOnboarding) {
        return (
            <div className="h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-page)' }}>
                <div className="w-full max-w-lg anim-up">
                    <div className="text-center mb-8">
                        <div className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--brand)' }}>
                            <GraduationCap className="h-7 w-7 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold">{profile?.onboardingDone ? 'Profilni tahrirlash' : 'Keling tanishamiz!'}</h1>
                        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Bu ma'lumotlar AI ustozingiz samarali ishlashi uchun kerak</p>
                    </div>
                    <form onSubmit={saveOnboarding} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div><label className="text-sm font-medium block mb-1.5">Qaysi fandan tayyorlanasiz?</label>
                            <select value={onboardingForm.subject} onChange={e => setOnboardingForm({ ...onboardingForm, subject: e.target.value })} className="input" style={{ cursor: 'pointer' }}>
                                {['Matematika', 'Fizika', 'Kimyo', 'Biologiya', 'Ona tili', 'Ingliz tili', 'Tarix', 'Geografiya'].map(f => <option key={f} value={f}>{f}</option>)}
                            </select></div>
                        <div><label className="text-sm font-medium block mb-1.5">Imtihon sanasi</label>
                            <input type="date" value={onboardingForm.examDate} onChange={e => setOnboardingForm({ ...onboardingForm, examDate: e.target.value })} className="input" /></div>
                        <div><label className="text-sm font-medium block mb-1.5">Maqsad ball (0-100)</label>
                            <input type="number" min="0" max="100" value={onboardingForm.targetScore} onChange={e => setOnboardingForm({ ...onboardingForm, targetScore: parseInt(e.target.value) || 0 })} className="input" /></div>
                        <div><label className="text-sm font-medium block mb-1.5">Qiyin mavzular <span style={{ color: 'var(--text-muted)' }}>(vergul bilan)</span></label>
                            <input placeholder="masalan: trigonometriya, integrallar" value={onboardingForm.weakTopics} onChange={e => setOnboardingForm({ ...onboardingForm, weakTopics: e.target.value })} className="input" /></div>
                        <div><label className="text-sm font-medium block mb-1.5">Kuchli mavzular</label>
                            <input placeholder="masalan: algebra, geometriya" value={onboardingForm.strongTopics} onChange={e => setOnboardingForm({ ...onboardingForm, strongTopics: e.target.value })} className="input" /></div>
                        <div><label className="text-sm font-medium block mb-1.5">Nima tashvishlantiradi?</label>
                            <input placeholder="masalan: formulalarni eslab qolish" value={onboardingForm.concerns} onChange={e => setOnboardingForm({ ...onboardingForm, concerns: e.target.value })} className="input" /></div>
                        <div className="flex gap-3 pt-1">
                            <button type="submit" disabled={savingProfile} className="btn btn-primary" style={{ flex: 1 }}>{savingProfile ? 'Saqlanmoqda...' : 'Saqlash'}</button>
                            <button type="button" onClick={() => setShowOnboarding(false)} className="btn btn-outline">Bekor</button>
                        </div>
                    </form>
                </div>
            </div>
        )
    }

    return (
        <div className="h-screen flex overflow-hidden" style={{ background: 'var(--bg-page)' }}>
            {/* Mobile backdrop */}
            {sideOpen && isMobile && (
                <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSideOpen(false)} />
            )}
            {/* Sidebar */}
            <div
                style={{
                    width: sideOpen ? (isMobile ? '280px' : `${sidebarWidth}px`) : '0px',
                    minWidth: sideOpen ? (isMobile ? '280px' : `${sidebarWidth}px`) : '0px',
                    background: 'var(--bg-surface)',
                    borderRight: '1px solid var(--border)',
                    ...(isMobile && sideOpen ? { position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50 } : {})
                }}
                className={`flex flex-col ${isSidebarDragging ? '' : 'transition-all duration-200'} overflow-hidden flex-shrink-0 relative`}
            >
                <div className="p-3 flex items-center justify-between h-14 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand)' }}>
                            <BrainCircuit className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className="text-sm font-bold whitespace-nowrap">msert</span>
                    </div>
                    <button onClick={() => setSideOpen(false)} className="h-7 w-7 flex items-center justify-center rounded-lg transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-muted)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}><X className="h-4 w-4" /></button>
                </div>

                {/* Side tabs — 5 ta ikonka qator */}
                <div className="flex mx-3 mb-2 mt-2 p-0.5 rounded-lg flex-shrink-0" style={{ background: 'var(--bg-muted)' }}>
                    {[
                        { k: 'chats' as const, l: 'Suhbat', Icon: MessageSquare },
                        { k: 'tests' as const, l: 'Testlar', Icon: ClipboardList },
                        { k: 'progress' as const, l: 'Natija', Icon: TrendingUp },
                        { k: 'flashcards' as const, l: 'Karta', Icon: Brain },
                        { k: 'settings' as const, l: 'Sozlama', Icon: Settings },
                    ].map(t => (
                        <button key={t.k} onClick={() => setSideTab(t.k)}
                            className="flex-1 py-1.5 text-xs font-medium rounded-md transition flex flex-col items-center gap-0.5"
                            style={sideTab === t.k ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : { color: 'var(--text-secondary)' }}
                            title={t.l}
                        >
                            <t.Icon className="h-4 w-4" />
                            <span className="text-[10px]">{t.l}</span>
                        </button>
                    ))}
                </div>

                {sideTab === 'chats' && (
                    <>
                        <div className="px-3 mb-2">
                            <button onClick={createChat} disabled={creating}
                                className="w-full h-9 flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                                style={{ border: '1.5px solid var(--border-strong)', color: 'var(--text-secondary)', background: 'transparent' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                <Plus className="h-3.5 w-3.5" /> Yangi suhbat
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
                            {chats.map(c => (
                                <div key={c.id}
                                    className="group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-[13px] transition-colors"
                                    style={chatId === c.id ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' } : { color: 'var(--text-secondary)' }}
                                    onMouseEnter={e => { if (chatId !== c.id) e.currentTarget.style.background = 'var(--bg-muted)' }}
                                    onMouseLeave={e => { if (chatId !== c.id) e.currentTarget.style.background = 'transparent' }}
                                    onClick={() => nav(`/suhbat/${c.id}`)}>
                                    <span className="flex-1 truncate">{c.title}</span>
                                    <button onClick={(e) => deleteChat(c.id, e)} className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}><Trash2 className="h-3 w-3" /></button>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {sideTab === 'tests' && (
                    <div className="flex-1 overflow-y-auto px-2 space-y-1">
                        {/* O'qituvchi testlari */}
                        {publicTests.length > 0 && (
                            <p className="text-[11px] font-semibold uppercase px-1 mb-2 mt-1" style={{ color: 'var(--text-muted)' }}>O'qituvchi testlari</p>
                        )}
                        {publicTests.length === 0 && <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>Hozircha testlar yo'q</p>}
                        {loadingPublicTest && (
                            <div className="flex justify-center py-4">
                                <div className="h-4 w-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
                            </div>
                        )}
                        {publicTests.map((t: any) => (
                            <div key={t.id} onClick={() => openPublicTest(t)}
                                className="card card-hover p-3 cursor-pointer">
                                <p className="text-[13px] font-medium truncate">{t.title}</p>
                                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{t._count?.questions || 0} savol · {t.creator?.name} · {t.subject}</p>
                            </div>
                        ))}
                        {/* AI testlarim tarixi (localStorage dan) */}
                        {(() => {
                            let aiKeys: string[] = []
                            try { aiKeys = JSON.parse(localStorage.getItem('msert_done_ai_tests') || '[]') } catch { }
                            if (aiKeys.length === 0) return null
                            return (
                                <div className="mt-3">
                                    <p className="text-[11px] font-semibold uppercase px-1 mb-2" style={{ color: 'var(--text-muted)' }}>AI testlarim ({aiKeys.length})</p>
                                    {aiKeys.map((_key, i) => (
                                        <div key={i} className="card p-3 mb-1.5" style={{ opacity: 0.7 }}>
                                            <div className="flex items-center gap-2">
                                                <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--success)' }} />
                                                <p className="text-[12px] font-medium truncate">AI test #{i + 1}</p>
                                            </div>
                                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Yechilgan · natija saqlangan</p>
                                        </div>
                                    ))}
                                </div>
                            )
                        })()}
                    </div>
                )}

                {sideTab === 'progress' && (
                    <div className="flex-1 overflow-y-auto px-3 space-y-3">
                        {/* Streak va XP (API dan) */}
                        {progressData && (
                            <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-xl p-3 text-center text-white" style={{ background: 'linear-gradient(135deg, #F59E0B, #F97316)' }}>
                                    <div className="flex items-center justify-center gap-1.5 mb-0.5">
                                        <Flame className="h-5 w-5" />
                                        <p className="text-2xl font-bold leading-none">{progressData.streak}</p>
                                    </div>
                                    <p className="text-[10px] opacity-80 mt-1">kun ketma-ket</p>
                                </div>
                                <div className="rounded-xl p-3 text-center text-white" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                                    <div className="flex items-center justify-center gap-1.5 mb-0.5">
                                        <Zap className="h-5 w-5" />
                                        <p className="text-2xl font-bold leading-none">{progressData.xp}</p>
                                    </div>
                                    <p className="text-[10px] opacity-80 mt-1">XP ball</p>
                                </div>
                            </div>
                        )}
                        {/* Haftalik faollik grafik */}
                        {progressData?.weeklyActivity && (
                            <div className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                <p className="text-[11px] font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Haftalik faollik</p>
                                <div className="flex items-end gap-1 h-12">
                                    {progressData.weeklyActivity.map((d, i) => {
                                        const maxCount = Math.max(...progressData.weeklyActivity.map(x => x.count), 1)
                                        const h = d.count > 0 ? Math.max(6, Math.round((d.count / maxCount) * 44)) : 4
                                        return (
                                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                                <div className="w-full rounded-t-sm transition-all duration-300"
                                                    style={{ height: `${h}px`, background: d.count > 0 ? 'var(--brand)' : 'var(--bg-muted)' }} />
                                                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{d.day}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                        {/* Ball prognozi */}
                        {progressData && progressData.avgScore > 0 && (
                            <div className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                <p className="text-[11px] font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Ball prognozi</p>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1">
                                        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-muted)' }}>
                                            <div className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${progressData.avgScore}%`, background: progressData.avgScore >= 70 ? '#10B981' : progressData.avgScore >= 50 ? '#F59E0B' : '#EF4444' }} />
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold tabular-nums" style={{ color: progressData.avgScore >= 70 ? '#10B981' : progressData.avgScore >= 50 ? '#F59E0B' : '#EF4444' }}>
                                        ~{progressData.avgScore}%
                                    </span>
                                </div>
                                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>So'nggi testlar o'rtachasi asosida</p>
                            </div>
                        )}
                        {/* Exam countdown */}
                        {daysLeft !== null && (
                            <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl p-4 text-white">
                                <p className="text-[11px] opacity-80 mb-1">Imtihongacha</p>
                                <p className="text-3xl font-bold tabular-nums">{daysLeft} <span className="text-sm font-normal opacity-80">kun</span></p>
                                <p className="text-[11px] opacity-70 mt-1">{profile?.subject} · Maqsad: {profile?.targetScore} ball</p>
                            </div>
                        )}
                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                <MessageSquare className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                                <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{chats.length}</p>
                                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Suhbatlar</p>
                            </div>
                            <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                <Target className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                                <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{profile?.targetScore || 0}</p>
                                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Maqsad ball</p>
                            </div>
                        </div>
                        {/* Weak/Strong topics */}
                        {profile?.weakTopics && (
                            <div className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                <p className="text-[11px] font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Qiyin mavzular</p>
                                <div className="flex flex-wrap gap-1">
                                    {JSON.parse(profile.weakTopics).map((t: string, i: number) => (
                                        <span key={i} className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>{t}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {profile?.strongTopics && (
                            <div className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                <p className="text-[11px] font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Kuchli mavzular</p>
                                <div className="flex flex-wrap gap-1">
                                    {JSON.parse(profile.strongTopics).map((t: string, i: number) => (
                                        <span key={i} className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>{t}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* Test statistikasi */}
                        {(() => {
                            const abilityLevel = profile?.abilityLevel ?? 0
                            const abilityPct = Math.round(((abilityLevel + 3) / 6) * 100)
                            const abilityLabel = abilityLevel >= 1.5 ? 'Yuqori' : abilityLevel >= 0 ? "O'rta" : abilityLevel >= -1.5 ? 'Past' : 'Juda past'
                            const abilityColor = abilityLevel >= 1.5 ? 'from-emerald-500 to-teal-400' : abilityLevel >= 0 ? 'from-blue-500 to-cyan-400' : abilityLevel >= -1.5 ? 'from-amber-400 to-orange-400' : 'from-red-400 to-rose-400'
                            return (
                                <>
                                    {/* Bilim darajasi (Rasch) */}
                                    <div className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[11px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Bilim darajasi</p>
                                            <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{abilityLabel}</span>
                                        </div>
                                        <div className="h-2.5 rounded-full overflow-hidden mb-1" style={{ background: 'var(--bg-muted)' }}>
                                            <div className={`h-full rounded-full bg-gradient-to-r ${abilityColor} transition-all duration-500`} style={{ width: `${abilityPct}%` }} />
                                        </div>
                                        <p className="text-[10px] text-right" style={{ color: 'var(--text-muted)' }}>{abilityPct}% · Rasch modeli</p>
                                    </div>
                                    {/* Testlar statistikasi */}
                                    {(profile?.totalTests || 0) > 0 && (
                                        <div className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                            <p className="text-[11px] font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Testlar natijasi</p>
                                            <div className="grid grid-cols-2 gap-2 mb-3">
                                                <div className="rounded-lg p-2 text-center" style={{ background: 'var(--bg-surface)' }}>
                                                    <p className="text-base font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{profile?.totalTests || 0}</p>
                                                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Jami testlar</p>
                                                </div>
                                                <div className="rounded-lg p-2 text-center" style={{ background: 'var(--bg-surface)' }}>
                                                    <p className={`text-base font-bold tabular-nums ${(profile?.avgScore || 0) >= 70 ? 'text-emerald-600' : (profile?.avgScore || 0) >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{Math.round(profile?.avgScore || 0)}%</p>
                                                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>O'rtacha ball</p>
                                                </div>
                                            </div>
                                            {/* Score trend mini bar chart */}
                                            {myResults.length > 1 && (
                                                <div>
                                                    <p className="text-[10px] mb-1.5" style={{ color: 'var(--text-muted)' }}>So'nggi {Math.min(myResults.length, 8)} ta test trendi</p>
                                                    <div className="flex items-end gap-1 h-10">
                                                        {myResults.slice(0, 8).reverse().map((r: any, i: number) => {
                                                            const barH = Math.max(3, Math.round(r.score * 0.38))
                                                            const barColor = r.score >= 70 ? 'bg-emerald-400' : r.score >= 50 ? 'bg-amber-400' : 'bg-red-400'
                                                            return (
                                                                <div key={i} className="flex-1 flex items-end" title={`${r.test?.title || 'Test'}: ${Math.round(r.score)}%`}>
                                                                    <div className={`w-full rounded-sm ${barColor}`} style={{ height: `${barH}px` }} />
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {/* So'nggi testlar ro'yxati */}
                                    {myResults.length > 0 && (
                                        <div className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                            <p className="text-[11px] font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>So'nggi testlar</p>
                                            <div className="space-y-2">
                                                {myResults.slice(0, 5).map((r: any) => (
                                                    <div key={r.id} className="flex items-center gap-2">
                                                        <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${r.score >= 70 ? 'bg-emerald-400' : r.score >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} />
                                                        <span className="text-[12px] flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{r.test?.title || 'Test'}</span>
                                                        <span className={`text-[11px] font-semibold tabular-nums flex-shrink-0 ${r.score >= 70 ? 'text-emerald-600' : r.score >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{Math.round(r.score)}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )
                        })()}
                    </div>
                )}

                {/* Kartochkalar tab */}
                {sideTab === 'flashcards' && (
                    <div className="flex-1 overflow-y-auto px-3 space-y-3">
                        {/* Due count header */}
                        <div className="rounded-xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                            <p className="text-[11px] opacity-80 mb-1">Bugun takrorlash kerak</p>
                            <p className="text-3xl font-bold tabular-nums leading-none">{dueCount} <span className="text-sm font-normal opacity-80">ta</span></p>
                            <p className="text-[11px] opacity-70 mt-1">Jami: {totalFlashcards} ta kartochka</p>
                        </div>
                        {dueCount > 0 && (
                            <button onClick={() => {
                                setFlashPanel(dueFlashcards)
                                setFlashIdx(0)
                                setFlashFlipped(false)
                                setFlashIsReview(true)
                            }} className="btn btn-primary w-full h-10 text-sm flex items-center justify-center gap-2">
                                <Layers className="h-4 w-4" /> Takrorlashni boshlash
                            </button>
                        )}
                        {totalFlashcards === 0 && (
                            <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>Hali kartochkalar yo'q. Chatda AI dan kartochka so'rang.</p>
                        )}
                        {dueCount === 0 && totalFlashcards > 0 && (
                            <div className="rounded-xl p-4 text-center" style={{ background: 'var(--success-light)', border: '1px solid var(--success)' }}>
                                <p className="text-sm font-semibold flex items-center justify-center gap-1.5" style={{ color: 'var(--success)' }}><CheckCircle className="h-4 w-4" /> Bugungi takrorlash tugadi!</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Ertaga yana kartochkalar bo'ladi</p>
                            </div>
                        )}
                        {dueFlashcards.length > 0 && (
                            <div>
                                <p className="text-[11px] font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Kutayotgan kartochkalar</p>
                                <div className="space-y-1.5">
                                    {dueFlashcards.map((card, i) => (
                                        <div key={card.id} className="card card-hover p-3 cursor-pointer"
                                            onClick={() => {
                                                setFlashPanel(dueFlashcards.slice(i))
                                                setFlashIdx(0)
                                                setFlashFlipped(false)
                                                setFlashIsReview(true)
                                            }}>
                                            <p className="text-[12px] font-medium truncate">{card.front}</p>
                                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{card.subject}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Sozlamalar tab */}
                {sideTab === 'settings' && (
                    <div className="flex-1 overflow-y-auto px-3 space-y-3">
                        {/* Profil ma'lumotlari */}
                        <div className="card p-4">
                            <p className="text-[11px] font-semibold uppercase mb-3" style={{ color: 'var(--text-muted)' }}>Profil</p>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: 'var(--brand)' }}>{user?.name?.[0]?.toUpperCase()}</div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold truncate">{user?.name}</p>
                                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
                                </div>
                            </div>
                            {profile?.subject && <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>📚 Fan: <span className="font-medium">{profile.subject}</span></p>}
                            {profile?.examDate && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>📅 Sana: <span className="font-medium">{new Date(profile.examDate).toLocaleDateString('uz-UZ')}</span></p>}
                        </div>

                        {/* Interfeys */}
                        <div className="card p-4">
                            <p className="text-[11px] font-semibold uppercase mb-3" style={{ color: 'var(--text-muted)' }}>Ko'rinish</p>
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        {darkMode ? <Moon className="h-4 w-4" style={{ color: 'var(--brand)' }} /> : <Sun className="h-4 w-4" style={{ color: 'var(--brand)' }} />}
                                        <p className="text-sm font-medium">{darkMode ? "Qorong'i rejim" : "Yorug' rejim"}</p>
                                    </div>
                                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Mavzu almashtirish</p>
                                </div>
                                <button
                                    onClick={() => setDarkMode(!darkMode)}
                                    className="relative h-7 w-12 rounded-full transition-all duration-300 flex-shrink-0"
                                    style={{ background: darkMode ? 'var(--brand)' : 'var(--bg-muted)' }}
                                >
                                    <span className="absolute top-1 h-5 w-5 rounded-full transition-all duration-300" style={{ background: 'white', left: darkMode ? '26px' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                </button>
                            </div>
                        </div>

                        {/* Profilni tahrirlash */}
                        <button onClick={() => { setShowOnboarding(true); setSideTab('chats') }}
                            className="btn btn-outline w-full h-10 flex items-center justify-center gap-2 text-sm">
                            <Settings className="h-4 w-4" /> Profilni tahrirlash
                        </button>

                        {/* Chiqish */}
                        <button onClick={() => { logout(); nav('/') }}
                            className="w-full h-10 flex items-center justify-center gap-2 text-sm font-medium rounded-lg transition"
                            style={{ color: 'var(--danger)', border: '1px solid var(--danger-light)', background: 'transparent' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-light)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <LogOut className="h-4 w-4" /> Tizimdan chiqish
                        </button>
                    </div>
                )}

                {/* User footer (faqat settings tabida EMAS) */}
                {sideTab !== 'settings' && (
                    <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2.5 px-2 py-1.5">
                            <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0" style={{ background: 'var(--brand)' }}>{user?.name?.[0]?.toUpperCase()}</div>
                            <div className="flex-1 min-w-0"><p className="text-[13px] font-medium truncate">{user?.name}</p></div>
                            <button onClick={() => setDarkMode(!darkMode)} className="h-7 w-7 flex items-center justify-center rounded-lg transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title={darkMode ? 'Yorug rejim' : 'Qorong\'i rejim'}>
                                {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                            </button>
                            <button onClick={() => setSideTab('settings')} className="h-7 w-7 flex items-center justify-center rounded-lg transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Sozlamalar"><Settings className="h-3.5 w-3.5" /></button>
                        </div>
                    </div>
                )}
            </div>

            {/* Sidebar Resize Handle */}
            {sideOpen && (
                <div
                    onMouseDown={(e: React.MouseEvent) => { e.preventDefault(); sidebarDragRef.current = true; setIsSidebarDragging(true); document.body.style.cursor = 'col-resize' }}
                    className="w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500 transition-colors z-50 flex-shrink-0"
                />
            )}

            {/* Main */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <div className="h-14 flex items-center px-4 gap-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                    {/* ☰ doim ko'rinadi — sidebar toggle */}
                    <button onClick={() => setSideOpen(v => !v)} className="h-8 w-8 flex items-center justify-center rounded-lg transition flex-shrink-0" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Yonpanel"><Menu className="h-4 w-4" /></button>
                    <span className="text-sm font-medium truncate flex-1 min-w-0" style={{ color: 'var(--text-secondary)' }}>{currentChat?.title || ''}</span>
                    {/* Fan tanlash dropdown */}
                    {profile?.subject && (
                        <select
                            value={profile.subject}
                            onChange={async e => {
                                const newSubject = e.target.value
                                setProfile(p => p ? { ...p, subject: newSubject } : p)
                                profileRef.current = profileRef.current ? { ...profileRef.current, subject: newSubject } : null
                                await fetchApi('/profile', { method: 'PUT', body: JSON.stringify({ subject: newSubject }) }).catch(() => { })
                            }}
                            className="h-7 text-[12px] font-medium rounded-lg px-2 pr-6 flex-shrink-0 cursor-pointer transition"
                            style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', outline: 'none', maxWidth: '130px' }}
                        >
                            {['Matematika', 'Fizika', 'Kimyo', 'Biologiya', 'Ona tili', 'Ingliz tili', 'Tarix', 'Geografiya'].map(f => (
                                <option key={f} value={f}>{f}</option>
                            ))}
                        </select>
                    )}
                    {/* Dark mode toggle */}
                    <button onClick={() => setDarkMode(!darkMode)} className="h-8 w-8 flex items-center justify-center rounded-lg transition flex-shrink-0" style={{ color: 'var(--text-muted)' }} title={darkMode ? 'Yorug\' rejim' : 'Qorong\'i rejim'} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </button>
                    {/* 👤 Profile avatar — settings tabini ochadi */}
                    <button onClick={() => { setSideOpen(true); setSideTab('settings') }} className="h-8 w-8 rounded-full flex items-center justify-center text-[12px] font-semibold text-white flex-shrink-0 transition" style={{ background: 'var(--brand)' }} title={user?.name || 'Profil'}>
                        {user?.name?.[0]?.toUpperCase() || '?'}
                    </button>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
                    {(!chatId || (messages.length === 0 && !loading && !streaming)) ? (
                        <div className="h-full flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
                            <div className="max-w-2xl w-full px-6 anim-up">
                                <div className="text-center mb-10">
                                    <div className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: 'var(--brand)' }}><BrainCircuit className="h-7 w-7 text-white" /></div>
                                    <h2 className="text-2xl font-bold mb-2">Salom, {user?.name?.split(' ')[0]}! 👋</h2>
                                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Bugun nima o'rganmoqchisiz?</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { Icon: BookOpen, color: '#6366F1', title: 'Mavzu tushuntir', desc: 'Mavzuni boshidan tushuntirib ber', prompt: 'Menga bugungi mavzuni boshidan tushuntirib bering' },
                                        { Icon: ClipboardList, color: '#D97706', title: 'Bilimimni testla', desc: 'Test savollari bilan tekshir', prompt: 'Mening bilimimni test savollari bilan tekshiring' },
                                        { Icon: Target, color: '#0891B2', title: "O'quv reja tuz", desc: "Imtihongacha bo'lgan reja", prompt: "Imtihongacha bo'lgan kunlar uchun batafsil o'quv reja tuzing." },
                                        { Icon: Lightbulb, color: '#16A34A', title: 'Formula va qoidalar', desc: 'Asosiy formulalarni ko\'rsat', prompt: 'Bu fandagi eng muhim formulalar va qoidalarni ko\'rsating.' },
                                        { Icon: Search, color: '#DC2626', title: 'Zaif joylarimni aniqla', desc: 'Diagnostika qil', prompt: 'Mening bilim darajamni aniqlash uchun diagnostik savollar bering.' },
                                        { Icon: TrendingUp, color: '#7C3AED', title: 'Imtihon strategiya', desc: 'Vaqt taktikasi', prompt: 'Milliy sertifikat imtihonida vaqt boshqarish strategiyasini o\'rgating' },
                                    ].map((s, i) => (
                                        <button key={i} onClick={async () => {
                                            if (creating) return; setCreating(true)
                                            try {
                                                const data = await fetchApi('/chat/new', {
                                                    method: 'POST',
                                                    body: JSON.stringify({ title: s.title, subject: profile?.subject, forceNew: true })
                                                })
                                                await loadChats()
                                                nav(`/suhbat/${data.id}`)
                                                setTimeout(() => {
                                                    setMessages([{ id: 'temp-u', role: 'user', content: s.prompt, createdAt: new Date().toISOString() }])
                                                    streamToChat(data.id, s.prompt)
                                                }, 200)
                                            } catch { }
                                            setCreating(false)
                                        }}
                                            className="card card-hover text-left p-4">
                                            <div className="h-9 w-9 rounded-xl flex items-center justify-center mb-3" style={{ background: s.color + '18' }}>
                                                <s.Icon className="h-5 w-5" style={{ color: s.color }} />
                                            </div>
                                            <p className="text-sm font-bold mb-1">{s.title}</p>
                                            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{s.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">
                            {messages.map((m, i) => (
                                <div key={m.id || i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
                                    {m.role !== 'user' && (
                                        <div className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 text-white text-xs font-bold" style={{ background: 'var(--brand)' }}>AI</div>
                                    )}
                                    {m.role === 'user' ? (
                                        <div className="bubble-user">
                                            {m.content.includes('![') ? (
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex flex-wrap gap-2">
                                                        {Array.from(m.content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)).map((match, idx) => (
                                                            <img key={idx} src={match[1]} alt="" className="chat-img-thumb" style={{ border: '1.5px solid rgba(255,255,255,0.3)' }} />
                                                        ))}
                                                    </div>
                                                    {m.content.replace(/!\[[^\]]*\]\([^)]+\)/g, '').trim() && (
                                                        <p className="opacity-90 text-sm">{m.content.replace(/!\[[^\]]*\]\([^)]+\)/g, '').trim()}</p>
                                                    )}
                                                </div>
                                            ) : m.content}
                                        </div>
                                    ) : (
                                        <div className="bubble-ai"><MdMessage content={m.content} onOpenTest={openTestPanel} onProfileUpdate={handleProfileUpdate} onOpenFlash={openFlashPanel} /></div>
                                    )}
                                    {m.role === 'user' && (
                                        <div className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: 'var(--brand)' }}>{user?.name?.[0]?.toUpperCase() || 'S'}</div>
                                    )}
                                </div>
                            ))}
                            {/* Thinking process display */}
                            {thinkingText && (
                                <div className="flex gap-3 opacity-40">
                                    <div className="h-7 w-7 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5" style={{ background: 'var(--bg-muted)' }}><Lightbulb className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} /></div>
                                    <div className="flex-1">
                                        <details className="group">
                                            <summary className="text-[11px] cursor-pointer select-none mb-1" style={{ color: 'var(--text-muted)' }}>Fikrlash jarayoni <span className="group-open:hidden">(ko'rish)</span></summary>
                                            <div className="rounded-lg p-2.5 text-[11px] leading-relaxed whitespace-pre-wrap max-h-24 overflow-hidden mt-1" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>{thinkingText}</div>
                                        </details>
                                    </div>
                                </div>
                            )}
                            {streaming && (
                                <div className="flex gap-3">
                                    <div className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 text-white text-xs font-bold" style={{ background: 'var(--brand)' }}>AI</div>
                                    <div className="bubble-ai">
                                        <MdMessage content={streaming} onOpenTest={openTestPanel} isStreaming={true} onProfileUpdate={handleProfileUpdate} onOpenFlash={openFlashPanel} />
                                        {/```test/.test(streaming) && !/```test[\s\S]*?```/.test(streaming) && (
                                            <div className="mt-3 rounded-2xl overflow-hidden" style={{
                                                background: 'linear-gradient(135deg, rgba(224, 123, 57, 0.08), rgba(224, 123, 57, 0.04))',
                                                border: '1px solid rgba(224, 123, 57, 0.2)'
                                            }}>
                                                <div className="p-4">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 animate-pulse"
                                                            style={{ background: 'rgba(224, 123, 57, 0.15)' }}>
                                                            <svg className="h-4 w-4" style={{ color: 'var(--brand)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                            </svg>
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[13px] font-semibold" style={{ color: 'var(--brand)' }}>Test tayyorlanmoqda</span>
                                                                <span className="flex gap-0.5 items-center">
                                                                    {[0, 1, 2].map(i => (
                                                                        <span key={i} className="h-1 w-1 rounded-full" style={{
                                                                            background: 'var(--brand)',
                                                                            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`
                                                                        }} />
                                                                    ))}
                                                                </span>
                                                            </div>
                                                            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>AI savollarni shakllantirmoqda</span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2 pl-1">
                                                        {[80, 60, 70].map((w, i) => (
                                                            <div key={i} className="h-2 rounded-full animate-pulse" style={{
                                                                width: `${w}%`,
                                                                background: 'rgba(224, 123, 57, 0.15)',
                                                                animationDelay: `${i * 0.15}s`
                                                            }} />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {/```flashcard/.test(streaming) && !/```flashcard[\s\S]*?```/.test(streaming) && (
                                            <div className="mt-3 rounded-2xl overflow-hidden" style={{
                                                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(99, 102, 241, 0.04))',
                                                border: '1px solid rgba(99, 102, 241, 0.2)'
                                            }}>
                                                <div className="p-4">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 animate-pulse"
                                                            style={{ background: 'rgba(99, 102, 241, 0.15)' }}>
                                                            <svg className="h-4 w-4" style={{ color: '#6366f1' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                            </svg>
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[13px] font-semibold" style={{ color: '#6366f1' }}>Kartochkalar tayyorlanmoqda</span>
                                                                <span className="flex gap-0.5 items-center">
                                                                    {[0, 1, 2].map(i => (
                                                                        <span key={i} className="h-1 w-1 rounded-full" style={{
                                                                            background: '#6366f1',
                                                                            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`
                                                                        }} />
                                                                    ))}
                                                                </span>
                                                            </div>
                                                            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>AI kartochkalarni shakllantirmoqda</span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2 pl-1">
                                                        {[75, 90, 55].map((w, i) => (
                                                            <div key={i} className="h-2 rounded-full animate-pulse" style={{
                                                                width: `${w}%`,
                                                                background: 'rgba(99, 102, 241, 0.15)',
                                                                animationDelay: `${i * 0.15}s`
                                                            }} />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {loading && !streaming && !thinkingText && (
                                <div className="flex gap-3">
                                    <div className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ background: 'var(--brand)' }}>AI</div>
                                    <div className="typing-dots"><span /><span /><span /></div>
                                </div>
                            )}
                            {loading && thinkingText && !streaming && (
                                <div className="flex gap-3">
                                    <div className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ background: 'var(--brand)' }}>AI</div>
                                    <div className="text-[13px] py-3 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>Javob yozilmoqda...<span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--text-muted)' }} /></div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Input + Quick Actions */}
                {chatId && (
                    <div className="px-4 pb-5 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                        {/* Quick Actions */}
                        {!loading && messages.length > 0 && (
                            <div className="max-w-5xl mx-auto mb-2 flex gap-1.5 flex-wrap">
                                {[
                                    { Icon: ClipboardList, l: 'Testla', p: 'Meni shu mavzu bo\'yicha testlang. 5 ta test savol bering A, B, C, D variantlar bilan.' },
                                    { Icon: BookOpen, l: 'Davom et', p: 'Keyingi mavzuga o\'tamiz. Nimani o\'rganishimiz kerak?' },
                                    { Icon: RotateCcw, l: 'Qayta tushuntir', p: 'Bu mavzuni boshqa usulda, oddiyroq tushuntiring' },
                                    { Icon: Target, l: 'Reja tuz', p: 'Imtihongacha qolgan vaqtga mos o\'quv reja tuzing' },
                                    { Icon: Lightbulb, l: 'Formulalar', p: 'Shu mavzuning barcha muhim formulalarini yozing' },
                                    { Icon: Layers, l: 'Kartochkalar', p: 'Shu mavzuning eng muhim formulalari va tushunchalarini kartochka formatida bering (```flashcard JSON format).' },
                                ].map((a, i) => (
                                    <button key={i} onClick={() => quickAction(a.p)}
                                        className="h-7 px-3 text-[12px] font-medium rounded-full transition whitespace-nowrap flex items-center gap-1.5"
                                        style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-strong)', background: 'var(--bg-card)' }}
                                    ><a.Icon className="h-3 w-3 flex-shrink-0" />{a.l}</button>
                                ))}
                            </div>
                        )}
                        <form onSubmit={sendMessage} className="max-w-5xl mx-auto">
                            {/* Attached files preview */}
                            {attachedFiles.length > 0 && (
                                <div className="mb-2 flex flex-wrap gap-2 z-10 px-2 pb-1 relative">
                                    {attachedFiles.map(file => (
                                        <div key={file.id} className="relative rounded-xl p-1.5 w-[72px] h-[72px] flex flex-col items-center justify-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                            <button type="button" onClick={() => {
                                                if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
                                                setAttachedFiles(prev => prev.filter(f => f.id !== file.id));
                                            }} className="absolute -top-1.5 -right-1.5 rounded-full h-[22px] w-[22px] flex items-center justify-center shadow-sm z-10" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                                                <X className="h-3 w-3" />
                                            </button>

                                            {file.previewUrl ? (
                                                <img src={file.previewUrl} alt={file.name} title={file.name} className="w-full h-full object-cover rounded-[8px]" />
                                            ) : (
                                                <>
                                                    <FileText className="h-6 w-6 mb-1" style={{ color: 'var(--brand)' }} />
                                                    <span className="text-[10px] w-full truncate text-center px-1" style={{ color: 'var(--text-secondary)' }} title={file.name}>{file.name.substring(0, 8)}...</span>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex items-center gap-2 rounded-2xl px-4" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                                <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,image/*" className="hidden" onChange={handleFileSelect} />
                                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading || uploadingFile}
                                    className="h-8 w-8 flex items-center justify-center rounded-lg transition disabled:opacity-40"
                                    style={{ color: 'var(--text-muted)' }}
                                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                                    {uploadingFile
                                        ? <div className="h-4 w-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
                                        : <Paperclip className="h-3.5 w-3.5" />}
                                </button>
                                <input value={input} onChange={e => setInput(e.target.value)} onPaste={handlePaste}
                                    placeholder="Xabar yozing..." disabled={loading}
                                    className="flex-1 h-12 bg-transparent outline-none text-sm"
                                    style={{ color: 'var(--text-primary)' }} />
                                <button type="button" onClick={() => setThinkingMode(!thinkingMode)}
                                    title={thinkingMode ? 'Chuqur fikrlash yoqilgan' : 'Chuqur fikrlash'}
                                    className="h-8 w-8 flex items-center justify-center rounded-lg transition"
                                    style={thinkingMode ? { background: 'var(--brand-light)', color: 'var(--brand)' } : { color: 'var(--text-muted)' }}>
                                    <Lightbulb className="h-3.5 w-3.5" />
                                </button>
                                {loading ? (
                                    <button type="button" onClick={stopGeneration}
                                        className="h-8 w-8 flex items-center justify-center rounded-lg text-white animate-pulse"
                                        style={{ background: 'var(--danger)' }}>
                                        <Square className="h-3 w-3" />
                                    </button>
                                ) : (
                                    <button type="submit" disabled={!input.trim() && attachedFiles.length === 0}
                                        className="h-8 w-8 flex items-center justify-center rounded-lg text-white transition disabled:opacity-40"
                                        style={{ background: 'var(--text-primary)' }}>
                                        <Send className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                            <p className="text-[10px] mt-1 text-center select-none" style={{ color: 'var(--border-strong)' }}>AI xato qilishi mumkin — muhim ma'lumotlarni tekshirib ko'ring</p>
                        </form>
                    </div>
                )}
            </div>


            {/* Test Side Panel */}
            {
                testPanel && (() => {
                    let questions: any[] = []
                    try { questions = JSON.parse(testPanel) } catch { return null }
                    const answered = Object.keys(testAnswers).length
                    const score = testSubmitted ? questions.filter((q: any, i: number) => testAnswers[i] === q.correct).length : 0
                    return (
                        <div className={testPanelMaximized ? 'fixed inset-0 z-50 flex flex-col' : 'relative flex flex-col flex-shrink-0'}
                            style={testPanelMaximized ? { background: 'var(--bg-card)' } : { width: testWidth, background: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }}>

                            {/* Drag handle */}
                            {!testPanelMaximized && (
                                <div onMouseDown={e => { testDragRef.current = true; e.preventDefault() }}
                                    className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 transition-colors"
                                    style={{ background: 'transparent' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--brand-light)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'} />
                            )}

                            {/* Panel header */}
                            <div className="h-14 flex items-center justify-between px-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                                <div className="flex items-center gap-2">
                                    <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand)' }}><ClipboardList className="h-3.5 w-3.5 text-white" /></div>
                                    <span className="text-sm font-semibold">Test — {questions.length} savol</span>
                                    {testReadOnly && <span className="text-[10px] px-2 py-0.5 rounded-md font-medium" style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>Ko'rish</span>}
                                    {testTimeLeft !== null && (
                                        <span className={`text-sm font-mono tabular-nums ml-1 px-2 py-0.5 rounded-md ${testTimeLeft < 60 ? 'animate-pulse' : ''}`}
                                            style={testTimeLeft < 60 ? { color: 'var(--danger)', background: 'var(--danger-light)' } : { color: 'var(--text-secondary)', background: 'var(--bg-muted)' }}>
                                            ⏱ {Math.floor(testTimeLeft / 60)}:{String(testTimeLeft % 60).padStart(2, '0')}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setTestPanelMaximized(!testPanelMaximized)} className="h-7 w-7 flex items-center justify-center rounded-lg transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        {testPanelMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                    </button>
                                    <button onClick={() => { setTestPanel(null); setTestPanelMaximized(false); setActiveTestId(null); setActiveTestQuestions([]); setTestTimeLeft(null); setRaschFeedback(null) }} className="h-7 w-7 flex items-center justify-center rounded-lg transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><X className="h-4 w-4" /></button>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="h-1 progress-bar" style={{ borderRadius: 0 }}>
                                <div className="progress-bar-fill" style={{ width: testReadOnly ? '100%' : `${(answered / questions.length) * 100}%` }} />
                            </div>

                            {/* Questions */}
                            <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-5" style={{ background: 'var(--bg-page)' }}>
                                <div className={testPanelMaximized ? 'max-w-3xl mx-auto space-y-5' : 'space-y-5'}>
                                    {questions.map((q: any, i: number) => (
                                        <div key={i} className="card p-5">
                                            <p className="text-[14px] font-semibold mb-4 leading-relaxed">{i + 1}. <MathText text={q.q} /></p>
                                            <div className="space-y-2.5">
                                                {(['a', 'b', 'c', 'd'] as const).map(opt => {
                                                    const isSelected = testAnswers[i] === opt
                                                    const isCorrect = q.correct === opt
                                                    let sty: React.CSSProperties = {}
                                                    if (testSubmitted) {
                                                        if (isCorrect) sty = { borderColor: 'var(--success)', background: 'var(--success-light)', color: 'var(--success)', fontWeight: 600 }
                                                        else if (isSelected && !isCorrect) sty = { borderColor: 'var(--danger)', background: 'var(--danger-light)', color: 'var(--danger)' }
                                                        else sty = { borderColor: 'var(--border)', background: 'var(--bg-surface)', opacity: 0.6 }
                                                    } else {
                                                        sty = isSelected
                                                            ? { borderColor: 'var(--brand)', background: 'var(--brand-light)', color: 'var(--brand)', fontWeight: 600 }
                                                            : { borderColor: 'var(--border)', background: 'var(--bg-card)' }
                                                    }
                                                    return (
                                                        <button key={opt} disabled={testSubmitted}
                                                            onClick={() => setTestAnswers({ ...testAnswers, [i]: opt })}
                                                            className="w-full text-left px-4 py-3 rounded-xl text-[13px] border transition-all duration-200 outline-none"
                                                            style={sty}>
                                                            <span className="font-bold mr-2" style={{ opacity: 0.6 }}>{opt.toUpperCase()})</span> <MathText text={q[opt]} />
                                                            {testSubmitted && isCorrect && <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full text-xs" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>✓</span>}
                                                            {testSubmitted && isSelected && !isCorrect && <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full text-xs" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>✕</span>}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Submit / Results */}
                            <div className="p-5 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
                                <div className={testPanelMaximized ? 'max-w-3xl mx-auto' : ''}>
                                    {testReadOnly ? (
                                        <div className="text-center space-y-2">
                                            <div className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-semibold mb-1" style={{ background: 'var(--success-light)', color: 'var(--success)' }}><CheckCircle className="h-3.5 w-3.5" /> Bu test avval yechilgan</div>
                                            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>To'g'ri javoblar yashil bilan ko'rsatilmoqda</p>
                                            <button onClick={() => { setTestPanel(null); setTestPanelMaximized(false); setTestReadOnly(false); setActiveTestId(null); setActiveTestQuestions([]); setTestTimeLeft(null); setRaschFeedback(null) }} className="text-sm font-medium transition" style={{ color: 'var(--brand)' }}>Panelni yopish</button>
                                        </div>
                                    ) : !testSubmitted ? (
                                        <button onClick={submitTestPanel} disabled={answered < questions.length}
                                            className="btn btn-primary w-full h-12 flex items-center justify-center gap-2"
                                            style={{ opacity: answered < questions.length ? 0.5 : 1 }}>
                                            <Target className="h-4 w-4" /> Natijani ko'rish ({answered}/{questions.length})
                                        </button>
                                    ) : (
                                        <div className="text-center space-y-2">
                                            <p className="text-lg font-bold">{score}/{questions.length} <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>— {Math.round(score / questions.length * 100)}%</span></p>
                                            {raschFeedback && (
                                                <p className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--brand)' }}><TrendingUp className="h-3.5 w-3.5" /> Daraja: {raschFeedback.prev.toFixed(2)} → {raschFeedback.next.toFixed(2)}</p>
                                            )}
                                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Natijalar chatga yuborildi</p>
                                            <button onClick={() => { setTestPanel(null); setTestPanelMaximized(false); setTestReadOnly(false); setActiveTestId(null); setActiveTestQuestions([]); setTestTimeLeft(null); setRaschFeedback(null) }} className="text-sm font-medium transition" style={{ color: 'var(--brand)' }}>Panelni yopish</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })()
            }

            {/* Flashcard Panel */}
            {
                flashPanel && (() => {
                    const card = flashPanel[flashIdx]
                    return (
                        <div
                            className={flashMaximized ? 'fixed inset-0 z-50 flex flex-col' : 'relative flex flex-col flex-shrink-0'}
                            style={flashMaximized ? { background: 'var(--bg-card)' } : { width: flashWidth, background: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }}>

                            {/* Drag handle */}
                            {!flashMaximized && (
                                <div onMouseDown={e => { flashDragRef.current = true; e.preventDefault() }}
                                    className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 transition-colors"
                                    style={{ background: 'transparent' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--brand-light)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'} />
                            )}

                            {/* Header */}
                            <div className="h-14 flex items-center justify-between px-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5">
                                        <Layers className="h-4 w-4" style={{ color: 'var(--brand)' }} />
                                        <span className="text-sm font-semibold">Kartochkalar</span>
                                    </div>
                                    <span className="text-xs px-1.5 py-0.5 rounded-md" style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>{flashIdx + 1}/{flashPanel.length}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setFlashMaximized(!flashMaximized)}
                                        className="h-7 w-7 flex items-center justify-center rounded-lg transition"
                                        style={{ color: 'var(--text-muted)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        {flashMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                    </button>
                                    <button onClick={() => { setFlashPanel(null); setFlashMaximized(false); setFlashIsReview(false) }}
                                        className="h-7 w-7 flex items-center justify-center rounded-lg transition"
                                        style={{ color: 'var(--text-muted)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="h-1 progress-bar flex-shrink-0" style={{ borderRadius: 0 }}>
                                <div className="progress-bar-fill" style={{ width: `${((flashIdx + 1) / flashPanel.length) * 100}%` }} />
                            </div>

                            {/* Card flip area */}
                            <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-0 overflow-y-auto [perspective:1000px]" style={{ background: 'var(--bg-page)' }}>
                                <div className={flashMaximized ? 'w-full max-w-2xl' : 'w-full'}>
                                    <div onClick={() => setFlashFlipped(!flashFlipped)}
                                        className="relative cursor-pointer min-h-[250px] w-full [transform-style:preserve-3d] transition-transform duration-700"
                                        style={{ transform: flashFlipped ? 'rotateY(180deg)' : 'rotateY(0)' }}>

                                        {/* Front (Question) */}
                                        <div className="absolute inset-0 [backface-visibility:hidden] rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-xl"
                                            style={{ background: 'var(--brand-light)', border: '2px solid var(--bg-card)' }}>
                                            <div className="absolute top-4 left-0 right-0 flex justify-center">
                                                <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: 'rgba(79,70,229,0.12)', color: 'var(--brand)' }}>❓ Savol</span>
                                            </div>
                                            <div className="text-[15px] font-medium leading-relaxed w-full mt-2" style={{ color: 'var(--text-primary)' }}>
                                                <MdMessage content={card.front} onOpenTest={() => { }} onProfileUpdate={() => { }} onOpenFlash={() => { }} />
                                            </div>
                                            <p className="absolute bottom-5 text-[11px] font-semibold flex items-center gap-1 opacity-60" style={{ color: 'var(--brand)' }}>
                                                <RotateCcw className="h-3 w-3" /> Bosib javobni ko'ring
                                            </p>
                                        </div>

                                        {/* Back (Answer) */}
                                        <div className="absolute inset-0 [backface-visibility:hidden] rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-xl"
                                            style={{ transform: 'rotateY(180deg)', background: 'var(--bg-card)', border: '1px solid var(--success-light)' }}>
                                            <div className="absolute top-4 left-0 right-0 flex justify-center">
                                                <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1" style={{ background: 'var(--success-light)', color: 'var(--success)' }}><CheckCircle className="h-3 w-3" /> Javob</span>
                                            </div>
                                            <div className="text-[15px] leading-relaxed w-full mt-2" style={{ color: 'var(--text-primary)' }}>
                                                <MdMessage content={card.back} onOpenTest={() => { }} onProfileUpdate={() => { }} onOpenFlash={() => { }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Navigation */}
                            <div className={`p-5 flex gap-3 flex-shrink-0 ${flashMaximized ? 'max-w-2xl w-full mx-auto' : ''}`} style={{ borderTop: '1px solid var(--border)' }}>
                                {flashIsReview && card.id ? (
                                    <>
                                        <button onClick={() => {
                                            fetchApi(`/flashcards/${card.id}/review`, { method: 'POST', body: JSON.stringify({ quality: 1 }) }).catch(() => { })
                                            logActivity(3) // Flashcard ko'rish +3 XP
                                            if (flashIdx < flashPanel.length - 1) { setFlashIdx(flashIdx + 1); setFlashFlipped(false) }
                                            else { setFlashPanel(null); setFlashMaximized(false); setFlashIsReview(false); loadDueFlashcards(); loadProgress() }
                                        }} className="btn flex-1 h-12 flex items-center justify-center gap-1.5 font-semibold"
                                            style={{ border: '1.5px solid var(--danger)', color: 'var(--danger)', background: 'transparent' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-light)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            😕 Bilmadim
                                        </button>
                                        <button onClick={() => {
                                            fetchApi(`/flashcards/${card.id}/review`, { method: 'POST', body: JSON.stringify({ quality: 4 }) }).catch(() => { })
                                            logActivity(5) // Flashcard bildi +5 XP
                                            if (flashIdx < flashPanel.length - 1) { setFlashIdx(flashIdx + 1); setFlashFlipped(false) }
                                            else { setFlashPanel(null); setFlashMaximized(false); setFlashIsReview(false); loadDueFlashcards(); loadProgress() }
                                        }} className="btn btn-primary flex-1 h-12 flex items-center justify-center gap-1.5">
                                            😊 Bildim
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button disabled={flashIdx === 0}
                                            onClick={() => { setFlashIdx(flashIdx - 1); setFlashFlipped(false) }}
                                            className="btn btn-outline flex-1 h-12 flex items-center justify-center gap-1.5 disabled:opacity-40">
                                            <ChevronLeft className="h-4 w-4" /> Oldingi
                                        </button>
                                        <button onClick={() => {
                                            if (flashIdx < flashPanel.length - 1) { setFlashIdx(flashIdx + 1); setFlashFlipped(false) }
                                            else { setFlashPanel(null); setFlashMaximized(false) }
                                        }} className="btn btn-primary flex-1 h-12 flex items-center justify-center gap-1.5">
                                            {flashIdx < flashPanel.length - 1 ? <><span>Keyingi</span><ChevronRight className="h-4 w-4" /></> : 'Tugallash'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )
                })()
            }
        </div >
    )
}
