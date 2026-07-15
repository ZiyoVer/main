import { ClipboardList, Zap } from 'lucide-react'
import type { AiQuota } from './useAiQuota'

interface AiQuotaRailProps {
    quota: AiQuota | null
    onOpenTests: () => void
}

export function AiQuotaRail({ quota, onOpenTests }: AiQuotaRailProps) {
    if (!quota || quota.unlimited || quota.chat.limit <= 0) return null

    const left = Math.max(0, quota.chat.limit - quota.chat.used)
    const remainingRatio = Math.max(0, Math.min(1, left / quota.chat.limit))
    const exhausted = left === 0
    const low = !exhausted && remainingRatio <= 0.2
    const resetTime = new Date(quota.resetsAt).toLocaleTimeString('uz-UZ', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Tashkent',
    })

    const statusLabel = exhausted
        ? 'Bugungi AI limiti tugadi'
        : low
            ? `${left} ta so‘rov qoldi`
            : 'AI so‘rovlari'

    return (
        <div className={`ai-quota-rail${low ? ' is-low' : ''}${exhausted ? ' is-exhausted' : ''}`}>
            <div className="ai-quota-rail__meta">
                <span className="ai-quota-rail__label"><Zap aria-hidden="true" />{statusLabel}</span>
                <span className="ai-quota-rail__count">{left}/{quota.chat.limit}</span>
            </div>
            <div
                className="ai-quota-rail__track"
                role="progressbar"
                aria-label="Bugungi qolgan AI so‘rovlari"
                aria-valuemin={0}
                aria-valuemax={quota.chat.limit}
                aria-valuenow={left}
            >
                <span style={{ width: `${remainingRatio * 100}%` }} />
            </div>
            {(low || exhausted) && (
                <div className="ai-quota-rail__note">
                    <span>{exhausted ? `${resetTime} da yangilanadi. Tayyor testlar limitga kirmaydi.` : `${resetTime} da yangilanadi.`}</span>
                    {exhausted && (
                        <button type="button" onClick={onOpenTests}>
                            <ClipboardList aria-hidden="true" /> Test yechish
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
