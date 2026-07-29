import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    ArrowLeft,
    ArrowRight,
    Award,
    BookOpenCheck,
    CheckCircle2,
    Clock3,
    FileCheck2,
    ListChecks,
    Search,
    SlidersHorizontal,
    Sparkles,
} from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { normalizeSubjectValue } from '@/constants'
import { useAuthStore } from '@/store/authStore'
import { useTestCatalog } from './chat/useTestCatalog'
import type { TestCatalogSort } from './chat/useTestCatalog'
import '../../styles/student-workspace.css'
import '../../styles/tests-page.css'

type TestSection = 'milliy' | 'subject' | 'dtm' | 'results'

interface PublicTest {
    id: string
    title: string
    description?: string | null
    shareLink: string
    subject?: string
    category?: string
    source?: string
    premium?: boolean
    testType?: string
    timeLimit?: number | null
    createdAt?: string
    _count?: { questions: number; attempts: number }
}

interface TestAttempt {
    id: string
    testId: string
    score: number
    rawScore?: number | null
    scoreMax?: number | null
    grade?: string | null
    createdAt: string
    test?: { title: string; subject?: string; subject2?: string; testType?: string }
}

interface StudentProfile {
    subject?: string | null
    subject2?: string | null
}

const SECTIONS: Array<{ value: TestSection; label: string; description: string; icon: typeof Award }> = [
    { value: 'milliy', label: 'Milliy sertifikat', description: '75 ballik sinovlar', icon: Award },
    { value: 'subject', label: 'Mavzuli testlar', description: 'Fan va mavzu bo‘yicha', icon: BookOpenCheck },
    { value: 'dtm', label: 'Blok testlar', description: 'To‘liq imtihon formati', icon: ListChecks },
    { value: 'results', label: 'Natijalarim', description: 'Urinishlar va sertifikatlar', icon: FileCheck2 },
]

function testTypeLabel(testType?: string) {
    if (testType === 'MILLIY_SERTIFIKAT') return '75 ballik'
    if (testType === 'DTM_BLOCK') return 'Blok test'
    return 'Mavzuli'
}

function sourceLabel(source?: string) {
    if (source === 'OFFICIAL') return 'Rasmiy manba'
    if (source === 'AI_PREDICTION') return 'AI bashorat'
    return 'DTMMax testi'
}

function attemptSummary(attempt?: TestAttempt) {
    if (!attempt) return null
    if (typeof attempt.rawScore === 'number' && typeof attempt.scoreMax === 'number') {
        return `${attempt.rawScore} / ${attempt.scoreMax}${attempt.grade ? ` · ${attempt.grade}` : ''}`
    }
    return `${Math.round(attempt.score)}%`
}

