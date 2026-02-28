import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

interface Chat { id: string; title: string; subject?: string; updatedAt: string }
interface Msg { id: string; role: string; content: string; createdAt: string }

export default function ChatLayout() {
    const { chatId } = useParams()
    const nav = useNavigate()
    const { user, logout } = useAuthStore()
    const [chats, setChats] = useState<Chat[]>([])
    const [messages, setMessages] = useState<Msg[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [sideOpen, setSideOpen] = useState(true)
    const [currentChat, setCurrentChat] = useState<Chat | null>(null)
    const endRef = useRef<HTMLDivElement>(null)

    // Chat ro'yxatini yuklash
    useEffect(() => { loadChats() }, [])
    useEffect(() => { if (chatId) loadMessages(chatId) }, [chatId])
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

    async function loadChats() {
        try { const data = await fetchApi('/chat/list'); setChats(data) } catch { }
    }

    async function loadMessages(id: string) {
        try {
            const data = await fetchApi(`/chat/${id}/messages`)
            setMessages(data.messages)
            setCurrentChat(data.chat)
        } catch { }
    }

    async function createChat() {
        try {
            const data = await fetchApi('/chat/new', { method: 'POST', body: JSON.stringify({ title: 'Yangi suhbat' }) })
            await loadChats()
            nav(`/chat/${data.id}`)
        } catch { }
    }

    async function sendMessage(e: React.FormEvent) {
        e.preventDefault()
        if (!input.trim() || !chatId || loading) return
        const text = input; setInput('')
        setMessages(prev => [...prev, { id: 'temp', role: 'user', content: text, createdAt: new Date().toISOString() }])
        setLoading(true)
        try {
            const reply = await fetchApi(`/chat/${chatId}/send`, { method: 'POST', body: JSON.stringify({ content: text }) })
            setMessages(prev => [...prev.filter(m => m.id !== 'temp' || m.role !== 'user'), { id: 'u-' + Date.now(), role: 'user', content: text, createdAt: new Date().toISOString() }, reply])
            loadChats()
        } catch {
            setMessages(prev => [...prev, { id: 'err', role: 'assistant', content: 'Xatolik yuz berdi. Qayta urinib ko\'ring.', createdAt: new Date().toISOString() }])
        }
        setLoading(false)
    }

    async function deleteChat(id: string) {
        try {
            await fetchApi(`/chat/${id}`, { method: 'DELETE' })
            if (chatId === id) { nav('/chat'); setMessages([]); setCurrentChat(null) }
            loadChats()
        } catch { }
    }

    return (
        <div className="h-screen flex bg-gray-50">
            {/* Sidebar */}
            <div className={`${sideOpen ? 'w-72' : 'w-0'} bg-gray-900 flex flex-col transition-all duration-300 overflow-hidden`}>
                <div className="p-4 flex items-center justify-between">
                    <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">msert</span>
                    <button onClick={() => setSideOpen(false)} className="text-gray-400 hover:text-white text-lg">✕</button>
                </div>

                {/* Yangi chat */}
                <button onClick={createChat} className="mx-3 mb-3 h-10 flex items-center justify-center gap-2 rounded-xl border border-gray-700 text-sm text-gray-300 hover:bg-gray-800 transition">
                    ＋ Yangi suhbat
                </button>

                {/* Chatlar */}
                <div className="flex-1 overflow-y-auto px-3 space-y-1">
                    {chats.map(c => (
                        <div key={c.id} className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer text-sm transition ${chatId === c.id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'}`}
                            onClick={() => nav(`/chat/${c.id}`)}>
                            <span className="flex-1 truncate">{c.title}</span>
                            <button onClick={(e) => { e.stopPropagation(); deleteChat(c.id) }} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-xs transition">✕</button>
                        </div>
                    ))}
                </div>

                {/* User */}
                <div className="p-3 border-t border-gray-800">
                    <div className="flex items-center gap-3 px-3 py-2">
                        <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">{user?.name?.[0]}</div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{user?.name}</p>
                            <p className="text-xs text-gray-500">{user?.role}</p>
                        </div>
                        <button onClick={() => { logout(); nav('/login') }} className="text-gray-500 hover:text-red-400 text-xs">Chiqish</button>
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Top bar */}
                <div className="h-14 border-b border-gray-200 bg-white flex items-center px-4 gap-3">
                    {!sideOpen && <button onClick={() => setSideOpen(true)} className="text-gray-400 hover:text-gray-600 text-lg">☰</button>}
                    <span className="text-sm font-medium text-gray-700 truncate">{currentChat?.title || 'msert AI Ustoz'}</span>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto">
                    {!chatId ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center anim-up">
                                <div className="text-5xl mb-4">🧠</div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">msert AI Ustoz</h2>
                                <p className="text-gray-400 mb-6 max-w-sm">Yangi suhbat oching va imtihonga tayyorgarlikni boshlang</p>
                                <button onClick={createChat} className="h-11 px-8 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/25">
                                    Yangi suhbat boshlash
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
                            {messages.map((m, i) => (
                                <div key={m.id || i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
                                    {m.role !== 'user' && (
                                        <div className="h-8 w-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mt-0.5">AI</div>
                                    )}
                                    <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'user'
                                            ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-br-md shadow-md'
                                            : 'bg-white border border-gray-100 text-gray-800 rounded-bl-md shadow-sm'
                                        }`}>{m.content}</div>
                                    {m.role === 'user' && (
                                        <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mt-0.5">{user?.name?.[0]}</div>
                                    )}
                                </div>
                            ))}
                            {loading && (
                                <div className="flex gap-3">
                                    <div className="h-8 w-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">AI</div>
                                    <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                                        <div className="flex gap-1"><span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" /><span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:150ms]" /><span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:300ms]" /></div>
                                    </div>
                                </div>
                            )}
                            <div ref={endRef} />
                        </div>
                    )}
                </div>

                {/* Input */}
                {chatId && (
                    <div className="p-4 border-t border-gray-200 bg-white">
                        <form onSubmit={sendMessage} className="max-w-3xl mx-auto flex gap-3">
                            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Savolingizni yozing..." disabled={loading}
                                className="flex-1 h-12 px-5 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm transition" />
                            <button type="submit" disabled={loading || !input.trim()} className="h-12 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-medium text-sm shadow-lg shadow-blue-500/20 disabled:opacity-40 transition">
                                Yuborish
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    )
}
