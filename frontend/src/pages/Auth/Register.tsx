import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { BrainCircuit, Eye, EyeOff } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import GoogleSignInButton from '@/components/GoogleSignInButton'
import BackToLanding from '@/components/BackToLanding'

function getSafeRegisterRedirect(from: unknown): string | null {
    if (typeof from !== 'string') return null
    if (from === '/suhbat' || from === '/chat') return '/suhbat'
    if (from.startsWith('/test/')) return from
    return null
}

export default function Register() {
    const nav = useNavigate()
    const location = useLocation()
    const from = (location.state as { from?: unknown } | null)?.from
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

    // Register endi faqat akkaunt: ism/email/parol. Imtihon ma'lumotlari (turi, yo'nalish,
    // fan, sana, maqsad ball) login'dan KEYIN ilova ichidagi onboarding orqali yig'iladi.
    const [form, setForm] = useState({ name: '', email: '', password: '' })
    const [showPw, setShowPw] = useState(false)
    const [err, setErr] = useState('')
    const [loading, setLoading] = useState(false)

    const formValid = form.name.trim() && form.email.trim() && form.password.length >= 8 && /[a-zA-Z]/.test(form.password) && /[0-9]/.test(form.password)

    const hasGuestTestResult = () => !!localStorage.getItem('dtmmax_guest_test_result')

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (loading) return
        setLoading(true)
        setErr('')
        try {
            // Yuborishdan oldin email band emasligini tekshiramiz (aniqroq xato uchun)
            const check = await fetchApi(`/auth/check-email?email=${encodeURIComponent(form.email.trim())}`)
            if (!check.available) {
                setErr('Bu email allaqachon ro\'yxatdan o\'tilgan. Kirish sahifasiga o\'ting.')
                setLoading(false)
                return
            }

            // Faqat akkaunt maydonlari — imtihon ma'lumotlari onboarding'da
            const data = await fetchApi('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    name: form.name,
                    email: form.email,
                    password: form.password
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
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'Ro\'yxatdan o\'tishda xato. Qayta urinib ko\'ring.')
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

            <BackToLanding />

            <div className="w-full max-w-sm" style={{ position: 'relative', zIndex: 1 }}>

                {/* Logo */}
                <div className="flex items-center gap-2 justify-center mb-8">
                    <img src="/dtmmax-logo.png" alt="DtmMax" className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ objectFit: 'contain' }} />
                    <span className="font-bold text-xl tracking-tight">DTM<span className="k-italic">Max</span></span>
                </div>

                {/* Card — bitta qadam: akkaunt yaratish */}
                <div className="card" style={{ padding: '2rem' }}>
                    <form onSubmit={submit}>
                        <span className="k-eyebrow">RO'YXATDAN O'TISH</span>
                        <h1 className="text-xl font-bold mb-1 mt-2">Akkaunt <span className="k-italic">yarating</span></h1>
                        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                            Bepul ro'yxatdan o'ting — imtihon ma'lumotlarini keyin so'raymiz
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
                                            position: 'absolute', right: '0.25rem', top: '50%',
                                            transform: 'translateY(-50%)', color: 'var(--text-muted)',
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            width: '40px', height: '40px'
                                        }}
                                    >
                                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={!formValid || loading}
                                className="btn btn-primary"
                                style={{ width: '100%' }}
                            >
                                {loading ? 'Yaratilmoqda...' : 'Ro\'yxatdan o\'tish'}
                            </button>
                        </div>
                    </form>

                    <GoogleSignInButton />
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
