import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle, Clock, XCircle, Sparkles } from 'lucide-react'
import { fetchApi } from '@/lib/api'

// Paylov hosted checkout'dan qaytish sahifasi: ?tx=<order_id> bo'yicha holatni
// kuzatadi. Webhook bir necha soniya kechikishi mumkin — shuning uchun polling.
const POLL_INTERVAL_MS = 2500
const MAX_POLLS = 12 // ~30 soniya

type PayState = 'checking' | 'paid' | 'failed' | 'pending'

export default function ProResult() {
    const nav = useNavigate()
    const location = useLocation()
    const [state, setState] = useState<PayState>('checking')
    const pollCount = useRef(0)

    const tx = new URLSearchParams(location.search).get('tx') || ''

    useEffect(() => {
        if (!tx) { setState('pending'); return }
        let active = true
        const tick = async () => {
            if (!active) return
            pollCount.current += 1
            try {
                const data = await fetchApi(`/billing/payment/${encodeURIComponent(tx)}`, { silent: true })
                if (!active) return
                if (data?.status === 'PAID') { setState('paid'); return }
                if (data?.status === 'FAILED') { setState('failed'); return }
            } catch { /* topilmasa ham poll davom etadi (webhook hali yozmagan bo'lishi mumkin) */ }
            if (pollCount.current >= MAX_POLLS) { setState('pending'); return }
            setTimeout(tick, POLL_INTERVAL_MS)
        }
        void tick()
        return () => { active = false }
    }, [tx])

    const view = {
        checking: {
            icon: <div className="h-12 w-12 border-4 rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />,
            title: "To'lov tekshirilmoqda...",
            desc: "Bank javobini kutyapmiz — odatda bir necha soniya.",
        },
        paid: {
            icon: <CheckCircle className="h-12 w-12 mx-auto" style={{ color: 'var(--success)' }} />,
            title: "To'lov muvaffaqiyatli! 🎉",
            desc: "Pro obunangiz 30 kunga faollashtirildi. Omad — endi maksimal natija sari birga ishlaymiz!",
        },
        failed: {
            icon: <XCircle className="h-12 w-12 mx-auto" style={{ color: 'var(--danger)' }} />,
            title: "To'lov amalga oshmadi",
            desc: "Pul yechilmagan bo'lishi kerak. Qayta urinib ko'ring yoki boshqa karta ishlating.",
        },
        pending: {
            icon: <Clock className="h-12 w-12 mx-auto" style={{ color: 'var(--brand)' }} />,
            title: "To'lov qayta ishlanmoqda",
            desc: "Bank tasdig'i biroz kechikyapti. Obuna bir necha daqiqada faollashadi — xavotir olmang, pul yechilgan bo'lsa obuna albatta ochiladi.",
        },
    }[state]

    return (
        <div className="kelviq min-h-screen flex items-center justify-center p-5" style={{ background: 'var(--bg-page)' }}>
            <div className="w-full max-w-sm anim-up">
                <div className="flex items-center gap-2 justify-center mb-8">
                    <img src="/dtmmax-logo.png" alt="DtmMax" className="h-11 w-11 rounded-xl" style={{ objectFit: 'contain' }} />
                    <span className="font-bold text-xl tracking-tight">DTMMax</span>
                </div>
                <div className="card text-center" style={{ padding: '2.5rem 2rem' }}>
                    {view.icon}
                    <h1 className="text-xl font-bold tracking-tight mt-5 mb-2" style={{ color: 'var(--text-primary)' }}>{view.title}</h1>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{view.desc}</p>
                    <button
                        type="button"
                        onClick={() => nav('/suhbat', { replace: true })}
                        className="btn btn-brand mt-6"
                        style={{ width: '100%' }}
                    >
                        <Sparkles className="h-4 w-4" /> Suhbatga qaytish
                    </button>
                </div>
            </div>
        </div>
    )
}
