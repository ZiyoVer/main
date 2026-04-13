import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BrainCircuit, CheckCircle, XCircle, ArrowLeft, Sparkles, LogIn, Lock, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import DOMPurify from 'dompurify'

function normalizeMathText(text: string): string {
    return text
        .replace(/\\\[(\s*[\s\S]*?\s*)\\\]/g, (_, m) => `\n$$\n${m.trim()}\n$$\n`)
        .replace(/\\\((\s*[\s\S]*?\s*)\\\)/g, (_, m) => `$${m.trim()}$`)
}

function MathPreview({ text, inline }: { text: string; inline?: boolean }) {
    const normalized = normalizeMathText(text || '')
    if (!normalized.includes('$')) return null
    try {
        const html = normalized
            .replace(/\$\$([^$]+)\$\$/g, (_, m) => katex.renderToString(m.trim(), { displayMode: true, throwOnError: false }))
            .replace(/\$([^$\n]+)\$/g, (_, m) => katex.renderToString(m.trim(), { throwOnError: false }))
        if (inline) return <span className="inline-block ml-1" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
        return <div className="mt-1 mb-2 px-2.5 py-1.5 rounded-lg text-sm overflow-x-auto" style={{ background: 'color-mix(in srgb, var(--brand) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--brand) 15%, transparent)', color: 'var(--text-primary)' }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
    } catch { return null }
}

function TextWithMath({ text }: { text: string }) {
    if (!text) return null
    const normalized = normalizeMathText(text)
    if (!normalized.includes('$')) return <>{text}</>
    const parts = normalized.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+\$)/g)
    return <>
        {parts.map((part, i) => {
            if (/^\$\$[\s\S]+?\$\$$/.test(part)) {
                const formula = part.slice(2, -2).trim()
                try {
                    return <span key={i} className="block my-1 overflow-x-auto" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(katex.renderToString(formula, { displayMode: true, throwOnError: false })) }} />
                } catch {
                    return <span key={i}>{part}</span>
                }
            }
            if (/^\$[^$\n]+\$$/.test(part)) {
                const formula = part.slice(1, -1)
                try { return <span key={i} className="inline-block mx-0.5 align-middle" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(katex.renderToString(formula, { throwOnError: false })) }} /> }
                catch { return <span key={i}>{part}</span> }
            }
            return <span key={i}>{part}</span>
        })}
    </>
}

function formatAcceptedAnswerText(text: string | null | undefined) {
    return String(text || '')
        .split(/\r?\n+/)
        .map(part => part.trim())
        .filter(Boolean)
        .join(' / ')
}

type ParsedQuestionOptions = string[] | {
    answers?: string[]
    subQuestions?: Array<{ label?: string; text: string; correctText?: string }>
} | null
type MatchingOptions = { answers?: string[]; subQuestions?: Array<{ text: string }> }
type MultipartOptions = { subQuestions?: Array<{ label?: string; text: string; correctText?: string }> }

function parseQuestionOptions(raw: unknown): ParsedQuestionOptions {
    if (!raw) return null
    if (typeof raw !== 'string') {
        return typeof raw === 'object' ? raw as ParsedQuestionOptions : null
    }
    try {
        return JSON.parse(raw) as ParsedQuestionOptions
    } catch {
        return null
    }
}

function parseChoiceOptions(raw: unknown): string[] {
    const parsed = parseQuestionOptions(raw)
    return Array.isArray(parsed) ? parsed : []
}

function parseMatchingOptions(raw: unknown): MatchingOptions | null {
    const parsed = parseQuestionOptions(raw)
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return null
    return parsed as MatchingOptions
}

function parseMultipartOptions(raw: unknown): MultipartOptions | null {
    const parsed = parseQuestionOptions(raw)
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return null
    return parsed as MultipartOptions
}

const OPTS = ['A', 'B', 'C', 'D'] as const
type AnswerValue = number | string | string[] | Record<number, number>
type CorrectAnswerMap = Record<string, { idx: number; text?: string; type: string; matchingCorrect?: number[]; multipartCorrectText?: Array<{ label: string; text: string; correctText: string }> }>

