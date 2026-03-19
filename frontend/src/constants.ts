export const SUBJECTS = [
  'Matematika', 'Fizika', 'Kimyo', 'Biologiya',
  'Ona tili', 'Ingliz tili', 'Tarix', 'Geografiya'
] as const

export type Subject = typeof SUBJECTS[number]

const SUBJECT_VARIANTS: Record<Subject, readonly string[]> = {
  Matematika: ['Matematika'],
  Fizika: ['Fizika'],
  Kimyo: ['Kimyo'],
  Biologiya: ['Biologiya'],
  'Ona tili': ['Ona tili', 'Ona tili va adabiyot', 'Ona tili va adabiyoti', "O'zbek tili", 'O‘zbek tili'],
  'Ingliz tili': ['Ingliz tili'],
  Tarix: ['Tarix', "O'zbekiston tarixi", 'O‘zbekiston tarixi'],
  Geografiya: ['Geografiya'],
}

const SUBJECT_LOOKUP = new Map<string, Subject>()

for (const [canonical, variants] of Object.entries(SUBJECT_VARIANTS) as Array<[Subject, readonly string[]]>) {
  for (const variant of variants) {
    SUBJECT_LOOKUP.set(sanitizeSubject(variant), canonical)
  }
}

function sanitizeSubject(subject: string): string {
  return subject.trim().replace(/[ʻʼ`´‘]/g, "'").replace(/\s+/g, ' ')
}

export function normalizeSubjectValue(subject?: string | null): string {
  if (!subject) return ''
  const sanitized = sanitizeSubject(subject)
  return SUBJECT_LOOKUP.get(sanitized) || sanitized
}
