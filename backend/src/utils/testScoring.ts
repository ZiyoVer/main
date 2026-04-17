import { DtmBlockType, TestType } from '@prisma/client'
import { raschProbability, updateAbility } from './rasch'
import { isMandatoryDtmSubject } from './subjects'

export interface AnswerEvaluation {
    isCorrect: boolean
    correctSubCount?: number
    totalSubs?: number
}

export interface ScoreableQuestion {
    difficulty?: number | null
    coefficient?: number | null
    blockType?: DtmBlockType | string | null
}

export interface DtmBreakdownItem {
    blockType: DtmBlockType
    label: string
    score: number
    max: number
    answered: number
    correct: number
}

export interface RegularScoreResult {
    scorePercent: number
    rawScore: number
    scoreMax: number
    grade: string | null
    ability: number
}

export interface DtmScoreResult extends RegularScoreResult {
    breakdown: DtmBreakdownItem[]
}

export interface MilliySertifikatScoreResult extends RegularScoreResult {
    grade: string
}

export function roundScore(value: number): number {
    return Math.round(value * 10) / 10
}

export function normalizeTestType(value: string | null | undefined): TestType {
    if (value === 'DTM_BLOCK' || value === 'dtm') return 'DTM_BLOCK'
    if (value === 'MILLIY_SERTIFIKAT' || value === 'milliy_sertifikat') return 'MILLIY_SERTIFIKAT'
    return 'REGULAR'
}

export function normalizeDtmBlockType(value: string | null | undefined): DtmBlockType {
    switch (value) {
        case 'MANDATORY_LANGUAGE':
        case 'MANDATORY_MATH':
        case 'MANDATORY_HISTORY':
        case 'SPECIALTY_1':
        case 'SPECIALTY_2':
            return value
        default:
            return 'GENERIC'
    }
}

export function getTestTypeLabel(testType: string | null | undefined): string {
    const normalized = normalizeTestType(testType)
    if (normalized === 'DTM_BLOCK') return 'DTM blok test'
    if (normalized === 'MILLIY_SERTIFIKAT') return 'Milliy Sertifikat'
    return 'Oddiy test'
}

export function getMsGrade(score: number): string {
    if (score >= 70) return 'A+'
    if (score >= 65) return 'A'
    if (score >= 60) return 'B+'
    if (score >= 55) return 'B'
    if (score >= 50) return 'C+'
    if (score >= 46) return 'C'
    return 'D'
}

export function getDtmBlockLabel(blockType: DtmBlockType): string {
    switch (blockType) {
        case 'MANDATORY_LANGUAGE':
            return 'Ona tili'
        case 'MANDATORY_MATH':
            return 'Majburiy matematika'
        case 'MANDATORY_HISTORY':
            return 'O‘zbekiston tarixi'
        case 'SPECIALTY_1':
            return '1-ixtisoslik'
        case 'SPECIALTY_2':
            return '2-ixtisoslik'
        default:
            return 'Umumiy'
    }
}

export function getDefaultDtmCoefficient(blockType: DtmBlockType, subject?: string | null): number {
    switch (blockType) {
        case 'MANDATORY_LANGUAGE':
        case 'MANDATORY_MATH':
        case 'MANDATORY_HISTORY':
            return 1.1
        case 'SPECIALTY_1':
            return 3.1
        case 'SPECIALTY_2':
            return 2.1
        default:
            return isMandatoryDtmSubject(subject) ? 1.1 : 3.1
    }
}

function getWeightedCorrectRatio(result: AnswerEvaluation): number {
    if ((result.totalSubs || 0) > 0) {
        return Math.max(0, Math.min(1, (result.correctSubCount || 0) / (result.totalSubs || 1)))
    }
    return result.isCorrect ? 1 : 0
}

export function scoreRegularAttempt(params: {
    correctCount: number
    totalCount: number
    currentAbility: number
}): RegularScoreResult {
    const { correctCount, totalCount, currentAbility } = params
    const rawScore = roundScore(correctCount)
    const scoreMax = Math.max(totalCount, 0)
    const scorePercent = scoreMax > 0 ? roundScore((rawScore / scoreMax) * 100) : 0
    return {
        scorePercent,
        rawScore,
        scoreMax,
        grade: null,
        ability: currentAbility,
    }
}

export function scoreDtmBlockAttempt(params: {
    questions: ScoreableQuestion[]
    results: AnswerEvaluation[]
    fallbackSubject?: string | null
    currentAbility: number
}): DtmScoreResult {
    const { questions, results, fallbackSubject, currentAbility } = params
    const breakdownMap = new Map<DtmBlockType, DtmBreakdownItem>()
    let rawScore = 0
    let scoreMax = 0
    let answered = 0

    results.forEach((result, index) => {
        const question = questions[index]
        const blockType = normalizeDtmBlockType(question?.blockType)
        const coefficient = question?.coefficient ?? getDefaultDtmCoefficient(blockType, fallbackSubject)
        const weight = Number.isFinite(coefficient) && coefficient > 0 ? coefficient : getDefaultDtmCoefficient(blockType, fallbackSubject)
        const ratio = getWeightedCorrectRatio(result)
        const isAnswered = (result.totalSubs || 0) > 0 || result.isCorrect || ratio > 0

        rawScore += weight * ratio
        scoreMax += weight
        if (isAnswered) answered += 1

        const current = breakdownMap.get(blockType) || {
            blockType,
            label: getDtmBlockLabel(blockType),
            score: 0,
            max: 0,
            answered: 0,
            correct: 0,
        }
        current.score = roundScore(current.score + weight * ratio)
        current.max = roundScore(current.max + weight)
        current.answered += isAnswered ? 1 : 0
        current.correct += ratio >= 1 ? 1 : 0
        breakdownMap.set(blockType, current)
    })

    const scorePercent = scoreMax > 0 ? roundScore((rawScore / scoreMax) * 100) : 0

    return {
        scorePercent,
        rawScore: roundScore(rawScore),
        scoreMax: roundScore(scoreMax),
        grade: null,
        ability: currentAbility,
        breakdown: Array.from(breakdownMap.values()).filter(item => item.max > 0),
    }
}

export function scoreMilliySertifikatAttempt(params: {
    raschItems: Array<{ difficulty: number; isCorrect: boolean }>
    canUpdateAbility: boolean
    currentAbility: number
}): MilliySertifikatScoreResult {
    const { raschItems, canUpdateAbility, currentAbility } = params

    if (raschItems.length === 0) {
        return {
            scorePercent: 0,
            rawScore: 0,
            scoreMax: 75,
            grade: getMsGrade(0),
            ability: currentAbility,
        }
    }

    const correctCount = raschItems.filter(item => item.isCorrect).length
    let ability = currentAbility

    if (canUpdateAbility) {
        if (correctCount === 0) {
            ability = -5
        } else if (correctCount === raschItems.length) {
            ability = 5
        } else {
            ability = updateAbility(currentAbility, raschItems)
        }
    }

    const expectedRatio = raschItems.reduce((sum, item) => sum + raschProbability(ability, item.difficulty), 0) / raschItems.length
    const rawScore = roundScore(expectedRatio * 75)
    const scorePercent = roundScore((rawScore / 75) * 100)

    return {
        scorePercent,
        rawScore,
        scoreMax: 75,
        grade: getMsGrade(rawScore),
        ability,
    }
}
