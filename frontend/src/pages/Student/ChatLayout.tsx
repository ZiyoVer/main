import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BrainCircuit, Plus, Trash2, LogOut, Send, Menu, X, GraduationCap, ClipboardList, Settings, BookOpen, Target, Flame, MessageSquare, FileText, Zap, Square, Lightbulb, Maximize2, Minimize2, Paperclip } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

interface Chat { id: string; title: string; subject?: string; updatedAt: string }
interface Msg { id: string; role: string; content: string; createdAt: string }
interface Profile { onboardingDone: boolean; subject?: string; examDate?: string; targetScore?: number; weakTopics?: string; strongTopics?: string; concerns?: string; totalTests?: number; avgScore?: number }

// MdMessage komponentni tashqarida va memo bilan ta'riflaymiz —
// shunda har keystrokeda re-render bo'lmaydi (ReactMarkdown+KaTeX qimmat!)
const MdMessage = memo(({ content, onOpenTest }: { content: string; onOpenTest: (s: string) => void }) => (
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{
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
                        <button onClick={() => onOpenTest(jsonStr)} className="h-9 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition flex items-center gap-2">
                            <BookOpen className="h-4 w-4" /> Testni ochish
                        </button>
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
    const [attachedFile, setAttachedFile] = useState<{ name: string; text: string; type: string } | null>(null)
    const [uploadingFile, setUploadingFile] = useState(false)
    const [loadingPublicTest, setLoadingPublicTest] = useState(false)
    const [activeTestId, setActiveTestId] = useState<string | null>(null)
    const [activeTestQuestions, setActiveTestQuestions] = useState<any[]>([])

    // Auto-close sidebar on mobile
    useEffect(() => {
        const checkWidth = () => { if (window.innerWidth < 768) setSideOpen(false) }
        checkWidth()
        window.addEventListener('resize', checkWidth)
        return () => window.removeEventListener('resize', checkWidth)
    }, [])

    useEffect(() => { loadChats(); loadProfile(); loadPublicTests() }, [])
    useEffect(() => { if (chatId) loadMessages(chatId) }, [chatId])
    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        // Foydalanuvchi yuqoriga scroll qilmagan bo'lsa avtomatik pastga tush
        const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 180
        if (isNearBottom) el.scrollTop = el.scrollHeight
    }, [messages, streaming])

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

    // Stream helper
    async function streamToChat(targetChatId: string, prompt: string) {
        setLoading(true); setStreaming(''); setThinkingText('')
        const controller = new AbortController()
        abortRef.current = controller
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`/api/chat/${targetChatId}/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ content: prompt, thinking: thinkingMode }),
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
                                        { id: 'u-' + Date.now(), role: 'user', content: prompt, createdAt: new Date().toISOString() },
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
                        { id: 'u-' + Date.now(), role: 'user', content: prompt, createdAt: new Date().toISOString() },
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
        if ((!input.trim() && !attachedFile) || !chatId || loading) return
        let text = input.trim()
        if (attachedFile) {
            const prefix = `📎 **${attachedFile.name}** faylidan:\n\n${attachedFile.text}`
            text = text ? `${prefix}\n\n${text}` : prefix
            setAttachedFile(null)
        }
        setInput('')
        setMessages(prev => [...prev, { id: 'temp-u', role: 'user', content: text, createdAt: new Date().toISOString() }])
        await streamToChat(chatId, text)
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

    // Open test in side panel
    const openTestPanel = useCallback((jsonStr: string) => {
        setTestPanel(jsonStr)
        setTestAnswers({})
        setTestSubmitted(false)
        setTestPanelMaximized(false)
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
            openTestPanel(JSON.stringify(converted))
        } catch { }
        setLoadingPublicTest(false)
    }

    async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !chatId) return
        setUploadingFile(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            const token = localStorage.getItem('token')
            const res = await fetch(`/api/chat/${chatId}/upload-file`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            })
            const data = await res.json()
            setAttachedFile({ name: file.name, text: data.text, type: data.fileType })
        } catch { }
        setUploadingFile(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
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
        const summary = `Test natijasi: ${score}/${questions.length}\n\n${results}\n\nIltimos natijalarimni tahlil qiling va qaysi mavzularni qayta o'rganishim kerakligini ayting.`
        if (chatId) setTimeout(() => quickAction(summary), 500)
        // Public test bo'lsa backendga ham yuborish (Rasch tracking)
        if (activeTestId && activeTestQuestions.length > 0) {
            const backendAnswers = activeTestQuestions.map((q: any, i: number) => ({
                questionId: q.id,
                selectedIdx: ['a', 'b', 'c', 'd'].indexOf(testAnswers[i] || '')
            })).filter((a: any) => a.selectedIdx !== -1)
            fetchApi(`/tests/${activeTestId}/submit`, { method: 'POST', body: JSON.stringify({ answers: backendAnswers }) }).catch(() => {})
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
        <div className="h-screen flex bg-[#fafafa]">
            {/* Sidebar */}
            <div className={`${sideOpen ? 'w-72 min-w-[288px]' : 'w-0 min-w-0'} bg-[#f5f5f5] flex flex-col transition-all duration-200 overflow-hidden border-r border-gray-200/80 flex-shrink-0`}>
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
                        <div className="h-full flex items-center justify-center">
                            <div className="max-w-2xl w-full px-6 anim-up">
                                <div className="text-center mb-10">
                                    <div className="h-14 w-14 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/15"><BrainCircuit className="h-7 w-7 text-white" /></div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Salom, {user?.name?.split(' ')[0]}! 👋</h2>
                                    <p className="text-sm text-gray-400">Bugun nima o'rganmoqchisiz? Quyidagilardan birini tanlang</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
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
                                            className="text-left p-4 bg-white border border-gray-150 rounded-2xl hover:border-gray-300 hover:shadow-md transition-all group">
                                            <span className="text-xl mb-2 block">{s.icon}</span>
                                            <p className="text-sm font-semibold text-gray-900 mb-0.5 group-hover:text-blue-600 transition">{s.title}</p>
                                            <p className="text-xs text-gray-400">{s.desc}</p>
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
                                        <div className="max-w-[90%] text-[14px] leading-relaxed bg-gray-100 text-gray-900 rounded-2xl rounded-br-md px-4 py-3 whitespace-pre-wrap">{m.content}</div>
                                    ) : (
                                        <div className="flex-1 text-[14px] leading-relaxed text-gray-800 py-1"><MdMessage content={m.content} onOpenTest={openTestPanel} /></div>
                                    )}
                                </div>
                            ))}
                            {/* Thinking process display */}
                            {thinkingText && (
                                <div className="flex gap-3">
                                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex-shrink-0 flex items-center justify-center mt-0.5"><Lightbulb className="h-3.5 w-3.5 text-white" /></div>
                                    <div className="flex-1">
                                        <details open className="group">
                                            <summary className="text-[12px] font-medium text-purple-500 cursor-pointer select-none mb-2">🧠 AI fikrlash jarayoni <span className="text-purple-300 group-open:hidden">(ko'rish)</span></summary>
                                            <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-3 text-[12px] text-purple-700 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">{thinkingText}</div>
                                        </details>
                                    </div>
                                </div>
                            )}
                            {streaming && (
                                <div className="flex gap-3">
                                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex-shrink-0 flex items-center justify-center mt-0.5"><BrainCircuit className="h-3.5 w-3.5 text-white" /></div>
                                    <div className="flex-1 text-[14px] leading-relaxed text-gray-800 py-1">
                                        <MdMessage content={streaming} onOpenTest={openTestPanel} />
                                        {/```test/.test(streaming) && !/```test[\s\S]*?```/.test(streaming) && (
                                            <div className="mt-3 flex items-center gap-2 text-[13px] text-blue-600 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
                                                <div className="h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                                                <span>Test tayyorlanmoqda...</span>
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
                                ].map((a, i) => (
                                    <button key={i} onClick={() => quickAction(a.p)} className="h-7 px-3 text-[12px] font-medium text-gray-500 bg-white border border-gray-200 rounded-full hover:border-gray-400 hover:text-gray-700 transition whitespace-nowrap">{a.l}</button>
                                ))}
                            </div>
                        )}
                        <form onSubmit={sendMessage} className="max-w-5xl mx-auto">
                            {/* Attached file preview */}
                            {attachedFile && (
                                <div className="mb-2 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                                    <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                    <span className="text-[13px] text-blue-700 flex-1 truncate">{attachedFile.name}</span>
                                    <button type="button" onClick={() => setAttachedFile(null)} className="text-blue-400 hover:text-blue-600 transition">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            )}
                            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 shadow-sm focus-within:border-gray-300 focus-within:shadow-md transition-all">
                                {/* Hidden file input */}
                                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,image/*" className="hidden" onChange={handleFileSelect} />
                                {/* File attach button */}
                                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading || uploadingFile} title="Fayl biriktirish"
                                    className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition disabled:opacity-40">
                                    {uploadingFile
                                        ? <div className="h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                        : <Paperclip className="h-3.5 w-3.5" />}
                                </button>
                                <input value={input} onChange={e => setInput(e.target.value)} placeholder="Xabar yozing..." disabled={loading}
                                    className="flex-1 h-12 bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400" />
                                {/* Thinking mode toggle */}
                                <button type="button" onClick={() => setThinkingMode(!thinkingMode)} title={thinkingMode ? 'Chuqur fikrlash yoqilgan (R1)' : 'Oddiy rejim (V3)'}
                                    className={`h-8 w-8 flex items-center justify-center rounded-lg transition ${thinkingMode ? 'bg-purple-100 text-purple-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}>
                                    <Lightbulb className="h-3.5 w-3.5" />
                                </button>
                                {loading ? (
                                    <button type="button" onClick={stopGeneration}
                                        className="h-8 w-8 flex items-center justify-center rounded-lg bg-red-500 text-white hover:bg-red-600 transition animate-pulse">
                                        <Square className="h-3 w-3" />
                                    </button>
                                ) : (
                                    <button type="submit" disabled={!input.trim() && !attachedFile}
                                        className="h-8 w-8 flex items-center justify-center rounded-lg bg-gray-900 text-white disabled:bg-gray-200 disabled:text-gray-400 transition">
                                        <Send className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                            {thinkingMode && <p className="text-[11px] text-purple-500 mt-1.5 ml-4">🧠 Chuqur fikrlash rejimi (DeepSeek R1) — murakkabroq vazifalar uchun</p>}
                        </form>
                    </div>
                )}
            </div>

            {/* Test Side Panel */}
            {testPanel && (() => {
                let questions: any[] = []
                try { questions = JSON.parse(testPanel) } catch { return null }
                const answered = Object.keys(testAnswers).length
                const score = testSubmitted ? questions.filter((q: any, i: number) => testAnswers[i] === q.correct).length : 0
                return (
                    <div className={testPanelMaximized ? 'fixed inset-0 z-50 bg-white flex flex-col' : 'w-96 bg-white border-l border-gray-200 flex flex-col flex-shrink-0 animate-in'}>
                        {/* Panel header */}
                        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="h-7 w-7 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center"><ClipboardList className="h-3.5 w-3.5 text-white" /></div>
                                <span className="text-sm font-semibold text-gray-900">Test — {questions.length} savol</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setTestPanelMaximized(!testPanelMaximized)} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition" title={testPanelMaximized ? 'Kichraytirish' : 'Kattalashtirish'}>
                                    {testPanelMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                </button>
                                <button onClick={() => { setTestPanel(null); setTestPanelMaximized(false); setActiveTestId(null); setActiveTestQuestions([]) }} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"><X className="h-4 w-4" /></button>
                            </div>
                        </div>

                        {/* Progress bar */}
                        <div className="h-1 bg-gray-100">
                            <div className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all" style={{ width: `${(answered / questions.length) * 100}%` }} />
                        </div>

                        {/* Questions */}
                        <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
                            <div className={testPanelMaximized ? 'max-w-3xl mx-auto space-y-4' : 'space-y-4'}>
                            {questions.map((q: any, i: number) => (
                                <div key={i} className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-[13px] font-medium text-gray-900 mb-3">{i + 1}. {q.q}</p>
                                    <div className="space-y-2">
                                        {(['a', 'b', 'c', 'd'] as const).map(opt => {
                                            const isSelected = testAnswers[i] === opt
                                            const isCorrect = q.correct === opt
                                            let cls = 'w-full text-left px-3.5 py-2.5 rounded-xl text-[13px] border transition-all '
                                            if (testSubmitted) {
                                                if (isCorrect) cls += 'border-emerald-300 bg-emerald-50 text-emerald-800 font-medium'
                                                else if (isSelected && !isCorrect) cls += 'border-red-300 bg-red-50 text-red-700'
                                                else cls += 'border-transparent bg-white text-gray-400'
                                            } else {
                                                cls += isSelected
                                                    ? 'border-blue-400 bg-blue-50 text-blue-800 font-medium shadow-sm'
                                                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                                            }
                                            return (
                                                <button key={opt} disabled={testSubmitted} onClick={() => setTestAnswers({ ...testAnswers, [i]: opt })} className={cls}>
                                                    <span className="font-semibold mr-1.5">{opt.toUpperCase()})</span> {q[opt]}
                                                    {testSubmitted && isCorrect && <span className="ml-1">✅</span>}
                                                    {testSubmitted && isSelected && !isCorrect && <span className="ml-1">❌</span>}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                            </div>
                        </div>

                        {/* Submit / Results */}
                        <div className="p-4 border-t border-gray-100 flex-shrink-0">
                            <div className={testPanelMaximized ? 'max-w-3xl mx-auto' : ''}>
                            {!testSubmitted ? (
                                <button onClick={submitTestPanel} disabled={answered < questions.length}
                                    className="w-full h-11 rounded-xl text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 transition flex items-center justify-center gap-2">
                                    <Target className="h-4 w-4" /> Tugatish ({answered}/{questions.length})
                                </button>
                            ) : (
                                <div className="text-center space-y-2">
                                    <p className="text-lg font-bold text-gray-900">{score}/{questions.length} <span className="text-sm font-normal text-gray-400">— {Math.round(score / questions.length * 100)}%</span></p>
                                    <p className="text-xs text-gray-400">Natijalar chatga yuborildi</p>
                                    <button onClick={() => { setTestPanel(null); setTestPanelMaximized(false); setActiveTestId(null); setActiveTestQuestions([]) }} className="text-sm text-blue-600 hover:underline">Panelni yopish</button>
                                </div>
                            )}
                            </div>
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
