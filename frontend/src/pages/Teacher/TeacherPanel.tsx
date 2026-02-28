import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
        e.preventDefault(); setLoading(true); setMsg('')
        try {
            await fetchApi('/tests/create', { method: 'POST', body: JSON.stringify({ title, subject, isPublic, questions }) })
            setMsg('Test yaratildi!'); setTitle(''); setQuestions([{ text: '', options: ['', '', '', ''], correctIdx: 0 }])
            setTab('list'); loadTests()
        } catch (e: any) { setMsg(e.message) }
        setLoading(false)
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b sticky top-0 z-40">
                <div className="max-w-6xl mx-auto flex items-center justify-between py-3 px-6">
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">msert</span>
                        <span className="text-xs text-gray-400 font-medium">O'qituvchi</span>
                    </div>
                    <button onClick={() => { logout(); nav('/login') }} className="text-sm text-gray-400 hover:text-gray-600">Chiqish</button>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-6 py-8">
                <h1 className="text-2xl font-extrabold text-gray-900 mb-6">Test Boshqaruvi</h1>

                <div className="flex gap-2 mb-8">
                    <button onClick={() => setTab('list')} className={`px-5 py-2.5 rounded-xl text-sm font-medium transition ${tab === 'list' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}>📋 Testlarim</button>
                    <button onClick={() => setTab('create')} className={`px-5 py-2.5 rounded-xl text-sm font-medium transition ${tab === 'create' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}>＋ Yangi Test</button>
                </div>

                {/* Test List */}
                {tab === 'list' && (
                    <div className="space-y-3 anim-up">
                        {tests.length === 0 && (
                            <div className="bg-white rounded-2xl border p-12 text-center">
                                <p className="text-gray-400 mb-2">Hozircha testlar yo'q</p>
                                <button onClick={() => setTab('create')} className="text-blue-600 font-semibold text-sm">Birinchi testni yarating →</button>
                            </div>
                        )}
                        {tests.map(t => (
                            <div key={t.id} className="bg-white rounded-2xl border shadow-sm p-5 flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-sm">{t.title}</p>
                                    <p className="text-xs text-gray-400 mt-1">{t._count?.questions || 0} savol · {t._count?.attempts || 0} urinish · {t.isPublic ? '🌐 Public' : '🔒 Private'}</p>
                                </div>
                                <div className="text-xs text-gray-400 bg-gray-100 rounded-lg px-3 py-1.5 font-mono">{t.shareLink?.substring(0, 8)}...</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Create Test */}
                {tab === 'create' && (
                    <form onSubmit={submit} className="space-y-6 anim-up">
                        {msg && <div className="bg-blue-50 text-blue-700 text-sm px-4 py-2.5 rounded-xl">{msg}</div>}
                        <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
                            <h3 className="font-bold">Umumiy ma'lumot</h3>
                            <input placeholder="Test nomi" required value={title} onChange={e => setTitle(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-sm" />
                            <input placeholder="Fan" value={subject} onChange={e => setSubject(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-sm" />
                            <label className="flex items-center gap-3 text-sm cursor-pointer">
                                <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-4 h-4 rounded" />
                                <span className="text-gray-700">Public (barcha o'quvchilarga ko'rinsin)</span>
                            </label>
                        </div>

                        {questions.map((q, qi) => (
                            <div key={qi} className="bg-white rounded-2xl border shadow-sm p-6 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-sm text-gray-900">Savol {qi + 1}</h4>
                                    {questions.length > 1 && <button type="button" onClick={() => removeQ(qi)} className="text-red-400 text-xs">O'chirish</button>}
                                </div>
                                <input placeholder="Savol matni" required value={q.text} onChange={e => updateQ(qi, 'text', e.target.value)} className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-sm" />
                                <div className="grid grid-cols-2 gap-2">
                                    {q.options.map((o, oi) => (
                                        <div key={oi} className="flex items-center gap-2">
                                            <input type="radio" name={`correct-${qi}`} checked={q.correctIdx === oi} onChange={() => updateQ(qi, 'correctIdx', oi)} className="w-4 h-4" />
                                            <input placeholder={`Variant ${String.fromCharCode(65 + oi)}`} required value={o} onChange={e => updateQ(qi, `opt${oi}`, e.target.value)} className="flex-1 h-10 px-3 rounded-lg border border-gray-200 focus:border-blue-500 outline-none text-sm" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        <button type="button" onClick={addQuestion} className="w-full h-11 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition">＋ Savol qo'shish</button>
                        <button type="submit" disabled={loading} className="w-full h-12 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/25 disabled:opacity-50">
                            {loading ? 'Saqlanmoqda...' : 'Testni Saqlash'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}
