// DTM ixtisoslik fan juftliklari (1-fan + 2-fan).
// DTM da juftlik erkin emas — har bir yo'nalish rasmiy "Fanlar majmuasi" jadvalida belgilangan.
// Bu — eng keng tarqalgan yo'nalishlardan curated to'plam (canonical fan nomlari subjects.ts bilan bir xil).
// Kelajakda uzbmb.uz Fanlar_majmuasi_2025-2026 to'liq jadvali DB (DtmDirection) ga import qilinadi.
//
// 3 majburiy fan (Ona tili, Matematika, O'zbekiston tarixi) hamma DTM uchun avtomatik —
// bu yerda faqat 2 ta IXTISOSLIK fani (1-fan 30 savol, 2-fan 30 savol) modellashtiriladi.

export interface DtmDirection {
    code: string
    name: string
    subject1: string   // 1-fan (30 savol)
    subject2: string   // 2-fan (30 savol)
    faculties?: string[]
}

export const DTM_DIRECTIONS: DtmDirection[] = [
    { code: 'MATH_PHYS',   name: 'Matematika – Fizika',     subject1: 'Matematika',  subject2: 'Fizika',      faculties: ['Muhandislik', 'Axborot texnologiyalari', 'Arxitektura', 'Energetika'] },
    { code: 'MATH_ENG',    name: 'Matematika – Ingliz tili', subject1: 'Matematika', subject2: 'Ingliz tili', faculties: ['Iqtisodiyot', 'Bank ishi', 'Menejment', 'Logistika'] },
    { code: 'MATH_NATIVE', name: 'Matematika – Ona tili',   subject1: 'Matematika',  subject2: 'Ona tili',    faculties: ['Boshlang\'ich ta\'lim', 'Pedagogika', 'Buxgalteriya'] },
    { code: 'BIO_CHEM',    name: 'Biologiya – Kimyo',       subject1: 'Biologiya',   subject2: 'Kimyo',       faculties: ['Tibbiyot', 'Stomatologiya', 'Pediatriya', 'Veterinariya'] },
    { code: 'CHEM_BIO',    name: 'Kimyo – Biologiya',       subject1: 'Kimyo',       subject2: 'Biologiya',   faculties: ['Farmatsevtika', 'Kimyo texnologiyasi', 'Oziq-ovqat'] },
    { code: 'CHEM_PHYS',   name: 'Kimyo – Fizika',          subject1: 'Kimyo',       subject2: 'Fizika',      faculties: ['Neft-gaz', 'Metallurgiya'] },
    { code: 'HIST_NATIVE', name: 'Tarix – Ona tili',        subject1: 'Tarix',       subject2: 'Ona tili',    faculties: ['Yuridik', 'Xalqaro munosabatlar', 'Tarix', 'Falsafa'] },
    { code: 'NATIVE_HIST', name: 'Ona tili – Tarix',        subject1: 'Ona tili',    subject2: 'Tarix',       faculties: ['Filologiya', 'Jurnalistika'] },
    { code: 'ENG_NATIVE',  name: 'Ingliz tili – Ona tili',  subject1: 'Ingliz tili', subject2: 'Ona tili',    faculties: ['Tarjimashunoslik', 'Xorijiy til filologiyasi'] },
    { code: 'ENG_HIST',    name: 'Ingliz tili – Tarix',     subject1: 'Ingliz tili', subject2: 'Tarix',       faculties: ['Xalqaro jurnalistika', 'Mintaqashunoslik'] },
    { code: 'GEO_BIO',     name: 'Geografiya – Biologiya',  subject1: 'Geografiya',  subject2: 'Biologiya',   faculties: ['Geografiya', 'Ekologiya', 'Geodeziya'] },
    { code: 'GEO_MATH',    name: 'Geografiya – Matematika', subject1: 'Geografiya',  subject2: 'Matematika',  faculties: ['Iqtisodiy geografiya', 'Turizm'] },
]

// 1-fanga mos ruxsat etilgan 2-fanlar (UI 2-select uchun)
export function allowedSubject2(subject1: string): string[] {
    return DTM_DIRECTIONS.filter(d => d.subject1 === subject1).map(d => d.subject2)
}

// (subject1, subject2) juftligi rasmiy yo'nalishlardan birimi?
export function isValidDtmPair(subject1: string, subject2: string): boolean {
    return DTM_DIRECTIONS.some(d => d.subject1 === subject1 && d.subject2 === subject2)
}

// Tanlash uchun mavjud 1-fanlar (takrorlanmaydigan)
export function dtmSubject1Options(): string[] {
    return Array.from(new Set(DTM_DIRECTIONS.map(d => d.subject1)))
}
