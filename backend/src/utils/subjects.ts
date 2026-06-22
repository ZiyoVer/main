export const SUBJECTS = [
    'Matematika',
    'Fizika',
    'Kimyo',
    'Biologiya',
    'Ona tili',
    'Ingliz tili',
    'Tarix',
    'Geografiya',
] as const

export type CanonicalSubject = typeof SUBJECTS[number]

const SUBJECT_VARIANTS: Record<CanonicalSubject, string[]> = {
    Matematika: ['Matematika'],
    Fizika: ['Fizika'],
    Kimyo: ['Kimyo'],
    Biologiya: ['Biologiya'],
    'Ona tili': ['Ona tili', 'Ona tili va adabiyot', 'Ona tili va adabiyoti', "O'zbek tili", 'O‘zbek tili'],
    'Ingliz tili': ['Ingliz tili'],
    Tarix: ['Tarix', "O'zbekiston tarixi", 'O‘zbekiston tarixi'],
    Geografiya: ['Geografiya'],
}

const SUBJECT_SET = new Set<string>(SUBJECTS)
const SUBJECT_LOOKUP = new Map<string, CanonicalSubject>()

for (const [canonical, variants] of Object.entries(SUBJECT_VARIANTS) as Array<[CanonicalSubject, string[]]>) {
    for (const variant of variants) {
        SUBJECT_LOOKUP.set(sanitizeSubject(variant), canonical)
    }
}

function sanitizeSubject(subject: string): string {
    return subject
        .trim()
        .replace(/[ʻʼ`´‘]/g, "'")
        .replace(/\s+/g, ' ')
}

export function normalizeSubject(subject?: string | null): string | null {
    if (!subject) return null
    const sanitized = sanitizeSubject(subject)
    if (!sanitized) return null
    return SUBJECT_LOOKUP.get(sanitized) || sanitized
}

export function isCanonicalSubject(subject?: string | null): subject is CanonicalSubject {
    return !!subject && SUBJECT_SET.has(subject)
}

export function getSubjectVariants(subject?: string | null): string[] | undefined {
    const normalized = normalizeSubject(subject)
    if (!normalized) return undefined
    if (!isCanonicalSubject(normalized)) return [normalized]
    return Array.from(new Set([normalized, ...SUBJECT_VARIANTS[normalized]]))
}

export function isMandatoryDtmSubject(subject?: string | null): boolean {
    const normalized = normalizeSubject(subject)
    return normalized === 'Ona tili' || normalized === 'Tarix'
}

// Test nomidan fanni taxmin qilish (subject bo'sh/noaniq bo'lsa fallback).
// Kalit-so'zlar pastki registrda; birinchi mos kelgan fan qaytadi.
const SUBJECT_KEYWORDS: Array<[CanonicalSubject, string[]]> = [
    ['Matematika', ['matematika', 'matem', 'algebra', 'geometr', 'math', 'trigonometr']],
    ['Fizika', ['fizika', 'fizik', 'physic']],
    ['Kimyo', ['kimyo', 'ximiy', 'chem']],
    ['Biologiya', ['biologiya', 'biolog', 'anatomi']],
    ['Ona tili', ['ona tili', 'ona-tili', "o'zbek tili", 'ozbek tili', 'adabiyot', 'til va adabiyot']],
    ['Ingliz tili', ['ingliz', 'english', 'inglizcha']],
    ['Tarix', ['tarix', 'history', 'temur', 'shayboniy']],
    ['Geografiya', ['geografiya', 'geograf', 'iqlim', 'relyef']],
]

export function inferSubjectFromTitle(title?: string | null): CanonicalSubject | null {
    if (!title) return null
    const t = sanitizeSubject(title).toLowerCase()
    if (!t) return null
    for (const [subject, keywords] of SUBJECT_KEYWORDS) {
        if (keywords.some(k => t.includes(k))) return subject
    }
    return null
}

// Test kategoriyasi: avval tanlangan fan (normallashtirilgan), bo'lmasa nomdan
// taxmin (pattern), bo'lmasa "Boshqa".
export function categoryForTest(test: { subject?: string | null; title?: string | null }): string {
    const norm = normalizeSubject(test.subject)
    if (norm && isCanonicalSubject(norm)) return norm
    const inferred = inferSubjectFromTitle(test.title)
    if (inferred) return inferred
    return norm || 'Boshqa'
}
