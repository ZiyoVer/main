import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { BrainCircuit, Eye, EyeOff, Check } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { SUBJECTS } from '@/constants'
import { DTM_DIRECTIONS, SCORE_BOUNDS, dtmDirectionByCode } from '@/constants/dtmDirections'
import { useAuthStore } from '@/store/authStore'

function getSafeRegisterRedirect(from: unknown): string | null {
    if (typeof from !== 'string') return null
    if (from === '/suhbat' || from === '/chat') return '/suhbat'
    if (from.startsWith('/test/')) return from
    return null
}

export default function Register() {
    const nav = useNavigate()
    const location = useLocation()
    const from = (location.state as any)?.from
    const { token, user, login } = useAuthStore()

    useEffect(() => {
        if (token && user) {
            if (user.role === 'STUDENT' && user.emailVerified === false) {
                nav('/email-tasdiqlang', { replace: true })
                return
            }
            const safeRedirect = getSafeRegisterRedirect(from)
            if (safeRedirect) nav(safeRedirect, { replace: true })
            else nav('/suhbat', { replace: true })
        }
    }, [from, nav, token, user])

    const [step, setStep] = useState(1)
    const [form, setForm] = useState({ name: '', email: '', password: '' })
    const [examType, setExamType] = useState<'DTM' | 'MS' | ''>('')
    const [subject1, setSubject1] = useState('')
    const [subject2, setSubject2] = useState('')
    const [directionCode, setDirectionCode] = useState('')
    const [examDate, setExamDate] = useState('')
    const [targetScore, setTargetScore] = useState('')
    const [showPw, setShowPw] = useState(false)
    const [err, setErr] = useState('')
    const [loading, setLoading] = useState(false)
    const [checkingEmail, setCheckingEmail] = useState(false)

    const step1Valid = form.name.trim() && form.email.trim() && form.password.length >= 8 && /[a-zA-Z]/.test(form.password) && /[0-9]/.test(form.password)

    // Onboarding endi har bir savol — alohida ekran:
    // 1 = akkaunt, 2 = imtihon turi, 3 = fan(lar), 4 = sana (ixtiyoriy), 5 = maqsad ball
    const TOTAL_STEPS = 5
    const isLastStep = step === TOTAL_STEPS
    // Har bir qadam "Davom etish"ni qachon ochishini belgilaydi
    const stepValid =
        step === 2 ? examType !== '' :
        step === 3 ? (examType === 'DTM' ? !!directionCode : !!subject1) :
        true // sana ixtiyoriy; ball oralig'i scoreErr orqali alohida bloklanadi

    // examType o'zgarganda yo'nalish/2-fanni tozalaymiz (eski derived qiymat ketmasligi uchun)
    const handleExamTypeChange = (t: 'DTM' | 'MS') => {
        const next = examType === t ? '' : t
        setExamType(next)
        setDirectionCode('')
        setSubject2('')
        if (next === 'DTM') setSubject1('')
    }

    // DTM yo'nalishi tanlanganda subject1/subject2 derived qiymatlarni to'ldiramiz
    const handleDirectionChange = (code: string) => {
        setDirectionCode(code)
        const dir = dtmDirectionByCode(code)
        setSubject1(dir?.subject1 || '')
        setSubject2(dir?.subject2 || '')
    }

    const selectedDirection = directionCode ? dtmDirectionByCode(directionCode) : undefined

    // examType bo'yicha ball chegaralari (DTM 1..189, MS 0..75; noma'lum bo'lsa DTM — eng qattiq)
    const scoreBounds = examType === 'MS' ? SCORE_BOUNDS.MS : SCORE_BOUNDS.DTM
    const parsedScore = targetScore.trim() === '' ? null : Number(targetScore)
    const scoreErr = parsedScore !== null && (!Number.isInteger(parsedScore) || parsedScore < scoreBounds.min || parsedScore > scoreBounds.max)
        ? `Ball ${scoreBounds.min}–${scoreBounds.max} oralig'idagi butun son bo'lishi kerak`
        : ''

    const goToStep2 = async () => {
        setErr('')
        setCheckingEmail(true)
        try {
            const data = await fetchApi(`/auth/check-email?email=${encodeURIComponent(form.email.trim())}`)
            if (!data.available) {
                setErr('Bu email allaqachon ro\'yxatdan o\'tilgan. Kirish sahifasiga o\'ting.')
                return
            }
            setStep(2)
        } catch {
            setErr('Email tekshirib bo\'lmadi. Internet yoki server holatini tekshirib qayta urinib ko\'ring.')
            return
        } finally {
            setCheckingEmail(false)
        }
    }

    const hasGuestTestResult = () => !!localStorage.getItem('dtmmax_guest_test_result')

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
            // Email tasdiqlanmagan bo'lsa — boshqa hamma narsadan oldin bloklash ekraniga (faqat STUDENT)
            if (data.user?.role === 'STUDENT' && data.user?.emailVerified === false) {
                nav('/email-tasdiqlang', { replace: true })
                return
            }
            // Test linki orqali kelgan bo'lsa — o'sha testga qaytamiz
            const safeRedirect = getSafeRegisterRedirect(from)
            if (safeRedirect) {
                nav(safeRedirect, { replace: true })
            } else if (hasGuestTestResult()) {
                nav('/suhbat?analyzeTest=1', { replace: true })
            } else {
                nav('/suhbat', { replace: true })
            }
        } catch (e: any) {
            setErr(e.message)
        }
        setLoading(false)
    }

    return (
        <div
            className="kelviq min-h-screen flex items-center justify-center p-5"
            style={{ background: 'var(--bg-page)', position: 'relative', overflow: 'hidden' }}
        >
            {/* Faint technical texture behind the card */}
            <div
                className="k-tex-dots"
                aria-hidden="true"
                style={{ position: 'absolute', inset: 0, zIndex: 0 }}
            />

            <div className="w-full max-w-sm anim-up" style={{ position: 'relative', zIndex: 1 }}>

                {/* Logo */}
                <div className="flex items-center gap-2 justify-center mb-8">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--k-accent-grad)' }}>
                        <BrainCircuit className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-bold text-xl tracking-tight">DTM<span className="k-italic">Max</span></span>
                </div>

                {/* Step indicators — har bir savol alohida qadam */}
                <div className="flex justify-center items-center gap-2 mb-6">
                    {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(n => (
                        <div
                            key={n}
                            className={`step-dot ${step === n ? 'active' : ''}`}
                            style={step > n ? { background: 'var(--brand)', width: '8px' } : {}}
                        />
                    ))}
                </div>

                {/* Card */}
                <div className="card" style={{ padding: '2rem' }}>

                    {step === 1 && (
                        <>
                            <span className="k-eyebrow">RO'YXATDAN O'TISH</span>
                            <h1 className="text-xl font-bold mb-1 mt-2">Akkaunt <span className="k-italic">yarating</span></h1>
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
                                        onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
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
                                        onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
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
                                            onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                                            placeholder="Kamida 8 belgi (harf + raqam)"
                                            className="input"
                                            style={{ paddingRight: '2.75rem' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPw(prev => !prev)}
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

                    {step >= 2 && (
                        <form onSubmit={submit}>
                            <span className="k-eyebrow">MA'LUMOTLAR</span>

                            {/* Step A — Imtihon turi (tanlash majburiy) */}
                            {step === 2 && (
                                <>
                                    <h1 className="text-xl font-bold mb-1 mt-2">Imtihon <span className="k-italic">turi</span></h1>
                                    <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
                                        Qaysi imtihonga tayyorlanyapsiz?
                                    </p>
                                    <div className="grid grid-cols-2 gap-3 mb-1">
                                        {(['DTM', 'MS'] as const).map(t => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => handleExamTypeChange(t)}
                                                className="btn btn-outline"
                                                style={{
                                                    height: '6rem',
                                                    flexDirection: 'column',
                                                    gap: '0.35rem',
                                                    background: examType === t ? 'var(--brand-light)' : '',
                                                    borderColor: examType === t ? 'var(--brand)' : '',
                                                    color: examType === t ? 'var(--brand-hover)' : '',
                                                    position: 'relative'
                                                }}
                                            >
                                                {examType === t && (
                                                    <Check className="h-4 w-4 absolute top-2 right-2" />
                                                )}
                                                <span className="font-bold text-base">{t === 'DTM' ? 'DTM' : 'MS'}</span>
                                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                    {t === 'DTM' ? 'Davlat test markazi' : 'Milliy Sertifikat'}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Step B — Fan(lar): DTM yo'nalish | MS bitta fan (tanlash majburiy) */}
                            {step === 3 && (
                                <>
                                    <h1 className="text-xl font-bold mb-1 mt-2">
                                        {examType === 'DTM' ? <>Yo'<span className="k-italic">nalish</span></> : <>Qaysi <span className="k-italic">fan</span></>}
                                    </h1>
                                    <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
                                        {examType === 'DTM' ? 'Fanlar majmuasini tanlang' : 'Qaysi fandan tayyorlanasiz?'}
                                    </p>
                                    {examType === 'DTM' ? (
                                        <div>
                                            <select
                                                value={directionCode}
                                                onChange={e => handleDirectionChange(e.target.value)}
                                                className="input"
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <option value="">— Yo'nalishni tanlang —</option>
                                                {DTM_DIRECTIONS.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
                                            </select>
                                            {selectedDirection?.faculties?.length ? (
                                                <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                                                    {selectedDirection.faculties.join(', ')}
                                                </p>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <select
                                            value={subject1}
                                            onChange={e => setSubject1(e.target.value)}
                                            className="input"
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <option value="">— Tanlang —</option>
                                            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    )}
                                </>
                            )}

                            {/* Step C — Imtihon sanasi (ixtiyoriy, o'tkazib yuborsa bo'ladi) */}
                            {step === 4 && (
                                <>
                                    <h1 className="text-xl font-bold mb-1 mt-2">Imtihon <span className="k-italic">sanasi</span></h1>
                                    <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
                                        Ixtiyoriy — bilsangiz kiriting, bilmasangiz o'tkazib yuboring
                                    </p>
                                    <input
                                        type="date"
                                        value={examDate}
                                        onChange={e => setExamDate(e.target.value)}
                                        className="input"
                                    />
                                </>
                            )}

                            {/* Step D — Maqsad ball (examType chegaralari + inline validatsiya) */}
                            {step === 5 && (
                                <>
                                    <h1 className="text-xl font-bold mb-1 mt-2">Maqsad <span className="k-italic">ball</span></h1>
                                    <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
                                        Ixtiyoriy — {scoreBounds.min}–{scoreBounds.max} oralig'ida
                                    </p>
                                    <input
                                        type="number"
                                        min={scoreBounds.min}
                                        max={scoreBounds.max}
                                        step="1"
                                        placeholder={examType === 'MS' ? '60' : '150'}
                                        value={targetScore}
                                        onChange={e => setTargetScore(e.target.value)}
                                        onBlur={() => {
                                            if (targetScore.trim() === '') return
                                            const n = Number(targetScore)
                                            if (!Number.isFinite(n)) return
                                            const clamped = Math.min(scoreBounds.max, Math.max(scoreBounds.min, Math.round(n)))
                                            setTargetScore(String(clamped))
                                        }}
                                        className="input"
                                        style={scoreErr ? { borderColor: 'var(--danger)' } : {}}
                                    />
                                    {scoreErr && (
                                        <p className="text-xs mt-1.5" style={{ color: 'var(--danger)' }}>{scoreErr}</p>
                                    )}
                                </>
                            )}

                            {err && (
                                <div className="text-sm px-3.5 py-2.5 rounded-lg mt-4" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
                                    {err}
                                </div>
                            )}

                            <div className="flex gap-2 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setStep(step - 1)}
                                    className="btn btn-outline"
                                    style={{ flex: '0 0 auto' }}
                                >
                                    Orqaga
                                </button>
                                {/* Sana qadami — o'tkazib yuborish */}
                                {step === 4 && (
                                    <button
                                        type="button"
                                        onClick={() => { setExamDate(''); setStep(5) }}
                                        className="btn btn-outline"
                                        style={{ flex: '0 0 auto' }}
                                    >
                                        O'tkazib yuborish
                                    </button>
                                )}
                                {isLastStep ? (
                                    <button
                                        type="submit"
                                        disabled={loading || !!scoreErr}
                                        className="btn btn-primary"
                                        style={{ flex: 1 }}
                                    >
                                        {loading ? 'Yaratilmoqda...' : 'Boshlash ✓'}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={!stepValid}
                                        onClick={() => setStep(step + 1)}
                                        className="btn btn-primary"
                                        style={{ flex: 1 }}
                                    >
                                        Davom etish →
                                    </button>
                                )}
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
                <p className="text-center mt-3" style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Ro'yxatdan o'tish orqali siz{' '}
                    <Link to="/shartlar" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>
                        Foydalanish shartlari
                    </Link>
                    {' '}va{' '}
                    <Link to="/maxfiylik" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>
                        Maxfiylik siyosati
                    </Link>
                    {' '}ga rozilik bildirasiz.
                </p>
            </div>
        </div>
    )
}
