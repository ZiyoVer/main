import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useState } from 'react'
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
    { value: 'dtm', label: 'DTM' },
    { value: 'subjects', label: 'Fanlar' },
    { value: 'mine', label: 'Mening testlarim' },
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
    const activeFilterCount = Number(subject !== 'all') + Number(format !== 'all')
    const [filtersOpen, setFiltersOpen] = useState(false)
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
                        type="search"
                        aria-label="Test yoki fan qidirish"
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
                <button
                    type="button"
                    className={`test-catalog-filter-toggle${filtersOpen ? ' is-open' : ''}`}
                    aria-expanded={filtersOpen}
                    aria-controls="test-catalog-filter-panel"
                    onClick={() => setFiltersOpen(current => !current)}
                >
                    <SlidersHorizontal aria-hidden="true" />
                    Filterlar
                    {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
                </button>
            </div>

            {filtersOpen && (
                <div id="test-catalog-filter-panel" className="test-catalog-filter-panel">
                    <div className="test-catalog-filter-fields">
                        <label className="test-catalog-select">
                            <span>Format</span>
                            <select value={format} onChange={event => onFormatChange(event.target.value as TestCatalogFormat)}>
                                <option value="all">Barcha formatlar</option>
                                <option value="REGULAR">Oddiy test</option>
                                <option value="DTM_BLOCK">DTM blok</option>
                                <option value="MILLIY_SERTIFIKAT">Milliy sertifikat</option>
                            </select>
                        </label>
                        <label className="test-catalog-select">
                            <span>Saralash</span>
                            <select value={sort} onChange={event => onSortChange(event.target.value as TestCatalogSort)}>
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
                </div>
            )}

            <div className="test-catalog-summary">
                <div>
                    <span>{resultCount} ta test</span>
                    <span>{counts.mine}/{counts.subjects} yechilgan</span>
                </div>
                {hasFilters && <button type="button" onClick={clearFilters}>Filtrlarni tozalash</button>}
            </div>
        </div>
    )
}
