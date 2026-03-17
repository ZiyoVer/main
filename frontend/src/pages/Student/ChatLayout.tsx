import React, { useState, useEffect, useRef, useCallback, memo } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { BrainCircuit, Plus, Trash2, LogOut, Send, Menu, X, GraduationCap, ClipboardList, Settings, BookOpen, Target, Flame, MessageSquare, FileText, Zap, Square, Lightbulb, Maximize2, Minimize2, Paperclip, Layers, ChevronLeft, ChevronRight, RotateCcw, Sun, Moon, Search, AlertTriangle, TrendingUp, Brain, PenLine, CheckCircle, Bell, Trophy, Timer, Sparkles, User, Shield, ArrowUp, BarChart2 } from 'lucide-react'
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
import ChatContext, { useChatContext, EssayPanel, TodoItem } from '../../contexts/ChatContext'
import { useTestPanel } from '../../hooks/useTestPanel'
import { useFlashPanel } from '../../hooks/useFlashPanel'

interface Chat { id: string; title: string; subject?: string; updatedAt: string }
interface Msg { id: string; role: string; content: string; createdAt: string }
interface Profile { onboardingDone: boolean; subject?: string; subject2?: string; examDate?: string; targetScore?: number; weakTopics?: string; strongTopics?: string; concerns?: string; totalTests?: number; avgScore?: number; abilityLevel?: number }
interface PublicTest { id: string; title: string; subject?: string; _count?: { questions: number; attempts: number } }
interface MyResult { id: string; testId: string; score: number; total?: number; createdAt: string; test?: { title: string; subject?: string } }

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
        .replace(/\\\[(\s*[\s\S]*?\s*)\\\]/g, (_, m) => `\n$$\n${m.trim()}\n$$\n`)
        .replace(/\\\((\s*[\s\S]*?\s*)\\\)/g, (_, m) => {
            const inner = m.trim()
            // Murakkab inline formulalarni display math ga o'tkazish
            if (/\\int|\\sum|\\prod|\\lim|\\infty|\\frac\{[^}]{3,}/.test(inner)) {
                return `\n$$\n${inner}\n$$\n`
            }
            return `$${inner}$`
        })
}

// TodoBlockMount: mounts → opens todo panel, shows a tap card in chat
function TodoBlockMount({ items, onSetTodo }: { items: Omit<TodoItem, 'id' | 'done'>[], onSetTodo: (items: Omit<TodoItem, 'id' | 'done'>[]) => void }) {
    useEffect(() => { onSetTodo(items) }, []) // eslint-disable-line
    return (
        <button onClick={() => onSetTodo(items)} className="my-3 flex items-center gap-2.5 px-4 py-3 rounded-xl w-full text-left transition"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}>
            <Target className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--brand)' }} />
            <span className="text-[13px] font-medium flex-1">Kunlik reja — {items.length} ta vazifa</span>
            <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Ko'rish →</span>
        </button>
    )
}

