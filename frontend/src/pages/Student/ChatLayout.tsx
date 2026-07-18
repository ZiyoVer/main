import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { BrainCircuit, Plus, Trash2, LogOut, Menu, X, GraduationCap, ClipboardList, Settings, BookOpen, Target, FileText, Square, Lightbulb, Maximize2, Minimize2, Paperclip, Layers, ChevronLeft, ChevronRight, RotateCcw, AlertTriangle, TrendingUp, Brain, PenLine, CheckCircle, Bell, Trophy, ArrowUp, ArrowDown, ArrowRight, BarChart2, User, Calendar, Shield, Sparkles, Clock, Flame, Zap, Copy, MessageSquare, Pencil, MoreHorizontal, House } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import rehypeSanitize from 'rehype-sanitize'
import DOMPurify from 'dompurify'
import 'katex/dist/katex.min.css'
import katex from 'katex'
import { renderMathHtml, normalizeMathText } from '@/lib/mathRender'
import toast from 'react-hot-toast'
import { fetchApi } from '@/lib/api'
import { parseStructuredJson, extractStructuredPayload } from '@/lib/structuredJson'
import { stableHash, legacyTestKey } from '@/lib/stableHash'
import { saveScopedItem, pruneDtmmaxStorage } from '@/lib/storagePrune'
import GeometryFigure from '@/components/GeometryFigure'
import { SUBJECTS, normalizeSubjectValue } from '@/constants'
import { DTM_DIRECTIONS, SCORE_BOUNDS, dtmDirectionByCode, dtmDirectionBySubjects } from '@/constants/dtmDirections'
import { useAuthStore } from '@/store/authStore'
import ChatContext, { useChatContext, EssayPanel, TodoItem } from '../../contexts/ChatContext'
import { useTestPanel } from '../../hooks/useTestPanel'
import { useFlashPanel } from '../../hooks/useFlashPanel'
import { useIsPro, PRO_PRICE, PRO_PRICE_PERIOD, PRO_FEATURES, FREE_FEATURES, PRO_DISCLAIMER } from '@/lib/pro'
import { AiQuotaRail } from './chat/AiQuotaRail'
import { useAiQuota } from './chat/useAiQuota'
import type { AiQuota } from './chat/useAiQuota'
import { TestCatalogControls } from './chat/TestCatalogControls'
import { useTestCatalog } from './chat/useTestCatalog'
import type { TestCatalogFormat, TestCatalogSort, TestCatalogView } from './chat/useTestCatalog'
import '../../styles/student-workspace.css'

interface Chat { id: string; title: string; subject?: string; subject2?: string; updatedAt: string; messageCount?: number }
interface Msg { id: string; role: string; content: string; createdAt: string }
interface Profile { onboardingDone: boolean; examType?: 'DTM' | 'MS' | null; subject?: string; subject2?: string; examDate?: string; targetScore?: number; weakTopics?: string; strongTopics?: string; concerns?: string; totalTests?: number; avgScore?: number; abilityLevel?: number }
interface PublicTest { id: string; title: string; shareLink: string; subject?: string; category?: string; source?: string; premium?: boolean; testType?: string; timeLimit?: number | null; _count?: { questions: number; attempts: number } }

function testTypeLabel(testType?: string | null): string | null {
    if (testType === 'DTM_BLOCK') return 'DTM 189'
    if (testType === 'MILLIY_SERTIFIKAT') return 'MS 75'
    return null
}

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

type StructuredBlockType = 'test' | 'essay' | 'profile-update' | 'flashcard' | 'vocab' | 'formula' | 'geometry' | 'todo-done' | 'todo' | null

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

// Yechilgan testni markdown sharh sifatida tuzadi (savol + sening javobing + to'g'ri javob ✅/❌).
// Tahlil bilan birga ko'rsatiladi — shunda o'quvchi testini YO'QOTMAYDI.
function buildTestReviewMd(data: any): string {
    const qs = Array.isArray(data?.questions) ? data.questions : []
    if (qs.length === 0) return ''
    const lines: string[] = [`### 📝 Yechgan testingiz — ${data?.score ?? '?'}/${data?.total ?? qs.length} to'g'ri`]
    qs.forEach((q: any, i: number) => {
        const text = String(q?.text || `Savol ${i + 1}`).trim()
        // Moslashtirish / multi-part yozma — sub-javoblar bilan
        if ((q?.questionType === 'matching' || q?.questionType === 'multipart_open') && Array.isArray(q?.subAnswers)) {
            lines.push(`\n**${i + 1}.** ${text}`)
            q.subAnswers.forEach((sa: any, si: number) => {
                const ok = String(sa?.studentAnswer || '').trim().toLowerCase() === String(sa?.correctAnswer || '').trim().toLowerCase()
                lines.push(`- ${ok ? '✅' : '❌'} ${sa?.label || si + 1}. ${sa?.subText || ''} — Siz: ${sa?.studentAnswer || '—'}${ok ? '' : ` · To'g'ri: ${sa?.correctAnswer || '—'}`}`)
            })
            return
        }
        // Oddiy A/B/C/D test
        const sa = String(q?.studentAnswer || '').trim().toLowerCase()
        const ca = String(q?.correctAnswer || '').trim().toLowerCase()
        const ok = !!sa && sa === ca
        const optText = (k: string) => (q?.[k] ? String(q[k]) : '')
        const label = (k: string) => (k ? `${k.toUpperCase()}) ${optText(k)}`.trim() : '—')
        lines.push(`\n**${i + 1}.** ${text}`)
        if (ok) {
            lines.push(`- ✅ To'g'ri javob berdingiz: **${label(sa)}**`)
        } else {
            lines.push(`- ❌ Sizning javobingiz: ${sa ? label(sa) : 'belgilanmagan'}`)
            lines.push(`- ✅ To'g'ri javob: **${label(ca)}**`)
        }
    })
    return lines.join('\n')
}

// Yuklanish yozuvini so'rov mazmuniga moslab tanlaydi ("Yozmoqda" emas, "Test tuzmoqda" kabi).
function getLoadingLabel(messages: { role: string; content: string }[]): string {
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    const t = (lastUser?.content || '').toLowerCase()
    if (!t) return 'Yozmoqda...'
    if (/\btest\b|sinov|baholash|daraja|savol ber|mashq|quiz|variant|imtihon/.test(t)) return 'Test tuzmoqda...'
    if (/kartochka|flash\s?card|yodla/.test(t)) return 'Kartochkalar tayyorlanmoqda...'
    if (/reja|jadval|\bplan\b|checklist|bugun nima|qayerdan boshla/.test(t)) return 'Reja tuzmoqda...'
    if (/chiz|diagramma|geometr|piramida|figura/.test(t)) return 'Chizma chizmoqda...'
    if (/formula/.test(t)) return 'Formulalar tayyorlanmoqda...'
    if (/insho|essay|writing|task\s?[12]/.test(t)) return 'Topshiriq tayyorlanmoqda...'
    if (/lug‘|lug'|so‘z|so'z boyligi|vocab/.test(t)) return "So'zlar tanlanmoqda..."
    return 'Yozmoqda...'
}

// Test paneli uchun inline KaTeX renderer (ReactMarkdown ishlatmaymiz, tez va engil)
function MathText({ text }: { text: string }) {
    // mathRender.ts'ning aqlli mantig'i: $...$, $$...$$, \[...\], \(...\) VA xom LaTeX'ni
    // (\frac{1}{6}, \sqrt{2}, grek harflar) avtomatik o'rab render qiladi. Test javoblari
    // ko'pincha $'siz xom keladi — shu sabab ilgari render bo'lmasdi.
    try {
        const html = renderMathHtml(text || '', 'inline')
        if (html === null) return <>{text}</>
        return <span dangerouslySetInnerHTML={{ __html: html }} />
    } catch { return <>{text}</> }
}

function getStudentQuestionText(question: unknown): string {
    if (!question || typeof question !== 'object') return ''
    const record = question as Record<string, unknown>
    for (const key of ['q', 'text', 'question', 'prompt']) {
        const value = record[key]
        if (typeof value === 'string' && value.trim()) return value.trim()
    }
    return ''
}

function StudentQuestionImage({ src }: { src: string }) {
    const [failed, setFailed] = useState(false)
    useEffect(() => setFailed(false), [src])
    if (failed) {
        return (
            <div className="mb-4 mt-1 rounded-xl px-3 py-2.5 text-[12px] font-medium"
                style={{ color: 'var(--danger)', background: 'var(--danger-light)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)' }}>
                Savol rasmi ochilmadi. Test muallifi rasmni qayta yuklashi kerak.
            </div>
        )
    }
    return (
        <div className="mb-4 mt-1">
            <img src={src} alt="Savol rasmi" onError={() => setFailed(true)}
                loading="eager" decoding="async" fetchPriority="high"
                className="max-w-full rounded-xl border shadow-sm"
                style={{ borderColor: 'var(--border)', maxHeight: '320px', objectFit: 'contain' }} />
        </div>
    )
}

function detectStructuredBlockType(raw: string, className?: string): StructuredBlockType {
    const lowerClass = className?.toLowerCase() || ''
    if (lowerClass.includes('language-test')) return 'test'
    if (lowerClass.includes('language-essay')) return 'essay'
    if (lowerClass.includes('language-profile-update')) return 'profile-update'
    if (lowerClass.includes('language-flashcard')) return 'flashcard'
    if (lowerClass.includes('language-vocab')) return 'vocab'
    if (lowerClass.includes('language-formula')) return 'formula'
    if (lowerClass.includes('language-geometry')) return 'geometry'
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
        const obj = parsed as Record<string, unknown>
        if (obj.type === 'geometry' || 'segments' in obj || 'polygons' in obj || ('points' in obj && ('circles' in obj || 'angles' in obj))) return 'geometry'
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
    const { onOpenTest, onProfileUpdate, onOpenFlash, onOpenEssay, onSetTodo, onMarkTodoDoneByTask, isAiTestDone } = useChatContext()
    const processedContent = normalizeMathText(content) // 2.4: yagona manba — mathRender
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
                    // Yechilgan test — karta "Natijani ko'rish" bo'ladi (o'quvchi testni qayta topa oladi)
                    const done = !isStreaming && isAiTestDone(jsonStr)
                    return (
                        <div className="my-3 rounded-2xl overflow-hidden" style={done ? {
                            background: 'var(--success-light)',
                            border: '1.5px solid color-mix(in srgb, var(--success) 35%, transparent)',
                        } : {
                            background: 'var(--brand-light)',
                            border: '1.5px solid color-mix(in srgb, var(--brand) 30%, transparent)',
                        }}>
                            <div className="p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: done ? 'var(--success)' : 'var(--k-accent-grad)' }}>
                                            {done ? <CheckCircle className="h-5 w-5 text-white" /> : <ClipboardList className="h-5 w-5 text-white" />}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{done ? 'Test yechilgan' : 'Test tayyor!'}</p>
                                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: done ? 'var(--success)' : 'var(--brand)', color: '#fff' }}>
                                                    {qCount} ta savol
                                                </span>
                                            </div>
                                            {done && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Javoblaringiz va izohlar saqlangan</p>}
                                        </div>
                                    </div>
                                    {!isStreaming && (
                                        <button
                                            onClick={() => onOpenTest(jsonStr)}
                                            className="flex-shrink-0 h-9 px-4 rounded-xl text-[13px] font-bold text-white flex items-center gap-2 transition-all"
                                            style={{ background: done ? 'var(--success)' : 'var(--k-accent-grad)' }}
                                            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                                            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                                        >
                                            {done ? <><CheckCircle className="h-4 w-4" /> Natijani ko'rish</> : <><BookOpen className="h-4 w-4" /> Boshlash</>}
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
                            background: 'var(--brand-light)',
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
                if (structuredType === 'geometry') {
                    return <GeometryFigure raw={jsonStr} />
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
                    : <code className="px-1.5 py-0.5 rounded-md text-[13px] font-mono" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--brand)', overflowWrap: 'anywhere' }}>{children}</code>
            },
            blockquote: ({ children }) => <blockquote className="border-l-[3px] pl-4 pr-3 py-2 my-3" style={{ borderColor: 'var(--brand)', background: 'var(--brand-light)', color: 'var(--text-secondary)', borderRadius: '0 0.75rem 0.75rem 0' }}>{children}</blockquote>,
            hr: () => <hr className="my-4" style={{ borderColor: 'var(--border)' }} />,
        }}>{processedContent}</ReactMarkdown>
    )
})

type AttachedFile = { id: string; name: string; text: string; type: string; previewUrl?: string; url?: string | null; uploading?: boolean }

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
                done: Boolean(item.done),
                createdAt: typeof item.createdAt === 'number' ? item.createdAt : undefined
            }))
    } catch {
        return []
    }
}

// "Bugun" bosh ekrani uchun: reja chat-scoped saqlanadi, shuning uchun bosh ekranda
// userning BARCHA chat-bucket'laridagi rejalarni yig'amiz (aks holda doim bo'sh ko'rinardi)
function loadAllUserTodos(userId: string): Array<TodoItem & { storageKey: string }> {
    const prefix = `${TODO_STORAGE_PREFIX}_${userId}_`
    const merged: Array<TodoItem & { storageKey: string }> = []
    const seen = new Set<string>()
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (!key || !key.startsWith(prefix)) continue
            for (const item of loadStoredTodos(key)) {
                const signature = getTodoSignature(item)
                if (seen.has(signature)) continue
                seen.add(signature)
                merged.push({ ...item, storageKey: key })
            }
        }
    } catch { /* localStorage o'qilmasa — bo'sh ro'yxat */ }
    // Bajarilmaganlar oldinda tursin
    return merged.sort((a, b) => Number(a.done) - Number(b.done))
}

// Bosh ekrandan vazifani bajarildi deb belgilash — o'z bucket'iga yozib qo'yadi
function markStoredTodoDone(storageKey: string, id: string): void {
    try {
        const items = loadStoredTodos(storageKey).map(t => (t.id === id ? { ...t, done: true } : t))
        localStorage.setItem(storageKey, JSON.stringify(items))
    } catch { /* saqlanmasa jim — UI holati baribir yangilanadi */ }
}

// Vaqtga mos iliq salom — "Salom" o'rniga shaxsiyroq kutib olish
function timeGreeting(): string {
    const hour = new Date().getHours()
    if (hour < 5) return 'Xayrli tun'
    if (hour < 12) return 'Xayrli tong'
    if (hour < 18) return 'Xayrli kun'
    return 'Xayrli oqshom'
}

// Brauzer ICU paketiga bog'lanmaydigan, doim o'zbekcha chiqadigan sana.
// Ayrim headless/eski brauzerlarda Intl `M07 18, Sat` kabi fallback qaytaradi.
function formatUzbekDate(date = new Date()): string {
    const weekdays = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba']
    const months = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
    return `${date.getDate()}-${months[date.getMonth()]}, ${weekdays[date.getDay()]}`
}

// Diagnostik test tanlangan HAMMA fandan bo'lsin (DTM: 1+2 ixtisoslik) — bitta fanda
// 10 savol emas. Har fan bo'yicha daraja aniqlanadi; AI har safar yangi savol tuzadi.
function diagnosticSubjects(p: { subject?: string; subject2?: string; examType?: 'DTM' | 'MS' | null } | null): string[] {
    const out: string[] = []
    if (p?.subject) out.push(p.subject)
    if (p?.examType === 'DTM' && p?.subject2 && p.subject2 !== p.subject) out.push(p.subject2)
    return out
}
function buildDiagnosticPrompt(p: Parameters<typeof diagnosticSubjects>[0]): string {
    const subs = diagnosticSubjects(p)
    if (subs.length >= 2) {
        return `Men DTMga tayyorlanaman, fanlarim: ${subs.join(' va ')}. Darajamni aniqlash uchun diagnostik test tuz — HAR FANDAN kamida 6 ta savol (aralash, osondan qiyinga qarab), har biri 4 variantli (A/B/C/D). Test tugagach har fan bo'yicha darajamni (foiz va A+/A/B/C daraja) ALOHIDA ayt, zaif mavzularimni ko'rsat va keyingi qadamni tavsiya qil. Savollar har safar yangi bo'lsin.`
    }
    const one = subs[0] || 'asosiy fanim'
    return `${one}dan darajamni aniqlash uchun diagnostik test tuz — kamida 10 ta savol, osondan qiyinga qarab, har biri 4 variantli (A/B/C/D). Test tugagach darajamni (foiz va daraja) va zaif mavzularimni ayt, keyingi qadamni tavsiya qil.`
}

