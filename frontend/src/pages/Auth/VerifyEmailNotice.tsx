import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, CheckCircle } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

const RESEND_COOLDOWN_SEC = 60
const COOLDOWN_KEY = 'dtmmax_resend_until'
const POLL_INTERVAL_MS = 5000

type ResendError = { type: 'network' | 'ratelimit'; message: string }

function formatCooldown(sec: number): string {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
}

function readRemainingCooldown(): number {
    try {
        const until = Number(sessionStorage.getItem(COOLDOWN_KEY) || '0')
        if (!until) return 0
        const remaining = Math.ceil((until - Date.now()) / 1000)
        return remaining > 0 ? remaining : 0
    } catch {
        return 0
    }
}

export default function VerifyEmailNotice() {
    const nav = useNavigate()
    const { user, token, login, logout } = useAuthStore()

    const [resending, setResending] = useState(false)
    const [cooldown, setCooldown] = useState<number>(() => readRemainingCooldown())
    const [resendOk, setResendOk] = useState(false)
    const [error, setError] = useState<ResendError | null>(null)
    const [verified, setVerified] = useState(false)
    // Qo'lda "Tasdiqladim — tekshirish" tugmasi holati (mobil cross-browser uchun)
    const [checkingNow, setCheckingNow] = useState(false)
    const [notYet, setNotYet] = useState(false)

    const headingRef = useRef<HTMLHeadingElement | null>(null)
    const successOkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Allaqachon tasdiqlangan bo'lsa — bu ekranni ko'rsatmaymiz
    useEffect(() => {
        if (user?.emailVerified === true) {
            nav('/bugun', { replace: true })
        }
    }, [user?.emailVerified, nav])

    // Mount'da fokusni sarlavhaga ko'chiramiz (SR foydalanuvchisi kartaning o'rtasiga emas, sarlavhaga tushadi)
    useEffect(() => {
        headingRef.current?.focus()
    }, [])

    // Cooldown taymeri — funksional update, stale closure oldini oladi
    useEffect(() => {
        if (cooldown <= 0) return
        const id = setInterval(() => {
            setCooldown(prev => {
                if (prev <= 1) {
                    clearInterval(id)
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(id)
    }, [cooldown > 0])

    // Resend muvaffaqiyat xabarini 4s dan keyin o'chiramiz
    useEffect(() => {
        if (!resendOk) return
        const id = setTimeout(() => setResendOk(false), 4000)
        return () => clearTimeout(id)
    }, [resendOk])

    const startCooldown = useCallback((seconds: number) => {
        try {
            sessionStorage.setItem(COOLDOWN_KEY, String(Date.now() + seconds * 1000))
        } catch { /* sessionStorage mavjud bo'lmasligi mumkin */ }
        setCooldown(seconds)
    }, [])

    // Verifikatsiya aniqlangani — success holatga o'tib, /suhbat'ga yo'naltiramiz
    const handleVerified = useCallback(() => {
        setVerified(true)
        if (token && user) {
            login(token, { ...user, emailVerified: true })
        }
        successOkTimer.current = setTimeout(() => {
            nav('/bugun', { replace: true })
        }, 1200)
    }, [token, user, login, nav])

    // Serverdan emailVerified holatini bir marta tekshiradi.
    // Tasdiqlangan bo'lsa true qaytaradi — chaqiruvchi keyingi qadamni hal qiladi.
    const checkVerifiedOnce = useCallback(async (): Promise<boolean> => {
        try {
            const me = await fetchApi('/auth/me', { silent: true })
            if (me?.emailVerified === true) {
                handleVerified()
                return true
            }
        } catch {
            // Polling/qo'lda tekshiruvda tarmoq xatosi — chaqiruvchi hal qiladi
        }
        return false
    }, [handleVerified])

    // Polling: faqat tab ko'rinib turganda tekshiramiz; background tab API'ni bekorga urmaydi.
    // Fokus/visibility qaytganda darhol bir marta tekshiriladi.
    useEffect(() => {
        if (verified) return
        let active = true

        const tick = () => { if (active && !document.hidden) void checkVerifiedOnce() }

        // Mount'da darhol bir marta — yangidan yuklangan tab stale localStorage'ga ishonmasin
        tick()

        const interval = setInterval(tick, POLL_INTERVAL_MS)
        const onVisibility = () => { if (!document.hidden) tick() }
        window.addEventListener('focus', onVisibility)
        document.addEventListener('visibilitychange', onVisibility)

        return () => {
            active = false
            clearInterval(interval)
            window.removeEventListener('focus', onVisibility)
            document.removeEventListener('visibilitychange', onVisibility)
        }
    }, [verified, checkVerifiedOnce])

    // Qo'lda "Tasdiqladim — tekshirish": mobil cross-browser holatda yagona ishonchli yo'l.
    // Foydalanuvchi pochta-brauzerda tasdiqlab, asl tabга qaytib bosadi → devordan chiqadi.
    const checkNow = async () => {
        if (checkingNow) return
        setCheckingNow(true)
        setNotYet(false)
        const ok = await checkVerifiedOnce()
        if (!ok) setNotYet(true)
        setCheckingNow(false)
    }

    useEffect(() => () => {
        if (successOkTimer.current) clearTimeout(successOkTimer.current)
    }, [])

    const resend = async () => {
        if (cooldown > 0 || resending) return
        setResending(true)
        setError(null)
        try {
            await fetchApi('/auth/resend-verification', { method: 'POST', silent: true })
            setResendOk(true)
            startCooldown(RESEND_COOLDOWN_SEC)
        } catch (e) {
            const err = e as { status?: number }
            if (err.status === 429) {
                setError({ type: 'ratelimit', message: 'Biroz kuting — tez-tez so\'rov yuborildi.' })
                startCooldown(RESEND_COOLDOWN_SEC)
            } else {
                setError({ type: 'network', message: 'Havola yuborilmadi. Internetni tekshirib qayta urinib ko\'ring.' })
                // Tarmoq xatosida cooldown sarflanmaydi — tugma yoqiq qoladi
            }
        } finally {
            setResending(false)
        }
    }

    const handleLogout = () => {
        logout()
        nav('/kirish', { replace: true })
    }

    const primaryLabel = resending
        ? 'Yuborilmoqda…'
        : cooldown > 0
            ? `Qayta yuborish (${formatCooldown(cooldown)})`
            : 'Qayta yuborish'

    return (
        <div className="kelviq min-h-screen flex items-center justify-center p-5" style={{ background: 'var(--bg-page)', position: 'relative', overflow: 'hidden' }}>
            {/* Faint technical texture behind the card */}
            <div
                className="k-tex-dots"
                aria-hidden="true"
                style={{ position: 'absolute', inset: 0, zIndex: 0 }}
            />

            <main className="w-full max-w-sm" style={{ position: 'relative', zIndex: 1 }}>

                {/* Logo */}
                <div className="flex items-center gap-2 justify-center mb-8">
                    <img src="/dtmmax-logo.png" alt="DtmMax" className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ objectFit: 'contain' }} />
                    <span className="font-bold text-xl tracking-tight">DTMMax</span>
                </div>

                <div className="card text-center" style={{ padding: '2.5rem 2rem' }}>
                    {verified ? (
                        <>
                            <CheckCircle
                                aria-hidden="true"
                                className="mx-auto mb-5"
                                style={{
                                    width: '48px', height: '48px', color: 'var(--success)',
                                    animation: 'verify-pop 250ms cubic-bezier(.34,1.56,.64,1)'
                                }}
                            />
                            <h1
                                ref={headingRef}
                                tabIndex={-1}
                                className="text-xl font-bold tracking-tight mb-2"
                                style={{ color: 'var(--text-primary)', outline: 'none' }}
                            >
                                Tasdiqlandi!
                            </h1>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                Hammasi tayyor. Sizni platformaga yo'naltiramiz…
                            </p>
                            <style>{`@keyframes verify-pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
                        </>
                    ) : (
                        <>
                            {/* Mail icon tile */}
                            <div
                                className="mx-auto mb-5 flex items-center justify-center"
                                style={{
                                    width: '56px', height: '56px', borderRadius: 'var(--radius-2xl)',
                                    background: 'var(--brand-light)'
                                }}
                            >
                                <Mail aria-hidden="true" style={{ width: '28px', height: '28px', color: 'var(--brand-hover)' }} />
                            </div>

                            <span className="k-eyebrow">Tasdiqlash</span>
                            <h1
                                ref={headingRef}
                                tabIndex={-1}
                                className="text-xl font-bold tracking-tight mb-2 mt-2"
                                style={{ color: 'var(--text-primary)', outline: 'none' }}
                            >
                                Emailingizni tasdiqlang
                            </h1>

                            {/* Email pill */}
                            {user?.email && (
                                <div
                                    className="inline-flex items-center gap-2 mb-4"
                                    style={{
                                        padding: '0.5rem 0.875rem', background: 'var(--bg-surface)',
                                        borderRadius: 'var(--radius-lg)', maxWidth: '100%'
                                    }}
                                >
                                    <span className="font-bold text-sm" style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                                        {user.email}
                                    </span>
                                </div>
                            )}

                            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                Shu manzilga tasdiqlash havolasini yubordik. Havolani bosing — sahifa o'zi ochiladi.
                            </p>

                            {error && (
                                <div
                                    className="text-sm px-3.5 py-2.5 rounded-lg mb-4"
                                    style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}
                                    role="alert"
                                >
                                    {error.message}
                                </div>
                            )}

                            {/* Asosiy amal: havolani bosgandan keyin (ayniqsa boshqa brauzerda)
                                bu tugma devorni darhol va ishonchli tozalaydi */}
                            <button
                                type="button"
                                onClick={checkNow}
                                disabled={checkingNow}
                                aria-busy={checkingNow}
                                className="btn btn-brand"
                                style={{ width: '100%' }}
                            >
                                {checkingNow ? 'Tekshirilmoqda…' : 'Tasdiqladim — tekshirish'}
                            </button>

                            {/* "Hali tasdiqlanmagan" microcopy (qo'lda tekshiruv natijasi) */}
                            <div aria-live="polite" style={{ minHeight: '1.25rem' }}>
                                {notYet && (
                                    <p className="text-xs mt-3" style={{ color: 'var(--text-secondary)' }}>
                                        Hali tasdiqlanmadi. Pochtangizdagi havolani bosib, qaytib tekshiring.
                                    </p>
                                )}
                            </div>

                            {/* Ikkilamchi amal: havolani qayta yuborish */}
                            <button
                                type="button"
                                onClick={resend}
                                disabled={resending || cooldown > 0}
                                aria-busy={resending}
                                className="btn btn-ghost mt-2"
                                style={{ width: '100%' }}
                            >
                                {primaryLabel}
                            </button>

                            {/* Resend muvaffaqiyat microcopy */}
                            <div aria-live="polite" style={{ minHeight: '1.25rem' }}>
                                {resendOk && (
                                    <p className="text-xs mt-3" style={{ color: 'var(--success)' }}>
                                        Yangi havola yuborildi ✓
                                    </p>
                                )}
                            </div>

                            <p className="text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>
                                Xat kelmadimi? Spam papkasini ham tekshiring.
                            </p>

                            <button
                                type="button"
                                onClick={() => nav('/bugun', { replace: true })}
                                className="btn btn-ghost mt-2"
                                style={{ width: '100%' }}
                            >
                                Hozircha platformaga o‘tish
                            </button>

                            {/* Poll indikatori — fonда avtomatik ham tekshirib turamiz */}
                            <div className="flex items-center justify-center gap-2 mt-5 pt-4" style={{ borderTop: '1px solid var(--border)' }} role="status" aria-live="polite">
                                <span className="typing-dots" aria-hidden="true"><span /><span /><span /></span>
                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                    tasdiqlanishini kutyapmiz…
                                </span>
                            </div>
                        </>
                    )}
                </div>

                {!verified && (
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="btn btn-ghost mt-4"
                        style={{ width: '100%' }}
                    >
                        Chiqish
                    </button>
                )}
            </main>
        </div>
    )
}
