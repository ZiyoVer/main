import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { BrainCircuit, Plus, Trash2, LogOut, Copy, Check, Globe, Lock, ClipboardList, Upload, Sparkles, FileText, Image, ChevronDown, ChevronUp, BarChart2, X, Users } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { SUBJECTS } from '../../constants'
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

        return <div className="mt-1 px-2.5 py-1.5 rounded-lg text-sm overflow-x-auto" style={{ background: 'color-mix(in srgb, var(--brand) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--brand) 15%, transparent)', color: 'var(--text-primary)' }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
    } catch { return null }
}

interface Question { text: string; imageUrl?: string | null; options: string[]; correctIdx: number; questionType: 'mcq' | 'open'; correctText?: string }

export default function TeacherPanel() {
    const nav = useNavigate()
    const { logout } = useAuthStore()
    const [tab, setTab] = useState<'create' | 'list'>('list')
    const [tests, setTests] = useState<any[]>([])

    const [title, setTitle] = useState('')
    const [subject, setSubject] = useState('Matematika')
    const [isPublic, setIsPublic] = useState(false)
    const [timeLimit, setTimeLimit] = useState<number>(0)
    const [questions, setQuestions] = useState<Question[]>([{ text: '', options: ['', '', '', ''], correctIdx: 0, questionType: 'mcq', correctText: '' }])
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
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setAnalyticsId(null)
        }
        window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [])
    async function loadTests() {
        try { setTests(await fetchApi('/tests/my-tests')) } catch { }
    }

    function addQuestion() {
        setQuestions([...questions, { text: '', imageUrl: null, options: ['', '', '', ''], correctIdx: 0, questionType: 'mcq', correctText: '' }])
    }

    async function handleImageUpload(qi: number, file: File) {
        // S3 o'rniga base64 — server konfiguratsiya talab qilmaydi
        const MAX_SIZE = 2 * 1024 * 1024 // 2MB
        if (file.size > MAX_SIZE) {
            toast.error('Rasm hajmi 2MB dan oshmasligi kerak')
            return
        }
        const reader = new FileReader()
        reader.onload = (e) => {
            const base64 = e.target?.result as string
            updateQ(qi, 'imageUrl', base64)
        }
        reader.onerror = () => toast.error('Rasm o\'qishda xatolik')
        reader.readAsDataURL(file)
    }

    function updateQ(idx: number, field: string, value: any) {
        setQuestions(prev => prev.map((q, i) => {
            if (i !== idx) return q
            if (field === 'text') return { ...q, text: value }
            if (field === 'imageUrl') return { ...q, imageUrl: value }
            if (field === 'correctIdx') return { ...q, correctIdx: value }
            if (field === 'correctText') return { ...q, correctText: value }
            if (field === 'questionType') return { ...q, questionType: value }
            if (field.startsWith('opt')) {
                const oi = parseInt(field.replace('opt', ''))
                const newOptions = [...q.options]
                newOptions[oi] = value
                return { ...q, options: newOptions }
            }
            return q
        }))
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
            const mapped: Question[] = data.questions.map((q: any) => {
                // options: backend allaqachon validatsiya qilgan, lekin 4 ta bo'lmasa to'ldiramiz
                let opts = Array.isArray(q.options) ? q.options.map(String) : []
                while (opts.length < 4) opts.push('')
                return {
                    text: q.text || '',
                    options: opts.slice(0, 4),
                    correctIdx: typeof q.correctIdx === 'number' ? q.correctIdx : 0,
                    questionType: 'mcq' as const,
                    correctText: ''
                }
            })
            setQuestions(mapped)
            setAiDone(true)
            setShowAiSection(false)
            if (!title) setTitle(`${subject} testi`)
            if (data.truncated) {
                setAiError('PDF katta bo\'lgani uchun faqat birinchi qism tahlil qilindi. Natijalarni tekshiring.')
            }
        } catch (e: any) {
            setAiError(e.message || 'AI test yarata olmadi')
        }
        setAiGenerating(false)
    }

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        if (loading) return

        // Auto-fill empty options or text if there's an image
        const finalQuestions = questions.map(q => {
            if (q.questionType === 'open') {
                return { ...q, text: q.text?.trim() || (q.imageUrl ? ' ' : ''), options: [], correctIdx: -1 }
            }
            const newOpts = [...(q.options || ['', '', '', ''])]
            for (let j = 0; j < 4; j++) {
                if (!newOpts[j].trim() && q.imageUrl) {
                    newOpts[j] = String.fromCharCode(65 + j)
                }
            }
            return { ...q, text: q.text?.trim() || (q.imageUrl ? ' ' : ''), options: newOpts }
        })

        for (let i = 0; i < finalQuestions.length; i++) {
            if (!finalQuestions[i].text?.trim() && !finalQuestions[i].imageUrl) { setMsg(`Savol ${i + 1} matni bo'sh`); return }
            if (finalQuestions[i].questionType === 'open') continue
            for (let j = 0; j < 4; j++) {
                if (!finalQuestions[i].options[j]?.trim()) { setMsg(`Savol ${i + 1}, variant ${String.fromCharCode(65 + j)} bo'sh`); return }
            }
        }
        setLoading(true); setMsg('')
        try {
            await fetchApi('/tests/create', { method: 'POST', body: JSON.stringify({ title, subject, isPublic, timeLimit: timeLimit || null, questions: finalQuestions }) })
            setMsg('success')
            setTitle('')
            setQuestions([{ text: '', options: ['', '', '', ''], correctIdx: 0, questionType: 'mcq', correctText: '' }])
            setTimeLimit(0); setIsPublic(false)
            setAiFile(null); setAiDone(false); setShowAiSection(false)
            // fileInput ni tozalash — bir xil faylni qayta yuklash mumkin bo'lsin
            if (fileInputRef.current) fileInputRef.current.value = ''
            setTab('list'); loadTests()
        } catch (e: any) { setMsg(e.message) }
        finally { setLoading(false) }
    }

    async function deleteTest(id: string) {
        if (!confirm('Testni o\'chirmoqchimisiz?')) return
        try { await fetchApi(`/tests/${id}`, { method: 'DELETE' }); loadTests() } catch { }
    }

    function copyLink(shareLink: string) {
        const url = `${window.location.origin}/test/${shareLink}`
        navigator.clipboard.writeText(url)
        setCopied(shareLink)
        setTimeout(() => setCopied(null), 2000)
    }

    async function openAnalytics(testId: string) {
        setAnalyticsId(testId); setAnalytics(null); setLoadingAnalytics(true)
        try { setAnalytics(await fetchApi(`/tests/${testId}/analytics`)) } catch { }
        setLoadingAnalytics(false)
    }

    // Helpers
    const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)' }
    const mutedText = { color: 'var(--text-muted)' }
    const secondaryText = { color: 'var(--text-secondary)' }

    return (
        <>
            <div className="h-screen overflow-y-auto w-full" style={{ background: 'var(--bg-page)' }}>
                {/* Header */}
                <header className="sticky top-0 z-40" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
                    <div className="max-w-5xl mx-auto flex items-center justify-between py-2.5 px-5">
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ background: 'var(--brand)' }}>
                                <BrainCircuit className="h-3 w-3 text-white" />
                            </div>
                            <span className="text-sm font-bold">msert</span>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)' }}>O'qituvchi</span>
                        </div>
                        <button onClick={() => { logout(); nav('/') }} className="h-7 w-7 flex items-center justify-center rounded-lg transition"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-light)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}>
                            <LogOut className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </header>

                <div className="max-w-5xl mx-auto px-5 py-5">
                    {/* Tabs */}
                    <div className="flex gap-0.5 mb-5 p-0.5 rounded-lg w-fit" style={{ background: 'var(--bg-surface)' }}>
                        <button onClick={() => { setTab('list'); setMsg('') }}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-medium transition"
                            style={tab === 'list' ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : { color: 'var(--text-secondary)' }}>
                            <ClipboardList className="h-3.5 w-3.5" /> Testlarim
                        </button>
                        <button onClick={() => { setTab('create'); setMsg('') }}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-medium transition"
                            style={tab === 'create' ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : { color: 'var(--text-secondary)' }}>
                            <Plus className="h-3.5 w-3.5" /> Yangi Test
                        </button>
                    </div>

                    {/* Test List */}
                    {tab === 'list' && (
                        <div className="space-y-1.5 anim-up">
                            {tests.length > 0 && <p className="text-[11px] mb-1.5" style={mutedText}>{tests.length} ta test</p>}
                            {tests.length === 0 && (
                                <div className="card rounded-xl p-12 text-center">
                                    <ClipboardList className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--border-strong)' }} />
                                    <p className="text-sm mb-2" style={mutedText}>Hozircha testlar yo'q</p>
                                    <button onClick={() => setTab('create')} className="text-[13px] font-medium px-3 py-1.5 rounded-lg transition"
                                        style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}>
                                        Birinchi testni yarating
                                    </button>
                                </div>
                            )}
                            {tests.map(t => (
                                <div key={t.id} className="card px-4 py-3 flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <p className="text-[13px] font-medium truncate">{t.title}</p>
                                            {t.isPublic
                                                ? <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: 'var(--success)', background: 'var(--success-light)' }}><Globe className="h-2.5 w-2.5" /> Public</span>
                                                : <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)' }}><Lock className="h-2.5 w-2.5" /> Private</span>}
                                        </div>
                                        <p className="text-[11px]" style={mutedText}>{t._count?.questions || 0} savol · {t._count?.attempts || 0} urinish · {t.subject}{t.timeLimit ? ` · ⏱ ${t.timeLimit} min` : ''}</p>
                                    </div>
                                    <button onClick={() => openAnalytics(t.id)} className="h-7 px-2.5 flex items-center gap-1 rounded-lg text-[11px] font-medium transition flex-shrink-0"
                                        style={{ color: 'var(--info)', background: 'var(--info-light)' }}>
                                        <BarChart2 className="h-3 w-3" /> Statistika
                                    </button>
                                    <button onClick={() => copyLink(t.shareLink)} className="h-7 px-2.5 flex items-center gap-1 rounded-lg text-[11px] font-medium transition flex-shrink-0"
                                        style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}>
                                        {copied === t.shareLink ? <><Check className="h-3 w-3" style={{ color: 'var(--success)' }} /> Nusxalandi</> : <><Copy className="h-3 w-3" /> Link</>}
                                    </button>
                                    <button onClick={() => deleteTest(t.id)} className="h-7 w-7 flex items-center justify-center rounded-lg transition flex-shrink-0"
                                        style={{ color: 'var(--border-strong)' }}
                                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-light)' }}
                                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--border-strong)'; e.currentTarget.style.background = 'transparent' }}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Create Test */}
                    {tab === 'create' && (
                        <form onSubmit={submit} className="space-y-3 anim-up max-w-2xl">
                            {msg === 'success' && (
                                <div className="text-[13px] px-3 py-2 rounded-lg" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
                                    Test muvaffaqiyatli saqlandi
                                </div>
                            )}
                            {msg && msg !== 'success' && (
                                <div className="text-[13px] px-3 py-2 rounded-lg" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>{msg}</div>
                            )}

                            {/* Umumiy ma'lumot */}
                            <div className="rounded-xl p-4 space-y-2.5" style={cardStyle}>
                                <h3 className="text-[13px] font-semibold" style={secondaryText}>Umumiy ma'lumot</h3>
                                <input placeholder="Test nomi" required value={title} onChange={e => setTitle(e.target.value)}
                                    className="input" />
                                <div className="flex gap-2">
                                    <select value={subject} onChange={e => setSubject(e.target.value)}
                                        className="input" style={{ flex: 1, cursor: 'pointer' }}>
                                        {SUBJECTS.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                    <label className="flex items-center gap-2 text-[13px] cursor-pointer select-none h-9 px-3 rounded-lg transition"
                                        style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
                                        <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-3.5 h-3.5 rounded" style={{ accentColor: 'var(--brand)' }} />
                                        <span>Public</span>
                                    </label>
                                </div>
                                {/* Vaqt chegarasi */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[11px] mr-1" style={mutedText}>⏱ Vaqt:</span>
                                    {[0, 30, 45, 60, 90].map(min => (
                                        <button key={min} type="button" onClick={() => setTimeLimit(min)}
                                            className="h-7 px-2.5 rounded-md text-[11px] font-medium transition"
                                            style={timeLimit === min ? { background: 'var(--brand)', color: '#fff' } : { background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                                            {min === 0 ? 'Cheksiz' : `${min} min`}
                                        </button>
                                    ))}
                                    <input type="number" min="1" max="180" placeholder="boshqa (min)"
                                        value={timeLimit > 0 && ![30, 45, 60, 90].includes(timeLimit) ? String(timeLimit) : ''}
                                        onChange={e => {
                                            const val = parseInt(e.target.value)
                                            if (!isNaN(val) && val > 0) setTimeLimit(val)
                                            else if (e.target.value === '') setTimeLimit(0)
                                        }}
                                        className="input" style={{ height: '1.75rem', width: '6.5rem', fontSize: '11px', padding: '0 0.5rem' }} />
                                </div>
                            </div>

                            {/* AI yordamida yaratish */}
                            <div className="rounded-xl overflow-hidden" style={cardStyle}>
                                <button type="button" onClick={() => setShowAiSection(!showAiSection)}
                                    className="w-full flex items-center justify-between px-4 py-2.5 text-left transition"
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 bg-gradient-to-br from-violet-500 to-blue-500 rounded-md flex items-center justify-center flex-shrink-0">
                                            <Sparkles className="h-3 w-3 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-semibold">AI bilan yaratish</p>
                                            {aiDone && <p className="text-[11px]" style={{ color: '#8b5cf6' }}>✨ {questions.length} ta savol yaratildi</p>}
                                            {!aiDone && <p className="text-[11px]" style={mutedText}>PDF yoki screenshot yuklang</p>}
                                        </div>
                                    </div>
                                    {showAiSection ? <ChevronUp className="h-3.5 w-3.5" style={mutedText} /> : <ChevronDown className="h-3.5 w-3.5" style={mutedText} />}
                                </button>

                                {showAiSection && (
                                    <div className="px-4 pb-4 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
                                        <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="hidden"
                                            onChange={e => { setAiFile(e.target.files?.[0] || null); setAiError(''); setAiDone(false) }} />
                                        <div onClick={() => fileInputRef.current?.click()}
                                            className="mt-2 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors"
                                            style={aiFile ? { borderColor: 'color-mix(in srgb, var(--brand) 40%, transparent)', background: 'color-mix(in srgb, var(--brand) 5%, transparent)' } : { borderColor: 'var(--border)', background: 'transparent' }}>
                                            {aiFile ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    {aiFile.type.startsWith('image/') ? <Image className="h-4 w-4" style={{ color: 'var(--brand)' }} /> : <FileText className="h-4 w-4" style={{ color: 'var(--brand)' }} />}
                                                    <div className="text-left">
                                                        <p className="text-[13px] font-medium truncate max-w-[260px]">{aiFile.name}</p>
                                                        <p className="text-[11px]" style={mutedText}>{(aiFile.size / 1024).toFixed(0)} KB · O'zgartirish uchun bosing</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <Upload className="h-6 w-6 mx-auto mb-1" style={{ color: 'var(--border-strong)' }} />
                                                    <p className="text-[13px]" style={secondaryText}>Screenshot yoki PDF yuklash uchun bosing</p>
                                                    <p className="text-[11px] mt-0.5" style={mutedText}>PNG, JPG, PDF · max 20MB</p>
                                                </div>
                                            )}
                                        </div>
                                        {aiError && <div className="text-[13px] px-3 py-2 rounded-lg" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>{aiError}</div>}
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
                                <p className="text-[12px] font-semibold" style={secondaryText}>{questions.length} ta savol</p>
                                {aiDone && <span className="text-[11px] px-2 py-0.5 rounded" style={{ color: '#8b5cf6', background: 'color-mix(in srgb, #8b5cf6 10%, transparent)' }}>✨ AI yaratgan</span>}
                            </div>

                            {questions.map((q, qi) => (
                                <div key={qi} className="rounded-xl p-3.5 space-y-2 transition" style={{ ...cardStyle, borderColor: aiDone ? 'color-mix(in srgb, #8b5cf6 20%, transparent)' : 'var(--border)' }}
                                    onPaste={(e) => {
                                        const items = e.clipboardData?.items
                                        if (!items) return
                                        for (const item of items) {
                                            if (item.type.startsWith('image/')) {
                                                const file = item.getAsFile()
                                                if (file) {
                                                    e.preventDefault()
                                                    handleImageUpload(qi, file)
                                                    break
                                                }
                                            }
                                        }
                                    }}
                                >
                                    {/* Savol header */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[12px] font-semibold" style={secondaryText}>Savol {qi + 1}</span>
                                            {/* MCQ / Yozma toggle */}
                                            <div className="flex rounded-md overflow-hidden border text-[11px] font-medium" style={{ borderColor: 'var(--border)' }}>
                                                <button type="button" onClick={() => updateQ(qi, 'questionType', 'mcq')}
                                                    className="px-2 py-0.5 transition"
                                                    style={q.questionType !== 'open' ? { background: 'var(--brand)', color: '#fff' } : { background: 'transparent', color: 'var(--text-muted)' }}>
                                                    A/B/C/D
                                                </button>
                                                <button type="button" onClick={() => updateQ(qi, 'questionType', 'open')}
                                                    className="px-2 py-0.5 transition"
                                                    style={q.questionType === 'open' ? { background: 'var(--brand)', color: '#fff' } : { background: 'transparent', color: 'var(--text-muted)' }}>
                                                    Yozma
                                                </button>
                                            </div>
                                        </div>
                                        {questions.length > 1 && (
                                            <button type="button" onClick={() => removeQ(qi)} className="h-6 w-6 flex items-center justify-center rounded-md transition"
                                                style={{ color: 'var(--border-strong)' }}
                                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-light)' }}
                                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--border-strong)'; e.currentTarget.style.background = 'transparent' }}>
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <textarea placeholder="Savol matni ($formula$ yozsa preview chiqadi)" required={!q.imageUrl} value={q.text} onChange={e => updateQ(qi, 'text', e.target.value)} rows={2}
                                            className="input resize-none w-full pr-12" style={{ height: 'auto', padding: '0.5rem 0.75rem', fontSize: '13px' }} />
                                        <label className="absolute right-2 top-2 p-1.5 rounded-md cursor-pointer transition hover:bg-slate-100 dark:hover:bg-slate-800"
                                            title="Rasm yuklash yoki Ctrl+V (Paste) orqali kiritish">
                                            <input type="file" accept="image/*" className="hidden" onChange={e => {
                                                if (e.target.files?.[0]) handleImageUpload(qi, e.target.files[0]);
                                                e.target.value = ''
                                            }} />
                                            <Image className="h-4 w-4" style={{ color: 'var(--brand)' }} />
                                        </label>
                                    </div>
                                    {q.imageUrl && (
                                        <div className="relative inline-block mt-2">
                                            <img src={q.imageUrl} alt="Savol rasmi" className="max-h-32 rounded-lg border shadow-sm" style={{ borderColor: 'var(--border)' }} />
                                            <button type="button" onClick={() => updateQ(qi, 'imageUrl', null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition shadow-md">
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )}
                                    <MathPreview text={q.text} />
                                    {q.questionType === 'open' ? (
                                        /* Yozma savol uchun to'g'ri javob kirish maydoni */
                                        <div className="mt-1 space-y-1">
                                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>To'g'ri javob (o'quvchi aynan shu yozadi):</p>
                                            <input
                                                placeholder="Masalan: 42 yoki x=3 yoki Parij"
                                                value={q.correctText || ''}
                                                onChange={e => updateQ(qi, 'correctText', e.target.value)}
                                                className="input w-full text-[13px]"
                                                style={{ padding: '0.4rem 0.75rem', borderColor: 'color-mix(in srgb, var(--success) 40%, transparent)', background: 'color-mix(in srgb, var(--success) 4%, transparent)' }}
                                            />
                                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Katta-kichik harf farq qilmaydi · Matematik formulalar uchun oddiy yozing: 1/2, sqrt(2)</p>
                                        </div>
                                    ) : (
                                        /* MCQ variantlari */
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {q.options.map((o, oi) => (
                                                <div key={oi}>
                                                    <label className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition"
                                                        style={q.correctIdx === oi ? { border: '1px solid color-mix(in srgb, var(--success) 40%, transparent)', background: 'color-mix(in srgb, var(--success) 6%, transparent)' } : { border: '1px solid var(--border)' }}>
                                                        <input type="radio" name={`correct-${qi}`} checked={q.correctIdx === oi} onChange={() => updateQ(qi, 'correctIdx', oi)} className="w-3 h-3 flex-shrink-0" style={{ accentColor: 'var(--success)' }} />
                                                        <input placeholder={`Variant ${String.fromCharCode(65 + oi)}`} required={!q.imageUrl} value={o} onChange={e => updateQ(qi, `opt${oi}`, e.target.value)}
                                                            className="flex-1 bg-transparent outline-none text-[13px] min-w-0" />
                                                        <MathPreview text={o} inline={true} />
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {q.questionType !== 'open' && <p className="text-[10px]" style={{ color: 'var(--border-strong)' }}>Yashil doira = to'g'ri javob · $formula$ yozsa KaTeX preview</p>}
                                </div>
                            ))}

                            <button type="button" onClick={addQuestion}
                                className="w-full h-9 rounded-xl border-2 border-dashed text-[13px] transition flex items-center justify-center gap-1.5"
                                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                                <Plus className="h-3.5 w-3.5" /> Savol qo'shish
                            </button>
                            <button type="submit" disabled={loading}
                                className="btn btn-primary" style={{ width: '100%', height: '2.5rem' }}>
                                {loading ? 'Saqlanmoqda...' : `Testni Saqlash (${questions.length} savol)`}
                            </button>
                        </form>
                    )}
                </div>
            </div>

            {/* Analytics Modal */}
            {analyticsId && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setAnalyticsId(null)}>
                    <div className="rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl" style={{ background: 'var(--bg-card)' }} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                            <div className="flex items-center gap-2.5">
                                <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center">
                                    <BarChart2 className="h-4 w-4 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-[13px] font-semibold">{analytics?.test?.title || 'Yuklanmoqda...'}</h2>
                                    {analytics && <p className="text-[11px]" style={mutedText}>{analytics.totalAttempts} urinish · O'rtacha: {analytics.avgScore}%</p>}
                                </div>
                            </div>
                            <button onClick={() => setAnalyticsId(null)} className="h-7 w-7 flex items-center justify-center rounded-lg transition"
                                style={mutedText}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {loadingAnalytics ? (
                            <div className="flex-1 flex items-center justify-center p-12">
                                <div className="h-5 w-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
                            </div>
                        ) : analytics?.totalAttempts === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                                <Users className="h-8 w-8 mb-2" style={{ color: 'var(--border)' }} />
                                <p className="text-sm" style={mutedText}>Bu testni hali hech kim yechmagan</p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-5 space-y-5 min-h-0">
                                <div className="grid grid-cols-3 gap-2.5">
                                    <div className="rounded-xl p-3 text-center" style={{ background: 'color-mix(in srgb, var(--brand) 10%, transparent)' }}>
                                        <p className="text-xl font-bold" style={{ color: 'var(--brand)' }}>{analytics?.totalAttempts}</p>
                                        <p className="text-[11px] mt-0.5" style={secondaryText}>Jami urinish</p>
                                    </div>
                                    <div className="rounded-xl p-3 text-center" style={{ background: 'color-mix(in srgb, var(--success) 10%, transparent)' }}>
                                        <p className="text-xl font-bold" style={{ color: 'var(--success)' }}>{analytics?.avgScore}%</p>
                                        <p className="text-[11px] mt-0.5" style={secondaryText}>O'rtacha ball</p>
                                    </div>
                                    <div className="rounded-xl p-3 text-center" style={{ background: 'color-mix(in srgb, #f59e0b 10%, transparent)' }}>
                                        <p className="text-xl font-bold" style={{ color: '#f59e0b' }}>
                                            {analytics?.questionStats ? Math.round(analytics.questionStats.reduce((s: number, q: any) => s + q.errorRate, 0) / (analytics.questionStats.length || 1)) : 0}%
                                        </p>
                                        <p className="text-[11px] mt-0.5" style={secondaryText}>O'rtacha xato</p>
                                    </div>
                                </div>

                                {analytics?.students?.length > 0 && (
                                    <div>
                                        <h3 className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={mutedText}>O'quvchilar natijalari</h3>
                                        <div className="space-y-1">
                                            {analytics.students.map((s: any, i: number) => (
                                                <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'var(--bg-surface)' }}>
                                                    <div>
                                                        <p className="text-[13px] font-medium">{s.name}</p>
                                                        <p className="text-[10px]" style={mutedText}>{new Date(s.createdAt).toLocaleDateString('uz')}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                                                            <div className="h-full rounded-full transition-all"
                                                                style={{ width: `${s.score}%`, background: s.score >= 70 ? 'var(--success)' : s.score >= 50 ? '#f59e0b' : 'var(--danger)' }} />
                                                        </div>
                                                        <span className="text-[13px] font-bold w-9 text-right">{s.score}%</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {analytics?.questionStats?.length > 0 && (
                                    <div>
                                        <h3 className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={mutedText}>Savollar tahlili</h3>
                                        <div className="space-y-2">
                                            {analytics.questionStats.map((q: any, i: number) => (
                                                <div key={q.id} className="rounded-xl p-3" style={{ background: 'var(--bg-surface)' }}>
                                                    <div className="flex items-start justify-between gap-2 mb-2.5">
                                                        <p className="text-[12px] flex-1 leading-relaxed">{i + 1}. {q.text}</p>
                                                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md flex-shrink-0"
                                                            style={q.errorRate >= 60 ? { background: 'color-mix(in srgb, var(--danger) 15%, transparent)', color: 'var(--danger)' } : q.errorRate >= 30 ? { background: 'color-mix(in srgb, #f59e0b 15%, transparent)', color: '#f59e0b' } : { background: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)' }}>
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
                                                                    <div key={oi} className="rounded-lg p-2 text-center"
                                                                        style={isCorrect ? { border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)', background: 'color-mix(in srgb, var(--success) 6%, transparent)' } : { border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                                                                        <p className="text-[10px] font-bold mb-0.5" style={isCorrect ? { color: 'var(--success)' } : mutedText}>
                                                                            {String.fromCharCode(65 + oi)}{isCorrect ? ' ✓' : ''}
                                                                        </p>
                                                                        <p className="text-[15px] font-bold" style={isCorrect ? { color: 'var(--success)' } : pct > 0 ? {} : mutedText}>{pct}%</p>
                                                                        <p className="text-[10px]" style={mutedText}>{count} kishi</p>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <p className="text-[11px]" style={mutedText}>Hali javob berilmagan</p>
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
