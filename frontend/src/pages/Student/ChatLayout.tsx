import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BrainCircuit, Plus, Trash2, LogOut, Send, Menu, X, GraduationCap, ClipboardList, Settings } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

interface Chat { id: string; title: string; subject?: string; updatedAt: string }
interface Msg { id: string; role: string; content: string; createdAt: string }
interface Profile { onboardingDone: boolean; subject?: string; examDate?: string; targetScore?: number; weakTopics?: string; strongTopics?: string; concerns?: string }

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
    const [sideTab, setSideTab] = useState<'chats' | 'tests'>('chats')
    const [publicTests, setPublicTests] = useState<any[]>([])
    const [onboardingForm, setOnboardingForm] = useState({
        subject: 'Matematika', targetScore: 80, examDate: '',
        weakTopics: '', strongTopics: '', concerns: ''
    })
    const [savingProfile, setSavingProfile] = useState(false)
    const endRef = useRef<HTMLDivElement>(null)

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
        try { setChats(await fetchApi('/chat/list')) } catch { }
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

    async function sendMessage(e: React.FormEvent) {
        e.preventDefault()
        if (!input.trim() || !chatId || loading) return
        const text = input; setInput('')
        setMessages(prev => [...prev, { id: 'temp-u', role: 'user', content: text, createdAt: new Date().toISOString() }])
        setLoading(true)
        setStreaming('')

        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`/api/chat/${chatId}/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ content: text })
            })

            if (!res.ok) throw new Error('Server xatoligi')

            const reader = res.body?.getReader()
            const decoder = new TextDecoder()
            let fullText = ''

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    const chunk = decoder.decode(value, { stream: true })
                    const lines = chunk.split('\n')
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6))
                                if (data.content) {
                                    fullText += data.content
                                    setStreaming(fullText)
                                }
                                if (data.done) {
                                    setMessages(prev => {
                                        const filtered = prev.filter(m => m.id !== 'temp-u')
                                        return [
                                            ...filtered,
                                            { id: 'u-' + Date.now(), role: 'user', content: text, createdAt: new Date().toISOString() },
                                            { id: data.id || 'a-' + Date.now(), role: 'assistant', content: fullText, createdAt: new Date().toISOString() }
                                        ]
                                    })
                                    setStreaming('')
                                    loadChats()
                                }
                            } catch { }
                        }
                    }
                }
            }

            // Agar stream tugasa lekin done kelmasa
            if (fullText && streaming) {
                setMessages(prev => {
                    const filtered = prev.filter(m => m.id !== 'temp-u')
                    return [
                        ...filtered,
                        { id: 'u-' + Date.now(), role: 'user', content: text, createdAt: new Date().toISOString() },
                        { id: 'a-' + Date.now(), role: 'assistant', content: fullText, createdAt: new Date().toISOString() }
                    ]
                })
                setStreaming('')
                loadChats()
            }
        } catch {
            setMessages(prev => [...prev, { id: 'err', role: 'assistant', content: 'Xatolik yuz berdi. Qayta urinib ko\'ring.', createdAt: new Date().toISOString() }])
            setStreaming('')
        }
        setLoading(false)
    }

    async function deleteChat(id: string, e: React.MouseEvent) {
        e.stopPropagation()
        try {
            await fetchApi(`/chat/${id}`, { method: 'DELETE' })
            if (chatId === id) { nav('/chat'); setMessages([]); setCurrentChat(null) }
            loadChats()
        } catch { }
    }

    // Markdown component
    const MdMessage = ({ content }: { content: string }) => (
        <ReactMarkdown components={{
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
                            <button type="button" onClick={() => setShowOnboarding(false)} className="h-11 px-6 rounded-xl text-sm text-gray-500 border border-gray-200 hover:bg-gray-50 transition">Bekor</button>
                        </div>
                    </form>
                </div>
            </div>
        )
    }

    return (
        <div className="h-screen flex bg-[#fafafa]">
            {/* Sidebar */}
            <div className={`${sideOpen ? 'w-64' : 'w-0'} bg-[#f5f5f5] flex flex-col transition-all duration-200 overflow-hidden border-r border-gray-200/80 flex-shrink-0`}>
                <div className="p-3 flex items-center justify-between h-14">
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center">
                            <BrainCircuit className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className="text-sm font-bold text-gray-900">msert</span>
                    </div>
                    <button onClick={() => setSideOpen(false)} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-200/80 transition"><X className="h-4 w-4" /></button>
                </div>

                {/* Side tabs: Chats / Tests */}
                <div className="flex mx-3 mb-2 bg-gray-200/60 rounded-lg p-0.5">
                    <button onClick={() => setSideTab('chats')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${sideTab === 'chats' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Suhbatlar</button>
                    <button onClick={() => setSideTab('tests')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${sideTab === 'tests' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Testlar</button>
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
                                    <p className="text-sm text-gray-400">Bugun nima o'rganmoqchisiz? Quyidagilardan birini tanlang yoki o'zingiz yozing</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { icon: '📖', title: 'Mavzu tushuntir', desc: 'Mavzuni boshidan tushuntirib ber', prompt: 'Menga bugungi mavzuni boshidan tushuntirib bering' },
                                        { icon: '📝', title: 'Bilimimni testla', desc: 'Test savollari bilan tekshir', prompt: 'Mening bilimimni test savollari bilan tekshiring' },
                                        { icon: '📋', title: 'O\'quv reja tuz', desc: 'Imtihongacha bo\'lgan reja', prompt: 'Imtihongacha bo\'lgan kunlar uchun o\'quv reja tuzing' },
                                        { icon: '💡', title: 'Formula va qoidalar', desc: 'Asosiy formulalarni ko\'rsat', prompt: 'Bu fandagi eng muhim formulalar va qoidalarni ko\'rsating' },
                                        { icon: '🔍', title: 'Zaif joylarimni aniqla', desc: 'Qayerda qiynalayotganimni top', prompt: 'Menga savollar berib zaif joylarimni aniqlang' },
                                        { icon: '🎯', title: 'Imtihon strategiya', desc: 'Vaqt boshqarish, taktika', prompt: 'Milliy sertifikat imtihonida vaqt boshqarish va javob berish strategiyasini o\'rgating' },
                                    ].map((s, i) => (
                                        <button key={i} onClick={async () => {
                                            if (creating) return; setCreating(true)
                                            try {
                                                const data = await fetchApi('/chat/new', { method: 'POST', body: JSON.stringify({ title: s.title, subject: profile?.subject }) })
                                                await loadChats()
                                                nav(`/chat/${data.id}`)
                                                // Auto-send after navigation
                                                setTimeout(async () => {
                                                    try {
                                                        setInput(s.prompt)
                                                        const token = localStorage.getItem('token')
                                                        setMessages([{ id: 'temp-u', role: 'user', content: s.prompt, createdAt: new Date().toISOString() }])
                                                        setLoading(true); setStreaming('')
                                                        const res = await fetch(`/api/chat/${data.id}/stream`, {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                                            body: JSON.stringify({ content: s.prompt })
                                                        })
                                                        if (!res.ok) throw new Error()
                                                        const reader = res.body?.getReader()
                                                        const decoder = new TextDecoder()
                                                        let fullText = ''
                                                        if (reader) {
                                                            while (true) {
                                                                const { done, value } = await reader.read()
                                                                if (done) break
                                                                const chunk = decoder.decode(value, { stream: true })
                                                                for (const line of chunk.split('\n')) {
                                                                    if (line.startsWith('data: ')) {
                                                                        try {
                                                                            const d = JSON.parse(line.slice(6))
                                                                            if (d.content) { fullText += d.content; setStreaming(fullText) }
                                                                            if (d.done) {
                                                                                setMessages([
                                                                                    { id: 'u-' + Date.now(), role: 'user', content: s.prompt, createdAt: new Date().toISOString() },
                                                                                    { id: d.id || 'a-' + Date.now(), role: 'assistant', content: fullText, createdAt: new Date().toISOString() }
                                                                                ])
                                                                                setStreaming(''); loadChats()
                                                                            }
                                                                        } catch { }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                        setInput(''); setLoading(false)
                                                    } catch { setLoading(false) }
                                                }, 300)
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
                            {/* Streaming message */}
                            {streaming && (
                                <div className="flex gap-3">
                                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex-shrink-0 flex items-center justify-center mt-0.5"><BrainCircuit className="h-3.5 w-3.5 text-white" /></div>
                                    <div className="flex-1 text-[14px] leading-relaxed text-gray-800 py-1"><MdMessage content={streaming} /></div>
                                </div>
                            )}
                            {loading && !streaming && (
                                <div className="flex gap-3">
                                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex-shrink-0 flex items-center justify-center"><BrainCircuit className="h-3.5 w-3.5 text-white" /></div>
                                    <div className="flex gap-1 py-3"><span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" /><span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:150ms]" /><span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:300ms]" /></div>
                                </div>
                            )}
                            <div ref={endRef} />
                        </div>
                    )}
                </div>

                {/* Input */}
                {chatId && (
                    <div className="px-4 pb-6 pt-2">
                        <form onSubmit={sendMessage} className="max-w-5xl mx-auto">
                            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 shadow-sm focus-within:border-gray-300 focus-within:shadow-md transition-all">
                                <input value={input} onChange={e => setInput(e.target.value)} placeholder="Xabar yozing..." disabled={loading}
                                    className="flex-1 h-12 bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400" />
                                <button type="submit" disabled={loading || !input.trim()}
                                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-gray-900 text-white disabled:bg-gray-200 disabled:text-gray-400 transition"><Send className="h-3.5 w-3.5" /></button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    )
}
