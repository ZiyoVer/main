import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BrainCircuit, CheckCircle, XCircle, ArrowLeft, Sparkles, LogIn, Lock, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import DOMPurify from 'dompurify'

function MathPreview({ text, inline }: { text: string; inline?: boolean }) {
    if (!text?.includes('$')) return null
    try {
        const html = text
            .replace(/\$\$([^$]+)\$\$/g, (_, m) => katex.renderToString(m.trim(), { displayMode: true, throwOnError: false }))
            .replace(/\$([^$\n]+)\$/g, (_, m) => katex.renderToString(m.trim(), { throwOnError: false }))
        if (inline) return <span className="inline-block ml-1" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
        return <div className="mt-1 mb-2 px-2.5 py-1.5 rounded-lg text-sm overflow-x-auto" style={{ background: 'color-mix(in srgb, var(--brand) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--brand) 15%, transparent)', color: 'var(--text-primary)' }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
    } catch { return null }
}

function TextWithMath({ text }: { text: string }) {
    if (!text) return null
    if (!text.includes('$')) return <>{text}</>
    const parts = text.split(/(\$[^$\n]+\$)/g)
    return <>
        {parts.map((part, i) => {
            if (/^\$[^$\n]+\$$/.test(part)) {
                const formula = part.slice(1, -1)
                try { return <span key={i} className="inline-block mx-0.5 align-middle" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(katex.renderToString(formula, { throwOnError: false })) }} /> }
                catch { return <span key={i}>{part}</span> }
            }
            return <span key={i}>{part}</span>
        })}
    </>
}

const OPTS = ['A', 'B', 'C', 'D'] as const

