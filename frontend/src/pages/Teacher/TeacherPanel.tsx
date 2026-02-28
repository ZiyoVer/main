import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrainCircuit, Plus, Trash2, LogOut, Copy, Check, Globe, Lock, ClipboardList } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

interface Question { text: string; options: string[]; correctIdx: number }

export default function TeacherPanel() {
    const nav = useNavigate()
    const { logout } = useAuthStore()
    const [tab, setTab] = useState<'create' | 'list'>('list')
    const [tests, setTests] = useState<any[]>([])
    const [title, setTitle] = useState('')
    const [subject, setSubject] = useState('Matematika')
    const [isPublic, setIsPublic] = useState(false)
    const [questions, setQuestions] = useState<Question[]>([{ text: '', options: ['', '', '', ''], correctIdx: 0 }])
    const [loading, setLoading] = useState(false)
    const [msg, setMsg] = useState('')
    const [copied, setCopied] = useState<string | null>(null)

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

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        if (loading) return
        // Validatsiya
        for (let i = 0; i < questions.length; i++) {
            if (!questions[i].text.trim()) { setMsg(`Savol ${i + 1} matni bo'sh`); return }
            for (let j = 0; j < 4; j++) {
                if (!questions[i].options[j].trim()) { setMsg(`Savol ${i + 1}, variant ${String.fromCharCode(65 + j)} bo'sh`); return }
            }
        }
        setLoading(true); setMsg('')
        try {
            await fetchApi('/tests/create', { method: 'POST', body: JSON.stringify({ title, subject, isPublic, questions }) })
            setMsg(''); setTitle('')
            setQuestions([{ text: '', options: ['', '', '', ''], correctIdx: 0 }])
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

    return (
        <div className="min-h-screen bg-[#fafafa]">
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
                                            : <span className="flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded-md"><Lock className="h-3 w-3" /> Private</span>
                                        }
                                    </div>
                                    <p className="text-xs text-gray-400">{t._count?.questions || 0} savol · {t._count?.attempts || 0} urinish · {t.subject}</p>
                                </div>
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
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-900">Umumiy ma'lumot</h3>
                            <input placeholder="Test nomi" required value={title} onChange={e => setTitle(e.target.value)}
                                className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none text-sm transition" />
                            <select value={subject} onChange={e => setSubject(e.target.value)}
                                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-white focus:border-blue-500 outline-none text-sm">
                                {['Matematika', 'Fizika', 'Kimyo', 'Biologiya', 'Ona tili', 'Ingliz tili', 'Tarix', 'Geografiya'].map(f =>
                                    <option key={f} value={f}>{f}</option>
                                )}
                            </select>
                            <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
                                <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
                                <span className="text-gray-600">Public — barcha o'quvchilarga ko'rinsin</span>
                            </label>
                        </div>

                        {questions.map((q, qi) => (
                            <div key={qi} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-gray-900">Savol {qi + 1}</h4>
                                    {questions.length > 1 && (
                                        <button type="button" onClick={() => removeQ(qi)} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                                <input placeholder="Savol matni" required value={q.text} onChange={e => updateQ(qi, 'text', e.target.value)}
                                    className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none text-sm transition" />
                                <div className="grid grid-cols-2 gap-2">
                                    {q.options.map((o, oi) => (
                                        <label key={oi} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition ${q.correctIdx === oi ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                                            <input type="radio" name={`correct-${qi}`} checked={q.correctIdx === oi} onChange={() => updateQ(qi, 'correctIdx', oi)} className="w-3.5 h-3.5 accent-emerald-600" />
                                            <input placeholder={`Variant ${String.fromCharCode(65 + oi)}`} required value={o} onChange={e => updateQ(qi, `opt${oi}`, e.target.value)}
                                                className="flex-1 bg-transparent outline-none text-sm" />
                                        </label>
                                    ))}
                                </div>
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
    )
}
