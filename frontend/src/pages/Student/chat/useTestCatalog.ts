import { useMemo } from 'react'
import { normalizeSubjectValue } from '@/constants'

export type TestCatalogView = 'recommended' | 'all' | 'completed'
export type TestCatalogSort = 'recommended' | 'new' | 'popular'
export type TestCatalogFormat = 'all' | 'REGULAR' | 'DTM_BLOCK' | 'MILLIY_SERTIFIKAT'

export interface TestCatalogItem {
    id: string
    title: string
    subject?: string
    category?: string
    premium?: boolean
    testType?: string
    _count?: { questions: number; attempts: number }
}

interface TestCatalogResult {
    testId: string
}

interface UseTestCatalogOptions<T extends TestCatalogItem> {
    tests: T[]
    results: TestCatalogResult[]
    completedTestIds: ReadonlySet<string>
    view: TestCatalogView
    subject: string
    format: TestCatalogFormat
    search: string
    sort: TestCatalogSort
    primarySubject?: string | null
    secondarySubject?: string | null
}

export function useTestCatalog<T extends TestCatalogItem>({
    tests,
    results,
    completedTestIds,
    view,
    subject,
    format,
    search,
    sort,
    primarySubject,
    secondarySubject,
}: UseTestCatalogOptions<T>) {
    // completedTestIds Set ref ichida mutate qilinadi; key memo'ni shu o'zgarishda ham yangilaydi.
    const completedKey = Array.from(completedTestIds).sort().join('|')
    return useMemo(() => {
        const resultIds = new Set(results.map(result => result.testId))
        const isDone = (test: TestCatalogItem) => resultIds.has(test.id) || completedTestIds.has(test.id)
        const primary = normalizeSubjectValue(primarySubject)
        const secondary = normalizeSubjectValue(secondarySubject)
        const normalizedSearch = search.trim().toLowerCase()
        const originalIndex = new Map(tests.map((test, index) => [test.id, index]))

        const relevanceScore = (test: TestCatalogItem) => {
            const normalizedSubject = normalizeSubjectValue(test.subject)
            return (normalizedSubject === primary && primary ? 4 : 0)
                + (normalizedSubject === secondary && secondary ? 3 : 0)
                + Math.min(2, (test._count?.attempts ?? 0) / 10)
        }

        const matchesFilters = (test: TestCatalogItem) => {
            const testSubject = test.category || test.subject || 'Boshqa'
            if (subject !== 'all' && testSubject !== subject) return false
            const testFormat = test.testType || 'REGULAR'
            if (format !== 'all' && testFormat !== format) return false
            if (normalizedSearch && !`${test.title} ${test.subject || ''}`.toLowerCase().includes(normalizedSearch)) return false
            return true
        }

        const subjects = Array.from(new Set(tests.map(test => test.category || test.subject || 'Boshqa')))
            .sort((a, b) => {
                const rank = (value: string) => value === primary ? 0 : value === secondary ? 1 : 2
                const rankDiff = rank(a) - rank(b)
                return rankDiff || a.localeCompare(b, 'uz')
            })

        const unfinished = tests.filter(test => !isDone(test))
        const preferredUnfinished = unfinished.filter(test => {
            const normalizedSubject = normalizeSubjectValue(test.subject)
            return (!!primary && normalizedSubject === primary) || (!!secondary && normalizedSubject === secondary)
        })
        const recommendedPool = preferredUnfinished.length > 0 ? preferredUnfinished : unfinished
        const recommendedCount = recommendedPool.length
        const completedCount = tests.filter(isDone).length

        let base = view === 'completed'
            ? tests.filter(isDone)
            : view === 'recommended'
                ? recommendedPool
                : tests

        base = base.filter(matchesFilters)

        let visibleTests = base.slice().sort((a, b) => {
            const doneDiff = Number(isDone(a)) - Number(isDone(b))
            if (doneDiff !== 0 && view !== 'completed') return doneDiff
            if (sort === 'popular') return (b._count?.attempts ?? 0) - (a._count?.attempts ?? 0)
            if (sort === 'recommended') return relevanceScore(b) - relevanceScore(a)
            return (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0)
        })

        const recommendedTest = unfinished
            .filter(matchesFilters)
            .slice()
            .sort((a, b) => relevanceScore(b) - relevanceScore(a))[0] ?? null
        const resultCount = visibleTests.length

        // Tavsiya kartasi tepada alohida ko'rsatiladi; ro'yxatda uni ikkinchi marta takrorlamaymiz.
        if (view === 'recommended' && recommendedTest) {
            visibleTests = visibleTests.filter(test => test.id !== recommendedTest.id)
        }

        return {
            visibleTests,
            recommendedTest,
            subjects,
            resultCount,
            counts: {
                recommended: recommendedCount,
                all: tests.length,
                completed: completedCount,
            },
            isDone,
        }
    }, [tests, results, completedTestIds, completedKey, view, subject, format, search, sort, primarySubject, secondarySubject])
}
