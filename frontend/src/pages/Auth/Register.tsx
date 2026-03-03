import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { BrainCircuit, Eye, EyeOff, Check } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

const SUBJECTS = ['Matematika', 'Fizika', 'Kimyo', 'Biologiya', 'Ona tili va adabiyoti', 'Ingliz tili', 'Tarix', 'Geografiya']

export default function Register() {
    const nav = useNavigate()
    const { token, user, login } = useAuthStore()

    useEffect(() => {
        if (token && user) nav('/suhbat', { replace: true })
    }, [])

    const [step, setStep] = useState(1)
    const [form, setForm] = useState({ name: '', email: '', password: '' })
    const [examType, setExamType] = useState<'DTM' | 'MS' | ''>('')
    const [subject1, setSubject1] = useState('')
    const [subject2, setSubject2] = useState('')
    const [examDate, setExamDate] = useState('')
    const [targetScore, setTargetScore] = useState('')
    const [showPw, setShowPw] = useState(false)
    const [err, setErr] = useState('')
    const [loading, setLoading] = useState(false)
    const [checkingEmail, setCheckingEmail] = useState(false)

    const step1Valid = form.name.trim() && form.email.trim() && form.password.length >= 8 && /[a-zA-Z]/.test(form.password)

    const goToStep2 = async () => {
        setErr('')
        setCheckingEmail(true)
        try {
            const data = await fetchApi(`/auth/check-email?email=${encodeURIComponent(form.email.trim())}`)
            if (!data.available) {
                setErr('Bu email allaqachon ro\'yxatdan o\'tilgan. Kirish sahifasiga o\'ting.')
            } else {
                setStep(2)
            }
        } catch {
            setStep(2)
        }
        setCheckingEmail(false)
    }

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setErr('')
        try {
            const data = await fetchApi('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    name: form.name,
                    email: form.email,
                    password: form.password,
                    examType: examType || undefined,
                    subject: subject1 || undefined,
                    subject2: subject2 || undefined,
                    examDate: examDate || undefined,
                    targetScore: targetScore ? parseInt(targetScore) : undefined
                })
            })
            // Register javobidan to'g'ridan-to'g'ri token — alohida login shart emas
            login(data.token, data.user)
            nav('/suhbat', { replace: true })
        } catch (e: any) {
            setErr(e.message)
        }
        setLoading(false)
    }

    return (
        <div
            className="min-h-screen flex items-center justify-center p-5"
            style={{ background: 'var(--bg-page)' }}
        >
            <div className="w-full max-w-sm anim-up">

                {/* Logo */}
                <div className="flex items-center gap-2 justify-center mb-8">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--brand)' }}>
                        <BrainCircuit className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-bold text-xl tracking-tight">msert</span>
                </div>

                {/* Step indicators */}
                <div className="flex justify-center items-center gap-2 mb-6">
                    <div className={`step-dot ${step === 1 ? 'active' : ''}`} style={step > 1 ? { background: 'var(--brand)', width: '8px' } : {}} />
                    <div className={`step-dot ${step === 2 ? 'active' : ''}`} />
                </div>

                {/* Card */}
                <div className="card" style={{ padding: '2rem' }}>

                    {step === 1 && (
                        <>
                            <h1 className="text-xl font-bold mb-1">Akkaunt yarating</h1>
                            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                                Bepul ro'yxatdan o'ting
                            </p>

                            {err && (
                                <div className="text-sm px-3.5 py-2.5 rounded-lg mb-4" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
                                    {err}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium block mb-1.5">Ismingiz</label>
                                    <input
                                        type="text"
                                        required
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        placeholder="Ismingiz"
                                        className="input"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium block mb-1.5">Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={form.email}
                                        onChange={e => setForm({ ...form, email: e.target.value })}
                                        placeholder="email@misol.uz"
                                        className="input"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium block mb-1.5">Parol</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showPw ? 'text' : 'password'}
                                            required
                                            value={form.password}
                                            onChange={e => setForm({ ...form, password: e.target.value })}
                                            placeholder="Kamida 8 belgi (harf + raqam)"
                                            className="input"
                                            style={{ paddingRight: '2.75rem' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPw(!showPw)}
                                            style={{
                                                position: 'absolute', right: '0.75rem', top: '50%',
                                                transform: 'translateY(-50%)', color: 'var(--text-muted)',
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center'
                                            }}
                                        >
                                            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    disabled={!step1Valid || checkingEmail}
                                    onClick={goToStep2}
                                    className="btn btn-primary"
                                    style={{ width: '100%' }}
                                >
                                    {checkingEmail ? 'Tekshirilmoqda...' : 'Davom etish →'}
                                </button>
                            </div>
                        </>
                    )}

                    {step === 2 && (
                        <form onSubmit={submit}>
                            <h1 className="text-xl font-bold mb-1">Imtihon ma'lumotlari</h1>
                            <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
                                Ixtiyoriy — keyinroq ham o'zgartirishingiz mumkin
                            </p>

                            {/* Exam type */}
                            <div className="mb-4">
                                <label className="text-sm font-medium block mb-2">Imtihon turi <span style={{ color: 'var(--text-muted)' }}>(ixtiyoriy)</span></label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(['DTM', 'MS'] as const).map(t => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setExamType(examType === t ? '' : t)}
                                            className="btn btn-outline"
                                            style={{
                                                height: '2.75rem',
                                                background: examType === t ? 'var(--brand-light)' : '',
                                                borderColor: examType === t ? 'var(--brand)' : '',
                                                color: examType === t ? 'var(--brand-hover)' : '',
                                                position: 'relative'
                                            }}
                                        >
                                            {examType === t && (
                                                <Check className="h-3.5 w-3.5 absolute top-1.5 right-1.5" />
                                            )}
                                            {t === 'DTM' ? 'DTM' : 'Milliy Sertifikat'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Subject — DTM: 2 ta, MS: 1 ta, bo'lmasa: 1 ta */}
                            <div className="space-y-3 mb-4">
                                <div>
                                    <label className="text-sm font-medium block mb-1.5">
                                        {examType === 'DTM' ? '1-ixtisoslik fani' : 'Fan'} <span style={{ color: 'var(--text-muted)' }}>(ixtiyoriy)</span>
                                    </label>
                                    <select
                                        value={subject1}
                                        onChange={e => setSubject1(e.target.value)}
                                        className="input"
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <option value="">— Tanlang —</option>
                                        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                {examType === 'DTM' && (
                                    <div>
                                        <label className="text-sm font-medium block mb-1.5">2-ixtisoslik fani <span style={{ color: 'var(--text-muted)' }}>(ixtiyoriy)</span></label>
                                        <select
                                            value={subject2}
                                            onChange={e => setSubject2(e.target.value)}
                                            className="input"
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <option value="">— Tanlang —</option>
                                            {SUBJECTS.filter(s => s !== subject1).map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Exam date + target */}
                            <div className="grid grid-cols-2 gap-3 mb-5">
                                <div>
                                    <label className="text-sm font-medium block mb-1.5">Imtihon sanasi</label>
                                    <input
                                        type="date"
                                        value={examDate}
                                        onChange={e => setExamDate(e.target.value)}
                                        className="input"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium block mb-1.5">Maqsad ball</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="189"
                                        placeholder="150"
                                        value={targetScore}
                                        onChange={e => setTargetScore(e.target.value)}
                                        className="input"
                                    />
                                </div>
                            </div>

                            {err && (
                                <div className="text-sm px-3.5 py-2.5 rounded-lg mb-4" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
                                    {err}
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="btn btn-outline"
                                    style={{ flex: '0 0 auto' }}
                                >
                                    ←
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn btn-primary"
                                    style={{ flex: 1 }}
                                >
                                    {loading ? 'Yaratilmoqda...' : 'Ro\'yxatdan o\'tish ✓'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                <p className="text-center text-sm mt-5" style={{ color: 'var(--text-secondary)' }}>
                    Akkauntingiz bormi?{' '}
                    <Link to="/kirish" className="font-semibold" style={{ color: 'var(--brand)' }}>
                        Kirish
                    </Link>
                </p>
            </div>
        </div>
    )
}
