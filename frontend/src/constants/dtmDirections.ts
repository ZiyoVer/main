// DTM ixtisoslik fan yo'nalishlari (1-fan + 2-fan juftliklari).
//
// ⚠️ MANBA (SOURCE OF TRUTH): backend/src/utils/dtmPairs.ts → DTM_DIRECTIONS.
// Bu fayl o'sha jadvalning AYNAN nusxasi. Backend hali ham yagona haqiqat manbai:
// frontend faqat noto'g'ri juftlikni tanlab bo'lmaydigan qilib UI'da KO'RSATADI.
// dtmPairs.ts o'zgartirilsa — bu faylni ham aynan shu qiymatlar bilan yangilang
// (qatorlar soni va har bir code/name/subject1/subject2 mos kelishi shart).
//
// 3 majburiy fan (Ona tili, Matematika, O'zbekiston tarixi) hamma DTM uchun avtomatik —
// bu yerda faqat 2 ta IXTISOSLIK fani modellashtiriladi.

import { SUBJECTS } from '@/constants'

export interface DtmDirection {
    code: string
    name: string
    subject1: string   // 1-fan (30 savol)
    subject2: string   // 2-fan (30 savol)
    faculties?: string[]
}

// Compile-time drift guard: subject1/subject2 SUBJECTS canonical ro'yxatidan
// bo'lishi shart — noto'g'ri fan nomi yozilsa tsc xato beradi.
type SubjectName = typeof SUBJECTS[number]
interface DtmDirectionStrict extends DtmDirection {
    subject1: SubjectName
    subject2: SubjectName
}

export const DTM_DIRECTIONS: DtmDirectionStrict[] = [
    { code: 'MATH_PHYS', name: 'Matematika – Fizika', subject1: 'Matematika', subject2: 'Fizika', faculties: ['Muhandislik', 'Axborot texnologiyalari', 'Arxitektura', 'Energetika'] },
    { code: 'MATH_ENG', name: 'Matematika – Ingliz tili', subject1: 'Matematika', subject2: 'Ingliz tili', faculties: ['Iqtisodiyot', 'Bank ishi', 'Menejment', 'Logistika'] },
    { code: 'MATH_NATIVE', name: 'Matematika – Ona tili', subject1: 'Matematika', subject2: 'Ona tili', faculties: ['Boshlang\'ich ta\'lim', 'Pedagogika', 'Buxgalteriya'] },
    { code: 'BIO_CHEM', name: 'Biologiya – Kimyo', subject1: 'Biologiya', subject2: 'Kimyo', faculties: ['Tibbiyot', 'Stomatologiya', 'Pediatriya', 'Veterinariya'] },
    { code: 'CHEM_BIO', name: 'Kimyo – Biologiya', subject1: 'Kimyo', subject2: 'Biologiya', faculties: ['Farmatsevtika', 'Kimyo texnologiyasi', 'Oziq-ovqat'] },
    { code: 'CHEM_PHYS', name: 'Kimyo – Fizika', subject1: 'Kimyo', subject2: 'Fizika', faculties: ['Neft-gaz', 'Metallurgiya'] },
    { code: 'HIST_NATIVE', name: 'Tarix – Ona tili', subject1: 'Tarix', subject2: 'Ona tili', faculties: ['Yuridik', 'Xalqaro munosabatlar', 'Tarix', 'Falsafa'] },
    { code: 'NATIVE_HIST', name: 'Ona tili – Tarix', subject1: 'Ona tili', subject2: 'Tarix', faculties: ['Filologiya', 'Jurnalistika'] },
    { code: 'ENG_NATIVE', name: 'Ingliz tili – Ona tili', subject1: 'Ingliz tili', subject2: 'Ona tili', faculties: ['Tarjimashunoslik', 'Xorijiy til filologiyasi'] },
    { code: 'ENG_HIST', name: 'Ingliz tili – Tarix', subject1: 'Ingliz tili', subject2: 'Tarix', faculties: ['Xalqaro jurnalistika', 'Mintaqashunoslik'] },
    { code: 'GEO_BIO', name: 'Geografiya – Biologiya', subject1: 'Geografiya', subject2: 'Biologiya', faculties: ['Geografiya', 'Ekologiya', 'Geodeziya'] },
    { code: 'GEO_MATH', name: 'Geografiya – Matematika', subject1: 'Geografiya', subject2: 'Matematika', faculties: ['Iqtisodiy geografiya', 'Turizm'] },
]

// examType bo'yicha target ball chegaralari — backend validateTargetScore bilan bir xil.
// DTM (yoki noma'lum): 1..189 | Milliy Sertifikat: 0..75.
export const SCORE_BOUNDS = {
    DTM: { min: 1, max: 189 },
    MS: { min: 0, max: 75 },
} as const

// code bo'yicha yo'nalishni topish.
export function dtmDirectionByCode(code: string): DtmDirection | undefined {
    return DTM_DIRECTIONS.find(d => d.code === code)
}

// (subject1, subject2) juftligiga mos yo'nalish (mavjud profilni hidratsiya qilish uchun).
export function dtmDirectionBySubjects(subject1?: string | null, subject2?: string | null): DtmDirection | undefined {
    if (!subject1 || !subject2) return undefined
    return DTM_DIRECTIONS.find(d => d.subject1 === subject1 && d.subject2 === subject2)
}
