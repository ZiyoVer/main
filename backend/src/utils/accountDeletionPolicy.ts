export type TeacherDeletionImpact = {
    tests: number
    attempts: number
    sessions: number
}

// O'qituvchining o'z testlari — uning shaxsiy kontenti. Boshqa userning
// natijasi yoki faol sessiyasi bor bo'lsa esa self-delete admin aralashuvisiz
// davom etmasligi kerak.
export function teacherDeletionRequiresAdmin(impact: TeacherDeletionImpact): boolean {
    return impact.attempts > 0 || impact.sessions > 0
}
