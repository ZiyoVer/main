import React, { useState, useEffect, useRef, useCallback, memo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BrainCircuit, Plus, Trash2, LogOut, Send, Menu, X, GraduationCap, ClipboardList, Settings, BookOpen, Target, Flame, MessageSquare, FileText, Zap, Square, Lightbulb, Maximize2, Minimize2, Paperclip, Layers, ChevronLeft, ChevronRight, RotateCcw, Sun, Moon, Search, AlertTriangle, TrendingUp, Brain, PenLine, CheckCircle, Bell } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import rehypeSanitize from 'rehype-sanitize'
import DOMPurify from 'dompurify'
import 'katex/dist/katex.min.css'
import katex from 'katex'
import toast from 'react-hot-toast'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import ChatContext, { useChatContext } from '../../contexts/ChatContext'
import { useTestPanel } from '../../hooks/useTestPanel'
import { useFlashPanel } from '../../hooks/useFlashPanel'

interface Chat { id: string; title: string; subject?: string; updatedAt: string }
interface Msg { id: string; role: string; content: string; createdAt: string }
interface Profile { onboardingDone: boolean; subject?: string; subject2?: string; examDate?: string; targetScore?: number; weakTopics?: string; strongTopics?: string; concerns?: string; totalTests?: number; avgScore?: number; abilityLevel?: number }
interface PublicTest { id: string; title: string; subject?: string; _count?: { questions: number; attempts: number } }
interface MyResult { id: string; testId: string; score: number; total: number; createdAt: string }

// Test paneli uchun inline KaTeX renderer (ReactMarkdown ishlatmaymiz, tez va engil)
function MathText({ text }: { text: string }) {
    if (!text?.includes('$')) return <>{text}</>
    try {
        const html = text
            .replace(/\$\$([^$]+)\$\$/g, (_, m) => katex.renderToString(m.trim(), { displayMode: true, throwOnError: false }))
            .replace(/\$([^$\n]+)\$/g, (_, m) => katex.renderToString(m.trim(), { throwOnError: false }))
        return <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
    } catch { return <>{text}</> }
}

// DeepSeek \[...\] va \(...\) formatini $$...$$ va $...$ ga o'giradi
function preprocessMath(text: string): string {
    return text
        .replace(/\\\[(\s*[\s\S]*?\s*)\\\]/g, (_, m) => `$$${m}$$`)
        .replace(/\\\((\s*[\s\S]*?\s*)\\\)/g, (_, m) => `$${m}$`)
}

// MdMessage komponentni tashqarida va memo bilan ta'riflaymiz —
// shunda har keystrokeda re-render bo'lmaydi (ReactMarkdown+KaTeX qimmat!)
const MdMessage = memo(({ content, isStreaming }: {
    content: string
    isStreaming?: boolean
}) => {
    const { onOpenTest, onProfileUpdate, onOpenFlash } = useChatContext()
    const processedContent = preprocessMath(content)
    return (
        <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} components={{
            img: ({ src, alt }) => <img src={src} alt={alt || ''} className="max-h-48 max-w-[90%] sm:max-w-sm md:max-w-md rounded-xl object-contain my-1" style={{ border: '1px solid var(--border)' }} />,
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
                    if (count === 0) return null
                    return (
                        <div className="my-3 rounded-2xl overflow-hidden" style={{
                            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0.04) 100%)',
                            border: '1.5px solid rgba(99, 102, 241, 0.3)',
                        }}>
                            <div className="p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#6366f1' }}>
                                            <Layers className="h-5 w-5 text-white" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Kartochkalar tayyor!</p>
                                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#6366f1', color: '#fff' }}>
                                                    {count} ta karta
                                                </span>
                                            </div>
                                            <p className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>Aylantiring — formula va javoblarni ko'ring</p>
                                        </div>
                                    </div>
                                    {!isStreaming && onOpenFlash && (
                                        <button
                                            onClick={() => onOpenFlash(jsonStr)}
                                            className="flex-shrink-0 h-9 px-4 rounded-xl text-[13px] font-bold text-white flex items-center gap-2 transition-all"
                                            style={{ background: '#6366f1' }}
                                            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                                            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                                        >
                                            <Layers className="h-4 w-4" /> Boshlash
                                        </button>
                                    )}
                                </div>
                            </div>
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
        }}>{processedContent}</ReactMarkdown>
    )
})

type AttachedFile = { id: string; name: string; text: string; type: string; previewUrl?: string }

interface ChatInputAreaProps {
    chatId: string | undefined
    loading: boolean
    thinkingMode: boolean
    setThinkingMode: (v: boolean) => void
    onSend: (text: string, files: AttachedFile[]) => void
    onStop: () => void
    blobUrlsRef: React.MutableRefObject<string[]>
    messagesCount: number
}