// MdMessage komponentni tashqarida va memo bilan ta'riflaymiz —
// shunda har keystrokeda re-render bo'lmaydi (ReactMarkdown+KaTeX qimmat!)
const MdMessage = memo(({ content, isStreaming }: {
    content: string
    isStreaming?: boolean
}) => {
    const { onOpenTest, onProfileUpdate, onOpenFlash, onOpenEssay, onSetTodo } = useChatContext()
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
                if (className?.includes('language-essay')) {
                    const jsonStr = String(children).trim()
                    let data: any = null
                    try { data = JSON.parse(jsonStr) } catch { }
                    if (!data?.prompt) return null
                    const essayData = { task: data.task || 'Task 2', prompt: data.prompt, time: data.time || 30, minWords: data.minWords || 200, maxWords: data.maxWords || 280 }
                    return (
                        <div className="my-3 rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                            <div className="p-4 flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'var(--brand)' }}>
                                        <PenLine className="h-4 w-4 text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                            <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>Writing — {essayData.task}</p>
                                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)' }}>
                                                {essayData.minWords}–{essayData.maxWords} so'z
                                            </span>
                                            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                                                ⏱ {essayData.time} daqiqa
                                            </span>
                                        </div>
                                        <p className="text-[12px] leading-relaxed line-clamp-2" style={{ color: 'var(--text-muted)' }}>{essayData.prompt}</p>
                                    </div>
                                </div>
                                {!isStreaming && (
                                    <button
                                        onClick={() => onOpenEssay(essayData)}
                                        className="flex-shrink-0 h-9 px-4 rounded-xl text-[13px] font-semibold text-white flex items-center gap-2 transition-opacity"
                                        style={{ background: 'var(--brand)' }}
                                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                                    >
                                        Boshlash
                                    </button>
                                )}
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
                if (className?.includes('language-vocab')) {
                    const raw = String(children).trim()
                    let items: { word: string; type?: string; hint?: string }[] = []
                    try {
                        const parsed = JSON.parse(raw)
                        items = Array.isArray(parsed)
                            ? parsed.map((x: any) => typeof x === 'string' ? { word: x } : {
                                word: x.word || x.w,
                                type: x.type || x.pos || '',
                                hint: x.hint || x.h || x.translation || x.t || ''
                            })
                            : []
                    } catch { return null }
                    if (items.length === 0) return null
                    const accentColors = ['#E07B39', '#6366f1', '#059669', '#d97706', '#0891b2', '#7c3aed', '#be185d', '#15803d']
                    const typeLabels: Record<string, string> = { noun: 'ot', verb: 'fe\'l', adj: 'sifat', adv: 'ravish', prep: 'ko\'m', phrase: 'ibora', phrasal: 'ph.v' }
                    return (
                        <div className="my-3 rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', minWidth: 0 }}>
                            <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                                <svg className="h-3.5 w-3.5" style={{ color: 'var(--brand)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>So'z boyligi — {items.length} ta</span>
                            </div>
                            <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                                {items.map((item, i) => {
                                    const accent = accentColors[i % accentColors.length]
                                    const typeKey = (item.type || '').toLowerCase()
                                    const typeLabel = typeLabels[typeKey] || item.type
                                    const isRightCol = i % 2 === 1
                                    return (
                                        <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 hover:opacity-80 transition-opacity"
                                            style={{
                                                background: Math.floor(i / 2) % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                                                borderTop: i >= 2 ? `1px solid var(--border)` : 'none',
                                                borderLeft: isRightCol ? `1px solid var(--border)` : 'none',
                                            }}>
                                            <span className="text-[10px] font-mono mt-0.5 flex-shrink-0 w-4 text-right" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: accent }} />
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-bold text-[13px] leading-snug" style={{ color: accent }}>{item.word}</span>
                                                    {typeLabel && (
                                                        <span className="text-[9px] px-1 py-0.5 rounded font-medium flex-shrink-0"
                                                            style={{ background: `${accent}18`, color: accent }}>{typeLabel}</span>
                                                    )}
                                                </div>
                                                {item.hint && <span className="text-[11px] leading-snug mt-0.5 break-words" style={{ color: 'var(--text-secondary)' }}>{item.hint}</span>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                }
                if (className?.includes('language-formula')) {
                    const raw = String(children).trim()
                    let items: { name: string; formula: string; hint?: string }[] = []
                    try {
                        const parsed = JSON.parse(raw)
                        items = Array.isArray(parsed)
                            ? parsed.map((x: any) => ({ name: x.name || x.n || '', formula: x.formula || x.f || '', hint: x.hint || x.h || '' }))
                            : []
                    } catch { return null }
                    if (items.length === 0) return null
                    return (
                        <div className="my-3 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                            <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                                <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>FORMULALAR — {items.length} TA</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2">
                                {items.map((item, i) => {
                                    let rendered = ''
                                    try { rendered = katex.renderToString(item.formula, { displayMode: false, throwOnError: false }) } catch { rendered = item.formula }
                                    const col = i % 2
                                    const row = Math.floor(i / 2)
                                    return (
                                        <div key={i} className="flex items-start gap-3 px-4 py-3 min-w-0"
                                            style={{
                                                borderTop: row > 0 || (col === 1 && items.length > 1) ? '1px solid var(--border)' : 'none',
                                                borderLeft: col === 1 ? '1px solid var(--border)' : 'none',
                                                background: row % 2 === 1 ? 'var(--bg-surface)' : 'transparent',
                                            }}>
                                            <span className="text-[11px] font-mono w-5 flex-shrink-0 pt-0.5 text-right" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                                    <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                                                    {item.hint && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>{item.hint}</span>}
                                                </div>
                                                <div className="text-[13px] overflow-x-auto" dangerouslySetInnerHTML={{ __html: rendered }} />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                }
                if (className?.includes('language-todo')) {
                    let rawItems: Omit<TodoItem, 'id' | 'done'>[] = []
                    try { rawItems = JSON.parse(String(children).trim()) } catch { return null }
                    if (!rawItems.length) return null
                    return <TodoBlockMount items={rawItems} onSetTodo={onSetTodo} />
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
        if (!chatId) {
            toast.error('Avval yangi suhbat boshlang')
            return
        }
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
            // Upload tugagach textarea ga focus qaytaramiz — Enter ishlashi uchun
            setTimeout(() => textareaRef.current?.focus(), 50)
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
            if (uploadingFile) return // upload tugaguncha kuting
            if (!loading && (input.trim() || attachedFiles.length > 0)) handleSubmit(e as any)
        }
    }

    const QUICK_ACTIONS = [
        { Icon: ClipboardList, l: 'Testla', p: "Shu mavzu bo'yicha test ber. Kamida 15 ta savol, osondan qiyinga tartibda." },
        { Icon: BookOpen, l: 'Davom et', p: "Keyingi mavzuga o'tamiz. Nimani o'rganishimiz kerak?" },
        { Icon: RotateCcw, l: 'Qayta tushuntir', p: 'Bu mavzuni boshqa usulda, oddiyroq tushuntiring' },
        { Icon: Target, l: 'Reja tuz', p: "Imtihongacha qolgan vaqtga mos o'quv reja tuzing" },
        { Icon: Lightbulb, l: 'Formulalar', p: 'Shu mavzuning barcha muhim formulalarini yozing' },
        { Icon: Layers, l: 'Kartochkalar', p: "Shu mavzuning eng muhim formulalari va tushunchalarini kartochka formatida bering (```flashcard JSON format)." },
    ]

    return (
        <div className="px-3 sm:px-6 pb-4 sm:pb-6 pt-2 chat-input-area flex-shrink-0" style={{ background: 'var(--bg-page)' }}>
            {!loading && messagesCount > 0 && (
                <div className="max-w-3xl mx-auto mb-2 flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {QUICK_ACTIONS.map((a, i) => (
                        <button key={i} onClick={() => { if (!chatId || loading) return; onSend(a.p, []) }}
                            className="h-7 px-3 text-[12px] font-medium rounded-full transition whitespace-nowrap flex items-center gap-1.5 flex-shrink-0"
                            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)', background: 'transparent' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        ><a.Icon className="h-3 w-3 flex-shrink-0" />{a.l}</button>
                    ))}
                </div>
            )}
            <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
                <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,image/*" className="hidden" onChange={handleFileSelect} />
                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    {/* Attached files */}
                    {attachedFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2 px-4 pt-3">
                            {attachedFiles.map(file => (
                                <div key={file.id} className="relative rounded-xl p-1.5 w-[64px] h-[64px] flex flex-col items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                    <button type="button" onClick={() => {
                                        if (file.previewUrl) URL.revokeObjectURL(file.previewUrl)
                                        setAttachedFiles(prev => prev.filter(f => f.id !== file.id))
                                    }} className="absolute -top-1.5 -right-1.5 rounded-full h-[20px] w-[20px] flex items-center justify-center z-10" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                                        <X className="h-2.5 w-2.5" />
                                    </button>
                                    {file.previewUrl ? (
                                        <img src={file.previewUrl} alt={file.name} className="w-full h-full object-cover rounded-[8px]" />
                                    ) : (
                                        <>
                                            <FileText className="h-5 w-5 mb-0.5" style={{ color: 'var(--brand)' }} />
                                            <span className="text-[9px] w-full truncate text-center" style={{ color: 'var(--text-muted)' }}>{file.name.substring(0, 8)}…</span>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    {/* Textarea */}
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={e => { setInput(e.target.value); adjustTextareaHeight() }}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        placeholder="Xabar yozing..."
                        disabled={loading}
                        rows={1}
                        className="w-full bg-transparent outline-none text-sm resize-none leading-relaxed px-4"
                        style={{ color: 'var(--text-primary)', minHeight: '64px', maxHeight: '160px', paddingTop: '14px', paddingBottom: '8px', overflowX: 'hidden', wordBreak: 'break-word' }}
                    />
                    {/* Toolbar row */}
                    <div className="flex items-center gap-2 px-3 pb-3">
                        {/* Attach */}
                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading || uploadingFile}
                            className="h-8 w-8 flex items-center justify-center rounded-lg transition disabled:opacity-40"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            title="Fayl biriktirish">
                            {uploadingFile
                                ? <div className="h-3.5 w-3.5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
                                : <Paperclip className="h-3.5 w-3.5" />}
                        </button>
                        {/* Thinking mode */}
                        <button type="button" onClick={() => setThinkingMode(!thinkingMode)}
                            title={thinkingMode ? 'Chuqur fikrlash yoqilgan' : 'Chuqur fikrlash'}
                            className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium transition"
                            style={thinkingMode ? { background: 'var(--brand-light)', color: 'var(--brand)' } : { color: 'var(--text-muted)' }}
                            onMouseEnter={e => { if (!thinkingMode) e.currentTarget.style.background = 'var(--bg-surface)' }}
                            onMouseLeave={e => { if (!thinkingMode) e.currentTarget.style.background = 'transparent' }}>
                            <Lightbulb className="h-3.5 w-3.5" />
                            {thinkingMode && <span>Chuqur</span>}
                        </button>
                        <div className="flex-1" />
                        {/* Model label */}
                        <span className="text-xs font-medium select-none hidden sm:block" style={{ color: 'var(--text-muted)' }}>DTMMax</span>
                        {/* Send / Stop */}
                        {loading ? (
                            <button type="button" onClick={onStop}
                                className="h-8 w-8 flex items-center justify-center rounded-lg transition"
                                style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}
                                title="To'xtatish">
                                <Square className="h-3 w-3" fill="currentColor" />
                            </button>
                        ) : (
                            <button type="submit" disabled={!input.trim() && attachedFiles.length === 0}
                                className="h-9 w-9 flex items-center justify-center rounded-xl transition disabled:opacity-30"
                                style={{ background: 'var(--brand)', color: 'white' }}
                                title="Yuborish">
                                <ArrowUp className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
                <p className="text-[10px] mt-1.5 text-center select-none" style={{ color: 'var(--text-muted)' }}>DTMMax xato qilishi mumkin — muhim ma'lumotlarni tekshirib ko'ring</p>
            </form>
        </div>
    )
})

// Suhbatlarni sanasi bo'yicha guruhlash
function groupChatsByDate(chats: { id: string; title: string; updatedAt: string }[]) {
    const now = new Date()
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1)
    const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7)
    const groups: { label: string; items: typeof chats }[] = [
        { label: 'Bugun', items: [] },
        { label: 'Kecha', items: [] },
        { label: 'Bu hafta', items: [] },
        { label: 'Eski', items: [] },
    ]
    for (const c of chats) {
        const d = new Date(c.updatedAt)
        if (d >= todayStart) groups[0].items.push(c)
        else if (d >= yesterdayStart) groups[1].items.push(c)
        else if (d >= weekStart) groups[2].items.push(c)
        else groups[3].items.push(c)
    }
    return groups.filter(g => g.items.length > 0)
}

export default function ChatLayout() {
    const { chatId } = useParams()
    const nav = useNavigate()
    const location = useLocation()
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
    const [sideTab, setSideTab] = useState<'chats' | 'tests' | 'progress' | 'flashcards'>('chats')
    const [overlayPanel, setOverlayPanel] = useState<'tests' | 'flashcards' | 'progress' | 'todo' | null>(null)
    const [todoItems, setTodoItems] = useState<TodoItem[]>([])
    const [showSettings, setShowSettings] = useState(false)
    const [settingsSection, setSettingsSection] = useState<'profile' | 'appearance' | 'notifications' | 'security' | 'account'>('profile')
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
    // Ko'rilgan test IDlari (localStorage) — yangi testlarni aniqlash uchun
    const [newTestIds, setNewTestIds] = useState<Set<string>>(new Set())
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

    // Essay panel states
    const [essayPanel, setEssayPanel] = useState<EssayPanel | null>(null)
    const [essayText, setEssayText] = useState('')
    const [essaySubmitted, setEssaySubmitted] = useState(false)
    const [essayTimeLeft, setEssayTimeLeft] = useState<number | null>(null)
    const [essayMaximized, setEssayMaximized] = useState(false)
    const [essayWidth, setEssayWidth] = useState(520)
    const essayDragRef = useRef(false)

    const loadControllerRef = useRef<AbortController | null>(null)
    const isSubmittingRef = useRef(false)
    const submitTestPanelRef = useRef<() => void>(() => { })
    const sidebarWidth = (() => {
        const w = window.innerWidth
        if (w < 768) return 280
        if (w <= 1024) return 260
        return 280
    })()

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
        // Real-time online tracking — har 60 soniyada ping
        const sendPing = () => fetchApi('/auth/ping', { method: 'POST', body: JSON.stringify({ page: 'chat' }) }).catch(() => { })
        sendPing()
        const pingInterval = setInterval(sendPing, 60000)
        return () => {
            clearInterval(pingInterval)
            blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
            blobUrlsRef.current = []
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (chatId) loadMessages(chatId) }, [chatId])

    // Guest test natijasini AI bilan tahlil qilish — login yoki ro'yxatdan o'tgandan keyin
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        if (!params.get('analyzeTest')) return
        const raw = localStorage.getItem('dtmmax_guest_test_result')
        if (!raw) return
        let guestData: any
        try { guestData = JSON.parse(raw) } catch { return }
        // URL dan flag ni olib tashlaymiz
        window.history.replaceState({}, '', location.pathname)
        localStorage.removeItem('dtmmax_guest_test_result')

        // streamToChat orqali to'g'ridan-to'g'ri stream qilamiz — timeout muammosi yo'q
        const triggerAnalysis = async () => {
            try {
                const chatData = await fetchApi('/chat/new', {
                    method: 'POST',
                    body: JSON.stringify({ title: `Test tahlili: ${guestData.title || 'Test'}`, subject: guestData.subject, forceNew: true })
                })
                await loadChats()
                nav(`/suhbat/${chatData.id}`)

                const optLabels = ['A', 'B', 'C', 'D']
                const allList = (guestData.questions || []).map((q: any, i: number) => {
                    const isCorrect = q.studentAnswer === q.correctAnswer
                    const status = isCorrect ? '✅' : '❌'
                    const opts = ['a', 'b', 'c', 'd'].map((k, oi) => q[k] ? `${optLabels[oi]}) ${q[k]}` : null).filter(Boolean).join(' | ')
                    const imgNote = q.imageUrl ? ' [🖼 Rasm mavjud]' : ''
                    return `${status} ${i + 1}. ${(q.text || 'Savol').substring(0, 200)}${imgNote}\n   ${opts ? 'Variantlar: ' + opts : ''}\n   Men: ${(q.studentAnswer || '—').toUpperCase()}, To'g'ri: ${(q.correctAnswer || '—').toUpperCase()}`
                }).join('\n\n')

                const prompt = `Men "${guestData.title || 'Test'}" testini yechtim (${guestData.subject || ''}).
Natija: ${guestData.score}/${guestData.total} to'g'ri (${guestData.total > 0 ? Math.round(guestData.score / guestData.total * 100) : 0}%).

Barcha savollar:
${allList}

Iltimos, har bir savolni tahlil qilib ber:
- ✅ To'g'ri yechganlarni: qisqacha nima uchun to'g'ri ekanini tushuntir
- ❌ Xato yechganlarni: batafsil to'g'ri yechimini ko'rsat, nima uchun xato va to'g'ri javob nima uchun to'g'ri
- Oxirida xulosa: qaysi mavzularda zaif ekanimni va nima o'rganishim kerakligini ayt`

                const displayText = `📊 "${guestData.title}" testi tahlili (${guestData.score}/${guestData.total} to'g'ri)`
                setTimeout(() => streamToChat(chatData.id, prompt, displayText), 300)
            } catch (e) {
                console.error('analyzeTest error:', e)
                setLoading(false)
            }
        }
        triggerAnalysis()
    }, [location.search]) // eslint-disable-line react-hooks/exhaustive-deps

    // Panel drag-to-resize (flashcard + test)
    useEffect(() => {
        const getClientX = (e: MouseEvent | TouchEvent) =>
            'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX

        const onMove = (e: MouseEvent | TouchEvent) => {
            const x = getClientX(e)
            if (flashDragRef.current) {
                const newWidth = Math.max(280, Math.min(900, window.innerWidth - x))
                flashWidthRef.current = newWidth
                const el = document.querySelector('.flash-panel') as HTMLElement
                if (el) el.style.width = newWidth + 'px'
            }
            if (testDragRef.current) setTestWidth(Math.max(280, Math.min(900, window.innerWidth - x)))
        }
        const onUp = () => {
            if (flashDragRef.current) setFlashWidth(flashWidthRef.current)
            flashDragRef.current = false; testDragRef.current = false;
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
        window.addEventListener('touchmove', onMove, { passive: true })
        window.addEventListener('touchend', onUp)
        return () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
            window.removeEventListener('touchmove', onMove)
            window.removeEventListener('touchend', onUp)
        }
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

    // Vaqt tugaganda avtomatik topshirish — ref orqali stale closure oldini olamiz
    useEffect(() => {
        if (testTimeLeft === 0 && testPanel && !testSubmitted && !testReadOnly) {
            submitTestPanelRef.current()
            setTestTimeLeft(null)
        }
    }, [testTimeLeft, testPanel, testSubmitted, testReadOnly])

    // Essay timer
    useEffect(() => {
        if (essayTimeLeft === null || essayTimeLeft <= 0) return
        const id = setInterval(() => {
            setEssayTimeLeft(t => (t !== null && t > 0) ? t - 1 : 0)
        }, 1000)
        return () => clearInterval(id)
    }, [essayTimeLeft])

    useEffect(() => {
        if (essayTimeLeft === 0 && essayPanel && !essaySubmitted) {
            toast.error('Vaqt tugadi! Essay avtomatik topshirildi.')
            submitEssay()
        }
    }, [essayTimeLeft]) // eslint-disable-line react-hooks/exhaustive-deps

    // Essay draft — localStorage ga saqlash (har o'zgarishda)
    const ESSAY_DRAFT_KEY = 'dtmmax_essay_draft'
    useEffect(() => {
        if (!essayPanel || essaySubmitted) return
        localStorage.setItem(ESSAY_DRAFT_KEY, JSON.stringify({
            panel: essayPanel,
            text: essayText,
            timeLeft: essayTimeLeft,
            savedAt: Date.now()
        }))
    }, [essayPanel, essayText, essayTimeLeft, essaySubmitted])

    // Essay draft — mount da tiklash (foydalanuvchi qaytib kelganda)
    useEffect(() => {
        try {
            const raw = localStorage.getItem(ESSAY_DRAFT_KEY)
            if (!raw) return
            const { panel, text, timeLeft, savedAt } = JSON.parse(raw)
            if (!panel) return
            const elapsed = Math.floor((Date.now() - savedAt) / 1000)
            const restoredTime = timeLeft !== null ? Math.max(0, timeLeft - elapsed) : null
            if (restoredTime !== null && restoredTime <= 0) {
                localStorage.removeItem(ESSAY_DRAFT_KEY)
                return
            }
            setEssayPanel(panel)
            setEssayText(text || '')
            setEssayTimeLeft(restoredTime)
            setEssaySubmitted(false)
            toast.success('Yozish topshirig\'i tiklandi', { duration: 3000 })
        } catch { /* ignore */ }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Essay drag resize
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!essayDragRef.current) return
            const newW = Math.max(380, Math.min(900, window.innerWidth - e.clientX))
            setEssayWidth(newW)
        }
        const onUp = () => { essayDragRef.current = false }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    }, [])

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
        } catch (err: any) {
            console.error('loadProfile:', err)
            // Faqat 404 (profil yo'q) da onboarding ko'rsatish — network xatosida emas
            if (err?.status === 404 || err?.message?.includes('404')) setShowOnboarding(true)
        }
    }

    async function loadPublicTests() {
        setTestsLoading(true)
        try {
            const data = await fetchApi('/tests/public')
            setPublicTests(data)
            // Ko'rilgan test IDlarini localStorage dan olish
            let seenIds: string[] = []
            try { seenIds = JSON.parse(localStorage.getItem('dtmmax_seen_tests') || '[]') } catch { }
            const seenSet = new Set(seenIds)
            // Yangi testlar = ko'rilmaganlar
            const newIds = new Set<string>(data.filter((t: any) => !seenSet.has(t.id)).map((t: any) => t.id))
            setNewTestIds(newIds)
        } catch (err) { console.error('loadPublicTests:', err) } finally { setTestsLoading(false) }
    }

    function markTestsSeen() {
        try {
            const allIds = publicTests.map((t: any) => t.id)
            localStorage.setItem('dtmmax_seen_tests', JSON.stringify(allIds))
        } catch { }
        setNewTestIds(new Set())
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
        } catch (err) { console.error('deleteChat:', err); toast.error("Suhbatni o'chirishda xatolik") }
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

    // Essay panel ochish
    const handleOpenEssay = useCallback((data: EssayPanel) => {
        setTestPanel(null)
        setFlashPanel(null)
        setEssayPanel(data)
        setEssayText('')
        setEssaySubmitted(false)
        setEssayMaximized(false)
        setEssayTimeLeft(data.time * 60)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Todo panel
    const handleSetTodo = useCallback((items: Omit<TodoItem, 'id' | 'done'>[]) => {
        setTodoItems(items.map((item, i) => ({ ...item, id: `todo-${i}-${Date.now()}`, done: false })))
        setOverlayPanel('todo')
    }, [])
    const markTodoDone = useCallback((id: string) => {
        setTodoItems(prev => prev.map(t => t.id === id ? { ...t, done: true } : t))
    }, [])

    // Essay submit — AI ga baholash uchun yuborish
    async function submitEssay() {
        if (!essayPanel || essaySubmitted) return
        const wordCount = essayText.trim().split(/\s+/).filter(Boolean).length
        if (wordCount < essayPanel.minWords) {
            toast.error(`Kamida ${essayPanel.minWords} ta so'z yozing (hozir: ${wordCount})`)
            return
        }
        localStorage.removeItem('dtmmax_essay_draft')
        setEssaySubmitted(true)
        setEssayTimeLeft(null)
        const prompt = `📝 **Writing topshirig'i — ${essayPanel.task}:**\n"${essayPanel.prompt}"\n\n**Mening essayim (${wordCount} so'z):**\n${essayText}\n\n---\nIltimos, ushbu essayni Milliy Sertifikat (Multilevel) mezonlari bo'yicha baholang:\n1. **Task Achievement** — vazifani to'liq bajardimmi?\n2. **Coherence & Cohesion** — tuzilma va bog'liqlik\n3. **Lexical Resource** — leksik boylik\n4. **Grammatical Range & Accuracy** — grammatik to'g'rilik\n\nHar bir mezon uchun 30 balldan baho bering, jami 120 dan. Asosiy xatolarni ko'rsating va yaxshilash bo'yicha aniq tavsiyalar bering.`
        handleSend(prompt, [])
    }

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

    // Har render da ref ni yangilaymiz — stale closure muammosini hal qilish uchun
    submitTestPanelRef.current = submitTestPanel

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
        <ChatContext.Provider value={{ onOpenTest: openTestPanel, onProfileUpdate: handleProfileUpdate, onOpenFlash: handleOpenFlash, onOpenEssay: handleOpenEssay, onSetTodo: handleSetTodo }}>
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
                    className="flex flex-col transition-all duration-200 overflow-hidden flex-shrink-0 relative"
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

                    {/* Sidebar nav — Claude uslubi */}
                    <div className="px-2 pt-1 pb-2 flex-shrink-0 space-y-0.5">
                        {/* Yangi suhbat */}
                        <button onClick={createChat} disabled={creating}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                            style={{ color: 'var(--text-secondary)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <Plus className="h-4 w-4 flex-shrink-0" /> Yangi suhbat
                        </button>
                        {/* Testlar */}
                        <button onClick={() => { setOverlayPanel(overlayPanel === 'tests' ? null : 'tests'); markTestsSeen(); if (overlayPanel !== 'tests') { loadPublicTests(); loadMyResults() } }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition"
                            style={overlayPanel === 'tests' ? { background: 'var(--bg-muted)', color: 'var(--text-primary)' } : { color: 'var(--text-secondary)' }}
                            onMouseEnter={e => { if (overlayPanel !== 'tests') e.currentTarget.style.background = 'var(--bg-muted)' }}
                            onMouseLeave={e => { if (overlayPanel !== 'tests') e.currentTarget.style.background = 'transparent' }}
                        >
                            <ClipboardList className="h-4 w-4 flex-shrink-0" />
                            Testlar
                            {newTestIds.size > 0 && <span className="ml-auto px-1.5 rounded-full text-white text-[10px] flex items-center font-bold" style={{ background: '#f97316', height: '18px' }}>{newTestIds.size > 9 ? '9+' : newTestIds.size}</span>}
                        </button>
                        {/* Kartochkalar */}
                        <button onClick={() => setOverlayPanel(overlayPanel === 'flashcards' ? null : 'flashcards')}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition"
                            style={overlayPanel === 'flashcards' ? { background: 'var(--bg-muted)', color: 'var(--text-primary)' } : { color: 'var(--text-secondary)' }}
                            onMouseEnter={e => { if (overlayPanel !== 'flashcards') e.currentTarget.style.background = 'var(--bg-muted)' }}
                            onMouseLeave={e => { if (overlayPanel !== 'flashcards') e.currentTarget.style.background = 'transparent' }}
                        >
                            <Brain className="h-4 w-4 flex-shrink-0" />
                            Kartochkalar
                            {dueCount > 0 && <span className="ml-auto px-1.5 rounded-full text-white text-[10px] flex items-center font-bold" style={{ background: 'var(--brand)', height: '18px' }}>{dueCount > 9 ? '9+' : dueCount}</span>}
                        </button>
                        {/* Natijalar */}
                        <button onClick={() => setOverlayPanel(overlayPanel === 'progress' ? null : 'progress')}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition"
                            style={overlayPanel === 'progress' ? { background: 'var(--bg-muted)', color: 'var(--text-primary)' } : { color: 'var(--text-secondary)' }}
                            onMouseEnter={e => { if (overlayPanel !== 'progress') e.currentTarget.style.background = 'var(--bg-muted)' }}
                            onMouseLeave={e => { if (overlayPanel !== 'progress') e.currentTarget.style.background = 'transparent' }}
                        >
                            <TrendingUp className="h-4 w-4 flex-shrink-0" /> Natijalar
                        </button>
                        {/* Reja */}
                        <button onClick={() => setOverlayPanel(overlayPanel === 'todo' ? null : 'todo')}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition"
                            style={overlayPanel === 'todo' ? { background: 'var(--bg-muted)', color: 'var(--text-primary)' } : { color: 'var(--text-secondary)' }}
                            onMouseEnter={e => { if (overlayPanel !== 'todo') e.currentTarget.style.background = 'var(--bg-muted)' }}
                            onMouseLeave={e => { if (overlayPanel !== 'todo') e.currentTarget.style.background = 'transparent' }}
                        >
                            <Target className="h-4 w-4 flex-shrink-0" /> Reja
                            {todoItems.filter(t => !t.done).length > 0 && (
                                <span className="ml-auto text-[11px] font-bold h-5 w-5 rounded-full flex items-center justify-center"
                                    style={{ background: 'var(--brand)', color: 'white' }}>
                                    {todoItems.filter(t => !t.done).length}
                                </span>
                            )}
                        </button>
                    </div>

                    <div className="mx-3 flex-shrink-0" style={{ height: '1px', background: 'var(--border)' }} />

                    {/* Chat list — doim ko'rinadi */}
                    {true && (
                        <div className="flex-1 overflow-y-auto px-2 py-2" style={{ scrollbarWidth: 'thin' }}>
                            {chats.length === 0 ? (
                                <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>Hali suhbatlar yo'q</p>
                            ) : groupChatsByDate(chats).map(({ label, items }) => (
                                <div key={label} className="mb-3">
                                    <p className="text-[11px] font-medium px-3 mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
                                    {items.map(c => (
                                        <div key={c.id}
                                            className="group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer text-[13px] transition-colors"
                                            style={chatId === c.id ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' } : { color: 'var(--text-secondary)' }}
                                            onMouseEnter={e => { if (chatId !== c.id) e.currentTarget.style.background = 'var(--bg-muted)' }}
                                            onMouseLeave={e => { if (chatId !== c.id) e.currentTarget.style.background = 'transparent' }}
                                            onClick={() => nav(`/suhbat/${c.id}`)}>
                                            <span className="flex-1 truncate">{c.title}</span>
                                            <button onClick={(e) => deleteChat(c.id, e)} className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded transition flex-shrink-0" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}><Trash2 className="h-3 w-3" /></button>
                                        </div>
                                    ))}
                                </div>
                            ))}
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

                    {/* Sozlamalar modal (ChatGPT uslubi) */}
                    {showSettings && (
                        <div
                            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
                            onClick={e => { if (e.target === e.currentTarget) setShowSettings(false) }}
                        >
                            <div className="card" style={{ width: '100%', maxWidth: '680px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '16px' }}>
                                {/* Modal header */}
                                <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                                    <h2 className="text-base font-semibold">Sozlamalar</h2>
                                    <button onClick={() => setShowSettings(false)} className="h-7 w-7 flex items-center justify-center rounded-lg transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><X className="h-4 w-4" /></button>
                                </div>
                                {/* Modal body */}
                                <div className="flex flex-1 overflow-hidden">
                                    {/* Left nav */}
                                    <div className="flex-shrink-0 p-3 space-y-0.5" style={{ width: '180px', borderRight: '1px solid var(--border)', overflowY: 'auto' }}>
                                        {([
                                            { k: 'profile' as const, l: 'Profil', Icon: User },
                                            { k: 'appearance' as const, l: "Ko'rinish", Icon: darkMode ? Moon : Sun },
                                            { k: 'notifications' as const, l: 'Bildirishnomalar', Icon: Bell, badge: notifCount },
                                            { k: 'security' as const, l: 'Xavfsizlik', Icon: Shield },
                                            { k: 'account' as const, l: 'Akkount', Icon: LogOut },
                                        ] as const).map(({ k, l, Icon, badge }: { k: typeof settingsSection; l: string; Icon: React.ElementType; badge?: number }) => (
                                            <button key={k} onClick={() => { setSettingsSection(k); if (k === 'notifications') loadNotifications() }}
                                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition text-left"
                                                style={settingsSection === k ? { background: 'var(--brand-light)', color: 'var(--brand-hover)' } : { color: 'var(--text-secondary)' }}
                                                onMouseEnter={e => { if (settingsSection !== k) e.currentTarget.style.background = 'var(--bg-muted)' }}
                                                onMouseLeave={e => { if (settingsSection !== k) e.currentTarget.style.background = 'transparent' }}
                                            >
                                                <Icon className="h-4 w-4 flex-shrink-0" />
                                                <span className="flex-1 truncate">{l}</span>
                                                {badge != null && badge > 0 && <span className="h-4 w-4 rounded-full text-white text-[9px] flex items-center justify-center font-bold flex-shrink-0" style={{ background: 'var(--danger)' }}>{badge > 9 ? '9+' : badge}</span>}
                                            </button>
                                        ))}
                                    </div>
                                    {/* Right content */}
                                    <div className="flex-1 overflow-y-auto p-6 space-y-5">
                                        {settingsSection === 'profile' && (
                                            <>
                                                <div className="flex items-center gap-4">
                                                    <div className="h-14 w-14 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0" style={{ background: 'var(--brand)' }}>{user?.name?.[0]?.toUpperCase()}</div>
                                                    <div>
                                                        <p className="text-base font-semibold">{user?.name}</p>
                                                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
                                                    </div>
                                                </div>
                                                {(profile?.subject || profile?.examDate) && (
                                                    <div className="rounded-xl p-4 space-y-1.5" style={{ background: 'var(--bg-muted)' }}>
                                                        {profile.subject && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>📚 Fan: <span className="font-medium">{profile.subject}{(profile as any).subject2 ? ` va ${(profile as any).subject2}` : ''}</span></p>}
                                                        {profile.examDate && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>📅 Imtihon: <span className="font-medium">{new Date(profile.examDate).toLocaleDateString('uz-UZ')}</span></p>}
                                                        {profile.targetScore && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>🎯 Maqsad: <span className="font-medium">{profile.targetScore} ball</span></p>}
                                                    </div>
                                                )}
                                                <button onClick={() => { setShowOnboarding(true); setShowSettings(false) }}
                                                    className="btn btn-outline h-9 px-4 flex items-center gap-2 text-sm">
                                                    <Settings className="h-4 w-4" /> Profilni tahrirlash
                                                </button>
                                            </>
                                        )}
                                        {settingsSection === 'appearance' && (
                                            <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--bg-muted)' }}>
                                                <div className="flex items-center gap-3">
                                                    {darkMode ? <Moon className="h-5 w-5" style={{ color: 'var(--brand)' }} /> : <Sun className="h-5 w-5" style={{ color: 'var(--brand)' }} />}
                                                    <div>
                                                        <p className="text-sm font-medium">{darkMode ? "Qorong'i rejim" : "Yorug' rejim"}</p>
                                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Interfeys mavzusini almashtirish</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setDarkMode(!darkMode)}
                                                    className="relative h-7 w-12 rounded-full transition-all duration-300 flex-shrink-0"
                                                    style={{ background: darkMode ? 'var(--brand)' : 'var(--bg-muted)', border: '1px solid var(--border)' }}
                                                >
                                                    <span className="absolute top-1 h-5 w-5 rounded-full transition-all duration-300" style={{ background: 'white', left: darkMode ? '26px' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                                </button>
                                            </div>
                                        )}
                                        {settingsSection === 'notifications' && (
                                            <>
                                                <div className="flex items-center justify-between mb-1">
                                                    <p className="text-sm font-semibold">Bildirishnomalar</p>
                                                    {notifLoading && <div className="h-4 w-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />}
                                                </div>
                                                {notifications.length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center py-10" style={{ color: 'var(--text-muted)' }}>
                                                        <Bell className="h-8 w-8 mb-2 opacity-30" />
                                                        <p className="text-sm">Bildirishnomalar yo'q</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {notifications.map((n: any) => (
                                                            <div key={n.id} className="p-3 rounded-xl"
                                                                style={{ background: n.isRead ? 'var(--bg-muted)' : 'var(--brand-light)', border: '1px solid var(--border)' }}>
                                                                <p className="text-sm font-semibold mb-0.5">{n.title}</p>
                                                                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{n.message}</p>
                                                                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{n.sender?.name} · {new Date(n.createdAt).toLocaleDateString('uz')}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {settingsSection === 'security' && (
                                            <div className="space-y-4">
                                                <p className="text-sm font-semibold">Parolni o'zgartirish</p>
                                                {changePwOk && <div className="text-sm px-3 py-2 rounded-lg" style={{ background: '#D1FAE5', color: '#065F46' }}>Parol muvaffaqiyatli yangilandi!</div>}
                                                {changePwErr && <div className="text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>{changePwErr}</div>}
                                                <div className="space-y-2">
                                                    <input type="password" placeholder="Joriy parol" value={changePwForm.current} onChange={e => setChangePwForm(f => ({ ...f, current: e.target.value }))} className="input text-sm h-9" />
                                                    <input type="password" placeholder="Yangi parol (kamida 8 belgi)" value={changePwForm.newPw} onChange={e => setChangePwForm(f => ({ ...f, newPw: e.target.value }))} className="input text-sm h-9" />
                                                    <input type="password" placeholder="Yangi parolni tasdiqlang" value={changePwForm.confirm} onChange={e => setChangePwForm(f => ({ ...f, confirm: e.target.value }))} className="input text-sm h-9" />
                                                    <button disabled={changePwLoading || !changePwForm.current || !changePwForm.newPw || !changePwForm.confirm}
                                                        onClick={async () => {
                                                            setChangePwErr(''); setChangePwOk(false)
                                                            if (changePwForm.newPw !== changePwForm.confirm) { setChangePwErr('Yangi parollar mos kelmadi'); return }
                                                            setChangePwLoading(true)
                                                            try {
                                                                await fetchApi('/auth/change-password', { method: 'PUT', body: JSON.stringify({ currentPassword: changePwForm.current, newPassword: changePwForm.newPw }) })
                                                                setChangePwOk(true); setChangePwForm({ current: '', newPw: '', confirm: '' })
                                                            } catch (e: any) { setChangePwErr(e.message || 'Xatolik yuz berdi') }
                                                            setChangePwLoading(false)
                                                        }}
                                                        className="btn btn-outline w-full h-9 text-sm">{changePwLoading ? 'Saqlanmoqda...' : 'Parolni yangilash'}</button>
                                                </div>
                                            </div>
                                        )}
                                        {settingsSection === 'account' && (
                                            <div className="space-y-4">
                                                <button onClick={() => { setShowSettings(false); logout() }}
                                                    className="w-full h-10 flex items-center justify-center gap-2 text-sm font-medium rounded-xl transition"
                                                    style={{ color: 'var(--danger)', border: '1px solid var(--danger-light)', background: 'transparent' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-light)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                    <LogOut className="h-4 w-4" /> Tizimdan chiqish
                                                </button>
                                                <div className="rounded-xl p-4" style={{ border: '1px solid var(--danger-light)' }}>
                                                    <p className="text-sm font-semibold mb-1" style={{ color: 'var(--danger)' }}>Xavfli zona</p>
                                                    <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Akkauntni o'chirib bo'lmaydi — barcha ma'lumotlar o'chib ketadi.</p>
                                                    <button onClick={() => { setShowDeleteModal(true); setDeleteErr(''); setDeletePassword('') }}
                                                        className="w-full h-9 flex items-center justify-center gap-2 text-sm font-medium rounded-lg transition"
                                                        style={{ color: 'var(--danger)', border: '1px solid var(--danger)', background: 'transparent' }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-light)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                        Akkauntni o'chirish
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* User footer */}
                    <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2.5 px-2 py-1.5">
                            <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0" style={{ background: 'var(--brand)' }}>{user?.name?.[0]?.toUpperCase()}</div>
                            <div className="flex-1 min-w-0"><p className="text-[13px] font-medium truncate">{user?.name}</p></div>
                            <button onClick={() => setDarkMode(!darkMode)} className="h-7 w-7 flex items-center justify-center rounded-lg transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title={darkMode ? 'Yorug rejim' : 'Qorong\'i rejim'}>
                                {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                            </button>
                            <button onClick={() => { setSettingsSection('notifications'); loadNotifications(); setShowSettings(true) }} className="h-7 w-7 flex items-center justify-center rounded-lg transition relative" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Bildirishnomalar">
                                <Bell className="h-3.5 w-3.5" />
                                {notifCount > 0 && <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full text-white text-[8px] flex items-center justify-center font-bold" style={{ background: 'var(--danger)' }}>{notifCount > 9 ? '9+' : notifCount}</span>}
                            </button>
                            <button onClick={() => setShowSettings(true)} className="h-7 w-7 flex items-center justify-center rounded-lg transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Sozlamalar"><Settings className="h-3.5 w-3.5" /></button>
                        </div>
                    </div>
                </div>


                {/* Main */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <div className="h-14 flex items-center px-4 gap-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                        {/* ☰ doim ko'rinadi — sidebar toggle */}
                        <button onClick={() => setSideOpen(v => !v)} className="h-8 w-8 flex items-center justify-center rounded-lg transition flex-shrink-0" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Yonpanel"><Menu className="h-4 w-4" /></button>
                        <span className="text-sm font-medium truncate flex-1 min-w-0" style={{ color: 'var(--text-secondary)' }}>{currentChat?.title || ''}</span>
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
                    <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
                        {(!chatId || (messages.length === 0 && !loading && !streaming)) ? (
                            <div className="h-full flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
                                <div className="max-w-2xl w-full px-4 sm:px-6 anim-up">
                                    <div className="text-center mb-6 sm:mb-10">
                                        <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-5" style={{ background: 'var(--brand)' }}><BrainCircuit className="h-6 w-6 sm:h-7 sm:w-7 text-white" /></div>
                                        <h2 className="text-xl sm:text-2xl font-bold mb-2">Salom, {user?.name?.split(' ')[0]}! 👋</h2>
                                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Bugun nima o'rganmoqchisiz?</p>
                                    </div>
                                    <p className="text-center text-sm mt-4" style={{ color: 'var(--text-muted)' }}>
                                        Xabar yozing yoki savol bering — men yordam beraman 💬
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-3 sm:space-y-6">
                                {messages.map((m, i) => (
                                    <div key={m.id || i} className={`flex ${m.role === 'user' ? 'justify-end' : ''}`}>
                                        {m.role === 'user' ? (
                                            <div className="bubble-user">
                                                {m.content.includes('![') ? (
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex flex-wrap gap-2">
                                                            {Array.from(m.content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)).map((match, idx) => (
                                                                <img key={idx} src={match[1]} alt="" className="chat-img-thumb" />
                                                            ))}
                                                        </div>
                                                        {m.content.replace(/!\[[^\]]*\]\([^)]+\)/g, '').trim() && (
                                                            <p className="text-sm">{m.content.replace(/!\[[^\]]*\]\([^)]+\)/g, '').trim()}</p>
                                                        )}
                                                    </div>
                                                ) : m.content}
                                            </div>
                                        ) : (
                                            <div className="bubble-ai"><MdMessage content={m.content} /></div>
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
                                    <div className="flex">
                                        <div className="bubble-ai w-full sm:w-auto">
                                            <MdMessage content={streaming} isStreaming={true} />
                                            {/```test/.test(streaming) && !/```test[\s\S]*?```/.test(streaming) && (
                                                <div className="mt-3">
                                                    <span className="ai-generating"><span className="ai-star">✳</span> Test tuzmoqda...</span>
                                                </div>
                                            )}
                                            {/```flashcard/.test(streaming) && !/```flashcard[\s\S]*?```/.test(streaming) && (
                                                <div className="mt-3">
                                                    <span className="ai-generating"><span className="ai-star">✳</span> Kartochkalar tayyorlanmoqda...</span>
                                                </div>
                                            )}
                                            {/```vocab/.test(streaming) && !/```vocab[\s\S]*?```/.test(streaming) && (
                                                <div className="mt-3">
                                                    <span className="ai-generating"><span className="ai-star">✳</span> So'zlar tayyorlanmoqda...</span>
                                                </div>
                                            )}
                                            {/```formula/.test(streaming) && !/```formula[\s\S]*?```/.test(streaming) && (
                                                <div className="mt-3">
                                                    <span className="ai-generating"><span className="ai-star">✳</span> Formulalar tuzilmoqda...</span>
                                                </div>
                                            )}
                                            {/```todo/.test(streaming) && !/```todo[\s\S]*?```/.test(streaming) && (
                                                <div className="mt-3">
                                                    <span className="ai-generating"><span className="ai-star">✳</span> Kunlik reja tuzilmoqda...</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {loading && !streaming && !thinkingText && (
                                    <div className="flex py-1">
                                        <span className="ai-generating"><span className="ai-star">✳</span> Yozmoqda...</span>
                                    </div>
                                )}
                                {loading && thinkingText && !streaming && (
                                    <div className="flex py-1">
                                        <span className="ai-generating"><span className="ai-star">✳</span> Fikrlamoqda...</span>
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

                {/* Essay Panel */}
                {essayPanel && (() => {
                    const wordCount = essayText.trim().split(/\s+/).filter(Boolean).length
                    const wordOk = wordCount >= essayPanel.minWords
                    const wordOver = wordCount > essayPanel.maxWords
                    const wordColor = wordOver ? '#ef4444' : wordOk ? '#10b981' : 'var(--text-muted)'
                    return (
                        <div className={(essayMaximized || isMobile) ? 'fixed inset-0 z-50 flex flex-col' : 'relative flex flex-col flex-shrink-0'}
                            style={(essayMaximized || isMobile) ? { background: 'var(--bg-card)' } : { width: essayWidth, background: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }}>

                            {/* Drag handle */}
                            {!essayMaximized && !isMobile && (
                                <div onMouseDown={e => { essayDragRef.current = true; e.preventDefault() }}
                                    className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 transition-colors"
                                    style={{ background: 'transparent' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#10b98144'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'} />
                            )}

                            {/* Header */}
                            <div className="h-14 flex items-center justify-between px-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                                <div className="flex items-center gap-2">
                                    <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: '#10b981' }}>
                                        <PenLine className="h-3.5 w-3.5 text-white" />
                                    </div>
                                    <span className="text-sm font-semibold">Writing — {essayPanel.task}</span>
                                    {essayTimeLeft !== null && !essaySubmitted && (
                                        <span className={`text-sm font-mono tabular-nums ml-1 px-2 py-0.5 rounded-md ${essayTimeLeft < 120 ? 'animate-pulse' : ''}`}
                                            style={essayTimeLeft < 120 ? { color: '#ef4444', background: '#fef2f2' } : { color: 'var(--text-secondary)', background: 'var(--bg-muted)' }}>
                                            ⏱ {String(Math.floor(essayTimeLeft / 60)).padStart(2, '0')}:{String(essayTimeLeft % 60).padStart(2, '0')}
                                        </span>
                                    )}
                                    {essaySubmitted && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-md font-medium" style={{ background: '#d1fae5', color: '#065f46' }}>Topshirildi ✓</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setEssayMaximized(!essayMaximized)} className="h-7 w-7 flex items-center justify-center rounded-lg transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        {essayMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                    </button>
                                    <button onClick={() => { setEssayPanel(null) }} className="h-7 w-7 flex items-center justify-center rounded-lg transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollbarWidth: 'thin' }}>
                                <div className={essayMaximized ? 'max-w-2xl mx-auto space-y-4' : 'space-y-4'}>
                                    {/* Prompt */}
                                    <div className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.08)', border: '1.5px solid rgba(16,185,129,0.25)' }}>
                                        <p className="text-[11px] font-bold uppercase mb-2" style={{ color: '#10b981' }}>Topshiriq — {essayPanel.task}</p>
                                        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>{essayPanel.prompt}</p>
                                        <div className="flex gap-3 mt-3">
                                            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                                                {essayPanel.minWords}–{essayPanel.maxWords} so'z
                                            </span>
                                            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                                                ⏱ {essayPanel.time} daqiqa
                                            </span>
                                        </div>
                                    </div>

                                    {/* Textarea */}
                                    <div className="relative">
                                        <textarea
                                            value={essayText}
                                            onChange={e => !essaySubmitted && setEssayText(e.target.value)}
                                            readOnly={essaySubmitted}
                                            placeholder="Essayingizni shu yerga yozing..."
                                            className="w-full rounded-xl p-4 text-[13px] leading-relaxed resize-none outline-none transition-all"
                                            style={{
                                                minHeight: 280,
                                                height: essayMaximized ? '50vh' : 280,
                                                background: essaySubmitted ? 'var(--bg-surface)' : 'var(--bg-card)',
                                                border: `1.5px solid ${essaySubmitted ? 'var(--border)' : 'rgba(16,185,129,0.3)'}`,
                                                color: 'var(--text-primary)',
                                                fontFamily: 'inherit',
                                            }}
                                        />
                                        {/* Word count badge */}
                                        <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full font-semibold"
                                                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: wordColor }}>
                                                {wordCount} / {essayPanel.minWords}–{essayPanel.maxWords}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-muted)' }}>
                                        <div className="h-full rounded-full transition-all duration-300"
                                            style={{
                                                width: `${Math.min(100, (wordCount / essayPanel.maxWords) * 100)}%`,
                                                background: wordOver ? '#ef4444' : wordOk ? '#10b981' : '#10b981aa'
                                            }} />
                                    </div>

                                    {!essaySubmitted ? (
                                        <button onClick={submitEssay} disabled={!wordOk || wordOver}
                                            className="w-full h-11 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all"
                                            style={{
                                                background: wordOk && !wordOver ? '#10b981' : 'var(--bg-muted)',
                                                color: wordOk && !wordOver ? '#fff' : 'var(--text-muted)',
                                                cursor: wordOk && !wordOver ? 'pointer' : 'not-allowed'
                                            }}>
                                            <CheckCircle className="h-4 w-4" />
                                            {wordOk ? 'Topshirish va baholash' : `Yana ${essayPanel.minWords - wordCount} ta so'z yozing`}
                                        </button>
                                    ) : (
                                        <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: '#d1fae5', border: '1px solid #10b981' }}>
                                            <CheckCircle className="h-5 w-5 flex-shrink-0" style={{ color: '#065f46' }} />
                                            <p className="text-[13px]" style={{ color: '#065f46' }}>Essay topshirildi. Chatda baho va tavsiyalarni kuting.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })()}

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

                {/* ===== OVERLAY PANELS ===== */}
                {overlayPanel && (
                    <div className="fixed inset-0 z-50 flex" onClick={() => setOverlayPanel(null)}>
                        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }} />
                        <div className="relative ml-auto h-full flex flex-col overflow-hidden anim-up"
                            style={{ width: '100%', maxWidth: '680px', background: 'var(--bg-page)', boxShadow: '-8px 0 40px rgba(0,0,0,0.15)' }}
                            onClick={e => e.stopPropagation()}>

                            {/* Header */}
                            <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                                <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: overlayPanel === 'tests' ? 'rgba(224,123,57,0.12)' : overlayPanel === 'flashcards' ? 'rgba(99,102,241,0.12)' : overlayPanel === 'todo' ? 'rgba(224,123,57,0.12)' : 'rgba(16,185,129,0.12)' }}>
                                    {overlayPanel === 'tests' && <ClipboardList className="h-5 w-5" style={{ color: 'var(--brand)' }} />}
                                    {overlayPanel === 'flashcards' && <Brain className="h-5 w-5" style={{ color: '#6366f1' }} />}
                                    {overlayPanel === 'progress' && <BarChart2 className="h-5 w-5" style={{ color: '#10b981' }} />}
                                    {overlayPanel === 'todo' && <Target className="h-5 w-5" style={{ color: 'var(--brand)' }} />}
                                </div>
                                <div className="flex-1">
                                    <h2 className="font-semibold text-base">
                                        {overlayPanel === 'tests' ? 'Testlar' : overlayPanel === 'flashcards' ? 'Kartochkalar' : overlayPanel === 'todo' ? 'Kunlik reja' : 'Natijalar'}
                                    </h2>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                        {overlayPanel === 'tests' ? `${publicTests.length} ta test mavjud`
                                            : overlayPanel === 'flashcards' ? `${dueFlashcards.length} ta kartochka qaytarish kerak`
                                            : overlayPanel === 'todo' ? `${todoItems.filter(t => !t.done).length} ta vazifa qoldi`
                                            : 'O\'qish tahlili'}
                                    </p>
                                </div>
                                <button onClick={() => setOverlayPanel(null)} className="h-8 w-8 flex items-center justify-center rounded-lg transition"
                                    style={{ color: 'var(--text-muted)' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto px-5 py-4">
                                {overlayPanel === 'tests' && (
                                    <div className="space-y-3">
                                        {publicTests.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                                <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-muted)' }}>
                                                    <ClipboardList className="h-8 w-8" style={{ color: 'var(--text-muted)' }} />
                                                </div>
                                                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Hozircha testlar yo'q</p>
                                            </div>
                                        ) : publicTests.map(t => {
                                            const result = myResults.find(r => r.testId === t.id)
                                            return (
                                                <div key={t.id} className="rounded-2xl p-4 transition" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                                    <div className="flex items-start gap-3">
                                                        <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                            style={{ background: result ? 'rgba(16,185,129,0.12)' : 'rgba(224,123,57,0.1)' }}>
                                                            {result ? <CheckCircle className="h-5 w-5" style={{ color: '#10b981' }} /> : <ClipboardList className="h-5 w-5" style={{ color: 'var(--brand)' }} />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-semibold text-sm truncate">{t.title}</p>
                                                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t.subject} • {t._count?.questions ?? 0} savol</p>
                                                        </div>
                                                        {result ? (
                                                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                                                                {(result.total ?? 0) > 0 ? Math.round(result.score / result.total! * 100) : result.score}%
                                                            </span>
                                                        ) : (
                                                            <button onClick={() => { window.location.href = `/test/${t.id}` }}
                                                                className="text-xs font-semibold px-3 py-1.5 rounded-xl transition flex-shrink-0"
                                                                style={{ background: 'var(--brand)', color: 'white' }}>
                                                                Boshlash
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                {overlayPanel === 'flashcards' && (
                                    <div className="space-y-3">
                                        {dueFlashcards.length > 0 && (
                                            <div className="rounded-2xl p-4 mb-2" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-semibold text-sm" style={{ color: '#6366f1' }}>{dueFlashcards.length} ta kartochka takrorlash vaqti keldi</p>
                                                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Xotirani mustahkamlash uchun takrorlang</p>
                                                    </div>
                                                    <button onClick={() => { setOverlayPanel(null); setFlashPanel(dueFlashcards.map(f => ({ front: f.front, back: f.back }))); setFlashIdx(0); setFlashFlipped(false); setFlashIsReview(true) }}
                                                        className="text-sm font-semibold px-4 py-2 rounded-xl transition"
                                                        style={{ background: '#6366f1', color: 'white' }}>
                                                        Boshlash
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {dueFlashcards.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                                <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-muted)' }}>
                                                    <Brain className="h-8 w-8" style={{ color: 'var(--text-muted)' }} />
                                                </div>
                                                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Barcha kartochkalar takrorlandi</p>
                                                <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>Chatda "kartochkalar" deb yozing — AI yangi kartochkalar tuzadi</p>
                                            </div>
                                        )}
                                        {dueFlashcards.map(f => (
                                            <div key={f.id} className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                                <p className="text-sm font-medium">{f.front}</p>
                                                <p className="text-xs mt-2 pt-2" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>{f.back}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {overlayPanel === 'progress' && (
                                    <div className="space-y-4">
                                        {/* Stats grid */}
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { label: 'XP', value: progressData?.xp ?? 0, icon: <Zap className="h-5 w-5" />, color: '#f59e0b' },
                                                { label: 'Streak', value: `${progressData?.currentStreak ?? 0} kun`, icon: <Flame className="h-5 w-5" />, color: '#ef4444' },
                                                { label: "O'rtacha ball", value: `${Math.round(progressData?.avgScore ?? 0)}%`, icon: <Trophy className="h-5 w-5" />, color: '#10b981' },
                                                { label: 'Eng uzun streak', value: `${progressData?.longestStreak ?? 0} kun`, icon: <Target className="h-5 w-5" />, color: '#6366f1' },
                                            ].map((s, i) => (
                                                <div key={i} className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${s.color}18`, color: s.color }}>{s.icon}</div>
                                                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                                                    </div>
                                                    <p className="text-2xl font-bold">{s.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Weekly activity */}
                                        {progressData?.weeklyActivity && progressData.weeklyActivity.length > 0 && (
                                            <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                                <p className="text-sm font-semibold mb-4">Haftalik faollik</p>
                                                <div className="flex items-end gap-2 h-20">
                                                    {progressData.weeklyActivity.map((d, i) => {
                                                        const max = Math.max(...progressData.weeklyActivity.map(x => x.count), 1)
                                                        return (
                                                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                                                <div className="w-full rounded-t-lg transition-all" style={{ height: `${(d.count / max) * 60}px`, minHeight: '4px', background: d.count > 0 ? 'var(--brand)' : 'var(--bg-muted)' }} />
                                                                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{d.day.slice(0,2)}</span>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        {/* Test results */}
                                        {myResults.length > 0 && (
                                            <div>
                                                <p className="text-sm font-semibold mb-3">So'nggi testlar</p>
                                                <div className="space-y-2">
                                                    {myResults.slice(0, 5).map(r => (
                                                        <div key={r.id} className="flex items-center gap-3 rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                                            <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                                                style={{ background: ((r.total ?? 0) > 0 ? r.score/r.total! : r.score/100) >= 0.7 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)', color: ((r.total ?? 0) > 0 ? r.score/r.total! : r.score/100) >= 0.7 ? '#10b981' : '#ef4444' }}>
                                                                <Trophy className="h-4 w-4" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium truncate">{r.test?.title || publicTests.find(t => t.id === r.testId)?.title || 'Test'}</p>
                                                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleDateString('uz-UZ')}</p>
                                                            </div>
                                                            <span className="text-sm font-bold flex-shrink-0" style={{ color: ((r.total ?? 0) > 0 ? r.score/r.total! : r.score/100) >= 0.7 ? '#10b981' : '#ef4444' }}>{(r.total ?? 0) > 0 ? Math.round(r.score/r.total!*100) : r.score}%</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {myResults.length === 0 && !progressData && (
                                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                                <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-muted)' }}>
                                                    <BarChart2 className="h-8 w-8" style={{ color: 'var(--text-muted)' }} />
                                                </div>
                                                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Hozircha ma'lumot yo'q</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {overlayPanel === 'todo' && (
                                    <div className="space-y-2">
                                        {todoItems.filter(t => !t.done).length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                                <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(224,123,57,0.1)' }}>
                                                    <Target className="h-8 w-8" style={{ color: 'var(--brand)' }} />
                                                </div>
                                                <p className="text-sm font-semibold">Barcha vazifalar bajarildi! 🎉</p>
                                                <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>AI yangi reja tuzib berishi uchun chatda so'rang</p>
                                            </div>
                                        ) : todoItems.map(item => item.done ? null : (
                                            <div key={item.id} className="flex items-start gap-3 rounded-xl p-3.5 transition"
                                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                                <button onClick={() => markTodoDone(item.id)}
                                                    className="h-5 w-5 rounded-full border-2 flex-shrink-0 mt-0.5 transition hover:opacity-70"
                                                    style={{ borderColor: 'var(--brand)' }}
                                                    title="Bajarildi" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[13px] font-medium leading-snug">{item.task}</p>
                                                    {(item.subject || item.duration) && (
                                                        <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                                            {item.subject}{item.subject && item.duration ? ' · ' : ''}{item.duration ? `${item.duration} daqiqa` : ''}
                                                        </p>
                                                    )}
                                                </div>
                                                {item.time && (
                                                    <span className="text-[11px] font-semibold tabular-nums flex-shrink-0 px-2 py-0.5 rounded-lg"
                                                        style={{ background: 'rgba(224,123,57,0.1)', color: 'var(--brand)' }}>
                                                        {item.time}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div >
        </ChatContext.Provider>
    )
}
