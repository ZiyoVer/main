import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { BrainCircuit, Plus, Trash2, LogOut, Menu, X, GraduationCap, ClipboardList, Settings, BookOpen, Target, FileText, Square, Lightbulb, Maximize2, Minimize2, Paperclip, Layers, ChevronLeft, ChevronRight, RotateCcw, AlertTriangle, TrendingUp, Brain, PenLine, CheckCircle, Bell, Trophy, ArrowUp, BarChart2, User, Calendar, Shield, Sparkles, Clock } from 'lucide-react'
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
import { parseStructuredJson } from '@/lib/structuredJson'
import { SUBJECTS, normalizeSubjectValue } from '@/constants'
import { DTM_DIRECTIONS, SCORE_BOUNDS, dtmDirectionByCode, dtmDirectionBySubjects } from '@/constants/dtmDirections'
import { useAuthStore } from '@/store/authStore'
import ChatContext, { useChatContext, EssayPanel, TodoItem } from '../../contexts/ChatContext'
import { useTestPanel } from '../../hooks/useTestPanel'
import { useFlashPanel } from '../../hooks/useFlashPanel'
import { useIsPro, PRO_PRICE, PRO_PRICE_PERIOD, PRO_STATUS_LABEL, PRO_FEATURES, FREE_FEATURES, PRO_DISCLAIMER } from '@/lib/pro'

interface Chat { id: string; title: string; subject?: string; subject2?: string; updatedAt: string }
interface Msg { id: string; role: string; content: string; createdAt: string }
interface Profile { onboardingDone: boolean; examType?: 'DTM' | 'MS' | null; subject?: string; subject2?: string; examDate?: string; targetScore?: number; weakTopics?: string; strongTopics?: string; concerns?: string; totalTests?: number; avgScore?: number; abilityLevel?: number }
interface PublicTest { id: string; title: string; shareLink: string; subject?: string; category?: string; source?: string; _count?: { questions: number; attempts: number } }

/* Test manbasi badge'i — ishonch uchun (Rasmiy / Norasmiy / AI-bashorat). */
function sourceBadge(source?: string | null): { label: string; bg: string; color: string } | null {
    if (source === 'OFFICIAL') return { label: 'Rasmiy', bg: 'var(--success-light)', color: 'var(--success)' }
    if (source === 'AI_PREDICTION') return { label: 'AI bashorat', bg: 'var(--brand-light)', color: 'var(--brand)' }
    if (source === 'UNOFFICIAL') return { label: 'Norasmiy', bg: 'var(--bg-muted)', color: 'var(--text-muted)' }
    return null
}
interface MyResult {
    id: string
    testId: string
    score: number
    rawScore?: number | null
    scoreMax?: number | null
    grade?: string | null
    total?: number
    createdAt: string
    answers?: string
    test?: { title: string; subject?: string; subject2?: string; testType?: string }
}
interface WeakTopicItem { subject?: string; topic: string; accuracy: number; total: number }
interface RecentTestItem { id: string; title: string; subject?: string; score: number; date: string }
interface ProgressData {
    xp: number
    streak: number
    longestStreak: number
    currentStreak: number
    avgScore: number
    weeklyActivity: Array<{ day: string; count: number }>
    weakTopics?: WeakTopicItem[]
    recentTests?: RecentTestItem[]
}

type StructuredBlockType = 'test' | 'essay' | 'profile-update' | 'flashcard' | 'vocab' | 'formula' | 'todo-done' | 'todo' | null

function ensureArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? value as T[] : []
}

