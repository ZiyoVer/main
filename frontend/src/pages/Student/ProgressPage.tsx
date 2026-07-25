import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    BarChart2,
    Brain,
    Calendar,
    ClipboardList,
    Flame,
    TrendingUp,
    Trophy,
    Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import '../../styles/student-workspace.css'
import '../../styles/student-pages.css'

// ============================================================
// /progress — o'qish tahlili sahifasi (eski side overlay o'rniga
// to'liq sahifa). Faqat real backend: /progress/me,
// /tests/my-results, /flashcards/due, /profile. Soxta statistika yo'q.
// ============================================================

interface WeakTopicItem { subject?: string; topic: string; accuracy: number; total: number }
interface ProgressData {
    currentStreak?: number
    xp?: number
    avgScore?: number
    weakTopics?: WeakTopicItem[]
    weeklyActivity?: Array<{ day: string; count: number }>
}
interface Attempt {
    id: string
    testId: string
    score: number
    rawScore?: number | null
    scoreMax?: number | null
    grade?: string | null
    createdAt: string
    test?: { title: string; subject?: string }
}
interface StudentProfile {
    subject?: string
    subject2?: string
    examType?: 'DTM' | 'MS' | null
    examDate?: string
    targetScore?: number
}

type ProgressSection = 'general' | 'results' | 'weak'

function attemptLabel(a: Attempt) {
    if (typeof a.rawScore === 'number' && typeof a.scoreMax === 'number') {
        return `${a.rawScore}/${a.scoreMax}${a.grade ? ` · ${a.grade}` : ''}`
    }
    return `${Math.round(a.score)}%`
}

