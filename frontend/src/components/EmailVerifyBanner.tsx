import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, X } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

// Soft-gate eslatmasi: tasdiqlanmagan o'quvchiga doimiy, ko'zga tashlanadigan banner.
// /email-tasdiqlang sahifasiga yo'naltiradi (u yerda qayta yuborish + tekshirish bor).
const DISMISS_KEY = 'dtmmax_verify_banner_hidden'

export default function EmailVerifyBanner() {
    const nav = useNavigate()
    const user = useAuthStore(s => s.user)
    const [hidden, setHidden] = useState(() => {
        try { return sessionStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
    })

    // Faqat email tasdiqlamagan O'QUVCHIga ko'rsatamiz (legacy null/undefined emas — aniq false)
    if (!user || user.role !== 'STUDENT' || user.emailVerified !== false) return null
    if (hidden) return null

    const dismiss = () => {
        try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* yo'q bo'lsa ham mayli */ }
        setHidden(true)
    }

    return (
        <div
            role="alert"
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                padding: '0.6rem 1rem',
                background: 'linear-gradient(90deg, #F15A24 0%, #FF7A45 100%)',
                color: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
                fontSize: '13px', fontWeight: 600, lineHeight: 1.3,
            }}
        >
            <Mail style={{ width: 17, height: 17, flexShrink: 0 }} aria-hidden="true" />
            <span style={{ textAlign: 'center' }}>
                Emailingiz hali tasdiqlanmagan — bir bosishda tasdiqlang va akkauntingizni to'liq himoyalang.
            </span>
            <button
                type="button"
                onClick={() => nav('/email-tasdiqlang')}
                style={{
                    flexShrink: 0, background: '#fff', color: '#D9480F',
                    fontWeight: 700, fontSize: '12.5px', padding: '0.35rem 0.85rem',
                    borderRadius: '8px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                }}
            >
                Tasdiqlash
            </button>
            <button
                type="button"
                onClick={dismiss}
                aria-label="Yopish"
                style={{
                    flexShrink: 0, background: 'transparent', color: '#fff', border: 'none',
                    cursor: 'pointer', opacity: 0.85, display: 'flex', padding: 2,
                }}
            >
                <X style={{ width: 16, height: 16 }} />
            </button>
        </div>
    )
}
