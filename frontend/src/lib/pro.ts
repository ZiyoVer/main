import { useEffect, useState } from 'react'
import { fetchApi } from '@/lib/api'

/* =========================================================================
   DtmMax — Pro tier model
   ---------------------------------------------------------------------------
   This file encodes the Pro tier *model* so the UI can label and present it
   consistently with the landing pricing section (Landing.tsx → PLANS).

   `useIsPro()` backend /billing/status bilan yagona entitlement manbasi bo'ladi.
   PRO_ENFORCED=false paytida backend beta holatini, true paytida esa haqiqiy
   Subscription holatini qaytaradi. Feature gate'ning yakuniy qarori baribir
   serverda qoladi — klient holatiga ishonilmaydi.

   HONESTY: the DTM question-prediction copy must stay "tahlilga asoslangan,
   kafolat emas" — never promise a guaranteed score or a fixed percentage.
   ========================================================================= */

/** Monthly Pro price, kept in sync with the landing pricing card. */
export const PRO_PRICE = '35 000' as const
export const PRO_PRICE_PERIOD = "so'm / oy" as const

/** Current rollout status shown everywhere Pro surfaces. */
export const PRO_STATUS_LABEL = "Beta'da bepul ochiq" as const

/** Stable identifiers for the four Pro-tier features. */
export type ProFeatureId = 'thinking' | 'prediction' | 'analytics' | 'priority'

export interface ProFeature {
    id: ProFeatureId
    /** Short Uzbek label used on cards and tags. */
    title: string
    /** One-line Uzbek description (matches landing tone). */
    description: string
    /**
     * Whether the feature is actually built and usable in-app today.
     * `true`  → already shipped, just tagged "Pro" (kept fully open in beta).
     * `false` → not built yet → surfaces as "Tez kunda", never faked.
     */
    available: boolean
}

/**
 * The four Pro features, mirroring Landing.tsx PLANS[Pro].features verbatim in
 * tone. Order matches the landing card.
 */
export const PRO_FEATURES: readonly ProFeature[] = [
    {
        id: 'thinking',
        title: 'Thinking rejim',
        description: "Murakkab masalalarda AI chuqurroq fikrlaydi.",
        available: true, // composer Lightbulb toggle already exists — open in beta
    },
    {
        id: 'prediction',
        title: 'DTM savol-bashorati',
        description: "5 yillik DTM tahliliga asoslangan eng ehtimoliy mavzu va savol turlari. Tahlilga asoslangan — kafolat emas.",
        available: false, // not built — show as "Tez kunda", never fake a result
    },
    {
        id: 'analytics',
        title: 'Chuqur analitika',
        description: "Kengaytirilgan zaiflik va progress tahlili.",
        available: false, // basic analytics exist; the deep view is "Tez kunda"
    },
    {
        id: 'priority',
        title: 'Cheksiz va ustuvor yordam',
        description: "Navbatsiz, tezroq javob.",
        available: true, // everyone already has unlimited access in beta
    },
] as const

/** Free-tier feature list, mirroring Landing.tsx PLANS[Bepul].features.
    Kunlik limitlar backend'dagi FREE_DAILY_LIMITS (aiQuota.ts: chat 30, vision 5) bilan mos tursin. */
export const FREE_FEATURES: readonly string[] = [
    'AI repetitor — kuniga 30 ta so\'rov (suhbat, test, reja)',
    'Rasm/screenshot tahlili — kuniga 5 ta',
    'Tayyor DTM testlarini yechish — cheksiz',
    'Natija tahlili va progress kuzatuvi',
    'Flashcardlar bilan eslab qolish',
] as const

/**
 * Honest, no-guarantee disclaimer reused under any prediction/Pro surface.
 * Keep wording aligned with the landing footnote.
 */
export const PRO_DISCLAIMER =
    "DTM savol-bashorati — kafolat emas: 5 yillik DTM tahlillarimizga ko'ra eng ehtimoliy mavzu va savol turlari." as const

/**
 * Server-backed entitlement. Network xatosida pullik holat taxmin qilinmaydi;
 * backend feature endpointlari baribir requirePro/kvota bilan fail-closed.
 */
export interface ProState {
    isPro: boolean
    enforced: boolean
    statusLabel: string
    until: string | null
    loading: boolean
}

export function useIsPro(): ProState {
    const [state, setState] = useState<ProState>({
        isPro: false,
        enforced: false,
        statusLabel: 'Holat tekshirilmoqda...',
        until: null,
        loading: true,
    })

    useEffect(() => {
        const controller = new AbortController()
        void fetchApi('/billing/status', { signal: controller.signal, silent: true })
            .then((data: unknown) => {
                if (!data || typeof data !== 'object') throw new Error('billing_status_invalid')
                const status = data as Record<string, unknown>
                const enforced = status.enforced === true
                const isPro = status.isPro === true
                setState({
                    isPro,
                    enforced,
                    statusLabel: !enforced ? PRO_STATUS_LABEL : isPro ? 'Pro obuna faol' : 'Bepul reja',
                    until: typeof status.until === 'string' ? status.until : null,
                    loading: false,
                })
            })
            .catch(error => {
                if (error instanceof DOMException && error.name === 'AbortError') return
                setState({
                    isPro: false,
                    enforced: true,
                    statusLabel: 'Obuna holati aniqlanmadi',
                    until: null,
                    loading: false,
                })
            })
        return () => controller.abort()
    }, [])

    return state
}
