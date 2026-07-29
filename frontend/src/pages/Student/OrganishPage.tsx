import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    ArrowLeft,
    ArrowRight,
    BookOpen,
    Brain,
    CheckCircle2,
    ChevronRight,
    Layers,
    RotateCcw,
} from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import MathText from '../../components/MathText'
import '../../styles/student-workspace.css'
import '../../styles/student-pages.css'

// ============================================================
// /organish — Flashcard takrorlash sahifasi (eski side overlay o'rniga
// to'liq sahifa). Ma'lumot faqat real backend: /flashcards/due,
// /flashcards, /flashcards/:id/review (SM-2), /progress/activity.
// ============================================================

interface Flashcard {
    id: string
    front: string
    back: string
    subject?: string
    nextReview?: string
    createdAt?: string
}

type OrganishSection = 'review' | 'all'

export default function OrganishPage() {
    const nav = useNavigate()
    const user = useAuthStore(state => state.user)
    const [section, setSection] = useState<OrganishSection>('review')

    const [dueCards, setDueCards] = useState<Flashcard[]>([])
    const [dueCount, setDueCount] = useState(0)
    const [total, setTotal] = useState(0)
    const [allCards, setAllCards] = useState<Flashcard[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // Takrorlash sessiyasi holati
    const [session, setSession] = useState<Flashcard[] | null>(null)
    const [sessionIdx, setSessionIdx] = useState(0)
    const [revealed, setRevealed] = useState(false)
    const [gradedCount, setGradedCount] = useState(0)

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const [dueData, cardsData] = await Promise.all([
                fetchApi('/flashcards/due', { silent: true }),
                fetchApi('/flashcards', { silent: true }),
            ])
            setDueCards(Array.isArray(dueData?.cards) ? dueData.cards : [])
            setDueCount(typeof dueData?.dueCount === 'number' ? dueData.dueCount : 0)
            setTotal(typeof dueData?.total === 'number' ? dueData.total : 0)
            setAllCards(Array.isArray(cardsData) ? cardsData : [])
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Kartochkalarni yuklab bo‘lmadi')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { void load() }, [load])

    const reviewed = Math.max(total - dueCount, 0)
    const reviewedPercent = total > 0 ? Math.round((reviewed / total) * 100) : 0

    const subjects = useMemo(() => {
        const set = new Set<string>()
        allCards.forEach(c => { if (c.subject) set.add(c.subject) })
        return [...set]
    }, [allCards])
    const [subjectFilter, setSubjectFilter] = useState('all')
    const visibleCards = subjectFilter === 'all' ? allCards : allCards.filter(c => c.subject === subjectFilter)

    function startSession() {
        if (dueCards.length === 0) return
        setSession(dueCards)
        setSessionIdx(0)
        setRevealed(false)
        setGradedCount(0)
    }

    async function grade(quality: 1 | 4) {
        if (!session) return
        const card = session[sessionIdx]
        if (card?.id) {
            fetchApi(`/flashcards/${card.id}/review`, { method: 'POST', body: JSON.stringify({ quality }) })
                .catch(() => { /* navbat buzilmasin — keyingi yuklashda real holat keladi */ })
        }
        // XP — chat paneldagi bilan bir xil real hisob
        fetchApi('/progress/activity', { method: 'POST', body: JSON.stringify({ xpGained: quality === 4 ? 5 : 3 }) })
            .catch(() => { })
        setGradedCount(c => c + 1)
        if (sessionIdx < session.length - 1) {
            setSessionIdx(i => i + 1)
            setRevealed(false)
        } else {
            setSession(null)
            // Navbat yangilansin — SM-2 keyingi muddatlarni qayta hisobladi
            void load()
        }
    }

    const currentCard = session ? session[sessionIdx] : null

    return (
        <div className="kelviq student-workspace spage">
            <header className="spage__topbar">
                <div className="spage__topbar-inner">
                    <button type="button" className="spage__back" onClick={() => nav('/bugun')} aria-label="Bugun sahifasiga qaytish">
                        <ArrowLeft aria-hidden="true" />
                    </button>
                    <button type="button" className="spage__brand" onClick={() => nav('/bugun')} aria-label="DTMMax bosh sahifasi">
                        <img src="/dtmmax-logo.png" alt="" aria-hidden="true" />
                        <span>DTMMax</span>
                    </button>
                    <div className="spage__topbar-context">
                        <span>O‘rganish</span>
                        <span aria-hidden="true">/</span>
                        <strong>{section === 'review' ? 'Takrorlash' : 'Kartochkalar'}</strong>
                    </div>
                    <span className="spage__user">{user?.name || 'O‘quvchi'}</span>
                </div>
            </header>

            <main className="spage__main">
                <section className="spage__intro">
                    <div>
                        <span className="spage__eyebrow">O‘RGANISH</span>
                        <h1>Xotira mustahkam, natija barqaror</h1>
                        <p>SM-2 takrorlash navbati: bugungi kartochkalarni tugating — bilim esdan chiqmasin.</p>
                    </div>
                    <div className="spage__summary" aria-label="Kartochkalar umumiy holati">
                        <div><strong>{dueCount}</strong><span>Navbatda</span></div>
                        <div><strong>{reviewedPercent}%</strong><span>O‘zlashtirildi</span></div>
                    </div>
                </section>

                <nav className="spage__sections" aria-label="O‘rganish bo‘limlari">
                    <button type="button" className={section === 'review' ? 'is-active' : ''}
                        aria-current={section === 'review' ? 'page' : undefined}
                        onClick={() => setSection('review')}>
                        <RotateCcw aria-hidden="true" />
                        <span><strong>Takrorlash</strong><small>Bugungi navbat</small></span>
                        <em>{dueCount}</em>
                    </button>
                    <button type="button" className={section === 'all' ? 'is-active' : ''}
                        aria-current={section === 'all' ? 'page' : undefined}
                        onClick={() => setSection('all')}>
                        <Layers aria-hidden="true" />
                        <span><strong>Kartochkalar</strong><small>Barcha yaratilganlar</small></span>
                        <em>{total}</em>
                    </button>
                </nav>

                {loading ? (
                    <div className="spage__loading" aria-label="Yuklanmoqda">
                        <div /><div /><div /><div />
                    </div>
                ) : error ? (
                    <div className="spage__empty" role="alert">
                        <strong>Kartochkalarni ochib bo‘lmadi</strong>
                        <span>{error}</span>
                        <button type="button" onClick={() => void load()}>Qayta urinish</button>
                    </div>
                ) : section === 'review' ? (
                    session && currentCard ? (
                        /* ---- Takrorlash sessiyasi ---- */
                        <section className="spage-review" aria-label="Kartochka takrorlash">
                            <div className="spage-review__meta">
                                <span>{sessionIdx + 1} / {session.length}</span>
                                <span>{gradedCount} ta baholandi</span>
                            </div>
                            <div className="spage-review__track" role="progressbar"
                                aria-label={`Takrorlash jarayoni: ${sessionIdx + 1}/${session.length}`}
                                aria-valuemin={0} aria-valuemax={session.length} aria-valuenow={sessionIdx + 1}>
                                <span style={{ width: `${((sessionIdx + 1) / session.length) * 100}%` }} />
                            </div>
                            <div className="spage-review__card">
                                <span className="spage-review__side">Savol</span>
                                <p className="spage-review__front"><MathText text={currentCard.front} /></p>
                                {revealed ? (
                                    <div className="spage-review__answer">
                                        <span className="spage-review__side spage-review__side--answer"><CheckCircle2 aria-hidden="true" /> Javob</span>
                                        <p><MathText text={currentCard.back} /></p>
                                    </div>
                                ) : (
                                    <button type="button" className="spage-review__reveal" onClick={() => setRevealed(true)}>
                                        Javobni ko‘rsatish <ChevronRight aria-hidden="true" />
                                    </button>
                                )}
                            </div>
                            {revealed && (
                                <div className="spage-review__grade">
                                    <button type="button" className="spage-review__again" onClick={() => void grade(1)}>
                                        Bilmadim
                                    </button>
                                    <button type="button" className="spage-review__knew" onClick={() => void grade(4)}>
                                        Bildim <ArrowRight aria-hidden="true" />
                                    </button>
                                </div>
                            )}
                        </section>
                    ) : (
                        /* ---- Navbat xulosasi ---- */
                        <section className="spage-panel" aria-label="Takrorlash navbati">
                            <div className="spage-panel__row">
                                <div>
                                    <h2>Kartochkalar progressi</h2>
                                    <p>{reviewed}/{total} o‘rganildi · bugun {dueCount} ta navbatda</p>
                                </div>
                                <span className="spage-panel__percent">{reviewedPercent}%</span>
                            </div>
                            <div className="spage-panel__track" role="progressbar"
                                aria-label={`Kartochkalar o‘zlashtirilishi: ${reviewedPercent}%`}
                                aria-valuemin={0} aria-valuemax={100} aria-valuenow={reviewedPercent}>
                                <span style={{ width: `${reviewedPercent}%` }} />
                            </div>
                            {dueCount > 0 ? (
                                <div className="spage-panel__cta">
                                    <div>
                                        <strong>{dueCount} ta kartochka takrorlash vaqti keldi</strong>
                                        <span>Xotirani mustahkamlash uchun bugun tugating</span>
                                    </div>
                                    <button type="button" className="spage-panel__action" onClick={startSession}>
                                        Boshlash <ArrowRight aria-hidden="true" />
                                    </button>
                                </div>
                            ) : (
                                <div className="spage__empty spage__empty--inline">
                                    <Brain aria-hidden="true" />
                                    <strong>Barcha kartochkalar takrorlandi</strong>
                                    <span>AI ustozda «kartochkalar» deb yozing — yangi kartochkalar tuziladi</span>
                                    <button type="button" onClick={() => nav('/suhbat')}>AI ustozga o‘tish</button>
                                </div>
                            )}
                        </section>
                    )
                ) : (
                    /* ---- Barcha kartochkalar ---- */
                    <section className="spage-panel" aria-label="Barcha kartochkalar">
                        {subjects.length > 1 && (
                            <div className="spage__filters" aria-label="Fan bo‘yicha filter">
                                {['all', ...subjects].map(item => (
                                    <button key={item} type="button"
                                        className={subjectFilter === item ? 'is-active' : ''}
                                        onClick={() => setSubjectFilter(item)}>
                                        {item === 'all' ? 'Barchasi' : item}
                                    </button>
                                ))}
                            </div>
                        )}
                        {visibleCards.length > 0 ? (
                            <div className="spage-cardlist">
                                {visibleCards.map(card => (
                                    <div key={card.id} className="spage-cardlist__row">
                                        <p className="spage-cardlist__front"><MathText text={card.front} /></p>
                                        <p className="spage-cardlist__back"><MathText text={card.back} /></p>
                                        {card.subject && <span className="spage-cardlist__subject"><BookOpen aria-hidden="true" /> {card.subject}</span>}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="spage__empty spage__empty--inline">
                                <Layers aria-hidden="true" />
                                <strong>Hali kartochkalar yo‘q</strong>
                                <span>AI ustoz mavzudan kartochka tuzib beradi — ular shu yerda saqlanadi</span>
                                <button type="button" onClick={() => nav('/suhbat')}>Kartochka tuzdirish</button>
                            </div>
                        )}
                    </section>
                )}
            </main>
        </div>
    )
}
