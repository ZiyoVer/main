import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, type NavigateFunction } from 'react-router-dom'
import { BrainCircuit, CheckCircle, XCircle, ArrowLeft, Sparkles, LogIn, Lock, MessageSquare, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import DOMPurify from 'dompurify'
import { normalizeMathText } from '@/lib/mathRender' // 2.4: yagona manba — lokal nusxa olib tashlandi
import { saveScopedItem, pruneDtmmaxStorage } from '@/lib/storagePrune'

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

function formatTimer(seconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(seconds))
    const minutes = Math.floor(safeSeconds / 60)
    const rest = safeSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
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
// 5.3: submit javobidagi tavsiya — zaif mavzu va keyingi test
type TestRecommendation = {
    focusTopic: { topic: string; subject: string; pct: number } | null
    nextTest: { id: string; title: string; shareLink: string } | null
}
type CorrectAnswerMap = Record<string, { idx: number; text?: string; type: string; matchingCorrect?: number[]; multipartCorrectText?: Array<{ label: string; text: string; correctText: string }>; solutionImage?: string | null }>
type TestTypeValue = 'REGULAR' | 'DTM_BLOCK' | 'MILLIY_SERTIFIKAT'

function normalizeTestType(value: string | null | undefined): TestTypeValue {
    if (value === 'DTM_BLOCK' || value === 'dtm') return 'DTM_BLOCK'
    if (value === 'MILLIY_SERTIFIKAT' || value === 'milliy_sertifikat') return 'MILLIY_SERTIFIKAT'
    return 'REGULAR'
}

function getResultMeta(result: any, testType: TestTypeValue) {
    const rawScore = typeof result?.rawScore === 'number' ? result.rawScore : undefined
    const scoreMax = typeof result?.scoreMax === 'number' ? result.scoreMax : undefined
    if (testType === 'DTM_BLOCK') {
        return {
            label: 'DTM natijasi',
            value: rawScore !== undefined && scoreMax !== undefined ? `${rawScore} / ${scoreMax}` : `${result?.dtmBall ?? 0} / ${result?.dtmMax ?? 0}`,
        }
    }
    if (testType === 'MILLIY_SERTIFIKAT') {
        return {
            label: 'Sertifikat natijasi',
            value: rawScore !== undefined && scoreMax !== undefined ? `${rawScore} / ${scoreMax}` : `${result?.msBall ?? 0} / ${result?.msMax ?? 0}`,
        }
    }
    return {
        label: 'Xom natija',
        value: rawScore !== undefined && scoreMax !== undefined ? `${rawScore} / ${scoreMax}` : `${result?.correct ?? 0} / ${result?.total ?? 0}`,
    }
}

// 5.2: natija foizi 0 dan yakuniy qiymatgacha ~0.8s da sanaladi.
// prefers-reduced-motion bo'lsa animatsiyasiz to'g'ridan-to'g'ri yakuniy qiymat.
function useCountUp(target: number, durationMs = 800): number {
    const [value, setValue] = useState(0)
    useEffect(() => {
        const safeTarget = Number.isFinite(target) ? target : 0
        const reduceMotion = typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (reduceMotion || safeTarget <= 0) {
            setValue(safeTarget)
            return
        }
        let raf = 0
        const start = performance.now()
        const tick = (now: number) => {
            const progress = Math.min(1, (now - start) / durationMs)
            const eased = 1 - Math.pow(1 - progress, 3) // ease-out
            setValue(Math.round(safeTarget * eased))
            if (progress < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [target, durationMs])
    return value
}

// 5.2: animatsiyalangan foiz + yaxshi natijada (>=70%) yumshoq glow-puls
function ScoreCountUp({ score }: { score: number }) {
    const shown = useCountUp(score)
    const celebrate = score >= 70
    return (
        <span className={celebrate ? 'tp-score-glow' : undefined} style={{ display: 'inline-block' }}>
            {celebrate && (
                <style>{`
@keyframes tpScoreGlow {
    0%, 100% { transform: scale(1); text-shadow: 0 0 0 rgba(0, 0, 0, 0); }
    50% { transform: scale(1.05); text-shadow: 0 0 16px color-mix(in srgb, var(--success) 45%, transparent); }
}
.tp-score-glow { animation: tpScoreGlow 1.6s ease-in-out 0.85s 2; }
@media (prefers-reduced-motion: reduce) { .tp-score-glow { animation: none; } }
`}</style>
            )}
            {shown}%
        </span>
    )
}

// 5.3: "Keyingi qadam" kartasi — zaif mavzu bo'yicha AI mashq va/yoki keyingi test
function NextStepCard({ recommendation, nav, compact }: { recommendation: TestRecommendation; nav: NavigateFunction; compact?: boolean }) {
    const { focusTopic, nextTest } = recommendation
    if (!focusTopic && !nextTest) return null
    return (
        <div className={`rounded-xl ${compact ? 'p-3' : 'p-4'} text-left`} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: '3px solid var(--brand)' }}>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--brand)' }}>Keyingi qadam</p>
            {focusTopic && (
                <div className={nextTest ? 'mb-2' : ''}>
                    <p className="text-[13px] mb-2" style={{ color: 'var(--text-primary)' }}>
                        Zaif mavzu: <span className="font-semibold">{focusTopic.topic}</span> ({focusTopic.pct}% to'g'ri)
                    </p>
                    <button
                        onClick={() => { const id = localStorage.getItem('dtmmax_analysis_chat_id'); nav(id ? `/suhbat/${id}` : '/suhbat?analyzeTest=true') }}
                        className={`w-full ${compact ? 'h-9 text-[12px]' : 'h-10 text-[13px]'} rounded-xl font-semibold text-white flex items-center justify-center gap-1.5`}
                        style={{ background: 'var(--brand)' }}>
                        <Sparkles className="h-3.5 w-3.5" /> AI bilan mashq qilish
                    </button>
                </div>
            )}
            {nextTest && (
                <button
                    onClick={() => nav('/test/' + nextTest.shareLink)}
                    className={`w-full ${compact ? 'h-9 text-[12px]' : 'h-10 text-[13px]'} rounded-xl font-semibold flex items-center justify-center gap-1 transition`}
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                    <span className="truncate">Keyingi test: {nextTest.title}</span>
                    <ChevronRight className="h-4 w-4 flex-shrink-0" />
                </button>
            )}
        </div>
    )
}

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
    const [recommendation, setRecommendation] = useState<TestRecommendation | null>(null) // 5.3
    const [focusedQ, setFocusedQ] = useState(0) // for DTM mode: highlight active question
    const [timeLeft, setTimeLeft] = useState<number | null>(null)

    const questionsRef = useRef<HTMLDivElement>(null)
    const submitRef = useRef<(skipConfirm?: boolean) => void>(() => { })
    const autoSubmitRef = useRef(false)
    const isGuest = !token || !user
    const timerActive = !submitted && !isGuest && timeLeft !== null

    useEffect(() => {
        if (!shareLink) return
        setLoading(true)
        setErr('')
        // 5.3: shareLink o'zgarganda (masalan, "Keyingi test" tugmasi) eski testning
        // javoblari/natijasi yangi testga o'tib qolmasin — hammasi tozalanadi
        setAnswers({})
        setSubmitted(false)
        setResult(null)
        setCorrectMap({})
        setAnalysisReady(false)
        setRecommendation(null)
        pruneDtmmaxStorage() // 2.3: per-test kalitlar cheksiz o'smasin
        fetchApi(`/tests/by-link/${shareLink}`)
            .then(t => {
                setTest(t)
                setFocusedQ(0)
                autoSubmitRef.current = false
                // 2.6: reload'da javoblar yo'qolmasin — saqlangan qoralama tiklanadi
                try {
                    const saved = JSON.parse(localStorage.getItem('dtmmax_tp_ans_' + t.id) || 'null')
                    if (saved && typeof saved === 'object' && !Array.isArray(saved)) setAnswers(saved)
                } catch { /* buzilgan qoralama — bo'sh boshlaymiz */ }
                const remainingSeconds = typeof t.timeRemainingSeconds === 'number'
                    ? t.timeRemainingSeconds
                    : (typeof t.timeLimit === 'number' && t.timeLimit > 0 ? t.timeLimit * 60 : null)
                setTimeLeft(remainingSeconds === null ? null : Math.max(0, remainingSeconds))
            })
            .catch(e => setErr(e.message || 'Test topilmadi'))
            .finally(() => setLoading(false))
    }, [shareLink, token])

    useEffect(() => {
        if (isGuest) return
        const sendPing = () => fetchApi('/auth/ping', { method: 'POST', body: JSON.stringify({ page: 'test' }), silent: true }).catch(() => { })
        sendPing()
        const pingInterval = setInterval(sendPing, 60000)
        return () => clearInterval(pingInterval)
    }, [isGuest])

    // 2.6: har javob o'zgarishida qoralama saqlanadi (server-taymerga TEGILMAYDI —
    // timeRemainingSeconds manba bo'lib qoladi; bu faqat javoblarni tiklaydi)
    useEffect(() => {
        if (!test || submitted) return
        if (Object.keys(answers).length === 0) return
        saveScopedItem('dtmmax_tp_ans_' + test.id, JSON.stringify(answers))
    }, [answers, test, submitted])

    useEffect(() => {
        if (!timerActive) return
        const timer = window.setInterval(() => {
            setTimeLeft(prev => prev === null ? null : Math.max(0, prev - 1))
        }, 1000)
        return () => window.clearInterval(timer)
    }, [timerActive])

    useEffect(() => {
        if (!test || submitted || submitting || isGuest || timeLeft !== 0) return
        if (autoSubmitRef.current) return
        autoSubmitRef.current = true
        toast.error('Test vaqti tugadi. Javoblar avtomatik yuborilmoqda.')
        submitRef.current(true)
    }, [isGuest, submitted, submitting, test, timeLeft])

    async function submit(options?: { skipConfirm?: boolean }) {
        if (!test) return
        if (isGuest) {
            toast.error('Testni ishlash uchun avval kiring')
            nav('/kirish', { state: { from: `/test/${shareLink}` } })
            return
        }
        if (!options?.skipConfirm && answeredCount < total) {
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
            // 5.3: tavsiya (zaif mavzu / keyingi test) — "Keyingi qadam" kartasi uchun
            const rec: TestRecommendation | null = res?.recommendation ?? null
            setRecommendation(rec && (rec.focusTopic || rec.nextTest) ? rec : null)
            const map: CorrectAnswerMap = {}
            res.correctAnswers?.forEach((ca: any) => {
                map[ca.id] = {
                    idx: ca.correctIdx,
                    text: ca.correctText,
                    type: ca.questionType || 'mcq',
                    matchingCorrect: ca.matchingCorrect,
                    multipartCorrectText: ca.multipartCorrectText,
                    solutionImage: ca.solutionImageUrl || null // FAZA 3: yechim rasmi (submitdan keyin)
                }
            })
            setCorrectMap(map)
            setSubmitted(true)
            // 2.6: topshirilgandan keyin qoralama kerak emas
            try { localStorage.removeItem('dtmmax_tp_ans_' + test.id) } catch { }
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
        } catch (e: any) {
            if (String(e.message || '').includes('vaqti')) setTimeLeft(0)
            toast.error(e.message || 'Test yuborishda xatolik yuz berdi')
        }
        finally { setSubmitting(false) }
    }

    submitRef.current = (skipConfirm = false) => { void submit(skipConfirm ? { skipConfirm: true } : undefined) }

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
        <div className="kelviq min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
            <div className="text-center">
                <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2" style={{ borderColor: 'var(--border-strong)', borderTopColor: 'var(--brand)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Yuklanmoqda...</p>
            </div>
        </div>
    )

    if (err) return (
        <div className="kelviq min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
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
    const normalizedTestType = normalizeTestType(test?.testType)
    const isDtm = normalizedTestType === 'DTM_BLOCK'

    // ─────────────────── DTM MODE ───────────────────
    if (isDtm) return <DtmTestView
        test={test} answers={answers} setAnswers={setAnswers}
        submitted={submitted} result={result} correctMap={correctMap}
        submitting={submitting} submit={submit}
        answeredCount={answeredCount} total={total}
        isGuest={isGuest} analysisReady={analysisReady}
        recommendation={recommendation}
        focusedQ={focusedQ} setFocusedQ={setFocusedQ}
        questionsRef={questionsRef} scrollToQuestion={scrollToQuestion}
        nav={nav} token={token} timeLeft={timeLeft}
    />

    // ─────────────────── STANDARD MODE ───────────────────
    return (
        <div className="kelviq overflow-y-auto w-full overscroll-contain" style={{ background: 'var(--bg-page)', height: '100dvh' }}>
            <header className="sticky top-0 z-40" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
                <div className="max-w-2xl mx-auto flex items-center justify-between py-3 px-5">
                    <div className="flex items-center gap-2">
                        <button onClick={() => nav(token ? '/suhbat' : '/')} className="h-7 w-7 flex items-center justify-center rounded-lg transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                        <img src="/dtmmax-logo.png" alt="DtmMax" className="h-8 w-8 rounded-md flex items-center justify-center" style={{ objectFit: 'contain' }} />
                        <span className="text-sm font-bold truncate max-w-[200px]">{test?.title}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {!isGuest && !submitted && timeLeft !== null && (
                            <span className="inline-flex items-center gap-1 text-[12px] font-semibold tabular-nums" style={{ color: timeLeft < 60 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                                <Clock className="h-3.5 w-3.5" /> {formatTimer(timeLeft)}
                            </span>
                        )}
                        {isGuest && <button onClick={() => nav('/kirish', { state: { from: `/test/${shareLink}` } })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white" style={{ background: 'var(--brand)' }}><LogIn className="h-3.5 w-3.5" /> Kirish</button>}
                    </div>
                </div>
                {/* 4.5: yopishqoq progress — savollar ustida doim ko'rinib turadi */}
                {!submitted && !isGuest && total > 0 && (
                    <div className="px-5 pb-1.5">
                        <div className="max-w-2xl mx-auto">
                            <p className="text-[10px] font-medium tabular-nums mb-1 text-right" style={{ color: 'var(--text-muted)' }}>{answeredCount}/{total} javob berildi</p>
                            <div className="h-[3px] w-full rounded-full overflow-hidden" style={{ background: 'var(--bg-muted)' }}>
                                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(answeredCount / total) * 100}%`, background: 'var(--brand)' }} />
                            </div>
                        </div>
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
                        {(() => {
                            const resultMeta = getResultMeta(result, normalizedTestType)
                            return (
                                <>
                        <div className="flex items-center justify-center gap-4 mb-2">
                            <div className="text-4xl font-extrabold" style={{ color: result.score >= 70 ? 'var(--success)' : result.score >= 50 ? 'var(--warning)' : 'var(--danger)' }}><ScoreCountUp score={typeof result.score === 'number' ? result.score : 0} /></div>
                            {result.grade && <div className="text-3xl font-extrabold" style={{ color: result.grade.startsWith('A') ? 'var(--success)' : result.grade.startsWith('B') ? 'var(--info)' : result.grade.startsWith('C') ? 'var(--warning)' : 'var(--danger)' }}>{result.grade}</div>}
                        </div>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{resultMeta.label}: {resultMeta.value}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{result.correct} / {result.total} to'g'ri javob</p>
                        {typeof result.score === 'number' && result.score < 50 && recommendation?.focusTopic && (
                            <p className="text-[12px] mt-2 font-medium" style={{ color: 'var(--warning)' }}>Zaif mavzularing aniqlandi — birga mustahkamlaymiz 💪</p>
                        )}
                        <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                            {normalizedTestType === 'MILLIY_SERTIFIKAT' && result.msBall !== undefined && <div className="px-3 py-1.5 rounded-lg text-[12px] font-semibold" style={{ background: 'color-mix(in srgb, var(--brand) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--brand) 25%, transparent)', color: 'var(--brand)' }}>MS: {result.msBall} / {result.msMax}</div>}
                        </div>
                                </>
                            )
                        })()}
                    </div>
                )}

                {submitted && analysisReady && (
                    <div className="rounded-xl p-4" style={{ border: '1px solid color-mix(in srgb, var(--brand) 25%, transparent)', background: 'var(--bg-card)' }}>
                        <div className="flex items-center gap-3 mb-3">
                            <Sparkles className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--brand)' }} />
                            <p className="text-[13px] font-semibold">AI tahlil tayyor. Xohlasangiz chatda davom eting.</p>
                        </div>
                        <button onClick={() => { const id = localStorage.getItem('dtmmax_analysis_chat_id'); nav(id ? `/suhbat/${id}` : '/suhbat?analyzeTest=true') }} className="w-full h-10 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ background: 'var(--brand)' }}><MessageSquare className="h-4 w-4" /> Hozir o'tish</button>
                    </div>
                )}

                {/* 5.3: Keyingi qadam — zaif mavzu mashqi / keyingi test */}
                {submitted && recommendation && <NextStepCard recommendation={recommendation} nav={nav} />}

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
                                                <span style={{ color: 'var(--brand)', fontWeight: 700 }}>{String.fromCharCode(65 + ai)})</span> <TextWithMath text={ans} />
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
                                                            else if (!submitted && isSel) sty = { background: 'var(--brand-light)', border: '1px solid var(--brand)', color: 'var(--brand-hover)', fontWeight: 700 }
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
                                                <p className="text-[12px] mb-2 font-medium"><span style={{ color: 'var(--brand)' }}>{label})</span> <TextWithMath text={subQuestion.text} /></p>
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
                                                    style={{ background: 'var(--bg-card)', borderColor: submitted ? (isSubCorrect ? 'var(--success)' : 'var(--danger)') : (multipartAnswers[subIndex] || '').trim() ? 'var(--brand)' : 'var(--border)', color: 'var(--text-primary)' }}
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
                                            <button key={oi} type="button" disabled={submitted || isGuest} onClick={() => !isGuest && setAnswers(a => ({ ...a, [q.id]: oi }))} className="w-full flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg border text-left text-[13px] transition" style={{ background: bg, borderColor: border, color, cursor: isGuest ? 'not-allowed' : 'pointer', opacity: isGuest ? 0.7 : 1 }}>
                                                <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-[10px] font-bold border-current mt-0.5">{OPTS[oi]}</span>
                                                <span className="flex-1 pointer-events-none">
                                                    <TextWithMath text={opt} />
                                                    {/* FAZA 3: variant rasmi */}
                                                    {Array.isArray(q.optionImages) && q.optionImages[oi] && (
                                                        <img src={q.optionImages[oi]} alt={`${OPTS[oi]} variant rasmi`} className="mt-1.5 rounded-lg border max-w-full" style={{ borderColor: 'var(--border)', maxHeight: '10rem' }} />
                                                    )}
                                                </span>
                                                {submitted && oi === correctIdx && <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />}
                                                {submitted && sel === oi && oi !== correctIdx && <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                            {/* FAZA 3: yechim rasmi — faqat topshirilgandan keyin */}
                            {submitted && correct?.solutionImage && (
                                <div className="mt-3 p-2.5 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                    <p className="text-[11px] font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Yechim:</p>
                                    <img src={correct.solutionImage} alt="Yechim rasmi" className="max-w-full rounded-lg" style={{ maxHeight: '16rem' }} />
                                </div>
                            )}
                        </div>
                    )
                })}

                {!submitted && (
                    isGuest
                        ? <button onClick={() => nav('/kirish', { state: { from: `/test/${shareLink}` } })} className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ background: 'var(--brand)' }}><LogIn className="h-4 w-4" /> Yechishni boshlash uchun kiring</button>
                        : <button onClick={() => submit()} disabled={submitting || answeredCount === 0} className="w-full h-11 rounded-xl text-sm font-semibold text-white transition disabled:opacity-40" style={{ background: 'var(--k-accent-grad)', boxShadow: 'var(--k-shadow-cta)' }}>{submitting ? 'Tekshirilmoqda...' : answeredCount < total ? `Testni yuborish (${total - answeredCount} ta javobsiz)` : `Testni yuborish (${answeredCount}/${total})`}</button>
                )}
                {submitted && <button onClick={() => nav('/suhbat')} className="w-full h-11 rounded-xl text-sm font-semibold transition" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>Chatga qaytish</button>}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// DTM TEST VIEW — split screen: questions left, blanka right
// ─────────────────────────────────────────────────────────────
function DtmTestView({ test, answers, setAnswers, submitted, result, correctMap, submitting, submit, answeredCount, total, isGuest, analysisReady, recommendation, focusedQ, setFocusedQ, questionsRef, scrollToQuestion, nav, token, timeLeft }: any) {
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
                        <div className="flex items-center px-4 py-1" style={{ background: 'color-mix(in srgb, var(--brand) 6%, transparent)' }}>
                            <span className="text-[10px] font-bold" style={{ color: 'var(--brand)' }}>
                                {qi + 1}. Moslashtirish ({matchingData.subQuestions?.length || 0} kichik savol)
                            </span>
                        </div>
                        <div className="flex items-center px-4 py-0.5" style={{ borderBottom: '1px solid var(--border)' }}>
                            <span className="w-12 flex-shrink-0" />
                            {Array.from({ length: answerCount }, (_, answerIndex) => (
                                <span key={answerIndex} className="flex-1 text-center text-[10px] font-bold" style={{ color: 'var(--brand)' }}>{alphabet[answerIndex]}</span>
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
                                        background: isFocused ? 'color-mix(in srgb, var(--brand) 6%, transparent)' : 'transparent',
                                        borderLeft: isFocused ? '3px solid var(--brand)' : '3px solid transparent'
                                    }}>
                                    <span className="w-12 flex-shrink-0 text-[11px] font-semibold text-left" style={{ color: isFocused ? 'var(--brand)' : 'var(--text-muted)' }}>
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
                                                            background: isWrong ? 'var(--danger)' : isCorrect ? 'var(--success)' : 'var(--brand)',
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
            const resultMeta = getResultMeta(result, 'DTM_BLOCK')
            return (
                <div className={footerPadding} style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="text-center">
                        <p className="text-xl font-extrabold" style={{ color: result?.score >= 70 ? 'var(--success)' : result?.score >= 50 ? 'var(--warning)' : 'var(--danger)' }}><ScoreCountUp score={typeof result?.score === 'number' ? result.score : 0} /></p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{resultMeta.value}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{result?.correct}/{result?.total} to'g'ri javob</p>
                        {typeof result?.score === 'number' && result.score < 50 && recommendation?.focusTopic && (
                            <p className="text-[10px] mt-1 font-medium" style={{ color: 'var(--warning)' }}>Zaif mavzularing aniqlandi — birga mustahkamlaymiz 💪</p>
                        )}
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
                <button onClick={() => submit()} disabled={submitting || answeredCount === 0}
                    className={`w-full ${buttonHeight} rounded-xl text-[12px] font-semibold text-white transition disabled:opacity-40`}
                    style={{ background: answeredCount === total ? 'var(--success)' : 'var(--k-accent-grad)' }}>
                    {submitting ? '...' : answeredCount === total ? 'Topshirish ✓' : `Topshirish (${answeredCount}/${total})`}
                </button>
            </div>
        )
    }

    return (
        <div className="kelviq flex flex-col overflow-hidden w-full" style={{ background: 'var(--bg-page)', height: '100dvh', overscrollBehaviorY: 'none' }}>
            {/* ── Header ── */}
            <header className="h-12 flex-shrink-0 flex items-center justify-between px-4" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                    <button onClick={() => nav(token ? '/suhbat' : '/')} className="h-7 w-7 flex items-center justify-center rounded-lg" style={{ color: 'var(--text-muted)' }}><ArrowLeft className="h-4 w-4" /></button>
                    <img src="/dtmmax-logo.png" alt="DtmMax" className="h-7 w-7 rounded-md flex items-center justify-center" style={{ objectFit: 'contain' }} />
                    <span className="text-sm font-bold truncate max-w-[180px] sm:max-w-xs">{test?.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold hidden sm:inline-flex" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>DTM</span>
                </div>
                <div className="flex items-center gap-3">
                    {!submitted && !isGuest && typeof timeLeft === 'number' && (
                        <span className="inline-flex items-center gap-1 text-[12px] font-semibold tabular-nums" style={{ color: timeLeft < 60 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                            <Clock className="h-3.5 w-3.5" /> {formatTimer(timeLeft)}
                        </span>
                    )}
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
                        <button onClick={() => submit()} disabled={submitting || answeredCount === 0} className="px-4 h-8 rounded-lg text-[13px] font-semibold text-white transition disabled:opacity-40" style={{ background: answeredCount === total ? 'var(--success)' : 'var(--k-accent-grad)' }}>
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
                                                    <span style={{ color: 'var(--brand)', fontWeight: 700 }}>{String.fromCharCode(65 + ai)})</span> <TextWithMath text={ans} />
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
                                                                else if (!submitted && isSel) sty = { background: 'var(--brand)', color: 'white', border: 'none' }
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
                                                <div key={oi} className="flex items-start gap-2 px-3 py-2 rounded-lg text-[13px] transition" style={sty}>
                                                    <span className="font-bold text-[11px] flex-shrink-0 w-4 mt-0.5">{OPTS[oi]})</span>
                                                    <span className="flex-1">
                                                        <TextWithMath text={opt} />
                                                        {/* FAZA 3: variant rasmi (DTM chap panel) */}
                                                        {Array.isArray(q.optionImages) && q.optionImages[oi] && (
                                                            <img src={q.optionImages[oi]} alt={`${OPTS[oi]} variant rasmi`} className="mt-1.5 rounded-lg border max-w-full" style={{ borderColor: 'var(--border)', maxHeight: '9rem', objectFit: 'contain' }} />
                                                        )}
                                                    </span>
                                                    {submitted && oi === correctIdx && <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />}
                                                    {submitted && sel && oi !== correctIdx && <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                                {/* FAZA 3: yechim rasmi — faqat topshirilgandan keyin */}
                                {submitted && correct?.solutionImage && (
                                    <div className="mt-3 p-2.5 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                        <p className="text-[11px] font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Yechim:</p>
                                        <img src={correct.solutionImage} alt="Yechim rasmi" className="max-w-full rounded-lg" style={{ maxHeight: 240, objectFit: 'contain' }} />
                                    </div>
                                )}
                            </div>
                        )
                    })}

                    {/* Chatga qaytish (after submit) */}
                    {submitted && (
                        <div className="pb-6 space-y-3">
                            {/* 5.3: Keyingi qadam — DTM ko'rinishida ham */}
                            {recommendation && <NextStepCard recommendation={recommendation} nav={nav} compact />}
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
                                <button onClick={() => submit()} disabled={submitting || answeredCount === 0} className="h-11 px-4 rounded-xl text-[13px] font-semibold text-white transition disabled:opacity-40" style={{ background: answeredCount === total ? 'var(--success)' : 'var(--k-accent-grad)' }}>
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
