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
