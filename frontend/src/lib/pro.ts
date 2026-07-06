/* =========================================================================
   DtmMax — Pro tier model (FRONTEND SCAFFOLDING, non-enforcing)
   ---------------------------------------------------------------------------
   This file encodes the Pro tier *model* so the UI can label and present it
   consistently with the landing pricing section (Landing.tsx → PLANS).

   IMPORTANT (decided by O'ktam):
   - Pro is VISIBLE in-app, but NOT enforced. Everyone uses everything for free
     during beta. There is NO payment system yet and NO feature gating here.
   - `useIsPro()` is the single seam a real entitlement (server flag / billing)
     will plug into later. Until then it ALWAYS reports the open-beta state, so
     no feature is ever blocked. Do NOT use it to hide or disable functionality
     — only to drive cosmetic "Pro" tags and the upgrade view.
   - No Prisma/DB field, no migration, no checkout. Those ship with payment.

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
    "DTM savol-bashorati — kafolat emas: 5 yillik DTM tahlillarimizga ko'ra eng ehtimoliy mavzu va savol turlari. To'lov hali ishga tushmagan — hozircha barcha imkoniyatlardan bepul foydalaning." as const

/**
 * Tier seam for a future real entitlement.
 *
 * Returns the current tier state. During open beta this is intentionally a
 * constant: `isPro` is reported `true` for everyone AND `enforced` is `false`,
 * so callers must NEVER gate a feature on it — it exists only to (a) drive
 * cosmetic Pro tags and (b) be the one place a server-backed entitlement is
 * wired in later (e.g. read `user.proUntil` once payment lands).
 *
 * Deliberately takes no arguments and reads no store so it cannot accidentally
 * become a gate; swap the body for a real check when billing exists.
 */
export interface ProState {
    /** Open beta → everyone is effectively Pro. */
    isPro: boolean
    /** Beta → tier limits are NOT enforced anywhere. Always false for now. */
    enforced: boolean
    /** Display status, e.g. "Beta'da bepul ochiq". */
    statusLabel: string
}

export function useIsPro(): ProState {
    // Open beta: full access for everyone, nothing enforced.
    return { isPro: true, enforced: false, statusLabel: PRO_STATUS_LABEL }
}