function parseAttemptAnswers(raw?: string): Array<{ isCorrect?: boolean }> {
    if (!raw) return []
    try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

function getAttemptSummary(result: MyResult) {
    const answers = parseAttemptAnswers(result.answers)
    const answeredCount = answers.length
    const correctCount = answers.filter(answer => Boolean(answer?.isCorrect)).length
    const percent = Math.round(result.score)
    return { answeredCount, correctCount, percent }
}

function getAttemptMeta(result: MyResult) {
    if (typeof result.rawScore === 'number' && typeof result.scoreMax === 'number') {
        return `${result.rawScore} / ${result.scoreMax}`
    }
    return `${result.score}%`
}

// Test paneli uchun inline KaTeX renderer (ReactMarkdown ishlatmaymiz, tez va engil)
function MathText({ text }: { text: string }) {
    const normalized = preprocessMath(text || '')
    if (!normalized.includes('$')) return <>{text}</>
    try {
        const html = normalized
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

function detectStructuredBlockType(raw: string, className?: string): StructuredBlockType {
    const lowerClass = className?.toLowerCase() || ''
    if (lowerClass.includes('language-test')) return 'test'
    if (lowerClass.includes('language-essay')) return 'essay'
    if (lowerClass.includes('language-profile-update')) return 'profile-update'
    if (lowerClass.includes('language-flashcard')) return 'flashcard'
    if (lowerClass.includes('language-vocab')) return 'vocab'
    if (lowerClass.includes('language-formula')) return 'formula'
    if (lowerClass.includes('language-todo-done')) return 'todo-done'
    if (lowerClass.includes('language-todo')) return 'todo'

    const parsed = parseStructuredJson<unknown>(raw)
    if (!parsed) return null

    if (Array.isArray(parsed)) {
        if (parsed.every(item => item && typeof item === 'object' && ('correctIdx' in item || 'correct' in item || 'options' in item || 'a' in item))) return 'test'
        if (parsed.every(item => item && typeof item === 'object' && 'front' in item && 'back' in item)) return 'flashcard'
        if (parsed.every(item => item && typeof item === 'object' && 'name' in item && 'formula' in item)) return 'formula'
        if (parsed.every(item => typeof item === 'string' || (item && typeof item === 'object' && ('word' in item || 'w' in item)))) return 'vocab'
        if (parsed.every(item => item && typeof item === 'object' && 'task' in item && ('time' in item || 'duration' in item || 'subject' in item))) return 'todo'
        return null
    }

    if (parsed && typeof parsed === 'object') {
        if ('prompt' in parsed) return 'essay'
        if ('weakTopics' in parsed || 'strongTopics' in parsed) return 'profile-update'
        if ('task' in parsed) return 'todo-done'
    }

    return null
}

// TodoBlockMount: mounts → opens todo panel, shows a tap card in chat
function TodoBlockMount({ items, onSetTodo }: { items: Omit<TodoItem, 'id' | 'done'>[], onSetTodo: (items: Omit<TodoItem, 'id' | 'done'>[]) => void }) {
    useEffect(() => { onSetTodo(items) }, [items, onSetTodo])
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

// TodoDoneMount: invisible component — mounts → marks matching todo as done
function TodoDoneMount({ taskName, onMarkDone }: { taskName: string; onMarkDone: (t: string) => void }) {
    useEffect(() => { onMarkDone(taskName) }, []) // eslint-disable-line
    return null
}

// MdMessage komponentni tashqarida va memo bilan ta'riflaymiz —
// shunda har keystrokeda re-render bo'lmaydi (ReactMarkdown+KaTeX qimmat!)
const MdMessage = memo(({ content, isStreaming }: {
    content: string
    isStreaming?: boolean
}) => {
    const { onOpenTest, onProfileUpdate, onOpenFlash, onOpenEssay, onSetTodo, onMarkTodoDoneByTask } = useChatContext()
    const processedContent = preprocessMath(content)
    return (
        <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeSanitize, rehypeKatex]} components={{
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
                const jsonStr = String(children).trim()
                const structuredType = detectStructuredBlockType(jsonStr, className)

                if (structuredType === 'test') {
                    const parsedQuestions = parseStructuredJson<unknown[]>(jsonStr)
                    const qCount = Array.isArray(parsedQuestions) ? parsedQuestions.length : 0
                    // 0 savol bo'lsa ko'rsatmaymiz — hali to'liq yuklanmagan
                    if (qCount === 0) return null
                    return (
                        <div className="my-3 rounded-2xl overflow-hidden" style={{
                            background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand) 10%, transparent) 0%, color-mix(in srgb, var(--brand) 4%, transparent) 100%)',
                            border: '1.5px solid color-mix(in srgb, var(--brand) 30%, transparent)',
                        }}>
                            <div className="p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--k-accent-grad)' }}>
                                            <ClipboardList className="h-5 w-5 text-white" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Test tayyor!</p>
                                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--brand)', color: '#fff' }}>
                                                    {qCount} ta savol
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    {!isStreaming && (
                                        <button
                                            onClick={() => onOpenTest(jsonStr)}
                                            className="flex-shrink-0 h-9 px-4 rounded-xl text-[13px] font-bold text-white flex items-center gap-2 transition-all"
                                            style={{ background: 'var(--k-accent-grad)' }}
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
                if (structuredType === 'essay') {
                    const data = parseStructuredJson<{ task?: string; prompt?: string; time?: number; minWords?: number; maxWords?: number }>(jsonStr)
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
                if (structuredType === 'profile-update') {
                    const data = parseStructuredJson<{ weakTopics?: string[]; strongTopics?: string[] }>(String(children).trim()) || {}
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
                if (structuredType === 'flashcard') {
                    const parsedCards = parseStructuredJson<unknown[]>(jsonStr)
                    const count = Array.isArray(parsedCards) ? parsedCards.length : 0
                    if (count === 0) return null
                    return (
                        <div className="my-3 rounded-2xl overflow-hidden" style={{
                            background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand) 10%, transparent) 0%, color-mix(in srgb, var(--brand) 4%, transparent) 100%)',
                            border: '1.5px solid color-mix(in srgb, var(--brand) 30%, transparent)',
                        }}>
                            <div className="p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--k-accent-grad)' }}>
                                            <Layers className="h-5 w-5 text-white" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Kartochkalar tayyor!</p>
                                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--brand)', color: '#fff' }}>
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
                                            style={{ background: 'var(--k-accent-grad)' }}
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
                if (structuredType === 'vocab') {
                    const parsed = parseStructuredJson<Array<string | { word?: string; w?: string; type?: string; pos?: string; hint?: string; h?: string; translation?: string; t?: string }>>(jsonStr)
                    const items: { word: string; type?: string; hint?: string }[] = Array.isArray(parsed)
                        ? parsed.map((x) => typeof x === 'string' ? { word: x } : {
                            word: x.word || x.w || '',
                            type: x.type || x.pos || '',
                            hint: x.hint || x.h || x.translation || x.t || ''
                        }).filter(item => item.word.trim().length > 0)
                        : []
                    if (items.length === 0) return null
                    const accentColors = ['#F15A24', '#0891b2', '#059669', '#FF8A4C', '#2563EB', '#0369a1', '#DA4A12', '#15803d']
                    const typeLabels: Record<string, string> = { noun: 'ot', verb: 'fe\'l', adj: 'sifat', adv: 'ravish', prep: 'ko\'m', phrase: 'ibora', phrasal: 'ph.v' }
                    return (
                        <div className="my-3 rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', minWidth: 0 }}>
                            <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                                <svg className="h-3.5 w-3.5" style={{ color: 'var(--brand)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>So'z boyligi — {items.length} ta</span>
                            </div>
                            <div className="grid min-w-0" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                                {items.map((item, i) => {
                                    const accent = accentColors[i % accentColors.length]
                                    const typeKey = (item.type || '').toLowerCase()
                                    const typeLabel = typeLabels[typeKey] || item.type
                                    const isRightCol = i % 2 === 1
                                    return (
                                        <div key={i} className="flex items-start gap-2 px-3 py-2.5 min-w-0 overflow-hidden hover:opacity-80 transition-opacity"
                                            style={{
                                                background: Math.floor(i / 2) % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                                                borderTop: i >= 2 ? `1px solid var(--border)` : 'none',
                                                borderLeft: isRightCol ? `1px solid var(--border)` : 'none',
                                            }}>
                                            <span className="text-[10px] font-mono mt-0.5 flex-shrink-0 w-4 text-right" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: accent }} />
                                            <div className="flex flex-col min-w-0 overflow-hidden">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-bold text-[13px] leading-snug break-all" style={{ color: accent }}>{item.word}</span>
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
                if (structuredType === 'formula') {
                    const parsed = parseStructuredJson<Array<{ name?: string; n?: string; formula?: string; f?: string; hint?: string; h?: string }>>(jsonStr)
                    const items: { name: string; formula: string; hint?: string }[] = Array.isArray(parsed)
                        ? parsed.map((x) => ({ name: x.name || x.n || '', formula: x.formula || x.f || '', hint: x.hint || x.h || '' }))
                            .filter(item => item.name.trim().length > 0 && item.formula.trim().length > 0)
                        : []
                    if (items.length === 0) return null
                    return (
                        <div className="my-3 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                            <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                                <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>FORMULALAR — {items.length} TA</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2">
                                {items.map((item, i) => {
                                    let rendered = ''
                                    try { rendered = DOMPurify.sanitize(katex.renderToString(item.formula, { displayMode: false, throwOnError: false })) } catch { rendered = DOMPurify.sanitize(item.formula) }
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
                // IMPORTANT: check todo-done BEFORE todo (language-todo includes language-todo-done)
                if (structuredType === 'todo-done') {
                    const data = parseStructuredJson<{ task: string }>(String(children).trim())
                    if (!data) return null
                    if (!data.task) return null
                    return <TodoDoneMount taskName={data.task} onMarkDone={onMarkTodoDoneByTask} />
                }
                if (structuredType === 'todo') {
                    const rawItems = parseStructuredJson<Omit<TodoItem, 'id' | 'done'>[]>(String(children).trim()) || []
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

const TODO_STORAGE_PREFIX = 'dtmmax_todo_items_v1'

function normalizeTodoSignaturePart(value: unknown): string {
    return String(value ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
}

function getTodoSignature(item: Pick<TodoItem, 'task'> & Partial<Pick<TodoItem, 'time' | 'subject' | 'duration'>>): string {
    return [
        normalizeTodoSignaturePart(item.task),
        normalizeTodoSignaturePart(item.time),
        normalizeTodoSignaturePart(item.subject),
        normalizeTodoSignaturePart(item.duration)
    ].join('|')
}

function loadStoredTodos(storageKey: string): TodoItem[] {
    try {
        const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]')
        if (!Array.isArray(parsed)) return []
        return parsed
            .filter((item: unknown): item is TodoItem => Boolean(item) && typeof item === 'object' && typeof (item as TodoItem).task === 'string')
            .map((item, index) => ({
                id: typeof item.id === 'string' && item.id ? item.id : `todo-stored-${index}-${Date.now()}`,
                task: item.task,
                time: typeof item.time === 'string' ? item.time : undefined,
                subject: typeof item.subject === 'string' ? item.subject : undefined,
                duration: typeof item.duration === 'number' ? item.duration : undefined,
                done: Boolean(item.done)
            }))
    } catch {
        return []
    }
}

interface ChatInputAreaProps {
    chatId: string | undefined
    loading: boolean
    thinkingMode: boolean
    setThinkingMode: React.Dispatch<React.SetStateAction<boolean>>
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
        { Icon: ClipboardList, l: 'Test yech', p: "Shu mavzu bo'yicha qisqa test ber. Natijadan keyin zaif joylarimni ham ayting." },
        { Icon: BookOpen, l: 'Tushuntir', p: 'Shu mavzuni oddiy va tushunarli usulda qayta tushuntiring.' },
        { Icon: Layers, l: 'Kartochka', p: "Shu mavzuning eng muhim tushunchalari bo'yicha kartochkalar tayyorlang (```flashcard JSON format)." },
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
                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-strong)', boxShadow: '0 1px 4px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.03)' }}>
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
                        {/* Thinking mode — Pro imkoniyat (beta'da hammaga ochiq, bloklanmaydi) */}
                        <button type="button" onClick={() => setThinkingMode(v => !v)}
                            title={thinkingMode ? 'Chuqur fikrlash yoqilgan • Pro (beta\'da bepul)' : 'Chuqur fikrlash • Pro (beta\'da bepul)'}
                            className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium transition"
                            style={thinkingMode ? { background: 'var(--brand-light)', color: 'var(--brand)' } : { color: 'var(--text-muted)' }}
                            onMouseEnter={e => { if (!thinkingMode) e.currentTarget.style.background = 'var(--bg-surface)' }}
                            onMouseLeave={e => { if (!thinkingMode) e.currentTarget.style.background = 'transparent' }}>
                            <Lightbulb className="h-3.5 w-3.5" />
                            {thinkingMode && <span>Chuqur</span>}
                            <span className="text-[9px] font-bold leading-none px-1 py-0.5 rounded"
                                style={{ background: thinkingMode ? 'color-mix(in srgb, var(--brand) 22%, transparent)' : 'var(--brand-light)', color: 'var(--brand)', letterSpacing: '0.02em' }}>
                                PRO
                            </span>
                        </button>
                        <div className="flex-1" />
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
                                style={{ background: 'var(--k-accent-grad)', color: 'white', boxShadow: 'var(--k-shadow-cta)' }}
                                title="Yuborish">
                                <ArrowUp className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
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
    const todoStorageKey = `${TODO_STORAGE_PREFIX}_${user?.id || 'guest'}`
    // Essay draft kaliti foydalanuvchi bo'yicha scoped — umumiy qurilmada boshqa userga sizib o'tmasin
    const essayDraftKey = `dtmmax_essay_draft_${user?.id || 'guest'}`
    const [chats, setChats] = useState<Chat[]>([])
    const [chatsLoaded, setChatsLoaded] = useState(false)
    const [messages, setMessages] = useState<Msg[]>([])
    const [loading, setLoading] = useState(false)
    const [creating, setCreating] = useState(false)
    const [streaming, setStreaming] = useState('')
    const [sideOpen, setSideOpen] = useState(true)
    const [currentChat, setCurrentChat] = useState<Chat | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [profileLoaded, setProfileLoaded] = useState(false)
    const [showOnboarding, setShowOnboarding] = useState(false)
    const [overlayPanel, setOverlayPanel] = useState<'tests' | 'flashcards' | 'progress' | 'pro' | null>(null)
    const [testCategory, setTestCategory] = useState<string>('all') // testlar bo'limi kategoriya filtri
    const [activeTestSource, setActiveTestSource] = useState<string | null>(null) // ochiq test panelining manbasi (badge uchun)
    const [todoItems, setTodoItems] = useState<TodoItem[]>(() => loadStoredTodos(todoStorageKey))
    const [todoOpen, setTodoOpen] = useState(() => loadStoredTodos(todoStorageKey).length > 0)
    const [showSettings, setShowSettings] = useState(false)
    const [showNotifications, setShowNotifications] = useState(false)
    const [publicTests, setPublicTests] = useState<PublicTest[]>([])
    const [myResults, setMyResults] = useState<MyResult[]>([])
    const [progressData, setProgressData] = useState<ProgressData | null>(null)
    const [dueFlashcards, setDueFlashcards] = useState<Array<{ id: string; front: string; back: string; subject: string }>>([])
    const [dueCount, setDueCount] = useState(0)
    const [totalFlashcards, setTotalFlashcards] = useState(0)
    const [flashIsReview, setFlashIsReview] = useState(false)
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false)
    const [onboardingForm, setOnboardingForm] = useState<{
        examType: '' | 'DTM' | 'MS'
        subject: string
        subject2: string
        targetScore: number | ''
        examDate: string
        weakTopics: string
        strongTopics: string
        concerns: string
    }>({
        examType: '', subject: 'Matematika', subject2: '', targetScore: '', examDate: '',
        weakTopics: '', strongTopics: '', concerns: ''
    })
    const [savingProfile, setSavingProfile] = useState(false)
    // Birinchi marta onboarding — har bir savol alohida ekran (1=tur, 2=fan, 3=sana, 4=ball)
    const [obStep, setObStep] = useState(1)
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
    const thinkingModeRef = useRef(thinkingMode)
    // Pro tier modeli (non-enforcing): faqat ko'rinish/teglar uchun — hech narsani bloklamaydi
    const pro = useIsPro()
    const todoItemsRef = useRef<TodoItem[]>([])
    const todoAutoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const visionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const pendingHydrationChatIdRef = useRef<string | null>(null)
    const autoLandingChatRef = useRef(false)
    const isMountedRef = useRef(true)
    const scrollRef = useRef<HTMLDivElement>(null)
    const userScrolledRef = useRef(false)
    const blobUrlsRef = useRef<string[]>([])
    const abortRef = useRef<AbortController | null>(null)
    const chatIdRef = useRef<string | undefined>(chatId)
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

    useEffect(() => {
        thinkingModeRef.current = thinkingMode
    }, [thinkingMode])

    useEffect(() => {
        todoItemsRef.current = todoItems
    }, [todoItems])

    useEffect(() => {
        try {
            if (todoItems.length > 0) localStorage.setItem(todoStorageKey, JSON.stringify(todoItems))
            else localStorage.removeItem(todoStorageKey)
        } catch (err) {
            console.warn('Todo rejani saqlab bo\'lmadi:', err)
        }
    }, [todoItems, todoStorageKey])

    useEffect(() => {
        return () => {
            isMountedRef.current = false
            if (todoAutoCloseRef.current) clearTimeout(todoAutoCloseRef.current)
            if (visionIntervalRef.current) clearInterval(visionIntervalRef.current)
            visionIntervalRef.current = null
            // ChatLayout unmount bo'lganda global .dark sinfini tozalaymiz (boshqa sahifalarga leak qilmasin)
            document.documentElement.classList.remove('dark')
        }
    }, [])

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
        if (typeof window === 'undefined') return 280
        const w = window.innerWidth
        if (w < 768) return 280
        if (w <= 1100) return 240
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

    // Faqat yorug' rejim — har yuklanishda eski 'dark' sinfi va localStorage flagini tozalaymiz
    // (avval qorong'i rejimda bo'lgan foydalanuvchilar ham yorug' ko'rsin)
    useEffect(() => {
        document.documentElement.classList.remove('dark')
        try { localStorage.removeItem('darkMode') } catch { /* localStorage yo'q bo'lishi mumkin */ }
    }, [])

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
    useEffect(() => {
        // chatId ref'ini sinxronlash — stream guard'lari shu ref'ga tayanadi
        chatIdRef.current = chatId
        // Boshqa chatga o'tilganda davom etayotgan SSE stream'ni bekor qilamiz,
        // aks holda javob noto'g'ri chatga yozilib qoladi
        if (abortRef.current) {
            abortRef.current.abort()
            abortRef.current = null
        }
        if (chatId) loadMessages(chatId)
    }, [chatId])
    useEffect(() => {
        if (chatId || !chatsLoaded || !profileLoaded || showOnboarding || autoLandingChatRef.current) return
        autoLandingChatRef.current = true

        const openInitialChat = async () => {
            if (chats.length > 0) {
                nav(`/suhbat/${chats[0].id}`, { replace: true })
                return
            }

            setCreating(true)
            try {
                const data = await fetchApi('/chat/new', {
                    method: 'POST',
                    body: JSON.stringify({
                        title: 'Yangi suhbat',
                        subject: normalizeSubjectValue(profileRef.current?.subject || profile?.subject) || undefined,
                        subject2: normalizeSubjectValue(profileRef.current?.subject2 || profile?.subject2) || undefined,
                        forceNew: true
                    })
                })
                await loadChats()
                setMessages([])
                setCurrentChat(data)
                nav(`/suhbat/${data.id}`, { replace: true })
            } catch (err) {
                console.error('openInitialChat:', err)
                autoLandingChatRef.current = false
            } finally {
                setCreating(false)
            }
        }

        openInitialChat()
    }, [chatId, chatsLoaded, profileLoaded, showOnboarding, chats, profile, nav])

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

        const triggerAnalysis = async () => {
            try {
                const chatData = await fetchApi('/chat/new', {
                    method: 'POST',
                    body: JSON.stringify({
                        title: `Test tahlili: ${guestData.title || 'Test'}`,
                        subject: guestData.subject,
                        subject2: guestData.subject2,
                        forceNew: true
                    })
                })
                await loadChats()

                // Chatni localStorage ga saqlaymiz — "AI tahlil" tugmasi qayta bosganda shu chatga qaytadi
                localStorage.setItem('dtmmax_analysis_chat_id', chatData.id)

                const displayText = `📊 "${guestData.title}" testi tahlili (${guestData.score}/${guestData.total} to'g'ri)`

                try {
                    const analysisRes = await fetchApi('/tests/analyze-result', {
                        method: 'POST',
                        body: JSON.stringify({
                            title: guestData.title,
                            subject: guestData.subject,
                            score: guestData.score,
                            total: guestData.total,
                            questions: guestData.questions
                        })
                    })
                    if (analysisRes?.analysis) {
                        nav(`/suhbat/${chatData.id}`, { state: { pendingAnalysis: { preComputed: analysisRes.analysis, displayText } } })
                        return
                    }
                } catch (e) {
                    console.error('analyze-result:', e)
                }

                // Fallback — local prompt bilan DeepSeek text tahlili
                const optLabels = ['A', 'B', 'C', 'D']
                const allList = (guestData.questions || []).map((q: any, i: number) => {
                    if (q.questionType === 'matching' && q.subAnswers) {
                        const subList = (q.subAnswers || []).map((sa: any, si: number) =>
                            `   ${si + 1}. ${sa.subText} — Men: ${sa.studentAnswer}, To'g'ri: ${sa.correctAnswer}`
                        ).join('\n')
                        return `${i + 1}. Moslashtirish: ${q.text || ''}\n${subList}`
                    }
                    if (q.questionType === 'multipart_open' && q.subAnswers) {
                        const subList = (q.subAnswers || []).map((sa: any, si: number) =>
                            `   ${sa.label || String.fromCharCode(65 + si)}. ${sa.subText} — Men: ${sa.studentAnswer}, To'g'ri: ${sa.correctAnswer}`
                        ).join('\n')
                        return `${i + 1}. Multi-part yozma savol: ${q.text || ''}\n${subList}`
                    }
                    const isCorrect = q.studentAnswer === q.correctAnswer
                    const status = isCorrect ? '✅' : '❌'
                    const opts = ['a', 'b', 'c', 'd'].map((k, oi) => q[k] ? `${optLabels[oi]}) ${q[k]}` : null).filter(Boolean).join(' | ')
                    return `${status} ${i + 1}. ${(q.text || 'Savol').substring(0, 200)}\n   ${opts ? 'Variantlar: ' + opts : ''}\n   Men: ${(q.studentAnswer || '—').toUpperCase()}, To'g'ri: ${(q.correctAnswer || '—').toUpperCase()}`
                }).join('\n\n')

                const prompt = `Men "${guestData.title || 'Test'}" testini yechtim (${guestData.subject || ''}).
Natija: ${guestData.score}/${guestData.total} to'g'ri (${guestData.total > 0 ? Math.round(guestData.score / guestData.total * 100) : 0}%).

Barcha savollar:
${allList}

Iltimos, har bir savolni tahlil qilib ber:
- ✅ To'g'ri yechganlarni: qisqacha nima uchun to'g'ri ekanini tushuntir
- ❌ Xato yechganlarni: batafsil to'g'ri yechimini ko'rsat, nima uchun xato va to'g'ri javob nima uchun to'g'ri
- Oxirida xulosa: qaysi mavzularda zaif ekanimni va nima o'rganishim kerakligini ayt`

                // /suhbat vs /suhbat/:chatId turli route komponentlari — nav qilganda
                // eski komponent unmount bo'ladi. Promtni state orqali yangi komponentga uzatamiz.
                nav(`/suhbat/${chatData.id}`, { state: { pendingAnalysis: { prompt, displayText } } })
            } catch (e) {
                console.error('analyzeTest error:', e)
                setLoading(false)
            }
        }
        triggerAnalysis()
    }, [location.search]) // eslint-disable-line react-hooks/exhaustive-deps

    // Navigatsiyadan keyin yangi komponentda pending analysisni stream qilish
    // (analyzeTest nav qilganda eski komponent unmount bo'ladi — stream yangi komponentda ishlanadi)
    useEffect(() => {
        const state = location.state as any
        if (!state?.pendingAnalysis || !chatId) return
        const { prompt, displayText, preComputed } = state.pendingAnalysis
        // State ni darhol tozalaymiz — qayta trigger bo'lmasin
        nav(location.pathname, { replace: true, state: {} })
        if (preComputed) {
            // Vision tahlil tayyor — to'g'ridan-to'g'ri ko'rsatamiz (DeepSeeksiz)
            setTimeout(() => {
                setMessages(prev => [...prev,
                    { id: 'tmp-u-' + Date.now(), role: 'user', content: displayText || '📊 Test tahlili', createdAt: new Date().toISOString() },
                    { id: 'tmp-a-' + Date.now(), role: 'assistant', content: preComputed, createdAt: new Date().toISOString() }
                ])
                // Backendga ham saqlaymiz (history uchun)
                fetchApi(`/chat/${chatId}/save-analysis`, {
                    method: 'POST',
                    body: JSON.stringify({ userMessage: displayText || '📊 Test tahlili', analysisMessage: preComputed })
                }).catch(e => console.error('save-analysis:', e))
            }, 300)
        } else {
            setTimeout(() => streamToChat(chatId, prompt, displayText), 300)
        }
    }, [chatId, location.state]) // eslint-disable-line react-hooks/exhaustive-deps

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
            // Pastda bo'lsa — auto-scroll'ga ruxsat; tepaga ko'tarilsa — to'xtatamiz.
            // (Bevosita scrollTop orqali — touch/telefonda ham ishlaydi, wheel shart emas.)
            const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
            userScrolledRef.current = !isNearBottom
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

    // Notification count — har daqiqa yangilanadi (faqat settings yopiq bo'lganda)
    useEffect(() => {
        if (!token) return
        const fetchCount = async () => {
            if (showSettings) return // settings ochiq bo'lsa yangilamaymiz
            try {
                const data = await fetchApi('/notifications?count=true')
                setNotifCount(data.count || 0)
            } catch { }
        }
        fetchCount()
        const interval = setInterval(fetchCount, 60000)
        return () => clearInterval(interval)
    }, [token, showSettings])

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

    // Essay draft — localStorage ga saqlash (har o'zgarishda), foydalanuvchi bo'yicha scoped kalit bilan
    useEffect(() => {
        if (!essayPanel || essaySubmitted) return
        localStorage.setItem(essayDraftKey, JSON.stringify({
            panel: essayPanel,
            text: essayText,
            timeLeft: essayTimeLeft,
            savedAt: Date.now()
        }))
    }, [essayPanel, essayText, essayTimeLeft, essaySubmitted, essayDraftKey])

    // Essay draft — tiklash (foydalanuvchi qaytib kelganda); kalit user id'ga bog'liq
    useEffect(() => {
        try {
            const raw = localStorage.getItem(essayDraftKey)
            if (!raw) return
            const { panel, text, timeLeft, savedAt } = JSON.parse(raw)
            if (!panel) return
            const elapsed = Math.floor((Date.now() - savedAt) / 1000)
            const restoredTime = timeLeft !== null ? Math.max(0, timeLeft - elapsed) : null
            if (restoredTime !== null && restoredTime <= 0) {
                localStorage.removeItem(essayDraftKey)
                return
            }
            setEssayPanel(panel)
            setEssayText(text || '')
            setEssayTimeLeft(restoredTime)
            setEssaySubmitted(false)
            toast.success('Yozish topshirig\'i tiklandi', { duration: 3000 })
        } catch { /* ignore */ }
    }, [essayDraftKey]) // eslint-disable-line react-hooks/exhaustive-deps

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
            const normalizedProfile = p && typeof p === 'object' && !Array.isArray(p) ? {
                ...p,
                subject: normalizeSubjectValue(p.subject) || undefined,
                subject2: normalizeSubjectValue((p as any).subject2) || undefined
            } : null
            setProfile(normalizedProfile)
            profileRef.current = normalizedProfile
            if (normalizedProfile && !normalizedProfile.onboardingDone) { setObStep(1); setShowOnboarding(true) }
            if (normalizedProfile) {
                let weak: string[] = []
                let strong: string[] = []
                try { weak = normalizedProfile.weakTopics ? JSON.parse(normalizedProfile.weakTopics) : [] } catch { /* invalid JSON */ }
                try { strong = normalizedProfile.strongTopics ? JSON.parse(normalizedProfile.strongTopics) : [] } catch { /* invalid JSON */ }
                // examType: saqlangan qiymat; yo'q bo'lsa — to'g'ri DTM juftligi bo'lsa DTM deb taxmin qilamiz
                const savedExamType = normalizedProfile.examType === 'DTM' || normalizedProfile.examType === 'MS'
                    ? normalizedProfile.examType
                    : (dtmDirectionBySubjects(normalizedProfile.subject, normalizedProfile.subject2) ? 'DTM' : '')
                setOnboardingForm({
                    examType: savedExamType,
                    subject: normalizedProfile.subject || 'Matematika',
                    subject2: normalizedProfile.subject2 || '',
                    targetScore: typeof normalizedProfile.targetScore === 'number' ? normalizedProfile.targetScore : '',
                    examDate: normalizedProfile.examDate ? new Date(normalizedProfile.examDate).toISOString().split('T')[0] : '',
                    weakTopics: weak.join(', '),
                    strongTopics: strong.join(', '),
                    concerns: normalizedProfile.concerns || ''
                })
            }
        } catch (err: any) {
            console.error('loadProfile:', err)
            // Faqat 404 (profil yo'q) da onboarding ko'rsatish — network xatosida emas
            if (err?.status === 404 || err?.message?.includes('404')) { setObStep(1); setShowOnboarding(true) }
        } finally {
            setProfileLoaded(true)
        }
    }

    async function loadPublicTests() {
        setTestsLoading(true)
        try {
            const data = await fetchApi('/tests/public')
            const tests = ensureArray<PublicTest>(data)
            setPublicTests(tests)
            // Ko'rilgan test IDlarini localStorage dan olish
            let seenIds: string[] = []
            try { seenIds = JSON.parse(localStorage.getItem('dtmmax_seen_tests') || '[]') } catch { }
            const seenSet = new Set(seenIds)
            // Yangi testlar = ko'rilmaganlar
            const newIds = new Set<string>(tests.filter((t: any) => !seenSet.has(t.id)).map((t: any) => t.id))
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

    function markSingleTestSeen(testId: string) {
        try {
            const seenIds: string[] = JSON.parse(localStorage.getItem('dtmmax_seen_tests') || '[]')
            const nextSeenIds = Array.from(new Set([...seenIds, testId]))
            localStorage.setItem('dtmmax_seen_tests', JSON.stringify(nextSeenIds))
        } catch { }
        setNewTestIds(prev => {
            if (!prev.has(testId)) return prev
            const next = new Set(prev)
            next.delete(testId)
            return next
        })
    }

    async function markTestNotificationRead(testId: string, title?: string) {
        markSingleTestSeen(testId)
        try {
            const data = await fetchApi(`/notifications/test/${testId}/read`, { method: 'PATCH', silent: true })
            const updated = typeof data?.updated === 'number' ? data.updated : 0
            if (updated > 0) setNotifCount(current => Math.max(0, current - updated))
            setNotifications(prev => prev.filter(notification => {
                const isTargetNotification = notification.targetType === 'test' && notification.targetId === testId
                const isLegacyTitle = title ? notification.title === `📚 Yangi test: ${title}` : false
                const isLegacyMessage = title ? String(notification.message || '').includes(`"${title}"`) : false
                return !(isTargetNotification || isLegacyTitle || isLegacyMessage)
            }))
        } catch (err) {
            console.error('markTestNotificationRead:', err)
        }
    }

    async function loadMyResults() {
        try {
            const data = await fetchApi('/tests/my-results')
            setMyResults(ensureArray<MyResult>(data))
        } catch (err) { console.error('loadMyResults:', err) }
    }

    async function loadProgress() {
        try {
            const data = await fetchApi('/progress/me')
            setProgressData(data && typeof data === 'object' && !Array.isArray(data) ? data as ProgressData : null)
        } catch (err) { console.error('loadProgress:', err) }
    }

    async function loadDueFlashcards() {
        try {
            const data = await fetchApi('/flashcards/due')
            const cards = ensureArray<{ id: string; front: string; back: string; subject: string }>(data?.cards)
            setDueFlashcards(cards)
            setDueCount(typeof data?.dueCount === 'number' ? data.dueCount : 0)
            setTotalFlashcards(typeof data?.total === 'number' ? data.total : 0)
        } catch (err) { console.error('loadDueFlashcards:', err) }
    }

    const loadNotifications = async () => {
        setNotifLoading(true)
        try {
            const data = await fetchApi('/notifications')
            setNotifications(ensureArray<any>(data))
        } catch { } finally { setNotifLoading(false) }
    }

    const markNotificationsRead = async () => {
        try {
            await fetchApi('/notifications/read-all', { method: 'PATCH' })
            setNotifCount(0)
            setNotifications([])
        } catch (err) {
            console.error('markNotificationsRead:', err)
            toast.error("Bildirishnomalarni yangilab bo'lmadi")
        }
    }

    async function logActivity(xpGained = 5) {
        try { await fetchApi('/progress/activity', { method: 'POST', body: JSON.stringify({ xpGained }) }) } catch (err) { console.error('logActivity:', err) }
    }

    async function saveOnboarding(e: React.FormEvent) {
        e.preventDefault()
        // Onboarding faqat oxirgi qadamning "Boshlash" tugmasi bilan saqlanadi.
        // Date/number input'idan kelgan implicit submit (Enter) oynani erta yopib qo'ymasin.
        // (Settings formasida showOnboarding=false — bu guard u yerga ta'sir qilmaydi.)
        if (showOnboarding && obStep !== OB_TOTAL_STEPS) return
        setSavingProfile(true)
        try {
            const data = {
                ...onboardingForm,
                examType: onboardingForm.examType || null,
                // MS yoki bo'sh — 2-fan yo'q; DTM — yo'nalish juftligidan kelgan qiymat
                subject2: (onboardingForm.examType === 'DTM' ? onboardingForm.subject2 : '') || null,
                targetScore: onboardingForm.targetScore === '' ? null : onboardingForm.targetScore,
                weakTopics: onboardingForm.weakTopics ? onboardingForm.weakTopics.split(',').map(s => s.trim()).filter(Boolean) : [],
                strongTopics: onboardingForm.strongTopics ? onboardingForm.strongTopics.split(',').map(s => s.trim()).filter(Boolean) : [],
                onboardingDone: true,
            }
            await fetchApi('/profile', { method: 'PUT', body: JSON.stringify(data) })
            setShowOnboarding(false)
            await loadProfile()
            toast.success('Profil muvaffaqiyatli saqlandi!')
            // Birinchi marta onboarding — avtomatik chat ochamiz
            if (!profile?.onboardingDone) {
                const firstChat = await fetchApi('/chat/new', {
                    method: 'POST',
                    body: JSON.stringify({
                        title: 'Salom!',
                        subject: onboardingForm.subject,
                        subject2: onboardingForm.subject2 || undefined
                    })
                })
                await loadChats()
                setMessages([])
                setCurrentChat(firstChat)
                nav(`/suhbat/${firstChat.id}`)
            }
        } catch (err) { console.error('saveOnboarding:', err) }
        setSavingProfile(false)
    }

    async function loadChats(): Promise<Chat[]> {
        try {
            const c = await fetchApi('/chat/list')
            const chatsList = ensureArray<Chat>(c)
            setChats(chatsList)
            return chatsList
        } catch (err) { console.error('loadChats:', err) }
        finally { setChatsLoaded(true) }
        return []
    }

    async function requestAutoGreeting(id: string): Promise<Msg | null> {
        try {
            const data = await fetchApi(`/chat/${id}/auto-greet`, {
                method: 'POST',
                silent: true
            })
            if (data?.message && typeof data.message === 'object' && !Array.isArray(data.message) && typeof data.message.content === 'string') {
                return data.message as Msg
            }
        } catch (err) {
            console.error('requestAutoGreeting:', err)
        }
        return null
    }

    async function loadMessages(id: string) {
        if (pendingHydrationChatIdRef.current === id) {
            pendingHydrationChatIdRef.current = null
            return
        }
        loadControllerRef.current?.abort()
        const controller = new AbortController()
        loadControllerRef.current = controller
        try {
            const data = await fetchApi(`/chat/${id}/messages`, { signal: controller.signal })
            if (controller.signal.aborted) return
            let nextMessages = ensureArray<Msg>(data?.messages)
            const nextChat = data?.chat && typeof data.chat === 'object' && !Array.isArray(data.chat) ? data.chat as Chat : null
            if (nextMessages.length === 0) {
                const autoGreeting = await requestAutoGreeting(id)
                if (controller.signal.aborted) return
                if (autoGreeting) {
                    nextMessages = [autoGreeting]
                }
            }
            setMessages(nextMessages)
            setCurrentChat(nextChat)
            // Yangi chatga kirganda pastga scroll qilish
            setTimeout(() => {
                const el = scrollRef.current
                if (el) el.scrollTop = el.scrollHeight
            }, 50)
        } catch (err: any) {
            if (err?.name === 'AbortError') return
            console.error('loadMessages:', err)
            if (err?.status === 403 || err?.status === 404) {
                setCurrentChat(null)
                setMessages([])
                autoLandingChatRef.current = false
                nav('/suhbat', { replace: true })
            }
        }
    }

    const createChat = useCallback(async () => {
        if (creating) return
        setCreating(true)
        try {
            const data = await fetchApi('/chat/new', {
                method: 'POST',
                body: JSON.stringify({
                    title: 'Yangi suhbat',
                    subject: normalizeSubjectValue(profile?.subject) || undefined,
                    subject2: normalizeSubjectValue(profile?.subject2) || undefined,
                    forceNew: true
                })
            })
            await loadChats()
            setMessages([])
            setCurrentChat(data)
            nav(`/suhbat/${data.id}`)
        } catch (err) { console.error('createChat:', err) }
        setCreating(false)
    }, [creating, profile])

    // Stream helper — displayText ixtiyoriy: chatda ko'rinadigan matn (prompt AI ga yuboriladi)
    async function streamToChat(targetChatId: string, prompt: string, displayText?: string): Promise<boolean> {
        const shown = displayText !== undefined ? displayText : prompt
        setLoading(true); setStreaming(''); setThinkingText('')
        if (abortRef.current) {
            abortRef.current.abort()
        }
        const controller = new AbortController()
        abortRef.current = controller
        // Stream boshlanganda joriy chat id'ni qotirib olamiz — agar foydalanuvchi
        // oqim davomida boshqa chatga o'tsa, javobni noto'g'ri chatga yozmaymiz
        const captured = targetChatId
        const isCurrentChat = () => chatIdRef.current === captured
        let fullText = '' // local ref — stale closure muammosini oldini olish uchun
        let completed = false
        let lastStreamFlush = 0 // setStreaming throttle (ms) — har tokenda emas, ~33ms da yangilaymiz (smooth, kam re-render)
        const requestThinkingMode = thinkingModeRef.current
        const requestTodoContext = todoItemsRef.current
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`/api/chat/${targetChatId}/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ content: prompt, thinking: requestThinkingMode, ...(displayText !== undefined && { displayText }), todoContext: requestTodoContext }),
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
            let streamErrored = false

            // Bitta `data:` qatorini qayta ishlaydi. `true` qaytarsa — oqimni to'xtatamiz.
            const handleLine = async (line: string): Promise<boolean> => {
                if (!line.startsWith('data: ')) return false
                try {
                    const d = JSON.parse(line.slice(6))
                    if (d.error) {
                        if (isCurrentChat()) {
                            setMessages(prev => {
                                const filtered = prev.filter(m => m.id !== 'temp-u')
                                return [...filtered,
                                { id: 'u-' + Date.now(), role: 'user', content: shown, createdAt: new Date().toISOString() },
                                { id: 'err-' + Date.now(), role: 'assistant', content: `⚠️ ${d.error}`, createdAt: new Date().toISOString() }
                                ]
                            })
                        }
                        setStreaming(''); setThinkingText('')
                        streamErrored = true
                        return true
                    }
                    if (d.thinking) { thinkBuf += d.thinking; if (isCurrentChat()) setThinkingText(thinkBuf) }
                    if (d.content) {
                        fullText += d.content
                        // Throttle: og'ir markdown/KaTeX re-render'ni har tokenda emas, ~33ms da bajaramiz.
                        // (Oxirgi to'liq matn `done`da baribir commit qilinadi — matn yo'qolmaydi.)
                        if (isCurrentChat()) {
                            const now = performance.now()
                            if (now - lastStreamFlush > 33) { lastStreamFlush = now; setStreaming(fullText) }
                        }
                    }
                    if (d.done) {
                        completed = true
                        if (isCurrentChat()) {
                            setMessages(prev => {
                                const filtered = prev.filter(m => m.id !== 'temp-u')
                                return [...filtered,
                                { id: 'u-' + Date.now(), role: 'user', content: shown, createdAt: new Date().toISOString() },
                                { id: d.id || 'a-' + Date.now(), role: 'assistant', content: fullText, createdAt: new Date().toISOString() }
                                ]
                            })
                            setStreaming(''); setThinkingText(''); loadChats()
                            // Test avtomatik ochish
                            const testMatch = fullText.match(/```test\s*([\s\S]*?)```/)
                            if (testMatch) {
                                const parsedTest = parseStructuredJson<unknown[]>(testMatch[1].trim())
                                if (Array.isArray(parsedTest) && parsedTest.length > 0) {
                                    setTimeout(() => { setTodoOpen(false); openTestPanel(testMatch[1].trim()) }, 400)
                                }
                            }
                        }
                    }
                } catch { }
                return false
            }

            if (reader) {
                try {
                    let sseBuf = '' // chunk chegarasida bo'lingan frame'ni saqlash uchun (cross-read buffer)
                    while (true) {
                        const { done, value } = await reader.read()
                        if (done) break
                        const chunk = decoder.decode(value, { stream: true })
                        sseBuf += chunk
                        const lines = sseBuf.split('\n')
                        sseBuf = lines.pop() ?? '' // oxirgi (tugallanmagan) bo'lakni keyingi o'qishga qoldiramiz
                        for (const line of lines) {
                            const stop = await handleLine(line)
                            if (stop) { try { await reader.cancel() } catch { } break }
                        }
                        if (streamErrored) break
                    }
                    // Oqim tugadi — bufferda qolgan tugallanmagan frame bo'lsa, oxirgi marta flush qilamiz
                    if (!streamErrored && sseBuf.startsWith('data: ')) {
                        await handleLine(sseBuf)
                    }
                } finally {
                    try { reader?.cancel() } catch { }
                }
            }
        } catch (err: any) {
            if (err?.name === 'AbortError') {
                // User stopped — fullText local variable ishlatamiz (stale closure yo'q)
                // Faqat joriy chatga yozamiz (boshqa chatga o'tilgan bo'lsa — yozmaymiz)
                if (fullText.trim() && isCurrentChat()) {
                    setMessages(prev => {
                        const filtered = prev.filter(m => m.id !== 'temp-u')
                        return [...filtered,
                        { id: 'u-' + Date.now(), role: 'user', content: shown, createdAt: new Date().toISOString() },
                        { id: 'a-' + Date.now(), role: 'assistant', content: fullText + '\n\n*[To\'xtatildi]*', createdAt: new Date().toISOString() }
                        ]
                    })
                }
            } else if (isCurrentChat()) {
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
        // Faqat bizning controller hali ham faol bo'lsa tozalaymiz — aks holda
        // bu oqim bekor qilingan, yangi oqim allaqachon abortRef'ni egallagan bo'lishi mumkin
        if (abortRef.current === controller) {
            setLoading(false); abortRef.current = null
        }
        return completed && fullText.trim().length > 0
    }

    function stopGeneration() {
        abortRef.current?.abort()
        abortRef.current = null
    }

    const handleSend = useCallback(async (text: string, files: AttachedFile[]) => {
        if (loading) return

        // chatId yo'q bo'lsa yangi chat yaratib, unga o'tamiz
        let targetChatId = chatId
        if (!targetChatId) {
            try {
                const data = await fetchApi('/chat/new', {
                    method: 'POST',
                    body: JSON.stringify({
                        title: text.substring(0, 50) || 'Yangi suhbat',
                        subject: normalizeSubjectValue(profile?.subject) || undefined,
                        subject2: normalizeSubjectValue(profile?.subject2) || undefined,
                        forceNew: true
                    })
                })
                await loadChats()
                pendingHydrationChatIdRef.current = data.id
                setCurrentChat(data)
                nav(`/suhbat/${data.id}`)
                targetChatId = data.id
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
            const success = await streamToChat(targetChatId!, promptText.trim(), displayText.trim())
            if (success) logActivity(5)
        } else {
            setMessages(prev => [...prev, { id: 'temp-u', role: 'user', content: text, createdAt: new Date().toISOString() }])
            const success = await streamToChat(targetChatId!, text)
            if (success) logActivity(5)
        }
    }, [chatId, loading, profile])

    async function deleteChat(id: string, e: React.MouseEvent) {
        e.stopPropagation()
        try {
            await fetchApi(`/chat/${id}`, { method: 'DELETE' })
            const nextChats = await loadChats()
            if (chatId === id) {
                setMessages([])
                setCurrentChat(null)
                autoLandingChatRef.current = false
                const nextChat = nextChats.find(chat => chat.id !== id)
                nav(nextChat ? `/suhbat/${nextChat.id}` : '/suhbat', { replace: true })
            }
        } catch (err) { console.error('deleteChat:', err); toast.error("Suhbatni o'chirishda xatolik") }
    }

    const reviewedFlashcards = Math.max(totalFlashcards - dueCount, 0)
    const weakTopicSummary = (progressData?.weakTopics ?? []).slice(0, 2).map(item => item.topic).join(', ')
    function markTestCompleted(testId: string) {
        completedTestIdsRef.current.add(testId)
        markSingleTestSeen(testId)
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


    // Test panel ochish (todo ni yopadi)
    const handleOpenTest = useCallback((jsonStr: string) => {
        setTodoOpen(false)
        // AI chat testi efemer (DB da yo'q). Eski public test id'sini tozalamasak,
        // submit xato qilib /tests/{eskiId}/submit ga ketib "Test sessiyasi topilmadi" (403)
        // beradi. Shu sababli AI test ochishdan oldin activeTestId/savollarni tozalaymiz.
        setActiveTestId(null)
        setActiveTestQuestions([])
        setActiveTestSource(null) // AI chat testi — manba badge'i yo'q
        openTestPanel(jsonStr)
    }, [openTestPanel, setActiveTestId, setActiveTestQuestions])

    // Flashcard panelni ochish
    const handleOpenFlash = useCallback((jsonStr: string) => {
        const cards = parseStructuredJson<Array<{ front?: string; back?: string }>>(jsonStr)
        if (!Array.isArray(cards) || cards.length === 0) return
        setTestPanel(null) // testni yopamiz
        setTodoOpen(false) // todoni yopamiz
        openFlashPanel(jsonStr)
        setFlashIsReview(false) // AI chatdan kelgan — review rejimi emas
        // DB ga saqlaymiz — Kartochkalar tabida ko'rinishi uchun (background)
        const subj = profileRef.current?.subject || 'Umumiy'
        fetchApi('/flashcards', {
            method: 'POST',
            body: JSON.stringify({ subject: subj, cards: cards.map((c) => ({ front: String(c.front || ''), back: String(c.back || '') })) })
        }).then(() => loadDueFlashcards()).catch((err: unknown) => { console.error('saveFlashcards:', err) })
    }, [openFlashPanel]) // eslint-disable-line react-hooks/exhaustive-deps

    // Essay panel ochish
    const handleOpenEssay = useCallback((data: EssayPanel) => {
        setTestPanel(null)
        setFlashPanel(null)
        setTodoOpen(false) // todoni yopamiz
        setEssayPanel(data)
        setEssayText('')
        setEssaySubmitted(false)
        setEssayMaximized(false)
        setEssayTimeLeft(data.time * 60)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Todo panel — test/flash/essay yopiladi
    const handleSetTodo = useCallback((items: Omit<TodoItem, 'id' | 'done'>[]) => {
        if (todoAutoCloseRef.current) {
            clearTimeout(todoAutoCloseRef.current)
            todoAutoCloseRef.current = null
        }
        setTodoItems(prev => {
            const existingItems = [...prev, ...loadStoredTodos(todoStorageKey)]
            const existingBySignature = new Map(existingItems.map(item => [getTodoSignature(item), item]))
            return items.map((item, i) => {
                const existing = existingBySignature.get(getTodoSignature(item))
                return {
                    ...item,
                    id: existing?.id || `todo-${i}-${Date.now()}`,
                    done: Boolean(existing?.done)
                }
            })
        })
        setTestPanel(null)      // test yopiladi
        setFlashPanel(null)     // flashcard yopiladi
        setEssayPanel(null)     // essay yopiladi
        setTodoOpen(true)
    }, [todoStorageKey]) // eslint-disable-line react-hooks/exhaustive-deps
    const markTodoDone = useCallback((id: string) => {
        setTodoItems(prev => prev.map(t => t.id === id ? { ...t, done: true } : t))
    }, [])

    // AI todo-done bloki: vazifa nomini topib, bajarildi deb belgilash
    const markTodoDoneByTask = useCallback((taskName: string) => {
        setTodoItems(prev => {
            const norm = (s: string) => s.toLowerCase().trim()
            const target = norm(taskName)
            if (!target) return prev
            const pending = prev.filter(t => !t.done)
            if (pending.length === 0) return prev // hech narsa qolmagan — re-fire'da hech narsa o'zgartirmaymiz

            // 1) Aniq (exact) moslik ustuvor
            let match = pending.find(t => norm(t.task) === target)

            // 2) Aniq moslik yo'q bo'lsa — eng tor (ixcham) substring moslikni tanlaymiz,
            //    shunda umumiy substring bir nechta vazifaga tegib, noto'g'risini belgilamaydi
            if (!match) {
                const candidates = pending.filter(t => {
                    const nt = norm(t.task)
                    return nt.includes(target) || target.includes(nt)
                })
                if (candidates.length > 0) {
                    match = candidates.reduce((best, t) =>
                        norm(t.task).length < norm(best.task).length ? t : best
                    )
                }
            }

            if (!match) return prev
            const matchedId = match.id
            return prev.map(t => t.id === matchedId ? { ...t, done: true } : t)
        })
    }, [])

    useEffect(() => {
        if (todoAutoCloseRef.current) {
            clearTimeout(todoAutoCloseRef.current)
            todoAutoCloseRef.current = null
        }

        if (todoItems.length === 0 || !todoItems.every(item => item.done)) return

        todoAutoCloseRef.current = setTimeout(() => {
            setTodoOpen(false)
            todoAutoCloseRef.current = null
        }, 1500)

        return () => {
            if (todoAutoCloseRef.current) {
                clearTimeout(todoAutoCloseRef.current)
                todoAutoCloseRef.current = null
            }
        }
    }, [todoItems])

    // Essay submit — AI ga baholash uchun yuborish
    async function submitEssay() {
        if (!essayPanel || essaySubmitted) return
        const wordCount = essayText.trim().split(/\s+/).filter(Boolean).length
        if (wordCount < essayPanel.minWords) {
            toast.error(`Kamida ${essayPanel.minWords} ta so'z yozing (hozir: ${wordCount})`)
            return
        }
        localStorage.removeItem(essayDraftKey)
        setEssaySubmitted(true)
        setEssayTimeLeft(null)
        const prompt = `📝 **Writing topshirig'i — ${essayPanel.task}:**\n"${essayPanel.prompt}"\n\n**Mening essayim (${wordCount} so'z):**\n${essayText}\n\n---\nIltimos, ushbu essayni Milliy Sertifikat (Multilevel) mezonlari bo'yicha baholang:\n1. **Task Achievement** — vazifani to'liq bajardimmi?\n2. **Coherence & Cohesion** — tuzilma va bog'liqlik\n3. **Lexical Resource** — leksik boylik\n4. **Grammatical Range & Accuracy** — grammatik to'g'rilik\n\nHar bir mezon uchun 30 balldan baho bering, jami 120 dan. Asosiy xatolarni ko'rsating va yaxshilash bo'yicha aniq tavsiyalar bering.`
        handleSend(prompt, [])
    }

    // Public test ochish (sidebar dan)
    async function openPublicTest(t: any) {
        // Testlar ro'yxati overlay'ini darrov yopamiz — aks holda mobil'da test paneli
        // (fixed inset-0 z-50) overlay (ham z-50) ostida, orqada ochilib qolardi.
        setOverlayPanel(null)
        setLoadingPublicTest(true)
        void markTestNotificationRead(t.id, t.title)
        try {
            const data = await fetchApi(`/tests/by-link/${t.shareLink}`)
            const rawQuestions = data.questions || []
            const hasComplexQuestions = rawQuestions.some((question: any) => ['open', 'matching', 'multipart_open'].includes(question.questionType))
            if (hasComplexQuestions) {
                setLoadingPublicTest(false)
                nav(`/test/${t.shareLink}`)
                return
            }
            // correctIdx submitdan keyin backenddan keladi; submitgacha panelda javob kaliti bo'lmaydi.
            const converted = rawQuestions.map((q: any) => {
                let opts: string[] = []
                if (q.questionType === 'matching') {
                    // BUG-8: matching uchun options = {answers:[...], subQuestions:[...]} formatida keladi
                    try {
                        const matchingData = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
                        opts = Array.isArray(matchingData?.answers) ? matchingData.answers.map(String) : []
                    } catch { /* invalid JSON */ }
                } else {
                    try {
                        const parsed = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
                        opts = Array.isArray(parsed) ? parsed.map(String) : []
                    } catch { /* invalid JSON */ }
                }
                return {
                    id: q.id,
                    q: q.text,
                    imageUrl: q.imageUrl || null,
                    questionType: q.questionType || 'mcq',
                    a: opts[0] || '', b: opts[1] || '', c: opts[2] || '', d: opts[3] || '',
                    correct: ''
                }
            })
            setActiveTestId(t.id)
            setActiveTestQuestions(rawQuestions)
            setActiveTestSource((data.source as string | undefined) ?? t.source ?? 'UNOFFICIAL')
            if (completedTestIdsRef.current.has(t.id)) {
                // Avval yechilgan — to'g'ri javoblarni localStorage dan olish
                try {
                    const savedCorrect = localStorage.getItem('dtmmax_correct_' + t.id)
                    if (savedCorrect) {
                        const correctMap: Record<string, number> = JSON.parse(savedCorrect)
                        const withCorrect = converted.map((q: any) => {
                            const ci = correctMap[q.id]
                            return ci !== undefined ? { ...q, correct: (['a', 'b', 'c', 'd'] as const)[ci] ?? '' } : q
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
                // Vaqt chegarasi bo'lsa server qaytargan sessiya vaqtiga tayanamiz.
                if (data.timeLimit) {
                    const remainingSeconds = typeof data.timeRemainingSeconds === 'number'
                        ? data.timeRemainingSeconds
                        : data.timeLimit * 60
                    setTestTimeLeft(Math.max(0, remainingSeconds))
                }
            }
        } catch (err) { console.error('openPublicTest:', err) }
        setLoadingPublicTest(false)
    }

    // Har render da ref ni yangilaymiz — stale closure muammosini hal qilish uchun
    submitTestPanelRef.current = () => { void submitTestPanel() }

    async function submitTestPanel() {
        if (!testPanel) return
        if (testSubmitted) return  // BUG-2: double-submit race condition oldini olish
        if (isSubmittingRef.current) return
        isSubmittingRef.current = true
        let questions: any[] = []
        try { questions = JSON.parse(testPanel) } catch { isSubmittingRef.current = false; return }
        let backendSubmitHandled = false
        let backendSubmitResult: any = null
        if (activeTestId && activeTestQuestions.length > 0) {
            try {
                const backendAnswers = activeTestQuestions.map((q: any, i: number) => ({
                    questionId: q.id,
                    selectedIdx: ['a', 'b', 'c', 'd'].indexOf(String(testAnswers[i] || ''))
                }))
                backendSubmitResult = await fetchApi(`/tests/${activeTestId}/submit`, {
                    method: 'POST',
                    body: JSON.stringify({ answers: backendAnswers })
                })
                backendSubmitHandled = true

                if (backendSubmitResult?.newAbility !== undefined) {
                    const prevAbility = profile?.abilityLevel ?? 0
                    setRaschFeedback({ prev: prevAbility, next: backendSubmitResult.newAbility })
                    loadProfile()
                    loadMyResults()
                }
                if (backendSubmitResult?.correctAnswers) {
                    const correctMap: Record<string, number> = {}
                    backendSubmitResult.correctAnswers.forEach((c: any) => { correctMap[c.id] = c.correctIdx })
                    try { localStorage.setItem('dtmmax_correct_' + activeTestId, JSON.stringify(correctMap)) } catch { }
                    try { localStorage.setItem('dtmmax_pub_ans_' + activeTestId, JSON.stringify(testAnswers)) } catch { }
                    questions = questions.map((q: any) => {
                        const ci = correctMap[q.id]
                        return ci !== undefined ? { ...q, correct: (['a', 'b', 'c', 'd'] as const)[ci] ?? '' } : q
                    })
                    setTestPanel(JSON.stringify(questions))
                }
                markTestCompleted(activeTestId)
                const completedTestTitle = publicTests.find(test => test.id === activeTestId)?.title
                void markTestNotificationRead(activeTestId, completedTestTitle)
            } catch (err: any) {
                toast.error(err?.message || 'Test natijasini saqlashda xatolik yuz berdi')
                isSubmittingRef.current = false
                return
            }
        }
        setTestSubmitted(true)
        setTestTimeLeft(null)
        const results = questions.map((q: any, i: number) => {
            const correct = testAnswers[i] === q.correct
            const correctLetter = typeof q.correct === 'string' && q.correct ? q.correct : '?'
            return `${i + 1}. ${q.q} — Javob: ${(testAnswers[i] || '?').toUpperCase()}) ${correct ? '✅ to\'g\'ri' : '❌ xato (to\'g\'ri: ' + correctLetter.toUpperCase() + ')'}`
        }).join('\n')
        const score = typeof backendSubmitResult?.correct === 'number'
            ? backendSubmitResult.correct
            : questions.filter((q: any, i: number) => testAnswers[i] === q.correct).length
        const totalQuestionsForScore = typeof backendSubmitResult?.total === 'number'
            ? backendSubmitResult.total
            : questions.length

        // Mavzu statistikasini yangilash + XP qo'shish
        if (backendSubmitHandled) {
            // Saqlangan test: backend TopicStat'ni REAL per-mavzu yangiladi — qayta hisoblamaymiz (ikki marta sanash yo'q), faqat progress'ni yangilaymiz
            loadProgress()
        } else {
            // Efemer AI test: backend per-mavzu bilmaydi — chat sarlavhasidan qo'pol yangilaymiz
            const testSubject = currentChat?.subject || currentChat?.subject2 || profile?.subject || profile?.subject2 || 'Umumiy'
            fetchApi('/progress/topic', {
                method: 'POST',
                body: JSON.stringify({
                    subject: testSubject,
                    topic: currentChat?.title?.split(' ').slice(0, 4).join(' ') || 'Umumiy',
                    correct: score,
                    total: totalQuestionsForScore
                })
            }).then(() => loadProgress()).catch(() => { })
        }
        logActivity(20) // Test uchun +20 XP
        const hasImages = questions.some((q: any) => q.imageUrl)
        // Yopiq o'quv halqasi: backend bergan REAL per-mavzu tahlilini AI promptiga qo'shamiz (taxmin emas)
        const bd: Array<{ topic: string; correct: number; total: number; pct: number }> =
            Array.isArray(backendSubmitResult?.topicBreakdown) ? backendSubmitResult.topicBreakdown : []
        const topicAnalysisText = bd.length
            ? "\n\nMAVZULAR BO'YICHA (real natija):\n" + bd.map((t) => `- ${t.topic}: ${t.correct}/${t.total} (${t.pct}%)`).join('\n')
            : ''
        const rec = backendSubmitResult?.recommendation
        const recText = rec?.focusTopic
            ? `\n\nENG ZAIF MAVZU: ${rec.focusTopic.topic} (${rec.focusTopic.pct}%).` +
              (rec?.nextTest?.title ? ` Tavsiya etilgan keyingi test: "${rec.nextTest.title}".` : '')
            : ''
        const summary = `--- YANGI TEST NATIJASI (bu mustaqil test) ---\nJami savol: ${totalQuestionsForScore}\nTo'g'ri javoblar: ${score}/${totalQuestionsForScore}\n\n${results}${topicAnalysisText}${recText}\n\nFaqat shu ${totalQuestionsForScore} ta savol bo'yicha tahlil qil. Yuqoridagi MAVZULAR BO'YICHA real natijaga tayanib, qaysi mavzularni qayta o'rganishim kerakligini aniq ayt va eng zaif mavzudan boshlashni tavsiya qil. Oldingi testlar bilan aralashma.`
        const displayMsg = `📊 Test natijasi: ${score}/${totalQuestionsForScore} — ${hasImages ? 'Vision AI tahlil qilmoqda...' : 'AI tahlil qilmoqda...'}`

        // Vision AI orqali rasmli savollarni tahlil qilish — DeepSeek tahlilini o'tkazib yuboramiz
        function runVisionAnalysis(addUserMsg: () => void) {
            const imageQsList = questions
                .map((q: any, i: number) => ({ q, i }))
                .filter(({ q }) => q.imageUrl)
            addUserMsg()
            setLoading(true)
            if (visionIntervalRef.current) {
                clearInterval(visionIntervalRef.current)
                visionIntervalRef.current = null
            }
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
                if (!isMountedRef.current) return
                if (data?.analysis) {
                    const fullText = `🔍 **Rasmli savollar tahlili (AI Vision):**\n\n${data.analysis}`
                    // Animatsiya: streaming state orqali xarakter-xarakter chiqarish
                    let idx = 0
                    const CHUNK = 8
                    visionIntervalRef.current = setInterval(() => {
                        if (!visionIntervalRef.current) return
                        idx += CHUNK
                        setStreaming(fullText.slice(0, idx))
                        if (idx >= fullText.length) {
                            clearInterval(visionIntervalRef.current)
                            visionIntervalRef.current = null
                            if (!isMountedRef.current) return
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
                    if (visionIntervalRef.current) {
                        clearInterval(visionIntervalRef.current)
                        visionIntervalRef.current = null
                    }
                    if (!isMountedRef.current) return
                    setLoading(false)
                }
            }).catch(() => {
                if (visionIntervalRef.current) {
                    clearInterval(visionIntervalRef.current)
                    visionIntervalRef.current = null
                }
                if (!isMountedRef.current) return
                setLoading(false)
            })
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
                const data = await fetchApi('/chat/new', {
                    method: 'POST',
                    body: JSON.stringify({
                        title: 'Test tahlili',
                        subject: normalizeSubjectValue(profile?.subject) || undefined,
                                subject2: normalizeSubjectValue(profile?.subject2) || undefined
                            })
                        })
                        await loadChats()
                        pendingHydrationChatIdRef.current = data.id
                        setCurrentChat(data)
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
                    const data = await fetchApi('/chat/new', {
                        method: 'POST',
                        body: JSON.stringify({
                            title: 'Test tahlili',
                            subject: normalizeSubjectValue(profile?.subject) || undefined,
                            subject2: normalizeSubjectValue(profile?.subject2) || undefined
                        })
                        })
                        await loadChats()
                        pendingHydrationChatIdRef.current = data.id
                        setCurrentChat(data)
                        nav(`/suhbat/${data.id}`)
                        setTimeout(() => {
                            setMessages([{ id: 'temp-u', role: 'user', content: displayMsg, createdAt: new Date().toISOString() }])
                            streamToChat(data.id, summary, displayMsg)
                        }, 300)
                } catch (err) { console.error('submitTestPanel newChat:', err) }
            }, 500)
        }
        try {
            if (activeTestId && activeTestQuestions.length > 0) {
                if (!backendSubmitHandled) {
                    throw new Error('Public test natijasi backendda tasdiqlanmadi')
                }
            } else if (testPanel) {
                const aiKey = testPanel.substring(0, 500)
                try { localStorage.setItem('dtmmax_ans_' + aiKey, JSON.stringify(testAnswers)) } catch { }
                const scorePercent = (score / questions.length) * 100
                const raschResults = questions.map((q: any, i: number) => {
                    const fallbackDifficulty = questions.length > 1
                        ? -2 + (i / (questions.length - 1)) * 4
                        : 0
                    return {
                        difficulty: typeof q.difficulty === 'number' && Number.isFinite(q.difficulty)
                            ? q.difficulty
                            : Math.round(fallbackDifficulty * 100) / 100,
                        isCorrect: testAnswers[i] === q.correct
                    }
                })
                await fetchApi('/tests/submit-ai', {
                    method: 'POST',
                    body: JSON.stringify({ score: scorePercent, totalQuestions: questions.length, results: raschResults })
                })
                markAiTestCompleted(aiKey)
                loadProfile()
                loadMyResults()
            }
        } catch (err: any) {
            toast.error(err?.message || 'Test natijasini saqlashda xatolik yuz berdi')
        } finally {
            isSubmittingRef.current = false
        }
    }

    // useMemo: context value ni stabillashtirish — har render da yangi {} yaratilmaydi.
    // Bu MdMessage/TodoBlockMount ni keraksiz qayta mount qilishdan saqlab, X tugmasini tuzatadi
    // va streaming vaqtida sayt qotishini ham hal qiladi.
    const chatContextValue = useMemo(() => ({
        onOpenTest: handleOpenTest,
        onProfileUpdate: handleProfileUpdate,
        onOpenFlash: handleOpenFlash,
        onOpenEssay: handleOpenEssay,
        onSetTodo: handleSetTodo,
        onMarkTodoDoneByTask: markTodoDoneByTask,
    }), [handleOpenTest, handleProfileUpdate, handleOpenFlash, handleOpenEssay, handleSetTodo, markTodoDoneByTask])

    // ── Onboarding/profil formasi uchun derived qiymatlar (ikkala forma ham shu state bilan) ──
    // examType bo'yicha ball chegaralari (DTM 1..189, MS 0..75; bo'sh bo'lsa DTM — eng qattiq)
    const obScoreBounds = onboardingForm.examType === 'MS' ? SCORE_BOUNDS.MS : SCORE_BOUNDS.DTM
    const obScoreErr = onboardingForm.targetScore !== '' && (
        !Number.isInteger(onboardingForm.targetScore) ||
        onboardingForm.targetScore < obScoreBounds.min ||
        onboardingForm.targetScore > obScoreBounds.max
    ) ? `Ball ${obScoreBounds.min}–${obScoreBounds.max} oralig'idagi butun son bo'lishi kerak` : ''
    // Joriy subject juftligiga mos DTM yo'nalish kodi (select value uchun)
    const obDirectionCode = dtmDirectionBySubjects(onboardingForm.subject, onboardingForm.subject2)?.code || ''
    // Saqlangan juftlik to'g'ri yo'nalish bo'lmasa (eski/noto'g'ri ma'lumot) — qayta tanlashga undaymiz
    const obDtmPairInvalid = onboardingForm.examType === 'DTM' && !!onboardingForm.subject2 && !obDirectionCode

    // examType o'zgarganda derived 2-fanni tozalaymiz va ball chegarasini yangi turga moslaymiz
    const handleObExamTypeChange = (t: 'DTM' | 'MS') => {
        setOnboardingForm(prev => {
            const nextExamType = prev.examType === t ? '' : t
            const bounds = nextExamType === 'MS' ? SCORE_BOUNDS.MS : SCORE_BOUNDS.DTM
            // Yangi chegaradan tashqarida qolgan ballni tozalaymiz (Save bloklanmasin)
            const nextTargetScore = prev.targetScore !== '' &&
                (prev.targetScore < bounds.min || prev.targetScore > bounds.max)
                ? ''
                : prev.targetScore
            return {
                ...prev,
                examType: nextExamType,
                subject2: '',
                targetScore: nextTargetScore,
            }
        })
    }
    // DTM yo'nalishi tanlanganda subject/subject2 ni derived to'ldiramiz
    const handleObDirectionChange = (code: string) => {
        const dir = dtmDirectionByCode(code)
        setOnboardingForm(prev => ({
            ...prev,
            subject: dir?.subject1 || prev.subject,
            subject2: dir?.subject2 || '',
        }))
    }
    const handleObScoreBlur = () => {
        setOnboardingForm(prev => {
            if (prev.targetScore === '') return prev
            const n = Number(prev.targetScore)
            if (!Number.isFinite(n)) return prev
            const clamped = Math.min(obScoreBounds.max, Math.max(obScoreBounds.min, Math.round(n)))
            return { ...prev, targetScore: clamped }
        })
    }
    const obSelectedDirection = obDirectionCode ? dtmDirectionByCode(obDirectionCode) : undefined

    // Birinchi marta onboarding qadamlari: 1=imtihon turi, 2=fan(lar), 3=sana (ixtiyoriy), 4=maqsad ball
    const OB_TOTAL_STEPS = 4
    const obIsLastStep = obStep === OB_TOTAL_STEPS
    // Har bir qadam "Davom etish"ni qachon ochishini belgilaydi
    const obStepValid =
        obStep === 1 ? onboardingForm.examType !== '' :
        obStep === 2 ? (onboardingForm.examType === 'DTM' ? (!!obDirectionCode && !obDtmPairInvalid) : !!onboardingForm.subject) :
        obStep === 4 ? !obScoreErr :
        true // sana (3) ixtiyoriy

    // Onboarding — suhbat uslubidagi, bitta-savol-bir-ekran (editorial)
    if (showOnboarding) {
        const obQuestion =
            obStep === 1 ? `${user?.name ? `Salom, ${user.name}! ` : 'Avval tanishaylik. '}Qaysi imtihonga tayyorlanyapsiz?`
                : obStep === 2 ? (onboardingForm.examType === 'DTM' ? "Zo'r! Endi yo'nalishingizni tanlaymiz." : "Zo'r! Qaysi fandan tayyorlanasiz?")
                    : obStep === 3 ? "Imtihoningiz qachon bo'ladi?"
                        : "Maqsadingiz — necha ball?"
        const obHint =
            obStep === 1 ? 'Shu asosda AI ustozingiz sizga moslashadi.'
                : obStep === 3 ? "Ixtiyoriy — bilsangiz, rejani sanaga moslaymiz."
                    : obStep === 4 ? `Ixtiyoriy — ${obScoreBounds.min}–${obScoreBounds.max} oralig'ida.`
                        : ''
        return (
            <div className="kelviq flex items-center justify-center p-5" style={{ background: 'var(--bg-page)', minHeight: '100dvh' }}>
                <div className="w-full max-w-md">
                    {/* Suhbat: avatar + savol pufakchasi (Fraunces serif) */}
                    <div className="flex items-start gap-3 mb-6">
                        <img src="/dtmmax-logo.png" alt="DtmMax" className="h-12 w-12 rounded-2xl flex-shrink-0" style={{ objectFit: 'contain', background: 'var(--bg-card)', boxShadow: 'var(--k-shadow-card)' }} />
                        <div key={`q-${obStep}`} className="anim-up card" style={{ padding: '15px 19px', borderRadius: '5px 18px 18px 18px' }}>
                            <p style={{ fontFamily: 'var(--k-serif)', fontSize: '21px', fontWeight: 500, lineHeight: 1.28, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{obQuestion}</p>
                            {obHint && <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{obHint}</p>}
                        </div>
                    </div>

                    {/* Qadam indikatori */}
                    <div className="flex items-center gap-1.5 mb-5 pl-1">
                        {Array.from({ length: OB_TOTAL_STEPS }, (_, i) => i + 1).map(n => (
                            <div key={n} className="rounded-full" style={{ height: 6, width: obStep === n ? 24 : 6, background: obStep >= n ? 'var(--brand)' : 'var(--border-strong)', transition: 'all .25s ease' }} />
                        ))}
                    </div>

                    <form
                        onSubmit={saveOnboarding}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !obIsLastStep) {
                                e.preventDefault()
                                if (obStepValid) setObStep(s => s + 1)
                            }
                        }}
                        className="flex flex-col gap-4"
                    >
                        <div key={`s-${obStep}`} className="anim-up">
                            {/* Step 1 — Imtihon turi (chiroyli kartalar) */}
                            {obStep === 1 && (
                                <div className="flex flex-col gap-3">
                                    {(['DTM', 'MS'] as const).map(t => {
                                        const active = onboardingForm.examType === t
                                        return (
                                            <button key={t} type="button" onClick={() => handleObExamTypeChange(t)}
                                                className="text-left rounded-2xl transition-all flex items-center gap-3"
                                                style={{ padding: '15px 17px', border: `1.5px solid ${active ? 'var(--brand)' : 'var(--border)'}`, background: active ? 'var(--brand-light)' : 'var(--bg-card)' }}>
                                                <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: active ? 'var(--brand)' : 'var(--bg-muted)' }}>
                                                    {t === 'DTM' ? <GraduationCap className="h-5 w-5" style={{ color: active ? '#fff' : 'var(--text-muted)' }} /> : <Trophy className="h-5 w-5" style={{ color: active ? '#fff' : 'var(--text-muted)' }} />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-[15px]" style={{ color: active ? 'var(--brand-hover)' : 'var(--text-primary)' }}>{t === 'DTM' ? 'DTM' : 'Milliy Sertifikat'}</p>
                                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t === 'DTM' ? 'Davlat Test Markazi imtihoni' : "Yil bo'yi topshiriladigan sertifikat"}</p>
                                                </div>
                                                {active && <CheckCircle className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--brand)' }} />}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Step 2 — Fan(lar) */}
                            {obStep === 2 && (
                                onboardingForm.examType === 'DTM' ? (
                                    <div>
                                        <select value={obDirectionCode} onChange={e => handleObDirectionChange(e.target.value)} className="input" style={{ cursor: 'pointer', height: 52 }}>
                                            <option value="">— Yo'nalishni tanlang —</option>
                                            {DTM_DIRECTIONS.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
                                        </select>
                                        {obDtmPairInvalid && (
                                            <p className="text-xs mt-2" style={{ color: 'var(--danger)' }}>
                                                Avvalgi tanlovingiz ({onboardingForm.subject} – {onboardingForm.subject2}) rasmiy yo'nalishlarda yo'q. Qayta tanlang.
                                            </p>
                                        )}
                                        {obSelectedDirection?.faculties?.length ? (
                                            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{obSelectedDirection.faculties.join(', ')}</p>
                                        ) : null}
                                    </div>
                                ) : (
                                    <select value={onboardingForm.subject} onChange={e => setOnboardingForm(prev => ({ ...prev, subject: e.target.value }))} className="input" style={{ cursor: 'pointer', height: 52 }}>
                                        {SUBJECTS.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                )
                            )}

                            {/* Step 3 — Imtihon sanasi */}
                            {obStep === 3 && (
                                <input type="date" value={onboardingForm.examDate} onChange={e => setOnboardingForm(prev => ({ ...prev, examDate: e.target.value }))} className="input" style={{ height: 52 }} />
                            )}

                            {/* Step 4 — Maqsad ball */}
                            {obStep === 4 && (
                                <div>
                                    <input
                                        type="number"
                                        min={obScoreBounds.min}
                                        max={obScoreBounds.max}
                                        step="1"
                                        value={onboardingForm.targetScore}
                                        onChange={e => { const v = e.target.value; const n = parseInt(v, 10); setOnboardingForm(prev => ({ ...prev, targetScore: v === '' || Number.isNaN(n) ? '' : n })) }}
                                        onBlur={handleObScoreBlur}
                                        className="input"
                                        placeholder={`${obScoreBounds.min}–${obScoreBounds.max}`}
                                        style={{ height: 52, ...(obScoreErr ? { borderColor: 'var(--danger)' } : {}) }}
                                    />
                                    {obScoreErr && <p className="text-xs mt-2" style={{ color: 'var(--danger)' }}>{obScoreErr}</p>}
                                </div>
                            )}
                        </div>

                        {/* Navigatsiya */}
                        <div className="flex gap-3 pt-1">
                            {obStep > 1 && (
                                <button type="button" onClick={() => setObStep(s => s - 1)} className="btn btn-outline" style={{ height: 52 }}>Orqaga</button>
                            )}
                            {obIsLastStep ? (
                                <button type="submit" disabled={savingProfile || !obStepValid} className="btn btn-primary" style={{ flex: 1, height: 52 }}>{savingProfile ? 'Saqlanmoqda...' : 'Boshlash'}</button>
                            ) : (
                                <button type="button" disabled={!obStepValid} onClick={() => setObStep(s => s + 1)} className="btn btn-primary" style={{ flex: 1, height: 52 }}>Davom etish →</button>
                            )}
                        </div>
                        {obStep === 3 && (
                            <button type="button" onClick={() => { setOnboardingForm(prev => ({ ...prev, examDate: '' })); setObStep(4) }} className="btn btn-ghost" style={{ width: '100%' }}>O'tkazib yuborish</button>
                        )}
                    </form>
                </div>
            </div>
        )
    }

    return (
        <ChatContext.Provider value={chatContextValue}>
            <div className="kelviq min-h-[100dvh] h-[100dvh] flex overflow-hidden relative" style={{ background: 'var(--bg-page)' }}>
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
                        borderRight: '1px solid color-mix(in srgb, var(--border) 76%, rgba(15,23,42,0.12) 24%)',
                        ...(isMobile && sideOpen ? { position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50 } : {})
                    }}
                    className="flex flex-col transition-all duration-200 overflow-hidden flex-shrink-0 relative"
                >
                    <div className="p-3 flex items-center justify-between h-14 flex-shrink-0" style={{ borderBottom: '1px solid color-mix(in srgb, var(--border) 76%, rgba(15,23,42,0.12) 24%)' }}>
                        <div className="flex items-center gap-2">
                            <img src="/dtmmax-logo.png" alt="DtmMax" className="h-11 w-11 rounded-lg flex items-center justify-center" style={{ objectFit: 'contain' }} />
                            <span className="text-sm font-bold whitespace-nowrap">DTMMax</span>
                        </div>
                        <button onClick={() => setSideOpen(false)} className="h-7 w-7 flex items-center justify-center rounded-lg transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-muted)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}><X className="h-4 w-4" /></button>
                    </div>

                    {/* Sidebar nav — Claude uslubi */}
                    <div className="px-2 pt-1 pb-2 flex-shrink-0 space-y-0">
                        {/* Yangi suhbat */}
                        <button onClick={createChat} disabled={creating}
                            className="sidebar-nav-button w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-[14px] font-semibold tracking-[-0.01em] transition disabled:opacity-50"
                            style={{ color: 'var(--text-primary)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <Plus className="h-4 w-4 flex-shrink-0" /> Yangi suhbat
                        </button>
                        {/* Testlar */}
                        <button onClick={() => { setOverlayPanel(overlayPanel === 'tests' ? null : 'tests'); markTestsSeen(); if (overlayPanel !== 'tests') { loadPublicTests(); loadMyResults() } }}
                            className="sidebar-nav-button w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-[14px] font-semibold tracking-[-0.01em] transition"
                            style={overlayPanel === 'tests'
                                ? { background: 'color-mix(in srgb, var(--bg-muted) 88%, white 12%)', color: 'var(--text-primary)', borderColor: 'color-mix(in srgb, var(--border) 70%, rgba(15,23,42,0.12) 30%)' }
                                : { color: 'var(--text-primary)' }}
                            onMouseEnter={e => { if (overlayPanel !== 'tests') e.currentTarget.style.background = 'var(--bg-muted)' }}
                            onMouseLeave={e => { if (overlayPanel !== 'tests') e.currentTarget.style.background = 'transparent' }}
                        >
                            <ClipboardList className="h-4 w-4 flex-shrink-0" />
                            Testlar
                            {newTestIds.size > 0 && <span className="ml-auto px-1.5 rounded-full text-white text-[10px] flex items-center font-bold" style={{ background: 'var(--danger)', height: '18px' }}>{newTestIds.size > 9 ? '9+' : newTestIds.size}</span>}
                        </button>
                        {/* Natijalar */}
                        <button onClick={() => setOverlayPanel(overlayPanel === 'progress' ? null : 'progress')}
                            className="sidebar-nav-button w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-[14px] font-semibold tracking-[-0.01em] transition"
                            style={overlayPanel === 'progress'
                                ? { background: 'color-mix(in srgb, var(--bg-muted) 88%, white 12%)', color: 'var(--text-primary)', borderColor: 'color-mix(in srgb, var(--border) 70%, rgba(15,23,42,0.12) 30%)' }
                                : { color: 'var(--text-primary)' }}
                            onMouseEnter={e => { if (overlayPanel !== 'progress') e.currentTarget.style.background = 'var(--bg-muted)' }}
                            onMouseLeave={e => { if (overlayPanel !== 'progress') e.currentTarget.style.background = 'transparent' }}
                        >
                            <TrendingUp className="h-4 w-4 flex-shrink-0" /> Natijalar
                        </button>
                        {/* Pro — narxlar/imkoniyatlar ko'rinishi (bloklamaydi, faqat ko'rsatadi) */}
                        <button onClick={() => setOverlayPanel(overlayPanel === 'pro' ? null : 'pro')}
                            className="sidebar-nav-button w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-[14px] font-semibold tracking-[-0.01em] transition"
                            style={overlayPanel === 'pro'
                                ? { background: 'color-mix(in srgb, var(--bg-muted) 88%, white 12%)', color: 'var(--text-primary)', borderColor: 'color-mix(in srgb, var(--border) 70%, rgba(15,23,42,0.12) 30%)' }
                                : { color: 'var(--text-primary)' }}
                            onMouseEnter={e => { if (overlayPanel !== 'pro') e.currentTarget.style.background = 'var(--bg-muted)' }}
                            onMouseLeave={e => { if (overlayPanel !== 'pro') e.currentTarget.style.background = 'transparent' }}
                        >
                            <Sparkles className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--brand)' }} />
                            Pro
                            <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>BEPUL</span>
                        </button>
                    </div>

                    <div className="mx-3 flex-shrink-0" style={{ height: '1px', background: 'color-mix(in srgb, var(--border) 76%, rgba(15,23,42,0.12) 24%)' }} />

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
                                            onClick={() => nav(`/suhbat/${c.id}`)}
                                            title={c.title}>
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
                            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
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
                                                localStorage.removeItem(essayDraftKey)
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

                    {showNotifications && (
                        <div
                            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
                            onClick={e => { if (e.target === e.currentTarget) setShowNotifications(false) }}
                        >
                            <div className="card" style={{ width: '100%', maxWidth: '560px', maxHeight: 'min(620px, calc(100dvh - 32px))', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '16px' }}>
                                <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                                    <div>
                                        <h2 className="text-base font-bold tracking-tight">Bildirishnomalar</h2>
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Yangi xabarlar va eslatmalar shu yerda ko'rinadi</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => { void markNotificationsRead() }}
                                            className="h-8 w-8 flex items-center justify-center rounded-lg transition"
                                            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'var(--bg-card)' }}
                                            title="Hammasini o'qildi qilish"
                                            aria-label="Hammasini o'qildi qilish"
                                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--success)'; e.currentTarget.style.background = 'var(--bg-muted)' }}
                                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'var(--bg-card)' }}
                                        >
                                            <CheckCircle className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => setShowNotifications(false)} className="h-7 w-7 flex items-center justify-center rounded-lg transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><X className="h-4 w-4" /></button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6">
                                    {notifLoading ? (
                                        <div className="flex items-center justify-center py-16">
                                            <div className="h-5 w-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
                                        </div>
                                    ) : notifications.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16" style={{ color: 'var(--text-muted)' }}>
                                            <Bell className="h-10 w-10 mb-3 opacity-20" />
                                            <p className="text-sm">Yangi bildirishnomalar yo'q</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {notifications.map((n: any) => (
                                                <div key={n.id} className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                                    <p className="text-sm font-semibold mb-1">{n.title}</p>
                                                    <p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{n.message}</p>
                                                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{n.sender?.name} · {new Date(n.createdAt).toLocaleDateString('uz')}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sozlamalar modal */}
                    {showSettings && (
                        <div
                            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
                            onClick={e => { if (e.target === e.currentTarget) setShowSettings(false) }}
                        >
                            <div className="card" style={{ width: '100%', maxWidth: '560px', maxHeight: 'calc(100dvh - 32px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '16px' }}>
                                <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                                    <div>
                                        <h2 className="text-base font-bold tracking-tight">Profil va sozlamalar</h2>
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Faqat eng kerakli ma'lumotlarni saqlang</p>
                                    </div>
                                    <button onClick={() => setShowSettings(false)} className="h-7 w-7 flex items-center justify-center rounded-lg transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><X className="h-4 w-4" /></button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-7">
                                    {/* ── 1. Profil ── */}
                                    <section className="space-y-3">
                                        <p className="k-eyebrow">Profil</p>
                                        <div className="flex items-center gap-3">
                                            <div className="h-12 w-12 rounded-full flex items-center justify-center text-base font-bold text-white flex-shrink-0" style={{ background: 'var(--brand)' }}>{user?.name?.[0]?.toUpperCase()}</div>
                                            <div className="min-w-0">
                                                <p className="font-semibold truncate">{user?.name}</p>
                                                <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
                                            </div>
                                        </div>
                                    </section>

                                    <form onSubmit={saveOnboarding} className="space-y-7">
                                        {/* ── 2. Imtihon ma'lumotlari ── */}
                                        <section className="pt-7 space-y-4" style={{ borderTop: '1px solid var(--border)' }}>
                                            <p className="k-eyebrow">Imtihon ma'lumotlari</p>
                                            <div>
                                                <label className="text-xs font-medium flex items-center gap-2 mb-1" style={{ color: 'var(--text-muted)' }}>
                                                    <GraduationCap className="h-3.5 w-3.5" />
                                                    Imtihon turi
                                                </label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {(['DTM', 'MS'] as const).map(t => (
                                                        <button
                                                            key={t}
                                                            type="button"
                                                            onClick={() => handleObExamTypeChange(t)}
                                                            className="btn btn-outline h-10 text-sm"
                                                            style={{
                                                                background: onboardingForm.examType === t ? 'var(--brand-light)' : '',
                                                                borderColor: onboardingForm.examType === t ? 'var(--brand)' : '',
                                                                color: onboardingForm.examType === t ? 'var(--brand-hover)' : '',
                                                            }}
                                                        >
                                                            {t === 'DTM' ? 'DTM' : 'Milliy Sertifikat'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            {onboardingForm.examType === 'DTM' ? (
                                                <div>
                                                    <label className="text-xs font-medium flex items-center gap-2 mb-1" style={{ color: 'var(--text-muted)' }}>
                                                        <BookOpen className="h-3.5 w-3.5" />
                                                        Yo'nalish (fanlar majmuasi)
                                                    </label>
                                                    <select value={obDirectionCode} onChange={e => handleObDirectionChange(e.target.value)} className="input text-sm h-10" style={{ cursor: 'pointer' }}>
                                                        <option value="">— Yo'nalishni tanlang —</option>
                                                        {DTM_DIRECTIONS.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
                                                    </select>
                                                    {obDtmPairInvalid && (
                                                        <p className="text-xs mt-1.5" style={{ color: 'var(--danger)' }}>
                                                            Avvalgi tanlovingiz ({onboardingForm.subject} – {onboardingForm.subject2}) rasmiy yo'nalishlarda yo'q. Iltimos, yo'nalishni qayta tanlang.
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <div>
                                                    <label className="text-xs font-medium flex items-center gap-2 mb-1" style={{ color: 'var(--text-muted)' }}>
                                                        <BookOpen className="h-3.5 w-3.5" />
                                                        Asosiy fan
                                                    </label>
                                                    <select value={onboardingForm.subject} onChange={e => setOnboardingForm(f => ({ ...f, subject: e.target.value }))} className="input text-sm h-10" style={{ cursor: 'pointer' }}>
                                                        {SUBJECTS.map(f => <option key={f} value={f}>{f}</option>)}
                                                    </select>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-xs font-medium flex items-center gap-2 mb-1" style={{ color: 'var(--text-muted)' }}>
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        Imtihon sanasi
                                                    </label>
                                                    <input type="date" value={onboardingForm.examDate} onChange={e => setOnboardingForm(f => ({ ...f, examDate: e.target.value }))} className="input text-sm h-10" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium flex items-center gap-2 mb-1" style={{ color: 'var(--text-muted)' }}>
                                                        <Target className="h-3.5 w-3.5" />
                                                        Maqsad ball ({obScoreBounds.min}–{obScoreBounds.max})
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min={obScoreBounds.min}
                                                        max={obScoreBounds.max}
                                                        step="1"
                                                        value={onboardingForm.targetScore}
                                                        onChange={e => { const v = e.target.value; const n = parseInt(v, 10); setOnboardingForm(f => ({ ...f, targetScore: v === '' || Number.isNaN(n) ? '' : n })) }}
                                                        onBlur={handleObScoreBlur}
                                                        className="input text-sm h-10"
                                                        style={obScoreErr ? { borderColor: 'var(--danger)' } : {}}
                                                    />
                                                    {obScoreErr && <p className="text-xs mt-1.5" style={{ color: 'var(--danger)' }}>{obScoreErr}</p>}
                                                </div>
                                            </div>
                                        </section>


                                        {/* ── Footer: Save (primary) + Logout (ghost) ── */}
                                        <div className="pt-7 flex flex-col sm:flex-row gap-3" style={{ borderTop: '1px solid var(--border)' }}>
                                            <button type="submit" disabled={savingProfile || !!obScoreErr || obDtmPairInvalid} className="btn btn-primary h-10 text-sm px-5 flex-1">
                                                {savingProfile ? 'Saqlanmoqda...' : 'Saqlash'}
                                            </button>
                                            <button type="button" onClick={() => { setShowSettings(false); localStorage.removeItem(essayDraftKey); logout() }} className="btn btn-outline h-10 text-sm px-5 flex-1">
                                                Chiqish
                                            </button>
                                        </div>
                                    </form>

                                    {/* ── 3. Parolni o'zgartirish + xavfsizlik (collapsed) ── */}
                                    <details className="pt-7" style={{ borderTop: '1px solid var(--border)' }}>
                                        <summary className="cursor-pointer text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                            <Shield className="h-4 w-4" />
                                            Parolni o'zgartirish va xavfsizlik
                                        </summary>
                                        <div className="space-y-4 mt-4">
                                            <div className="space-y-3">
                                                <p className="text-sm font-semibold flex items-center gap-2">
                                                    <User className="h-4 w-4" />
                                                    Parolni o'zgartirish
                                                </p>
                                                {changePwOk && <div className="text-sm px-3 py-2 rounded-lg" style={{ background: '#D1FAE5', color: '#065F46' }}>Parol muvaffaqiyatli yangilandi!</div>}
                                                {changePwErr && <div className="text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>{changePwErr}</div>}
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
                                                    className="btn btn-outline h-9 text-sm px-5 disabled:opacity-40">{changePwLoading ? 'Saqlanmoqda...' : 'Parolni yangilash'}</button>
                                            </div>
                                            <div className="rounded-xl p-4 space-y-2" style={{ border: '1px solid var(--danger-light)' }}>
                                                <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>Xavfli zona</p>
                                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Akkauntni o'chirsangiz barcha ma'lumotlar butunlay yo'qoladi.</p>
                                                <button onClick={() => { setShowDeleteModal(true); setDeleteErr(''); setDeletePassword('') }}
                                                    className="h-9 flex items-center gap-2 text-sm font-medium rounded-lg px-4 transition"
                                                    style={{ color: 'var(--danger)', border: '1px solid var(--danger)', background: 'transparent' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-light)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                    Akkauntni o'chirish
                                                </button>
                                            </div>
                                        </div>
                                    </details>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* User footer */}
                    <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid color-mix(in srgb, var(--border) 76%, rgba(15,23,42,0.12) 24%)' }}>
                        <div className="flex items-center gap-2.5 px-2 py-1.5">
                            <div className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0" style={{ background: 'var(--brand)' }}>{user?.name?.[0]?.toUpperCase()}</div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium truncate">{user?.name}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => { void loadNotifications(); setShowNotifications(true) }}
                                    className="min-w-[70px] h-10 px-2.5 flex flex-col items-center justify-center rounded-xl transition relative"
                                    style={{ color: 'var(--text-muted)' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    title="Bildirishnomalar"
                                >
                                    <Bell className="h-3.5 w-3.5" />
                                    <span className="text-[10px] mt-0.5">Bildirish</span>
                                    {notifCount > 0 && <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full text-white text-[8px] flex items-center justify-center font-bold" style={{ background: 'var(--danger)' }}>{notifCount > 9 ? '9+' : notifCount}</span>}
                                </button>
                                <button
                                    onClick={() => setShowSettings(true)}
                                    className="min-w-[58px] h-10 px-2.5 flex flex-col items-center justify-center rounded-xl transition"
                                    style={{ color: 'var(--text-muted)' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    title="Sozlamalar"
                                >
                                    <Settings className="h-3.5 w-3.5" />
                                    <span className="text-[10px] mt-0.5">Profil</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>


                {/* Main */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <div className="h-14 flex items-center px-4 gap-2 flex-shrink-0" style={{ borderBottom: '1px solid color-mix(in srgb, var(--border) 74%, rgba(15,23,42,0.12) 26%)' }}>
                        <button onClick={() => setSideOpen(v => !v)} className="h-8 w-8 flex items-center justify-center rounded-lg transition flex-shrink-0" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Yonpanel"><Menu className="h-4 w-4" /></button>
                        <span className="text-sm font-medium truncate flex-1 min-w-0" style={{ color: 'var(--text-secondary)' }}>{currentChat?.title || ''}</span>
                    </div>

                    {/* Messages */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
                        {(!chatId || (messages.length === 0 && !loading && !streaming)) ? (
                            <div className="h-full flex items-center justify-center relative overflow-hidden" style={{ background: 'var(--bg-page)' }}>
                                <div className="k-tex-dots absolute inset-0" style={{ zIndex: 0 }} />
                                <div className="text-center px-4 anim-up relative" style={{ zIndex: 1 }}>
                                    <img src="/dtmmax-logo.png" alt="DtmMax" className="h-14 w-14 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ objectFit: 'contain' }} />
                                    <p className="text-base font-bold tracking-tight">AI birinchi xabarni <span className="k-italic">tayyorlayapti</span>...</p>
                                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Suhbat ochilgach savolingizni yozishingiz mumkin.</p>
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

                {/* Todo inline panel */}
                {todoOpen && (
                    <div className="flex flex-col flex-shrink-0" style={{ width: '320px', borderLeft: '1px solid var(--border)', background: 'var(--bg-page)' }}>
                        {/* Header */}
                        <div className="h-14 flex items-center justify-between px-5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                            <p className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>Reja</p>
                            <button onClick={() => setTodoOpen(false)} className="h-7 w-7 flex items-center justify-center rounded-lg transition"
                                style={{ color: 'var(--text-muted)' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        {/* Tasks */}
                        <div className="flex-1 overflow-y-auto py-3">
                            {todoItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full gap-2 py-16 px-6">
                                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Barcha vazifalar bajarildi! 🎉</p>
                                    <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>Chatda yangi reja so'rang</p>
                                </div>
                            ) : todoItems.map((item, idx) => (
                                <div key={item.id} className="flex items-start gap-4 px-5 py-3 group"
                                    style={{ opacity: item.done ? 0.45 : 1, transition: 'opacity 0.2s' }}>
                                    {/* Circle */}
                                    <button
                                        onClick={() => !item.done && markTodoDone(item.id)}
                                        disabled={item.done}
                                        className="flex-shrink-0 mt-0.5 transition-transform"
                                        style={{ lineHeight: 0 }}
                                        onMouseEnter={e => { if (!item.done) (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)' }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
                                        title={item.done ? '' : 'Bajarildi'}>
                                        {item.done ? (
                                            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                                                <circle cx="11" cy="11" r="10.5" fill="var(--text-primary)" stroke="var(--text-primary)" strokeWidth="1" />
                                                <path d="M7 11.5l2.8 2.8 5.2-5.6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        ) : (
                                            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                                                <circle cx="11" cy="11" r="10.5" fill="none" stroke="var(--text-primary)" strokeWidth="1.5" />
                                            </svg>
                                        )}
                                    </button>
                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[14px] leading-snug"
                                            style={{
                                                color: 'var(--text-primary)',
                                                fontWeight: 450,
                                                textDecoration: item.done ? 'line-through' : 'none',
                                            }}>
                                            <MathText text={item.task} />
                                        </div>
                                        {(item.time || item.subject || item.duration) && (
                                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                {item.time && <span>{item.time}</span>}
                                                {item.subject && (
                                                    <>
                                                        {item.time && <span>·</span>}
                                                        <span><MathText text={item.subject} /></span>
                                                    </>
                                                )}
                                                {item.duration ? (
                                                    <>
                                                        {(item.time || item.subject) && <span>·</span>}
                                                        <span>{item.duration} daq</span>
                                                    </>
                                                ) : null}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Test Side Panel */}
                {
                    testPanel && (() => {
                        let questions: any[] = []
                        try { questions = JSON.parse(testPanel) } catch { return null }
                        // Faqat bo'sh bo'lmagan javoblarni sanaymiz — tozalangan ('') javob "javob berilgan" emas
                        const answered = Object.values(testAnswers).filter(v => v.trim() !== '').length
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
                                        <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--k-accent-grad)' }}><ClipboardList className="h-3.5 w-3.5 text-white" /></div>
                                        <span className="text-sm font-semibold">Test — {questions.length} savol</span>
                                        {(() => { const b = sourceBadge(activeTestSource); return b ? <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold" style={{ background: b.bg, color: b.color }}>{b.label}</span> : null })()}
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
                                                <p className="text-[14px] font-semibold mb-2 leading-relaxed"><span style={{ fontFamily: 'var(--k-serif)', fontStyle: 'italic', fontWeight: 500, color: 'var(--brand)', marginRight: 5 }}>{i + 1}.</span><MathText text={q.q} /></p>
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
                                                                <button key={opt} type="button" disabled={testSubmitted}
                                                                    onClick={() => setTestAnswers(prev => ({ ...prev, [i]: opt }))}
                                                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTestAnswers(prev => ({ ...prev, [i]: opt })) } }}
                                                                    tabIndex={0}
                                                                    role="radio"
                                                                    aria-checked={testAnswers[i] === opt}
                                                                    className="w-full text-left px-4 py-3 rounded-xl text-[13px] border transition-all duration-200 outline-none"
                                                                    style={sty}>
                                                                    <span className="font-bold mr-2" style={{ opacity: 0.6 }}>{opt.toUpperCase()})</span>
                                                                    <span className="pointer-events-none">
                                                                        <MathText text={q[opt]} />
                                                                    </span>
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
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--k-soft)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'} />
                            )}

                            {/* Header */}
                            <div className="h-14 flex items-center justify-between px-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                                <div className="flex items-center gap-2">
                                    <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--k-accent-grad)' }}>
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
                                    <div className="rounded-xl p-4" style={{ background: 'color-mix(in srgb, var(--brand) 8%, transparent)', border: '1.5px solid color-mix(in srgb, var(--brand) 25%, transparent)' }}>
                                        <p className="k-eyebrow mb-2" style={{ fontSize: '11px' }}>Topshiriq — {essayPanel.task}</p>
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
                                                border: `1.5px solid ${essaySubmitted ? 'var(--border)' : 'color-mix(in srgb, var(--brand) 30%, transparent)'}`,
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
                                                background: wordOk && !wordOver ? 'var(--k-accent-grad)' : 'var(--bg-muted)',
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
                                                    <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)' }}>❓ Savol</span>
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
                        <div className="absolute inset-0 k-fade-in" style={{ background: 'rgba(28,24,18,0.34)' }} />
                        <div className="relative ml-auto h-full flex flex-col overflow-hidden k-slide-in-right"
                            style={{ width: '100%', maxWidth: '680px', background: 'var(--bg-page)', boxShadow: '-16px 0 50px -16px rgba(33,28,22,0.22)' }}
                            onClick={e => e.stopPropagation()}>

                            {/* Header */}
                            <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                                <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: overlayPanel === 'progress' ? 'rgba(16,185,129,0.12)' : 'color-mix(in srgb, var(--brand) 12%, transparent)' }}>
                                    {overlayPanel === 'tests' && <ClipboardList className="h-5 w-5" style={{ color: 'var(--brand)' }} />}
                                    {overlayPanel === 'flashcards' && <Brain className="h-5 w-5" style={{ color: 'var(--brand)' }} />}
                                    {overlayPanel === 'progress' && <BarChart2 className="h-5 w-5" style={{ color: '#10b981' }} />}
                                    {overlayPanel === 'pro' && <Sparkles className="h-5 w-5" style={{ color: 'var(--brand)' }} />}
                                </div>
                                <div className="flex-1">
                                    <h2 className="font-semibold text-base">
                                        {overlayPanel === 'tests' ? 'Testlar' : overlayPanel === 'flashcards' ? 'Kartochkalar' : overlayPanel === 'progress' ? 'Natijalar' : 'Pro'}
                                    </h2>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                        {overlayPanel === 'tests' ? `${publicTests.length} ta test mavjud`
                                            : overlayPanel === 'flashcards' ? `${dueFlashcards.length} ta kartochka qaytarish kerak`
                                            : overlayPanel === 'progress' ? 'O\'qish tahlili'
                                            : 'Rejalar va imkoniyatlar'}
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
                                        {publicTests.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                                <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-muted)' }}>
                                                    <ClipboardList className="h-8 w-8" style={{ color: 'var(--text-muted)' }} />
                                                </div>
                                                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Hozircha testlar yo'q</p>
                                            </div>
                                        )}
                                        {publicTests.length > 0 && (() => {
                                            const cats = Array.from(new Set(publicTests.map(pt => pt.category || 'Boshqa')))
                                            return cats.length > 1 ? (
                                                <div className="flex flex-wrap gap-2 pb-1">
                                                    {['all', ...cats].map(c => {
                                                        const active = testCategory === c
                                                        return (
                                                            <button key={c} onClick={() => setTestCategory(c)}
                                                                className="text-xs font-semibold px-3 py-1.5 rounded-full transition"
                                                                style={active
                                                                    ? { background: 'var(--brand)', color: 'white' }
                                                                    : { background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}>
                                                                {c === 'all' ? 'Hammasi' : c}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            ) : null
                                        })()}
                                        {publicTests.filter(t => testCategory === 'all' || (t.category || 'Boshqa') === testCategory).map(t => {
                                            const result = myResults.find(r => r.testId === t.id)
                                            return (
                                                <div key={t.id} className="rounded-2xl p-4 transition" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                                    <div className="flex items-start gap-3">
                                                        <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                            style={{ background: result ? 'rgba(16,185,129,0.12)' : 'color-mix(in srgb, var(--brand) 10%, transparent)' }}>
                                                            {result ? <CheckCircle className="h-5 w-5" style={{ color: '#10b981' }} /> : <ClipboardList className="h-5 w-5" style={{ color: 'var(--brand)' }} />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-semibold text-sm truncate">{t.title}</p>
                                                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t.subject} • {t._count?.questions ?? 0} savol</p>
                                                            {(() => { const b = sourceBadge(t.source); return b ? <span className="inline-block text-[10px] px-2 py-0.5 rounded-md font-semibold mt-1.5" style={{ background: b.bg, color: b.color }}>{b.label}</span> : null })()}
                                                            {result && (
                                                                <div className="mt-2 space-y-2">
                                                                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                                        {(() => {
                                                                            const summary = getAttemptSummary(result)
                                                                            return `${summary.correctCount}/${summary.answeredCount || t._count?.questions || 0} to'g'ri (${summary.percent}%)`
                                                                        })()}
                                                                    </p>
                                                                    {weakTopicSummary && (
                                                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                                            Zaif: {weakTopicSummary}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {result ? (
                                                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                                                                    {getAttemptSummary(result).percent}%
                                                                </span>
                                                                {weakTopicSummary && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setOverlayPanel(null)
                                                                            void handleSend(`Mening zaif mavzularim: ${weakTopicSummary}. Shu mavzularni bugun o'rganish uchun qisqa reja tuzing va asosiy tushunchalarni tushuntiring.`, [])
                                                                        }}
                                                                        className="text-[11px] font-semibold px-3 py-1.5 rounded-xl transition"
                                                                        style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}
                                                                    >
                                                                        Zaif mavzuni o'rganish
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => { void openPublicTest(t) }}
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
                                        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                            <div className="flex items-center justify-between gap-3 mb-3">
                                                <div>
                                                    <p className="text-sm font-semibold">Kartochkalar progressi</p>
                                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{reviewedFlashcards}/{totalFlashcards || 0} o'rganildi</p>
                                                </div>
                                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>
                                                    {totalFlashcards > 0 ? Math.round((reviewedFlashcards / totalFlashcards) * 100) : 0}%
                                                </span>
                                            </div>
                                            <div className="progress-bar">
                                                <div className="progress-bar-fill" style={{ width: `${totalFlashcards > 0 ? (reviewedFlashcards / totalFlashcards) * 100 : 0}%` }} />
                                            </div>
                                        </div>
                                        {dueFlashcards.length > 0 && (
                                            <div className="rounded-2xl p-4 mb-2" style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)' }}>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-semibold text-sm" style={{ color: 'var(--danger)' }}>{dueFlashcards.length} ta kartochka takrorlash vaqti keldi</p>
                                                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Xotirani mustahkamlash uchun takrorlang</p>
                                                    </div>
                                                    <button onClick={() => { setOverlayPanel(null); setFlashPanel(dueFlashcards.map(f => ({ id: f.id, front: f.front, back: f.back }))); setFlashIdx(0); setFlashFlipped(false); setFlashIsReview(true) }}
                                                        className="text-sm font-semibold px-4 py-2 rounded-xl transition"
                                                        style={{ background: 'var(--danger)', color: 'white' }}>
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
                                                <p className="text-sm font-medium"><MathText text={f.front} /></p>
                                                <p className="text-xs mt-2 pt-2" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}><MathText text={f.back} /></p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {overlayPanel === 'progress' && (
                                    <div className="space-y-4">
                                        {/* Stats grid */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            {[
                                                { label: 'Yechilgan testlar', value: myResults.length, icon: <ClipboardList className="h-5 w-5" />, color: 'var(--brand)' },
                                                { label: "O'rtacha ball", value: `${Math.round(progressData?.avgScore ?? 0)}%`, icon: <Trophy className="h-5 w-5" />, color: '#10b981' },
                                                { label: 'Kartochkalar', value: `${reviewedFlashcards}/${totalFlashcards || 0}`, icon: <Brain className="h-5 w-5" />, color: 'var(--brand)' },
                                            ].map((s, i) => (
                                                <div key={i} className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>{s.icon}</div>
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
                                                    {myResults.slice(0, 5).map(r => {
                                                        const summary = getAttemptSummary(r)
                                                        return (
                                                            <div key={r.id} className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                                                <div className="flex items-center gap-3">
                                                                    <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                                                        style={{ background: summary.percent >= 70 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)', color: summary.percent >= 70 ? '#10b981' : '#ef4444' }}>
                                                                        <Trophy className="h-4 w-4" />
                                                                    </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium truncate">{r.test?.title || publicTests.find(t => t.id === r.testId)?.title || 'Test'}</p>
                                                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleDateString('uz-UZ')}</p>
                                                                </div>
                                                                    <span className="text-sm font-bold flex-shrink-0" style={{ color: summary.percent >= 70 ? '#10b981' : '#ef4444' }}>{getAttemptMeta(r)}</span>
                                                                </div>
                                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                                    <span>{summary.correctCount}/{summary.answeredCount || r.total || 0} to'g'ri</span>
                                                                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                                                                    <span>{summary.percent}%</span>
                                                                    {r.grade && (
                                                                        <>
                                                                            <span style={{ color: 'var(--text-muted)' }}>•</span>
                                                                            <span>{r.grade}</span>
                                                                        </>
                                                                    )}
                                                                    {weakTopicSummary && (
                                                                        <>
                                                                            <span style={{ color: 'var(--text-muted)' }}>•</span>
                                                                            <span>Zaif: {weakTopicSummary}</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                {weakTopicSummary && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setOverlayPanel(null)
                                                                            void handleSend(`Mening zaif mavzularim: ${weakTopicSummary}. Shu mavzularni bugun o'rganish uchun qisqa reja tuzing va asosiy tushunchalarni tushuntiring.`, [])
                                                                        }}
                                                                        className="mt-3 text-xs font-semibold px-3 py-2 rounded-xl transition"
                                                                        style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}
                                                                    >
                                                                        Zaif mavzuni o'rganish
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
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

                                {/* PRO — narxlar/imkoniyatlar (landing #narxlar bilan bir xil; to'lov YO'Q, bloklash YO'Q) */}
                                {overlayPanel === 'pro' && (
                                    <div className="space-y-4">
                                        {/* Status banner — beta'da bepul */}
                                        <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: 'var(--brand-light)', border: '1px solid color-mix(in srgb, var(--brand) 24%, transparent)' }}>
                                            <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--brand) 16%, transparent)' }}>
                                                <Sparkles className="h-5 w-5" style={{ color: 'var(--brand)' }} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                    {pro.statusLabel}
                                                </p>
                                                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                                    Hozir <strong style={{ color: 'var(--brand)' }}>barcha imkoniyatlar</strong> hammaga bepul ochiq — Pro xususiyatlari ham. To'lov keyinroq ulanadi.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Free tier card */}
                                        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                            <div className="flex items-baseline justify-between gap-2">
                                                <span className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--text-muted)' }}>Bepul</span>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>0</span>
                                                    <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>so'm</span>
                                                </div>
                                            </div>
                                            <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>Hammaga to'liq ochiq — bugun va doimo.</p>
                                            <ul className="mt-3 space-y-2">
                                                {FREE_FEATURES.map(f => (
                                                    <li key={f} className="flex items-start gap-2 text-[13px] leading-snug" style={{ color: 'var(--text-primary)' }}>
                                                        <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                                                        <span>{f}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Pro tier card */}
                                        <div className="rounded-2xl p-4 relative" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--brand)', boxShadow: '0 8px 28px -16px color-mix(in srgb, var(--brand) 60%, transparent)' }}>
                                            <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>
                                                {PRO_STATUS_LABEL}
                                            </span>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--brand)' }}>Pro</span>
                                            </div>
                                            <div className="flex items-baseline gap-1 mt-1.5">
                                                <span className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>{PRO_PRICE}</span>
                                                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{PRO_PRICE_PERIOD}</span>
                                            </div>
                                            <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>Orzuingga tezroq yetmoqchilar uchun qo'shimcha kuch.</p>
                                            <ul className="mt-3 space-y-3">
                                                {PRO_FEATURES.map(feat => (
                                                    <li key={feat.id} className="flex items-start gap-2.5">
                                                        <div className="h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'var(--brand-light)' }}>
                                                            <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--brand)' }} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{feat.title}</span>
                                                                {feat.available ? (
                                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
                                                                        <CheckCircle className="h-2.5 w-2.5" /> {pro.isPro ? 'Hozir ochiq' : 'Pro'}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
                                                                        <Clock className="h-2.5 w-2.5" /> Tez kunda
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{feat.description}</p>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>

                                            {/* CTA — to'lovni TAQLID QILMAYDI: disabled "Tez kunda" */}
                                            <button
                                                type="button"
                                                disabled
                                                aria-disabled="true"
                                                className="mt-4 w-full h-10 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-1.5"
                                                style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'not-allowed' }}
                                                title="To'lov tizimi tez kunda ulanadi"
                                            >
                                                <Clock className="h-4 w-4" /> Tez kunda
                                            </button>
                                            <p className="text-[11px] mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
                                                To'lov hali ishga tushmagan — hozircha Pro ham bepul.
                                            </p>
                                        </div>

                                        {/* Honesty disclaimer (landing footnote bilan bir xil) */}
                                        <p className="text-[11px] leading-relaxed px-1" style={{ color: 'var(--text-muted)' }}>
                                            {PRO_DISCLAIMER}
                                        </p>
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
