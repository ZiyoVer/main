import { FormEvent, useCallback, useEffect, useState } from 'react'
import {
    AlertTriangle,
    CheckCircle2,
    CreditCard,
    KeyRound,
    Loader2,
    RefreshCw,
    ShieldCheck,
} from 'lucide-react'
import { fetchApi } from '@/lib/api'

interface BillingConfig {
    enforced: boolean
    priceUzs: number
    provider: string
    checkoutConfigured: boolean
    sandboxTestMode: boolean
    paylovFlow: 'oauth2' | 'hosted' | null
    paylovEnvironment: 'sandbox' | 'production' | null
    callbackConfigured: boolean
    officialGateway: boolean
}

interface StartResponse {
    orderId: string
    otpSentPhone: string | null
    status: 'OTP_SENT'
}

function digits(value: string, limit: number) {
    return value.replace(/\D/g, '').slice(0, limit)
}

function formatCardNumber(value: string) {
    return digits(value, 16).replace(/(\d{4})(?=\d)/g, '$1 ')
}

function formatExpiry(value: string) {
    const clean = digits(value, 4)
    return clean.length > 2 ? `${clean.slice(0, 2)}/${clean.slice(2)}` : clean
}

function cardNetwork(value: string): 'HUMO' | 'UZCARD' | null {
    const clean = digits(value, 16)
    if (clean.startsWith('9860')) return 'HUMO'
    if (['8600', '5614', '6262', '5440'].some(prefix => clean.startsWith(prefix))) return 'UZCARD'
    return null
}

// Karta yuzida muddat odatda MM/YY ko‘rinadi, Paylov esa YYMM kutadi.
function paylovExpireDate(value: string): string | null {
    const clean = digits(value, 4)
    if (clean.length !== 4) return null
    const month = Number(clean.slice(0, 2))
    if (!Number.isInteger(month) || month < 1 || month > 12) return null
    return `${clean.slice(2)}${clean.slice(0, 2)}`
}

