import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BrainCircuit, CheckCircle, XCircle, ArrowLeft, Sparkles } from 'lucide-react'
import { fetchApi } from '@/lib/api'
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

        if (inline) {
            return <span className="inline-block ml-1" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
        }

        return <div className="mt-1 mb-2 px-2.5 py-1.5 rounded-lg text-sm overflow-x-auto" style={{ background: 'color-mix(in srgb, var(--brand) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--brand) 15%, transparent)', color: 'var(--text-primary)' }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
    } catch { return null }
}

// Savol matni ichidagi formulalarni inline render qiladi — raw $...$ ko'rinmaydi
function TextWithMath({ text }: { text: string }) {
    if (!text) return null
    if (!text.includes('$')) return <>{text}</>
    const parts = text.split(/(\$[^$\n]+\$)/g)
    return <>
        {parts.map((part, i) => {
            if (/^\$[^$\n]+\$$/.test(part)) {
                const formula = part.slice(1, -1)
                try {
                    return <span key={i} className="inline-block mx-0.5 align-middle"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(katex.renderToString(formula, { throwOnError: false })) }} />
                } catch { return <span key={i}>{part}</span> }
            }
            return <span key={i}>{part}</span>
        })}
    </>
}

export default function TestPage() {
    const { shareLink } = useParams<{ shareLink: string }>()
    const nav = useNavigate()
    const [test, setTest] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [err, setErr] = useState('')
    const [answers, setAnswers] = useState<Record<string, number | string>>({})
    const [submitted, setSubmitted] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [submitting, setSubmitting] = useState(false)
    const [correctMap, setCorrectMap] = useState<Record<string, { idx: number; text?: string; type: string }>>({})
    const [analysis, setAnalysis] = useState<string | null>(null)
    const [analysisLoading, setAnalysisLoading] = useState(false)
    const [analysisFailed, setAnalysisFailed] = useState(false)

    useEffect(() => {
        if (!shareLink) return
        fetchApi(`/tests/by-link/${shareLink}`)
            .then(t => setTest(t))
            .catch(e => setErr(e.message || 'Test topilmadi'))
            .finally(() => setLoading(false))
    }, [shareLink])

    async function submit() {
        if (!test) return
        if (answeredCount < total) {
            const unanswered = total - answeredCount
            toast(`${unanswered} ta savol javobsiz qolgan. Davom etasizmi?`, {
                duration: 3000,
                icon: '⚠️',
            })
        }
        setSubmitting(true)
        try {
            const payload = test.questions.map((q: any) => {
                if (q.questionType === 'open') {
                    return { questionId: q.id, selectedIdx: -1, textAnswer: answers[q.id] ?? '' }
                }
                return { questionId: q.id, selectedIdx: answers[q.id] ?? -1 }
            })
            const res = await fetchApi(`/tests/${test.id}/submit`, {
                method: 'POST',
                body: JSON.stringify({ answers: payload })
            })
            setResult(res)
            const map: Record<string, { idx: number; text?: string; type: string }> = {}
            res.correctAnswers?.forEach((ca: any) => {
                map[ca.id] = { idx: ca.correctIdx, text: ca.correctText, type: ca.questionType || 'mcq' }
            })
            setCorrectMap(map)
            setSubmitted(true)

            // AI tahlil
            setAnalysisLoading(true)
            setAnalysisFailed(false)
            const optLabels = ['a','b','c','d']
            const questionsForAnalysis = test.questions.map((q: any, i: number) => {
                let opts: string[] = []
                try { opts = JSON.parse(q.options) } catch { opts = [] }
                const ca = res.correctAnswers?.find((c: any) => c.id === q.id)
                const studentIdx = payload[i]?.selectedIdx ?? -1
                return {
                    text: q.text,
                    imageUrl: q.imageUrl || null,
                    studentAnswer: studentIdx >= 0 ? optLabels[studentIdx] : (payload[i]?.textAnswer || null),
                    correctAnswer: ca ? (ca.correctIdx >= 0 ? optLabels[ca.correctIdx] : ca.correctText) : null,
                    a: opts[0], b: opts[1], c: opts[2], d: opts[3]
                }
            })
            fetchApi('/tests/analyze-result', {
                method: 'POST',
                body: JSON.stringify({ title: test.title, subject: test.subject, score: res.correct, total: res.total, questions: questionsForAnalysis })
            }).then((data: any) => {
                if (data?.analysis) setAnalysis(data.analysis)
                else setAnalysisFailed(true)
            }).catch(() => setAnalysisFailed(true)).finally(() => setAnalysisLoading(false))
        } catch (e: any) {
            toast.error(e.message || 'Test yuborishda xatolik yuz berdi')
        }
        setSubmitting(false)
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
                <button onClick={() => nav('/suhbat')} className="text-sm" style={{ color: 'var(--brand)' }}>Bosh sahifaga qaytish</button>
            </div>
        </div>
    )

    const answeredCount = test?.questions?.filter((q: any) => {
        const a = answers[q.id]
        if (q.questionType === 'open') return typeof a === 'string' && a.trim().length > 0
        return typeof a === 'number'
    }).length ?? 0
    const total = test?.questions?.length || 0

    return (
        <div className="h-screen overflow-y-auto w-full" style={{ background: 'var(--bg-page)' }}>
            {/* Header */}
            <header className="sticky top-0 z-40" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
                <div className="max-w-2xl mx-auto flex items-center justify-between py-3 px-5">
                    <div className="flex items-center gap-2">
                        <button onClick={() => nav('/suhbat')} className="h-7 w-7 flex items-center justify-center rounded-lg transition"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                        <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ background: 'var(--brand)' }}>
                            <BrainCircuit className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-sm font-bold truncate max-w-[200px]">{test?.title}</span>
                    </div>
                    {!submitted && (
                        <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{answeredCount}/{total} javoblandi</span>
                    )}
                </div>
            </header>

            <div className="max-w-2xl mx-auto px-5 py-6 space-y-4">
                {/* Test info */}
                <div className="card p-4">
                    <p className="text-sm font-semibold">{test?.title}</p>
                    <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{test?.subject} · {total} savol · O'qituvchi: {test?.creator?.name}</p>
                </div>

                {/* Result */}
                {submitted && result && (
                    <div className="card p-5 text-center">
                        <div className="flex items-center justify-center gap-4 mb-2">
                            <div className="text-4xl font-extrabold" style={{
                                color: result.score >= 70 ? 'var(--success)' : result.score >= 50 ? 'var(--warning)' : 'var(--danger)'
                            }}>
                                {result.score}%
                            </div>
                            {result.grade && (
                                <div className="flex flex-col items-center">
                                    <div className="text-3xl font-extrabold" style={{
                                        color: result.grade.startsWith('A') ? 'var(--success)' : result.grade.startsWith('B') ? 'var(--info)' : result.grade.startsWith('C') ? 'var(--warning)' : 'var(--danger)'
                                    }}>
                                        {result.grade}
                                    </div>
                                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>baho</div>
                                </div>
                            )}
                        </div>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{result.correct} / {result.total} to'g'ri</p>
                        {result.dtmBall !== undefined && (
                            <div className="mt-2 px-3 py-1.5 rounded-lg inline-flex items-center gap-2" style={{ background: 'color-mix(in srgb, var(--brand) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--brand) 25%, transparent)' }}>
                                <span className="text-[12px] font-semibold" style={{ color: 'var(--brand)' }}>DTM ball: {result.dtmBall} / {result.dtmMax}</span>
                                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>({result.dtmBall > 0 ? '+' : ''}{result.newAbility?.toFixed(2)} logit)</span>
                            </div>
                        )}
                    </div>
                )}

                {/* AI Tahlil */}
                {submitted && (analysisLoading || analysis || analysisFailed) && (
                    <div className="card p-4" style={{ border: '1px solid color-mix(in srgb, var(--brand) 20%, transparent)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ background: 'var(--brand)' }}>
                                <Sparkles className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span className="text-[13px] font-semibold">AI Tahlil</span>
                        </div>
                        {analysisLoading ? (
                            <div className="flex items-center gap-2 py-2">
                                <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--border-strong)', borderTopColor: 'var(--brand)' }} />
                                <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Tahlil qilinmoqda...</span>
                            </div>
                        ) : analysisFailed ? (
                            <div className="flex items-center justify-between gap-3 py-1">
                                <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Tahlil yuklanmadi. Qayta urinib ko'ring.</span>
                                <button onClick={() => {
                                    setAnalysisFailed(false)
                                    setAnalysisLoading(true)
                                    const optLabels = ['a','b','c','d']
                                    const qs = test.questions.map((q: any, i: number) => {
                                        let opts: string[] = []
                                        try { opts = JSON.parse(q.options) } catch { opts = [] }
                                        return { text: q.text, imageUrl: q.imageUrl || null, a: opts[0], b: opts[1], c: opts[2], d: opts[3] }
                                    })
                                    fetchApi('/tests/analyze-result', {
                                        method: 'POST',
                                        body: JSON.stringify({ title: test.title, subject: test.subject, score: result?.correct, total: result?.total, questions: qs })
                                    }).then((data: any) => {
                                        if (data?.analysis) setAnalysis(data.analysis)
                                        else setAnalysisFailed(true)
                                    }).catch(() => setAnalysisFailed(true)).finally(() => setAnalysisLoading(false))
                                }} className="text-[12px] px-3 py-1.5 rounded-lg font-medium transition flex-shrink-0"
                                    style={{ background: 'var(--brand-light)', color: 'var(--brand)', border: '1px solid color-mix(in srgb, var(--brand) 25%, transparent)' }}>
                                    Qayta urinish
                                </button>
                            </div>
                        ) : (
                            <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{analysis}</p>
                        )}
                    </div>
                )}

                {/* Questions */}
                {test?.questions?.map((q: any, qi: number) => {
                    const selected = answers[q.id]
                    let opts: string[] = []
                    try { opts = JSON.parse(q.options) } catch { opts = [] }
                    const correct = submitted ? correctMap[q.id] : null
                    const correctIdx = correct?.idx ?? -1
                    const isOpen = q.questionType === 'open'
                    const textAnswer = typeof answers[q.id] === 'string' ? answers[q.id] as string : ''
                    const serverResult = result?.results?.find((r: any) => r.questionId === q.id)
                    const isCorrectOpen = submitted && correct?.type === 'open'
                        ? (serverResult ? serverResult.isCorrect : textAnswer.trim().toLowerCase() === (correct.text || '').trim().toLowerCase())
                        : false

                    return (
                        <div key={q.id} className="card p-4">
                            <div className="flex items-start gap-2 mb-1">
                                <span className="text-[12px] mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{qi + 1}.</span>
                                <p className="text-[13px] font-medium leading-relaxed flex-1 flex flex-wrap items-center gap-x-1">
                                    <TextWithMath text={q.text} />
                                </p>
                                {isOpen && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--brand) 10%, transparent)', color: 'var(--brand)' }}>
                                        Yozma
                                    </span>
                                )}
                            </div>
                            {q.imageUrl && (
                                <div className="mt-2 mb-4">
                                    <img src={q.imageUrl} alt="Test savoli" className="max-w-full rounded-lg border shadow-sm" style={{ borderColor: 'var(--border)' }} />
                                </div>
                            )}

                            {isOpen ? (
                                /* Yozma javob maydoni */
                                <div className="mt-3 space-y-2">
                                    <textarea
                                        disabled={submitted}
                                        value={textAnswer}
                                        onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                                        placeholder="Javobingizni shu yerga yozing..."
                                        rows={3}
                                        className="w-full rounded-lg border px-3 py-2 text-[13px] resize-none outline-none transition"
                                        style={{
                                            background: submitted
                                                ? isCorrectOpen ? 'var(--success-light)' : 'var(--danger-light)'
                                                : 'var(--bg-surface)',
                                            borderColor: submitted
                                                ? isCorrectOpen ? 'var(--success)' : 'var(--danger)'
                                                : textAnswer.trim() ? 'var(--brand)' : 'var(--border)',
                                            color: 'var(--text-primary)'
                                        }}
                                    />
                                    {submitted && (
                                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px]"
                                            style={{ background: isCorrectOpen ? 'var(--success-light)' : 'var(--danger-light)', color: isCorrectOpen ? 'var(--success)' : 'var(--danger)' }}>
                                            {isCorrectOpen
                                                ? <><CheckCircle className="h-3.5 w-3.5 flex-shrink-0" /> To'g'ri javob!</>
                                                : <><XCircle className="h-3.5 w-3.5 flex-shrink-0" /> To'g'ri javob: <span className="font-semibold">{correct?.text}</span></>
                                            }
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* MCQ variantlari */
                                <div className="space-y-2 mt-3">
                                    {opts.map((opt, oi) => {
                                        const sel = answers[q.id]
                                        let bg = 'var(--bg-surface)'
                                        let border = 'var(--border)'
                                        let color = 'var(--text-primary)'

                                        if (!submitted && sel === oi) {
                                            bg = 'var(--brand-light)'; border = 'var(--brand)'; color = 'var(--brand-hover)'
                                        }
                                        if (submitted) {
                                            if (oi === correctIdx) { bg = 'var(--success-light)'; border = 'var(--success)'; color = 'var(--success)' }
                                            else if (sel === oi) { bg = 'var(--danger-light)'; border = 'var(--danger)'; color = 'var(--danger)' }
                                            else { bg = 'var(--bg-surface)'; border = 'var(--border)'; color = 'var(--text-muted)' }
                                        }

                                        return (
                                            <button
                                                key={oi}
                                                disabled={submitted}
                                                onClick={() => setAnswers(a => ({ ...a, [q.id]: oi }))}
                                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-left text-[13px] transition"
                                                style={{ background: bg, borderColor: border, color }}
                                            >
                                                <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-[10px] font-bold border-current">
                                                    {['A', 'B', 'C', 'D'][oi]}
                                                </span>
                                                <span className="flex-1 flex items-center gap-1">
                                                    <span>{opt.replace(/\$[^$]+\$/g, '').trim()}</span>
                                                    <MathPreview text={opt} inline={true} />
                                                </span>
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

                {/* Submit */}
                {!submitted && (
                    <button
                        onClick={submit}
                        disabled={submitting || answeredCount === 0}
                        className="w-full h-11 rounded-xl text-sm font-semibold text-white transition disabled:opacity-40"
                        style={{ background: 'var(--text-primary)' }}
                    >
                        {submitting ? 'Tekshirilmoqda...' : `Testni yuborish (${answeredCount}/${total})`}
                    </button>
                )}

                {submitted && (
                    <button onClick={() => nav('/suhbat')}
                        className="w-full h-11 rounded-xl text-sm font-semibold transition"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                        Chatga qaytish
                    </button>
                )}
            </div>
        </div>
    )
}