export default function TestPage() {
    const { shareLink } = useParams<{ shareLink: string }>()
    const nav = useNavigate()
    const { token, user } = useAuthStore()
    const [test, setTest] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [err, setErr] = useState('')
    const [answers, setAnswers] = useState<Record<string, number | string>>({})
    const [submitted, setSubmitted] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [submitting, setSubmitting] = useState(false)
    const [correctMap, setCorrectMap] = useState<Record<string, { idx: number; text?: string; type: string }>>({})
    const [analysisReady, setAnalysisReady] = useState(false)
    const [focusedQ, setFocusedQ] = useState(0) // for DTM mode: highlight active question

    const questionsRef = useRef<HTMLDivElement>(null)
    const isGuest = !token || !user

    useEffect(() => {
        if (!shareLink) return
        fetchApi(`/tests/by-link/${shareLink}`)
            .then(t => { setTest(t); setFocusedQ(0) })
            .catch(e => setErr(e.message || 'Test topilmadi'))
            .finally(() => setLoading(false))
    }, [shareLink])

    async function submit() {
        if (!test) return
        if (answeredCount < total) {
            toast(`${total - answeredCount} ta savol javobsiz qolgan. Davom etasizmi?`, { duration: 3000, icon: '⚠️' })
        }
        setSubmitting(true)
        try {
            const payload = test.questions.map((q: any) => {
                if (q.questionType === 'open') return { questionId: q.id, selectedIdx: -1, textAnswer: answers[q.id] ?? '' }
                return { questionId: q.id, selectedIdx: answers[q.id] ?? -1 }
            })
            const res = await fetchApi(`/tests/${test.id}/submit-guest`, { method: 'POST', body: JSON.stringify({ answers: payload }) })
            setResult(res)
            const map: Record<string, { idx: number; text?: string; type: string }> = {}
            res.correctAnswers?.forEach((ca: any) => { map[ca.id] = { idx: ca.correctIdx, text: ca.correctText, type: ca.questionType || 'mcq' } })
            setCorrectMap(map)
            setSubmitted(true)
            const optLabels = ['a', 'b', 'c', 'd']
            const questionsForAnalysis = test.questions.map((q: any, i: number) => {
                let opts: string[] = []
                try { opts = JSON.parse(q.options) } catch { opts = [] }
                const ca = res.correctAnswers?.find((c: any) => c.id === q.id)
                const studentIdx = payload[i]?.selectedIdx ?? -1
                return { text: q.text, imageUrl: q.imageUrl || null, studentAnswer: studentIdx >= 0 ? optLabels[studentIdx] : (payload[i]?.textAnswer || null), correctAnswer: ca ? (ca.correctIdx >= 0 ? optLabels[ca.correctIdx] : ca.correctText) : null, a: opts[0], b: opts[1], c: opts[2], d: opts[3] }
            })
            localStorage.setItem('dtmmax_guest_test_result', JSON.stringify({ title: test.title, subject: test.subject, score: res.correct, total: res.total, questions: questionsForAnalysis }))
            setAnalysisReady(true)
            setTimeout(() => nav('/suhbat?analyzeTest=true'), 2500)
        } catch (e: any) { toast.error(e.message || 'Test yuborishda xatolik yuz berdi') }
        setSubmitting(false)
    }

    function scrollToQuestion(idx: number) {
        const el = questionsRef.current?.querySelector(`[data-qi="${idx}"]`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
        <div className="h-screen overflow-y-auto w-full" style={{ background: 'var(--bg-page)' }}>
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
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{result.correct} / {result.total} to'g'ri</p>
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
                        <button onClick={() => nav('/suhbat?analyzeTest=true')} className="w-full h-10 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ background: 'var(--brand)' }}><MessageSquare className="h-4 w-4" /> Hozir o'tish</button>
                    </div>
                )}

                {/* Questions */}
                {test?.questions?.map((q: any, qi: number) => {
                    let opts: string[] = []
                    try { opts = JSON.parse(q.options) } catch { opts = [] }
                    const correct = submitted ? correctMap[q.id] : null
                    const correctIdx = correct?.idx ?? -1
                    const isOpen = q.questionType === 'open'
                    const textAnswer = typeof answers[q.id] === 'string' ? answers[q.id] as string : ''
                    const serverResult = result?.results?.find((r: any) => r.questionId === q.id)
                    const isCorrectOpen = submitted && correct?.type === 'open' ? (serverResult ? serverResult.isCorrect : textAnswer.trim().toLowerCase() === (correct.text || '').trim().toLowerCase()) : false
                    return (
                        <div key={q.id} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                            <div className="flex items-start gap-2 mb-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>{qi + 1}</span>
                                <p className="text-[13px] font-medium leading-relaxed flex-1"><TextWithMath text={q.text} /></p>
                            </div>
                            {q.imageUrl && <img src={q.imageUrl} alt="Test savoli" className="max-w-full rounded-lg border mb-3" style={{ borderColor: 'var(--border)' }} />}
                            {isOpen ? (
                                <div className="space-y-2">
                                    <textarea disabled={submitted || isGuest} value={textAnswer} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} placeholder={isGuest ? "Yechish uchun kiring..." : "Javobingizni yozing..."} rows={3} className="w-full rounded-lg border px-3 py-2 text-[13px] resize-none outline-none" style={{ background: 'var(--bg-surface)', borderColor: submitted ? (isCorrectOpen ? 'var(--success)' : 'var(--danger)') : textAnswer.trim() ? 'var(--brand)' : 'var(--border)', color: 'var(--text-primary)' }} />
                                    {submitted && <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px]" style={{ background: isCorrectOpen ? 'var(--success-light)' : 'var(--danger-light)', color: isCorrectOpen ? 'var(--success)' : 'var(--danger)' }}>{isCorrectOpen ? <><CheckCircle className="h-3.5 w-3.5 flex-shrink-0" /> To'g'ri!</> : <><XCircle className="h-3.5 w-3.5 flex-shrink-0" /> To'g'ri: <span className="font-semibold">{correct?.text}</span></>}</div>}
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
                                            <button key={oi} disabled={submitted || isGuest} onClick={() => !isGuest && setAnswers(a => ({ ...a, [q.id]: oi }))} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-left text-[13px] transition" style={{ background: bg, borderColor: border, color, cursor: isGuest ? 'not-allowed' : 'pointer', opacity: isGuest ? 0.7 : 1 }}>
                                                <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-[10px] font-bold border-current">{OPTS[oi]}</span>
                                                <span className="flex-1"><TextWithMath text={opt} /></span>
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
    const [showResults, setShowResults] = useState(false)

    function markAnswer(qId: string, oi: number, qi: number) {
        if (submitted || isGuest) return
        setAnswers((a: any) => ({ ...a, [qId]: oi }))
        setFocusedQ(qi)
        scrollToQuestion(qi)
    }

    // After submit: show results overlay
    useEffect(() => {
        if (submitted) setShowResults(true)
    }, [submitted])

    return (
        <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg-page)' }}>
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
                    {isGuest && (
                        <button onClick={() => nav('/kirish', { state: { from: `/test/${shareLink}` } })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white" style={{ background: 'var(--brand)' }}>
                            <LogIn className="h-3.5 w-3.5" /> Kirish
                        </button>
                    )}
                    {!submitted && !isGuest && (
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
            <div className="flex-1 flex overflow-hidden">
                {/* ════ LEFT: Questions ════ */}
                <div ref={questionsRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 min-w-0">
                    {questions.map((q: any, qi: number) => {
                        let opts: string[] = []
                        try { opts = JSON.parse(q.options) } catch { opts = [] }
                        const correct = submitted ? correctMap[q.id] : null
                        const correctIdx = correct?.idx ?? -1
                        const answered = typeof answers[q.id] === 'number'
                        const isFocused = focusedQ === qi

                        return (
                            <div key={q.id} data-qi={qi}
                                onClick={() => setFocusedQ(qi)}
                                className="rounded-xl p-4 cursor-pointer transition-all"
                                style={{
                                    background: 'var(--bg-card)',
                                    border: `1.5px solid ${isFocused ? 'var(--brand)' : submitted && answered && answers[q.id] !== correctIdx ? 'var(--danger)' : submitted && answered && answers[q.id] === correctIdx ? 'var(--success)' : answered ? 'color-mix(in srgb, var(--brand) 40%, transparent)' : 'var(--border)'}`,
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

                                {/* Options — compact, read-only style. Answers go via blanka */}
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
                <div className="w-[300px] sm:w-[360px] flex-shrink-0 flex flex-col overflow-hidden"
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
                    <div className="flex-1 overflow-y-auto py-1">
                        {questions.map((q: any, qi: number) => {
                            const correct = submitted ? correctMap[q.id] : null
                            const correctIdx = correct?.idx ?? -1
                            const sel = answers[q.id]
                            const isFocused = focusedQ === qi

                            return (
                                <button key={q.id} onClick={() => scrollToQuestion(qi)}
                                    className="w-full flex items-center px-4 transition"
                                    style={{
                                        height: 36,
                                        background: isFocused ? 'color-mix(in srgb, var(--brand) 8%, transparent)' : 'transparent',
                                        borderLeft: isFocused ? '3px solid var(--brand)' : '3px solid transparent'
                                    }}>
                                    {/* Number */}
                                    <span className="w-9 flex-shrink-0 text-[12px] font-semibold text-left" style={{ color: isFocused ? 'var(--brand)' : 'var(--text-muted)' }}>
                                        {qi + 1}
                                    </span>
                                    {/* Bubbles */}
                                    {[0, 1, 2, 3].map(oi => {
                                        const isSelected = sel === oi
                                        const isCorrect = submitted && oi === correctIdx
                                        const isWrong = submitted && isSelected && !isCorrect

                                        return (
                                            <button key={oi}
                                                onClick={e => { e.stopPropagation(); markAnswer(q.id, oi, qi) }}
                                                disabled={submitted || isGuest}
                                                className="flex-1 flex items-center justify-center"
                                                style={{ cursor: submitted || isGuest ? 'default' : 'pointer' }}>
                                                {/* Bubble */}
                                                {isSelected || isCorrect ? (
                                                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                                                        style={{
                                                            background: isWrong ? 'var(--danger)' : isCorrect ? 'var(--success)' : 'var(--text-primary)',
                                                            color: 'white',
                                                            transform: isSelected && !submitted ? 'scale(1.1)' : 'scale(1)'
                                                        }}>
                                                        {OPTS[oi]}
                                                    </span>
                                                ) : (
                                                    <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all hover:border-current"
                                                        style={{ borderColor: 'var(--border-strong)', opacity: submitted ? 0.25 : 1 }} />
                                                )}
                                            </button>
                                        )
                                    })}
                                </button>
                            )
                        })}
                    </div>

                    {/* Blanka footer — submit / score */}
                    <div className="flex-shrink-0 p-3" style={{ borderTop: '1px solid var(--border)' }}>
                        {isGuest ? (
                            <button onClick={() => nav('/kirish', { state: { from: `/test/${shareLink}` } })} className="w-full h-9 rounded-xl text-[12px] font-semibold text-white flex items-center justify-center gap-1.5" style={{ background: 'var(--brand)' }}>
                                <LogIn className="h-3.5 w-3.5" /> Kiring
                            </button>
                        ) : submitted ? (
                            <div className="text-center">
                                <p className="text-xl font-extrabold" style={{ color: result?.score >= 70 ? 'var(--success)' : result?.score >= 50 ? 'var(--warning)' : 'var(--danger)' }}>{result?.score ?? 0}%</p>
                                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{result?.correct}/{result?.total} to'g'ri</p>
                                {analysisReady && (
                                    <button onClick={() => nav('/suhbat?analyzeTest=true')} className="mt-2 w-full h-8 rounded-lg text-[12px] font-semibold text-white flex items-center justify-center gap-1.5" style={{ background: 'var(--brand)' }}>
                                        <Sparkles className="h-3 w-3" /> AI tahlil
                                    </button>
                                )}
                            </div>
                        ) : (
                            <button onClick={submit} disabled={submitting || answeredCount === 0}
                                className="w-full h-9 rounded-xl text-[12px] font-semibold text-white transition disabled:opacity-40"
                                style={{ background: answeredCount === total ? 'var(--success)' : 'var(--text-primary)' }}>
                                {submitting ? '...' : answeredCount === total ? 'Topshirish ✓' : `Topshirish (${answeredCount}/${total})`}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
