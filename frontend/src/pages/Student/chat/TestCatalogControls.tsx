import { Search, SlidersHorizontal, X } from 'lucide-react'
import type { TestCatalogFormat, TestCatalogSort, TestCatalogView } from './useTestCatalog'

interface TestCatalogControlsProps {
    view: TestCatalogView
    onViewChange: (view: TestCatalogView) => void
    counts: Record<TestCatalogView, number>
    search: string
    onSearchChange: (value: string) => void
    subjects: string[]
    subject: string
    onSubjectChange: (value: string) => void
    format: TestCatalogFormat
    onFormatChange: (format: TestCatalogFormat) => void
    sort: TestCatalogSort
    onSortChange: (sort: TestCatalogSort) => void
    resultCount: number
}

const VIEWS: Array<{ value: TestCatalogView; label: string }> = [
    { value: 'recommended', label: 'Tavsiya' },
    { value: 'all', label: 'Barcha' },
    { value: 'completed', label: 'Yechilgan' },
]

export function TestCatalogControls({
    view,
    onViewChange,
    counts,
    search,
    onSearchChange,
    subjects,
    subject,
    onSubjectChange,
    format,
    onFormatChange,
    sort,
    onSortChange,
    resultCount,
}: TestCatalogControlsProps) {
    const hasFilters = !!search.trim() || subject !== 'all' || format !== 'all'
    const clearFilters = () => {
        onSearchChange('')
        onSubjectChange('all')
        onFormatChange('all')
    }

    return (
        <div className="test-catalog-controls">
            <div className="test-catalog-tabs" role="tablist" aria-label="Testlar ko‘rinishi">
                {VIEWS.map(item => (
                    <button
                        key={item.value}
                        type="button"
                        role="tab"
                        aria-selected={view === item.value}
                        className={view === item.value ? 'is-active' : ''}
                        onClick={() => onViewChange(item.value)}
                    >
                        {item.label}<span>{counts[item.value]}</span>
                    </button>
                ))}
            </div>

            <div className="test-catalog-toolbar">
                <label className="test-catalog-search">
                    <Search aria-hidden="true" />
                    <input
                        value={search}
                        onChange={event => onSearchChange(event.target.value)}
                        placeholder="Test yoki fan qidirish"
                    />
                    {search && (
                        <button type="button" onClick={() => onSearchChange('')} aria-label="Qidiruvni tozalash">
                            <X aria-hidden="true" />
                        </button>
                    )}
                </label>
                <label className="test-catalog-select">
                    <SlidersHorizontal aria-hidden="true" />
                    <select value={format} onChange={event => onFormatChange(event.target.value as TestCatalogFormat)} aria-label="Test formati">
                        <option value="all">Barcha format</option>
                        <option value="REGULAR">Oddiy</option>
                        <option value="DTM_BLOCK">DTM blok</option>
                        <option value="MILLIY_SERTIFIKAT">Milliy sertifikat</option>
                    </select>
                </label>
                <label className="test-catalog-select">
                    <select value={sort} onChange={event => onSortChange(event.target.value as TestCatalogSort)} aria-label="Testlarni saralash">
                        <option value="recommended">Eng mos</option>
                        <option value="new">Yangi</option>
                        <option value="popular">Mashhur</option>
                    </select>
                </label>
            </div>

            {subjects.length > 0 && (
                <div className="test-subject-filter" aria-label="Fan bo‘yicha filter">
                    <span>Fan</span>
                    <div>
                        {['all', ...subjects].map(item => (
                            <button
                                key={item}
                                type="button"
                                className={subject === item ? 'is-active' : ''}
                                aria-pressed={subject === item}
                                onClick={() => onSubjectChange(item)}
                            >
                                {item === 'all' ? 'Hammasi' : item}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="test-catalog-summary">
                <span>{resultCount} ta mos test</span>
                {hasFilters && <button type="button" onClick={clearFilters}>Filtrlarni tozalash</button>}
            </div>
        </div>
    )
}
