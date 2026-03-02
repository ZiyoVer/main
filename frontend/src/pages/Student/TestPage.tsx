import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BrainCircuit, CheckCircle, XCircle, ArrowLeft } from 'lucide-react'
import { fetchApi } from '@/lib/api'

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
            setSubmitted(true)
        } catch (e: any) {
            alert(e.message)
        }
        setSubmitting(false)
    }

    if (loading) return (
        <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
            <div className="text-center">
                <div className="w-7 h-7 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-400">Yuklanmoqda...</p>
            </div>
        </div>
    )

    if (err) return (
        <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
            <div className="text-center">
                <p className="text-sm text-red-500 mb-3">{err}</p>
                <button onClick={() => nav('/chat')} className="text-sm text-blue-600 hover:underline">Bosh sahifaga qaytish</button>
            </div>
        </div>
    )

    const answeredCount = Object.keys(answers).length
    const total = test?.questions?.length || 0

    return (
        <div className="h-screen bg-[#fafafa] overflow-y-auto w-full">
            {/* Header */}
            <header className="bg-white/90 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-40">
                <div className="max-w-2xl mx-auto flex items-center justify-between py-3 px-5">
                    <div className="flex items-center gap-2">
                        <button onClick={() => nav('/chat')} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                        <div className="h-6 w-6 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-md flex items-center justify-center">
                            <BrainCircuit className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-sm font-bold text-gray-900 truncate max-w-[200px]">{test?.title}</span>
                    </div>
                    {!submitted && (
                        <span className="text-[12px] text-gray-400">{answeredCount}/{total} javoblandi</span>
                    )}
                </div>
            </header>

            <div className="max-w-2xl mx-auto px-5 py-6 space-y-4">
                {/* Test info */}
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <p className="text-sm font-semibold text-gray-900">{test?.title}</p>
                    <p className="text-[12px] text-gray-400 mt-0.5">{test?.subject} · {total} savol · O'qituvchi: {test?.creator?.name}</p>
                </div>

                {/* Result */}
                {submitted && result && (
                    <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
                        <div className={`text-4xl font-extrabold mb-1 ${result.score >= 70 ? 'text-emerald-600' : result.score >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                            {result.score}%
                        </div>
                        <p className="text-sm text-gray-500">{result.correct} / {result.total} to'g'ri</p>
                    </div>
                )}

                {/* Questions */}
                {test?.questions?.map((q: any, qi: number) => {
                    const selected = answers[q.id]
                    const opts: string[] = JSON.parse(q.options)
                    return (
                        <div key={q.id} className="bg-white rounded-xl border border-gray-100 p-4">
                            <p className="text-[13px] font-medium text-gray-900 mb-3">
                                <span className="text-gray-400 mr-1">{qi + 1}.</span> {q.text}
                            </p>
                            <div className="space-y-2">
                                {opts.map((opt, oi) => {
                                    let cls = 'border-gray-100 bg-gray-50/50 text-gray-700 hover:border-blue-300 hover:bg-blue-50/50'
                                    if (!submitted && selected === oi) cls = 'border-blue-500 bg-blue-50 text-blue-800'
                                    if (submitted) {
                                        if (oi === q.correctIdx) cls = 'border-emerald-400 bg-emerald-50 text-emerald-800'
                                        else if (selected === oi && oi !== q.correctIdx) cls = 'border-red-300 bg-red-50 text-red-700'
                                        else cls = 'border-gray-100 bg-gray-50/50 text-gray-400'
                                    }
                                    return (
                                        <button
                                            key={oi}
                                            disabled={submitted}
                                            onClick={() => setAnswers(a => ({ ...a, [q.id]: oi }))}
                                            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-left text-[13px] transition ${cls}`}
                                        >
                                            <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-[10px] font-bold border-current">
                                                {['A', 'B', 'C', 'D'][oi]}
                                            </span>
                                            <span className="flex-1">{opt}</span>
                                            {submitted && oi === q.correctIdx && <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
                                            {submitted && selected === oi && oi !== q.correctIdx && <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />}
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
                        className="w-full h-11 rounded-xl text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition disabled:opacity-40"
                    >
                        {submitting ? 'Tekshirilmoqda...' : `Testni yuborish (${answeredCount}/${total})`}
                    </button>
                )}

                {submitted && (
                    <button onClick={() => nav('/chat')} className="w-full h-11 rounded-xl text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition">
                        Chatga qaytish
                    </button>
                )}
            </div>
        </div>
    )
}
