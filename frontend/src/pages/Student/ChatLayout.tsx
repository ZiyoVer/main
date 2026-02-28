import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BrainCircuit, Plus, Trash2, LogOut, Send, Menu, X, GraduationCap, ClipboardList, Settings, BookOpen, Target, Flame, MessageSquare, FileText, Zap, Square, Lightbulb } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

interface Chat { id: string; title: string; subject?: string; updatedAt: string }
interface Msg { id: string; role: string; content: string; createdAt: string }
interface Profile { onboardingDone: boolean; subject?: string; examDate?: string; targetScore?: number; weakTopics?: string; strongTopics?: string; concerns?: string; totalTests?: number; avgScore?: number }

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
    const endRef = useRef<HTMLDivElement>(null)
    const abortRef = useRef<AbortController | null>(null)

    useEffect(() => { loadChats(); loadProfile(); loadPublicTests() }, [])
    useEffect(() => { if (chatId) loadMessages(chatId) }, [chatId])
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streaming])

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
        if (!input.trim() || !chatId || loading) return
        const text = input; setInput('')
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

    // Interactive Test Widget
    const TestWidget = ({ jsonStr }: { jsonStr: string }) => {
        const [answers, setAnswers] = useState<Record<number, string>>({})
        const [submitted, setSubmitted] = useState(false)
        let questions: any[] = []
        try { questions = JSON.parse(jsonStr) } catch { return <pre className="bg-gray-50 rounded-xl p-4 text-sm overflow-x-auto my-3 border">{jsonStr}</pre> }
        if (!questions.length) return null

        const score = submitted ? questions.filter((q: any, i: number) => answers[i] === q.correct).length : 0

        return (
            <div className="my-4 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white"><ClipboardList className="h-4 w-4" /><span className="text-sm font-semibold">Test — {questions.length} savol</span></div>
                    {submitted && <span className="text-white/90 text-sm font-medium">{score}/{questions.length} to'g'ri</span>}
                </div>
                <div className="divide-y divide-gray-100">
                    {questions.map((q: any, i: number) => (
                        <div key={i} className="p-5">
                            <p className="text-[14px] font-medium text-gray-900 mb-3">{i + 1}. {q.q}</p>
                            <div className="grid grid-cols-2 gap-2">
                                {(['a', 'b', 'c', 'd'] as const).map(opt => {
                                    const isSelected = answers[i] === opt
                                    const isCorrect = q.correct === opt
                                    let cls = 'text-left px-4 py-2.5 rounded-xl text-[13px] border transition-all '
                                    if (submitted) {
                                        if (isCorrect) cls += 'border-emerald-300 bg-emerald-50 text-emerald-800 font-medium'
                                        else if (isSelected && !isCorrect) cls += 'border-red-300 bg-red-50 text-red-700'
                                        else cls += 'border-gray-100 text-gray-400'
                                    } else {
                                        cls += isSelected ? 'border-blue-400 bg-blue-50 text-blue-800 font-medium shadow-sm' : 'border-gray-200 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                                    }
                                    return (
                                        <button key={opt} disabled={submitted} onClick={() => setAnswers({ ...answers, [i]: opt })} className={cls}>
                                            <span className="font-semibold mr-1.5">{opt.toUpperCase()})</span> {q[opt]}
                                            {submitted && isCorrect && <span className="ml-1">✅</span>}
                                            {submitted && isSelected && !isCorrect && <span className="ml-1">❌</span>}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
                    {!submitted ? (
                        <button disabled={Object.keys(answers).length < questions.length} onClick={() => {
                            setSubmitted(true)
                            // Auto-send results to AI
                            const results = questions.map((q: any, i: number) => {
                                const correct = answers[i] === q.correct
                                return `${i + 1}. ${q.q} — Javob: ${(answers[i] || '?').toUpperCase()}) ${correct ? '✅ to\'g\'ri' : '❌ xato (to\'g\'ri: ' + q.correct.toUpperCase() + ')'}`
                            }).join('\n')
                            const summary = `Test natijasi: ${questions.filter((q: any, i: number) => answers[i] === q.correct).length}/${questions.length}\n\n${results}\n\nIltimos natijalarimni tahlil qiling va qaysi mavzularni qayta o'rganishim kerakligini ayting.`
                            if (chatId) {
                                setTimeout(() => quickAction(summary), 500)
                            }
                        }} className="w-full h-11 rounded-xl text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 transition flex items-center justify-center gap-2">
                            <Target className="h-4 w-4" /> Testni tugatish ({Object.keys(answers).length}/{questions.length})
                        </button>
                    ) : (
                        <div className="text-center">
                            <p className="text-sm font-semibold text-gray-900">{score}/{questions.length} to'g'ri javob — {Math.round(score / questions.length * 100)}%</p>
                            <p className="text-xs text-gray-400 mt-1">Natijalar AI ustozga yuborildi, tahlil kutilmoqda...</p>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Markdown with KaTeX + Test detection
    const MdMessage = ({ content }: { content: string }) => (
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
            code: ({ children, className }) => {
                // Detect test blocks
                if (className?.includes('language-test')) {
                    const jsonStr = String(children).trim()
                    return <TestWidget jsonStr={jsonStr} />
                }
                const isBlock = className?.includes('language-')
                return isBlock
                    ? <pre className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 text-[13px] overflow-x-auto my-3 font-mono leading-relaxed"><code>{children}</code></pre>
                    : <code className="bg-blue-50 text-blue-800 border border-blue-100 px-1.5 py-0.5 rounded-md text-[13px] font-mono">{children}</code>
            },
            blockquote: ({ children }) => <blockquote className="border-l-[3px] border-blue-400 bg-blue-50/40 rounded-r-xl pl-4 pr-3 py-2 my-3 text-gray-700">{children}</blockquote>,
            hr: () => <hr className="border-gray-100 my-4" />,
        }}>{content}</ReactMarkdown>
    )

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
            <div className={`${sideOpen ? 'w-72' : 'w-0'} bg-[#f5f5f5] flex flex-col transition-all duration-200 overflow-hidden border-r border-gray-200/80 flex-shrink-0`}>
                <div className="p-3 flex items-center justify-between h-14">
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center">
                            <BrainCircuit className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className="text-sm font-bold text-gray-900">msert</span>
                    </div>
                    <button onClick={() => setSideOpen(false)} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-200/80 transition"><X className="h-4 w-4" /></button>
                </div>

                {/* Side tabs */}
                <div className="flex mx-3 mb-2 bg-gray-200/60 rounded-lg p-0.5">
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
                        {publicTests.map((t: any) => (
                            <div key={t.id} className="bg-white rounded-lg p-3 border border-gray-100 cursor-pointer hover:shadow-sm transition">
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
            <div className="flex-1 flex flex-col min-w-0">
                <div className="h-14 flex items-center px-4 gap-3 flex-shrink-0">
                    {!sideOpen && <button onClick={() => setSideOpen(true)} className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition"><Menu className="h-4 w-4" /></button>}
                    <span className="text-sm font-medium text-gray-500 truncate">{currentChat?.title || ''}</span>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto">
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
                                        <div className="flex-1 text-[14px] leading-relaxed text-gray-800 py-1"><MdMessage content={m.content} /></div>
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
                                    <div className="flex-1 text-[14px] leading-relaxed text-gray-800 py-1"><MdMessage content={streaming} /></div>
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
                            <div ref={endRef} />
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
                            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 shadow-sm focus-within:border-gray-300 focus-within:shadow-md transition-all">
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
                                    <button type="submit" disabled={!input.trim()}
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
        </div>
    )
}
