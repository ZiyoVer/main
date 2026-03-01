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
        return <div className="mt-1.5 px-3 py-2 bg-blue-50/70 border border-blue-100 rounded-lg text-sm text-gray-800 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />
    } catch { return null }
}

interface Question { text: string; options: string[]; correctIdx: number }

const SUBJECTS = ['Matematika', 'Fizika', 'Kimyo', 'Biologiya', 'Ona tili', 'Ingliz tili', 'Tarix', 'Geografiya']

export default function TeacherPanel() {
    const nav = useNavigate()
    const { logout } = useAuthStore()
    const [tab, setTab] = useState<'create' | 'list'>('list')
    const [tests, setTests] = useState<any[]>([])

    // Form state
    const [title, setTitle] = useState('')
    const [subject, setSubject] = useState('Matematika')
    const [isPublic, setIsPublic] = useState(false)
    const [timeLimit, setTimeLimit] = useState<number>(0) // 0 = no limit, minutes otherwise
    const [questions, setQuestions] = useState<Question[]>([{ text: '', options: ['', '', '', ''], correctIdx: 0 }])
    const [loading, setLoading] = useState(false)
    const [msg, setMsg] = useState('')
    const [copied, setCopied] = useState<string | null>(null)
    const [analyticsId, setAnalyticsId] = useState<string | null>(null)
    const [analytics, setAnalytics] = useState<any>(null)
    const [loadingAnalytics, setLoadingAnalytics] = useState(false)

    // AI generate state
    const [aiFile, setAiFile] = useState<File | null>(null)
    const [aiGenerating, setAiGenerating] = useState(false)
    const [aiError, setAiError] = useState('')
    const [aiDone, setAiDone] = useState(false)
    const [showAiSection, setShowAiSection] = useState(true)
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
            // Map AI questions to our format
            const mapped: Question[] = data.questions.map((q: any) => ({
                text: q.text || '',
                options: Array.isArray(q.options) && q.options.length === 4
                    ? q.options
                    : ['', '', '', ''],
                correctIdx: typeof q.correctIdx === 'number' ? q.correctIdx : 0
            }))
            setQuestions(mapped)
            setAiDone(true)
            setShowAiSection(false)
            // Auto-fill title if empty
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
            setTimeLimit(0)
            setAiFile(null); setAiDone(false); setShowAiSection(true)
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
        setAnalyticsId(testId)
        setAnalytics(null)
        setLoadingAnalytics(true)
        try { setAnalytics(await fetchApi(`/tests/${testId}/analytics`)) } catch { }
        setLoadingAnalytics(false)
    }

    return (
        <>
        <div className="h-screen bg-[#fafafa] overflow-y-auto">
            <header className="bg-white/80 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-40">
                <div className="max-w-6xl mx-auto flex items-center justify-between py-3 px-6">
                    <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center">
                            <BrainCircuit className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className="text-sm font-bold text-gray-900">msert</span>
                        <span className="text-[11px] text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-md">O'qituvchi</span>
                    </div>
                    <button onClick={() => { logout(); nav('/') }} className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100 transition">
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-6 py-8">
                <div className="flex gap-1 mb-8 bg-gray-100 rounded-xl p-1 w-fit">
                    <button onClick={() => setTab('list')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        <ClipboardList className="h-4 w-4" /> Testlarim
                    </button>
                    <button onClick={() => setTab('create')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'create' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        <Plus className="h-4 w-4" /> Yangi Test
                    </button>
                </div>

                {/* Test List */}
                {tab === 'list' && (
                    <div className="space-y-2 anim-up">
                        {tests.length > 0 && <div className="text-xs text-gray-400 mb-2">{tests.length} ta test</div>}
                        {tests.length === 0 && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
                                <ClipboardList className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                                <p className="text-gray-400 mb-3 text-sm">Hozircha testlar yo'q</p>
                                <button onClick={() => setTab('create')} className="text-sm font-medium text-gray-900 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg transition">
                                    Birinchi testni yarating
                                </button>
                            </div>
                        )}
                        {tests.map(t => (
                            <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                                        {t.isPublic
                                            ? <span className="flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md"><Globe className="h-3 w-3" /> Public</span>
                                            : <span className="flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded-md"><Lock className="h-3 w-3" /> Private</span>}
                                    </div>
                                    <p className="text-xs text-gray-400">{t._count?.questions || 0} savol · {t._count?.attempts || 0} urinish · {t.subject}{t.timeLimit ? ` · ⏱ ${t.timeLimit} min` : ''}</p>
                                </div>
                                <button onClick={() => openAnalytics(t.id)} className="h-8 px-3 flex items-center gap-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition">
                                    <BarChart2 className="h-3 w-3" /> Statistika
                                </button>
                                <button onClick={() => copyLink(t.shareLink)} className="h-8 px-3 flex items-center gap-1.5 rounded-lg text-xs font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 transition">
                                    {copied === t.shareLink ? <><Check className="h-3 w-3 text-emerald-500" /> Nusxalandi</> : <><Copy className="h-3 w-3" /> Link</>}
                                </button>
                                <button onClick={() => deleteTest(t.id)} className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition">
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Create Test */}
                {tab === 'create' && (
                    <form onSubmit={submit} className="space-y-4 anim-up max-w-2xl">
                        {msg && <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl">{msg}</div>}

                        {/* Umumiy ma'lumot */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-900">Umumiy ma'lumot</h3>
                            <input placeholder="Test nomi" required value={title} onChange={e => setTitle(e.target.value)}
                                className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none text-sm transition" />
                            <select value={subject} onChange={e => setSubject(e.target.value)}
                                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-white focus:border-blue-500 outline-none text-sm">
                                {SUBJECTS.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                            <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
                                <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
                                <span className="text-gray-600">Public — barcha o'quvchilarga ko'rinsin</span>
                            </label>
                            {/* Time limit */}
                            <div>
                                <label className="text-xs font-medium text-gray-500 block mb-2">Vaqt chegarasi</label>
                                <div className="flex flex-wrap gap-2">
                                    {[0, 30, 45, 60, 90].map(min => (
                                        <button key={min} type="button" onClick={() => setTimeLimit(min)}
                                            className={`h-8 px-3 rounded-lg text-xs font-medium transition ${timeLimit === min ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                            {min === 0 ? 'Cheksiz' : `${min} daqiqa`}
                                        </button>
                                    ))}
                                    <input type="number" min="1" max="180" placeholder="Boshqa (min)"
                                        value={timeLimit > 0 && ![30, 45, 60, 90].includes(timeLimit) ? timeLimit : ''}
                                        onChange={e => setTimeLimit(parseInt(e.target.value) || 0)}
                                        className="h-8 w-28 px-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-blue-400" />
                                </div>
                            </div>
                        </div>

                        {/* AI yordamida yaratish */}
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                            <button type="button" onClick={() => setShowAiSection(!showAiSection)}
                                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 bg-gradient-to-br from-violet-500 to-blue-500 rounded-lg flex items-center justify-center">
                                        <Sparkles className="h-4 w-4 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">AI yordamida savollar yaratish</p>
                                        <p className="text-xs text-gray-400">Screenshot yoki PDF yuklang — AI savollarni o'zi chiqaradi</p>
                                    </div>
                                </div>
                                {showAiSection ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                            </button>

                            {showAiSection && (
                                <div className="px-5 pb-5 space-y-3 border-t border-gray-50">
                                    {/* Upload zone */}
                                    <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="hidden"
                                        onChange={e => { setAiFile(e.target.files?.[0] || null); setAiError(''); setAiDone(false) }} />
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`mt-3 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${aiFile ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                                        {aiFile ? (
                                            <div className="flex items-center justify-center gap-3">
                                                {aiFile.type.startsWith('image/') ? <Image className="h-6 w-6 text-blue-500" /> : <FileText className="h-6 w-6 text-blue-500" />}
                                                <div className="text-left">
                                                    <p className="text-sm font-medium text-gray-900 truncate max-w-[280px]">{aiFile.name}</p>
                                                    <p className="text-xs text-gray-400">{(aiFile.size / 1024).toFixed(0)} KB · O'zgartirish uchun bosing</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                                <p className="text-sm text-gray-500">Screenshot yoki PDF yuklash uchun bosing</p>
                                                <p className="text-xs text-gray-400 mt-1">PNG, JPG, PDF · max 20MB</p>
                                            </div>
                                        )}
                                    </div>

                                    {aiError && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{aiError}</div>}
                                    {aiDone && <div className="text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl">✅ {questions.length} ta savol yaratildi — pastda tekshirib chiqing</div>}

                                    <button type="button" onClick={generateFromFile} disabled={!aiFile || aiGenerating}
                                        className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:from-violet-700 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                                        {aiGenerating ? (
                                            <><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> AI savollarni tayyorlamoqda...</>
                                        ) : (
                                            <><Sparkles className="h-4 w-4" /> AI yordamida savollar yaratish</>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Savollar */}
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-700">{questions.length} ta savol</h3>
                            {aiDone && <span className="text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md">✨ AI yaratgan — tekshirib chiqing</span>}
                        </div>

                        {questions.map((q, qi) => (
                            <div key={qi} className={`bg-white rounded-2xl border p-5 space-y-3 transition ${aiDone ? 'border-violet-100' : 'border-gray-100'}`}>
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-gray-900">Savol {qi + 1}</h4>
                                    {questions.length > 1 && (
                                        <button type="button" onClick={() => removeQ(qi)} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                                <textarea placeholder="Savol matni ($formula$ yozsa preview chiqadi)" required value={q.text} onChange={e => updateQ(qi, 'text', e.target.value)} rows={2}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none text-sm transition resize-none" />
                                <MathPreview text={q.text} />
                                <div className="grid grid-cols-2 gap-2">
                                    {q.options.map((o, oi) => (
                                        <div key={oi}>
                                            <label className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition ${q.correctIdx === oi ? 'border-emerald-300 bg-emerald-50/60' : 'border-gray-200 hover:border-gray-300'}`}>
                                                <input type="radio" name={`correct-${qi}`} checked={q.correctIdx === oi} onChange={() => updateQ(qi, 'correctIdx', oi)} className="w-3.5 h-3.5 accent-emerald-600 flex-shrink-0" />
                                                <input placeholder={`Variant ${String.fromCharCode(65 + oi)}`} required value={o} onChange={e => updateQ(qi, `opt${oi}`, e.target.value)}
                                                    className="flex-1 bg-transparent outline-none text-sm min-w-0" />
                                            </label>
                                            <MathPreview text={o} />
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[11px] text-gray-400">To'g'ri javobni tanlash uchun yashil doirani bosing · $formula$ yozsa KaTeX preview chiqadi</p>
                            </div>
                        ))}

                        <button type="button" onClick={addQuestion} className="w-full h-11 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition flex items-center justify-center gap-2">
                            <Plus className="h-4 w-4" /> Savol qo'shish
                        </button>
                        <button type="submit" disabled={loading} className="w-full h-12 rounded-xl text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition disabled:opacity-50">
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
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center">
                                <BarChart2 className="h-4.5 w-4.5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-gray-900">{analytics?.test?.title || 'Yuklanmoqda...'}</h2>
                                {analytics && <p className="text-xs text-gray-400">{analytics.totalAttempts} urinish · O'rtacha ball: {analytics.avgScore}%</p>}
                            </div>
                        </div>
                        <button onClick={() => setAnalyticsId(null)} className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {loadingAnalytics ? (
                        <div className="flex-1 flex items-center justify-center p-12">
                            <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : analytics?.totalAttempts === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                            <Users className="h-10 w-10 text-gray-200 mb-3" />
                            <p className="text-gray-400 text-sm">Bu testni hali hech kim yechmagan</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
                            {/* Summary cards */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-blue-50 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-bold text-blue-600">{analytics?.totalAttempts}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Jami urinish</p>
                                </div>
                                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-bold text-emerald-600">{analytics?.avgScore}%</p>
                                    <p className="text-xs text-gray-500 mt-0.5">O'rtacha ball</p>
                                </div>
                                <div className="bg-amber-50 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-bold text-amber-600">
                                        {analytics?.questionStats ? Math.round(analytics.questionStats.reduce((s: number, q: any) => s + q.errorRate, 0) / (analytics.questionStats.length || 1)) : 0}%
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">O'rtacha xato</p>
                                </div>
                            </div>

                            {/* Students list */}
                            {analytics?.students?.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">O'quvchilar natijalari</h3>
                                    <div className="space-y-1.5">
                                        {analytics.students.map((s: any, i: number) => (
                                            <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{s.name}</p>
                                                    <p className="text-[11px] text-gray-400">{new Date(s.createdAt).toLocaleDateString('uz')}</p>
                                                </div>
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full transition-all"
                                                            style={{ width: `${s.score}%`, background: s.score >= 70 ? '#10b981' : s.score >= 50 ? '#f59e0b' : '#ef4444' }} />
                                                    </div>
                                                    <span className="text-sm font-bold text-gray-900 w-10 text-right">{s.score}%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Per-question breakdown */}
                            {analytics?.questionStats?.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Savollar tahlili</h3>
                                    <div className="space-y-3">
                                        {analytics.questionStats.map((q: any, i: number) => (
                                            <div key={q.id} className="bg-gray-50 rounded-xl p-4">
                                                <div className="flex items-start justify-between gap-3 mb-3">
                                                    <p className="text-[13px] text-gray-800 flex-1 leading-relaxed">{i + 1}. {q.text}</p>
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg flex-shrink-0 ${q.errorRate >= 60 ? 'bg-red-100 text-red-600' : q.errorRate >= 30 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {q.errorRate}% xato
                                                    </span>
                                                </div>
                                                {q.totalAnswered > 0 ? (
                                                    <div className="grid grid-cols-4 gap-2">
                                                        {q.options.map((opt: string, oi: number) => {
                                                            const count = q.optionCounts[oi] || 0
                                                            const pct = Math.round((count / q.totalAnswered) * 100)
                                                            const isCorrect = q.correctIdx === oi
                                                            return (
                                                                <div key={oi} className={`rounded-lg p-2.5 text-center border ${isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                                                                    <p className={`text-[11px] font-bold mb-1 ${isCorrect ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                                        {String.fromCharCode(65 + oi)}{isCorrect ? ' ✓' : ''}
                                                                    </p>
                                                                    <p className={`text-base font-bold ${isCorrect ? 'text-emerald-700' : pct > 0 ? 'text-gray-800' : 'text-gray-300'}`}>{pct}%</p>
                                                                    <p className="text-[10px] text-gray-400 mt-0.5">{count} kishi</p>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                ) : (
                                                    <p className="text-[12px] text-gray-400">Hali javob berilmagan</p>
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
