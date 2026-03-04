export const SUBJECTS = [
  'Matematika', 'Fizika', 'Kimyo', 'Biologiya',
  "Ona tili va adabiyot", 'Ingliz tili', 'Tarix', 'Geografiya',
  'Informatika', 'Rus tili'
] as const

export type Subject = typeof SUBJECTS[number]
