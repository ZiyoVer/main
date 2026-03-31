export type ExamType = 'DTM' | 'MS'

function isEmptyValue(value: unknown): boolean {
    return value === undefined || value === null || value === ''
}

export function parseOptionalExamType(value: unknown): ExamType | null | undefined {
    if (value === undefined) return undefined
    if (value === null || value === '') return null
    if (typeof value !== 'string') {
        throw new Error('examType noto\'g\'ri')
    }
    const normalized = value.trim().toUpperCase()
    if (normalized === 'DTM' || normalized === 'MS') return normalized
    throw new Error('examType faqat DTM yoki MS bo\'lishi mumkin')
}

export function parseOptionalExamDate(value: unknown): Date | null | undefined {
    if (value === undefined) return undefined
    if (value === null || value === '') return null
    if (typeof value !== 'string' && !(value instanceof Date)) {
        throw new Error('examDate noto\'g\'ri')
    }
    const parsed = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(parsed.getTime())) {
        throw new Error('examDate noto\'g\'ri formatda')
    }
    return parsed
}

export function parseOptionalTargetScore(value: unknown): number | null | undefined {
    if (value === undefined) return undefined
    if (value === null || value === '') return null
    const parsed = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        throw new Error('targetScore butun son bo\'lishi kerak')
    }
    if (parsed < 1 || parsed > 250) {
        throw new Error('targetScore 1 dan 250 gacha bo\'lishi kerak')
    }
    return parsed
}

export function parseOptionalStudyHours(value: unknown): number | null | undefined {
    if (value === undefined) return undefined
    if (value === null || value === '') return null
    const parsed = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(parsed)) {
        throw new Error('studyHoursPerDay son bo\'lishi kerak')
    }
    if (parsed <= 0 || parsed > 24) {
        throw new Error('studyHoursPerDay 0 dan katta va 24 dan kichik bo\'lishi kerak')
    }
    return Math.round(parsed * 10) / 10
}

export function hasProvidedProfileValue(value: unknown): boolean {
    return !isEmptyValue(value)
}