export default function ProgressPage() {
    const nav = useNavigate()
    const user = useAuthStore(state => state.user)
    const [section, setSection] = useState<ProgressSection>('general')

    const [progress, setProgress] = useState<ProgressData | null>(null)
    const [results, setResults] = useState<Attempt[]>([])
    const [profile, setProfile] = useState<StudentProfile | null>(null)
    const [cards, setCards] = useState({ reviewed: 0, total: 0 })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [actionBusy, setActionBusy] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const [progressData, resultsData, profileData, dueData] = await Promise.all([
                fetchApi('/progress/me', { silent: true }).catch(() => null),
                fetchApi('/tests/my-results', { silent: true }),
                fetchApi('/profile', { silent: true }).catch(() => null),
                fetchApi('/flashcards/due', { silent: true }).catch(() => null),
            ])
            setProgress(progressData && typeof progressData === 'object' && !Array.isArray(progressData) ? progressData : null)
            setResults(Array.isArray(resultsData) ? resultsData : [])
            setProfile(profileData && typeof profileData === 'object' ? profileData : null)
            const total = typeof dueData?.total === 'number' ? dueData.total : 0
            const due = typeof dueData?.dueCount === 'number' ? dueData.dueCount : 0
            setCards({ reviewed: Math.max(total - due, 0), total })
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Ma’lumotlarni yuklab bo‘lmadi')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { void load() }, [load])

    const weakTopics = useMemo(() => (progress?.weakTopics ?? []).slice(0, 6), [progress?.weakTopics])

    const examDaysLeft = useMemo(() => {
        if (!profile?.examDate) return null
        const d = Math.ceil((new Date(profile.examDate).getTime() - Date.now()) / 86400000)
        return Number.isFinite(d) && d >= 0 ? d : null
    }, [profile?.examDate])

    // Zaif mavzu → AI ustozda real mashq sessiyasi (pendingAnalysis mexanizmi)
    async function practiceWeakTopic(item: WeakTopicItem) {
        if (actionBusy) return
        setActionBusy(item.topic)
        try {
            const chat = await fetchApi('/chat/new', {
                method: 'POST',
                body: JSON.stringify({
                    title: `Mashq: ${item.topic}`.substring(0, 50),
                    subject: item.subject || profile?.subject || undefined,
                    forceNew: true,
                }),
            })
            nav(`/suhbat/${chat.id}`, {
                state: {
                    pendingAnalysis: {
                        displayText: `Mashq: ${item.topic}`,
                        prompt: `"${item.topic}" mavzusini avval qisqa tushuntir, keyin 10 ta savollik mashq testi tuz — bu mening zaif mavzum (aniqlik ${Math.round(item.accuracy)}%), oxirida xatolarimni tushuntir.`,
                    },
                },
            })
        } catch {
            toast.error('Suhbat ochilmadi — qayta urinib ko‘ring')
        } finally {
            setActionBusy(null)
        }
    }

    const stats = [
        { label: 'Ketma-ket kun', value: progress?.currentStreak ?? 0, icon: <Flame aria-hidden="true" /> },
        { label: 'XP', value: progress?.xp ?? 0, icon: <Zap aria-hidden="true" /> },
        { label: 'Yechilgan testlar', value: results.length, icon: <ClipboardList aria-hidden="true" /> },
        { label: 'O‘rtacha ball', value: `${Math.round(progress?.avgScore ?? 0)}%`, icon: <Trophy aria-hidden="true" /> },
        { label: 'Kartochkalar', value: `${cards.reviewed}/${cards.total}`, icon: <Brain aria-hidden="true" /> },
    ]

    const weekly = progress?.weeklyActivity ?? []
    const weeklyMax = Math.max(...weekly.map(d => d.count), 1)

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
                        <span>Progress</span>
                        <span aria-hidden="true">/</span>
                        <strong>{section === 'general' ? 'Umumiy' : section === 'results' ? 'Natijalar' : 'Zaif mavzular'}</strong>
                    </div>
                    <span className="spage__user">{user?.name || 'O‘quvchi'}</span>
                </div>
            </header>

            <main className="spage__main">
                <section className="spage__intro">
                    <div>
                        <span className="spage__eyebrow">PROGRESS</span>
                        <h1>Har hafta o‘sish ko‘rinadi</h1>
                        <p>Streak, natijalar va zaif mavzular — keyingi qadam doim shu yerdan.</p>
                    </div>
                    {examDaysLeft !== null && (
                        <div className="spage__summary" aria-label="Imtihongacha qolgan vaqt">
                            <div><strong>{examDaysLeft}</strong><span>kun qoldi</span></div>
                        </div>
                    )}
                </section>

                <nav className="spage__sections" aria-label="Progress bo‘limlari">
                    <button type="button" className={section === 'general' ? 'is-active' : ''}
                        aria-current={section === 'general' ? 'page' : undefined}
                        onClick={() => setSection('general')}>
                        <TrendingUp aria-hidden="true" />
                        <span><strong>Umumiy</strong><small>Streak va faollik</small></span>
                    </button>
                    <button type="button" className={section === 'results' ? 'is-active' : ''}
                        aria-current={section === 'results' ? 'page' : undefined}
                        onClick={() => setSection('results')}>
                        <Trophy aria-hidden="true" />
                        <span><strong>Natijalar</strong><small>So‘nggi testlar</small></span>
                        <em>{results.length}</em>
                    </button>
                    <button type="button" className={section === 'weak' ? 'is-active' : ''}
                        aria-current={section === 'weak' ? 'page' : undefined}
                        onClick={() => setSection('weak')}>
                        <AlertTriangle aria-hidden="true" />
                        <span><strong>Zaif mavzular</strong><small>Mashq kerak</small></span>
                        <em>{weakTopics.length}</em>
                    </button>
                </nav>

                {loading ? (
                    <div className="spage__loading" aria-label="Yuklanmoqda">
                        <div /><div /><div /><div />
                    </div>
                ) : error ? (
                    <div className="spage__empty" role="alert">
                        <strong>Ma’lumotlarni ochib bo‘lmadi</strong>
                        <span>{error}</span>
                        <button type="button" onClick={() => void load()}>Qayta urinish</button>
                    </div>
                ) : section === 'general' ? (
                    <>
                        {examDaysLeft !== null && (
                            <section className={`spage-countdown${examDaysLeft <= 14 ? ' is-urgent' : examDaysLeft <= 30 ? ' is-soon' : ''}`} aria-label="Imtihongacha qolgan vaqt">
                                <Calendar aria-hidden="true" />
                                <div>
                                    <span>Imtihongacha</span>
                                    <strong>{examDaysLeft} kun qoldi</strong>
                                </div>
                            </section>
                        )}
                        <section className="spage-stats" aria-label="Umumiy ko‘rsatkichlar">
                            {stats.map((s, i) => (
                                <div key={i} className="spage-stats__item">
                                    <div className="spage-stats__icon">{s.icon}</div>
                                    <strong>{s.value}</strong>
                                    <span>{s.label}</span>
                                </div>
                            ))}
                        </section>
                        {weekly.length > 0 && (
                            <section className="spage-panel" aria-label="Haftalik faollik">
                                <h2>Haftalik faollik</h2>
                                <div className="spage-week">
                                    {weekly.map((d, i) => (
                                        <div key={i} className="spage-week__day">
                                            <span className="spage-week__bar" style={{ height: `${Math.max((d.count / weeklyMax) * 72, d.count > 0 ? 8 : 3)}px`, background: d.count > 0 ? 'var(--brand)' : 'var(--bg-muted)' }} />
                                            <span className="spage-week__label">{d.day.slice(0, 2)}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </>
                ) : section === 'results' ? (
                    results.length > 0 ? (
                        <section className="spage-cardlist" aria-label="So‘nggi test natijalari">
                            {results.slice(0, 10).map(r => {
                                const percent = Math.round(r.score)
                                const good = percent >= 70
                                return (
                                    <div key={r.id} className="spage-result">
                                        <span className={`spage-result__mark${good ? ' is-good' : ''}`} aria-hidden="true">
                                            <Trophy />
                                        </span>
                                        <div className="spage-result__copy">
                                            <strong>{r.test?.title || 'Test'}</strong>
                                            <span>{new Date(r.createdAt).toLocaleDateString('uz-UZ')}{r.test?.subject ? ` · ${r.test.subject}` : ''}</span>
                                        </div>
                                        <span className={`spage-result__score${good ? ' is-good' : ''}`}>{attemptLabel(r)}</span>
                                    </div>
                                )
                            })}
                        </section>
                    ) : (
                        <div className="spage__empty spage__empty--inline">
                            <Trophy aria-hidden="true" />
                            <strong>Hali test natijalari yo‘q</strong>
                            <span>Birinchi testni yeching — natijalar shu yerda ko‘rinadi</span>
                            <button type="button" onClick={() => nav('/testlar')}>Testlar sahifasi</button>
                        </div>
                    )
                ) : (
                    weakTopics.length > 0 ? (
                        <section className="spage-cardlist" aria-label="Zaif mavzular ro‘yxati">
                            {weakTopics.map(item => (
                                <div key={item.topic} className="spage-weak">
                                    <span className="spage-weak__icon" aria-hidden="true"><AlertTriangle /></span>
                                    <div className="spage-weak__copy">
                                        <strong>{item.topic}</strong>
                                        <span>{item.subject ? `${item.subject} · ` : ''}{Math.round(item.accuracy)}% aniqlik · {item.total} ta javob</span>
                                    </div>
                                    <button type="button" className="spage-weak__action"
                                        disabled={actionBusy !== null}
                                        onClick={() => void practiceWeakTopic(item)}>
                                        {actionBusy === item.topic ? 'Ochilmoqda…' : 'Mashq'} <ArrowRight aria-hidden="true" />
                                    </button>
                                </div>
                            ))}
                        </section>
                    ) : (
                        <div className="spage__empty spage__empty--inline">
                            <BarChart2 aria-hidden="true" />
                            <strong>Zaif mavzular aniqlanmagan</strong>
                            <span>Bir necha test yeching — tizim zaif joylarni avtomatik topadi</span>
                            <button type="button" onClick={() => nav('/testlar')}>Test yechish</button>
                        </div>
                    )
                )}
            </main>
        </div>
    )
}