export default function TestsPage() {
    const nav = useNavigate()
    const user = useAuthStore(state => state.user)
    const [tests, setTests] = useState<PublicTest[]>([])
    const [results, setResults] = useState<TestAttempt[]>([])
    const [profile, setProfile] = useState<StudentProfile | null>(null)
    const [section, setSection] = useState<TestSection>('milliy')
    const [subject, setSubject] = useState('all')
    const [search, setSearch] = useState('')
    const [sort, setSort] = useState<TestCatalogSort>('recommended')
    const [filtersOpen, setFiltersOpen] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let active = true
        Promise.all([
            fetchApi('/tests/public', { silent: true }),
            fetchApi('/tests/my-results', { silent: true }),
            fetchApi('/profile', { silent: true }).catch(() => null),
        ])
            .then(([testData, resultData, profileData]) => {
                if (!active) return
                setTests(Array.isArray(testData) ? testData : [])
                setResults(Array.isArray(resultData) ? resultData : [])
                setProfile(profileData && typeof profileData === 'object' ? profileData : null)
                try {
                    const ids = (Array.isArray(testData) ? testData : []).map((test: PublicTest) => test.id)
                    localStorage.setItem(`dtmmax_seen_tests_${user?.id || 'guest'}`, JSON.stringify(ids))
                } catch {
                    // localStorage test katalogi uchun faqat yordamchi kesh.
                }
            })
            .catch((requestError: unknown) => {
                if (!active) return
                setError(requestError instanceof Error ? requestError.message : 'Testlarni yuklab bo‘lmadi')
            })
            .finally(() => {
                if (active) setLoading(false)
            })
        return () => { active = false }
    }, [user?.id])

    const latestResultByTest = useMemo(() => {
        const map = new Map<string, TestAttempt>()
        for (const result of results) {
            if (!map.has(result.testId)) map.set(result.testId, result)
        }
        return map
    }, [results])
    const completedIds = useMemo(() => new Set(latestResultByTest.keys()), [latestResultByTest])
    const catalogView = section === 'results' ? 'mine' : section === 'dtm' ? 'dtm' : 'subjects'
    const format = section === 'milliy'
        ? 'MILLIY_SERTIFIKAT'
        : section === 'subject'
            ? 'REGULAR'
            : section === 'dtm'
                ? 'DTM_BLOCK'
                : 'all'

    const {
        visibleTests,
        subjects,
        resultCount,
    } = useTestCatalog({
        tests,
        results,
        completedTestIds: completedIds,
        view: catalogView,
        subject,
        format,
        search,
        sort,
        primarySubject: profile?.subject,
        secondarySubject: profile?.subject2,
    })

    useEffect(() => {
        if (subject !== 'all' && !subjects.includes(subject)) setSubject('all')
    }, [section, subject, subjects])

    const sectionCounts = useMemo(() => ({
        milliy: tests.filter(test => test.testType === 'MILLIY_SERTIFIKAT').length,
        subject: tests.filter(test => !test.testType || test.testType === 'REGULAR').length,
        dtm: tests.filter(test => test.testType === 'DTM_BLOCK').length,
        results: completedIds.size,
    }), [completedIds.size, tests])

    const featuredTest = useMemo(() => {
        if (section === 'results') return null
        const primary = normalizeSubjectValue(profile?.subject)
        return visibleTests
            .filter(test => !completedIds.has(test.id))
            .slice()
            .sort((left, right) => {
                const leftPreferred = normalizeSubjectValue(left.subject) === primary ? 1 : 0
                const rightPreferred = normalizeSubjectValue(right.subject) === primary ? 1 : 0
                return rightPreferred - leftPreferred
                    || (right._count?.attempts ?? 0) - (left._count?.attempts ?? 0)
            })[0] ?? null
    }, [completedIds, profile?.subject, section, visibleTests])

    const listTests = featuredTest
        ? visibleTests.filter(test => test.id !== featuredTest.id)
        : visibleTests

    function openTest(test: PublicTest) {
        nav(`/test/${test.shareLink}`)
    }

    function changeSection(next: TestSection) {
        setSection(next)
        setSubject('all')
        setSearch('')
    }

    const activeSection = SECTIONS.find(item => item.value === section) || SECTIONS[0]

    return (
        <div className="kelviq student-workspace tests-page">
            <header className="tests-page__topbar">
                <div className="tests-page__topbar-inner">
                    <button type="button" className="tests-page__back" onClick={() => nav('/bugun')} aria-label="Bugun sahifasiga qaytish">
                        <ArrowLeft aria-hidden="true" />
                    </button>
                    <button type="button" className="tests-page__brand" onClick={() => nav('/bugun')} aria-label="DTMMax bosh sahifasi">
                        <img src="/dtmmax-logo.png" alt="" aria-hidden="true" />
                        <span>DTMMax</span>
                    </button>
                    <div className="tests-page__topbar-context">
                        <span>Test markazi</span>
                        <span aria-hidden="true">/</span>
                        <strong>{activeSection.label}</strong>
                    </div>
                    <span className="tests-page__user">{user?.name || 'O‘quvchi'}</span>
                </div>
            </header>

            <main className="tests-page__main">
                <section className="tests-page__intro">
                    <div>
                        <span className="tests-page__eyebrow">TEST MARKAZI</span>
                        <h1>Imtihon uchun tartibli mashq</h1>
                        <p>Kerakli formatni tanlang, natijani ko‘ring va keyingi mashqni shu yerdan davom ettiring.</p>
                    </div>
                    <div className="tests-page__summary" aria-label="Testlar umumiy holati">
                        <div><strong>{tests.length}</strong><span>Mavjud test</span></div>
                        <div><strong>{completedIds.size}</strong><span>Yakunlangan</span></div>
                    </div>
                </section>

                <nav className="tests-page__sections" aria-label="Test bo‘limlari">
                    {SECTIONS.map(item => {
                        const Icon = item.icon
                        return (
                            <button
                                key={item.value}
                                type="button"
                                className={section === item.value ? 'is-active' : ''}
                                aria-current={section === item.value ? 'page' : undefined}
                                onClick={() => changeSection(item.value)}
                            >
                                <Icon aria-hidden="true" />
                                <span><strong>{item.label}</strong><small>{item.description}</small></span>
                                <em>{sectionCounts[item.value]}</em>
                            </button>
                        )
                    })}
                </nav>

                {loading ? (
                    <div className="tests-page__loading" aria-label="Testlar yuklanmoqda">
                        <div /><div /><div /><div />
                    </div>
                ) : error ? (
                    <div className="tests-page__empty" role="alert">
                        <strong>Testlarni ochib bo‘lmadi</strong>
                        <span>{error}</span>
                        <button type="button" onClick={() => window.location.reload()}>Qayta urinish</button>
                    </div>
                ) : (
                    <>
                        {featuredTest && (
                            <section className="tests-page__featured" aria-label="Sizga mos test">
                                <div className="tests-page__featured-mark">
                                    <Sparkles aria-hidden="true" />
                                    <span>Sizga mos</span>
                                </div>
                                <div className="tests-page__featured-copy">
                                    <span>{featuredTest.subject || 'Umumiy'} · {testTypeLabel(featuredTest.testType)}</span>
                                    <h2>{featuredTest.title}</h2>
                                    <p>{featuredTest.description || 'Bilimingizni real test oqimida tekshiring va natijadan keyingi mavzuni aniqlang.'}</p>
                                </div>
                                <div className="tests-page__featured-meta">
                                    <span><ListChecks aria-hidden="true" /> {featuredTest._count?.questions ?? 0} savol</span>
                                    <span><Clock3 aria-hidden="true" /> {featuredTest.timeLimit ? `${featuredTest.timeLimit} daqiqa` : 'Vaqtsiz'}</span>
                                </div>
                                <button type="button" className="tests-page__featured-action" onClick={() => openTest(featuredTest)}>
                                    Boshlash <ArrowRight aria-hidden="true" />
                                </button>
                            </section>
                        )}

                        <section className="tests-page__catalog">
                            <div className="tests-page__catalog-head">
                                <div>
                                    <span>{activeSection.description}</span>
                                    <h2>{activeSection.label}</h2>
                                </div>
                                <div className="tests-page__tools">
                                    <label className="tests-page__search">
                                        <Search aria-hidden="true" />
                                        <input
                                            type="search"
                                            value={search}
                                            onChange={event => setSearch(event.target.value)}
                                            placeholder="Test yoki fan qidirish"
                                            aria-label="Test yoki fan qidirish"
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        className={filtersOpen ? 'tests-page__filter is-active' : 'tests-page__filter'}
                                        onClick={() => setFiltersOpen(value => !value)}
                                        aria-expanded={filtersOpen}
                                    >
                                        <SlidersHorizontal aria-hidden="true" /> Filter
                                    </button>
                                </div>
                            </div>

                            {filtersOpen && (
                                <div className="tests-page__filters">
                                    <div className="tests-page__subjects" aria-label="Fan bo‘yicha filter">
                                        {['all', ...subjects].map(item => (
                                            <button
                                                key={item}
                                                type="button"
                                                className={subject === item ? 'is-active' : ''}
                                                onClick={() => setSubject(item)}
                                            >
                                                {item === 'all' ? 'Barcha fanlar' : item}
                                            </button>
                                        ))}
                                    </div>
                                    <label>
                                        <span>Saralash</span>
                                        <select value={sort} onChange={event => setSort(event.target.value as TestCatalogSort)}>
                                            <option value="recommended">Eng mos</option>
                                            <option value="popular">Mashhur</option>
                                            <option value="new">Yangi</option>
                                        </select>
                                    </label>
                                </div>
                            )}

                            <div className="tests-page__catalog-meta">
                                <span>{resultCount} ta test</span>
                                {(search || subject !== 'all') && (
                                    <button type="button" onClick={() => { setSearch(''); setSubject('all') }}>Filtrni tozalash</button>
                                )}
                            </div>

                            {listTests.length > 0 ? (
                                <div className="tests-page__list">
                                    {listTests.map(test => {
                                        const result = latestResultByTest.get(test.id)
                                        const done = Boolean(result)
                                        return (
                                            <button
                                                key={test.id}
                                                type="button"
                                                className={done ? 'tests-page__row is-completed' : 'tests-page__row'}
                                                onClick={() => openTest(test)}
                                            >
                                                <span className="tests-page__row-state" aria-hidden="true">
                                                    {done ? <CheckCircle2 /> : <BookOpenCheck />}
                                                </span>
                                                <span className="tests-page__row-copy">
                                                    <span>{test.subject || 'Umumiy'} · {sourceLabel(test.source)}</span>
                                                    <strong>{test.title}</strong>
                                                    <small>
                                                        {test._count?.questions ?? 0} savol
                                                        <i aria-hidden="true">·</i>
                                                        {test.timeLimit ? `${test.timeLimit} daqiqa` : 'Vaqtsiz'}
                                                        <i aria-hidden="true">·</i>
                                                        {testTypeLabel(test.testType)}
                                                        {test.premium && <em>Pro</em>}
                                                    </small>
                                                </span>
                                                <span className="tests-page__row-action">
                                                    {done && <b>{attemptSummary(result)}</b>}
                                                    <span>{done ? 'Natijani ko‘rish' : 'Boshlash'}</span>
                                                    <ArrowRight aria-hidden="true" />
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="tests-page__empty">
                                    <strong>Bu bo‘limda mos test topilmadi</strong>
                                    <span>Filtrlarni tozalang yoki boshqa test formatini tanlang.</span>
                                    <button type="button" onClick={() => { setSearch(''); setSubject('all'); changeSection('milliy') }}>
                                        Milliy sertifikat testlari
                                    </button>
                                </div>
                            )}
                        </section>
                    </>
                )}
            </main>
        </div>
    )
}