function errorMessage(error: unknown): string {
    const apiError = error as { message?: string; data?: { error?: string; providerCode?: string; networkCode?: string } }
    const code = apiError?.data?.error || apiError?.message || ''
    const providerCode = apiError?.data?.providerCode
    const networkCode = apiError?.data?.networkCode
    const messages: Record<string, string> = {
        billing_not_configured: 'Railway’da merchant_id yoki Token topilmadi/yaroqsiz. UUID va OAuth2 test tokenini tekshiring.',
        billing_price_invalid: 'PRO_PRICE_UZS musbat butun son bo‘lishi kerak.',
        paylov_not_active_provider: 'BILLING_PROVIDER hozir Paylov emas.',
        paylov_oauth2_not_enabled: 'PAYLOV_FLOW=oauth2 o‘rnatilmagan.',
        paylov_sandbox_disabled: 'Sandbox sinovi o‘chiq. BILLING_SANDBOX_TEST=true bo‘lishi kerak.',
        paylov_sandbox_admin_only: 'Sandbox to‘lovi faqat administrator uchun ochiq.',
        paylov_environment_conflict: 'Sandbox va production sozlamalari bir vaqtda yoqilgan. Muhitlarni ajrating.',
        paylov_card_invalid: 'Karta raqami 16 ta raqamdan iborat bo‘lishi kerak.',
        paylov_expiry_invalid: 'Amal muddatini kartada yozilgan MM/YY formatida kiriting.',
        paylov_otp_invalid: 'Tasdiqlash kodi 6 ta raqamdan iborat bo‘lishi kerak.',
        paylov_token_prefix_invalid: 'Railway’dagi Token qiymatidan “Bearer” yoki “Token:” prefiksini olib tashlang. Faqat tokenning o‘zi qolishi kerak.',
        paylov_token_quotes_invalid: 'Railway’dagi Token qiymati qo‘shtirnoqsiz yozilishi kerak.',
        paylov_token_format_invalid: 'Railway’dagi Token bir qatorli bo‘lishi va ichida bo‘shliq yoki yashirin yangi qator bo‘lmasligi kerak.',
        paylov_token_rejected: 'Paylov Tokenni rad etdi. Railway’dagi Token OAuth2 sandbox uchun berilganini tekshiring.',
        paylov_provider_rejected: 'Paylov so‘rovni rad etdi.',
        paylov_gateway_error: 'Paylov gateway xato javob qaytardi.',
        paylov_invalid_response: 'Paylov javobi kutilgan formatga mos kelmadi.',
        paylov_transaction_invalid: 'Paylov transaction ID qaytarmadi.',
        paylov_confirmation_invalid: 'Paylov tasdiqlash natijasini ishonchli tekshirib bo‘lmadi.',
        paylov_timeout: 'Paylov 20 soniyada javob bermadi. Railway’dan sandbox gateway’gacha ulanishni tekshirish kerak.',
        paylov_unavailable: 'Paylov gateway bilan aloqa o‘rnatilmadi.',
        paylov_dns_error: 'Railway Paylov sandbox domenini DNS orqali topa olmadi.',
        paylov_connection_error: 'Railway va Paylov o‘rtasidagi ulanish uzildi yoki rad etildi.',
        paylov_tls_error: 'Railway Paylov TLS sertifikatini tasdiqlay olmadi.',
        paylov_response_too_large: 'Paylov kutilganidan juda katta javob qaytardi va so‘rov xavfsiz to‘xtatildi.',
        paylov_too_many_attempts: 'Urinishlar ko‘payib ketdi. 10 daqiqadan keyin qayta sinang.',
        payment_not_found: 'Boshlangan to‘lov topilmadi. Yangi sinov boshlang.',
        payment_processing: 'To‘lov hozir qayta ishlanmoqda. Bir necha soniyadan keyin qayta urinib ko‘ring.',
        payment_refunded: 'Bu to‘lov qaytarilgan.',
        paylov_transaction_missing: 'To‘lovda Paylov transaction ID saqlanmagan. Yangi sinov boshlang.',
        paylov_environment_changed: 'To‘lov boshlanganidan keyin Paylov muhiti o‘zgargan. Yangi sinov boshlang.',
        paylov_duplicate_transaction: 'Bu Paylov tranzaksiyasi oldin boshqa to‘lovda ishlatilgan.',
        paylov_transaction_mismatch: 'Paylov tranzaksiyasi mahalliy buyurtmaga mos kelmadi.',
    }
    const base = messages[code] || 'To‘lov sinovida kutilmagan xatolik yuz berdi.'
    const details = [
        providerCode ? `Paylov kodi: ${providerCode}.` : '',
        networkCode ? `Texnik kod: ${networkCode}.` : '',
    ].filter(Boolean).join(' ')
    return details ? `${base} ${details}` : base
}