const ChatInputArea = memo(function ChatInputArea({
    chatId, loading, thinkingMode, setThinkingMode, onSend, onStop, blobUrlsRef, messagesCount
}: ChatInputAreaProps) {
    const [input, setInput] = useState('')
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
    const [uploadingFile, setUploadingFile] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const adjustTextareaHeight = useCallback(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    }, [])

    async function uploadFiles(filesToUpload: File[]) {
        if (!chatId) return
        setUploadingFile(true)
        try {
            const token = localStorage.getItem('token')
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
            toast.error('Fayl yuklashda xato: ' + (e?.message || "Qayta urinib ko'ring"))
        }
        setUploadingFile(false)
    }

    async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files || [])
        if (!files.length) return
        if (attachedFiles.length + files.length > 5) {
            toast.error("Birdaniga eng ko'pi bilan 5 ta rasm/fayl yuborish mumkin")
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
            if (file) filesToUpload.push(new File([file], `screenshot-${Date.now()}-${Math.floor(Math.random() * 1000)}.png`, { type: file.type }))
        }
        if (attachedFiles.length + filesToUpload.length > 5) {
            toast.error("Birdaniga eng ko'pi bilan 5 ta rasm/fayl yuborish mumkin")
            return
        }
        await uploadFiles(filesToUpload)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if ((!input.trim() && attachedFiles.length === 0) || loading) return
        const text = input.trim()
        const files = [...attachedFiles]
        files.forEach(f => { if (f.previewUrl) blobUrlsRef.current.push(f.previewUrl) })
        setInput('')
        setAttachedFiles([])
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
        onSend(text, files)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (!loading && (input.trim() || attachedFiles.length > 0)) handleSubmit(e as any)
        }
    }

    const QUICK_ACTIONS = [
        { Icon: ClipboardList, l: 'Testla', p: "Meni shu mavzu bo'yicha testlang. 5 ta test savol bering A, B, C, D variantlar bilan." },
        { Icon: BookOpen, l: 'Davom et', p: "Keyingi mavzuga o'tamiz. Nimani o'rganishimiz kerak?" },
        { Icon: RotateCcw, l: 'Qayta tushuntir', p: 'Bu mavzuni boshqa usulda, oddiyroq tushuntiring' },
        { Icon: Target, l: 'Reja tuz', p: "Imtihongacha qolgan vaqtga mos o'quv reja tuzing" },
        { Icon: Lightbulb, l: 'Formulalar', p: 'Shu mavzuning barcha muhim formulalarini yozing' },
        { Icon: Layers, l: 'Kartochkalar', p: "Shu mavzuning eng muhim formulalari va tushunchalarini kartochka formatida bering (```flashcard JSON format)." },
    ]

    return (
        <div className="px-3 sm:px-4 pb-4 sm:pb-5 pt-2 chat-input-area" style={{ borderTop: '1px solid var(--border)' }}>
            {!loading && messagesCount > 0 && (
                <div className="max-w-5xl mx-auto mb-2 flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {QUICK_ACTIONS.map((a, i) => (
                        <button key={i} onClick={() => { if (!chatId || loading) return; onSend(a.p, []) }}
                            className="h-7 px-3 text-[12px] font-medium rounded-full transition whitespace-nowrap flex items-center gap-1.5 flex-shrink-0"
                            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-strong)', background: 'var(--bg-card)' }}
                        ><a.Icon className="h-3 w-3 flex-shrink-0" />{a.l}</button>
                    ))}
                </div>
            )}
            <form onSubmit={handleSubmit} className="max-w-5xl mx-auto">
                {attachedFiles.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2 z-10 px-2 pb-1 relative">
                        {attachedFiles.map(file => (
                            <div key={file.id} className="relative rounded-xl p-1.5 w-[72px] h-[72px] flex flex-col items-center justify-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                <button type="button" onClick={() => {
                                    if (file.previewUrl) URL.revokeObjectURL(file.previewUrl)
                                    setAttachedFiles(prev => prev.filter(f => f.id !== file.id))
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
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={e => { setInput(e.target.value); adjustTextareaHeight() }}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        placeholder="Xabar yozing..."
                        disabled={loading}
                        rows={1}
                        className="flex-1 bg-transparent outline-none text-sm resize-none leading-relaxed"
                        style={{ color: 'var(--text-primary)', minHeight: '44px', maxHeight: '120px', paddingTop: '12px', paddingBottom: '12px' }}
                    />
                    <button type="button" onClick={() => setThinkingMode(!thinkingMode)}
                        title={thinkingMode ? 'Chuqur fikrlash yoqilgan' : 'Chuqur fikrlash'}
                        className="h-8 w-8 flex items-center justify-center rounded-lg transition"
                        style={thinkingMode ? { background: 'var(--brand-light)', color: 'var(--brand)' } : { color: 'var(--text-muted)' }}>
                        <Lightbulb className="h-3.5 w-3.5" />
                    </button>
                    {loading ? (
                        <button type="button" onClick={onStop}
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
    )
})

export default function ChatLayout() {
    const { chatId } = useParams()
    const nav = useNavigate()
    const { user, logout, token } = useAuthStore()
    const [chats, setChats] = useState<Chat[]>([])
    const [messages, setMessages] = useState<Msg[]>([])
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
    const [publicTests, setPublicTests] = useState<PublicTest[]>([])
    const [myResults, setMyResults] = useState<MyResult[]>([])
    const [stats, setStats] = useState({ chats: 0, messages: 0, streak: 0 })
    const [progressData, setProgressData] = useState<{ xp: number; streak: number; longestStreak: number; currentStreak: number; avgScore: number; weeklyActivity: Array<{ day: string; count: number }> } | null>(null)
    const [dueFlashcards, setDueFlashcards] = useState<Array<{ id: string; front: string; back: string; subject: string }>>([])
    const [dueCount, setDueCount] = useState(0)
    const [totalFlashcards, setTotalFlashcards] = useState(0)
    const [flashIsReview, setFlashIsReview] = useState(false)
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    const [onboardingForm, setOnboardingForm] = useState({
        subject: 'Matematika', subject2: '', targetScore: 80, examDate: '',
        weakTopics: '', strongTopics: '', concerns: ''
    })
    const [savingProfile, setSavingProfile] = useState(false)
    const [emailVerified, setEmailVerified] = useState<boolean>(user?.emailVerified ?? true)
    const [resendingVerif, setResendingVerif] = useState(false)
    const [verifBannerDismissed, setVerifBannerDismissed] = useState(
        () => localStorage.getItem('dtmmax_verif_dismissed') === '1'
    )
    const [notifCount, setNotifCount] = useState(0)
    const [notifications, setNotifications] = useState<any[]>([])
    const [notifLoading, setNotifLoading] = useState(false)
    const [changePwForm, setChangePwForm] = useState({ current: '', newPw: '', confirm: '' })
    const [changePwLoading, setChangePwLoading] = useState(false)
    const [changePwErr, setChangePwErr] = useState('')
    const [changePwOk, setChangePwOk] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deletePassword, setDeletePassword] = useState('')
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [deleteErr, setDeleteErr] = useState('')
    const [thinkingMode, setThinkingMode] = useState(false)
    const [thinkingText, setThinkingText] = useState('')
    const scrollRef = useRef<HTMLDivElement>(null)
    const userScrolledRef = useRef(false)
    const blobUrlsRef = useRef<string[]>([])
    const abortRef = useRef<AbortController | null>(null)
    const profileRef = useRef<Profile | null>(null)
    const [testsLoading, setTestsLoading] = useState(false)
    // Yechilgan testlar IDlarini localStorage da saqlaymiz
    const completedTestIdsRef = useRef<Set<string>>((() => {
        try { return new Set(JSON.parse(localStorage.getItem('dtmmax_done_tests') || '[]')) } catch { return new Set() }
    })())
    // AI tomonidan yaratilgan yechilgan testlarni saqlash (JSON kaliti bo'yicha)
    const completedAiTestsRef = useRef<Set<string>>((() => {
        try { return new Set(JSON.parse(localStorage.getItem('dtmmax_done_ai_tests') || '[]')) } catch { return new Set() }
    })())

    // Hook'lar
    const {
        testPanel, setTestPanel, testAnswers, setTestAnswers, testSubmitted, setTestSubmitted,
        testPanelMaximized, setTestPanelMaximized, activeTestId, setActiveTestId,
        activeTestQuestions, setActiveTestQuestions, testReadOnly, setTestReadOnly,
        testWidth, setTestWidth, testDragRef, testTimeLeft, setTestTimeLeft,
        raschFeedback, setRaschFeedback, loadingPublicTest, setLoadingPublicTest,
        openTestPanel,
    } = useTestPanel(completedTestIdsRef, completedAiTestsRef)

    const {
        flashPanel, setFlashPanel, flashIdx, setFlashIdx, flashFlipped, setFlashFlipped,
        flashMaximized, setFlashMaximized, flashWidth, setFlashWidth,
        flashDragRef, flashWidthRef, openFlashPanel,
    } = useFlashPanel()

    const loadControllerRef = useRef<AbortController | null>(null)
    const isSubmittingRef = useRef(false)
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const w = window.innerWidth
        if (w < 768) return 288
        if (w <= 1024) return 240
        return 288
    })
    const sidebarDragRef = useRef(false)
    const [isSidebarDragging, setIsSidebarDragging] = useState(false)

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

    useEffect(() => {
        loadChats(); loadProfile(); loadPublicTests(); loadMyResults(); loadProgress(); loadDueFlashcards(); logActivity()
        return () => {
            blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
            blobUrlsRef.current = []
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (chatId) loadMessages(chatId) }, [chatId])

    // Panel drag-to-resize (flashcard + test)
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (flashDragRef.current) {
                const newWidth = Math.max(280, Math.min(900, window.innerWidth - e.clientX))
                flashWidthRef.current = newWidth
                const el = document.querySelector('.flash-panel') as HTMLElement
                if (el) el.style.width = newWidth + 'px'
            }
            if (testDragRef.current) setTestWidth(Math.max(280, Math.min(900, window.innerWidth - e.clientX)))
            if (sidebarDragRef.current) setSidebarWidth(Math.max(240, Math.min(600, e.clientX)))
        }
        const onUp = () => {
            if (flashDragRef.current) setFlashWidth(flashWidthRef.current)
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
    // Scroll: user yuqoriga wheel qilsa auto-scroll to'xtatamiz, pastga qaytsa davom etadi
    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        const onWheel = (e: WheelEvent) => {
            if (e.deltaY < 0) userScrolledRef.current = true
        }
        const onScroll = () => {
            const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
            if (isNearBottom) userScrolledRef.current = false
        }
        el.addEventListener('wheel', onWheel, { passive: true })
        el.addEventListener('scroll', onScroll, { passive: true })
        return () => {
            el.removeEventListener('wheel', onWheel)
            el.removeEventListener('scroll', onScroll)
        }
    }, [])
    // Auto-scroll faqat user pastda bo'lsa ishlaydi
    useEffect(() => {
        if (userScrolledRef.current) return
        const el = scrollRef.current
        if (!el) return
        el.scrollTop = el.scrollHeight
    }, [messages, streaming])
    // chatId o'zgarganda blobUrllarni tozalash va scroll reset
    useEffect(() => {
        userScrolledRef.current = false
        blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
        blobUrlsRef.current = []
    }, [chatId])

    // Test panel yopilganda timerni tozalash
    useEffect(() => {
        if (!testPanel) { setTestTimeLeft(null); setRaschFeedback(null) }
    }, [testPanel])

    // Notification count — har daqiqa yangilanadi
    useEffect(() => {
        if (!token) return
        const fetchCount = async () => {
            try {
                const data = await fetchApi('/notifications?count=true')
                setNotifCount(data.count || 0)
            } catch { }
        }
        fetchCount()
        const interval = setInterval(fetchCount, 60000)
        return () => clearInterval(interval)
    }, [token])

    // Timer countdown (setInterval — har sekund 1 ta kamayadi)
    useEffect(() => {
        if (testTimeLeft === null || testTimeLeft <= 0) return
        const id = setInterval(() => {
            setTestTimeLeft(t => (t !== null && t > 0) ? t - 1 : null)
        }, 1000)
        return () => clearInterval(id)
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
                let weak: string[] = []
                let strong: string[] = []
                try { weak = p.weakTopics ? JSON.parse(p.weakTopics) : [] } catch { /* invalid JSON */ }
                try { strong = p.strongTopics ? JSON.parse(p.strongTopics) : [] } catch { /* invalid JSON */ }
                setOnboardingForm({
                    subject: p.subject || 'Matematika',
                    subject2: (p as any).subject2 || '',
                    targetScore: p.targetScore || 80,
                    examDate: p.examDate ? new Date(p.examDate).toISOString().split('T')[0] : '',
                    weakTopics: weak.join(', '),
                    strongTopics: strong.join(', '),
                    concerns: p.concerns || ''
                })
            }
        } catch (err) { console.error('loadProfile:', err); setShowOnboarding(true) }
    }

    async function loadPublicTests() {
        setTestsLoading(true)
        try { setPublicTests(await fetchApi('/tests/public')) } catch (err) { console.error('loadPublicTests:', err) } finally { setTestsLoading(false) }
    }

    async function loadMyResults() {
        try { setMyResults(await fetchApi('/tests/my-results')) } catch (err) { console.error('loadMyResults:', err) }
    }

    async function loadProgress() {
        try {
            const data = await fetchApi('/progress/me')
            setProgressData(data)
        } catch (err) { console.error('loadProgress:', err) }
    }

    async function loadDueFlashcards() {
        try {
            const data = await fetchApi('/flashcards/due')
            setDueFlashcards(data.cards || [])
            setDueCount(data.dueCount || 0)
            setTotalFlashcards(data.total || 0)
        } catch (err) { console.error('loadDueFlashcards:', err) }
    }

    const loadNotifications = async () => {
        setNotifLoading(true)
        try {
            const data = await fetchApi('/notifications')
            setNotifications(data)
            setNotifCount(0)
            await fetchApi('/notifications/read-all', { method: 'PATCH' })
        } catch { } finally { setNotifLoading(false) }
    }

    const resendVerification = async () => {
        setResendingVerif(true)
        try {
            await fetchApi('/auth/resend-verification', { method: 'POST' })
            toast.success('Tasdiqlash emaili yuborildi! Spam papkasini ham tekshiring.')
        } catch (e: any) {
            toast.error(e.message || 'Email yuborishda xato')
        } finally { setResendingVerif(false) }
    }

    async function logActivity(xpGained = 5) {
        try { await fetchApi('/progress/activity', { method: 'POST', body: JSON.stringify({ xpGained }) }) } catch (err) { console.error('logActivity:', err) }
    }

    async function saveOnboarding(e: React.FormEvent) {
        e.preventDefault(); setSavingProfile(true)
        try {
            const data = {
                ...onboardingForm,
                subject2: onboardingForm.subject2 || null,
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
        } catch (err) { console.error('saveOnboarding:', err) }
        setSavingProfile(false)
    }

    async function loadChats() {
        try {
            const c = await fetchApi('/chat/list')
            setChats(c)
            setStats(prev => ({ ...prev, chats: c.length }))
        } catch (err) { console.error('loadChats:', err) }
    }

    async function loadMessages(id: string) {
        loadControllerRef.current?.abort()
        const controller = new AbortController()
        loadControllerRef.current = controller
        try {
            const data = await fetchApi(`/chat/${id}/messages`, { signal: controller.signal })
            if (controller.signal.aborted) return
            setMessages(data.messages)
            setCurrentChat(data.chat)
            // Yangi chatga kirganda pastga scroll qilish
            setTimeout(() => {
                const el = scrollRef.current
                if (el) el.scrollTop = el.scrollHeight
            }, 50)
        } catch (err: any) {
            if (err?.name === 'AbortError') return
            console.error('loadMessages:', err)
        }
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
        } catch (err) { console.error('createChat:', err) }
        setCreating(false)
    }, [creating, profile])

    // Stream helper — displayText ixtiyoriy: chatda ko'rinadigan matn (prompt AI ga yuboriladi)
    async function streamToChat(targetChatId: string, prompt: string, displayText?: string) {
        const shown = displayText !== undefined ? displayText : prompt
        setLoading(true); setStreaming(''); setThinkingText('')
        const controller = new AbortController()
        abortRef.current = controller
        let fullText = '' // local ref — stale closure muammosini oldini olish uchun
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
            let thinkBuf = ''
            if (reader) {
                try {
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
                } finally {
                    try { reader?.cancel() } catch { }
                }
            }
        } catch (err: any) {
            if (err?.name === 'AbortError') {
                // User stopped — fullText local variable ishlatamiz (stale closure yo'q)
                if (fullText.trim()) {
                    setMessages(prev => {
                        const filtered = prev.filter(m => m.id !== 'temp-u')
                        return [...filtered,
                        { id: 'u-' + Date.now(), role: 'user', content: shown, createdAt: new Date().toISOString() },
                        { id: 'a-' + Date.now(), role: 'assistant', content: fullText + '\n\n*[To\'xtatildi]*', createdAt: new Date().toISOString() }
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
        setLoading(false); abortRef.current = null
    }

    function stopGeneration() {
        abortRef.current?.abort()
        abortRef.current = null
    }

    const handleSend = useCallback(async (text: string, files: AttachedFile[]) => {
        if (loading) return
        logActivity(5)

        // chatId yo'q bo'lsa yangi chat yaratib, unga o'tamiz
        let targetChatId = chatId
        if (!targetChatId) {
            try {
                const data = await fetchApi('/chat/new', {
                    method: 'POST',
                    body: JSON.stringify({ title: text.substring(0, 50) || 'Yangi suhbat', subject: profile?.subject, forceNew: true })
                })
                await loadChats()
                nav(`/suhbat/${data.id}`)
                targetChatId = data.id
                // Nav animatsiyasi uchun kichik kechikish
                await new Promise(r => setTimeout(r, 100))
            } catch (err) {
                console.error('Chat yaratishda xato:', err)
                return
            }
        }

        if (files.length > 0) {
            let promptText = ''
            let displayText = ''
            files.forEach(file => {
                promptText += `📎 **${file.name}** faylidan:\n\n${file.text}\n\n`
                displayText += `📎 **[${file.type === 'image' ? 'Rasm' : 'Fayl'}: ${file.name}]** `
            })
            if (text) { promptText += `\n\n${text}`; displayText += `\n\n${text}` }
            setMessages(prev => [...prev, { id: 'temp-u', role: 'user', content: displayText.trim(), createdAt: new Date().toISOString() }])
            await streamToChat(targetChatId!, promptText.trim(), displayText.trim())
        } else {
            setMessages(prev => [...prev, { id: 'temp-u', role: 'user', content: text, createdAt: new Date().toISOString() }])
            await streamToChat(targetChatId!, text)
        }
    }, [chatId, loading, profile])

    async function deleteChat(id: string, e: React.MouseEvent) {
        e.stopPropagation()
        try {
            await fetchApi(`/chat/${id}`, { method: 'DELETE' })
            if (chatId === id) { nav('/suhbat'); setMessages([]); setCurrentChat(null) }
            loadChats()
        } catch (err) { console.error('deleteChat:', err) }
    }

    // Days until exam
    const daysLeft = profile?.examDate ? Math.max(0, Math.ceil((new Date(profile.examDate).getTime() - Date.now()) / 86400000)) : null

    function markTestCompleted(testId: string) {
        completedTestIdsRef.current.add(testId)
        try { localStorage.setItem('dtmmax_done_tests', JSON.stringify([...completedTestIdsRef.current])) } catch (err) { console.warn('localStorage limit to\'lgan:', err); toast.error("Xotira to'lgan, eski ma'lumotlar o'chirilishi mumkin") }
    }

    function markAiTestCompleted(key: string) {
        completedAiTestsRef.current.add(key)
        try { localStorage.setItem('dtmmax_done_ai_tests', JSON.stringify([...completedAiTestsRef.current])) } catch (err) { console.warn('localStorage limit to\'lgan:', err); toast.error("Xotira to'lgan, eski ma'lumotlar o'chirilishi mumkin") }
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
        } catch (err) { console.error('handleProfileUpdate:', err) }
    }, [chatId])


    // Flashcard panelni ochish
    const handleOpenFlash = useCallback((jsonStr: string) => {
        try {
            const cards = JSON.parse(jsonStr)
            if (!Array.isArray(cards) || cards.length === 0) return
            setTestPanel(null) // testni yopamiz
            openFlashPanel(jsonStr)
            setFlashIsReview(false) // AI chatdan kelgan — review rejimi emas
            // DB ga saqlaymiz — Kartochkalar tabida ko'rinishi uchun (background)
            const subj = profileRef.current?.subject || 'Umumiy'
            fetchApi('/flashcards', {
                method: 'POST',
                body: JSON.stringify({ subject: subj, cards: cards.map((c: any) => ({ front: String(c.front || ''), back: String(c.back || '') })) })
            }).then(() => loadDueFlashcards()).catch((err: unknown) => { console.error('saveFlashcards:', err) })
        } catch (err) { console.error('openFlashPanel:', err) }
    }, [openFlashPanel]) // eslint-disable-line react-hooks/exhaustive-deps

    // Public test ochish (sidebar dan)
    async function openPublicTest(t: any) {
        setLoadingPublicTest(true)
        try {
            const data = await fetchApi(`/tests/by-link/${t.shareLink}`)
            const rawQuestions = data.questions || []
            // correctIdx submit qaytarmaguncha ko'rsatilmaydi — default 'a' (submit keyin yangilanadi)
            const converted = rawQuestions.map((q: any) => {
                let opts: string[] = []
                try { opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options } catch { /* invalid JSON */ }
                return {
                    id: q.id,
                    q: q.text,
                    imageUrl: q.imageUrl || null,
                    questionType: q.questionType || 'mcq',
                    a: opts[0] || '', b: opts[1] || '', c: opts[2] || '', d: opts[3] || '',
                    correct: 'a' // placeholder — submit dan keyin correctAnswers bilan yangilanadi
                }
            })
            setActiveTestId(t.id)
            setActiveTestQuestions(rawQuestions)
            if (completedTestIdsRef.current.has(t.id)) {
                // Avval yechilgan — to'g'ri javoblarni localStorage dan olish
                try {
                    const savedCorrect = localStorage.getItem('dtmmax_correct_' + t.id)
                    if (savedCorrect) {
                        const correctMap: Record<string, number> = JSON.parse(savedCorrect)
                        const withCorrect = converted.map((q: any) => {
                            const ci = correctMap[q.id]
                            return ci !== undefined ? { ...q, correct: (['a', 'b', 'c', 'd'] as const)[ci] ?? 'a' } : q
                        })
                        setTestPanel(JSON.stringify(withCorrect))
                    } else {
                        setTestPanel(JSON.stringify(converted))
                    }
                } catch { setTestPanel(JSON.stringify(converted)) }
                // Avvalgi javoblarni ham ko'rsatish
                try {
                    const savedAnswers = localStorage.getItem('dtmmax_pub_ans_' + t.id)
                    setTestAnswers(savedAnswers ? JSON.parse(savedAnswers) : {})
                } catch { setTestAnswers({}) }
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
        } catch (err) { console.error('openPublicTest:', err) }
        setLoadingPublicTest(false)
    }

    function submitTestPanel() {
        if (!testPanel) return
        if (isSubmittingRef.current) return
        isSubmittingRef.current = true
        let questions: any[] = []
        try { questions = JSON.parse(testPanel) } catch { isSubmittingRef.current = false; return }
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
        const hasImages = questions.some((q: any) => q.imageUrl)
        const summary = `--- YANGI TEST NATIJASI (bu mustaqil test) ---\nJami savol: ${questions.length}\nTo'g'ri javoblar: ${score}/${questions.length}\n\n${results}\n\nFaqat shu ${questions.length} ta savol bo'yicha tahlil qil va qaysi mavzularni qayta o'rganishim kerakligini ayt. Oldingi testlar bilan aralashma.`
        const displayMsg = `📊 Test natijasi: ${score}/${questions.length} — ${hasImages ? 'Vision AI tahlil qilmoqda...' : 'AI tahlil qilmoqda...'}`

        // Vision AI orqali rasmli savollarni tahlil qilish — DeepSeek tahlilini o'tkazib yuboramiz
        function runVisionAnalysis(addUserMsg: () => void) {
            const imageQsList = questions
                .map((q: any, i: number) => ({ q, i }))
                .filter(({ q }) => q.imageUrl)
            addUserMsg()
            setLoading(true)
            fetchApi('/tests/analyze-vision', {
                method: 'POST',
                body: JSON.stringify({
                    questions: imageQsList.map(({ q, i }) => ({
                        text: q.q,
                        imageUrl: q.imageUrl,
                        studentAnswer: testAnswers[i] || null,
                        correctAnswer: q.correct,
                        a: q.a, b: q.b, c: q.c, d: q.d
                    }))
                })
            }).then((data: any) => {
                if (data?.analysis) {
                    const fullText = `🔍 **Rasmli savollar tahlili (AI Vision):**\n\n${data.analysis}`
                    // Animatsiya: streaming state orqali xarakter-xarakter chiqarish
                    let idx = 0
                    const CHUNK = 8
                    const intervalId = setInterval(() => {
                        idx += CHUNK
                        setStreaming(fullText.slice(0, idx))
                        if (idx >= fullText.length) {
                            clearInterval(intervalId)
                            setStreaming('')
                            setLoading(false)
                            setMessages(prev => [...prev, {
                                id: 'vision-' + Date.now(),
                                role: 'assistant',
                                content: fullText,
                                createdAt: new Date().toISOString()
                            }])
                        }
                    }, 12)
                } else {
                    setLoading(false)
                }
            }).catch(() => { setLoading(false) })
        }

        if (hasImages) {
            // Faqat vision tahlil — DeepSeek tahlilini chaqirmaymiz
            if (chatId) {
                setTimeout(() => {
                    runVisionAnalysis(() =>
                        setMessages(prev => [...prev, { id: 'temp-u', role: 'user', content: displayMsg, createdAt: new Date().toISOString() }])
                    )
                }, 500)
            } else {
                setTimeout(async () => {
                    try {
                        const data = await fetchApi('/chat/new', { method: 'POST', body: JSON.stringify({ title: 'Test tahlili', subject: profile?.subject }) })
                        await loadChats()
                        nav(`/suhbat/${data.id}`)
                        setTimeout(() => {
                            runVisionAnalysis(() =>
                                setMessages([{ id: 'temp-u', role: 'user', content: displayMsg, createdAt: new Date().toISOString() }])
                            )
                        }, 300)
                    } catch (err) { console.error('submitTestPanel newChat:', err) }
                }, 500)
            }
        } else if (chatId) {
            // Rasmsiz — oddiy DeepSeek tahlili
            setTimeout(() => {
                setMessages(prev => [...prev, { id: 'temp-u', role: 'user', content: displayMsg, createdAt: new Date().toISOString() }])
                streamToChat(chatId, summary, displayMsg)
            }, 500)
        } else {
            setTimeout(async () => {
                try {
                    const data = await fetchApi('/chat/new', { method: 'POST', body: JSON.stringify({ title: 'Test tahlili', subject: profile?.subject }) })
                    await loadChats()
                    nav(`/suhbat/${data.id}`)
                    setTimeout(() => {
                        setMessages([{ id: 'temp-u', role: 'user', content: displayMsg, createdAt: new Date().toISOString() }])
                        streamToChat(data.id, summary, displayMsg)
                    }, 300)
                } catch (err) { console.error('submitTestPanel newChat:', err) }
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
                    // Submit dan keyin to'g'ri javoblarni ko'rsatish va localStorage ga saqlash
                    if (res?.correctAnswers && activeTestId) {
                        // To'g'ri javoblarni saqlash (keyingi ochilishda ishlatish uchun)
                        const correctMap: Record<string, number> = {}
                        res.correctAnswers.forEach((c: any) => { correctMap[c.id] = c.correctIdx })
                        try { localStorage.setItem('dtmmax_correct_' + activeTestId, JSON.stringify(correctMap)) } catch { }
                        // User javoblarini ham saqlaymiz
                        try { localStorage.setItem('dtmmax_pub_ans_' + activeTestId, JSON.stringify(testAnswers)) } catch { }
                        setTestPanel(prev => {
                            if (!prev) return prev
                            try {
                                const qs = JSON.parse(prev)
                                const updated = qs.map((q: any) => {
                                    const ci = correctMap[q.id]
                                    return ci !== undefined ? { ...q, correct: (['a', 'b', 'c', 'd'] as const)[ci] ?? 'a' } : q
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
            try { localStorage.setItem('dtmmax_ans_' + aiKey, JSON.stringify(testAnswers)) } catch { }
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
        isSubmittingRef.current = false
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
                        <div>
                            <label className="text-sm font-medium block mb-1.5">2-fan <span style={{ color: 'var(--text-muted)' }}>(ixtiyoriy)</span></label>
                            <select value={onboardingForm.subject2} onChange={e => setOnboardingForm(f => ({ ...f, subject2: e.target.value }))} className="input" style={{ cursor: 'pointer' }}>
                                <option value="">— Tanlang —</option>
                                {['Matematika', 'Fizika', 'Kimyo', 'Biologiya', 'Ona tili va adabiyoti', 'Ingliz tili', 'Tarix', 'Geografiya']
                                    .filter(s => s !== onboardingForm.subject)
                                    .map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
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
        <ChatContext.Provider value={{ onOpenTest: openTestPanel, onProfileUpdate: handleProfileUpdate, onOpenFlash: handleOpenFlash }}>
            <div className="min-h-[100dvh] h-[100dvh] flex overflow-hidden relative" style={{ background: 'var(--bg-page)' }}>
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
                            <span className="text-sm font-bold whitespace-nowrap">DTMMax</span>
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
                            <button key={t.k} onClick={() => { setSideTab(t.k); if (t.k === 'settings') loadNotifications() }}
                                className="flex-1 py-1.5 text-xs font-medium rounded-md transition flex flex-col items-center gap-0.5 relative"
                                style={sideTab === t.k ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : { color: 'var(--text-secondary)' }}
                                title={t.l}
                            >
                                <span className="relative">
                                    <t.Icon className="h-4 w-4" />
                                    {t.k === 'settings' && notifCount > 0 && (
                                        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full text-white text-[9px] flex items-center justify-center font-bold"
                                            style={{ background: 'var(--danger)' }}>
                                            {notifCount > 9 ? '9+' : notifCount}
                                        </span>
                                    )}
                                </span>
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
                            {testsLoading ? (
                                <div className="space-y-2 p-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-10 rounded animate-pulse" style={{ background: 'var(--bg-muted)' }} />
                                    ))}
                                </div>
                            ) : publicTests.length === 0 ? (
                                <div className="text-center p-4">
                                    <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Hozircha testlar yo'q</p>
                                    <button onClick={() => setSideTab('chats')} className="text-xs underline" style={{ color: 'var(--brand)' }}>
                                        AI dan test so'rang
                                    </button>
                                </div>
                            ) : (
                                <p className="text-[11px] font-semibold uppercase px-1 mb-2 mt-1" style={{ color: 'var(--text-muted)' }}>O'qituvchi testlari</p>
                            )}
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
                                try { aiKeys = JSON.parse(localStorage.getItem('dtmmax_done_ai_tests') || '[]') } catch { }
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
                            {/* Fan badge */}
                            {profile?.subject && (
                                <div className="flex items-center gap-2 pt-1">
                                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{user?.name}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                        style={{ background: 'var(--brand-light)', color: 'var(--brand-hover)' }}>
                                        {profile.subject}{(profile as any).subject2 ? ` + ${(profile as any).subject2}` : ''}
                                    </span>
                                </div>
                            )}
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
                            {profile?.weakTopics && (() => {
                                let topics: string[] = []
                                try { const p = JSON.parse(profile.weakTopics); topics = Array.isArray(p) ? p : [] } catch { }
                                return topics.length > 0 ? (
                                    <div className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                        <p className="text-[11px] font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Qiyin mavzular</p>
                                        <div className="flex flex-wrap gap-1">
                                            {topics.map((t: string, i: number) => (
                                                <span key={i} className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>{t}</span>
                                            ))}
                                        </div>
                                    </div>
                                ) : null
                            })()}
                            {profile?.strongTopics && (() => {
                                let topics: string[] = []
                                try { const p = JSON.parse(profile.strongTopics); topics = Array.isArray(p) ? p : [] } catch { }
                                return topics.length > 0 ? (
                                    <div className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                        <p className="text-[11px] font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Kuchli mavzular</p>
                                        <div className="flex flex-wrap gap-1">
                                            {topics.map((t: string, i: number) => (
                                                <span key={i} className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>{t}</span>
                                            ))}
                                        </div>
                                    </div>
                                ) : null
                            })()}
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
                            {totalFlashcards > 0 && (
                                <button onClick={() => {
                                    fetchApi('/flashcards', { method: 'DELETE' }).then(() => loadDueFlashcards()).catch(() => {})
                                }} className="w-full h-8 rounded-lg text-[12px] font-medium transition flex items-center justify-center gap-1.5"
                                    style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)' }}>
                                    <Trash2 className="h-3.5 w-3.5" /> Hammasini o'chirish
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
                                            <div key={card.id} className="card p-3 flex items-center gap-2 group">
                                                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {
                                                    setFlashPanel(dueFlashcards.slice(i))
                                                    setFlashIdx(0)
                                                    setFlashFlipped(false)
                                                    setFlashIsReview(true)
                                                }}>
                                                    <p className="text-[12px] font-medium truncate"><MathText text={card.front} /></p>
                                                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{card.subject}</p>
                                                </div>
                                                <button onClick={() => {
                                                    fetchApi(`/flashcards/${card.id}`, { method: 'DELETE' }).then(() => loadDueFlashcards()).catch(() => {})
                                                }} className="flex-shrink-0 h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition"
                                                    style={{ color: 'var(--danger)' }}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
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
                                {profile?.subject && <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>📚 Fan: <span className="font-medium">{profile.subject}{(profile as any).subject2 ? ` va ${(profile as any).subject2}` : ''}</span></p>}
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

                            {/* Bildirishnomalar */}
                            <div className="card p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-[11px] font-semibold uppercase flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                                        <Bell className="h-3.5 w-3.5" /> Bildirishnomalar
                                    </p>
                                    {notifLoading && <div className="h-3 w-3 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />}
                                </div>
                                {notifications.length === 0 ? (
                                    <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
                                        Bildirishnomalar yo'q
                                    </p>
                                ) : notifications.map((n: any) => (
                                    <div key={n.id} className="p-3 rounded-lg mb-2"
                                        style={{ background: n.isRead ? 'var(--bg-muted)' : 'var(--brand-light)', border: '1px solid var(--border)' }}>
                                        <p className="text-xs font-semibold mb-0.5">{n.title}</p>
                                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{n.message}</p>
                                        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                            {n.sender?.name} · {new Date(n.createdAt).toLocaleDateString('uz')}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {/* Profilni tahrirlash */}
                            <button onClick={() => { setShowOnboarding(true); setSideTab('chats') }}
                                className="btn btn-outline w-full h-10 flex items-center justify-center gap-2 text-sm">
                                <Settings className="h-4 w-4" /> Profilni tahrirlash
                            </button>

                            {/* Parolni o'zgartirish */}
                            <div className="card p-4">
                                <p className="text-[11px] font-semibold uppercase mb-3" style={{ color: 'var(--text-muted)' }}>Parolni o'zgartirish</p>
                                {changePwOk && (
                                    <div className="text-xs px-3 py-2 rounded-lg mb-3" style={{ background: '#D1FAE5', color: '#065F46' }}>
                                        Parol muvaffaqiyatli yangilandi!
                                    </div>
                                )}
                                {changePwErr && (
                                    <div className="text-xs px-3 py-2 rounded-lg mb-3" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
                                        {changePwErr}
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <input
                                        type="password"
                                        placeholder="Joriy parol"
                                        value={changePwForm.current}
                                        onChange={e => setChangePwForm(f => ({ ...f, current: e.target.value }))}
                                        className="input text-sm h-9"
                                    />
                                    <input
                                        type="password"
                                        placeholder="Yangi parol (kamida 8 belgi)"
                                        value={changePwForm.newPw}
                                        onChange={e => setChangePwForm(f => ({ ...f, newPw: e.target.value }))}
                                        className="input text-sm h-9"
                                    />
                                    <input
                                        type="password"
                                        placeholder="Yangi parolni tasdiqlang"
                                        value={changePwForm.confirm}
                                        onChange={e => setChangePwForm(f => ({ ...f, confirm: e.target.value }))}
                                        className="input text-sm h-9"
                                    />
                                    <button
                                        disabled={changePwLoading || !changePwForm.current || !changePwForm.newPw || !changePwForm.confirm}
                                        onClick={async () => {
                                            setChangePwErr('')
                                            setChangePwOk(false)
                                            if (changePwForm.newPw !== changePwForm.confirm) {
                                                setChangePwErr('Yangi parollar mos kelmadi')
                                                return
                                            }
                                            setChangePwLoading(true)
                                            try {
                                                await fetchApi('/auth/change-password', {
                                                    method: 'PUT',
                                                    body: JSON.stringify({ currentPassword: changePwForm.current, newPassword: changePwForm.newPw })
                                                })
                                                setChangePwOk(true)
                                                setChangePwForm({ current: '', newPw: '', confirm: '' })
                                            } catch (e: any) {
                                                setChangePwErr(e.message || 'Xatolik yuz berdi')
                                            }
                                            setChangePwLoading(false)
                                        }}
                                        className="btn btn-outline w-full h-9 text-sm"
                                    >
                                        {changePwLoading ? 'Saqlanmoqda...' : 'Parolni yangilash'}
                                    </button>
                                </div>
                            </div>

                            {/* Akkauntni o'chirish — danger zone */}
                            <div className="card p-4" style={{ border: '1px solid var(--danger-light)' }}>
                                <p className="text-[11px] font-semibold uppercase mb-1" style={{ color: 'var(--danger)' }}>Xavfli zona</p>
                                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Akkauntni o'chirib bo'lmaydi — barcha ma'lumotlar o'chib ketadi.</p>
                                <button
                                    onClick={() => { setShowDeleteModal(true); setDeleteErr(''); setDeletePassword('') }}
                                    className="w-full h-9 flex items-center justify-center gap-2 text-sm font-medium rounded-lg transition"
                                    style={{ color: 'var(--danger)', border: '1px solid var(--danger)', background: 'transparent' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-light)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    Akkauntni o'chirish
                                </button>
                            </div>

                            {/* Chiqish */}
                            <button onClick={() => logout()}
                                className="w-full h-10 flex items-center justify-center gap-2 text-sm font-medium rounded-lg transition"
                                style={{ color: 'var(--danger)', border: '1px solid var(--danger-light)', background: 'transparent' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-light)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <LogOut className="h-4 w-4" /> Tizimdan chiqish
                            </button>
                        </div>
                    )}

                    {/* Akkaunt o'chirish modal */}
                    {showDeleteModal && (
                        <div
                            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                            onClick={e => { if (e.target === e.currentTarget) setShowDeleteModal(false) }}
                        >
                            <div className="card p-6" style={{ maxWidth: '360px', width: '100%' }}>
                                <h3 className="text-base font-bold mb-1" style={{ color: 'var(--danger)' }}>Akkauntni o'chirish</h3>
                                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                                    Bu amal qaytarib bo'lmaydi. Barcha suhbatlar, test natijalari va profil ma'lumotlari o'chib ketadi.
                                </p>
                                {deleteErr && (
                                    <div className="text-xs px-3 py-2 rounded-lg mb-3" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
                                        {deleteErr}
                                    </div>
                                )}
                                <input
                                    type="password"
                                    placeholder="Parolingizni kiriting"
                                    value={deletePassword}
                                    onChange={e => setDeletePassword(e.target.value)}
                                    className="input text-sm h-9 mb-3"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowDeleteModal(false)}
                                        className="btn btn-outline flex-1 h-9 text-sm"
                                    >
                                        Bekor qilish
                                    </button>
                                    <button
                                        disabled={deleteLoading || !deletePassword}
                                        onClick={async () => {
                                            setDeleteErr('')
                                            setDeleteLoading(true)
                                            try {
                                                await fetchApi('/auth/account', {
                                                    method: 'DELETE',
                                                    body: JSON.stringify({ password: deletePassword })
                                                })
                                                logout()
                                            } catch (e: any) {
                                                setDeleteErr(e.message || 'Xatolik yuz berdi')
                                            }
                                            setDeleteLoading(false)
                                        }}
                                        className="flex-1 h-9 text-sm font-medium rounded-lg transition"
                                        style={{ background: 'var(--danger)', color: 'white', border: 'none', cursor: deleteLoading || !deletePassword ? 'not-allowed' : 'pointer', opacity: deleteLoading || !deletePassword ? 0.6 : 1 }}
                                    >
                                        {deleteLoading ? 'O\'chirilmoqda...' : 'O\'chirish'}
                                    </button>
                                </div>
                            </div>
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

                    {/* Email verification banner */}
                    {!emailVerified && !verifBannerDismissed && (
                        <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0 text-sm" style={{ background: '#FEF3C7', borderBottom: '1px solid #FCD34D', color: '#92400E' }}>
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                            <span className="flex-1 min-w-0">Email tasdiqlash xati yuborildi. Spam/Junk papkasini ham tekshiring!</span>
                            <button
                                onClick={resendVerification}
                                disabled={resendingVerif}
                                className="text-xs font-semibold underline flex-shrink-0"
                                style={{ color: '#92400E', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                {resendingVerif ? 'Yuborilmoqda...' : 'Qayta yuborish'}
                            </button>
                            <button
                                onClick={() => { setVerifBannerDismissed(true); localStorage.setItem('dtmmax_verif_dismissed', '1') }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400E', display: 'flex', alignItems: 'center' }}
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}

                    {/* Messages */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
                        {(!chatId || (messages.length === 0 && !loading && !streaming)) ? (
                            <div className="h-full flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
                                <div className="max-w-2xl w-full px-4 sm:px-6 anim-up">
                                    <div className="text-center mb-6 sm:mb-10">
                                        <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-5" style={{ background: 'var(--brand)' }}><BrainCircuit className="h-6 w-6 sm:h-7 sm:w-7 text-white" /></div>
                                        <h2 className="text-xl sm:text-2xl font-bold mb-2">Salom, {user?.name?.split(' ')[0]}! 👋</h2>
                                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Bugun nima o'rganmoqchisiz?</p>
                                    </div>
                                    {/* Streak va Imtihon sanasi bloki */}
                                    <div className="flex items-center justify-center gap-4 mb-6 flex-wrap">
                                        {(progressData?.currentStreak ?? 0) > 0 && (
                                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
                                                style={{ background: 'color-mix(in srgb, #f97316 12%, transparent)', color: '#f97316', border: '1px solid color-mix(in srgb, #f97316 25%, transparent)' }}>
                                                🔥 {progressData!.currentStreak} kunlik streak
                                            </div>
                                        )}
                                        {profile?.examDate && (() => {
                                            const days = Math.max(0, Math.ceil((new Date(profile.examDate).getTime() - Date.now()) / 86400000))
                                            return days > 0 ? (
                                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
                                                    style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)', border: '1px solid color-mix(in srgb, var(--brand) 25%, transparent)' }}>
                                                    📅 Imtihonga {days} kun qoldi
                                                </div>
                                            ) : null
                                        })()}
                                        {(progressData?.currentStreak ?? 0) === 0 && (
                                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm"
                                                style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                                                🎯 Bugun birinchi kunni boshlang!
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                        {[
                                            { Icon: BookOpen, color: '#6366F1', title: 'Mavzu tushuntir', desc: 'Mavzuni boshidan tushuntirib ber', prompt: profile?.subject ? `${profile.subject} fanidan bugun qaysi mavzuni o'rganishimni tavsiya qilasiz? Qisqa reja tuzing va shu mavzudan 3 ta test savoli ham bering.` : 'Menga bugungi mavzuni boshidan tushuntirib bering' },
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
                                                } catch (err) { console.error('quickAction chat:', err) }
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
                            <div className="max-w-5xl mx-auto px-3 sm:px-8 py-4 sm:py-8 space-y-3 sm:space-y-6">
                                {messages.map((m, i) => (
                                    <div key={m.id || i} className={`flex gap-2 sm:gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
                                        {m.role !== 'user' && (
                                            <div className="hidden sm:flex h-8 w-8 rounded-full flex-shrink-0 items-center justify-center mt-0.5 text-white text-xs font-bold" style={{ background: 'var(--brand)' }}>AI</div>
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
                                            <div className="bubble-ai"><MdMessage content={m.content} /></div>
                                        )}
                                        {m.role === 'user' && (
                                            <div className="hidden sm:flex h-8 w-8 rounded-full flex-shrink-0 items-center justify-center text-white text-xs font-bold" style={{ background: 'var(--brand)' }}>{user?.name?.[0]?.toUpperCase() || 'S'}</div>
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
                                                <div className="rounded-lg p-2.5 text-[11px] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto mt-1" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>{thinkingText.length > 3000 ? thinkingText.slice(0, 3000) + '\n...[qisqartirildi]' : thinkingText}</div>
                                            </details>
                                        </div>
                                    </div>
                                )}
                                {streaming && (
                                    <div className="flex gap-2 sm:gap-3">
                                        <div className="hidden sm:flex h-8 w-8 rounded-full flex-shrink-0 items-center justify-center mt-0.5 text-white text-xs font-bold" style={{ background: 'var(--brand)' }}>AI</div>
                                        <div className="bubble-ai w-full sm:w-auto">
                                            <MdMessage content={streaming} isStreaming={true} />
                                            {/```test/.test(streaming) && !/```test[\s\S]*?```/.test(streaming) && (
                                                <div className="mt-4 rounded-2xl overflow-hidden" style={{
                                                    background: 'linear-gradient(135deg, rgba(224, 123, 57, 0.12) 0%, rgba(224, 123, 57, 0.05) 100%)',
                                                    border: '1.5px solid rgba(224, 123, 57, 0.25)',
                                                }}>
                                                    <div className="px-5 py-4">
                                                        <div className="flex items-center gap-4 mb-4">
                                                            <div className="h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 animate-pulse"
                                                                style={{ background: 'rgba(224, 123, 57, 0.18)' }}>
                                                                <svg className="h-6 w-6" style={{ color: 'var(--brand)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                                </svg>
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="text-[15px] font-bold" style={{ color: 'var(--brand)' }}>Test tayyorlanmoqda</span>
                                                                    <span className="flex gap-1 items-center">
                                                                        {[0, 1, 2].map(i => (
                                                                            <span key={i} className="h-1.5 w-1.5 rounded-full" style={{
                                                                                background: 'var(--brand)',
                                                                                animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`
                                                                            }} />
                                                                        ))}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>AI savollar yozmoqda, biroz kuting...</span>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2.5">
                                                            {[85, 65, 75, 50].map((w, i) => (
                                                                <div key={i} className="h-2.5 rounded-full animate-pulse" style={{
                                                                    width: `${w}%`,
                                                                    background: 'rgba(224, 123, 57, 0.18)',
                                                                    animationDelay: `${i * 0.15}s`
                                                                }} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {/```flashcard/.test(streaming) && !/```flashcard[\s\S]*?```/.test(streaming) && (
                                                <div className="mt-4 rounded-2xl overflow-hidden" style={{
                                                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(99, 102, 241, 0.05) 100%)',
                                                    border: '1.5px solid rgba(99, 102, 241, 0.25)',
                                                }}>
                                                    <div className="px-5 py-4">
                                                        <div className="flex items-center gap-4 mb-4">
                                                            <div className="h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 animate-pulse"
                                                                style={{ background: 'rgba(99, 102, 241, 0.18)' }}>
                                                                <svg className="h-6 w-6" style={{ color: '#6366f1' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                                </svg>
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="text-[15px] font-bold" style={{ color: '#6366f1' }}>Kartochkalar tayyorlanmoqda</span>
                                                                    <span className="flex gap-1 items-center">
                                                                        {[0, 1, 2].map(i => (
                                                                            <span key={i} className="h-1.5 w-1.5 rounded-full" style={{
                                                                                background: '#6366f1',
                                                                                animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`
                                                                            }} />
                                                                        ))}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>AI kartochkalar yozmoqda, biroz kuting...</span>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2.5">
                                                            {[80, 55, 70, 60].map((w, i) => (
                                                                <div key={i} className="h-2.5 rounded-full animate-pulse" style={{
                                                                    width: `${w}%`,
                                                                    background: 'rgba(99, 102, 241, 0.18)',
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
                                    <div className="flex gap-2 sm:gap-3">
                                        <div className="hidden sm:flex h-8 w-8 rounded-full flex-shrink-0 items-center justify-center text-white text-xs font-bold" style={{ background: 'var(--brand)' }}>AI</div>
                                        <div className="typing-dots"><span /><span /><span /></div>
                                    </div>
                                )}
                                {loading && thinkingText && !streaming && (
                                    <div className="flex gap-2 sm:gap-3">
                                        <div className="hidden sm:flex h-8 w-8 rounded-full flex-shrink-0 items-center justify-center text-white text-xs font-bold" style={{ background: 'var(--brand)' }}>AI</div>
                                        <div className="text-[13px] py-3 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>Javob yozilmoqda...<span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--text-muted)' }} /></div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Input + Quick Actions — har doim ko'rinadi */}
                    <ChatInputArea
                        chatId={chatId}
                        loading={loading}
                        thinkingMode={thinkingMode}
                        setThinkingMode={setThinkingMode}
                        onSend={handleSend}
                        onStop={stopGeneration}
                        blobUrlsRef={blobUrlsRef}
                        messagesCount={messages.length}
                    />
                </div>


                {/* Test Side Panel */}
                {
                    testPanel && (() => {
                        let questions: any[] = []
                        try { questions = JSON.parse(testPanel) } catch { return null }
                        const answered = Object.keys(testAnswers).length
                        const score = testSubmitted ? questions.filter((q: any, i: number) => testAnswers[i] === q.correct).length : 0
                        return (
                            <div className={(testPanelMaximized || isMobile) ? 'fixed inset-0 z-50 flex flex-col' : 'relative flex flex-col flex-shrink-0'}
                                style={(testPanelMaximized || isMobile) ? { background: 'var(--bg-card)' } : { width: testWidth, background: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }}>

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
                                                ⏱ {String(Math.floor(testTimeLeft / 60)).padStart(2, '0')}:{String(testTimeLeft % 60).padStart(2, '0')}
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
                                                <p className="text-[14px] font-semibold mb-2 leading-relaxed">{i + 1}. <MathText text={q.q} /></p>
                                                {q.imageUrl && (
                                                    <div className="mb-4 mt-1">
                                                        <img src={q.imageUrl} alt="Savol rasmi" className="max-w-full rounded-xl border shadow-sm" style={{ borderColor: 'var(--border)', maxHeight: '320px', objectFit: 'contain' }} />
                                                    </div>
                                                )}
                                                {q.questionType === 'open' ? (
                                                    <div className="space-y-2">
                                                        <textarea
                                                            disabled={testSubmitted}
                                                            value={typeof testAnswers[i] === 'string' ? testAnswers[i] : ''}
                                                            onChange={e => setTestAnswers({ ...testAnswers, [i]: e.target.value })}
                                                            placeholder="Javobingizni shu yerga yozing..."
                                                            rows={3}
                                                            className="w-full rounded-xl border px-3 py-2 text-[13px] resize-none outline-none transition"
                                                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                                                        />
                                                        {testSubmitted && q.correctText && (
                                                            <p className="text-[12px] px-3 py-2 rounded-lg" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
                                                                To'g'ri javob: <span className="font-semibold">{q.correctText}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
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
                                                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTestAnswers({ ...testAnswers, [i]: opt }) } }}
                                                                    tabIndex={0}
                                                                    role="radio"
                                                                    aria-checked={testAnswers[i] === opt}
                                                                    className="w-full text-left px-4 py-3 rounded-xl text-[13px] border transition-all duration-200 outline-none"
                                                                    style={sty}>
                                                                    <span className="font-bold mr-2" style={{ opacity: 0.6 }}>{opt.toUpperCase()})</span> <MathText text={q[opt]} />
                                                                    {testSubmitted && isCorrect && <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full text-xs" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>✓</span>}
                                                                    {testSubmitted && isSelected && !isCorrect && <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full text-xs" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>✕</span>}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                )}
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
                                className={(flashMaximized || isMobile) ? 'fixed inset-0 z-50 flex flex-col' : 'flash-panel relative flex flex-col flex-shrink-0'}
                                style={(flashMaximized || isMobile) ? { background: 'var(--bg-card)' } : { width: flashWidth, background: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }}>

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
                                                    <MdMessage content={card.front} />
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
                                                    <MdMessage content={card.back} />
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
        </ChatContext.Provider>
    )
}
