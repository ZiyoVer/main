import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BrainCircuit, CheckCircle, XCircle, ArrowLeft } from 'lucide-react'
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
    const [answers, setAnswers] = useState<Record<string, number>>({})
    const [submitted, setSubmitted] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [submitting, setSubmitting] = useState(false)
    const [correctMap, setCorrectMap] = useState<Record<string, number>>({})

    useEffect(() => {
        if (!shareLink) return
        fetchApi(`/tests/by-link/${shareLink}`)
            .then(t => setTest(t))
            .catch(e => setErr(e.message || 'Test topilmadi'))
            .finally(() => setLoading(false))
    }, [shareLink])

    async function submit() {
        if (!test) return
        setSubmitting(true)
        try {
            const payload = test.questions.map((q: any) => ({
                questionId: q.id,
                selectedIdx: answers[q.id] ?? -1
            }))
            const res = await fetchApi(`/tests/${test.id}/submit`, {
                method: 'POST',
                body: JSON.stringify({ answers: payload })
            })
            setResult(res)
            const map: Record<string, number> = {}
            res.correctAnswers?.forEach((ca: any) => { map[ca.id] = ca.correctIdx })
            setCorrectMap(map)
            setSubmitted(true)
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

    const answeredCount = Object.keys(answers).length
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
                        <div className="text-4xl font-extrabold mb-1" style={{
                            color: result.score >= 70 ? 'var(--success)' : result.score >= 50 ? 'var(--warning)' : 'var(--danger)'
                        }}>
                            {result.score}%
                        </div>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{result.correct} / {result.total} to'g'ri</p>
                    </div>
                )}

                {/* Questions */}
                {test?.questions?.map((q: any, qi: number) => {
                    const selected = answers[q.id]
                    let opts: string[] = []
                    try { opts = JSON.parse(q.options) } catch { opts = [] }
                    const correctIdx = submitted ? (correctMap[q.id] ?? -1) : -1
                    return (
                        <div key={q.id} className="card p-4">
                            <p className="text-[13px] font-medium mb-1 leading-relaxed">
                                <span className="mr-1" style={{ color: 'var(--text-muted)' }}>{qi + 1}.</span>
                                <TextWithMath text={q.text} />
                            </p>
                            {q.imageUrl && (
                                <div className="mt-2 mb-4">
                                    <img src={q.imageUrl} alt="Test savoli" className="max-w-full rounded-lg border shadow-sm" style={{ borderColor: 'var(--border)' }} />
                                </div>
                            )}
                            <div className="space-y-2 mt-3">
                                {opts.map((opt, oi) => {
                                    let bg = 'var(--bg-surface)'
                                    let border = 'var(--border)'
                                    let color = 'var(--text-primary)'

                                    if (!submitted && selected === oi) {
                                        bg = 'var(--brand-light)'
                                        border = 'var(--brand)'
                                        color = 'var(--brand-hover)'
                                    }
                                    if (submitted) {
                                        if (oi === correctIdx) { bg = 'var(--success-light)'; border = 'var(--success)'; color = 'var(--success)' }
                                        else if (selected === oi) { bg = 'var(--danger-light)'; border = 'var(--danger)'; color = 'var(--danger)' }
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
                                            {submitted && selected === oi && oi !== correctIdx && <XCircle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--danger)' }} />}
                                        </button>
                                    )
                                })}
                            </div>
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