export default function PaylovSandboxPanel() {
    const [config, setConfig] = useState<BillingConfig | null>(null)
    const [configLoading, setConfigLoading] = useState(true)
    const [configError, setConfigError] = useState('')
    const [phase, setPhase] = useState<'card' | 'otp' | 'success'>('card')
    const [cardNumber, setCardNumber] = useState('')
    const [expiry, setExpiry] = useState('')
    const [orderId, setOrderId] = useState('')
    const [maskedPhone, setMaskedPhone] = useState('')
    const [otp, setOtp] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    const loadConfig = useCallback(async (signal?: AbortSignal) => {
        setConfigLoading(true)
        setConfigError('')
        try {
            const data = await fetchApi('/billing/config', { signal, silent: true }) as BillingConfig
            setConfig(data)
        } catch (loadError) {
            if ((loadError as Error)?.name !== 'AbortError') {
                setConfigError('Billing konfiguratsiyasini yuklab bo‘lmadi.')
            }
        } finally {
            if (!signal?.aborted) setConfigLoading(false)
        }
    }, [])

    useEffect(() => {
        const controller = new AbortController()
        loadConfig(controller.signal)
        return () => controller.abort()
    }, [loadConfig])

    const sandboxReady = Boolean(
        config?.provider === 'paylov'
        && config.paylovFlow === 'oauth2'
        && config.paylovEnvironment === 'sandbox'
        && config.sandboxTestMode
        && config.checkoutConfigured
        && config.officialGateway,
    )
    const enteredCardDigits = digits(cardNumber, 16)
    const detectedCardNetwork = cardNetwork(enteredCardDigits)

    async function startPayment(event: FormEvent) {
        event.preventDefault()
        setError('')
        const normalizedCardNumber = digits(cardNumber, 16)
        if (normalizedCardNumber.length !== 16) {
            setError('Karta raqami 16 ta raqamdan iborat bo‘lishi kerak.')
            return
        }
        if (!cardNetwork(normalizedCardNumber)) {
            setError('Faqat HUMO yoki UZCARD karta raqamini kiriting.')
            return
        }
        const expireDate = paylovExpireDate(expiry)
        if (!expireDate) {
            setError('Amal muddatini kartada yozilgan MM/YY formatida kiriting.')
            return
        }

        setSubmitting(true)
        try {
            const data = await fetchApi('/billing/paylov/oauth/start', {
                method: 'POST',
                body: JSON.stringify({
                    cardNumber: normalizedCardNumber,
                    expireDate,
                }),
                silent: true,
            }) as StartResponse
            setOrderId(data.orderId)
            setMaskedPhone(data.otpSentPhone || '')
            setCardNumber('')
            setExpiry('')
            setOtp('')
            setPhase('otp')
        } catch (startError) {
            setError(errorMessage(startError))
        } finally {
            setSubmitting(false)
        }
    }

    async function confirmPayment(event: FormEvent) {
        event.preventDefault()
        setError('')
        if (digits(otp, 6).length !== 6) {
            setError('Tasdiqlash kodi 6 ta raqamdan iborat bo‘lishi kerak.')
            return
        }

        setSubmitting(true)
        try {
            await fetchApi('/billing/paylov/oauth/confirm', {
                method: 'POST',
                body: JSON.stringify({ orderId, otp: digits(otp, 6) }),
                silent: true,
            })
            setOtp('')
            setPhase('success')
        } catch (confirmError) {
            setError(errorMessage(confirmError))
        } finally {
            setSubmitting(false)
        }
    }

    function resetTest() {
        setPhase('card')
        setCardNumber('')
        setExpiry('')
        setOrderId('')
        setMaskedPhone('')
        setOtp('')
        setError('')
    }

    const statusBadge = (ready: boolean, label: string) => (
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={ready
                ? { color: 'var(--success)', background: 'color-mix(in srgb, var(--success) 10%, transparent)' }
                : { color: 'var(--text-muted)', background: 'var(--bg-surface)' }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: ready ? 'var(--success)' : 'var(--text-muted)' }} />
            {label}
        </span>
    )

    if (configLoading) {
        return (
            <div className="flex items-center justify-center py-20" aria-live="polite">
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--brand)' }} />
                <span className="ml-2 text-sm" style={{ color: 'var(--text-muted)' }}>Paylov holati tekshirilmoqda...</span>
            </div>
        )
    }

    if (configError || !config) {
        return (
            <div className="max-w-lg rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 mt-0.5" style={{ color: 'var(--danger)' }} />
                    <div className="flex-1">
                        <p className="text-sm font-semibold">Konfiguratsiya ochilmadi</p>
                        <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>{configError}</p>
                        <button type="button" onClick={() => loadConfig()} className="btn btn-outline btn-sm mt-4 inline-flex items-center gap-1.5">
                            <RefreshCw className="h-3.5 w-3.5" /> Qayta tekshirish
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                    <h2 className="text-base font-bold">Paylov integratsiya sinovi</h2>
                    <p className="text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        Rasmiy Paylov sandbox gateway orqali karta va OTP oqimini tekshiring.
                    </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {statusBadge(config.paylovEnvironment === 'sandbox', config.paylovEnvironment === 'sandbox' ? 'Sandbox' : 'Production')}
                    {statusBadge(config.paylovFlow === 'oauth2', config.paylovFlow === 'oauth2' ? 'OAuth2' : 'Hosted')}
                    {statusBadge(sandboxReady, sandboxReady ? 'Tayyor' : 'Sozlanmagan')}
                </div>
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ color: 'var(--brand)', background: 'var(--brand-light)' }}>
                            <CreditCard className="h-4.5 w-4.5" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold">Pro obuna · 30 kun</p>
                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                {new Intl.NumberFormat('uz-UZ').format(config.priceUzs)} so‘m · dev.gw.paylov.uz
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: config.callbackConfigured ? 'var(--success)' : 'var(--text-muted)' }}>
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Callback {config.callbackConfigured ? 'sozlangan' : 'sozlanmagan'}
                    </div>
                </div>

                {!sandboxReady ? (
                    <div className="p-5">
                        <div className="rounded-xl p-4 flex items-start gap-3" role="alert"
                            style={{ color: 'var(--danger)', background: 'var(--danger-light)' }}>
                            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-[13px] font-semibold">Sandbox sinoviga tayyor emas</p>
                                <p className="text-[12px] mt-1 leading-relaxed">
                                    Railway’da BILLING_PROVIDER=paylov, PAYLOV_FLOW=oauth2,
                                    PAYLOV_ENVIRONMENT=sandbox va BILLING_SANDBOX_TEST=true bo‘lishi kerak.
                                    merchant_id hamda Token ham to‘ldiriladi.
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-5 space-y-5">
                        <ol className="grid grid-cols-2 rounded-xl p-1" style={{ background: 'var(--bg-surface)' }} aria-label="To‘lov bosqichlari">
                            {[
                                { key: 'card', number: '1', label: 'Karta' },
                                { key: 'otp', number: '2', label: 'Tasdiqlash' },
                            ].map(step => {
                                const active = phase === step.key || (phase === 'success' && step.key === 'otp')
                                const done = (phase === 'otp' || phase === 'success') && step.key === 'card'
                                return (
                                    <li key={step.key} aria-current={active ? 'step' : undefined}
                                        className="rounded-lg px-3 py-2 text-[12px] font-semibold flex items-center justify-center gap-2"
                                        style={active ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(33,28,22,.08)' } : { color: 'var(--text-muted)' }}>
                                        <span className="h-5 w-5 rounded-full inline-flex items-center justify-center text-[10px]"
                                            style={done
                                                ? { color: '#fff', background: 'var(--success)' }
                                                : active
                                                    ? { color: '#fff', background: 'var(--brand)' }
                                                    : { color: 'var(--text-muted)', border: '1px solid var(--border-strong)' }}>
                                            {done ? '✓' : step.number}
                                        </span>
                                        {step.label}
                                    </li>
                                )
                            })}
                        </ol>

                        {error && (
                            <div className="rounded-xl px-3.5 py-3 flex items-start gap-2 text-[12px]" role="alert"
                                style={{ color: 'var(--danger)', background: 'var(--danger-light)' }}>
                                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        {phase === 'card' && (
                            <form onSubmit={startPayment} className="space-y-4" autoComplete="off">
                                <div className="rounded-xl px-3.5 py-3 text-[12px] leading-relaxed"
                                    style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}>
                                    Faqat Paylov taqdim etgan rasmiy sandbox karta ma’lumotlarini kiriting. Paylov tasdiqlamaguncha haqiqiy kartadan foydalanmang.
                                </div>
                                <div className="grid sm:grid-cols-[minmax(0,1fr)_130px] gap-3">
                                    <div>
                                        <label htmlFor="paylov-card-number" className="text-[12px] font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                            Karta raqami
                                        </label>
                                        <input id="paylov-card-number" className="input font-mono tracking-wide" inputMode="numeric"
                                            value={cardNumber} onChange={event => setCardNumber(formatCardNumber(event.target.value))}
                                            placeholder="9860 yoki 8600" maxLength={19} required />
                                        <p className="text-[10px] mt-1.5"
                                            style={{ color: detectedCardNetwork && enteredCardDigits.length === 16 ? 'var(--success)' : 'var(--text-muted)' }}>
                                            {detectedCardNetwork
                                                ? enteredCardDigits.length === 16
                                                    ? `${detectedCardNetwork} · format to‘g‘ri`
                                                    : `${detectedCardNetwork} · yana ${16 - enteredCardDigits.length} ta raqam kiriting`
                                                : 'HUMO: 9860 · UZCARD: 8600'}
                                        </p>
                                    </div>
                                    <div>
                                        <label htmlFor="paylov-expiry" className="text-[12px] font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                            Amal muddati
                                        </label>
                                        <input id="paylov-expiry" className="input font-mono" inputMode="numeric"
                                            value={expiry} onChange={event => setExpiry(formatExpiry(event.target.value))}
                                            placeholder="MM/YY" maxLength={5} required />
                                    </div>
                                </div>
                                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                    Karta ma’lumoti Paylov’ga yuboriladi; DTMMax bazasi va loglarida saqlanmaydi.
                                </p>
                                <button type="submit" disabled={submitting} className="btn btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 disabled:opacity-50">
                                    {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Paylovga yuborilmoqda...</> : <><KeyRound className="h-4 w-4" /> OTP olish</>}
                                </button>
                            </form>
                        )}

                        {phase === 'otp' && (
                            <form onSubmit={confirmPayment} className="space-y-4" autoComplete="off">
                                <div>
                                    <p className="text-sm font-semibold">Tasdiqlash kodini kiriting</p>
                                    <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                        {maskedPhone ? `Kod ${maskedPhone} raqamiga yuborildi.` : 'Paylov tasdiqlash kodini yubordi.'}
                                    </p>
                                </div>
                                <div className="max-w-[220px]">
                                    <label htmlFor="paylov-otp" className="text-[12px] font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                        6 xonali kod
                                    </label>
                                    <input id="paylov-otp" className="input font-mono tracking-[0.25em] text-center" inputMode="numeric"
                                        value={otp} onChange={event => setOtp(digits(event.target.value, 6))}
                                        placeholder="000000" maxLength={6} autoFocus required />
                                </div>
                                <div className="flex flex-col-reverse sm:flex-row gap-2">
                                    <button type="button" onClick={resetTest} disabled={submitting} className="btn btn-outline disabled:opacity-50">
                                        Boshqa karta
                                    </button>
                                    <button type="submit" disabled={submitting} className="btn btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-50">
                                        {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Tasdiqlanmoqda...</> : <><ShieldCheck className="h-4 w-4" /> To‘lovni tasdiqlash</>}
                                    </button>
                                </div>
                            </form>
                        )}

                        {phase === 'success' && (
                            <div className="py-2">
                                <div className="flex items-start gap-3">
                                    <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0"
                                        style={{ color: 'var(--success)', background: 'color-mix(in srgb, var(--success) 12%, transparent)' }}>
                                        <CheckCircle2 className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold">Sandbox to‘lovi muvaffaqiyatli</h3>
                                        <p className="text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                            Payment PAID holatiga o‘tdi va 30 kunlik Pro obuna bazada yaratildi. Tranzaksiya mablag‘i holatini Paylov sandbox shartlari bo‘yicha tekshiring.
                                        </p>
                                        <button type="button" onClick={resetTest} className="btn btn-outline btn-sm mt-4 inline-flex items-center gap-1.5">
                                            <RefreshCw className="h-3.5 w-3.5" /> Yangi sinov
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Productionga o‘tishda tunnel ishlatilmaydi: PAYLOV_ENVIRONMENT=production rasmiy gw.paylov.uz hostini tanlaydi;
                sandbox bayrog‘i o‘chiriladi va production OAuth2 token alohida qo‘yiladi.
            </p>
        </div>
    )
}