export default function TestPage() {
    const { shareLink } = useParams<{ shareLink: string }>()
    const nav = useNavigate()
    const { token, user } = useAuthStore()
    const [test, setTest] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [err, setErr] = useState('')
    const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
    const [submitted, setSubmitted] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [submitting, setSubmitting] = useState(false)
    const [correctMap, setCorrectMap] = useState<CorrectAnswerMap>({})
    const [analysisReady, setAnalysisReady] = useState(false)
    const [focusedQ, setFocusedQ] = useState(0) // for DTM mode: highlight active question

    const questionsRef = useRef<HTMLDivElement>(null)
    const analysisNavTimeoutRef = useRef<number | null>(null)
    const isGuest = !token || !user

    useEffect(() => {
        return () => {
            if (analysisNavTimeoutRef.current != null) {
                window.clearTimeout(analysisNavTimeoutRef.current)
            }
        }
    }, [])

    useEffect(() => {
        if (!shareLink) return
        fetchApi(`/tests/by-link/${shareLink}`)
            .then(t => { setTest(t); setFocusedQ(0) })
            .catch(e => setErr(e.message || 'Test topilmadi'))
            .finally(() => setLoading(false))
    }, [shareLink])

    useEffect(() => {
        if (isGuest) return
        const sendPing = () => fetchApi('/auth/ping', { method: 'POST', body: JSON.stringify({ page: 'test' }), silent: true }).catch(() => { })
        sendPing()
        const pingInterval = setInterval(sendPing, 60000)
        return () => clearInterval(pingInterval)
    }, [isGuest])

    async function submit() {
        if (!test) return
        if (isGuest) {
            toast.error('Testni ishlash uchun avval kiring')
            nav('/kirish', { state: { from: `/test/${shareLink}` } })
            return
        }
        if (answeredCount < total) {
            const confirmed = window.confirm(`${total - answeredCount} ta savol javobsiz qolgan. Shunga qaramay testni topshirmoqchimisiz?`)
            if (!confirmed) return
        }
        setSubmitting(true)
        try {
            const payload = test.questions.map((q: any) => {
                if (q.questionType === 'open') return { questionId: q.id, selectedIdx: -1, textAnswer: answers[q.id] ?? '' }
                if (q.questionType === 'multipart_open') {
                    const multipartData = parseMultipartOptions(q.options)
                    const textAnswers = Array.isArray(answers[q.id]) ? answers[q.id] as string[] : []
                    return {
                        questionId: q.id,
                        selectedIdx: -1,
                        textAnswers: (multipartData?.subQuestions || []).map((_: { text: string }, subIndex: number) => textAnswers[subIndex] ?? '')
                    }
                }
                if (q.questionType === 'matching') {
                    const selMap = (answers[q.id] || {}) as Record<number, number>
                    const parsedOptions = parseMatchingOptions(q.options)
                    const matchingAnswers = (parsedOptions?.subQuestions || []).map((_, si: number) => selMap[si] ?? -1)
                    return { questionId: q.id, selectedIdx: -1, matchingAnswers }
                }
                return { questionId: q.id, selectedIdx: answers[q.id] ?? -1 }
            })
            const res = await fetchApi(`/tests/${test.id}/submit`, { method: 'POST', body: JSON.stringify({ answers: payload, shareLink }) })
            setResult(res)
            const map: CorrectAnswerMap = {}
            res.correctAnswers?.forEach((ca: any) => {
                map[ca.id] = {
                    idx: ca.correctIdx,
                    text: ca.correctText,
                    type: ca.questionType || 'mcq',
                    matchingCorrect: ca.matchingCorrect,
                    multipartCorrectText: ca.multipartCorrectText
                }
            })
            setCorrectMap(map)
            setSubmitted(true)
            const optLabels = ['a', 'b', 'c', 'd']
            const questionsForAnalysis = test.questions.map((q: any, i: number) => {
                const opts = parseChoiceOptions(q.options)
                const matchingData = q.questionType === 'matching' ? parseMatchingOptions(q.options) : null
                const multipartData = q.questionType === 'multipart_open' ? (parseMultipartOptions(q.options) || { subQuestions: [] }) : { subQuestions: [] }
                const ca = res.correctAnswers?.find((c: any) => c.id === q.id)
                const studentIdx = payload[i]?.selectedIdx ?? -1
                if (q.questionType === 'matching' && matchingData) {
                    const selMap = (answers[q.id] || {}) as Record<number, number>
                    // ca.matchingCorrect — backend submitdan keyin qaytaradi (by-link da correctIdx yo'q)
                    const subAnswers = (matchingData.subQuestions || []).map((sq: any, si: number) => ({
                        subText: sq.text,
                        studentAnswer: selMap[si] !== undefined ? String.fromCharCode(65 + selMap[si]) : '—',
                        correctAnswer: ca?.matchingCorrect?.[si] !== undefined ? String.fromCharCode(65 + ca.matchingCorrect[si]) : '?'
                    }))
                    return { text: q.text, imageUrl: q.imageUrl || null, questionType: 'matching', matchingAnswers: matchingData.answers, subAnswers, studentAnswer: null, correctAnswer: null, a: null, b: null, c: null, d: null }
                }
                if (q.questionType === 'multipart_open' && multipartData) {
                    const textAnswers = Array.isArray(answers[q.id]) ? answers[q.id] as string[] : []
                    const subAnswers = (multipartData.subQuestions || []).map((subQuestion, subIndex) => ({
                        label: subQuestion.label || String.fromCharCode(65 + subIndex),
                        subText: subQuestion.text,
                        studentAnswer: textAnswers[subIndex] || '—',
                        correctAnswer: ca?.multipartCorrectText?.[subIndex]?.correctText || subQuestion.correctText || '—'
                    }))
                    return { text: q.text, imageUrl: q.imageUrl || null, questionType: 'multipart_open', subAnswers, studentAnswer: null, correctAnswer: null, a: null, b: null, c: null, d: null }
                }
                return { text: q.text, imageUrl: q.imageUrl || null, questionType: q.questionType || 'mcq', studentAnswer: studentIdx >= 0 ? optLabels[studentIdx] : (payload[i]?.textAnswer || null), correctAnswer: ca ? (ca.correctIdx >= 0 ? optLabels[ca.correctIdx] : ca.correctText) : null, a: opts[0], b: opts[1], c: opts[2], d: opts[3] }
            })
            // Clear old analysis chat so "AI tahlil" button opens the new one
            localStorage.removeItem('dtmmax_analysis_chat_id')
            localStorage.setItem('dtmmax_guest_test_result', JSON.stringify({ title: test.title, subject: test.subject, score: res.correct, total: res.total, questions: questionsForAnalysis }))
            setAnalysisReady(true)
            if (analysisNavTimeoutRef.current != null) {
                window.clearTimeout(analysisNavTimeoutRef.current)
            }
            analysisNavTimeoutRef.current = window.setTimeout(() => {
                // If analysis chat already exists from a previous submit, go there; else trigger new analysis
                const existingChatId = localStorage.getItem('dtmmax_analysis_chat_id')
                if (existingChatId) nav(`/suhbat/${existingChatId}`)
                else nav('/suhbat?analyzeTest=true')
            }, 2500)
        } catch (e: any) { toast.error(e.message || 'Test yuborishda xatolik yuz berdi') }
        finally { setSubmitting(false) }
    }

    function scrollToQuestion(idx: number) {
        const el = questionsRef.current?.querySelector(`[data-qi="${idx}"]`) as HTMLElement | null
        const container = questionsRef.current
        if (el && container) {
            // Use getBoundingClientRect to scroll ONLY the questions container — not the window
            const cRect = container.getBoundingClientRect()
            const eRect = el.getBoundingClientRect()
            const pad = 8
            if (eRect.top < cRect.top + pad) {
                container.scrollTop += eRect.top - cRect.top - pad
            } else if (eRect.bottom > cRect.bottom - pad) {
                container.scrollTop += eRect.bottom - cRect.bottom + pad
            }
            // Already in view → no scroll (prevents blank space jumping)
        }
        setFocusedQ(idx)
    }

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
            <div className="text-center">
                <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2" style={{ borderColor: 'var(--border-strong)', borderTopColor: 'var(--brand)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Yuklanmoqda...</p>
            </div>
        </div>
    )

    if (err) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
            <div className="text-center">
                <p className="text-sm mb-3" style={{ color: 'var(--danger)' }}>{err}</p>
                <button onClick={() => nav('/')} className="text-sm" style={{ color: 'var(--brand)' }}>Bosh sahifaga qaytish</button>
            </div>
        </div>
    )

    const answeredCount = test?.questions?.filter((q: any) => {
        const a = answers[q.id]
        if (q.questionType === 'open') return typeof a === 'string' && a.trim().length > 0
        if (q.questionType === 'multipart_open') {
            if (!Array.isArray(a)) return false
            const parsedOptions = parseMultipartOptions(q.options)
            const numSubs = (parsedOptions?.subQuestions || []).length
            return numSubs > 0 && a.length >= numSubs && a.every(answer => typeof answer === 'string' && answer.trim().length > 0)
        }
        if (q.questionType === 'matching') {
            if (!a || typeof a !== 'object') return false
            const parsedOptions = parseMatchingOptions(q.options)
            const numSubs = (parsedOptions?.subQuestions || []).length
            return numSubs > 0 && Object.keys(a as object).length >= numSubs
        }
        return typeof a === 'number'
    }).length ?? 0
    const total = test?.questions?.length || 0
    const isDtm = test?.testType === 'dtm'

    // ─────────────────── DTM MODE ───────────────────
    if (isDtm) return <DtmTestView
        test={test} answers={answers} setAnswers={setAnswers}
        submitted={submitted} result={result} correctMap={correctMap}
        submitting={submitting} submit={submit}
        answeredCount={answeredCount} total={total}
        isGuest={isGuest} analysisReady={analysisReady}
        focusedQ={focusedQ} setFocusedQ={setFocusedQ}
        questionsRef={questionsRef} scrollToQuestion={scrollToQuestion}
        nav={nav} token={token}
    />

    // ─────────────────── STANDARD MODE ───────────────────
    return (
        <div className="overflow-y-auto w-full overscroll-contain" style={{ background: 'var(--bg-page)', height: '100dvh' }}>
            <header className="sticky top-0 z-40" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
                <div className="max-w-2xl mx-auto flex items-center justify-between py-3 px-5">
                    <div className="flex items-center gap-2">
                        <button onClick={() => nav(token ? '/suhbat' : '/')} className="h-7 w-7 flex items-center justify-center rounded-lg transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                        <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ background: 'var(--brand)' }}><BrainCircuit className="h-3 w-3 text-white" /></div>
                        <span className="text-sm font-bold truncate max-w-[200px]">{test?.title}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {!isGuest && !submitted && <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{answeredCount}/{total}</span>}
                        {isGuest && <button onClick={() => nav('/kirish', { state: { from: `/test/${shareLink}` } })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white" style={{ background: 'var(--brand)' }}><LogIn className="h-3.5 w-3.5" /> Kirish</button>}
                    </div>
                </div>
                {/* Thin progress bar */}
                {!submitted && !isGuest && (
                    <div className="h-0.5 w-full" style={{ background: 'var(--bg-muted)' }}>
                        <div className="h-full transition-all duration-300" style={{ width: `${total ? (answeredCount / total) * 100 : 0}%`, background: 'var(--brand)' }} />
                    </div>
                )}
            </header>

            <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
                {/* Test info */}
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <p className="text-sm font-semibold">{test?.title}</p>
                    <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {test?.subject} · {total} savol · {test?.creator?.name}
                    </p>
                </div>

                {isGuest && !submitted && (
                    <div className="rounded-xl p-5" style={{ border: '1px solid color-mix(in srgb, var(--brand) 25%, transparent)', background: 'var(--bg-card)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ background: 'var(--brand)' }}><Lock className="h-3.5 w-3.5 text-white" /></div>
                            <span className="text-[13px] font-semibold">Testni yechish uchun kiring</span>
                        </div>
                        <p className="text-[13px] mb-4" style={{ color: 'var(--text-secondary)' }}>Yechish va AI tahlil olish uchun akkauntga kirish kerak.</p>
                        <button onClick={() => nav('/kirish', { state: { from: `/test/${shareLink}` } })} className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ background: 'var(--brand)' }}><LogIn className="h-4 w-4" /> Yechishni boshlash uchun kiring</button>
                    </div>
                )}

                {submitted && result && (
                    <div className="rounded-xl p-5 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center justify-center gap-4 mb-2">
                            <div className="text-4xl font-extrabold" style={{ color: result.score >= 70 ? 'var(--success)' : result.score >= 50 ? 'var(--warning)' : 'var(--danger)' }}>{result.score}%</div>
                            {result.grade && <div className="text-3xl font-extrabold" style={{ color: result.grade.startsWith('A') ? 'var(--success)' : result.grade.startsWith('B') ? 'var(--info)' : result.grade.startsWith('C') ? 'var(--warning)' : 'var(--danger)' }}>{result.grade}</div>}
                        </div>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{result.correct} / {result.total} ball</p>
                        <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                            {result.dtmBall !== undefined && <div className="px-3 py-1.5 rounded-lg text-[12px] font-semibold" style={{ background: 'color-mix(in srgb, var(--brand) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--brand) 25%, transparent)', color: 'var(--brand)' }}>DTM: {result.dtmBall} / {result.dtmMax}</div>}
                        </div>
                    </div>
                )}

                {submitted && analysisReady && (
                    <div className="rounded-xl p-4" style={{ border: '1px solid color-mix(in srgb, var(--brand) 25%, transparent)', background: 'var(--bg-card)' }}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin flex-shrink-0" style={{ borderColor: 'color-mix(in srgb, var(--brand) 30%, transparent)', borderTopColor: 'var(--brand)' }} />
                            <p className="text-[13px] font-semibold">AI tahlil uchun chatga o'tilmoqda...</p>
                        </div>
                        <button onClick={() => { const id = localStorage.getItem('dtmmax_analysis_chat_id'); nav(id ? `/suhbat/${id}` : '/suhbat?analyzeTest=true') }} className="w-full h-10 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ background: 'var(--brand)' }}><MessageSquare className="h-4 w-4" /> Hozir o'tish</button>
                    </div>
                )}

                {/* Questions */}
                {test?.questions?.map((q: any, qi: number) => {
                    const opts = parseChoiceOptions(q.options)
                    const matchingData = q.questionType === 'matching' ? parseMatchingOptions(q.options) : null
                    const multipartData = q.questionType === 'multipart_open' ? (parseMultipartOptions(q.options) || { subQuestions: [] }) : { subQuestions: [] }
                    const correct = submitted ? correctMap[q.id] : null
                    const correctIdx = correct?.idx ?? -1
                    const isOpen = q.questionType === 'open'
                    const isMultipartOpen = q.questionType === 'multipart_open'
                    const isMatching = q.questionType === 'matching'
                    const textAnswer = typeof answers[q.id] === 'string' ? answers[q.id] as string : ''
                    const multipartAnswers = Array.isArray(answers[q.id]) ? answers[q.id] as string[] : []
                    const serverResult = result?.results?.find((r: any) => r.questionId === q.id)
                    const isCorrectOpen = submitted && correct?.type === 'open' ? (serverResult ? serverResult.isCorrect : textAnswer.trim().toLowerCase() === (correct.text || '').trim().toLowerCase()) : false
                    return (
                        <div key={q.id} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                            <div className="flex items-start gap-2 mb-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>{qi + 1}</span>
                                <p className="text-[13px] font-medium leading-relaxed flex-1"><TextWithMath text={q.text} /></p>
                            </div>
                            {q.imageUrl && <img src={q.imageUrl} alt="Test savoli" className="max-w-full rounded-lg border mb-3" style={{ borderColor: 'var(--border)' }} />}
                            {isMatching && matchingData ? (
                                /* Moslashtirish savoli */
                                <div>
                                    {/* Answer bank */}
                                    <div className="flex flex-wrap gap-1.5 mb-3 p-2 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                        {(matchingData.answers || []).map((ans: string, ai: number) => (
                                            <span key={ai} className="px-2 py-1 rounded text-[12px] font-medium" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                                                <span style={{ color: '#8b5cf6', fontWeight: 700 }}>{String.fromCharCode(65 + ai)})</span> <TextWithMath text={ans} />
                                            </span>
                                        ))}
                                    </div>
                                    {/* Sub-questions */}
                                    <div className="space-y-2">
                                        {(matchingData.subQuestions || []).map((sq: any, si: number) => {
                                            const selMap = (answers[q.id] || {}) as Record<number, number>
                                            const sel = selMap[si]
                                            const correctSubIdx = correct?.matchingCorrect?.[si] ?? -1
                                            const subResult = serverResult?.subResults?.[si]
                                            const isSubCorrect = submitted ? (sel === correctSubIdx) : false
                                            return (
                                                <div key={si} className="p-3 rounded-lg" style={{ border: `1px solid ${submitted ? (isSubCorrect ? 'var(--success)' : 'var(--danger)') : 'var(--border)'}`, background: 'var(--bg-surface)' }}>
                                                    <p className="text-[12px] mb-2 font-medium"><span style={{ color: 'var(--text-muted)' }}>{si + 1}.</span> <TextWithMath text={sq.text} /></p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {(matchingData.answers || []).map((_: string, ai: number) => {
                                                            const isSel = sel === ai
                                                            const isCorr = submitted && ai === correctSubIdx
                                                            const isWrong = submitted && isSel && !isCorr
                                                            let sty: any = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }
                                                            if (isCorr) sty = { background: 'var(--success-light)', border: '1px solid var(--success)', color: 'var(--success)', fontWeight: 700 }
                                                            else if (isWrong) sty = { background: 'var(--danger-light)', border: '1px solid var(--danger)', color: 'var(--danger)' }
                                                            else if (!submitted && isSel) sty = { background: 'color-mix(in srgb, #8b5cf6 10%, transparent)', border: '1px solid #8b5cf6', color: '#8b5cf6', fontWeight: 700 }
                                                            return (
                                                                <button key={ai} disabled={submitted || isGuest}
                                                                    onClick={() => !isGuest && setAnswers((a: any) => ({ ...a, [q.id]: { ...(a[q.id] || {}), [si]: ai } }))}
                                                                    className="w-8 h-8 rounded-lg text-[12px] font-bold transition flex items-center justify-center"
                                                                    style={{ ...sty, cursor: submitted || isGuest ? 'default' : 'pointer' }}>
                                                                    {String.fromCharCode(65 + ai)}
                                                                </button>
                                                            )
                                                        })}
                                                        {submitted && (
                                                            <span className="ml-1 flex items-center">
                                                                {isSubCorrect ? <CheckCircle className="h-4 w-4" style={{ color: 'var(--success)' }} /> : <XCircle className="h-4 w-4" style={{ color: 'var(--danger)' }} />}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ) : isMultipartOpen ? (
                                <div className="space-y-2">
                                    {(multipartData.subQuestions || []).map((subQuestion, subIndex) => {
                                        const subResult = serverResult?.subResults?.[subIndex]
                                        const isSubCorrect = submitted ? !!subResult?.isCorrect : false
                                        const label = subQuestion.label || String.fromCharCode(65 + subIndex)
                                        return (
                                            <div key={subIndex} className="p-3 rounded-lg" style={{ border: `1px solid ${submitted ? (isSubCorrect ? 'var(--success)' : 'var(--danger)') : 'var(--border)'}`, background: 'var(--bg-surface)' }}>
                                                <p className="text-[12px] mb-2 font-medium"><span style={{ color: '#0f766e' }}>{label})</span> <TextWithMath text={subQuestion.text} /></p>
                                                <textarea
                                                    disabled={submitted || isGuest}
                                                    value={multipartAnswers[subIndex] || ''}
                                                    onChange={event => !isGuest && setAnswers(currentAnswers => {
                                                        const nextAnswers = Array.isArray(currentAnswers[q.id]) ? [...currentAnswers[q.id] as string[]] : []
                                                        nextAnswers[subIndex] = event.target.value
                                                        return { ...currentAnswers, [q.id]: nextAnswers }
                                                    })}
                                                    placeholder={isGuest ? "Yechish uchun kiring..." : `${label}) javobingizni yozing...`}
                                                    rows={2}
                                                    className="w-full rounded-lg border px-3 py-2 text-[13px] resize-none outline-none"
                                                    style={{ background: 'var(--bg-card)', borderColor: submitted ? (isSubCorrect ? 'var(--success)' : 'var(--danger)') : (multipartAnswers[subIndex] || '').trim() ? '#0f766e' : 'var(--border)', color: 'var(--text-primary)' }}
                                                />
                                                {submitted && (
                                                    <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg text-[12px]" style={{ background: isSubCorrect ? 'var(--success-light)' : 'var(--danger-light)', color: isSubCorrect ? 'var(--success)' : 'var(--danger)' }}>
                                                        {isSubCorrect ? <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" /> : <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />}
                                                        <div>
                                                            <p>{isSubCorrect ? 'To\'g\'ri!' : 'To\'g\'ri javob:'}</p>
                                                            {!isSubCorrect && <p className="font-semibold"><TextWithMath text={formatAcceptedAnswerText(subResult?.correctText || correct?.multipartCorrectText?.[subIndex]?.correctText || '')} /></p>}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : isOpen ? (
                                <div className="space-y-2">
                                    <textarea disabled={submitted || isGuest} value={textAnswer} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} placeholder={isGuest ? "Yechish uchun kiring..." : "Javobingizni yozing..."} rows={3} className="w-full rounded-lg border px-3 py-2 text-[13px] resize-none outline-none" style={{ background: 'var(--bg-surface)', borderColor: submitted ? (isCorrectOpen ? 'var(--success)' : 'var(--danger)') : textAnswer.trim() ? 'var(--brand)' : 'var(--border)', color: 'var(--text-primary)' }} />
                                    {submitted && <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px]" style={{ background: isCorrectOpen ? 'var(--success-light)' : 'var(--danger-light)', color: isCorrectOpen ? 'var(--success)' : 'var(--danger)' }}>{isCorrectOpen ? <><CheckCircle className="h-3.5 w-3.5 flex-shrink-0" /> To'g'ri!</> : <><XCircle className="h-3.5 w-3.5 flex-shrink-0" /> To'g'ri: <span className="font-semibold">{formatAcceptedAnswerText(correct?.text)}</span></>}</div>}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {opts.map((opt, oi) => {
                                        const sel = answers[q.id]
                                        let bg = 'var(--bg-surface)', border = 'var(--border)', color = isGuest ? 'var(--text-muted)' : 'var(--text-primary)'
                                        if (!submitted && !isGuest && sel === oi) { bg = 'var(--brand-light)'; border = 'var(--brand)'; color = 'var(--brand-hover)' }
                                        if (submitted) {
                                            if (oi === correctIdx) { bg = 'var(--success-light)'; border = 'var(--success)'; color = 'var(--success)' }
                                            else if (sel === oi) { bg = 'var(--danger-light)'; border = 'var(--danger)'; color = 'var(--danger)' }
                                            else { bg = 'var(--bg-surface)'; border = 'var(--border)'; color = 'var(--text-muted)' }
                                        }
                                        return (
                                            <button key={oi} type="button" disabled={submitted || isGuest} onClick={() => !isGuest && setAnswers(a => ({ ...a, [q.id]: oi }))} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-left text-[13px] transition" style={{ background: bg, borderColor: border, color, cursor: isGuest ? 'not-allowed' : 'pointer', opacity: isGuest ? 0.7 : 1 }}>
                                                <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-[10px] font-bold border-current">{OPTS[oi]}</span>
                                                <span className="flex-1 pointer-events-none"><TextWithMath text={opt} /></span>
                                                {submitted && oi === correctIdx && <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--success)' }} />}
                                                {submitted && sel === oi && oi !== correctIdx && <XCircle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--danger)' }} />}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )
                })}

                {!submitted && (
                    isGuest
                        ? <button onClick={() => nav('/kirish', { state: { from: `/test/${shareLink}` } })} className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ background: 'var(--brand)' }}><LogIn className="h-4 w-4" /> Yechishni boshlash uchun kiring</button>
                        : <button onClick={submit} disabled={submitting || answeredCount === 0} className="w-full h-11 rounded-xl text-sm font-semibold text-white transition disabled:opacity-40" style={{ background: 'var(--text-primary)' }}>{submitting ? 'Tekshirilmoqda...' : `Testni yuborish (${answeredCount}/${total})`}</button>
                )}
                {submitted && <button onClick={() => nav('/suhbat')} className="w-full h-11 rounded-xl text-sm font-semibold transition" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>Chatga qaytish</button>}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// DTM TEST VIEW — split screen: questions left, blanka right
// ─────────────────────────────────────────────────────────────
function DtmTestView({ test, answers, setAnswers, submitted, result, correctMap, submitting, submit, answeredCount, total, isGuest, analysisReady, focusedQ, setFocusedQ, questionsRef, scrollToQuestion, nav, token }: any) {
    const shareLink = test?.shareLink
    const questions: any[] = test?.questions || []
    const [isCompactLayout, setIsCompactLayout] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 1024 : false)
    const [isAnswerSheetOpen, setIsAnswerSheetOpen] = useState(false)

    function markAnswer(qId: string, oi: number, qi: number) {
        if (submitted || isGuest) return
        setAnswers((a: any) => ({ ...a, [qId]: oi }))
        setFocusedQ(qi)
        scrollToQuestion(qi)
    }

    useEffect(() => {
        if (typeof window === 'undefined') return
        const mediaQuery = window.matchMedia('(max-width: 1023px)')
        const handleMediaChange = (event?: MediaQueryListEvent) => {
            setIsCompactLayout(event ? event.matches : mediaQuery.matches)
        }

        handleMediaChange()

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handleMediaChange)
            return () => mediaQuery.removeEventListener('change', handleMediaChange)
        }

        mediaQuery.addListener(handleMediaChange)
        return () => mediaQuery.removeListener(handleMediaChange)
    }, [])

    useEffect(() => {
        if (!isCompactLayout) {
            setIsAnswerSheetOpen(false)
        }
    }, [isCompactLayout])

    function renderSheetRows() {
        return questions.map((q: any, qi: number) => {
            const correct = submitted ? correctMap[q.id] : null
            const correctIdx = correct?.idx ?? -1
            const selectedAnswer = answers[q.id]
            const isFocused = focusedQ === qi
            const isMatching = q.questionType === 'matching'

            if (isMatching) {
                const matchingData = parseMatchingOptions(q.options) || { answers: [], subQuestions: [] }
                const selectedMap = (selectedAnswer || {}) as Record<number, number>
                const answerCount = matchingData.answers?.length || 6
                const alphabet = 'ABCDEF'

                return (
                    <div key={q.id}>
                        <div className="flex items-center px-4 py-1" style={{ background: 'color-mix(in srgb, #8b5cf6 6%, transparent)' }}>
                            <span className="text-[10px] font-bold" style={{ color: '#8b5cf6' }}>
                                {qi + 1}. Moslashtirish ({matchingData.subQuestions?.length || 0} kichik savol)
                            </span>
                        </div>
                        <div className="flex items-center px-4 py-0.5" style={{ borderBottom: '1px solid var(--border)' }}>
                            <span className="w-12 flex-shrink-0" />
                            {Array.from({ length: answerCount }, (_, answerIndex) => (
                                <span key={answerIndex} className="flex-1 text-center text-[10px] font-bold" style={{ color: '#8b5cf6' }}>{alphabet[answerIndex]}</span>
                            ))}
                        </div>
                        {(matchingData.subQuestions || []).map((subQuestion, subIndex) => {
                            const selectedSubAnswer = selectedMap[subIndex]
                            const correctSubIdx = correct?.matchingCorrect?.[subIndex] ?? -1

                            return (
                                <div key={subIndex}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => scrollToQuestion(qi)}
                                    onKeyDown={event => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault()
                                            scrollToQuestion(qi)
                                        }
                                    }}
                                    className="w-full flex items-center px-4 transition"
                                    style={{
                                        height: 32,
                                        background: isFocused ? 'color-mix(in srgb, #8b5cf6 6%, transparent)' : 'transparent',
                                        borderLeft: isFocused ? '3px solid #8b5cf6' : '3px solid transparent'
                                    }}>
                                    <span className="w-12 flex-shrink-0 text-[11px] font-semibold text-left" style={{ color: isFocused ? '#8b5cf6' : 'var(--text-muted)' }}>
                                        {qi + 1}.{subIndex + 1}
                                    </span>
                                    {Array.from({ length: answerCount }, (_, answerIndex) => {
                                        const isSelected = selectedSubAnswer === answerIndex
                                        const isCorrect = submitted && answerIndex === correctSubIdx
                                        const isWrong = submitted && isSelected && !isCorrect

                                        return (
                                            <button key={answerIndex}
                                                onClick={event => {
                                                    event.stopPropagation()
                                                    if (submitted || isGuest) return
                                                    setAnswers((currentAnswers: any) => ({ ...currentAnswers, [q.id]: { ...(currentAnswers[q.id] || {}), [subIndex]: answerIndex } }))
                                                    setFocusedQ(qi)
                                                    scrollToQuestion(qi)
                                                }}
                                                disabled={submitted || isGuest}
                                                className="flex-1 flex items-center justify-center"
                                                style={{ cursor: submitted || isGuest ? 'default' : 'pointer' }}>
                                                {isSelected || isCorrect ? (
                                                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all"
                                                        style={{
                                                            background: isWrong ? 'var(--danger)' : isCorrect ? 'var(--success)' : '#8b5cf6',
                                                            color: 'white',
                                                            transform: isSelected && !submitted ? 'scale(1.1)' : 'scale(1)'
                                                        }}>
                                                        {alphabet[answerIndex]}
                                                    </span>
                                                ) : (
                                                    <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                                                        style={{ borderColor: 'var(--border-strong)', opacity: submitted ? 0.2 : 1 }} />
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )
                        })}
                    </div>
                )
            }

            return (
                <div key={q.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => scrollToQuestion(qi)}
                    onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            scrollToQuestion(qi)
                        }
                    }}
                    className="w-full flex items-center px-4 transition"
                    style={{
                        height: 36,
                        background: isFocused ? 'color-mix(in srgb, var(--brand) 8%, transparent)' : 'transparent',
                        borderLeft: isFocused ? '3px solid var(--brand)' : '3px solid transparent'
                    }}>
                    <span className="w-9 flex-shrink-0 text-[12px] font-semibold text-left" style={{ color: isFocused ? 'var(--brand)' : 'var(--text-muted)' }}>
                        {qi + 1}
                    </span>
                    {[0, 1, 2, 3].map(answerIndex => {
                        const isSelected = selectedAnswer === answerIndex
                        const isCorrect = submitted && answerIndex === correctIdx
                        const isWrong = submitted && isSelected && !isCorrect

                        return (
                            <button key={answerIndex}
                                onClick={event => {
                                    event.stopPropagation()
                                    markAnswer(q.id, answerIndex, qi)
                                }}
                                disabled={submitted || isGuest}
                                className="flex-1 flex items-center justify-center"
                                style={{ cursor: submitted || isGuest ? 'default' : 'pointer' }}>
                                {isSelected || isCorrect ? (
                                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                                        style={{
                                            background: isWrong ? 'var(--danger)' : isCorrect ? 'var(--success)' : 'var(--text-primary)',
                                            color: 'white',
                                            transform: isSelected && !submitted ? 'scale(1.1)' : 'scale(1)'
                                        }}>
                                        {OPTS[answerIndex]}
                                    </span>
                                ) : (
                                    <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all hover:border-current"
                                        style={{ borderColor: 'var(--border-strong)', opacity: submitted ? 0.25 : 1 }} />
                                )}
                            </button>
                        )
                    })}
                </div>
            )
        })
    }

    function renderSheetFooter(isCompactFooter = false) {
        const footerPadding = isCompactFooter ? 'p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]' : 'p-3'
        const buttonHeight = isCompactFooter ? 'h-10' : 'h-9'

        if (isGuest) {
            return (
                <div className={footerPadding} style={{ borderTop: '1px solid var(--border)' }}>
                    <button onClick={() => nav('/kirish', { state: { from: `/test/${shareLink}` } })} className={`w-full ${buttonHeight} rounded-xl text-[12px] font-semibold text-white flex items-center justify-center gap-1.5`} style={{ background: 'var(--brand)' }}>
                        <LogIn className="h-3.5 w-3.5" /> Kiring
                    </button>
                </div>
            )
        }

        if (submitted) {
            return (
                <div className={footerPadding} style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="text-center">
                        <p className="text-xl font-extrabold" style={{ color: result?.score >= 70 ? 'var(--success)' : result?.score >= 50 ? 'var(--warning)' : 'var(--danger)' }}>{result?.score ?? 0}%</p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{result?.correct}/{result?.total} ball</p>
                        {analysisReady && (
                            <button onClick={() => { const id = localStorage.getItem('dtmmax_analysis_chat_id'); nav(id ? `/suhbat/${id}` : '/suhbat?analyzeTest=true') }} className={`mt-2 w-full ${buttonHeight} rounded-lg text-[12px] font-semibold text-white flex items-center justify-center gap-1.5`} style={{ background: 'var(--brand)' }}>
                                <Sparkles className="h-3 w-3" /> AI tahlil
                            </button>
                        )}
                    </div>
                </div>
            )
        }

        return (
            <div className={footerPadding} style={{ borderTop: '1px solid var(--border)' }}>
                <button onClick={submit} disabled={submitting || answeredCount === 0}
                    className={`w-full ${buttonHeight} rounded-xl text-[12px] font-semibold text-white transition disabled:opacity-40`}
                    style={{ background: answeredCount === total ? 'var(--success)' : 'var(--text-primary)' }}>
                    {submitting ? '...' : answeredCount === total ? 'Topshirish ✓' : `Topshirish (${answeredCount}/${total})`}
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-col overflow-hidden w-full" style={{ background: 'var(--bg-page)', height: '100dvh', overscrollBehaviorY: 'none' }}>
            {/* ── Header ── */}
            <header className="h-12 flex-shrink-0 flex items-center justify-between px-4" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                    <button onClick={() => nav(token ? '/suhbat' : '/')} className="h-7 w-7 flex items-center justify-center rounded-lg" style={{ color: 'var(--text-muted)' }}><ArrowLeft className="h-4 w-4" /></button>
                    <div className="h-5 w-5 rounded-md flex items-center justify-center" style={{ background: 'var(--brand)' }}><BrainCircuit className="h-2.5 w-2.5 text-white" /></div>
                    <span className="text-sm font-bold truncate max-w-[180px] sm:max-w-xs">{test?.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold hidden sm:inline-flex" style={{ background: '#f59e0b22', color: '#f59e0b' }}>DTM</span>
                </div>
                <div className="flex items-center gap-3">
                    {!submitted && !isGuest && (
                        <span className="text-[12px] font-medium tabular-nums" style={{ color: answeredCount === total ? 'var(--success)' : 'var(--text-muted)' }}>
                            {answeredCount}/{total}
                        </span>
                    )}
                    {isGuest && !isCompactLayout && (
                        <button onClick={() => nav('/kirish', { state: { from: `/test/${shareLink}` } })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white" style={{ background: 'var(--brand)' }}>
                            <LogIn className="h-3.5 w-3.5" /> Kirish
                        </button>
                    )}
                    {!submitted && !isGuest && !isCompactLayout && (
                        <button onClick={submit} disabled={submitting || answeredCount === 0} className="px-4 h-8 rounded-lg text-[13px] font-semibold text-white transition disabled:opacity-40" style={{ background: answeredCount === total ? 'var(--success)' : 'var(--text-primary)' }}>
                            {submitting ? 'Tekshirilmoqda...' : 'Topshirish'}
                        </button>
                    )}
                </div>
            </header>

            {/* ── Thin progress bar ── */}
            {!submitted && !isGuest && (
                <div className="h-0.5 flex-shrink-0" style={{ background: 'var(--bg-muted)' }}>
                    <div className="h-full transition-all duration-300" style={{ width: `${total ? (answeredCount / total) * 100 : 0}%`, background: 'var(--brand)' }} />
                </div>
            )}

            {/* ── Main split body ── */}
            <div className={`flex-1 min-h-0 overflow-hidden ${isCompactLayout ? 'flex flex-col' : 'flex'}`}>
                {/* ════ LEFT: Questions ════ */}
                <div ref={questionsRef} className={`flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 min-w-0 min-h-0 ${isCompactLayout ? 'pb-28 sm:pb-32' : ''}`}>
                    {questions.map((q: any, qi: number) => {
                        const opts = parseChoiceOptions(q.options)
                        const matchingData = q.questionType === 'matching' ? parseMatchingOptions(q.options) : null
                        const correct = submitted ? correctMap[q.id] : null
                        const correctIdx = correct?.idx ?? -1
                        const isMatching = q.questionType === 'matching'
                        const selMap = isMatching ? ((answers[q.id] || {}) as Record<number, number>) : {}
                        const matchingAnsweredCount = isMatching ? Object.keys(selMap).length : 0
                        const matchingTotal = isMatching ? (matchingData?.subQuestions?.length || 0) : 0
                        const answered = isMatching ? matchingAnsweredCount >= matchingTotal && matchingTotal > 0 : typeof answers[q.id] === 'number'
                        const isFocused = focusedQ === qi

                        // Border color for matching: check if all sub-questions correct
                        let borderCol = isFocused ? 'var(--brand)' : answered ? 'color-mix(in srgb, var(--brand) 40%, transparent)' : 'var(--border)'
                        if (submitted && isMatching && correct?.matchingCorrect) {
                            const allCorrect = (matchingData?.subQuestions || []).every((sq: any, si: number) => selMap[si] === correct.matchingCorrect![si])
                            borderCol = isFocused ? 'var(--brand)' : allCorrect ? 'var(--success)' : 'var(--danger)'
                        } else if (submitted && !isMatching && answered) {
                            borderCol = isFocused ? 'var(--brand)' : answers[q.id] === correctIdx ? 'var(--success)' : 'var(--danger)'
                        }

                        return (
                            <div key={q.id} data-qi={qi}
                                onClick={() => setFocusedQ(qi)}
                                className="rounded-xl p-4 cursor-pointer transition-all"
                                style={{
                                    background: 'var(--bg-card)',
                                    border: `1.5px solid ${borderCol}`,
                                    boxShadow: isFocused ? '0 0 0 3px color-mix(in srgb, var(--brand) 12%, transparent)' : 'none'
                                }}>
                                {/* Question number + text */}
                                <div className="flex items-start gap-2.5">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5"
                                        style={{ background: answered ? 'var(--brand)' : 'var(--bg-surface)', color: answered ? 'white' : 'var(--text-muted)' }}>
                                        {qi + 1}
                                    </span>
                                    <p className="text-[13px] leading-relaxed flex-1 font-medium"><TextWithMath text={q.text} /></p>
                                </div>
                                {q.imageUrl && <img src={q.imageUrl} alt="Savol" className="mt-3 max-w-full rounded-lg border" style={{ borderColor: 'var(--border)', maxHeight: 240, objectFit: 'contain' }} />}

                                {isMatching && matchingData ? (
                                    /* Matching question in DTM left panel */
                                    <div className="mt-3">
                                        {/* Answer bank */}
                                        <div className="flex flex-wrap gap-1 mb-2 p-2 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                            {(matchingData.answers || []).map((ans: string, ai: number) => (
                                                <span key={ai} className="text-[11px] px-2 py-0.5 rounded" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                                                    <span style={{ color: '#8b5cf6', fontWeight: 700 }}>{String.fromCharCode(65 + ai)})</span> <TextWithMath text={ans} />
                                                </span>
                                            ))}
                                        </div>
                                        {/* Sub-questions */}
                                        <div className="space-y-1.5">
                                            {(matchingData.subQuestions || []).map((sq: any, si: number) => {
                                                const sel = selMap[si]
                                                const correctSubIdx = correct?.matchingCorrect?.[si] ?? -1
                                                const isSubCorrect = submitted && sel === correctSubIdx
                                                const isSubWrong = submitted && sel !== undefined && sel !== correctSubIdx
                                                return (
                                                    <div key={si} className="flex items-center gap-2 p-2 rounded-lg" style={{ border: `1px solid ${submitted ? (isSubCorrect ? 'var(--success)' : isSubWrong ? 'var(--danger)' : 'var(--border)') : 'var(--border)'}`, background: 'var(--bg-surface)' }}>
                                                        <span className="text-[11px] flex-1 min-w-0" style={{ color: 'var(--text-secondary)' }}>{si + 1}. <TextWithMath text={sq.text} /></span>
                                                        <div className="flex gap-1 flex-shrink-0">
                                                            {(matchingData.answers || []).map((_: string, ai: number) => {
                                                                const isSel = sel === ai
                                                                const isCorr = submitted && ai === correctSubIdx
                                                                const isWrong = submitted && isSel && !isCorr
                                                                let sty: any = { background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }
                                                                if (isCorr) sty = { background: 'var(--success)', color: 'white', border: 'none' }
                                                                else if (isWrong) sty = { background: 'var(--danger)', color: 'white', border: 'none' }
                                                                else if (!submitted && isSel) sty = { background: '#8b5cf6', color: 'white', border: 'none' }
                                                                return (
                                                                    <button key={ai}
                                                                        onClick={e => { e.stopPropagation(); if (!submitted && !isGuest) setAnswers((a: any) => ({ ...a, [q.id]: { ...(a[q.id] || {}), [si]: ai } })) }}
                                                                        disabled={submitted || isGuest}
                                                                        className="w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center transition"
                                                                        style={{ ...sty, cursor: submitted || isGuest ? 'default' : 'pointer' }}>
                                                                        {String.fromCharCode(65 + ai)}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    /* MCQ options in DTM left panel */
                                    <div className="mt-3 grid grid-cols-1 gap-1.5">
                                        {opts.map((opt, oi) => {
                                            const sel = answers[q.id] === oi
                                            let sty: any = { background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
                                            if (submitted) {
                                                if (oi === correctIdx) sty = { background: 'var(--success-light)', color: 'var(--success)', border: '1px solid var(--success)', fontWeight: 600 }
                                                else if (sel) sty = { background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid var(--danger)' }
                                                else sty = { background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)', opacity: 0.6 }
                                            } else if (sel) {
                                                sty = { background: 'var(--brand-light)', color: 'var(--brand)', border: '1px solid var(--brand)', fontWeight: 600 }
                                            }
                                            return (
                                                <div key={oi} className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition" style={sty}>
                                                    <span className="font-bold text-[11px] flex-shrink-0 w-4">{OPTS[oi]})</span>
                                                    <span className="flex-1"><TextWithMath text={opt} /></span>
                                                    {submitted && oi === correctIdx && <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--success)' }} />}
                                                    {submitted && sel && oi !== correctIdx && <XCircle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--danger)' }} />}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    })}

                    {/* Chatga qaytish (after submit) */}
                    {submitted && (
                        <div className="pb-6">
                            <button onClick={() => nav('/suhbat')} className="w-full h-11 rounded-xl text-sm font-semibold transition" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                                Chatga qaytish
                            </button>
                        </div>
                    )}
                </div>

                {/* ════ RIGHT: DTM Blanka ════ */}
                {!isCompactLayout && (
                <div className="w-[300px] sm:w-[360px] flex-shrink-0 flex flex-col overflow-hidden min-h-0"
                    style={{ background: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }}>
                    {/* Blanka header */}
                    <div className="flex-shrink-0 px-4 py-3 text-center" style={{ borderBottom: '1px solid var(--border)' }}>
                        <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Javoblar Varaqasi</p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{test?.subject} · {total} savol</p>
                    </div>

                    {/* Blanka option labels */}
                    <div className="flex-shrink-0 flex items-center px-4 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                        <span className="w-9 flex-shrink-0" />
                        {OPTS.map(l => (
                            <span key={l} className="flex-1 text-center text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>{l}</span>
                        ))}
                    </div>

                    {/* Blanka rows */}
                    <div className="flex-1 overflow-y-auto overscroll-contain py-1 min-h-0">
                        {renderSheetRows()}
                    </div>

                    {/* Blanka footer — submit / score */}
                    {renderSheetFooter()}
                </div>
                )}
            </div>

            {isCompactLayout && (
                <>
                    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] lg:hidden pointer-events-none">
                        <div className="mx-auto max-w-xl rounded-2xl p-2 shadow-lg pointer-events-auto flex items-center gap-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 12px 32px color-mix(in srgb, var(--text-primary) 8%, transparent)' }}>
                            <button onClick={() => setIsAnswerSheetOpen(true)} className="flex-1 h-11 rounded-xl text-[13px] font-semibold transition" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                                Javoblar · {answeredCount}/{total}
                            </button>
                            {isGuest ? (
                                <button onClick={() => nav('/kirish', { state: { from: `/test/${shareLink}` } })} className="h-11 px-4 rounded-xl text-[13px] font-semibold text-white flex items-center justify-center gap-1.5" style={{ background: 'var(--brand)' }}>
                                    <LogIn className="h-3.5 w-3.5" /> Kirish
                                </button>
                            ) : submitted ? (
                                <button onClick={() => { const id = localStorage.getItem('dtmmax_analysis_chat_id'); nav(analysisReady && id ? `/suhbat/${id}` : analysisReady ? '/suhbat?analyzeTest=true' : '/suhbat') }} className="h-11 px-4 rounded-xl text-[13px] font-semibold text-white flex items-center justify-center gap-1.5" style={{ background: 'var(--brand)' }}>
                                    {analysisReady ? <Sparkles className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
                                    {analysisReady ? 'AI tahlil' : 'Chatga qaytish'}
                                </button>
                            ) : (
                                <button onClick={submit} disabled={submitting || answeredCount === 0} className="h-11 px-4 rounded-xl text-[13px] font-semibold text-white transition disabled:opacity-40" style={{ background: answeredCount === total ? 'var(--success)' : 'var(--text-primary)' }}>
                                    {submitting ? '...' : 'Topshirish'}
                                </button>
                            )}
                        </div>
                    </div>

                    {isAnswerSheetOpen && (
                        <div className="fixed inset-0 z-50 lg:hidden">
                            <button aria-label="Javoblar varaqasini yopish" onClick={() => setIsAnswerSheetOpen(false)} className="absolute inset-0" style={{ background: 'rgba(15, 23, 42, 0.38)' }} />
                            <div className="absolute inset-x-0 bottom-0 flex max-h-[78dvh] flex-col overflow-hidden rounded-t-3xl" style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)', boxShadow: '0 -18px 50px rgba(15, 23, 42, 0.2)' }}>
                                <div className="flex-shrink-0 px-4 pt-2 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
                                    <div className="mx-auto h-1.5 w-12 rounded-full" style={{ background: 'var(--border-strong)' }} />
                                    <div className="mt-3 flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Javoblar Varaqasi</p>
                                            <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>{test?.subject} · {answeredCount}/{total}</p>
                                        </div>
                                        <button onClick={() => setIsAnswerSheetOpen(false)} className="h-8 px-3 rounded-lg text-[12px] font-semibold transition" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                                            Yopish
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-shrink-0 flex items-center px-4 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                                    <span className="w-9 flex-shrink-0" />
                                    {OPTS.map(label => (
                                        <span key={label} className="flex-1 text-center text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>{label}</span>
                                    ))}
                                </div>

                                <div className="flex-1 overflow-y-auto overscroll-contain py-1 min-h-0">
                                    {renderSheetRows()}
                                </div>

                                {renderSheetFooter(true)}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
