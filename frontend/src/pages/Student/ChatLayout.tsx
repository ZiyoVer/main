import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BrainCircuit, Plus, Trash2, LogOut, Send, Menu, X, GraduationCap, ClipboardList, Settings, BookOpen, Target, Flame, MessageSquare, FileText, Zap, Square, Lightbulb, Maximize2, Minimize2, Paperclip, Layers, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
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
        p: ({ children }) => <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
        em: ({ children }) => <em className="text-gray-600">{children}</em>,
        ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1.5">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        h1: ({ children }) => <h3 className="text-[15px] font-bold text-gray-900 mt-4 mb-2 pb-1 border-b border-gray-100">{children}</h3>,
        h2: ({ children }) => <h3 className="text-[15px] font-bold text-gray-900 mt-4 mb-2 pb-1 border-b border-gray-100">{children}</h3>,
        h3: ({ children }) => <h4 className="text-[14px] font-bold text-gray-900 mt-3 mb-1.5">{children}</h4>,
        table: ({ children }) => <div className="overflow-x-auto my-3"><table className="w-full text-[13px] border-collapse">{children}</table></div>,
        thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
        th: ({ children }) => <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">{children}</th>,
        td: ({ children }) => <td className="border border-gray-200 px-3 py-2 text-gray-700">{children}</td>,
        code: ({ children, className }: any) => {
            if (className?.includes('language-test')) {
                const jsonStr = String(children).trim()
                let qCount = 0
                try { qCount = JSON.parse(jsonStr).length } catch { }
                return (
                    <div className="my-3 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center"><ClipboardList className="h-5 w-5 text-white" /></div>
                            <div>
                                <p className="text-sm font-semibold text-gray-900">📋 Test tayyor — {qCount} savol</p>
                                <p className="text-xs text-gray-500">Yon oynada yechishingiz mumkin</p>
                            </div>
                        </div>
                        {!isStreaming && (
                            <button onClick={() => onOpenTest(jsonStr)} className="h-9 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition flex items-center gap-2">
                                <BookOpen className="h-4 w-4" /> Testni ochish
                            </button>
                        )}
                    </div>
                )
            }
            if (className?.includes('language-profile-update')) {
                let data: { weakTopics?: string[]; strongTopics?: string[] } = {}
                try { data = JSON.parse(String(children).trim()) } catch { }
                const hasWeak = (data.weakTopics?.length ?? 0) > 0
                const hasStrong = (data.strongTopics?.length ?? 0) > 0
                return (
                    <div className="my-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="h-10 w-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center flex-shrink-0">
                                <GraduationCap className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-900">Profilni yangilash taklifi</p>
                                <p className="text-xs text-gray-500">Suhbat asosida aniqlandi — tasdiqlaysizmi?</p>
                            </div>
                        </div>
                        <div className="space-y-1 mb-3">
                            {hasWeak && <p className="text-xs text-gray-700">⚠️ <strong>Qiyin mavzular:</strong> {data.weakTopics!.join(', ')}</p>}
                            {hasStrong && <p className="text-xs text-gray-700">✅ <strong>Kuchli mavzular:</strong> {data.strongTopics!.join(', ')}</p>}
                        </div>
                        {onProfileUpdate && !isStreaming && (
                            <button onClick={() => onProfileUpdate(data)}
                                className="h-8 px-4 rounded-lg text-[13px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition">
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
                    <div className="my-3 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center flex-shrink-0">
                                <Layers className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-900">🃏 {count} ta kartochka tayyor</p>
                                <p className="text-xs text-gray-500">Bosib aylantiring — formula/javob ko'ring</p>
                            </div>
                        </div>
                        {!isStreaming && onOpenFlash && (
                            <button onClick={() => onOpenFlash(jsonStr)} className="h-9 px-4 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 transition flex items-center gap-2">
                                <Layers className="h-4 w-4" /> Ochish
                            </button>
                        )}
                    </div>
                )
            }
            const isBlock = className?.includes('language-')
            return isBlock
                ? <pre className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 text-[13px] overflow-x-auto my-3 font-mono leading-relaxed"><code>{children}</code></pre>
                : <code className="bg-blue-50 text-blue-800 border border-blue-100 px-1.5 py-0.5 rounded-md text-[13px] font-mono">{children}</code>
        },
        blockquote: ({ children }) => <blockquote className="border-l-[3px] border-blue-400 bg-blue-50/40 rounded-r-xl pl-4 pr-3 py-2 my-3 text-gray-700">{children}</blockquote>,
        hr: () => <hr className="border-gray-100 my-4" />,
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
    const [sideTab, setSideTab] = useState<'chats' | 'tests' | 'progress'>('chats')
    const [publicTests, setPublicTests] = useState<any[]>([])
    const [myResults, setMyResults] = useState<any[]>([])
    const [stats, setStats] = useState({ chats: 0, messages: 0, streak: 0 })
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
    const [flashPanel, setFlashPanel] = useState<Array<{ front: string; back: string }> | null>(null)
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

    // Auto-close sidebar on mobile
    useEffect(() => {
        const checkWidth = () => { if (window.innerWidth < 768) setSideOpen(false) }
        checkWidth()
        window.addEventListener('resize', checkWidth)
        return () => window.removeEventListener('resize', checkWidth)
    }, [])

    useEffect(() => { loadChats(); loadProfile(); loadPublicTests(); loadMyResults() }, [])
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
    }, [messages, streaming])

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

    async function saveOnboarding(e: React.FormEvent) {
        e.preventDefault(); setSavingProfile(true)
        try {
            const data = {
                ...onboardingForm,
                weakTopics: onboardingForm.weakTopics ? onboardingForm.weakTopics.split(',').map(s => s.trim()).filter(Boolean) : [],
                strongTopics: onboardingForm.strongTopics ? onboardingForm.strongTopics.split(',').map(s => s.trim()).filter(Boolean) : [],
            }
            await fetchApi('/profile', { method: 'PUT', body: JSON.stringify(data) })
            setShowOnboarding(false)
            await loadProfile()
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
            const data = await fetchApi('/chat/new', { method: 'POST', body: JSON.stringify({ title: 'Yangi suhbat', subject: profile?.subject }) })
            await loadChats()
            nav(`/chat/${data.id}`)
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
            if (!res.ok) throw new Error()
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
                setMessages(prev => [...prev, { id: 'err', role: 'assistant', content: 'Xatolik yuz berdi.', createdAt: new Date().toISOString() }])
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
            if (chatId === id) { nav('/chat'); setMessages([]); setCurrentChat(null) }
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
        } catch { }
    }, [])

    // Public test ochish (sidebar dan)
    async function openPublicTest(t: any) {
        setLoadingPublicTest(true)
        try {
            const data = await fetchApi(`/tests/by-link/${t.shareLink}`)
            const rawQuestions = data.questions || []
            const converted = rawQuestions.map((q: any) => {
                const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
                return {
                    q: q.text,
                    a: opts[0] || '', b: opts[1] || '', c: opts[2] || '', d: opts[3] || '',
                    correct: (['a', 'b', 'c', 'd'] as const)[q.correctIdx] ?? 'a'
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
            const newAttachments: { id: string; name: string; text: string; type: string; previewUrl?: string }[] = []
            for (const file of filesToUpload) {
                const formData = new FormData()
                formData.append('file', file)
                const res = await fetch(`/api/chat/${chatId}/upload-file`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData
                })
                const data = await res.json()
                let previewUrl: string | undefined
                if (file.type.startsWith('image/')) {
                    previewUrl = URL.createObjectURL(file)
                }
                newAttachments.push({ id: Math.random().toString(), name: file.name, text: data.text, type: data.fileType, previewUrl })
            }
            setAttachedFiles(prev => [...prev, ...newAttachments])
        } catch { }
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
                    nav(`/chat/${data.id}`)
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
            <div className="h-screen bg-[#fafafa] flex items-center justify-center p-6">
                <div className="w-full max-w-lg anim-up">
                    <div className="text-center mb-8">
                        <div className="h-14 w-14 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
                            <GraduationCap className="h-7 w-7 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">{profile?.onboardingDone ? 'Profilni tahrirlash' : 'Keling tanishamiz!'}</h1>
                        <p className="text-gray-500 mt-2 text-sm">Bu ma'lumotlar AI ustozingiz samarali ishlashi uchun kerak</p>
                    </div>
                    <form onSubmit={saveOnboarding} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                        <div><label className="text-sm font-medium text-gray-700 block mb-1.5">Qaysi fandan tayyorlanasiz?</label>
                            <select value={onboardingForm.subject} onChange={e => setOnboardingForm({ ...onboardingForm, subject: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-white focus:border-blue-500 outline-none text-sm">
                                {['Matematika', 'Fizika', 'Kimyo', 'Biologiya', 'Ona tili', 'Ingliz tili', 'Tarix', 'Geografiya'].map(f => <option key={f} value={f}>{f}</option>)}
                            </select></div>
                        <div><label className="text-sm font-medium text-gray-700 block mb-1.5">Imtihon sanasi</label>
                            <input type="date" value={onboardingForm.examDate} onChange={e => setOnboardingForm({ ...onboardingForm, examDate: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-sm" /></div>
                        <div><label className="text-sm font-medium text-gray-700 block mb-1.5">Maqsad ball (0-100)</label>
                            <input type="number" min="0" max="100" value={onboardingForm.targetScore} onChange={e => setOnboardingForm({ ...onboardingForm, targetScore: parseInt(e.target.value) || 0 })} className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-sm" /></div>
                        <div><label className="text-sm font-medium text-gray-700 block mb-1.5">Qiyin mavzular <span className="text-gray-400">(vergul bilan)</span></label>
                            <input placeholder="masalan: trigonometriya, integrallar" value={onboardingForm.weakTopics} onChange={e => setOnboardingForm({ ...onboardingForm, weakTopics: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-sm" /></div>
                        <div><label className="text-sm font-medium text-gray-700 block mb-1.5">Yaxshi biladigan mavzular</label>
                            <input placeholder="masalan: algebra, geometriya" value={onboardingForm.strongTopics} onChange={e => setOnboardingForm({ ...onboardingForm, strongTopics: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-sm" /></div>
                        <div><label className="text-sm font-medium text-gray-700 block mb-1.5">Nimalar tashvishlantiradi?</label>
                            <input placeholder="masalan: formulalarni eslab qolish" value={onboardingForm.concerns} onChange={e => setOnboardingForm({ ...onboardingForm, concerns: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-sm" /></div>
                        <div className="flex gap-3 pt-2">
                            <button type="submit" disabled={savingProfile} className="flex-1 h-11 rounded-xl text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition disabled:opacity-50">{savingProfile ? 'Saqlanmoqda...' : 'Saqlash'}</button>
                            {profile?.onboardingDone && <button type="button" onClick={() => setShowOnboarding(false)} className="h-11 px-6 rounded-xl text-sm text-gray-500 border border-gray-200 hover:bg-gray-50 transition">Bekor</button>}
                        </div>
                    </form>
                </div>
            </div>
        )
    }

    return (
        <div className="h-screen flex bg-[#fafafa] overflow-hidden">
            {/* Sidebar */}
            <div
                style={{ width: sideOpen ? `${sidebarWidth}px` : '0px', minWidth: sideOpen ? `${sidebarWidth}px` : '0px' }}
                className={`bg-[#f5f5f5] flex flex-col ${isSidebarDragging ? '' : 'transition-all duration-200'} overflow-hidden border-r border-gray-200/80 flex-shrink-0 relative`}
            >
                <div className="p-3 flex items-center justify-between h-14 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center">
                            <BrainCircuit className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className="text-sm font-bold text-gray-900 whitespace-nowrap">msert</span>
                    </div>
                    <button onClick={() => setSideOpen(false)} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-200/80 transition"><X className="h-4 w-4" /></button>
                </div>

                {/* Side tabs */}
                <div className="flex mx-3 mb-2 bg-gray-200/60 rounded-lg p-0.5 flex-shrink-0">
                    {[
                        { k: 'chats' as const, l: 'Suhbat' },
                        { k: 'tests' as const, l: 'Testlar' },
                        { k: 'progress' as const, l: 'Progress' },
                    ].map(t => (
                        <button key={t.k} onClick={() => setSideTab(t.k)} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${sideTab === t.k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{t.l}</button>
                    ))}
                </div>

                {sideTab === 'chats' && (
                    <>
                        <div className="px-3 mb-2">
                            <button onClick={createChat} disabled={creating} className="w-full h-9 flex items-center justify-center gap-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:bg-white transition disabled:opacity-50">
                                <Plus className="h-3.5 w-3.5" /> Yangi suhbat
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
                            {chats.map(c => (
                                <div key={c.id} className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-[13px] transition-colors ${chatId === c.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:bg-gray-200/50'}`}
                                    onClick={() => nav(`/chat/${c.id}`)}>
                                    <span className="flex-1 truncate">{c.title}</span>
                                    <button onClick={(e) => deleteChat(c.id, e)} className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 transition"><Trash2 className="h-3 w-3" /></button>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {sideTab === 'tests' && (
                    <div className="flex-1 overflow-y-auto px-2 space-y-1">
                        {publicTests.length === 0 && <p className="text-xs text-gray-400 text-center py-8">Hozircha testlar yo'q</p>}
                        {loadingPublicTest && (
                            <div className="flex justify-center py-4">
                                <div className="h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}
                        {publicTests.map((t: any) => (
                            <div key={t.id} onClick={() => openPublicTest(t)} className="bg-white rounded-lg p-3 border border-gray-100 cursor-pointer hover:shadow-sm hover:border-blue-200 transition">
                                <p className="text-[13px] font-medium text-gray-900 truncate">{t.title}</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">{t._count?.questions || 0} savol · {t.creator?.name} · {t.subject}</p>
                            </div>
                        ))}
                    </div>
                )}

                {sideTab === 'progress' && (
                    <div className="flex-1 overflow-y-auto px-3 space-y-3">
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
                            <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
                                <MessageSquare className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                                <p className="text-lg font-bold text-gray-900 tabular-nums">{chats.length}</p>
                                <p className="text-[10px] text-gray-400">Suhbatlar</p>
                            </div>
                            <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
                                <Target className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                                <p className="text-lg font-bold text-gray-900 tabular-nums">{profile?.targetScore || 0}</p>
                                <p className="text-[10px] text-gray-400">Maqsad ball</p>
                            </div>
                        </div>
                        {/* Weak/Strong topics */}
                        {profile?.weakTopics && (
                            <div className="bg-white rounded-xl p-3 border border-gray-100">
                                <p className="text-[11px] font-semibold text-gray-400 uppercase mb-2">Qiyin mavzular</p>
                                <div className="flex flex-wrap gap-1">
                                    {JSON.parse(profile.weakTopics).map((t: string, i: number) => (
                                        <span key={i} className="text-[11px] bg-red-50 text-red-600 px-2 py-0.5 rounded-md">{t}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {profile?.strongTopics && (
                            <div className="bg-white rounded-xl p-3 border border-gray-100">
                                <p className="text-[11px] font-semibold text-gray-400 uppercase mb-2">Kuchli mavzular</p>
                                <div className="flex flex-wrap gap-1">
                                    {JSON.parse(profile.strongTopics).map((t: string, i: number) => (
                                        <span key={i} className="text-[11px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md">{t}</span>
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
                                    <div className="bg-white rounded-xl p-3 border border-gray-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[11px] font-semibold text-gray-400 uppercase">Bilim darajasi</p>
                                            <span className="text-[11px] font-semibold text-gray-600">{abilityLabel}</span>
                                        </div>
                                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                                            <div className={`h-full rounded-full bg-gradient-to-r ${abilityColor} transition-all duration-500`} style={{ width: `${abilityPct}%` }} />
                                        </div>
                                        <p className="text-[10px] text-gray-300 text-right">{abilityPct}% · Rasch modeli</p>
                                    </div>
                                    {/* Testlar statistikasi */}
                                    {(profile?.totalTests || 0) > 0 && (
                                        <div className="bg-white rounded-xl p-3 border border-gray-100">
                                            <p className="text-[11px] font-semibold text-gray-400 uppercase mb-2">Testlar natijasi</p>
                                            <div className="grid grid-cols-2 gap-2 mb-3">
                                                <div className="bg-gray-50 rounded-lg p-2 text-center">
                                                    <p className="text-base font-bold text-gray-900 tabular-nums">{profile?.totalTests || 0}</p>
                                                    <p className="text-[10px] text-gray-400">Jami testlar</p>
                                                </div>
                                                <div className="bg-gray-50 rounded-lg p-2 text-center">
                                                    <p className={`text-base font-bold tabular-nums ${(profile?.avgScore || 0) >= 70 ? 'text-emerald-600' : (profile?.avgScore || 0) >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{Math.round(profile?.avgScore || 0)}%</p>
                                                    <p className="text-[10px] text-gray-400">O'rtacha ball</p>
                                                </div>
                                            </div>
                                            {/* Score trend mini bar chart */}
                                            {myResults.length > 1 && (
                                                <div>
                                                    <p className="text-[10px] text-gray-400 mb-1.5">So'nggi {Math.min(myResults.length, 8)} ta test trendi</p>
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
                                        <div className="bg-white rounded-xl p-3 border border-gray-100">
                                            <p className="text-[11px] font-semibold text-gray-400 uppercase mb-2">So'nggi testlar</p>
                                            <div className="space-y-2">
                                                {myResults.slice(0, 5).map((r: any) => (
                                                    <div key={r.id} className="flex items-center gap-2">
                                                        <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${r.score >= 70 ? 'bg-emerald-400' : r.score >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} />
                                                        <span className="text-[12px] text-gray-700 flex-1 truncate">{r.test?.title || 'Test'}</span>
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

                {/* User + Settings */}
                <div className="p-3 border-t border-gray-200/80">
                    <div className="flex items-center gap-2.5 px-2 py-1.5">
                        <div className="h-7 w-7 bg-gray-300 rounded-full flex items-center justify-center text-[11px] font-semibold text-white">{user?.name?.[0]?.toUpperCase()}</div>
                        <div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-gray-900 truncate">{user?.name}</p></div>
                        <button onClick={() => setShowOnboarding(true)} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200/80 transition" title="Profil sozlamalari"><Settings className="h-3.5 w-3.5" /></button>
                        <button onClick={() => { logout(); nav('/') }} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-200/80 transition"><LogOut className="h-3.5 w-3.5" /></button>
                    </div>
                </div>
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
                <div className="h-14 flex items-center px-4 gap-3 flex-shrink-0">
                    {!sideOpen && <button onClick={() => setSideOpen(true)} className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition"><Menu className="h-4 w-4" /></button>}
                    <span className="text-sm font-medium text-gray-500 truncate flex-1">{currentChat?.title || ''}</span>
                    <button onClick={() => {
                        if (document.fullscreenElement) document.exitFullscreen()
                        else document.documentElement.requestFullscreen()
                    }} className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition" title="To'liq ekran">
                        {document.fullscreenElement ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </button>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
                    {!chatId ? (
                        <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/50">
                            <div className="max-w-2xl w-full px-6 anim-up">
                                <div className="text-center mb-10">
                                    <div className="h-16 w-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/20 ring-4 ring-blue-50"><BrainCircuit className="h-8 w-8 text-white" /></div>
                                    <h2 className="text-3xl font-bold text-slate-800 mb-3 tracking-tight">Salom, {user?.name?.split(' ')[0]}! 👋</h2>
                                    <p className="text-slate-500 text-[15px]">Bugun nima o'rganmoqchisiz? Quyidagilardan birini tanlang</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { icon: '📖', title: 'Mavzu tushuntir', desc: 'Mavzuni boshidan tushuntirib ber', prompt: 'Menga bugungi mavzuni boshidan tushuntirib bering' },
                                        { icon: '📝', title: 'Bilimimni testla', desc: 'Test savollari bilan tekshir', prompt: 'Mening bilimimni test savollari bilan tekshiring' },
                                        { icon: '📋', title: 'O\'quv reja tuz', desc: 'Imtihongacha bo\'lgan reja', prompt: 'Imtihongacha bo\'lgan kunlar uchun batafsil o\'quv reja tuzing. Har kuni qaysi mavzuni o\'rganishim kerakligini yozing.' },
                                        { icon: '💡', title: 'Formula va qoidalar', desc: 'Asosiy formulalarni ko\'rsat', prompt: 'Bu fandagi eng muhim formulalar va qoidalarni ko\'rsating. Formulalarni LaTeX formatda yozing.' },
                                        { icon: '🔍', title: 'Zaif joylarimni aniqla', desc: 'Diagnostika qil', prompt: 'Mening bilim darajamni aniqlash uchun diagnostik savollar bering. Avval oson savollardan boshlang, keyin qiyinlashtiring.' },
                                        { icon: '🎯', title: 'Imtihon strategiya', desc: 'Vaqt taktikasi', prompt: 'Milliy sertifikat imtihonida vaqt boshqarish va javob berish strategiyasini o\'rgating' },
                                    ].map((s, i) => (
                                        <button key={i} onClick={async () => {
                                            if (creating) return; setCreating(true)
                                            try {
                                                const data = await fetchApi('/chat/new', { method: 'POST', body: JSON.stringify({ title: s.title, subject: profile?.subject }) })
                                                await loadChats()
                                                nav(`/chat/${data.id}`)
                                                setTimeout(() => {
                                                    setMessages([{ id: 'temp-u', role: 'user', content: s.prompt, createdAt: new Date().toISOString() }])
                                                    streamToChat(data.id, s.prompt)
                                                }, 200)
                                            } catch { }
                                            setCreating(false)
                                        }}
                                            className="text-left p-5 bg-white/80 backdrop-blur-md border border-slate-100 rounded-2xl hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 group hover:-translate-y-0.5">
                                            <span className="text-2xl mb-3 block transform group-hover:scale-110 transition-transform origin-left">{s.icon}</span>
                                            <p className="text-sm font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors">{s.title}</p>
                                            <p className="text-[13px] text-slate-500 leading-relaxed">{s.desc}</p>
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
                                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex-shrink-0 flex items-center justify-center mt-0.5"><BrainCircuit className="h-3.5 w-3.5 text-white" /></div>
                                    )}
                                    {m.role === 'user' ? (
                                        <div className="max-w-[85%] text-[14px] leading-relaxed bg-slate-800 text-white rounded-2xl rounded-tr-sm px-5 py-3.5 whitespace-pre-wrap shadow-md shadow-slate-900/5">
                                            {m.content.includes('![') ? (
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex flex-wrap gap-2">
                                                        {Array.from(m.content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)).map((match, idx) => (
                                                            <img key={idx} src={match[1]} alt="" className="max-h-48 rounded-xl object-contain shadow-sm border border-slate-700 bg-slate-100" />
                                                        ))}
                                                    </div>
                                                    {m.content.replace(/!\[[^\]]*\]\([^)]+\)/g, '').trim() && (
                                                        <p className="opacity-90">{m.content.replace(/!\[[^\]]*\]\([^)]+\)/g, '').trim()}</p>
                                                    )}
                                                </div>
                                            ) : m.content}
                                        </div>
                                    ) : (
                                        <div className="flex-1 text-[14px] leading-relaxed text-slate-800 py-1"><MdMessage content={m.content} onOpenTest={openTestPanel} onProfileUpdate={handleProfileUpdate} onOpenFlash={openFlashPanel} /></div>
                                    )}
                                </div>
                            ))}
                            {/* Thinking process display */}
                            {thinkingText && (
                                <div className="flex gap-3 opacity-40">
                                    <div className="h-7 w-7 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center mt-0.5"><Lightbulb className="h-3.5 w-3.5 text-gray-400" /></div>
                                    <div className="flex-1">
                                        <details className="group">
                                            <summary className="text-[11px] text-gray-400 cursor-pointer select-none mb-1">Fikrlash jarayoni <span className="group-open:hidden">(ko'rish)</span></summary>
                                            <div className="bg-gray-50 rounded-lg p-2.5 text-[11px] text-gray-400 leading-relaxed whitespace-pre-wrap max-h-24 overflow-hidden mt-1">{thinkingText}</div>
                                        </details>
                                    </div>
                                </div>
                            )}
                            {streaming && (
                                <div className="flex gap-3">
                                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex-shrink-0 flex items-center justify-center mt-0.5"><BrainCircuit className="h-3.5 w-3.5 text-white" /></div>
                                    <div className="flex-1 text-[14px] leading-relaxed text-slate-800 py-1">
                                        <MdMessage content={streaming} onOpenTest={openTestPanel} isStreaming={true} onProfileUpdate={handleProfileUpdate} onOpenFlash={openFlashPanel} />
                                        {/```test/.test(streaming) && !/```test[\s\S]*?```/.test(streaming) && (
                                            <div className="mt-4 flex items-center gap-3 text-[13px] font-medium text-blue-700 bg-blue-50/80 border border-blue-200/60 rounded-xl px-4 py-3 shadow-sm backdrop-blur-sm">
                                                <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                                                <span>Imtihon savollari shakllantirilmoqda...</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {loading && !streaming && !thinkingText && (
                                <div className="flex gap-3">
                                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex-shrink-0 flex items-center justify-center"><BrainCircuit className="h-3.5 w-3.5 text-white" /></div>
                                    <div className="flex gap-1 py-3"><span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" /><span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:150ms]" /><span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:300ms]" /></div>
                                </div>
                            )}
                            {loading && thinkingText && !streaming && (
                                <div className="flex gap-3">
                                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex-shrink-0 flex items-center justify-center"><BrainCircuit className="h-3.5 w-3.5 text-white" /></div>
                                    <div className="text-[13px] text-gray-400 py-3 flex items-center gap-2">Javob yozilmoqda...<span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" /></div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Input + Quick Actions */}
                {chatId && (
                    <div className="px-4 pb-5 pt-2">
                        {/* Quick Actions */}
                        {!loading && messages.length > 0 && (
                            <div className="max-w-5xl mx-auto mb-2 flex gap-1.5 flex-wrap">
                                {[
                                    { l: '📝 Testla', p: 'Meni shu mavzu bo\'yicha testlang. 5 ta test savol bering A, B, C, D variantlar bilan.' },
                                    { l: '📖 Davom et', p: 'Keyingi mavzuga o\'tamiz. Nimani o\'rganishimiz kerak?' },
                                    { l: '🔄 Qayta tushuntir', p: 'Bu mavzuni boshqa usulda, oddiyroq tushuntiring' },
                                    { l: '📋 Reja tuz', p: 'Imtihongacha qolgan vaqtga mos o\'quv reja tuzing' },
                                    { l: '💡 Formulalar', p: 'Shu mavzuning barcha muhim formulalarini yozing' },
                                    { l: '🃏 Kartochkalar', p: 'Shu mavzuning eng muhim formulalari va tushunchalarini kartochka formatida bering (```flashcard JSON format).' },
                                ].map((a, i) => (
                                    <button key={i} onClick={() => quickAction(a.p)} className="h-7 px-3 text-[12px] font-medium text-gray-500 bg-white border border-gray-200 rounded-full hover:border-gray-400 hover:text-gray-700 transition whitespace-nowrap">{a.l}</button>
                                ))}
                            </div>
                        )}
                        <form onSubmit={sendMessage} className="max-w-5xl mx-auto">
                            {/* Attached files preview */}
                            {attachedFiles.length > 0 && (
                                <div className="mb-2 flex flex-wrap gap-2 z-10 px-2 pb-1 relative">
                                    {attachedFiles.map(file => (
                                        <div key={file.id} className="relative bg-white border border-gray-200 rounded-xl p-1.5 w-[72px] h-[72px] flex flex-col items-center justify-center shadow-sm">
                                            <button type="button" onClick={() => {
                                                if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
                                                setAttachedFiles(prev => prev.filter(f => f.id !== file.id));
                                            }} className="absolute -top-1.5 -right-1.5 bg-gray-100 border border-gray-200 text-gray-500 hover:text-red-500 rounded-full h-[22px] w-[22px] flex items-center justify-center shadow-sm z-10 hover:bg-white transition-colors">
                                                <X className="h-3 w-3" />
                                            </button>

                                            {file.previewUrl ? (
                                                <img src={file.previewUrl} alt={file.name} title={file.name} className="w-full h-full object-cover rounded-[8px]" />
                                            ) : (
                                                <>
                                                    <FileText className="h-6 w-6 text-blue-500 mb-1" />
                                                    <span className="text-[10px] text-gray-600 w-full truncate text-center px-1" title={file.name}>
                                                        {file.name.substring(0, 8)}...
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 shadow-sm focus-within:border-gray-300 focus-within:shadow-md transition-all">
                                {/* Hidden file input */}
                                <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,image/*" className="hidden" onChange={handleFileSelect} />
                                {/* File attach button */}
                                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading || uploadingFile} title="Fayl biriktirish"
                                    className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition disabled:opacity-40">
                                    {uploadingFile
                                        ? <div className="h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                        : <Paperclip className="h-3.5 w-3.5" />}
                                </button>
                                <input value={input} onChange={e => setInput(e.target.value)} onPaste={handlePaste} placeholder="Xabar yozing..." disabled={loading}
                                    className="flex-1 h-12 bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400" />
                                {/* Thinking mode toggle */}
                                <button type="button" onClick={() => setThinkingMode(!thinkingMode)} title={thinkingMode ? 'Chuqur fikrlash yoqilgan' : 'Chuqur fikrlash'}
                                    className={`h-8 w-8 flex items-center justify-center rounded-lg transition ${thinkingMode ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}>
                                    <Lightbulb className="h-3.5 w-3.5" />
                                </button>
                                {loading ? (
                                    <button type="button" onClick={stopGeneration}
                                        className="h-8 w-8 flex items-center justify-center rounded-lg bg-red-500 text-white hover:bg-red-600 transition animate-pulse">
                                        <Square className="h-3 w-3" />
                                    </button>
                                ) : (
                                    <button type="submit" disabled={!input.trim() && attachedFiles.length === 0}
                                        className="h-8 w-8 flex items-center justify-center rounded-lg bg-gray-900 text-white disabled:bg-gray-200 disabled:text-gray-400 transition">
                                        <Send className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                            <p className="text-[10px] text-gray-300 mt-1 text-center select-none">AI xato qilishi mumkin — muhim ma'lumotlarni tekshirib ko'ring</p>
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
                        <div className={testPanelMaximized ? 'fixed inset-0 z-50 bg-white flex flex-col' : 'relative bg-white border-l border-gray-200 flex flex-col flex-shrink-0'}
                            style={testPanelMaximized ? {} : { width: testWidth }}>

                            {/* Drag handle (chap cheti) */}
                            {!testPanelMaximized && (
                                <div
                                    onMouseDown={e => { testDragRef.current = true; e.preventDefault() }}
                                    className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-300/60 active:bg-blue-400/60 transition-colors z-10 group">
                                    <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-gray-300 group-hover:bg-blue-400 rounded-full transition-colors" />
                                </div>
                            )}

                            {/* Panel header */}
                            <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100 flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className="h-7 w-7 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center"><ClipboardList className="h-3.5 w-3.5 text-white" /></div>
                                    <span className="text-sm font-semibold text-gray-900">Test — {questions.length} savol</span>
                                    {testReadOnly && <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-md font-medium">Ko'rish</span>}
                                    {testTimeLeft !== null && (
                                        <span className={`text-sm font-mono tabular-nums ml-1 px-2 py-0.5 rounded-md ${testTimeLeft < 60 ? 'text-red-500 bg-red-50 animate-pulse' : 'text-gray-500 bg-gray-100'}`}>
                                            ⏱ {Math.floor(testTimeLeft / 60)}:{String(testTimeLeft % 60).padStart(2, '0')}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setTestPanelMaximized(!testPanelMaximized)} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition" title={testPanelMaximized ? 'Kichraytirish' : 'Kattalashtirish'}>
                                        {testPanelMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                    </button>
                                    <button onClick={() => { setTestPanel(null); setTestPanelMaximized(false); setActiveTestId(null); setActiveTestQuestions([]); setTestTimeLeft(null); setRaschFeedback(null) }} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"><X className="h-4 w-4" /></button>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="h-1 bg-slate-100">
                                <div className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 transition-all duration-500" style={{ width: testReadOnly ? '100%' : `${(answered / questions.length) * 100}%` }} />
                            </div>

                            {/* Questions */}
                            <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-5 bg-slate-50/50">
                                <div className={testPanelMaximized ? 'max-w-3xl mx-auto space-y-5' : 'space-y-5'}>
                                    {questions.map((q: any, i: number) => (
                                        <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300">
                                            <p className="text-[14px] font-semibold text-slate-800 mb-4 leading-relaxed">{i + 1}. <MathText text={q.q} /></p>
                                            <div className="space-y-2.5">
                                                {(['a', 'b', 'c', 'd'] as const).map(opt => {
                                                    const isSelected = testAnswers[i] === opt
                                                    const isCorrect = q.correct === opt
                                                    let cls = 'w-full text-left px-4 py-3 rounded-xl text-[13px] border transition-all duration-200 outline-none '
                                                    if (testSubmitted) {
                                                        if (isCorrect) cls += 'border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold shadow-sm ring-1 ring-emerald-500/10'
                                                        else if (isSelected && !isCorrect) cls += 'border-red-300 bg-red-50 text-red-900 shadow-sm ring-1 ring-red-500/10'
                                                        else cls += 'border-slate-100 bg-slate-50 opacity-60 text-slate-500'
                                                    } else {
                                                        cls += isSelected
                                                            ? 'border-blue-500 bg-blue-50/80 text-blue-900 font-semibold shadow-md shadow-blue-500/10 ring-1 ring-blue-500/20 scale-[1.01]'
                                                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                                    }
                                                    return (
                                                        <button key={opt} disabled={testSubmitted} onClick={() => setTestAnswers({ ...testAnswers, [i]: opt })} className={cls}>
                                                            <span className="font-bold mr-2 text-slate-400 opacity-80">{opt.toUpperCase()})</span> <MathText text={q[opt]} />
                                                            {testSubmitted && isCorrect && <span className="ml-2 inline-flex items-center justify-center h-5 w-5 bg-emerald-100 text-emerald-600 rounded-full text-xs">✓</span>}
                                                            {testSubmitted && isSelected && !isCorrect && <span className="ml-2 inline-flex items-center justify-center h-5 w-5 bg-red-100 text-red-600 rounded-full text-xs">✕</span>}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Submit / Results */}
                            <div className="p-5 border-t border-slate-100 bg-white flex-shrink-0">
                                <div className={testPanelMaximized ? 'max-w-3xl mx-auto' : ''}>
                                    {testReadOnly ? (
                                        <div className="text-center space-y-2">
                                            <div className="inline-flex items-center justify-center h-8 px-3 bg-emerald-50 text-emerald-700 rounded-full text-[12px] font-semibold mb-1">
                                                ✓ Bu test avval yechilgan
                                            </div>
                                            <p className="text-[12px] text-slate-400">To'g'ri javoblar yashil bilan ko'rsatilmoqda</p>
                                            <button onClick={() => { setTestPanel(null); setTestPanelMaximized(false); setTestReadOnly(false); setActiveTestId(null); setActiveTestQuestions([]); setTestTimeLeft(null); setRaschFeedback(null) }} className="text-sm font-medium text-blue-600 hover:text-blue-700 transition">Panelni yopish</button>
                                        </div>
                                    ) : !testSubmitted ? (
                                        <button onClick={submitTestPanel} disabled={answered < questions.length}
                                            className="w-full h-12 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 shadow-lg shadow-slate-900/10 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2">
                                            <Target className="h-4 w-4" /> Natijani ko'rish ({answered}/{questions.length})
                                        </button>
                                    ) : (
                                        <div className="text-center space-y-2">
                                            <p className="text-lg font-bold text-gray-900">{score}/{questions.length} <span className="text-sm font-normal text-gray-400">— {Math.round(score / questions.length * 100)}%</span></p>
                                            {raschFeedback && (
                                                <p className="text-xs text-blue-600 font-medium">
                                                    📈 Daraja: {raschFeedback.prev.toFixed(2)} → {raschFeedback.next.toFixed(2)}
                                                </p>
                                            )}
                                            <p className="text-xs text-gray-400">Natijalar chatga yuborildi</p>
                                            <button onClick={() => { setTestPanel(null); setTestPanelMaximized(false); setTestReadOnly(false); setActiveTestId(null); setActiveTestQuestions([]); setTestTimeLeft(null); setRaschFeedback(null) }} className="text-sm text-blue-600 hover:underline">Panelni yopish</button>
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
                            className={flashMaximized
                                ? 'fixed inset-0 z-50 bg-white flex flex-col'
                                : 'relative bg-white border-l border-gray-200 flex flex-col flex-shrink-0'}
                            style={flashMaximized ? {} : { width: flashWidth }}>

                            {/* Drag handle (chap cheti) */}
                            {!flashMaximized && (
                                <div
                                    onMouseDown={e => { flashDragRef.current = true; e.preventDefault() }}
                                    className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-violet-300/60 active:bg-violet-400/60 transition-colors z-10 group">
                                    <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-gray-300 group-hover:bg-violet-400 rounded-full transition-colors" />
                                </div>
                            )}

                            {/* Header */}
                            <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100 flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-gray-900">🃏 Kartochkalar</span>
                                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">{flashIdx + 1}/{flashPanel.length}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setFlashMaximized(!flashMaximized)}
                                        className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                                        title={flashMaximized ? 'Kichraytirish' : 'Kattalashtirish'}>
                                        {flashMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                    </button>
                                    <button onClick={() => { setFlashPanel(null); setFlashMaximized(false) }}
                                        className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="h-1 bg-gray-100 flex-shrink-0">
                                <div className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-300" style={{ width: `${((flashIdx + 1) / flashPanel.length) * 100}%` }} />
                            </div>

                            {/* Card flip area */}
                            <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-0 overflow-y-auto [perspective:1000px] bg-slate-50/50">
                                <div className={flashMaximized ? 'w-full max-w-2xl' : 'w-full'}>
                                    <div onClick={() => setFlashFlipped(!flashFlipped)}
                                        className="relative cursor-pointer min-h-[250px] w-full [transform-style:preserve-3d] transition-transform duration-700"
                                        style={{ transform: flashFlipped ? 'rotateY(180deg)' : 'rotateY(0)' }}>

                                        {/* Front (Question) */}
                                        <div className="absolute inset-0 [backface-visibility:hidden] bg-gradient-to-br from-violet-50 to-indigo-50 border-2 border-white rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-xl shadow-indigo-500/10">
                                            <div className="absolute top-4 left-0 right-0 flex justify-center">
                                                <span className="bg-indigo-100 text-indigo-600 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">❓ Savol</span>
                                            </div>
                                            <div className="text-[15px] font-medium text-slate-800 leading-relaxed w-full mt-2">
                                                <MdMessage content={card.front} onOpenTest={() => { }} onProfileUpdate={() => { }} onOpenFlash={() => { }} />
                                            </div>
                                            <p className="absolute bottom-5 text-[11px] font-semibold text-indigo-400 flex items-center gap-1 opacity-70">
                                                <RotateCcw className="h-3 w-3" /> Bosib javobni ko'ring
                                            </p>
                                        </div>

                                        {/* Back (Answer) */}
                                        <div className="absolute inset-0 [backface-visibility:hidden] bg-white border border-emerald-100 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-xl shadow-emerald-500/10"
                                            style={{ transform: 'rotateY(180deg)' }}>
                                            <div className="absolute top-4 left-0 right-0 flex justify-center">
                                                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">✅ Javob</span>
                                            </div>
                                            <div className="text-[15px] text-slate-700 leading-relaxed w-full mt-2">
                                                <MdMessage content={card.back} onOpenTest={() => { }} onProfileUpdate={() => { }} onOpenFlash={() => { }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Navigation */}
                            <div className={`p-5 border-t border-slate-100 bg-white flex gap-3 flex-shrink-0 ${flashMaximized ? 'max-w-2xl w-full mx-auto' : ''}`}>
                                <button disabled={flashIdx === 0}
                                    onClick={() => { setFlashIdx(flashIdx - 1); setFlashFlipped(false) }}
                                    className="flex-1 h-12 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5 focus:ring-2 focus:ring-slate-200">
                                    <ChevronLeft className="h-4.5 w-4.5" /> Oldingi
                                </button>
                                <button onClick={() => {
                                    if (flashIdx < flashPanel.length - 1) { setFlashIdx(flashIdx + 1); setFlashFlipped(false) }
                                    else { setFlashPanel(null); setFlashMaximized(false) }
                                }} className="flex-1 h-12 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/20 text-white text-sm font-bold hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-1.5 focus:ring-2 focus:ring-indigo-500">
                                    {flashIdx < flashPanel.length - 1 ? <><span>Keyingi</span><ChevronRight className="h-4.5 w-4.5" /></> : 'Tugallash'}
                                </button>
                            </div>
                        </div>
                    )
                })()
            }
        </div >
    )
}