// Test yakunidagi mukofot lahzasi — kutubxonasiz engil konfetti.
// prefers-reduced-motion hurmat qilinadi; natija yaxshiroq bo'lsa zarra ko'proq.
function celebrate(ratio: number): void {
    if (typeof document === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const colors = ['#F15A24', '#F5894E', '#16A34A', '#2563EB', '#F4C430']
    const count = ratio >= 0.7 ? 34 : ratio >= 0.4 ? 22 : 12
    const originY = window.innerHeight * 0.45
    for (let i = 0; i < count; i++) {
        const piece = document.createElement('span')
        piece.className = 'k-confetti-piece'
        const size = 5 + Math.random() * 6
        piece.style.width = `${size}px`
        piece.style.height = `${size * (Math.random() > 0.5 ? 1 : 0.4)}px`
        piece.style.borderRadius = Math.random() > 0.6 ? '50%' : '2px'
        piece.style.background = colors[i % colors.length]
        piece.style.left = `${window.innerWidth / 2 + (Math.random() - 0.5) * 160}px`
        piece.style.top = `${originY}px`
        piece.style.setProperty('--kc-dx', `${(Math.random() - 0.5) * 320}px`)
        piece.style.setProperty('--kc-dy', `${-80 - Math.random() * 260}px`)
        piece.style.setProperty('--kc-rot', `${(Math.random() - 0.5) * 720}deg`)
        piece.style.setProperty('--kc-dur', `${0.9 + Math.random() * 0.8}s`)
        document.body.appendChild(piece)
        setTimeout(() => piece.remove(), 1800)
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
    // chatId yo'q bo'lsa (yangi suhbat) chat yaratib id qaytaradi — paste/rasm shu holatda ham ishlasin
    onEnsureChat: () => Promise<string | null>
    aiQuota: AiQuota | null
    refreshAiQuota: () => Promise<void>
    onOpenTests: () => void
}

const ChatInputArea = memo(function ChatInputArea({
    chatId, loading, thinkingMode, setThinkingMode, onSend, onStop, blobUrlsRef, onEnsureChat,
    aiQuota, refreshAiQuota, onOpenTests
}: ChatInputAreaProps) {
    const [input, setInput] = useState('')
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
    const [uploadingFile, setUploadingFile] = useState(false)
    const [showComposerOptions, setShowComposerOptions] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const adjustTextareaHeight = useCallback(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    }, [])

    async function uploadFiles(filesToUpload: File[]) {
        // chatId yo'q (yangi suhbat/welcome) — avval chat yaratamiz, paste/rasm shu holatda ham ishlaydi
        let targetChatId = chatId
        if (!targetChatId) {
            targetChatId = (await onEnsureChat()) || undefined
            if (!targetChatId) {
                toast.error("Suhbat ochilmadi — qayta urinib ko'ring")
                return
            }
        }
        // DARROV preview chip qo'shamiz — rasm xira (blur) bo'lib yuklanayotgani KO'RINADI
        const optimistic: AttachedFile[] = filesToUpload.map(file => ({
            id: `up-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: file.name,
            text: '',
            type: file.type.startsWith('image/') ? 'image' : 'other',
            previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
            uploading: true,
        }))
        setAttachedFiles(prev => [...prev, ...optimistic])
        setUploadingFile(true)
        const token = localStorage.getItem('token')
        // Har fayl ALOHIDA yuklanadi — bittasi yiqilsa qolganlari yo'qolmaydi
        await Promise.all(optimistic.map(async (chip, i) => {
            const file = filesToUpload[i]
            try {
                const formData = new FormData()
                formData.append('file', file)
                const res = await fetch(`/api/chat/${targetChatId}/upload-file`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData
                })
                const data = await res.json().catch(() => ({}))
                // Server rad etsa (400/413/500) chip "yuklandi" bo'lib qolmasin (avval jim 'undefined' ketardi)
                if (!res.ok || !data?.text) throw new Error(data?.error || 'Fayl qayta ishlanmadi')
                setAttachedFiles(prev => prev.map(f => f.id === chip.id
                    ? { ...f, text: data.text, type: data.fileType || f.type, url: data.imageUrl || null, uploading: false }
                    : f))
            } catch (e: any) {
                // Xato — chip olib tashlanadi va sababi AYTILADI (jim qolmaydi)
                setAttachedFiles(prev => prev.filter(f => f.id !== chip.id))
                if (chip.previewUrl) URL.revokeObjectURL(chip.previewUrl)
                toast.error(`${file.name}: ${e?.message || "yuklab bo'lmadi"}`)
            }
        }))
        setUploadingFile(false)
        void refreshAiQuota()
        // Upload tugagach textarea ga focus qaytaramiz — Enter ishlashi uchun
        setTimeout(() => textareaRef.current?.focus(), 50)
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
        // chatId'siz ham ishlaydi (uploadFiles o'zi chat yaratadi) — avval JIM chiqib ketardi
        if (loading || uploadingFile) return
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
        if (aiQuota && !aiQuota.unlimited && aiQuota.chat.used >= aiQuota.chat.limit) {
            toast("Bugungi AI limiti tugadi — tayyor testlarni limitsiz yechishingiz mumkin", { icon: '⚡' })
            return
        }
        // Rasm hali yuklanayotgan bo'lsa — kutish kerakligini AYTAMIZ (jim emas)
        if (attachedFiles.some(f => f.uploading)) {
            toast('Rasm hali yuklanmoqda — bir soniya kuting', { icon: '⏳' })
            return
        }
        const text = input.trim()
        const files = [...attachedFiles]
        files.forEach(f => { if (f.previewUrl) blobUrlsRef.current.push(f.previewUrl) })
        setInput('')
        setAttachedFiles([])
        setShowComposerOptions(false)
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
        // Yuborish muvaffaqiyatsiz bo'lsa (masalan chat yaratilmadi) yozilgan matnni QAYTARAMIZ —
        // avval matn butunlay yo'qolardi
        void Promise.resolve(onSend(text, files) as unknown).then(result => {
            if (result === false) {
                setInput(text)
                setAttachedFiles(files)
            }
        })
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (uploadingFile) return // upload tugaguncha kuting
            if (!loading && (input.trim() || attachedFiles.length > 0)) handleSubmit(e as any)
        }
    }

    const chatQuotaExhausted = !!aiQuota && !aiQuota.unlimited && aiQuota.chat.used >= aiQuota.chat.limit
    const visionLeft = aiQuota && !aiQuota.unlimited
        ? Math.max(0, aiQuota.vision.limit - aiQuota.vision.used)
        : null
    const attachLabel = visionLeft === null
        ? 'Fayl biriktirish'
        : `Fayl biriktirish · rasm tahlili ${visionLeft}/${aiQuota?.vision.limit ?? 0}`

    return (
        <div className="px-3 sm:px-6 pb-4 sm:pb-6 pt-3 chat-input-area chat-composer-shell flex-shrink-0" style={{ background: 'var(--bg-page)' }}>
            <form onSubmit={handleSubmit} className="max-w-[760px] mx-auto">
                <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,image/*" className="hidden" onChange={handleFileSelect} />
                <div className="rounded-2xl overflow-hidden chat-input-box" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', boxShadow: '0 2px 8px rgba(33,28,22,0.06)', transition: 'border-color 0.15s, box-shadow 0.15s' }}>
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
                                        <img src={file.previewUrl} alt={file.name} className="w-full h-full object-cover rounded-[8px] transition-all duration-300"
                                            style={file.uploading ? { filter: 'blur(2px) brightness(0.75)' } : undefined} />
                                    ) : (
                                        <>
                                            <FileText className="h-5 w-5 mb-0.5" style={{ color: 'var(--brand)', opacity: file.uploading ? 0.4 : 1 }} />
                                            <span className="text-[9px] w-full truncate text-center" style={{ color: 'var(--text-muted)' }}>{file.name.substring(0, 8)}…</span>
                                        </>
                                    )}
                                    {/* Yuklanayotganda: xira rasm ustida aylanuvchi spinner */}
                                    {file.uploading && (
                                        <div className="absolute inset-0 flex items-center justify-center rounded-[8px]">
                                            <div className="h-5 w-5 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.9)', borderTopColor: 'transparent' }} />
                                        </div>
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
                        placeholder="Savolingizni yozing yoki masala rasmini biriktiring…"
                        disabled={loading}
                        rows={1}
                        className="w-full bg-transparent outline-none text-sm resize-none leading-relaxed px-4"
                        style={{ color: 'var(--text-primary)', minHeight: '64px', maxHeight: '160px', paddingTop: '14px', paddingBottom: '8px', overflowX: 'hidden', wordBreak: 'break-word' }}
                    />
                    {/* Toolbar row */}
                    <div className="relative flex items-center gap-2 px-3 pb-3">
                        {/* Attach */}
                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading || uploadingFile}
                            className="h-8 w-8 flex items-center justify-center rounded-lg transition disabled:opacity-40"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            title={attachLabel} aria-label={attachLabel}>
                            {uploadingFile
                                ? <div className="h-3.5 w-3.5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
                                : <Paperclip className="h-3.5 w-3.5" />}
                        </button>
                        <button type="button" onClick={() => setShowComposerOptions(v => !v)}
                            aria-label="Chat sozlamalari" aria-expanded={showComposerOptions}
                            className="h-8 w-8 flex items-center justify-center rounded-lg transition"
                            style={showComposerOptions ? { background: 'var(--bg-surface)', color: 'var(--text-primary)' } : { color: 'var(--text-muted)' }}
                            title="Chat sozlamalari">
                            <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {showComposerOptions && (
                            <div className="absolute bottom-12 left-11 z-30 w-64 rounded-xl p-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 12px 28px rgba(33,28,22,0.14)' }}>
                                <button type="button" onClick={() => setThinkingMode(v => !v)} className="w-full flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition" style={{ background: thinkingMode ? 'var(--brand-light)' : 'transparent', color: thinkingMode ? 'var(--brand)' : 'var(--text-primary)' }}>
                                    <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    <span className="min-w-0"><span className="block text-[12px] font-semibold">Chuqur javob</span><span className="block text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{thinkingMode ? 'Murakkab masalalar uchun yoqilgan' : 'Murakkab masalalar uchun yoqing'}</span></span>
                                </button>
                                {aiQuota && (
                                    <div className="mt-1 rounded-lg px-2.5 py-2" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                                        <div className="flex items-center gap-2 text-[11px] font-medium"><Zap className="h-3.5 w-3.5" />{aiQuota.unlimited ? "AI so'rovlari cheksiz" : `AI: ${aiQuota.chat.used}/${aiQuota.chat.limit} · Rasm: ${aiQuota.vision.used}/${aiQuota.vision.limit}`}</div>
                                    </div>
                                )}
                            </div>
                        )}
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
                            <button type="submit" disabled={chatQuotaExhausted || (!input.trim() && attachedFiles.length === 0)}
                                className="h-9 w-9 flex items-center justify-center rounded-xl transition disabled:opacity-30"
                                style={{ background: 'var(--k-accent-grad)', color: 'white', boxShadow: 'var(--k-shadow-cta)' }}
                                title="Yuborish">
                                <ArrowUp className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    <AiQuotaRail quota={aiQuota} onOpenTests={onOpenTests} />
                </div>
            </form>
        </div>
    )
})

// Suhbatlarni sanasi bo'yicha guruhlash
// Chat sarlavhasini ro'yxat uchun tozalaydi: rasm-referenslari va markdown xom holda
// chiqib ketardi ("**[Rasm: screenshot-1783...]"). Toza, o'qiladigan sarlavha qaytaradi.
function cleanChatTitle(raw: string | undefined | null): string {
    let s = String(raw || '')
    s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')      // markdown rasm ![alt](url)
        .replace(/\*{0,2}\[?\s*Rasm:[^\]]*\]?/gi, ' ') // "**[Rasm: screenshot-...]" (yopilmagan ham)
        .replace(/s3key:[^\s)]+/gi, ' ')               // xom S3 ref
        .replace(/https?:\/\/\S+/g, ' ')               // yalang'och URL
        .replace(/[*_#`>]+/g, ' ')                     // markdown belgilari
        .replace(/\s+/g, ' ')                          // ketma-ket bo'shliqlar
        .trim()
    return s || 'Yangi suhbat'
}

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
    const { user, logout, token, clearSession } = useAuthStore()
    const isTodayView = !chatId
    // Reja (todo) CHATGA bog'lab saqlanadi — yangi chatda eski chat rejasi ko'rinmasin.
    // 'new' — hali chat tanlanmagan (/suhbat) holat uchun vaqtinchalik bo'lim.
    const todoStorageKey = `${TODO_STORAGE_PREFIX}_${user?.id || 'guest'}_${chatId || 'new'}`
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
    useEffect(() => {
        if (!overlayPanel) return
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOverlayPanel(null)
        }
        window.addEventListener('keydown', closeOnEscape)
        return () => window.removeEventListener('keydown', closeOnEscape)
    }, [overlayPanel])
    const [testCatalogView, setTestCatalogView] = useState<TestCatalogView>('recommended')
    const [testSubject, setTestSubject] = useState('all')
    const [testFormat, setTestFormat] = useState<TestCatalogFormat>('all')
    const [testSearch, setTestSearch] = useState('')
    const [testSort, setTestSort] = useState<TestCatalogSort>('recommended')
    const [testQuestionIndex, setTestQuestionIndex] = useState(0)
    const [activeTestSource, setActiveTestSource] = useState<string | null>(null) // ochiq test panelining manbasi (badge uchun)
    // Test review: xato javob ostidagi per-savol AI tushuntirishi (panel ichida, mobil uchun)
    const [explanations, setExplanations] = useState<Record<number, string>>({})
    const [explLoading, setExplLoading] = useState<number | null>(null)
    const [checkoutLoading, setCheckoutLoading] = useState(false)
    const [showScrollDown, setShowScrollDown] = useState(false) // uzun suhbatda "pastga" tugmasi
    const [todoItems, setTodoItems] = useState<TodoItem[]>(() => {
        // HAMMASI bajarilgan eski reja bilan boshlanmaymiz — u "bir ko'rinib yo'qolib" (auto-close
        // 1.5s) foydalanuvchini chalg'itardi. Toza boshlaymiz (storage keyingi effektda tozalanadi).
        const stored = loadStoredTodos(todoStorageKey)
        return stored.length > 0 && stored.every(item => item.done) ? [] : stored
    })
    const [todoOpen, setTodoOpen] = useState(() => {
        // Mobilда avto-ochmaymiz — fullscreen panel kirishni to'sib qo'ymasligi uchun.
        // Faqat BAJARILMAGAN band bo'lsagina ochamiz (tugagan reja flash bermasin).
        const initialMobile = typeof window !== 'undefined' && window.innerWidth < 768
        return !initialMobile && loadStoredTodos(todoStorageKey).some(item => !item.done)
    })
    const [showSettings, setShowSettings] = useState(false)
    // Sozlamalarda imtihon ma'lumotlari odatda read-only ko'rinadi; qalamcha bosilganda tahrirlanadi.
    // Tugmalar/maydonlar ko'payganda oyna tinch qoladi.
    const [editingExamInfo, setEditingExamInfo] = useState(false)
    // "Bugun" ekrani rejasi — barcha chatlardagi rejalar yig'indisi (chat tanlanmaganda ko'rinadi)
    const [homeTodos, setHomeTodos] = useState<Array<TodoItem & { storageKey: string }>>([])
    useEffect(() => {
        if (!chatId) setHomeTodos(loadAllUserTodos(user?.id || 'guest'))
        // todoItems deps: joriy chatda reja o'zgargan bo'lsa, bosh ekranga qaytganda yangilansin
    }, [chatId, user?.id, todoItems])
    // Bajarilgan vazifa ~0.7s davomida yashil ✓ bilan ko'rinib turadi (qoniqarli tick),
    // keyin ro'yxatdan siljiydi — darhol g'oyib bo'lish his-tuyg'usiz edi
    const [justDoneIds, setJustDoneIds] = useState<Set<string>>(new Set())
    function markHomeTodoDone(item: TodoItem & { storageKey: string }) {
        if (justDoneIds.has(item.id)) return
        markStoredTodoDone(item.storageKey, item.id)
        // Joriy bucket bo'lsa jonli todoItems state bilan ham sinxron
        if (item.storageKey === todoStorageKey) markTodoDone(item.id)
        setJustDoneIds(prev => new Set(prev).add(item.id))
        setTimeout(() => {
            setHomeTodos(prev => prev.map(t => (t.id === item.id ? { ...t, done: true } : t)))
            setJustDoneIds(prev => { const next = new Set(prev); next.delete(item.id); return next })
        }, 700)
    }
    // 6.3: bir martalik 3 qadamli mini-tur (-1 = ko'rsatilmaydi/tugagan)
    const [tourStep, setTourStep] = useState<number>(() => {
        try { return localStorage.getItem('dtmmax_tour_done_v1') ? -1 : 0 } catch { return -1 }
    })
    const finishTour = useCallback(() => {
        setTourStep(-1)
        try { localStorage.setItem('dtmmax_tour_done_v1', '1') } catch { /* saqlanmasa keyingi safar yana chiqadi */ }
    }, [])
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
    const { quota: aiQuota, refresh: refreshAiQuota } = useAiQuota({ generationLoading: loading })
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
    // Faol stream QAYSI chatga tegishli — chatId effekti faqat BOSHQA chat stream'ini bekor qilsin.
    // (Birinchi xabarda handleSend chat yaratib nav qiladi -> effekt endigina boshlangan stream'ni
    // o'ldirardi -> "salom yozsam javob kelmayapti, qayta yozish kerak" bug'i.)
    const streamChatIdRef = useRef<string | null>(null)
    const learningSessionIdRef = useRef<string | null>(null)
    const aiSessionPromiseRef = useRef<Promise<string | null> | null>(null)
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

    // Qaysi kalit uchun todoItems yuklangani — chat almashganda persist effekti eski chat
    // rejasini YANGI chat kalitiga yozib qo'ymasligi uchun guard (effektlar tartibi: persist
    // load'dan OLDIN turadi, guard'siz eski items yangi kalitga sizib o'tadi).
    const todoLoadedKeyRef = useRef(todoStorageKey)

    useEffect(() => {
        if (todoLoadedKeyRef.current !== todoStorageKey) return // bu chat rejasi hali yuklanmagan
        try {
            if (todoItems.length > 0) localStorage.setItem(todoStorageKey, JSON.stringify(todoItems))
            else localStorage.removeItem(todoStorageKey)
        } catch (err) {
            console.warn('Todo rejani saqlab bo\'lmadi:', err)
        }
    }, [todoItems, todoStorageKey])

    // Chat almashganda o'sha chatning O'Z rejasi yuklanadi (yangi chat — bo'sh boshlanadi).
    useEffect(() => {
        if (todoLoadedKeyRef.current === todoStorageKey) return
        if (todoAutoCloseRef.current) { clearTimeout(todoAutoCloseRef.current); todoAutoCloseRef.current = null }
        const stored = loadStoredTodos(todoStorageKey)
        const items = stored.length > 0 && stored.every(item => item.done) ? [] : stored
        todoLoadedKeyRef.current = todoStorageKey
        setTodoItems(items)
        setTodoOpen(typeof window !== 'undefined' && window.innerWidth >= 768 && items.some(item => !item.done))
    }, [todoStorageKey])

    // Bir martalik tozalash: eski GLOBAL (chat'siz) reja kaliti — aynan u "yangi chatda eski
    // reja chiqadi" bug'ining manbai edi. Endi reja faqat chat-kalitlarda yashaydi.
    useEffect(() => {
        try { localStorage.removeItem(`${TODO_STORAGE_PREFIX}_${user?.id || 'guest'}`) } catch { /* storage yo'q bo'lsa jim */ }
    }, [user?.id])

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
        aiSessionId, setAiSessionId,
        openTestPanel,
    } = useTestPanel(completedTestIdsRef, completedAiTestsRef)

    const {
        flashPanel, setFlashPanel, flashIdx, setFlashIdx, flashFlipped, setFlashFlipped,
        flashMaximized, setFlashMaximized, flashWidth, setFlashWidth,
        flashDragRef, flashWidthRef, openFlashPanel,
    } = useFlashPanel()

    const {
        visibleTests,
        recommendedTest,
        subjects: testSubjects,
        counts: testCatalogCounts,
        resultCount: testCatalogResultCount,
        isDone: isCatalogTestDone,
    } = useTestCatalog({
        tests: publicTests,
        results: myResults,
        completedTestIds: completedTestIdsRef.current,
        view: testCatalogView,
        subject: testSubject,
        format: testFormat,
        search: testSearch,
        sort: testSort,
        primarySubject: profile?.subject,
        secondarySubject: profile?.subject2,
    })

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
    const submitEssayRef = useRef<() => void>(() => { })
    const sidebarWidth = (() => {
        if (typeof window === 'undefined') return 252
        const w = window.innerWidth
        if (w < 768) return 280
        if (w <= 1100) return 228
        return 252
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
        pruneDtmmaxStorage() // 2.3: per-test kalitlar cheksiz o'smasin (har turdan eng yangi 50 tasi qoladi)
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
        // aks holda javob noto'g'ri chatga yozilib qoladi. abortRef null qilingani uchun
        // stream cleanup loading'ni tiklamaydi -> bu yerda O'ZIMIZ tiklaymiz (komponent remount bo'lmaydi).
        // MUHIM: faqat BOSHQA chatga tegishli stream'ni bekor qilamiz — birinchi xabarda
        // handleSend yangi chat yaratib nav qiladi va stream AYNAN shu chat uchun boshlanadi;
        // uni o'ldirsak "salom yozsam javob kelmayapti" bug'i qaytadi.
        if (abortRef.current && streamChatIdRef.current !== chatId) {
            abortRef.current.abort()
            abortRef.current = null
            setLoading(false)
            setStreaming('')
            setThinkingText('')
        }
        // Panellar suhbatga tegishli kontekst — boshqa chatga o'tilganda eski chatning
        // test/flashcard/essay paneli ochiq qolib ketmasin (reja o'z effektida almashadi).
        setTestPanel(null)
        setFlashPanel(null)
        setEssayPanel(null)
        setEssayText('')
        setEssaySubmitted(false)
        setEssayTimeLeft(null)
        setActiveTestSource(null)
        setExplanations({})
        setExplLoading(null)
        if (chatId) loadMessages(chatId)
    }, [chatId]) // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (chatId || !chatsLoaded || !profileLoaded || showOnboarding || autoLandingChatRef.current) return
        autoLandingChatRef.current = true
        // YANGI O'QUVCHI (hali chati yo'q + fani bor + onboarding tugagan) → AI shaxsiy,
        // motivatsion salom bilan boshlasin (welcome kartochkalar o'rniga). Faqat chats.length===0:
        // eski chatlari borlarga TEGMAYMIZ (aktivatsiya bug'idan xoli). Aks holда welcome kartalar.
        if (chats.length === 0 && profile?.subject) {
            void startNewUserGreeting()
        }
    }, [chatId, chatsLoaded, profileLoaded, showOnboarding, chats, profile, nav])

    // Guest test natijasini AI bilan tahlil qilish — login yoki ro'yxatdan o'tgandan keyin
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        if (!params.get('analyzeTest')) return
        // URL dan flag ni darrov olib tashlaymiz (qayta ishlamasligi uchun)
        window.history.replaceState({}, '', location.pathname)
        const raw = localStorage.getItem('dtmmax_guest_test_result')
        // analyzeTest=1 bor, lekin natija yo'q/buzilgan — jim qolmasdan xabar beramiz
        if (!raw) { toast('Test natijangiz topilmadi — testni qayta yeching yoki yangi suhbat boshlang.'); return }
        let guestData: any
        try { guestData = JSON.parse(raw) } catch { toast('Test natijasini o\'qib bo\'lmadi — qayta yeching.'); return }
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
                // Test YO'QOLMASIN: tahlil bilan birga yechilgan testning sharhini ham ko'rsatamiz
                const reviewMd = buildTestReviewMd(guestData)

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
                        const assistantContent = reviewMd ? `${reviewMd}\n\n---\n\n${analysisRes.analysis}` : analysisRes.analysis
                        nav(`/suhbat/${chatData.id}`, { state: { pendingAnalysis: { preComputed: assistantContent, displayText } } })
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

    // Vaqt tugaganda avtomatik topshirish — ref orqali stale closure oldini olamiz
    // (aks holda submitEssay eski essayText ni ko'rib, chala matn topshirilardi)
    useEffect(() => {
        if (essayTimeLeft === 0 && essayPanel && !essaySubmitted) {
            toast.error('Vaqt tugadi! Essay avtomatik topshirildi.')
            submitEssayRef.current()
        }
    }, [essayTimeLeft, essayPanel, essaySubmitted])

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
            const is403 = err?.status === 403 || err?.message?.includes('403')
            const is404 = err?.status === 404 || err?.message?.includes('404')
            // 403 — admin/o'qituvchi /suhbat'da (profil STUDENT'niki): jim o'tkazamiz, log ham yo'q
            if (!is403) console.error('loadProfile:', err)
            // Faqat 404 (profil yo'q) da onboarding ko'rsatish — network xatosida emas
            if (is404) { setObStep(1); setShowOnboarding(true) }
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
            setEditingExamInfo(false) // saqlangach read-only ko'rinishga qaytadi
            await loadProfile()
            toast.success('Profil muvaffaqiyatli saqlandi!')
            // Birinchi marta onboarding — chat ochib, AI SHAXSIY HISSIY SALOMni yozadi (DB'ga saqlanadi).
            // Avval auto-greet CHAQIRILMASDI -> yangi user bo'sh chat ko'rardi (salom yo'q). Endi chaqiramiz.
            if (!profile?.onboardingDone) {
                const firstChat = await fetchApi('/chat/new', {
                    method: 'POST',
                    body: JSON.stringify({
                        title: 'Salom!',
                        subject: onboardingForm.subject,
                        subject2: onboardingForm.subject2 || undefined
                    })
                })
                await requestAutoGreeting(firstChat.id) // AI hissiy salomni generatsiya qilib DB'ga yozadi
                await loadChats()
                nav(`/suhbat/${firstChat.id}`) // remount -> loadMessages saqlangan salomni yuklaydi
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

    // YANGI O'QUVCHI: chat yaratib, AI shaxsiy+motivatsion salom yozadi (DB'ga saqlanadi),
    // so'ng chatga o'tamiz. chatId effekti loadMessages bilan saqlangan salomni yuklaydi.
    // MUHIM: /suhbat <-> /suhbat/:id navda komponent REMOUNT bo'lmaydi (App.tsx bir xil element,
    // key yo'q) -> loading'ni O'ZIMIZ false qilishimiz shart, aks holda kompozer qotib qoladi.
    async function startNewUserGreeting() {
        setLoading(true)
        try {
            const data = await fetchApi('/chat/new', {
                method: 'POST',
                body: JSON.stringify({
                    title: 'Tayyorgarlik',
                    subject: normalizeSubjectValue(profile?.subject) || undefined,
                    subject2: normalizeSubjectValue(profile?.subject2) || undefined,
                    forceNew: true
                })
            })
            await requestAutoGreeting(data.id) // AI salomini generatsiya qilib DB'ga yozadi
            await loadChats()
            nav(`/suhbat/${data.id}`)
        } catch (e) {
            console.error('startNewUserGreeting:', e)
            autoLandingChatRef.current = false
        } finally {
            setLoading(false)
        }
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
            const nextMessages = ensureArray<Msg>(data?.messages)
            const nextChat = data?.chat && typeof data.chat === 'object' && !Array.isArray(data.chat) ? data.chat as Chat : null
            // Auto-greet O'CHIRILDI — bo'sh chatда AI salomi yozmaydi, o'rniga welcome
            // kartalari (Darajamni aniqlash, Mavzu tushuntirish ...) ko'rinadi va turadi.
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
        // Bo'sh chat allaqachon bor bo'lsa — YANGI yaratmaymiz, o'shanga o'tamiz.
        // Avval har bosishda yangi "Yangi suhbat" yaratilib, ro'yxat bo'sh chatlar bilan to'lardi.
        const existingEmpty = chats.find(c => (c.messageCount ?? 1) === 0)
        if (existingEmpty) {
            setMessages([])
            setCurrentChat(existingEmpty)
            nav(`/suhbat/${existingEmpty.id}`)
            return
        }
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
    }, [creating, profile, chats])

    const openAiTutor = useCallback(() => {
        setOverlayPanel(null)
        if (isMobile) setSideOpen(false)
        if (chatId) return
        const latestChat = chats.find(chat => (chat.messageCount ?? 0) > 0)
        if (latestChat) {
            nav(`/suhbat/${latestChat.id}`)
            return
        }
        void createChat()
    }, [chatId, chats, createChat, isMobile, nav])

    // Stream helper — displayText ixtiyoriy: chatda ko'rinadigan matn (prompt AI ga yuboriladi)
    async function streamToChat(targetChatId: string, prompt: string, displayText?: string): Promise<boolean> {
        const shown = displayText !== undefined ? displayText : prompt
        setLoading(true); setStreaming(''); setThinkingText('')
        if (abortRef.current) {
            abortRef.current.abort()
        }
        const controller = new AbortController()
        abortRef.current = controller
        streamChatIdRef.current = targetChatId // bu stream qaysi chatga tegishli (effekt guard'i uchun)
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
                body: JSON.stringify({
                    content: prompt,
                    thinking: requestThinkingMode,
                    learningSessionId: learningSessionIdRef.current || undefined,
                    ...(displayText !== undefined && { displayText }),
                    todoContext: requestTodoContext,
                }),
                signal: controller.signal
            })
            if (!res.ok) {
                let msg = 'AI javob bera olmadi. Qayta urinib ko\'ring.'
                try { const j = await res.json(); if (j?.error) msg = j.error } catch { }
                throw new Error(msg)
            }
            const reader = res.body?.getReader()
            const decoder = new TextDecoder()
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
                    if (Object.prototype.hasOwnProperty.call(d, 'learningSessionId')) {
                        learningSessionIdRef.current = typeof d.learningSessionId === 'string' ? d.learningSessionId : null
                    }
                    if (d.thinkingActive === true && isCurrentChat()) setThinkingText('active')
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
                                    setTimeout(() => { handleOpenTest(testMatch[1].trim()) }, 400)
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
                    let terminalHandled = false // done/error frame ishlangach — oxirgi flush'ni qayta ishlamaslik uchun
                    while (true) {
                        const { done, value } = await reader.read()
                        if (done) break
                        const chunk = decoder.decode(value, { stream: true })
                        sseBuf += chunk
                        const lines = sseBuf.split('\n')
                        sseBuf = lines.pop() ?? '' // oxirgi (tugallanmagan) bo'lakni keyingi o'qishga qoldiramiz
                        for (const line of lines) {
                            const stop = await handleLine(line)
                            if (stop) { terminalHandled = true; try { await reader.cancel() } catch { } break }
                        }
                        if (streamErrored) break
                    }
                    // Oqim tugadi — bufferda qolgan tugallanmagan frame bo'lsa, oxirgi marta flush qilamiz
                    if (!streamErrored && !terminalHandled && sseBuf.startsWith('data: ')) {
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
        // FAQAT abort qilamiz — abortRef.current'ni NULL QILMAYMIZ.
        // Stream cleanup `if (abortRef.current === controller)` orqali loading'ni false qiladi;
        // bu yerda null qilsak, o'sha shart buzilib loading=true qotib qoladi (stop ishlamagandek ko'rinadi).
        abortRef.current?.abort()
    }

    // Paste/rasm yuklash uchun: chatId yo'q bo'lsa (welcome/yangi suhbat) chat yaratib id qaytaradi.
    // Bu bo'lmasa paste jim ishlamasdi — foydalanuvchi screenshot yubora olmasdi.
    const ensureChatForUpload = useCallback(async (): Promise<string | null> => {
        if (chatId) return chatId
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
            pendingHydrationChatIdRef.current = data.id
            setCurrentChat(data)
            nav(`/suhbat/${data.id}`)
            return data.id
        } catch (err) {
            console.error('ensureChatForUpload:', err)
            return null
        }
    }, [chatId, profile?.subject, profile?.subject2]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleSend = useCallback(async (text: string, files: AttachedFile[]) => {
        if (loading) return
        if (aiQuota && !aiQuota.unlimited && aiQuota.chat.used >= aiQuota.chat.limit) {
            toast("Bugungi AI limiti tugadi — tayyor testlarni limitsiz yechishingiz mumkin", { icon: '⚡' })
            setOverlayPanel('tests')
            markTestsSeen()
            void loadPublicTests()
            void loadMyResults()
            return false
        }

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
                toast.error("Xabar yuborilmadi — internetni tekshirib qayta urinib ko'ring")
                return false // handleSubmit yozilgan matnni qaytaradi (yo'qolmaydi)
            }
        }

        if (files.length > 0) {
            let promptText = ''
            let displayText = ''
            files.forEach(file => {
                promptText += `📎 **${file.name}** faylidan:\n\n${file.text}\n\n`
                // Rasm bo'lsa — chat xabarida RASMNING O'ZI ko'rinadi (markdown img, bubble render qiladi).
                // URL bo'lmasa (S3 xato) eski matn formatiga tushamiz.
                displayText += file.type === 'image' && file.url
                    ? `![${file.name}](${file.url}) `
                    : `📎 ${file.type === 'image' ? 'Rasm' : 'Fayl'}: ${file.name} ` // user bubble oddiy matn — ** ko'rsatmaydi
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
    }, [aiQuota, chatId, loading, profile])

    // Paylov hosted checkout orqali Pro to'lovini boshlash.
    // Karta va OTP DTMMax frontend/backend'iga kirmaydi.
    async function startProCheckout() {
        if (checkoutLoading) return
        setCheckoutLoading(true)
        try {
            const data = await fetchApi('/billing/checkout', { method: 'POST', silent: true })
            if (data?.payUrl) {
                window.location.href = data.payUrl // Octo to'lov sahifasiga
                return
            }
            toast.error("To'lov boshlanmadi — qayta urinib ko'ring")
        } catch (e: any) {
            if (e?.status === 503) {
                // billing_disabled_beta — enforcement o'chiq: hamma Pro bepul, to'lov OLINMAYDI (fail-closed).
                // Foydalanuvchini "xato" bilan qo'rqitmasdan halol holatni aytamiz.
                if (e?.data?.error === 'billing_disabled_beta') toast.success("Beta davrida barcha imkoniyatlar bepul — hozircha to'lovga hojat yo'q 🎉")
                else toast.error("To'lov tizimi hali to'liq sozlanmagan (Paylov sozlamalari)")
            }
            else toast.error(e?.message || "To'lov boshlanmadi — qayta urinib ko'ring")
        }
        setCheckoutLoading(false)
    }

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
        aiSessionPromiseRef.current = null
        setTodoOpen(false)
        // AI chat testi efemer (DB da yo'q). Eski public test id'sini tozalamasak,
        // submit xato qilib /tests/{eskiId}/submit ga ketib "Test sessiyasi topilmadi" (403)
        // beradi. Shu sababli AI test ochishdan oldin activeTestId/savollarni tozalaymiz.
        setActiveTestId(null)
        setActiveTestQuestions([])
        setActiveTestSource(null) // AI chat testi — manba badge'i yo'q
        openTestPanel(jsonStr)
        // 1.1: efemer AI testni SERVERда ro'yxatga olamiz — submit server-grade bo'lsin (klient
        // ballni soxtalashtira olmaydi). Xato bo'lsa jim o'tamiz: submitTestPanel eski /submit-ai'ga
        // fallback qiladi (uzilish yo'q).
        try {
            const parsedForSession = parseStructuredJson<unknown[]>(extractStructuredPayload(jsonStr))
            if (Array.isArray(parsedForSession) && parsedForSession.length > 0) {
                const subjectHint = profileRef.current?.subject || undefined
                aiSessionPromiseRef.current = fetchApi('/tests/ai-session', {
                    method: 'POST',
                    body: JSON.stringify({
                        questions: parsedForSession,
                        subject: subjectHint,
                        chatId: chatIdRef.current,
                        learningSessionId: learningSessionIdRef.current || undefined,
                    }),
                    silent: true,
                }).then((r: { sessionId?: string; learningSessionId?: string | null }) => {
                    const sessionId = r?.sessionId || null
                    if (sessionId) setAiSessionId(sessionId)
                    if (typeof r?.learningSessionId === 'string') learningSessionIdRef.current = r.learningSessionId
                    return sessionId
                }).catch(() => null)
            }
        } catch { /* parse xato — fallback */ }
    }, [openTestPanel, setActiveTestId, setActiveTestQuestions, setAiSessionId])

    // Flashcard panelni ochish
    const handleOpenFlash = useCallback((jsonStr: string) => {
        const cards = parseStructuredJson<Array<{ front?: string; back?: string }>>(jsonStr)
        if (!Array.isArray(cards) || cards.length === 0) return
        setTestPanel(null) // testni yopamiz
        setTodoOpen(false) // todoni yopamiz
        openFlashPanel(jsonStr)
        setFlashIsReview(false) // AI chatdan kelgan — review rejimi emas
        // DB ga saqlaymiz — Kartochkalar tabida ko'rinishi uchun (background).
        // 2.2: BIR to'plam BIR marta POST bo'ladi — har qayta ochilishda dublikat DB qator yaratilmasin.
        const subj = profileRef.current?.subject || 'Umumiy'
        const normalizedCards = cards.map((c) => ({ front: String(c.front || ''), back: String(c.back || '') }))
        const flashSig = stableHash(subj + '|' + JSON.stringify(normalizedCards))
        let postedSigs: string[] = []
        try {
            const parsed = JSON.parse(localStorage.getItem('dtmmax_flash_posted_v1') || '[]')
            if (Array.isArray(parsed)) postedSigs = parsed.filter((s): s is string => typeof s === 'string')
        } catch { /* buzilgan yozuv — bo'sh ro'yxatdan davom etamiz */ }
        if (postedSigs.includes(flashSig)) return
        fetchApi('/flashcards', {
            method: 'POST',
            body: JSON.stringify({ subject: subj, cards: normalizedCards })
        }).then(() => {
            // Faqat MUVAFFAQIYATLI POST belgilanadi — xatoda keyingi ochilishda qayta uriniladi
            try { localStorage.setItem('dtmmax_flash_posted_v1', JSON.stringify([flashSig, ...postedSigs].slice(0, 100))) } catch { }
            loadDueFlashcards()
        }).catch((err: unknown) => { console.error('saveFlashcards:', err) })
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
                    done: Boolean(existing?.done),
                    // Reja sanasi — "Bugungi reja" real sanaga tayanadi
                    createdAt: existing?.createdAt || Date.now()
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

    // Har render da ref ni yangilaymiz — auto-submit doim joriy essayText ni ko'rsin
    submitEssayRef.current = () => { void submitEssay() }

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
                    q: getStudentQuestionText(q),
                    imageUrl: q.imageUrl || null,
                    questionType: q.questionType || 'mcq',
                    a: opts[0] || '', b: opts[1] || '', c: opts[2] || '', d: opts[3] || '',
                    // FAZA 3: variant rasmlari (by-link'dan signed URL massivi, indeks = variant)
                    optionImages: Array.isArray(q.optionImages) ? q.optionImages : undefined,
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

    // Yangi test ochilganda eski tushuntirishlarni tozalaymiz (indeks bo'yicha aralashmasin)
    useEffect(() => {
        setExplanations({})
        setExplLoading(null)
        setTestQuestionIndex(0)
    }, [testPanel])

    // Xato javob uchun AI tushuntirishini olib, panel ichida ko'rsatamiz
    async function explainQuestion(i: number, q: any) {
        if (explLoading !== null || explanations[i]) return
        setExplLoading(i)
        try {
            const data = await fetchApi('/tests/explain', {
                method: 'POST',
                body: JSON.stringify({
                    question: q.q, a: q.a, b: q.b, c: q.c, d: q.d,
                    studentAnswer: testAnswers[i] || '', correctAnswer: q.correct,
                    subject: profile?.subject || ''
                })
            })
            if (data?.explanation) setExplanations(prev => ({ ...prev, [i]: data.explanation }))
            else toast.error('Tushuntirib bo\'lmadi, qayta urinib ko\'ring')
        } catch {
            toast.error('Tushuntirib bo\'lmadi, qayta urinib ko\'ring')
        } finally {
            setExplLoading(null)
        }
    }

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

                // Yozma javob AI texnik xato sabab tekshirilmagan bo'lsa — yashirmaymiz
                if (typeof backendSubmitResult?.unverifiedOpenCount === 'number' && backendSubmitResult.unverifiedOpenCount > 0) {
                    toast(`${backendSubmitResult.unverifiedOpenCount} ta yozma javob texnik sabab AI bilan tekshirilmadi va "xato" deb hisoblandi. Keyinroq qayta topshirib ko'ring.`, { duration: 8000 })
                }

                if (backendSubmitResult?.newAbility !== undefined) {
                    const prevAbility = profile?.abilityLevel ?? 0
                    setRaschFeedback({ prev: prevAbility, next: backendSubmitResult.newAbility })
                    loadProfile()
                    loadMyResults()
                }
                if (backendSubmitResult?.correctAnswers) {
                    const correctMap: Record<string, number> = {}
                    const solutionImages: Record<string, string> = {} // FAZA 3: yechim rasmlari (signed URL)
                    backendSubmitResult.correctAnswers.forEach((c: any) => {
                        correctMap[c.id] = c.correctIdx
                        if (typeof c.solutionImageUrl === 'string' && c.solutionImageUrl) solutionImages[c.id] = c.solutionImageUrl
                    })
                    saveScopedItem('dtmmax_correct_' + activeTestId, JSON.stringify(correctMap))
                    saveScopedItem('dtmmax_pub_ans_' + activeTestId, JSON.stringify(testAnswers))
                    questions = questions.map((q: any) => {
                        const ci = correctMap[q.id]
                        const withSolution = solutionImages[q.id] ? { solutionImage: solutionImages[q.id] } : {}
                        return ci !== undefined ? { ...q, ...withSolution, correct: (['a', 'b', 'c', 'd'] as const)[ci] ?? '' } : { ...q, ...withSolution }
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
        let resolvedAiSessionId = aiSessionId
        if (!activeTestId && !resolvedAiSessionId && aiSessionPromiseRef.current) {
            resolvedAiSessionId = await aiSessionPromiseRef.current
        }
        if (!activeTestId && learningSessionIdRef.current && !resolvedAiSessionId) {
            toast.error('Checkpoint sessiyasi tayyor bo‘lmadi. Testni yopib, qayta oching.')
            isSubmittingRef.current = false
            return
        }
        if (!activeTestId && resolvedAiSessionId) {
            const answerLetters: Record<number, string> = {}
            questions.forEach((_question: any, index: number) => {
                if (testAnswers[index]) answerLetters[index] = testAnswers[index]
            })
            try {
                backendSubmitResult = await fetchApi(`/tests/ai-session/${resolvedAiSessionId}/submit`, {
                    method: 'POST',
                    body: JSON.stringify({ answers: answerLetters }),
                })
                backendSubmitHandled = true
            } catch (err: any) {
                if (learningSessionIdRef.current) {
                    toast.error(err?.message || 'Checkpoint natijasini saqlab bo‘lmadi. Qayta urinib ko‘ring.')
                    isSubmittingRef.current = false
                    return
                }
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
        // Mukofot lahzasi — natija qanchalik yaxshi bo'lsa, bayram shunchalik katta
        celebrate(totalQuestionsForScore > 0 ? score / totalQuestionsForScore : 0)

        // Mavzu statistikasini yangilash + XP. TopicStat endi per-MAVZU yoziladi:
        // saqlangan test → backend /submit; efemer AI test → /submit-ai (pastda, q.topic bilan).
        // Eski "chat sarlavha bucket" olib tashlandi (ma'nosiz + ikki marta sanardi).
        loadProgress()
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
                const aiKey = stableHash(testPanel) // 2.1: butun JSON ustidan barqaror hash-kalit
                saveScopedItem('dtmmax_ans_' + aiKey, JSON.stringify(testAnswers))
                // 1.1: SERVER-GRADE. Sessiya ro'yxatga olingan bo'lsa (aiSessionId), FAQAT javob
                // harflarini yuboramiz — server o'zi baholaydi (klient ballni soxtalashtira olmaydi).
                // Ro'yxatga olinmagan/xato bo'lsa eski /submit-ai'ga fallback (statistika yoziladi).
                const serverGraded = backendSubmitHandled
                if (!serverGraded) {
                    const scorePercent = (score / questions.length) * 100
                    const raschResults = questions.map((q: any, i: number) => {
                        const fallbackDifficulty = questions.length > 1
                            ? -2 + (i / (questions.length - 1)) * 4
                            : 0
                        return {
                            difficulty: typeof q.difficulty === 'number' && Number.isFinite(q.difficulty)
                                ? q.difficulty
                                : Math.round(fallbackDifficulty * 100) / 100,
                            isCorrect: testAnswers[i] === q.correct,
                            topic: typeof q.topic === 'string' ? q.topic : '' // yopiq halqa: per-mavzu TopicStat
                        }
                    })
                    await fetchApi('/tests/submit-ai', {
                        method: 'POST',
                        body: JSON.stringify({ score: scorePercent, totalQuestions: questions.length, results: raschResults, subject: currentChat?.subject || currentChat?.subject2 || profile?.subject || 'Umumiy' })
                    })
                }
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
    // Chat kartasi tugallangan AI testni bilishi uchun — useTestPanel bilan BIR XIL kalit mantiq
    const isAiTestDone = useCallback((jsonStr: string) => {
        try {
            const normalized = extractStructuredPayload(jsonStr)
            const parsed = parseStructuredJson<unknown[]>(normalized)
            if (!Array.isArray(parsed) || parsed.length === 0) return false
            const stableJson = JSON.stringify(parsed)
            // 2.1: yangi hash-kalit + eski 500-belgili kalit (tarix saqlansin)
            return completedAiTestsRef.current.has(stableHash(stableJson))
                || completedAiTestsRef.current.has(legacyTestKey(stableJson))
        } catch { return false }
    }, [])

    const chatContextValue = useMemo(() => ({
        onOpenTest: handleOpenTest,
        onProfileUpdate: handleProfileUpdate,
        onOpenFlash: handleOpenFlash,
        onOpenEssay: handleOpenEssay,
        onSetTodo: handleSetTodo,
        onMarkTodoDoneByTask: markTodoDoneByTask,
        isAiTestDone,
    }), [handleOpenTest, handleProfileUpdate, handleOpenFlash, handleOpenEssay, handleSetTodo, markTodoDoneByTask, isAiTestDone])

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
    const OB_TOTAL_STEPS = 3
    const obIsLastStep = obStep === OB_TOTAL_STEPS
    // Har bir qadam "Davom etish"ni qachon ochishini belgilaydi
    const obStepValid =
        obStep === 1 ? onboardingForm.examType !== '' :
        obStep === 2 ? (onboardingForm.examType === 'DTM' ? (!!onboardingForm.subject && !!onboardingForm.subject2) : !!onboardingForm.subject) :
        obStep === 3 ? !obScoreErr :
        true

    // Onboarding — suhbat uslubidagi, bitta-savol-bir-ekran (editorial)
    if (showOnboarding) {
        const obQuestion =
            obStep === 1 ? `${user?.name ? `Salom, ${user.name}! ` : 'Avval tanishaylik. '}Qaysi imtihonga tayyorlanyapsiz?`
                : obStep === 2 ? (onboardingForm.examType === 'DTM' ? "Zo'r! Qaysi 2 fandan tayyorlanasiz?" : "Zo'r! Qaysi fandan tayyorlanasiz?")
                    : "Maqsadingiz — necha ball?"
        const obHint =
            obStep === 1 ? 'Shu asosda AI ustozingiz sizga moslashadi.'
                : obStep === 3 ? `Ixtiyoriy — ${obScoreBounds.min}–${obScoreBounds.max} oralig'ida.`
                    : ''
        return (
            <div className="kelviq student-workspace flex items-center justify-center p-5" style={{ minHeight: '100dvh' }}>
                <div className="w-full max-w-md">
                    {/* Suhbat: avatar + savol pufakchasi */}
                    <div className="flex items-start gap-3 mb-6">
                        <img src="/dtmmax-logo.png" alt="DtmMax" className="h-12 w-12 rounded-2xl flex-shrink-0" style={{ objectFit: 'contain', background: 'var(--bg-card)', boxShadow: 'var(--k-shadow-card)' }} />
                        <div key={`q-${obStep}`} className="anim-up card" style={{ padding: '15px 19px', borderRadius: '12px' }}>
                            <p style={{ fontSize: '21px', fontWeight: 600, lineHeight: 1.28, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{obQuestion}</p>
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

                            {/* Step 2 — Fan(lar): DTM uchun 2 MUSTAQIL fan (juft emas), MS uchun 1 fan */}
                            {obStep === 2 && (
                                onboardingForm.examType === 'DTM' ? (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-muted)' }}>1-fan</label>
                                            <select value={onboardingForm.subject} onChange={e => setOnboardingForm(prev => ({ ...prev, subject: e.target.value }))} className="input" style={{ cursor: 'pointer', height: 52 }}>
                                                <option value="">— Tanlang —</option>
                                                {SUBJECTS.map(f => <option key={f} value={f}>{f}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-muted)' }}>2-fan</label>
                                            <select value={onboardingForm.subject2} onChange={e => setOnboardingForm(prev => ({ ...prev, subject2: e.target.value }))} className="input" style={{ cursor: 'pointer', height: 52 }}>
                                                <option value="">— Tanlang —</option>
                                                {SUBJECTS.filter(f => f !== onboardingForm.subject).map(f => <option key={f} value={f}>{f}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                ) : (
                                    <select value={onboardingForm.subject} onChange={e => setOnboardingForm(prev => ({ ...prev, subject: e.target.value }))} className="input" style={{ cursor: 'pointer', height: 52 }}>
                                        {SUBJECTS.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                )
                            )}

                            {/* Step 3 — Maqsad ball (imtihon sanasi olib tashlandi) */}
                            {obStep === 3 && (
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
                            // Ball ixtiyoriy — "O'tkazib yuborish" onboardingni YAKUNLAYDI (oldin setObStep(4) dead-end edi)
                            <button type="submit" disabled={savingProfile} className="btn btn-ghost" style={{ width: '100%' }}>O'tkazib yuborish</button>
                        )}
                    </form>
                </div>
            </div>
        )
    }

    // Mobil pastki tab-bar faqat "ko'rish" kontekstlarida chiqadi — test/insho/kartochka/reja
    // kabi fokusli ish panellari ochiq bo'lsa yashirinadi (chalg'itmasin, layout ham buzilmasin)
    const mobileTabBarVisible = isMobile && !testPanel && !essayPanel && !flashPanel && !todoOpen
    const MOBILE_TABBAR_PAD = 'calc(62px + env(safe-area-inset-bottom))'

    return (
        <ChatContext.Provider value={chatContextValue}>
            <div className="kelviq student-workspace min-h-[100dvh] h-[100dvh] flex overflow-hidden relative">
                {/* Mobile backdrop */}
                {sideOpen && isMobile && (
                    <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSideOpen(false)} />
                )}
                {/* Sidebar */}
                <div
                    style={{
                        width: sideOpen ? (isMobile ? '280px' : `${sidebarWidth}px`) : '0px',
                        minWidth: sideOpen ? (isMobile ? '280px' : `${sidebarWidth}px`) : '0px',
                        ...(isMobile && sideOpen ? { position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50, paddingBottom: mobileTabBarVisible ? MOBILE_TABBAR_PAD : undefined } : {})
                    }}
                    className="student-focus-rail flex flex-col transition-all duration-200 overflow-hidden flex-shrink-0 relative"
                >
                    <div className="student-focus-rail__brand p-3 flex items-center justify-between h-14 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <img src="/dtmmax-logo.png" alt="DtmMax" className="h-11 w-11 rounded-lg flex items-center justify-center" style={{ objectFit: 'contain' }} />
                            <span className="text-sm font-bold whitespace-nowrap">DTMMax</span>
                        </div>
                        <button type="button" onClick={() => setSideOpen(false)} className="student-icon-button h-8 w-8 flex items-center justify-center" aria-label="Yon panelni yopish"><X className="h-4 w-4" /></button>
                    </div>

                    {/* Asosiy o'qish navigatsiyasi */}
                    <nav className="student-primary-nav px-2 pt-3 pb-3 flex-shrink-0" aria-label="Asosiy bo‘limlar">
                        <button type="button" onClick={() => { setOverlayPanel(null); if (isMobile) setSideOpen(false); nav('/bugun') }}
                            className={`student-primary-nav__item${isTodayView && !overlayPanel ? ' is-active' : ''}`}
                            aria-current={isTodayView && !overlayPanel ? 'page' : undefined}>
                            <House className="h-4 w-4 flex-shrink-0" /> Bugun
                        </button>
                        <button type="button" onClick={() => { setOverlayPanel(overlayPanel === 'flashcards' ? null : 'flashcards'); if (isMobile) setSideOpen(false) }}
                            className={`student-primary-nav__item${overlayPanel === 'flashcards' ? ' is-active' : ''}`}
                            aria-pressed={overlayPanel === 'flashcards'}>
                            <BookOpen className="h-4 w-4 flex-shrink-0" /> O‘rganish
                            {dueFlashcards.length > 0 && <span className="student-nav-count">{dueFlashcards.length > 9 ? '9+' : dueFlashcards.length}</span>}
                        </button>
                        <button type="button" onClick={() => { setOverlayPanel(overlayPanel === 'tests' ? null : 'tests'); if (isMobile) setSideOpen(false); markTestsSeen(); if (overlayPanel !== 'tests') { void loadPublicTests(); void loadMyResults() } }}
                            className={`student-primary-nav__item${overlayPanel === 'tests' ? ' is-active' : ''}`}
                            aria-pressed={overlayPanel === 'tests'}>
                            <ClipboardList className="h-4 w-4 flex-shrink-0" />
                            Testlar
                            {newTestIds.size > 0 && <span className="student-nav-count is-alert">{newTestIds.size > 9 ? '9+' : newTestIds.size}</span>}
                        </button>
                        <button type="button" onClick={openAiTutor}
                            className={`student-primary-nav__item${chatId && !overlayPanel ? ' is-active' : ''}`}
                            aria-current={chatId && !overlayPanel ? 'page' : undefined}>
                            <MessageSquare className="h-4 w-4 flex-shrink-0" /> AI ustoz
                        </button>
                        <button type="button" onClick={() => { setOverlayPanel(overlayPanel === 'progress' ? null : 'progress'); if (isMobile) setSideOpen(false) }}
                            className={`student-primary-nav__item${overlayPanel === 'progress' ? ' is-active' : ''}`}
                            aria-pressed={overlayPanel === 'progress'}>
                            <TrendingUp className="h-4 w-4 flex-shrink-0" /> Progress
                        </button>
                    </nav>

                    <div className="student-focus-rail__divider" />

                    {/* Chat list — doim ko'rinadi */}
                    {true && (
                        <div className="student-chat-history flex-1 overflow-y-auto px-2 py-2" style={{ scrollbarWidth: 'thin' }}>
                            <div className="student-chat-history__header">
                                <span>Suhbatlar</span>
                                <button type="button" onClick={createChat} disabled={creating} aria-label="Yangi suhbat" title="Yangi suhbat">
                                    <Plus className="h-3.5 w-3.5" />
                                </button>
                            </div>
                            {chats.length === 0 ? (
                                <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>Hali suhbatlar yo'q</p>
                            ) : groupChatsByDate(
                                // Bo'sh chatlar ro'yxatni ifloslamasin — faqat xabari borlar
                                // (hozir ochiq turgani istisno: foydalanuvchi adashmasin)
                                chats.filter(c => (c.messageCount ?? 1) > 0 || c.id === chatId)
                            ).map(({ label, items }) => (
                                <div key={label} className="mb-3">
                                    <p className="text-[11px] font-medium px-3 mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
                                    {items.map(c => (
                                        <div key={c.id}
                                            className="group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer text-[13px] transition-colors"
                                            style={chatId === c.id ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' } : { color: 'var(--text-secondary)' }}
                                            onMouseEnter={e => { if (chatId !== c.id) e.currentTarget.style.background = 'var(--bg-muted)' }}
                                            onMouseLeave={e => { if (chatId !== c.id) e.currentTarget.style.background = 'transparent' }}
                                            title={cleanChatTitle(c.title)}>
                                            <button type="button" onClick={() => nav(`/suhbat/${c.id}`)} aria-current={chatId === c.id ? 'page' : undefined}
                                                className="flex-1 min-w-0 truncate text-left rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]">
                                                {cleanChatTitle(c.title)}
                                            </button>
                                            <button onClick={(e) => deleteChat(c.id, e)} aria-label={`"${cleanChatTitle(c.title)}" suhbatini o'chirish`} className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded transition flex-shrink-0" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}><Trash2 className="h-3 w-3" /></button>
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
                            <div className="card" style={{ width: '100%', maxWidth: '560px', maxHeight: 'min(620px, calc(100dvh - 32px))', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '12px' }}>
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
                            <div className="card" style={{ width: '100%', maxWidth: '560px', maxHeight: 'calc(100dvh - 32px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '12px' }}>
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
                                        {/* 6.4: AI imkoniyatlari ro'yxati — har biri bir bosishda sinovga yuboriladi */}
                                        <section className="pt-7 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
                                            <p className="k-eyebrow">AI nima qila oladi?</p>
                                            {[
                                                { l: 'Interaktiv test tuzadi va baholaydi', p: "Menga o'z fanimdan 10 talik qisqa test tuz." },
                                                { l: 'Mavzuni misollar bilan tushuntiradi', p: 'Menga bitta qiyin mavzuni misollar bilan tushuntir — qaysi mavzu kerakligini avval so\'ra.' },
                                                { l: 'Flashcard (yodlash kartochkalari) yasaydi', p: 'Eng muhim tushunchalardan 10 ta flashcard yasa.' },
                                                { l: 'Kunlik o\'quv reja tuzadi', p: 'Menga bugun uchun qisqa o\'quv reja tuz.' },
                                                { l: 'Insho/Writing\'ni mezonlar bo\'yicha baholaydi', p: 'Menga Writing topshirig\'ini ber — yozib topshiraman, baholaysan.' },
                                                { l: 'Rasm yuborsangiz — masalani o\'qib yechadi', p: 'Rasmdan masala yubormoqchiman — qanday yuborishni ko\'rsat.' },
                                            ].map((cap, i) => (
                                                <div key={i} className="flex items-center gap-2 py-1">
                                                    <p className="text-[12.5px] flex-1" style={{ color: 'var(--text-secondary)' }}>{cap.l}</p>
                                                    <button type="button"
                                                        onClick={() => { setShowSettings(false); void handleSend(cap.p, []) }}
                                                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition flex-shrink-0"
                                                        style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>
                                                        Sinash
                                                    </button>
                                                </div>
                                            ))}
                                        </section>
                                        <section className="pt-7 space-y-4" style={{ borderTop: '1px solid var(--border)' }}>
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="k-eyebrow">Imtihon ma'lumotlari</p>
                                                {!editingExamInfo && (
                                                    <button type="button" onClick={() => setEditingExamInfo(true)}
                                                        className="h-7 w-7 flex items-center justify-center rounded-lg transition flex-shrink-0"
                                                        style={{ color: 'var(--text-muted)' }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-muted)'; e.currentTarget.style.color = 'var(--brand)' }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
                                                        title="Tahrirlash">
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>

                                            {/* READ-ONLY ko'rinish — ma'lumotlar tinch ro'yxatda, tahrirlash qalamcha ortida */}
                                            {!editingExamInfo ? (
                                                <div className="rounded-xl divide-y" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderColor: 'var(--border)' }}>
                                                    {[
                                                        { icon: GraduationCap, label: 'Imtihon turi', value: onboardingForm.examType === 'MS' ? 'Milliy Sertifikat' : onboardingForm.examType === 'DTM' ? 'DTM' : '—' },
                                                        { icon: BookOpen, label: onboardingForm.examType === 'DTM' ? 'Fanlar' : 'Asosiy fan', value: [onboardingForm.subject, onboardingForm.examType === 'DTM' ? onboardingForm.subject2 : ''].filter(Boolean).join(' · ') || '—' },
                                                        { icon: Calendar, label: 'Imtihon sanasi', value: onboardingForm.examDate || '—' },
                                                        { icon: Target, label: 'Maqsad ball', value: onboardingForm.targetScore === '' ? '—' : String(onboardingForm.targetScore) },
                                                    ].map((row, i) => (
                                                        <div key={i} className="flex items-center gap-3 px-3.5 py-2.5" style={{ borderColor: 'var(--border)' }}>
                                                            <row.icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                                                            <span className="text-[12px] flex-1" style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                                                            <span className="text-[13px] font-semibold text-right" style={{ color: 'var(--text-primary)' }}>{row.value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (<>
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
                                                <div className="space-y-2.5">
                                                    <div>
                                                        <label className="text-xs font-medium flex items-center gap-2 mb-1" style={{ color: 'var(--text-muted)' }}>
                                                            <BookOpen className="h-3.5 w-3.5" /> 1-fan
                                                        </label>
                                                        <select value={onboardingForm.subject} onChange={e => setOnboardingForm(f => ({ ...f, subject: e.target.value }))} className="input text-sm h-10" style={{ cursor: 'pointer' }}>
                                                            <option value="">— Tanlang —</option>
                                                            {SUBJECTS.map(f => <option key={f} value={f}>{f}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-medium flex items-center gap-2 mb-1" style={{ color: 'var(--text-muted)' }}>
                                                            <BookOpen className="h-3.5 w-3.5" /> 2-fan
                                                        </label>
                                                        <select value={onboardingForm.subject2} onChange={e => setOnboardingForm(f => ({ ...f, subject2: e.target.value }))} className="input text-sm h-10" style={{ cursor: 'pointer' }}>
                                                            <option value="">— Tanlang —</option>
                                                            {SUBJECTS.filter(f => f !== onboardingForm.subject).map(f => <option key={f} value={f}>{f}</option>)}
                                                        </select>
                                                    </div>
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
                                            </>)}
                                        </section>


                                        {/* ── Footer: tahrirlashda Saqlash+Bekor; aks holda faqat Chiqish ── */}
                                        <div className="pt-7 flex flex-col sm:flex-row gap-3" style={{ borderTop: '1px solid var(--border)' }}>
                                            {editingExamInfo ? (
                                                <>
                                                    <button type="submit" disabled={savingProfile || !!obScoreErr} className="btn btn-primary h-10 text-sm px-5 flex-1">
                                                        {savingProfile ? 'Saqlanmoqda...' : 'Saqlash'}
                                                    </button>
                                                    <button type="button" onClick={() => { setEditingExamInfo(false); void loadProfile() }} className="btn btn-outline h-10 text-sm px-5 flex-1">
                                                        Bekor qilish
                                                    </button>
                                                </>
                                            ) : (
                                                <button type="button" onClick={() => { setShowSettings(false); localStorage.removeItem(essayDraftKey); logout() }} className="btn btn-outline h-10 text-sm px-5 flex-1">
                                                    Chiqish
                                                </button>
                                            )}
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
                                                    {user?.passwordConfigured === false ? 'Parol yaratish' : 'Parolni o\'zgartirish'}
                                                </p>
                                                {user?.passwordConfigured === false && (
                                                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                        Siz Google orqali kirgansiz. Parol yaratsangiz email va parol bilan ham kira olasiz.
                                                    </p>
                                                )}
                                                {changePwOk && <div className="text-sm px-3 py-2 rounded-lg" style={{ background: '#D1FAE5', color: '#065F46' }}>Parol muvaffaqiyatli yangilandi!</div>}
                                                {changePwErr && <div className="text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>{changePwErr}</div>}
                                                {user?.passwordConfigured !== false && (
                                                    <input type="password" placeholder="Joriy parol" value={changePwForm.current} onChange={e => setChangePwForm(f => ({ ...f, current: e.target.value }))} className="input text-sm h-9" />
                                                )}
                                                <input type="password" placeholder="Yangi parol (kamida 8 belgi)" value={changePwForm.newPw} onChange={e => setChangePwForm(f => ({ ...f, newPw: e.target.value }))} className="input text-sm h-9" />
                                                <input type="password" placeholder="Yangi parolni tasdiqlang" value={changePwForm.confirm} onChange={e => setChangePwForm(f => ({ ...f, confirm: e.target.value }))} className="input text-sm h-9" />
                                                <button disabled={changePwLoading || (user?.passwordConfigured !== false && !changePwForm.current) || !changePwForm.newPw || !changePwForm.confirm}
                                                    onClick={async () => {
                                                        setChangePwErr(''); setChangePwOk(false)
                                                        if (changePwForm.newPw !== changePwForm.confirm) { setChangePwErr('Yangi parollar mos kelmadi'); return }
                                                        setChangePwLoading(true)
                                                        try {
                                                            await fetchApi('/auth/change-password', { method: 'PUT', body: JSON.stringify({ currentPassword: changePwForm.current, newPassword: changePwForm.newPw }) })
                                                            setChangePwForm({ current: '', newPw: '', confirm: '' })
                                                            clearSession()
                                                            nav('/kirish?reason=password-changed', { replace: true })
                                                        } catch (e: any) { setChangePwErr(e.message || 'Xatolik yuz berdi') }
                                                        setChangePwLoading(false)
                                                    }}
                                                    className="btn btn-outline h-9 text-sm px-5 disabled:opacity-40">{changePwLoading ? 'Saqlanmoqda...' : user?.passwordConfigured === false ? 'Parol yaratish' : 'Parolni yangilash'}</button>
                                            </div>
                                            <div className="rounded-xl p-4 space-y-2" style={{ border: '1px solid var(--danger-light)' }}>
                                                <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>Xavfli zona</p>
                                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Akkauntni o'chirsangiz barcha ma'lumotlar butunlay yo'qoladi.</p>
                                                <button onClick={() => { setShowDeleteModal(true); setDeleteErr(''); setDeletePassword('') }}
                                                    disabled={user?.passwordConfigured === false}
                                                    className="h-9 flex items-center gap-2 text-sm font-medium rounded-lg px-4 transition"
                                                    style={{ color: 'var(--danger)', border: '1px solid var(--danger)', background: 'transparent', opacity: user?.passwordConfigured === false ? 0.5 : 1 }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-light)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                    {user?.passwordConfigured === false ? 'Avval parol yarating' : 'Akkauntni o\'chirish'}
                                                </button>
                                            </div>
                                        </div>
                                    </details>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* User footer.
                        Streak vidjeti bu yerdan OLIB TASHLANDI — "Bugun" ekranidagi streak chipini
                        aynan takrorlardi (egasi: keraksiz takror bo'lmasin). */}
                    <div className="student-profile-dock p-3 flex-shrink-0">
                        <div className="flex items-center gap-2.5 px-2 py-1.5">
                            <div className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0" style={{ background: 'var(--brand)' }}>{user?.name?.[0]?.toUpperCase()}</div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium truncate">{user?.name}</p>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setOverlayPanel('pro')}
                                    className="h-9 w-9 flex items-center justify-center rounded-lg transition"
                                    style={{ color: overlayPanel === 'pro' ? 'var(--brand)' : 'var(--text-muted)' }}
                                    title="Pro imkoniyatlari" aria-label="Pro imkoniyatlari"
                                >
                                    <Sparkles className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => { void loadNotifications(); setShowNotifications(true) }}
                                    className="h-9 w-9 flex items-center justify-center rounded-lg transition relative"
                                    style={{ color: 'var(--text-muted)' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    title="Bildirishnomalar"
                                >
                                    <Bell className="h-4 w-4" />
                                    {notifCount > 0 && <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full text-white text-[8px] flex items-center justify-center font-bold" style={{ background: 'var(--danger)' }}>{notifCount > 9 ? '9+' : notifCount}</span>}
                                </button>
                                <button
                                    onClick={() => { setEditingExamInfo(false); setShowSettings(true) }}
                                    className="h-9 w-9 flex items-center justify-center rounded-lg transition"
                                    style={{ color: 'var(--text-muted)' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    title="Sozlamalar"
                                >
                                    <Settings className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>


                {/* Main — mobil tab-bar ko'rinsa pastdan joy qoldiramiz (input yashirinmasin) */}
                <div className="student-main flex-1 flex flex-col min-w-0 overflow-hidden"
                    style={mobileTabBarVisible ? { paddingBottom: MOBILE_TABBAR_PAD } : undefined}>
                    <header className="student-topbar h-14 flex items-center px-4 gap-2 flex-shrink-0">
                        <button type="button" onClick={() => setSideOpen(v => !v)} className="student-icon-button h-8 w-8 flex items-center justify-center flex-shrink-0" title="Yon panel" aria-label="Yon panelni ochish"><Menu className="h-4 w-4" /></button>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                {isTodayView ? 'Bugun' : 'AI ustoz'}
                            </p>
                            <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                                {isTodayView
                                    ? `${[profile?.subject, profile?.subject2].filter(Boolean).join(' + ') || 'Shaxsiy tayyorgarlik'} · Bugungi o‘qish`
                                    : currentChat?.title ? cleanChatTitle(currentChat.title) : 'Yangi suhbat'}
                            </p>
                        </div>
                        {/* Mobilda yangi suhbat — drawer ochmasdan bir bosishda (desktop'da sidebar doim ochiq) */}
                        {isMobile && (
                            <button type="button" onClick={createChat} disabled={creating} title="Yangi suhbat" aria-label="Yangi suhbat"
                                className="h-8 w-8 flex items-center justify-center rounded-lg transition flex-shrink-0 disabled:opacity-50"
                                style={{ color: 'var(--brand)', background: 'var(--brand-light)' }}>
                                <Plus className="h-4 w-4" />
                            </button>
                        )}
                    </header>

                    {/* Messages */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0"
                        onScroll={e => {
                            const el = e.currentTarget
                            const far = el.scrollHeight - el.scrollTop - el.clientHeight > 350
                            setShowScrollDown(prev => prev === far ? prev : far)
                        }}>
                        {isTodayView ? (
                            <div className="student-today-view min-h-full flex flex-col items-center relative px-4 py-8 sm:px-8 sm:py-12">
                                {(loading || streaming) ? (
                                    <div className="text-center px-4 anim-up relative" style={{ zIndex: 1 }}>
                                        <img src="/dtmmax-logo.png" alt="DtmMax" className="h-14 w-14 rounded-xl mx-auto mb-3" style={{ objectFit: 'contain' }} />
                                        <p className="text-base font-bold tracking-tight">AI <span className="k-italic">tayyorlayapti</span>...</p>
                                    </div>
                                ) : (
                                    <div className="today-shell student-today w-full max-w-2xl anim-up relative" style={{ zIndex: 1 }}>
                                        {/* ===== "BUGUN" bosh ekrani — o'quvchi kirganda chat emas, shu dashboard ===== */}
                                        <header className="today-intro student-today__intro">
                                            <p className="today-date">{formatUzbekDate()}</p>
                                            <h1>{timeGreeting()}{user?.name ? `, ${user.name}` : ''}.</h1>
                                            <p className="today-lede">Bugun katta reja shart emas. Eng foydali bitta qadamni tugatamiz.</p>
                                            <div className="flex items-center gap-2 mt-5 flex-wrap">
                                                <button type="button" onClick={() => setOverlayPanel('progress')}
                                                    className="flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-semibold transition"
                                                    style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>
                                                    <Flame className={`h-3 w-3 ${(progressData?.currentStreak ?? 0) > 0 ? 'k-flame-live' : ''}`} />
                                                    {(progressData?.currentStreak ?? 0) > 0 ? `${progressData?.currentStreak} kun ketma-ket` : 'Bugun 1-kunni boshla'}
                                                </button>
                                                {(progressData?.xp ?? 0) > 0 && (
                                                    <span className="h-8 px-3 rounded-full text-[12px] font-semibold flex items-center" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>{progressData?.xp} XP</span>
                                                )}
                                            </div>
                                            {/* Yo'qotish qo'rquvi — seriyani saqlash eng kuchli qaytish sababi.
                                                Mobilda yashiriladi (vertikal joyni tejash) — chip'ning o'zi seriyani ko'rsatadi */}
                                            {(progressData?.currentStreak ?? 0) > 0 && !isMobile && (
                                                <p className="text-[12px] mt-3" style={{ color: 'var(--text-muted)' }}>
                                                    Bugun 1 ta mashq yetadi — {progressData?.currentStreak} kunlik seriyang saqlanadi
                                                </p>
                                            )}
                                        </header>

                                        {/* Avval bittagina aniq ish: o'quvchi dashboarddan emas, harakatdan boshlaydi. */}
                                        {(() => {
                                            const weakTopic = progressData?.weakTopics?.[0]
                                            const unfinishedTodo = homeTodos.find(item => !item.done)
                                            const needsDiagnostic = myResults.length === 0 && (profile?.totalTests ?? 0) === 0
                                            let title = 'Bugungi qisqa reja tuzing'
                                            let description = 'AI sizning maqsadingizga mos, bajariladigan reja tuzadi'
                                            let onClick = () => { void handleSend('Menga bugun uchun qisqa, bajarsa bo‘ladigan o‘quv reja tuz — imtihonim va zaif mavzularimga mosla.', []) }

                                            if (needsDiagnostic) {
                                                const subjects = diagnosticSubjects(profile)
                                                title = 'Darajangizni aniqlaymiz'
                                                description = subjects.length >= 2
                                                    ? `${subjects.join(' + ')} bo‘yicha diagnostik test`
                                                    : `${subjects[0] || 'Asosiy faningiz'} bo‘yicha shaxsiy boshlang‘ich test`
                                                onClick = () => { void handleSend(buildDiagnosticPrompt(profile), []) }
                                            } else if (unfinishedTodo) {
                                                title = 'Bugungi rejani davom ettiring'
                                                description = `Navbatdagi vazifa: ${unfinishedTodo.task}`
                                                onClick = () => { void handleSend(`Bugungi rejadagi "${unfinishedTodo.task}" vazifani boshlashimga yordam ber: eng muhim birinchi qadamni ayt.`, []) }
                                            } else if (myResults.length > 0) {
                                                title = 'Keyingi testni tanlang'
                                                description = `Oxirgi natija ${myResults[0].score}% — endi davom etamiz`
                                                onClick = () => { setOverlayPanel('tests'); markTestsSeen(); void loadPublicTests(); void loadMyResults() }
                                            } else if (weakTopic) {
                                                title = `Zaif mavzu: ${weakTopic.topic}`
                                                description = '10 ta qisqa mashq bilan mustahkamlaymiz'
                                                onClick = () => { void handleSend(`"${weakTopic.topic}" mavzusidan 10 ta savollik mashq testi tuz — bu mening zaif mavzum, oxirida xatolarimni tushuntir.`, []) }
                                            }

                                            return (
                                                <section className="today-focus student-today__focus" aria-labelledby="today-focus-title">
                                                    <div className="min-w-0">
                                                        <p className="today-focus-label">Bugungi fokus</p>
                                                        <h2 id="today-focus-title">{title}</h2>
                                                        <p>{description}</p>
                                                    </div>
                                                    <button type="button" onClick={onClick} className="today-focus-action">
                                                        Boshlash <ArrowRight className="h-4 w-4" />
                                                    </button>
                                                </section>
                                            )
                                        })()}

                                        {/* Maqsad sari yo'l — har kirishda ko'z oldida */}
                                        {(() => {
                                            if (profile?.examType !== 'DTM' || !profile?.targetScore || !progressData?.avgScore) return null
                                            const estimatedBall = Math.round((progressData.avgScore / 100) * 189)
                                            const pathPercent = Math.max(3, Math.min(100, Math.round((estimatedBall / profile.targetScore) * 100)))
                                            return (
                                                <section className="student-today__section student-progress-path text-left">
                                                    <div className="flex items-center justify-between gap-2 mb-2">
                                                        <p className="text-[13px] font-bold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                                                            <Trophy className="h-4 w-4" style={{ color: 'var(--brand)' }} /> {profile.targetScore} ball sari yo'l
                                                        </p>
                                                        <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>hozir ~{estimatedBall} ball</span>
                                                    </div>
                                                    <div className="student-progress-track" role="progressbar" aria-label={`${profile.targetScore} ball maqsad sari progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pathPercent}>
                                                        <div className="transition-[width] duration-700" style={{ width: `${pathPercent}%` }} />
                                                    </div>
                                                    {!isMobile && <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>Har bir mashq shu chiziqni oldinga suradi</p>}
                                                </section>
                                            )
                                        })()}

                                        {/* Bugungi reja — REAL SANA hisobga olinadi: faqat bugun tuzilgan reja "bugungi";
                                            eski kunlardan qolgan bajarilmaganlar alohida, halol "avvalgi" deb ko'rinadi */}
                                        {(() => {
                                            const todayKey = new Date().toDateString()
                                            const isTodayItem = (t: TodoItem) => typeof t.createdAt === 'number' && new Date(t.createdAt).toDateString() === todayKey
                                            const todayTodos = homeTodos.filter(isTodayItem)
                                            const olderUndone = homeTodos.filter(t => !isTodayItem(t) && !t.done)
                                            const showingOlder = todayTodos.length === 0 && olderUndone.length > 0
                                            const newPlanPrompt = 'Menga bugun uchun qisqa, bajarsa bo\'ladigan o\'quv reja tuz — imtihonim va zaif mavzularimga mosla.'
                                            const renderTodoRow = (t: TodoItem & { storageKey: string }) => {
                                                const justDone = justDoneIds.has(t.id)
                                                return (
                                                    <button key={`${t.storageKey}-${t.id}`} type="button" onClick={() => markHomeTodoDone(t)} disabled={justDone}
                                                        className="w-full flex items-center gap-2.5 py-2 text-left group" title="Bajarildi deb belgilash">
                                                        {justDone ? (
                                                            <span className="k-tick-pop flex-shrink-0 h-[22px] w-[22px] rounded-full flex items-center justify-center" style={{ background: 'var(--success)' }}>
                                                                <span className="text-white text-[12px] font-bold leading-none">✓</span>
                                                            </span>
                                                        ) : (
                                                            <span className="flex-shrink-0 h-[22px] w-[22px] rounded-full transition group-hover:scale-110" style={{ border: '1.5px solid var(--border-strong)' }} />
                                                        )}
                                                        <span className="text-[12.5px] flex-1 min-w-0 truncate transition-all" style={{ color: justDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: justDone ? 'line-through' : 'none' }}>{t.task}</span>
                                                        {t.duration ? <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{t.duration} min</span> : null}
                                                    </button>
                                                )
                                            }
                                            return (
                                                <section className="student-today__section student-day-plan text-left">
                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                        <p className="text-[13px] font-bold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                                                            <Target className="h-4 w-4" style={{ color: 'var(--brand)' }} /> Bugungi reja
                                                        </p>
                                                        {todayTodos.length > 0 && (
                                                            <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                                                                {todayTodos.filter(t => t.done).length}/{todayTodos.length}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {todayTodos.length === 0 && olderUndone.length === 0 ? (
                                                        <div className="flex items-center justify-between gap-3 mt-1">
                                                            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Bugun uchun reja hali yo'q — AI 1 daqiqada tuzib beradi</p>
                                                            <button type="button" className="btn btn-outline btn-sm flex-shrink-0"
                                                                onClick={() => { void handleSend(newPlanPrompt, []) }}>
                                                                Reja tuzish
                                                            </button>
                                                        </div>
                                                    ) : showingOlder ? (
                                                        <>
                                                            <p className="text-[11px] mt-0.5 mb-1" style={{ color: 'var(--text-muted)' }}>Avvalgi rejadan qolgan vazifalar:</p>
                                                            {olderUndone.slice(0, 3).map(renderTodoRow)}
                                                            <button type="button" className="btn btn-outline btn-sm mt-2"
                                                                onClick={() => { void handleSend(newPlanPrompt, []) }}>
                                                                Bugun uchun yangi reja
                                                            </button>
                                                        </>
                                                    ) : todayTodos.every(t => t.done) && justDoneIds.size === 0 ? (
                                                        <p className="text-[12px] mt-1" style={{ color: 'var(--success)' }}>Bugungi reja to'liq bajarildi! 🎉</p>
                                                    ) : (
                                                        <div className="mt-1.5">
                                                            {todayTodos.filter(t => !t.done || justDoneIds.has(t.id)).slice(0, 4).map(renderTodoRow)}
                                                        </div>
                                                    )}
                                                </section>
                                            )
                                        })()}

                                        {/* Davom etish — bugun qaytarilishi kerak bo'lgan kartochkalar real navbatdan olinadi. */}
                                        {dueFlashcards.length > 0 && (
                                            <section className="student-today__section student-continue flex items-center justify-between gap-3 text-left">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-surface)' }}>
                                                        <BookOpen className="h-[18px] w-[18px]" style={{ color: 'var(--text-primary)' }} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>O‘rganishni davom ettiring</p>
                                                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{dueFlashcards.length} ta kartochka takrorlashga tayyor</p>
                                                    </div>
                                                </div>
                                                <button type="button" className="btn btn-outline btn-sm flex-shrink-0" onClick={() => setOverlayPanel('flashcards')}>
                                                    Takrorlash
                                                </button>
                                            </section>
                                        )}

                                        {/* Davom etish — natijasi bor o'quvchiga.
                                            Mobilda maqsad-yo'l kartasi bo'lsa YASHIRINADI: ikkisi ham progressni ko'rsatadi,
                                            "Testlar" tugmasi esa pastki tab-barda bor — takror karta joyni band qilardi */}
                                        {dueFlashcards.length === 0 && myResults.length > 0 && !(isMobile && profile?.examType === 'DTM' && !!profile?.targetScore && !!progressData?.avgScore) && (
                                            <section className="student-today__section student-continue flex items-center justify-between gap-3 text-left">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--success) 12%, transparent)' }}>
                                                        <TrendingUp className="h-[18px] w-[18px]" style={{ color: 'var(--success)' }} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>Oxirgi natija: {myResults[0].score}%</p>
                                                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Davom etsak — natija o'sadi</p>
                                                    </div>
                                                </div>
                                                <button type="button" className="btn btn-primary btn-sm flex-shrink-0 relative"
                                                    onClick={() => { setOverlayPanel('tests'); markTestsSeen(); void loadPublicTests(); void loadMyResults() }}>
                                                    Testlar
                                                    {newTestIds.size > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full text-white text-[9px] flex items-center justify-center font-bold" style={{ background: 'var(--danger)' }}>{newTestIds.size > 9 ? '9+' : newTestIds.size}</span>}
                                                </button>
                                            </section>
                                        )}

                                        {/* Zaif mavzu — bitta bosishda mashq */}
                                        {(() => {
                                            const weakTopic = progressData?.weakTopics?.[0]
                                            if (!weakTopic) return null
                                            return (
                                                <button type="button"
                                                    onClick={() => { void handleSend(`"${weakTopic.topic}" mavzusidan 10 ta savollik mashq testi tuz — bu mening zaif mavzum, oxirida xatolarimni tushuntir.`, []) }}
                                                    className="student-today__section student-weak-topic w-full flex items-center gap-3 text-left transition">
                                                    <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--warning)' }} />
                                                    <span className="text-[12.5px] min-w-0 flex-1" style={{ color: 'var(--text-primary)' }}>
                                                        Zaif mavzu: <strong>{weakTopic.topic}</strong> — mashq qilamizmi?
                                                    </span>
                                                </button>
                                            )
                                        })()}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="chat-thread max-w-[760px] mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-9">
                                {messages.length === 0 && !loading && !streaming && (
                                    <section className="ai-tutor-empty" aria-labelledby="ai-tutor-empty-title">
                                        <div className="ai-tutor-empty__icon"><BrainCircuit aria-hidden="true" /></div>
                                        <div>
                                            <h1 id="ai-tutor-empty-title">AI ustoz bilan boshlang</h1>
                                            <p>{profile?.subject ? `${profile.subject} bo‘yicha savol bering` : 'Savol, masala yoki mavzuni yozing'} — javobni bosqichma-bosqich tushuntiraman.</p>
                                        </div>
                                        <div className="ai-tutor-empty__actions" aria-label="Tezkor so‘rovlar">
                                            {[
                                                { label: 'Mavzuni tushuntir', prompt: 'Menga qiyin bo‘layotgan mavzuni aniqlash uchun bitta savol ber, keyin uni sodda misol bilan tushuntir.' },
                                                { label: 'Mashq tuz', prompt: "Menga o‘z fanimdan 5 ta qisqa mashq tuz va har javobimdan keyin izoh ber." },
                                                { label: 'Reja tuz', prompt: 'Bugun uchun qisqa va bajariladigan o‘qish rejasini tuz.' },
                                            ].map(action => (
                                                <button key={action.label} type="button" onClick={() => { void handleSend(action.prompt, []) }}>
                                                    <span>{action.label}</span><ArrowRight aria-hidden="true" />
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                )}
                                {messages.map((m, i) => {
                                    // Sana ajratgichi — kun almashganda "Bugun/Kecha/5-iyul" chizig'i
                                    const msgDay = m.createdAt ? new Date(m.createdAt).toDateString() : ''
                                    const prevMsg = messages[i - 1]
                                    const showDateSep = !!msgDay && (!prevMsg?.createdAt || new Date(prevMsg.createdAt).toDateString() !== msgDay)
                                    const dateLabel = !msgDay ? '' : (() => {
                                        const todayKey = new Date().toDateString()
                                        const yesterdayKey = new Date(Date.now() - 86400000).toDateString()
                                        if (msgDay === todayKey) return 'Bugun'
                                        if (msgDay === yesterdayKey) return 'Kecha'
                                        return new Date(m.createdAt).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long' })
                                    })()
                                    const messageTime = m.createdAt ? new Date(m.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : ''
                                    return (
                                    <React.Fragment key={m.id || i}>
                                    {showDateSep && <div className="chat-date-sep" aria-hidden="true"><span>{dateLabel}</span></div>}
                                    <div className={`flex ${m.role === 'user' ? 'justify-end' : ''}`} title={messageTime || undefined}>
                                        {m.role === 'user' ? (
                                            <div className="flex w-full min-w-0 flex-col items-end gap-1">
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
                                                {messageTime && <span className="text-[10px] px-1" style={{ color: 'var(--text-muted)' }}>{messageTime}</span>}
                                            </div>
                                        ) : (
                                            <div className="ai-msg-row msg-group">
                                                <img src="/dtmmax-logo.png" alt="" aria-hidden="true" className="ai-avatar" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="bubble-ai"><MdMessage content={m.content} /></div>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        {messageTime && <span className="text-[10px] px-1" style={{ color: 'var(--text-muted)' }}>{messageTime}</span>}
                                                        <button type="button" className="msg-copy-btn"
                                                            onClick={() => { navigator.clipboard?.writeText(m.content).then(() => toast.success('Nusxalandi')).catch(() => toast.error("Nusxalab bo'lmadi")) }}>
                                                            <Copy className="h-3 w-3" /> Nusxalash
                                                        </button>
                                                    </div>
                                                    {i === messages.length - 1 && !loading && !streaming && (
                                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                                            {[
                                                                { label: 'Sodda tushuntir', prompt: 'Oxirgi javobni yanada sodda, qisqa va tushunarli qilib qayta tushuntir.' },
                                                                { label: 'Misol ko‘rsat', prompt: 'Oxirgi tushuntirgan mavzuni bitta sodda misol bilan yana tushuntir.' },
                                                                { label: '3 ta mashq', prompt: 'Oxirgi mavzu bo‘yicha 3 ta qisqa mashq ber.' },
                                                            ].map(action => (
                                                                <button key={action.label} type="button" onClick={() => { void handleSend(action.prompt, []) }}
                                                                    className="px-2.5 py-1 rounded-full text-[11px] font-medium transition"
                                                                    style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                                                    {action.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    </React.Fragment>
                                    )
                                })}
                                {/* Ichki tahlil emas, foydalanuvchiga kerak bo'lgan sokin holat xabari. */}
                                {thinkingText && !streaming && (
                                    <div className="flex items-center gap-2 py-1">
                                        <Lightbulb className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Murakkab yechimni tartiblayapti...</span>
                                    </div>
                                )}
                                {streaming && (
                                    <div className="flex ai-msg-row">
                                        <img src="/dtmmax-logo.png" alt="" aria-hidden="true" className="ai-avatar" />
                                        <div className="bubble-ai w-full sm:w-auto">
                                            <MdMessage content={streaming} isStreaming={true} />
                                            {/* Miltillovchi kursor — javob hali yozilmoqda (blok tuzilayotganda spinner o'zi bor) */}
                                            {!/```(test|flashcard|vocab|formula|todo)/.test(streaming.slice(-400)) && <span className="stream-caret" aria-hidden="true" />}
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
                                        <span className="ai-generating"><span className="ai-star">✳</span> {getLoadingLabel(messages)}</span>
                                    </div>
                                )}
                                {loading && thinkingText && !streaming && (
                                    <div className="flex py-1">
                                        <span className="ai-generating"><span className="ai-star">✳</span> Fikrlamoqda...</span>
                                    </div>
                                )}
                                {/* Uzun suhbatda pastga tushish tugmasi (sticky, joy egallamaydi) */}
                                {showScrollDown && (
                                    <div className="sticky bottom-3 h-0 flex justify-end pr-1 z-10">
                                        <button type="button" aria-label="Pastga tushish"
                                            onClick={() => { const el = scrollRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }) }}
                                            className="h-9 w-9 -mt-11 rounded-full flex items-center justify-center transition hover:scale-105"
                                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', color: 'var(--text-secondary)' }}>
                                            <ArrowDown className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Input + Quick Actions — har doim ko'rinadi */}
                    {!isTodayView && <ChatInputArea
                        chatId={chatId}
                        loading={loading}
                        thinkingMode={thinkingMode}
                        setThinkingMode={setThinkingMode}
                        onSend={handleSend}
                        onStop={stopGeneration}
                        blobUrlsRef={blobUrlsRef}
                        onEnsureChat={ensureChatForUpload}
                        aiQuota={aiQuota}
                        refreshAiQuota={refreshAiQuota}
                        onOpenTests={() => {
                            setOverlayPanel('tests')
                            markTestsSeen()
                            void loadPublicTests()
                            void loadMyResults()
                        }}
                    />}
                </div>

                {/* Todo inline panel — mobilда fullscreen (aks holda chat ~40px ga siqiladi) */}
                {todoOpen && (
                    <div className={isMobile ? 'fixed inset-0 z-50 flex flex-col' : 'flex flex-col flex-shrink-0'}
                        style={isMobile ? { background: 'var(--bg-page)' } : { width: '320px', borderLeft: '1px solid var(--border)', background: 'var(--bg-page)' }}>
                        {/* Header */}
                        <div className="h-14 flex items-center justify-between px-5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                            <p className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>Reja</p>
                            <button onClick={() => setTodoOpen(false)} aria-label="Suhbatga qaytish" title="Suhbatga qaytish" className="h-8 w-8 flex items-center justify-center rounded-lg transition"
                                style={{ color: 'var(--text-muted)' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <ChevronLeft className="h-4 w-4" />
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
                        const progressPercent = questions.length > 0 ? Math.round((answered / questions.length) * 100) : 0
                        const scorePercent = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0
                        const resultTone = scorePercent >= 80
                            ? { color: 'var(--success)', background: 'var(--success-light)', title: 'Ajoyib natija!', message: 'Mavzuni yaxshi ushlabsiz. Shu ritmni saqlang.' }
                            : scorePercent >= 60
                                ? { color: 'var(--brand)', background: 'var(--brand-light)', title: 'Yaxshi harakat!', message: 'Xatolardagi izohlarni ko‘rib, keyingi testda natijani oshiramiz.' }
                                : { color: 'var(--warning)', background: 'color-mix(in srgb, var(--warning) 12%, transparent)', title: 'Boshlanish yaxshi!', message: 'Natija zaif joylarni ko‘rsatdi — endi aynan ulardan kuch olamiz.' }
                        const currentIndex = Math.min(testQuestionIndex, Math.max(0, questions.length - 1))
                        const currentQuestion = questions[currentIndex]
                        const currentHasAnswer = String(testAnswers[currentIndex] || '').trim().length > 0
                        const nextUnansweredIndex = questions.findIndex((_: any, index: number) => index !== currentIndex && String(testAnswers[index] || '').trim().length === 0)
                        return (
                            <div className={(testPanelMaximized || isMobile) ? 'fixed inset-0 z-50 flex flex-col' : 'relative flex flex-col flex-shrink-0'}
                                style={(testPanelMaximized || isMobile) ? { background: 'var(--bg-card)' } : { width: testWidth, background: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }}>

                                {/* Drag handle */}
                                {!testPanelMaximized && !isMobile && (
                                    <div onMouseDown={e => { testDragRef.current = true; e.preventDefault() }}
                                        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 transition-colors"
                                        style={{ background: 'transparent' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--brand-light)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'} />
                                )}

                                {/* Panel header */}
                                <div className="h-14 flex items-center justify-between px-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--k-accent-grad)' }}><ClipboardList className="h-3.5 w-3.5 text-white" /></div>
                                        <span className="text-sm font-semibold truncate">Test — {questions.length} savol</span>
                                        {(() => { const b = sourceBadge(activeTestSource); return b ? <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold" style={{ background: b.bg, color: b.color }}>{b.label}</span> : null })()}
                                        {testReadOnly && <span className="text-[10px] px-2 py-0.5 rounded-md font-medium" style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>Ko'rish</span>}
                                        {testTimeLeft !== null && (
                                            <span className={`text-sm font-mono tabular-nums ml-1 px-2 py-0.5 rounded-md ${testTimeLeft < 60 ? 'animate-pulse' : ''}`}
                                                style={testTimeLeft < 60 ? { color: 'var(--danger)', background: 'var(--danger-light)' } : { color: 'var(--text-secondary)', background: 'var(--bg-muted)' }}>
                                                ⏱ {String(Math.floor(testTimeLeft / 60)).padStart(2, '0')}:{String(testTimeLeft % 60).padStart(2, '0')}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {!isMobile && (
                                            <button onClick={() => setTestPanelMaximized(!testPanelMaximized)} className="h-7 w-7 flex items-center justify-center rounded-lg transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                {testPanelMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                            </button>
                                        )}
                                        <button onClick={() => { setTestPanel(null); setTestPanelMaximized(false); setActiveTestId(null); setActiveTestQuestions([]); setTestTimeLeft(null); setRaschFeedback(null) }} aria-label="Suhbatga qaytish" title="Suhbatga qaytish" className="h-10 w-10 sm:h-7 sm:w-7 flex items-center justify-center rounded-lg transition flex-shrink-0" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><ChevronLeft className="h-4 w-4" /></button>
                                    </div>
                                </div>

                                {/* Progress — rang keyingi qadamni ko'rsatadi, son esa yakun qanchalik yaqinligini. */}
                                <div className="px-4 pt-2.5 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                                            {testReadOnly ? 'Test yakunlangan' : answered === 0 ? 'Birinchi savoldan boshlang' : answered === questions.length ? 'Hammasi belgilandi — natijangiz tayyor' : `${questions.length - answered} ta savol qoldi`}
                                        </p>
                                        <span className="text-[11px] font-bold" style={{ color: 'var(--brand)' }}>{testReadOnly ? '100%' : `${answered}/${questions.length}`}</span>
                                    </div>
                                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-muted)' }}>
                                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${testReadOnly ? 100 : progressPercent}%`, background: 'var(--k-accent-grad, var(--brand))' }} />
                                    </div>
                                    <div className="flex gap-1.5 mt-2.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }} role="tablist" aria-label="Test savollari">
                                        {questions.map((question: any, index: number) => {
                                            const selected = index === currentIndex
                                            const hasAnswer = String(testAnswers[index] || '').trim().length > 0
                                            const correct = testSubmitted && question.correct && testAnswers[index] === question.correct
                                            const wrong = testSubmitted && question.correct && hasAnswer && !correct
                                            return (
                                                <button key={index} type="button" role="tab" aria-selected={selected} aria-label={`${index + 1}-savol${hasAnswer ? ', javob berilgan' : ', javobsiz'}`}
                                                    onClick={() => setTestQuestionIndex(index)}
                                                    className="h-7 min-w-7 px-1.5 rounded-lg text-[10px] font-bold transition flex-shrink-0"
                                                    style={selected
                                                        ? { background: 'var(--brand)', color: 'white' }
                                                        : correct
                                                            ? { background: 'var(--success-light)', color: 'var(--success)' }
                                                            : wrong
                                                                ? { background: 'var(--danger-light)', color: 'var(--danger)' }
                                                                : hasAnswer
                                                                    ? { background: 'var(--brand-light)', color: 'var(--brand)' }
                                                                    : { background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                                    {index + 1}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Questions */}
                                <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-5" style={{ background: 'var(--bg-page)' }}>
                                    <div className={testPanelMaximized ? 'max-w-3xl mx-auto space-y-5' : 'space-y-5'}>
                                        {currentQuestion && (() => {
                                            const q = currentQuestion
                                            const i = currentIndex
                                            const questionText = getStudentQuestionText(q)
                                            return (
                                            <>
                                            <div className="card p-5" style={{ borderColor: testAnswers[i] ? 'color-mix(in srgb, var(--brand) 28%, var(--border))' : undefined }}>
                                                <div className="flex items-center justify-between gap-3 mb-2.5">
                                                    <span className="text-[10px] uppercase tracking-[0.12em] font-bold px-2 py-1 rounded-lg" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>Savol {i + 1}</span>
                                                    {testAnswers[i] && !testSubmitted && <span className="text-[10px] font-semibold" style={{ color: 'var(--success)' }}>Javob belgilandi ✓</span>}
                                                </div>
                                                {questionText ? (
                                                    <p className="text-[14px] font-semibold mb-3 leading-relaxed"
                                                        style={{ color: 'var(--text-primary)', opacity: 1 }}>
                                                        <MathText text={questionText} />
                                                    </p>
                                                ) : !q.imageUrl ? (
                                                    <div className="mb-3 rounded-xl px-3 py-2.5 text-[12px] font-medium"
                                                        style={{ color: 'var(--danger)', background: 'var(--danger-light)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)' }}>
                                                        Bu savolning matni saqlanmagan. Test muallifi savolni tahrirlashi kerak.
                                                    </div>
                                                ) : null}
                                                {q.imageUrl && <StudentQuestionImage src={q.imageUrl} />}
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
                                                    <div className="space-y-2.5" role="radiogroup" aria-label={`${i + 1}-savol variantlari`}>
                                                        {(['a', 'b', 'c', 'd'] as const).map((opt, oi) => {
                                                            const isSelected = testAnswers[i] === opt
                                                            const isCorrect = q.correct === opt
                                                            // FAZA 3: variant rasmi (public testlarda by-link'dan keladi)
                                                            const optionImage = Array.isArray(q.optionImages) ? q.optionImages[oi] : null
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
                                                                    className="w-full text-left px-3.5 py-3 rounded-xl text-[13px] border transition-all duration-200 outline-none flex items-start gap-2.5"
                                                                    style={sty}>
                                                                    <span className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold" style={testSubmitted && isCorrect
                                                                        ? { background: 'var(--success)', color: 'white' }
                                                                        : testSubmitted && isSelected && !isCorrect
                                                                            ? { background: 'var(--danger)', color: 'white' }
                                                                            : isSelected
                                                                                ? { background: 'var(--brand)', color: 'white' }
                                                                                : { background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>{opt.toUpperCase()}</span>
                                                                    <span className="pointer-events-none pt-0.5">
                                                                        <MathText text={q[opt]} />
                                                                        {optionImage && (
                                                                            <img src={optionImage} alt={`${opt.toUpperCase()} variant rasmi`} loading="eager" decoding="async"
                                                                                className="mt-1.5 rounded-lg border max-w-full block" style={{ borderColor: 'var(--border)', maxHeight: '10rem', objectFit: 'contain' }} />
                                                                        )}
                                                                    </span>
                                                                    {testSubmitted && isCorrect && <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full text-xs" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>✓</span>}
                                                                    {testSubmitted && isSelected && !isCorrect && <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full text-xs" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>✕</span>}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                                {/* FAZA 3: yechim rasmi — submitdan keyin (public testlar) */}
                                                {testSubmitted && q.solutionImage && (
                                                    <div className="mt-3 p-2.5 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                                        <p className="text-[11px] font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Yechim:</p>
                                                        <img src={q.solutionImage} alt="Yechim rasmi" loading="lazy" decoding="async" fetchPriority="low"
                                                            className="max-w-full rounded-lg" style={{ maxHeight: '240px', objectFit: 'contain' }} />
                                                    </div>
                                                )}
                                                {testSubmitted && q.questionType !== 'open' && q.correct && testAnswers[i] !== q.correct && (
                                                    <div className="mt-3">
                                                        {explanations[i] ? (
                                                            <div className="text-[12.5px] leading-relaxed px-3.5 py-2.5 rounded-xl" style={{ background: 'var(--brand-light)', color: 'var(--text-secondary)' }}>
                                                                <span className="font-semibold inline-flex items-center gap-1 mr-1" style={{ color: 'var(--brand)' }}><Lightbulb className="h-3.5 w-3.5" /> Izoh:</span>
                                                                <MathText text={explanations[i]} />
                                                            </div>
                                                        ) : (
                                                            <button type="button" onClick={() => explainQuestion(i, q)} disabled={explLoading !== null}
                                                                className="text-[12px] font-semibold inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                                                                style={{ color: 'var(--brand)', background: 'var(--brand-light)' }}>
                                                                <Lightbulb className="h-3.5 w-3.5" /> {explLoading === i ? 'Tushuntirilmoqda...' : 'Nega xato? AI tushuntirsin'}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between gap-3">
                                                <button type="button" onClick={() => setTestQuestionIndex(index => Math.max(0, index - 1))} disabled={currentIndex === 0}
                                                    className="h-10 px-3 rounded-xl text-[12px] font-semibold flex items-center gap-1.5 transition disabled:opacity-40"
                                                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                                                    <ChevronLeft className="h-4 w-4" /> Oldingi
                                                </button>
                                                <span className="text-[11px] font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>{currentIndex + 1} / {questions.length}</span>
                                                <button type="button" onClick={() => setTestQuestionIndex(index => Math.min(questions.length - 1, index + 1))} disabled={currentIndex === questions.length - 1}
                                                    className="h-10 px-3 rounded-xl text-[12px] font-semibold flex items-center gap-1.5 transition disabled:opacity-40"
                                                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                                                    Keyingi <ChevronRight className="h-4 w-4" />
                                                </button>
                                            </div>
                                            </>
                                            )
                                        })()}
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
                                            <button onClick={() => {
                                                if (answered === questions.length) {
                                                    void submitTestPanel()
                                                } else if (nextUnansweredIndex >= 0) {
                                                    setTestQuestionIndex(nextUnansweredIndex)
                                                }
                                            }} disabled={!currentHasAnswer && answered < questions.length}
                                                className="btn btn-primary w-full h-12 flex items-center justify-center gap-2"
                                                style={{ opacity: !currentHasAnswer && answered < questions.length ? 0.5 : 1 }}>
                                                <Target className="h-4 w-4" /> {answered === questions.length
                                                    ? 'Natijangni ko‘rish'
                                                    : !currentHasAnswer
                                                        ? 'Javobni belgilang'
                                                        : `Keyingi javobsiz savol · ${questions.length - answered} qoldi`}
                                            </button>
                                        ) : (
                                            <div className="rounded-2xl p-4 text-center space-y-2" style={{ background: resultTone.background, border: `1px solid color-mix(in srgb, ${resultTone.color} 24%, transparent)` }}>
                                                <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: resultTone.color }}>Natijang tayyor</p>
                                                <p className="text-2xl font-bold" style={{ color: resultTone.color }}>{score}/{questions.length} <span className="text-sm font-semibold">— {scorePercent}%</span></p>
                                                <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{resultTone.title}</p>
                                                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{resultTone.message}</p>
                                                {raschFeedback && (
                                                    <p className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--brand)' }}><TrendingUp className="h-3.5 w-3.5" /> Daraja: {raschFeedback.prev.toFixed(2)} → {raschFeedback.next.toFixed(2)}</p>
                                                )}
                                                <button onClick={() => { setTestPanel(null); setTestPanelMaximized(false); setTestReadOnly(false); setActiveTestId(null); setActiveTestQuestions([]); setTestTimeLeft(null); setRaschFeedback(null) }} className="text-sm font-bold transition px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-card)', color: resultTone.color }}>Chatdagi tahlilga qaytish</button>
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
                    const wordColor = wordOver ? '#ef4444' : wordOk ? 'var(--success)' : 'var(--text-muted)'
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
                                        <span className="text-[10px] px-2 py-0.5 rounded-md font-medium" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>Topshirildi ✓</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    {!isMobile && (
                                        <button onClick={() => setEssayMaximized(!essayMaximized)} className="h-7 w-7 flex items-center justify-center rounded-lg transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            {essayMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                        </button>
                                    )}
                                    <button onClick={() => { setEssayPanel(null) }} aria-label="Suhbatga qaytish" title="Suhbatga qaytish" className="h-8 w-8 flex items-center justify-center rounded-lg transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <ChevronLeft className="h-4 w-4" />
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
                                                background: wordOver ? '#ef4444' : wordOk ? 'var(--success)' : 'color-mix(in srgb, var(--success) 65%, transparent)'
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
                                        <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--success-light)', border: '1px solid var(--success)' }}>
                                            <CheckCircle className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--success)' }} />
                                            <p className="text-[13px]" style={{ color: 'var(--success)' }}>Essay topshirildi. Chatda baho va tavsiyalarni kuting.</p>
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
                                {!flashMaximized && !isMobile && (
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
                                        {!isMobile && (
                                            <button onClick={() => setFlashMaximized(!flashMaximized)}
                                                className="h-7 w-7 flex items-center justify-center rounded-lg transition"
                                                style={{ color: 'var(--text-muted)' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                {flashMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                            </button>
                                        )}
                                        <button onClick={() => { setFlashPanel(null); setFlashMaximized(false); setFlashIsReview(false) }} aria-label="Suhbatga qaytish" title="Suhbatga qaytish"
                                            className="h-8 w-8 flex items-center justify-center rounded-lg transition"
                                            style={{ color: 'var(--text-muted)' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <ChevronLeft className="h-4 w-4" />
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

                {/* 6.3: bir martalik mini-tur — intruziv modal EMAS, pastdagi kichik karta */}
                {tourStep >= 0 && !showOnboarding && profileLoaded && chatsLoaded && !overlayPanel && (
                    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-sm rounded-2xl p-4 k-fade-in"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 12px 32px rgba(33,28,22,0.18)' }}>
                        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                            {tourStep === 0 && <><span className="font-bold" style={{ color: 'var(--brand)' }}>1/3 · Suhbat.</span> Savol yozing yoki rasm yuboring — AI tushuntiradi, test tuzadi, reja qiladi.</>}
                            {tourStep === 1 && <><span className="font-bold" style={{ color: 'var(--brand)' }}>2/3 · Testlar.</span> Yon paneldagi «Testlar»da o'qituvchi va rasmiy DTM testlari — yechganingiz belgilanib boradi.</>}
                            {tourStep === 2 && <><span className="font-bold" style={{ color: 'var(--brand)' }}>3/3 · Natijalar.</span> Zaif mavzularingiz va progress «Natijalar» bo'limida. Omad!</>}
                        </p>
                        <div className="flex items-center justify-end gap-2 mt-3">
                            <button onClick={finishTour} className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition" style={{ color: 'var(--text-muted)' }}>
                                O'tkazib yuborish
                            </button>
                            <button onClick={() => tourStep >= 2 ? finishTour() : setTourStep(s => s + 1)}
                                className="text-[12px] font-semibold px-3.5 py-1.5 rounded-lg transition"
                                style={{ background: 'var(--brand)', color: 'white' }}>
                                {tourStep >= 2 ? 'Tushunarli' : 'Keyingi'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ===== OVERLAY PANELS ===== */}
                {overlayPanel && (
                    <div className="student-overlay fixed inset-0 z-50 flex" onClick={() => setOverlayPanel(null)}>
                        <div className="student-overlay__backdrop absolute inset-0 k-fade-in" />
                        <div className="student-overlay__panel relative ml-auto h-full flex flex-col overflow-hidden k-slide-in-right" role="dialog" aria-modal="true" aria-labelledby="student-overlay-title"
                            style={{ width: '100%', maxWidth: '680px', ...(mobileTabBarVisible ? { paddingBottom: MOBILE_TABBAR_PAD } : {}) }}
                            onClick={e => e.stopPropagation()}>

                            {/* Header */}
                            <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 sm:py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                                <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: overlayPanel === 'progress' ? 'color-mix(in srgb, var(--success) 12%, transparent)' : 'color-mix(in srgb, var(--brand) 12%, transparent)' }}>
                                    {overlayPanel === 'tests' && <ClipboardList className="h-5 w-5" style={{ color: 'var(--brand)' }} />}
                                    {overlayPanel === 'flashcards' && <BookOpen className="h-5 w-5" style={{ color: 'var(--brand)' }} />}
                                    {overlayPanel === 'progress' && <BarChart2 className="h-5 w-5" style={{ color: 'var(--text-primary)' }} />}
                                    {overlayPanel === 'pro' && <Sparkles className="h-5 w-5" style={{ color: 'var(--brand)' }} />}
                                </div>
                                <div className="flex-1">
                                    <h2 id="student-overlay-title" className="font-semibold text-base">
                                        {overlayPanel === 'tests' ? 'Testlar' : overlayPanel === 'flashcards' ? 'O‘rganish' : overlayPanel === 'progress' ? 'Progress' : 'Pro'}
                                    </h2>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                        {overlayPanel === 'tests' ? (publicTests.length > 0 ? `${publicTests.length} ta test` : 'Bugungi tayyorgarlik shu yerdan boshlanadi')
                                            : overlayPanel === 'flashcards' ? `${dueFlashcards.length} ta kartochka takrorlash kerak`
                                            : overlayPanel === 'progress' ? 'O\'qish tahlili'
                                            : 'Rejalar va imkoniyatlar'}
                                    </p>
                                </div>
                                <button type="button" onClick={() => setOverlayPanel(null)} className="student-icon-button h-8 w-8 flex items-center justify-center" aria-label="Panelni yopish" autoFocus>
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3.5 sm:py-4">
                                {overlayPanel === 'tests' && (
                                    <div className="test-catalog-content">
                                        {/* 4.4: ma'lumot kelguncha skeleton kartalar */}
                                        {testsLoading && publicTests.length === 0 && (
                                            <div className="test-catalog-list test-catalog-skeleton" aria-label="Testlar yuklanmoqda">
                                                {[0, 1, 2, 3].map(i => (
                                                    <div key={i} className="test-catalog-skeleton__row animate-pulse">
                                                        <div className="flex-1 space-y-2">
                                                            <div className="h-3.5 rounded w-2/3" style={{ background: 'var(--bg-muted)' }} />
                                                            <div className="h-3 rounded w-1/3" style={{ background: 'var(--bg-muted)' }} />
                                                        </div>
                                                        <div className="h-8 w-20 rounded-lg flex-shrink-0" style={{ background: 'var(--bg-muted)' }} />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {!testsLoading && publicTests.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                                <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-muted)' }}>
                                                    <ClipboardList className="h-8 w-8" style={{ color: 'var(--text-muted)' }} />
                                                </div>
                                                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Hozircha testlar yo'q</p>
                                                <button onClick={() => { setOverlayPanel(null); void handleSend("Menga o'z fanimdan 15 talik test tuzib ber.", []) }}
                                                    className="text-xs font-semibold px-4 py-2 rounded-xl transition"
                                                    style={{ background: 'var(--brand)', color: 'white' }}>
                                                    AI'dan test so'rang
                                                </button>
                                            </div>
                                        )}
                                        {publicTests.length > 0 && (
                                            <TestCatalogControls
                                                view={testCatalogView}
                                                onViewChange={setTestCatalogView}
                                                counts={testCatalogCounts}
                                                search={testSearch}
                                                onSearchChange={setTestSearch}
                                                subjects={testSubjects}
                                                subject={testSubject}
                                                onSubjectChange={setTestSubject}
                                                format={testFormat}
                                                onFormatChange={setTestFormat}
                                                sort={testSort}
                                                onSortChange={setTestSort}
                                                resultCount={testCatalogResultCount}
                                            />
                                        )}
                                        {publicTests.length > 0 && (() => {
                                            const rows: Array<{ test: PublicTest; recommended: boolean }> = []
                                            if (testCatalogView === 'recommended' && recommendedTest) {
                                                rows.push({ test: recommendedTest, recommended: true })
                                            }
                                            visibleTests.forEach(test => rows.push({ test, recommended: false }))

                                            if (rows.length === 0) {
                                                return (
                                                    <div className="test-catalog-empty">
                                                        <ClipboardList aria-hidden="true" />
                                                        <div>
                                                            <p>Bu tanlovga mos test topilmadi</p>
                                                            <span>Filtrlarni tozalang yoki boshqa bo‘limni tanlang.</span>
                                                        </div>
                                                        <button type="button" onClick={() => {
                                                            setTestCatalogView('subjects')
                                                            setTestSubject('all')
                                                            setTestFormat('all')
                                                            setTestSearch('')
                                                        }}>
                                                            Barcha testlar
                                                        </button>
                                                    </div>
                                                )
                                            }

                                            return (
                                                <div className="test-catalog-list">
                                                    {rows.map(({ test: t, recommended }) => {
                                                        const result = myResults.find(item => item.testId === t.id)
                                                        const done = isCatalogTestDone(t)
                                                        const type = testTypeLabel(t.testType)
                                                        const source = sourceBadge(t.source)
                                                        const summary = result ? getAttemptSummary(result) : null
                                                        return (
                                                            <button
                                                                key={t.id}
                                                                type="button"
                                                                onClick={() => { void openPublicTest(t) }}
                                                                className={`test-catalog-row${recommended ? ' is-recommended' : ''}${done ? ' is-completed' : ''}`}
                                                            >
                                                                <div className="test-catalog-row__main">
                                                                    <div className="test-catalog-row__labels">
                                                                        {recommended && <span className="test-catalog-recommended-label"><Target aria-hidden="true" /> Sizga mos</span>}
                                                                        <span>{t.subject || 'Umumiy'}</span>
                                                                    </div>
                                                                    <p className="test-catalog-row__title">{t.title}</p>
                                                                    <div className="test-catalog-row__meta">
                                                                        <span>{t._count?.questions ?? 0} savol</span>
                                                                        <span>{typeof t.timeLimit === 'number' && t.timeLimit > 0 ? `${t.timeLimit} daqiqa` : 'Vaqtsiz'}</span>
                                                                        {type && <span>{type}</span>}
                                                                        {source && <span>{source.label}</span>}
                                                                        {t.premium && <span className="test-premium-badge"><Sparkles aria-hidden="true" /> Pro</span>}
                                                                    </div>
                                                                </div>
                                                                <div className="test-catalog-row__action">
                                                                    {done && summary && <span className="test-catalog-row__score">{summary.percent}%</span>}
                                                                    <span>{done ? 'Ko‘rish' : 'Boshlash'}</span>
                                                                    <ArrowRight aria-hidden="true" />
                                                                </div>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            )
                                        })()}
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
                                        {/* Imtihon countdown — DTM yaqin uchun urgency (rang: 30+ ko'k, 14-30 sariq, <14 qizil) */}
                                        {(() => {
                                            if (!profile?.examDate) return null
                                            const d = Math.ceil((new Date(profile.examDate).getTime() - Date.now()) / 86400000)
                                            if (!Number.isFinite(d) || d < 0) return null
                                            const c = d > 30 ? '#2563eb' : d > 14 ? '#ea580c' : '#dc2626'
                                            return (
                                                <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: `color-mix(in srgb, ${c} 10%, var(--bg-card))`, border: `1px solid color-mix(in srgb, ${c} 30%, transparent)` }}>
                                                    <Calendar className="h-6 w-6 flex-shrink-0" style={{ color: c }} />
                                                    <div>
                                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Imtihongacha</p>
                                                        <p className="text-xl font-bold" style={{ color: c }}>{d} kun qoldi</p>
                                                    </div>
                                                </div>
                                            )
                                        })()}
                                        {/* Stats grid */}
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {[
                                                { label: 'Ketma-ket kun', value: progressData?.currentStreak ?? 0, icon: <Flame className="h-5 w-5" />, color: '#ea580c' },
                                                // XP mobilda yashirin — "Bugun" ekrani chipida allaqachon bor (takror + joy)
                                                ...(isMobile ? [] : [{ label: 'XP', value: progressData?.xp ?? 0, icon: <Zap className="h-5 w-5" />, color: '#f59e0b' }]),
                                                { label: 'Yechilgan testlar', value: myResults.length, icon: <ClipboardList className="h-5 w-5" />, color: 'var(--brand)' },
                                                { label: "O'rtacha ball", value: `${Math.round(progressData?.avgScore ?? 0)}%`, icon: <Trophy className="h-5 w-5" />, color: 'var(--success)' },
                                                { label: 'Kartochkalar', value: `${reviewedFlashcards}/${totalFlashcards || 0}`, icon: <Brain className="h-5 w-5" />, color: 'var(--brand)' },
                                            ].map((s, i) => (
                                                <div key={i} className="rounded-2xl p-3 sm:p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                                    <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                                                        <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>{s.icon}</div>
                                                        <span className="text-[11px] sm:text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                                                    </div>
                                                    <p className="text-xl sm:text-2xl font-bold">{s.value}</p>
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
                                                                        style={{ background: summary.percent >= 70 ? 'color-mix(in srgb, var(--success) 12%, transparent)' : 'rgba(239,68,68,0.1)', color: summary.percent >= 70 ? 'var(--success)' : '#ef4444' }}>
                                                                        <Trophy className="h-4 w-4" />
                                                                    </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium truncate">{r.test?.title || publicTests.find(t => t.id === r.testId)?.title || 'Test'}</p>
                                                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleDateString('uz-UZ')}</p>
                                                                </div>
                                                                    <span className="text-sm font-bold flex-shrink-0" style={{ color: summary.percent >= 70 ? 'var(--success)' : '#ef4444' }}>{getAttemptMeta(r)}</span>
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
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                                {/* Zaif mavzu — BIR MARTA (avval har qatorda takrorlanardi: bir xil matn + tugma 5x) */}
                                                {weakTopicSummary && (
                                                    <button
                                                        onClick={() => {
                                                            setOverlayPanel(null)
                                                            void handleSend(`Mening zaif mavzularim: ${weakTopicSummary}. Shu mavzularni bugun o'rganish uchun qisqa reja tuzing va asosiy tushunchalarni tushuntiring.`, [])
                                                        }}
                                                        className="mt-3 w-full flex items-center gap-2.5 text-left text-[13px] font-semibold px-3.5 py-2.5 rounded-xl transition"
                                                        style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}
                                                    >
                                                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                                                        Zaif mavzularni o'rganish: {weakTopicSummary}
                                                    </button>
                                                )}
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

                                {/* PRO — billing/status serverdagi entitlement bilan bir xil holatni ko'rsatadi */}
                                {overlayPanel === 'pro' && (
                                    <div className="space-y-4">
                                        {/* Status banner */}
                                        <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: 'var(--brand-light)', border: '1px solid color-mix(in srgb, var(--brand) 24%, transparent)' }}>
                                            <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--brand) 16%, transparent)' }}>
                                                <Sparkles className="h-5 w-5" style={{ color: 'var(--brand)' }} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                    {pro.statusLabel}
                                                </p>
                                                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                                    {pro.loading
                                                        ? "Obuna ma'lumotlari serverdan olinmoqda."
                                                        : !pro.enforced
                                                            ? <>Hozir <strong style={{ color: 'var(--brand)' }}>barcha imkoniyatlar</strong> beta davrida hammaga bepul ochiq.</>
                                                            : pro.isPro
                                                                ? <>Barcha Pro imkoniyatlari ochiq{pro.until ? ` — ${new Date(pro.until).toLocaleDateString('uz-UZ')} gacha` : ''}.</>
                                                                : "Hozir Bepul rejadasiz. Pro obuna cheksiz AI so'rovlari va qo'shimcha imkoniyatlarni ochadi."}
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
                                            <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>
                                                {pro.enforced ? "Asosiy tayyorgarlik imkoniyatlari bilan boshlang." : "Beta davrida hammaga to'liq ochiq."}
                                            </p>
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
                                                {pro.statusLabel}
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
                                                                        <CheckCircle className="h-2.5 w-2.5" /> {pro.isPro ? (pro.enforced ? 'Faol' : 'Hozir ochiq') : 'Pro'}
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

                                            {/* CTA — Paylov hosted checkout */}
                                            <button
                                                type="button"
                                                onClick={() => { void startProCheckout() }}
                                                disabled={checkoutLoading || pro.loading || (pro.enforced && pro.isPro)}
                                                className="mt-4 w-full h-10 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-1.5 transition disabled:opacity-60"
                                                style={{ background: 'var(--k-accent-grad, var(--brand))', color: '#fff', boxShadow: 'var(--k-shadow-cta, none)' }}
                                            >
                                                {checkoutLoading
                                                    ? <>Yo'naltirilmoqda...</>
                                                    : pro.enforced && pro.isPro
                                                        ? <><CheckCircle className="h-4 w-4" /> Pro obuna faol</>
                                                        : <><Sparkles className="h-4 w-4" /> Pro sotib olish — {PRO_PRICE} {PRO_PRICE_PERIOD}</>}
                                            </button>
                                            <p className="text-[11px] mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
                                                {pro.enforced
                                                    ? "Paylov orqali xavfsiz to'lov. Karta va SMS-kod DTMMax'da saqlanmaydi."
                                                    : "Beta davrida Pro hammaga ochiq — hozircha to'lov olinmaydi."}
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

                {/* Mobil pastki tab-bar — asosiy bo'limlar birinchi ekranda ko'rinib tursin.
                    z-60: sidebar (50) va overlay (50) ustida — bo'limlar orasida bir bosishda o'tiladi */}
                {mobileTabBarVisible && (
                    <nav className="student-mobile-nav fixed bottom-0 left-0 right-0 flex items-stretch" aria-label="Mobil navigatsiya">
                        {([
                            { key: 'today', label: 'Bugun', Icon: House, active: isTodayView && !overlayPanel && !sideOpen, tap: () => { setOverlayPanel(null); setSideOpen(false); nav('/bugun') } },
                            { key: 'learn', label: 'O‘rganish', Icon: BookOpen, active: overlayPanel === 'flashcards', badge: dueFlashcards.length, tap: () => { setSideOpen(false); setOverlayPanel('flashcards') } },
                            { key: 'tests', label: 'Testlar', Icon: ClipboardList, active: overlayPanel === 'tests', badge: newTestIds.size, tap: () => { setSideOpen(false); setOverlayPanel('tests'); markTestsSeen(); void loadPublicTests(); void loadMyResults() } },
                            { key: 'tutor', label: 'AI ustoz', Icon: MessageSquare, active: !!chatId && !overlayPanel && !sideOpen, tap: openAiTutor },
                            { key: 'progress', label: 'Progress', Icon: TrendingUp, active: overlayPanel === 'progress', tap: () => { setSideOpen(false); setOverlayPanel('progress') } },
                        ] as Array<{ key: string; label: string; Icon: typeof Menu; active: boolean; badge?: number; tap: () => void }>).map(tab => (
                            <button key={tab.key} type="button" onClick={tab.tap}
                                className={`student-mobile-nav__item${tab.active ? ' is-active' : ''}`}
                                aria-current={tab.active ? 'page' : undefined}>
                                <tab.Icon className="h-5 w-5" />
                                <span>{tab.label}</span>
                                {(tab.badge ?? 0) > 0 && (
                                    <span className="student-mobile-nav__badge">
                                        {(tab.badge ?? 0) > 9 ? '9+' : tab.badge}
                                    </span>
                                )}
                            </button>
                        ))}
                    </nav>
                )}
            </div >
        </ChatContext.Provider>
    )
}
