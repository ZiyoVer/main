import { normalizeSubjectValue } from '@/constants'

export interface TestSubjectTheme {
    accent: string
    strong: string
    soft: string
}

const themeFromAccent = (accent: string): TestSubjectTheme => ({
    accent,
    strong: `color-mix(in srgb, ${accent} 72%, var(--text-primary))`,
    soft: `color-mix(in srgb, ${accent} 10%, var(--bg-card))`,
})

// To'rtta rang oilasi: rang fan guruhini bildiradi, holatni emas.
// Holatlar uchun success / warning / danger tokenlari alohida qoladi.
const QUANTITATIVE = themeFromAccent('oklch(55% 0.17 255)')
const NATURAL_SCIENCE = themeFromAccent('oklch(52% 0.14 158)')
const LANGUAGE = themeFromAccent('oklch(55% 0.16 305)')
const HUMANITIES = themeFromAccent('oklch(53% 0.14 52)')

export function testSubjectTheme(subject?: string | null): TestSubjectTheme {
    const normalized = normalizeSubjectValue(subject)
    if (normalized === 'Matematika' || normalized === 'Fizika') return QUANTITATIVE
    if (normalized === 'Kimyo' || normalized === 'Biologiya') return NATURAL_SCIENCE
    if (normalized === 'Ona tili' || normalized === 'Ingliz tili') return LANGUAGE
    if (normalized === 'Tarix' || normalized === 'Geografiya') return HUMANITIES
    return themeFromAccent('var(--brand)')
}
