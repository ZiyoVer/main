import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrainCircuit, Plus, Trash2, LogOut, Copy, Check, Globe, Lock, ClipboardList, Upload, Sparkles, FileText, Image, ChevronDown, ChevronUp, BarChart2, X, Users } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import katex from 'katex'
import 'katex/dist/katex.min.css'

function MathPreview({ text }: { text: string }) {
    if (!text?.includes('$')) return null
    try {
        const html = text
            .replace(/\$\$([^$]+)\$\$/g, (_, m) => katex.renderToString(m.trim(), { displayMode: true, throwOnError: false }))
            .replace(/\$([^$\n]+)\$/g, (_, m) => katex.renderToString(m.trim(), { throwOnError: false }))
        return <div className="mt-1 px-2.5 py-1.5 bg-blue-50/70 border border-blue-100 rounded-lg text-sm text-gray-800 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />
    } catch { return null }
}

interface Question { text: string; options: string[]; correctIdx: number }

const SUBJECTS = ['Matematika', 'Fizika', 'Kimyo', 'Biologiya', 'Ona tili', 'Ingliz tili', 'Tarix', 'Geografiya']

export default function TeacherPanel() {
    const nav = useNavigate()
    const { logout } = useAuthStore()
    const [tab, setTab] = useState<'create' | 'list'>('list')
    const [tests, setTests] = useState<any[]>([])

    const [title, setTitle] = useState('')
    const [subject, setSubject] = useState('Matematika')
    const [isPublic, setIsPublic] = useState(false)
    const [timeLimit, setTimeLimit] = useState<number>(0)
    const [questions, setQuestions] = useState<Question[]>([{ text: '', options: ['', '', '', ''], correctIdx: 0 }])
    const [loading, setLoading] = useState(false)
    const [msg, setMsg] = useState('')
    const [copied, setCopied] = useState<string | null>(null)
    const [analyticsId, setAnalyticsId] = useState<string | null>(null)
    const [analytics, setAnalytics] = useState<any>(null)
    const [loadingAnalytics, setLoadingAnalytics] = useState(false)

    const [aiFile, setAiFile] = useState<File | null>(null)
    const [aiGenerating, setAiGenerating] = useState(false)
    const [aiError, setAiError] = useState('')
    const [aiDone, setAiDone] = useState(false)
    const [showAiSection, setShowAiSection] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => { loadTests() }, [])
    async function loadTests() {
        try { setTests(await fetchApi('/tests/my-tests')) } catch { }
    }

    function addQuestion() {
        setQuestions([...questions, { text: '', options: ['', '', '', ''], correctIdx: 0 }])
    }

    function updateQ(idx: number, field: string, value: any) {
        const updated = [...questions]
        if (field === 'text') updated[idx].text = value
        else if (field === 'correctIdx') updated[idx].correctIdx = value
        else if (field.startsWith('opt')) { const oi = parseInt(field.replace('opt', '')); updated[idx].options[oi] = value }
        setQuestions(updated)
    }

    function removeQ(idx: number) {
        if (questions.length <= 1) return
        setQuestions(questions.filter((_, i) => i !== idx))
    }

    async function generateFromFile() {
        if (!aiFile) return
        setAiGenerating(true); setAiError(''); setAiDone(false)
        try {
            const formData = new FormData()
            formData.append('file', aiFile)
            formData.append('subject', subject)
            const token = localStorage.getItem('token')
            const res = await fetch('/api/tests/generate-from-file', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Xatolik')
            const mapped: Question[] = data.questions.map((q: any) => ({
                text: q.text || '',
                options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ['', '', '', ''],
                correctIdx: typeof q.correctIdx === 'number' ? q.correctIdx : 0
            }))
            setQuestions(mapped)
            setAiDone(true)
            setShowAiSection(false)
            if (!title) setTitle(`${subject} testi`)
        } catch (e: any) {
            setAiError(e.message || 'AI test yarata olmadi')
        }
        setAiGenerating(false)
    }

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        if (loading) return
        for (let i = 0; i < questions.length; i++) {
            if (!questions[i].text.trim()) { setMsg(`Savol ${i + 1} matni bo'sh`); return }
            for (let j = 0; j < 4; j++) {
                if (!questions[i].options[j].trim()) { setMsg(`Savol ${i + 1}, variant ${String.fromCharCode(65 + j)} bo'sh`); return }
            }
        }
        setLoading(true); setMsg('')
        try {
            await fetchApi('/tests/create', { method: 'POST', body: JSON.stringify({ title, subject, isPublic, timeLimit: timeLimit || null, questions }) })
            setMsg(''); setTitle('')
            setQuestions([{ text: '', options: ['', '', '', ''], correctIdx: 0 }])
            setTimeLimit(0); setIsPublic(false)
            setAiFile(null); setAiDone(false); setShowAiSection(false)
            setTab('list'); loadTests()
        } catch (e: any) { setMsg(e.message) }
        setLoading(false)
    }

    async function deleteTest(id: string) {
        if (!confirm('Testni o\'chirmoqchimisiz?')) return
        try { await fetchApi(`/tests/${id}`, { method: 'DELETE' }); loadTests() } catch { }
    }

    function copyLink(link: string) {
        navigator.clipboard.writeText(link)
        setCopied(link)
        setTimeout(() => setCopied(null), 2000)
    }

    async function openAnalytics(testId: string) {
        setAnalyticsId(testId); setAnalytics(null); setLoadingAnalytics(true)
        try { setAnalytics(await fetchApi(`/tests/${testId}/analytics`)) } catch { }
        setLoadingAnalytics(false)
    }

    return (
        <>
        <div className="h-screen bg-[#f7f7f8] overflow-y-auto">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-40">
                <div className="max-w-5xl mx-auto flex items-center justify-between py-2.5 px-5">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-md flex items-center justify-center">
                            <BrainCircuit className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-sm font-bold text-gray-900">msert</span>
                        <span className="text-[10px] text-gray-400 font-medium bg-gray-100 px-1.5 py-0.5 rounded">O'qituvchi</span>
                    </div>
                    <button onClick={() => { logout(); nav('/') }} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100 transition">
                        <LogOut className="h-3.5 w-3.5" />
                    </button>
                </div>
            </header>

            <div className="max-w-5xl mx-auto px-5 py-5">
                {/* Tabs */}
                <div className="flex gap-0.5 mb-5 bg-gray-100 rounded-lg p-0.5 w-fit">
                    <button onClick={() => setTab('list')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-medium transition ${tab === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        <ClipboardList className="h-3.5 w-3.5" /> Testlarim
                    </button>
                    <button onClick={() => setTab('create')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-medium transition ${tab === 'create' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        <Plus className="h-3.5 w-3.5" /> Yangi Test
                    </button>
                </div>

                {/* Test List */}
                {tab === 'list' && (
                    <div className="space-y-1.5 anim-up">
                        {tests.length > 0 && <p className="text-[11px] text-gray-400 mb-1.5">{tests.length} ta test</p>}
                        {tests.length === 0 && (
                            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                                <ClipboardList className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                                <p className="text-gray-400 text-sm mb-2">Hozircha testlar yo'q</p>
                                <button onClick={() => setTab('create')} className="text-[13px] font-medium text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition">
                                    Birinchi testni yarating
                                </button>
                            </div>
                        )}
                        {tests.map(t => (
                            <div key={t.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <p className="text-[13px] font-medium text-gray-900 truncate">{t.title}</p>
                                        {t.isPublic
                                            ? <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex-shrink-0"><Globe className="h-2.5 w-2.5" /> Public</span>
                                            : <span className="flex items-center gap-0.5 text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded flex-shrink-0"><Lock className="h-2.5 w-2.5" /> Private</span>}
                                    </div>
                                    <p className="text-[11px] text-gray-400">{t._count?.questions || 0} savol · {t._count?.attempts || 0} urinish · {t.subject}{t.timeLimit ? ` · ⏱ ${t.timeLimit} min` : ''}</p>
                                </div>
                                <button onClick={() => openAnalytics(t.id)} className="h-7 px-2.5 flex items-center gap-1 rounded-lg text-[11px] font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition flex-shrink-0">
                                    <BarChart2 className="h-3 w-3" /> Statistika
                                </button>
                                <button onClick={() => copyLink(t.shareLink)} className="h-7 px-2.5 flex items-center gap-1 rounded-lg text-[11px] font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 transition flex-shrink-0">
                                    {copied === t.shareLink ? <><Check className="h-3 w-3 text-emerald-500" /> Nusxalandi</> : <><Copy className="h-3 w-3" /> Link</>}
                                </button>
                                <button onClick={() => deleteTest(t.id)} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition flex-shrink-0">
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Create Test */}
                {tab === 'create' && (
                    <form onSubmit={submit} className="space-y-3 anim-up max-w-2xl">
                        {msg && <div className="bg-red-50 text-red-600 text-[13px] px-3 py-2 rounded-lg">{msg}</div>}

                        {/* Umumiy ma'lumot */}
                        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2.5">
                            <h3 className="text-[13px] font-semibold text-gray-700">Umumiy ma'lumot</h3>
                            <input placeholder="Test nomi" required value={title} onChange={e => setTitle(e.target.value)}
                                className="w-full h-9 px-3 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none text-sm transition" />
                            <div className="flex gap-2">
                                <select value={subject} onChange={e => setSubject(e.target.value)}
                                    className="flex-1 h-9 px-3 rounded-lg border border-gray-200 bg-white focus:border-blue-500 outline-none text-sm">
                                    {SUBJECTS.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                                <label className="flex items-center gap-2 text-[13px] cursor-pointer select-none h-9 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition">
                                    <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-3.5 h-3.5 rounded border-gray-300 accent-blue-600" />
                                    <span className="text-gray-600">Public</span>
                                </label>
                            </div>
                            {/* Vaqt chegarasi */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] text-gray-400 mr-1">⏱ Vaqt:</span>
                                {[0, 30, 45, 60, 90].map(min => (
                                    <button key={min} type="button" onClick={() => setTimeLimit(min)}
                                        className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition ${timeLimit === min ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                        {min === 0 ? 'Cheksiz' : `${min} min`}
                                    </button>
                                ))}
                                <input type="number" min="1" max="180" placeholder="boshqa"
                                    value={timeLimit > 0 && ![30, 45, 60, 90].includes(timeLimit) ? timeLimit : ''}
                                    onChange={e => setTimeLimit(parseInt(e.target.value) || 0)}
                                    className="h-7 w-20 px-2 rounded-md border border-gray-200 text-[11px] outline-none focus:border-blue-400" />
                            </div>
                        </div>

                        {/* AI yordamida yaratish */}
                        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                            <button type="button" onClick={() => setShowAiSection(!showAiSection)}
                                className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 transition">
                                <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 bg-gradient-to-br from-violet-500 to-blue-500 rounded-md flex items-center justify-center flex-shrink-0">
                                        <Sparkles className="h-3 w-3 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-semibold text-gray-900">AI bilan yaratish</p>
                                        {aiDone && <p className="text-[11px] text-violet-600">✨ {questions.length} ta savol yaratildi</p>}
                                        {!aiDone && <p className="text-[11px] text-gray-400">PDF yoki screenshot yuklang</p>}
                                    </div>
                                </div>
                                {showAiSection ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                            </button>

                            {showAiSection && (
                                <div className="px-4 pb-4 space-y-2 border-t border-gray-50">
                                    <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="hidden"
                                        onChange={e => { setAiFile(e.target.files?.[0] || null); setAiError(''); setAiDone(false) }} />
                                    <div onClick={() => fileInputRef.current?.click()}
                                        className={`mt-2 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${aiFile ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                                        {aiFile ? (
                                            <div className="flex items-center justify-center gap-2">
                                                {aiFile.type.startsWith('image/') ? <Image className="h-4 w-4 text-blue-500" /> : <FileText className="h-4 w-4 text-blue-500" />}
                                                <div className="text-left">
                                                    <p className="text-[13px] font-medium text-gray-900 truncate max-w-[260px]">{aiFile.name}</p>
                                                    <p className="text-[11px] text-gray-400">{(aiFile.size / 1024).toFixed(0)} KB · O'zgartirish uchun bosing</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <Upload className="h-6 w-6 text-gray-300 mx-auto mb-1" />
                                                <p className="text-[13px] text-gray-500">Screenshot yoki PDF yuklash uchun bosing</p>
                                                <p className="text-[11px] text-gray-400 mt-0.5">PNG, JPG, PDF · max 20MB</p>
                                            </div>
                                        )}
                                    </div>
                                    {aiError && <div className="text-[13px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{aiError}</div>}
                                    <button type="button" onClick={generateFromFile} disabled={!aiFile || aiGenerating}
                                        className="w-full h-9 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 transition bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:from-violet-700 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                                        {aiGenerating
                                            ? <><div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Tayyorlanmoqda...</>
                                            : <><Sparkles className="h-3.5 w-3.5" /> AI bilan savollar yaratish</>}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Savollar */}
                        <div className="flex items-center justify-between">
                            <p className="text-[12px] font-semibold text-gray-500">{questions.length} ta savol</p>
                            {aiDone && <span className="text-[11px] text-violet-600 bg-violet-50 px-2 py-0.5 rounded">✨ AI yaratgan</span>}
                        </div>

                        {questions.map((q, qi) => (
                            <div key={qi} className={`bg-white rounded-xl border p-3.5 space-y-2 transition ${aiDone ? 'border-violet-100' : 'border-gray-100'}`}>
                                {/* Savol header */}
                                <div className="flex items-center justify-between">
                                    <span className="text-[12px] font-semibold text-gray-500">Savol {qi + 1}</span>
                                    {questions.length > 1 && (
                                        <button type="button" onClick={() => removeQ(qi)} className="h-6 w-6 flex items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition">
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                                <textarea placeholder="Savol matni ($formula$ yozsa preview chiqadi)" required value={q.text} onChange={e => updateQ(qi, 'text', e.target.value)} rows={2}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none text-[13px] transition resize-none" />
                                <MathPreview text={q.text} />
                                <div className="grid grid-cols-2 gap-1.5">
                                    {q.options.map((o, oi) => (
                                        <div key={oi}>
                                            <label className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-pointer transition ${q.correctIdx === oi ? 'border-emerald-300 bg-emerald-50/60' : 'border-gray-200 hover:border-gray-300'}`}>
                                                <input type="radio" name={`correct-${qi}`} checked={q.correctIdx === oi} onChange={() => updateQ(qi, 'correctIdx', oi)} className="w-3 h-3 accent-emerald-600 flex-shrink-0" />
                                                <input placeholder={`Variant ${String.fromCharCode(65 + oi)}`} required value={o} onChange={e => updateQ(qi, `opt${oi}`, e.target.value)}
                                                    className="flex-1 bg-transparent outline-none text-[13px] min-w-0" />
                                            </label>
                                            <MathPreview text={o} />
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] text-gray-300">Yashil doira = to'g'ri javob · $formula$ yozsa KaTeX preview</p>
                            </div>
                        ))}

                        <button type="button" onClick={addQuestion}
                            className="w-full h-9 rounded-xl border-2 border-dashed border-gray-200 text-[13px] text-gray-400 hover:border-gray-400 hover:text-gray-600 transition flex items-center justify-center gap-1.5">
                            <Plus className="h-3.5 w-3.5" /> Savol qo'shish
                        </button>
                        <button type="submit" disabled={loading}
                            className="w-full h-10 rounded-xl text-[13px] font-semibold text-white bg-gray-900 hover:bg-gray-800 transition disabled:opacity-50">
                            {loading ? 'Saqlanmoqda...' : `Testni Saqlash (${questions.length} savol)`}
                        </button>
                    </form>
                )}
            </div>
        </div>

        {/* Analytics Modal */}
        {analyticsId && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setAnalyticsId(null)}>
                <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
                        <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center">
                                <BarChart2 className="h-4 w-4 text-white" />
                            </div>
                            <div>
                                <h2 className="text-[13px] font-semibold text-gray-900">{analytics?.test?.title || 'Yuklanmoqda...'}</h2>
                                {analytics && <p className="text-[11px] text-gray-400">{analytics.totalAttempts} urinish · O'rtacha: {analytics.avgScore}%</p>}
                            </div>
                        </div>
                        <button onClick={() => setAnalyticsId(null)} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {loadingAnalytics ? (
                        <div className="flex-1 flex items-center justify-center p-12">
                            <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : analytics?.totalAttempts === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                            <Users className="h-8 w-8 text-gray-200 mb-2" />
                            <p className="text-gray-400 text-sm">Bu testni hali hech kim yechmagan</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-5 space-y-5 min-h-0">
                            <div className="grid grid-cols-3 gap-2.5">
                                <div className="bg-blue-50 rounded-xl p-3 text-center">
                                    <p className="text-xl font-bold text-blue-600">{analytics?.totalAttempts}</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">Jami urinish</p>
                                </div>
                                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                                    <p className="text-xl font-bold text-emerald-600">{analytics?.avgScore}%</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">O'rtacha ball</p>
                                </div>
                                <div className="bg-amber-50 rounded-xl p-3 text-center">
                                    <p className="text-xl font-bold text-amber-600">
                                        {analytics?.questionStats ? Math.round(analytics.questionStats.reduce((s: number, q: any) => s + q.errorRate, 0) / (analytics.questionStats.length || 1)) : 0}%
                                    </p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">O'rtacha xato</p>
                                </div>
                            </div>

                            {analytics?.students?.length > 0 && (
                                <div>
                                    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">O'quvchilar natijalari</h3>
                                    <div className="space-y-1">
                                        {analytics.students.map((s: any, i: number) => (
                                            <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                                                <div>
                                                    <p className="text-[13px] font-medium text-gray-900">{s.name}</p>
                                                    <p className="text-[10px] text-gray-400">{new Date(s.createdAt).toLocaleDateString('uz')}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full transition-all"
                                                            style={{ width: `${s.score}%`, background: s.score >= 70 ? '#10b981' : s.score >= 50 ? '#f59e0b' : '#ef4444' }} />
                                                    </div>
                                                    <span className="text-[13px] font-bold text-gray-900 w-9 text-right">{s.score}%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {analytics?.questionStats?.length > 0 && (
                                <div>
                                    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Savollar tahlili</h3>
                                    <div className="space-y-2">
                                        {analytics.questionStats.map((q: any, i: number) => (
                                            <div key={q.id} className="bg-gray-50 rounded-xl p-3">
                                                <div className="flex items-start justify-between gap-2 mb-2.5">
                                                    <p className="text-[12px] text-gray-800 flex-1 leading-relaxed">{i + 1}. {q.text}</p>
                                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${q.errorRate >= 60 ? 'bg-red-100 text-red-600' : q.errorRate >= 30 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {q.errorRate}% xato
                                                    </span>
                                                </div>
                                                {q.totalAnswered > 0 ? (
                                                    <div className="grid grid-cols-4 gap-1.5">
                                                        {q.options.map((opt: string, oi: number) => {
                                                            const count = q.optionCounts[oi] || 0
                                                            const pct = Math.round((count / q.totalAnswered) * 100)
                                                            const isCorrect = q.correctIdx === oi
                                                            return (
                                                                <div key={oi} className={`rounded-lg p-2 text-center border ${isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                                                                    <p className={`text-[10px] font-bold mb-0.5 ${isCorrect ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                                        {String.fromCharCode(65 + oi)}{isCorrect ? ' ✓' : ''}
                                                                    </p>
                                                                    <p className={`text-[15px] font-bold ${isCorrect ? 'text-emerald-700' : pct > 0 ? 'text-gray-800' : 'text-gray-300'}`}>{pct}%</p>
                                                                    <p className="text-[10px] text-gray-400">{count} kishi</p>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] text-gray-400">Hali javob berilmagan</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )}
        </>
    )
}
