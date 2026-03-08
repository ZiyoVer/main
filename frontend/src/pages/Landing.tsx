import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    BrainCircuit, ArrowRight, ChevronDown, ChevronUp,
    MessageSquare, Target, BarChart3, FileText, Zap, BookOpen
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

const FAQ_ITEMS = [
    {
        q: "DTMMax nima?",
        a: "DTMMax — DTM va Milliy Sertifikat imtihonlariga tayyorlaydigan bepul AI platforma. Shaxsiy ustoz, testlar va natija kuzatuvi birin-ketin bitta joyda."
    },
    {
        q: "Haqiqatan bepulmi?",
        a: "Ha, 100% bepul. Hech qanday obuna, to'lov yoki reklama yo'q. Barcha funksiyalar ochiq."
    },
    {
        q: "Qaysi fanlardan tayyorlanish mumkin?",
        a: "Matematika, Fizika, Kimyo, Biologiya, Ona tili va adabiyoti, Ingliz tili, Tarix, Geografiya — DTM da beriladigan barcha fanlar."
    },
    {
        q: "AI qanday o'qitadi?",
        a: "Savolingizga javob beradi, test tuzadi, flashcard (eslab qolish kartochkasi) beradi, xatolaringizni tushuntiradi. Fayllar yuklasangiz — rasm, PDF — darhol tahlil qiladi."
    },
    {
        q: "Test natijalarim saqlanadimi?",
        a: "Ha. Barcha test natijalari, ball tarixi va zaif mavzularingiz profilingizda saqlanadi."
    },
    {
        q: "Telefonda ishlaydi mi?",
        a: "Ha, to'liq ishlaydi. Telefon va kompyuterning ikkalasida ham qulay."
    },
    {
        q: "O'qituvchi sifatida qanday foydalanaman?",
        a: "Admin bilan bog'laning — o'qituvchi akkaunt ochiladi. So'ng test yaratasiz va o'quvchilarga havola orqali ulashingiz mumkin."
    },
    {
        q: "Ma'lumotlarim xavfsizmi?",
        a: "Ha. Faqat email va o'quv natijalaringiz saqlanadi. Shaxsiy ma'lumotlaringiz uchinchi tomonga berilmaydi."
    }
]

const FEATURES = [
    {
        icon: MessageSquare,
        title: "AI Ustoz",
        desc: "24/7 shaxsiy o'qituvchi. Har bir savolga batafsil, misollar bilan javob beradi.",
        color: "#6366F1"
    },
    {
        icon: Target,
        title: "Testlar",
        desc: "DTM format bo'yicha 15-30 ta savollik mashqlar. To'g'ri javob tushuntiriladi.",
        color: "#D97706"
    },
    {
        icon: Zap,
        title: "Kartochkalar",
        desc: "Formulalar va tushunchalarni eslab qolish uchun AI yaratadigan kartochkalar.",
        color: "#16A34A"
    },
    {
        icon: FileText,
        title: "Fayl tahlili",
        desc: "Rasm, PDF yoki Word faylni yuklang — AI darhol o'qib tahlil qiladi.",
        color: "#DC2626"
    },
    {
        icon: BarChart3,
        title: "Natija kuzatuv",
        desc: "Har bir testdan keyin zaif mavzularingiz aniqlanadi va statistika yangilanadi.",
        color: "#7C3AED"
    },
    {
        icon: BookOpen,
        title: "8 ta fan",
        desc: "Matematika, Fizika, Kimyo, Biologiya, Ona tili, Ingliz tili, Tarix, Geografiya.",
        color: "#0891B2"
    }
]

const TESTIMONIALS = [
    {
        name: "Sarvar T.",
        role: "11-sinf · Matematika",
        text: "Integrallarni darslikdan tushunmay yurardim. GPT ga yozsam inglizcha javob beradi. Bu yerda o'zbekcha, misollar bilan, savolimni boshqa so'z bilan so'rasam ham charchamay tushuntirdi. DTM 87 ball.",
        stars: 5,
        subject: "Matematika"
    },
    {
        name: "Dilnoza A.",
        role: "Milliy Sertifikat · Ingliz tili",
        text: "Past perfect bilan simple past ni aralashtirib yuborardim. Har kuni kechqurun 20 daqiqa shu yerda mashq qildim. Sertifikatda B2 chiqdi — o'zim ham kutmagan edim rostini aytganda.",
        stars: 5,
        subject: "Ingliz tili"
    },
    {
        name: "Jasur M.",
        role: "11-sinf · Tarix",
        text: "Sanalarni yod olish qiyin edi. Shu yerda voqealar bog'lanib, sabab-oqibat tushuntiriladi — eslab qolish osonlashadi. Ba'zan javob biroz kechikadi lekin noto'g'ri deyilmaydi.",
        stars: 4,
        subject: "Tarix"
    },
    {
        name: "Mohira K.",
        role: "DTM 2025 · Kimyo",
        text: "Kimyo formulalari aqlimni aylantirdi. Darslik rasmini yubordim, AI darhol tushuntirdi. Repetitorga pulim yetmaydi, shu platforma o'sha bo'shliqni to'ldirdi.",
        stars: 5,
        subject: "Kimyo"
    },
    {
        name: "Bobur N.",
        role: "11-sinf · Fizika",
        text: "Masala yechib tushunmay qolsam, faqat javobni emas, yechish yo'lini so'rayman. Har qadamni tushuntiradi. Bepul ekan deb sifati past deb o'ylagandim — yanglishibman.",
        stars: 4,
        subject: "Fizika"
    },
    {
        name: "Zulfiya R.",
        role: "Milliy Sertifikat · Ona tili",
        text: "Imlo va tinish belgilarida katta muammom bor edi. Test yechsam, har xatoni nima uchun xato ekanligi tushuntiriladi. Ikki oyda o'zim farqni sezdim, o'qituvchim ham payqadi.",
        stars: 5,
        subject: "Ona tili"
    },
]

function TestimonialsCarousel() {
    const [idx, setIdx] = useState(0)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const pausedRef = useRef(false)
    const total = TESTIMONIALS.length

    useEffect(() => {
        timerRef.current = setInterval(() => {
            if (!pausedRef.current) setIdx(i => (i + 1) % total)
        }, 3500)
        return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [])

    const visible = [
        TESTIMONIALS[idx % total],
        TESTIMONIALS[(idx + 1) % total],
        TESTIMONIALS[(idx + 2) % total],
    ]

    return (
        <div
            className="grid sm:grid-cols-3 gap-4"
            onMouseEnter={() => { pausedRef.current = true }}
            onMouseLeave={() => { pausedRef.current = false }}
        >
            {visible.map((t, i) => (
                <div key={`${idx}-${i}`} className="card p-5" style={{ animation: 'fadeIn 0.5s ease' }}>
                    <div className="flex gap-0.5 mb-3">
                        {Array(5).fill(0).map((_, j) => (
                            <span key={j} style={{ color: j < t.stars ? '#f59e0b' : 'var(--border)', fontSize: '14px' }}>★</span>
                        ))}
                    </div>
                    <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>"{t.text}"</p>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold">{t.name}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.role}</p>
                        </div>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--brand-light)', color: 'var(--brand-hover)' }}>{t.subject}</span>
                    </div>
                </div>
            ))}
        </div>
    )
}

// Scroll reveal — element viewport ga kirganda smooth ko'rinadi
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
    const ref = useRef<HTMLDivElement>(null)
    const [visible, setVisible] = useState(false)
    useEffect(() => {
        const el = ref.current; if (!el) return
        const obs = new IntersectionObserver(
            ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
            { threshold: 0.08 }
        )
        obs.observe(el)
        return () => obs.disconnect()
    }, [])
    return (
        <div ref={ref} className={className} style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(22px)',
            transition: `opacity 0.55s ease ${delay}s, transform 0.55s ease ${delay}s`
        }}>
            {children}
        </div>
    )
}

function FAQItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false)
    return (
        <div className="faq-item">
            <button
                className="faq-question"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
            >
                <span>{q}</span>
                {open
                    ? <ChevronUp className="h-4 w-4 flex-shrink-0 text-brand" />
                    : <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                }
            </button>
            <div className={`faq-answer ${open ? 'open' : ''}`}>
                <p>{a}</p>
            </div>
        </div>
    )
}

export default function Landing() {
    const nav = useNavigate()
    const { token, user } = useAuthStore()
    const [publicStats, setPublicStats] = useState<{ totalStudents: number; totalPublicTests: number } | null>(null)

    useEffect(() => {
        const load = () => fetch('/api/analytics/public-stats').then(r => r.json()).then(d => setPublicStats(d)).catch(() => {})
        load()
        const timer = setInterval(load, 30000) // har 30 soniyada yangilash
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        if (token && user) {
            if (user.role === 'ADMIN') nav('/boshqaruv', { replace: true })
            else if (user.role === 'TEACHER') nav('/oqituvchi', { replace: true })
            else nav('/suhbat', { replace: true })
        }
    }, [token, user])

    return (
        <div className="h-[100dvh] overflow-y-auto flex flex-col w-full" style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}>

            {/* ── Nav ─────────────────────────────────────────────── */}
            <nav className="sticky top-0 z-50" style={{ borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--bg-page) 90%, transparent)', backdropFilter: 'blur(12px)' }}>
                <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand)' }}>
                            <BrainCircuit className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-bold text-base tracking-tight">DTMMax</span>
                    </div>

                    {/* Nav links */}
                    <div className="flex items-center gap-1">
                        <Link
                            to="/kirish"
                            className="btn btn-ghost btn-sm"
                        >
                            Kirish
                        </Link>
                        <Link
                            to="/royxat"
                            className="btn btn-sm"
                            style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}
                        >
                            Boshlash <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ── Hero ────────────────────────────────────────────── */}
            <section className="relative py-24 px-5">
                {/* Subtle gradient decoration */}
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background: 'radial-gradient(ellipse 60% 50% at 50% -20%, color-mix(in srgb, var(--brand) 10%, transparent), transparent)'
                    }}
                />

                <div className="max-w-3xl mx-auto text-center relative">

                    <div
                        className="inline-flex items-center gap-2 mb-6 px-3.5 py-1.5 rounded-full text-sm font-medium anim-up"
                        style={{ background: 'var(--brand-light)', color: 'var(--brand-hover)', border: '1px solid var(--brand-muted)' }}
                    >
                        <Zap className="h-3.5 w-3.5" />
                        Milliy Sertifikat va DTM uchun — bepul
                    </div>

                    <h1
                        className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-tight mb-6 anim-up d1"
                    >
                        DTM ga aqlli{' '}
                        <span style={{ color: 'var(--brand)' }}>tayyorlanish</span>
                    </h1>

                    <p
                        className="text-lg leading-relaxed mb-10 max-w-xl mx-auto anim-up d2"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        Shaxsiy AI ustoz, adaptiv testlar va natija kuzatuvi — hammasi bepul, bitta joyda.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 anim-up d3">
                        <Link
                            to="/royxat"
                            className="btn btn-lg"
                            style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)', gap: '0.5rem' }}
                        >
                            Bepul boshlash
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link
                            to="/kirish"
                            className="btn btn-lg btn-outline"
                        >
                            Kirish
                        </Link>
                    </div>
                    {publicStats && publicStats.totalStudents > 0 && (
                        <div className="flex items-center justify-center gap-6 mt-6 anim-up" style={{ animationDelay: '0.4s' }}>
                            <div className="text-center">
                                <div className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                                    {publicStats.totalStudents.toLocaleString()}+
                                </div>
                                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>ro'yxatdan o'tgan</div>
                            </div>
                            <div className="w-px h-8" style={{ background: 'var(--border)' }} />
                            <div className="text-center">
                                <div className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                                    {publicStats.totalPublicTests}+
                                </div>
                                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>public test</div>
                            </div>
                            <div className="w-px h-8" style={{ background: 'var(--border)' }} />
                            <div className="text-center">
                                <div className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>8</div>
                                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>fan</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Testimonials — chat demo o'rnida */}
                <div className="max-w-5xl mx-auto mt-16 anim-up d4">
                    <p className="text-center text-xs font-semibold uppercase mb-6" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>O'quvchilar nima deydi</p>
                    <TestimonialsCarousel />
                </div>
            </section>

            {/* ── Steps ───────────────────────────────────────────── */}
            <section className="py-20 px-5">
                <div className="max-w-5xl mx-auto">
                    <Reveal className="text-center mb-12">
                        <p className="section-label mb-2">Qanday ishlaydi</p>
                        <h2 className="text-3xl font-extrabold tracking-tight">3 qadam, shu tamom</h2>
                    </Reveal>
                    <div className="grid sm:grid-cols-3 gap-6">
                        {[
                            { step: '01', title: "Fan tanlang", desc: "Qaysi fandan DTM topshirishingizni, imtihon sanasini va maqsad ballingizni kiriting." },
                            { step: '02', title: "AI bilan o'qing", desc: "Savoling bo'lsa yozing. AI mavzuni tushuntiradi, test beradi, xatoni ko'rsatadi." },
                            { step: '03', title: "Natijani ko'ring", desc: "Har bir testdan keyin zaif joylaringiz aniqlanadi va statistika yangilanadi." },
                        ].map((item, i) => (
                            <Reveal key={i} delay={i * 0.1}>
                                <div className="card card-hover" style={{ position: 'relative', overflow: 'hidden', height: '100%' }}>
                                    <span className="absolute top-3 right-4 font-black select-none"
                                        style={{ fontSize: '4.5rem', lineHeight: 1, color: 'var(--border)', userSelect: 'none' }}>
                                        {item.step}
                                    </span>
                                    <div className="relative">
                                        <h3 className="font-bold text-base mb-2">{item.title}</h3>
                                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.desc}</p>
                                    </div>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Features ────────────────────────────────────────── */}
            <section className="py-20 px-5" style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                <div className="max-w-5xl mx-auto">
                    <Reveal className="text-center mb-12">
                        <p className="section-label mb-2">Imkoniyatlar</p>
                        <h2 className="text-3xl font-extrabold tracking-tight">
                            Tayyorgarlik uchun kerak bo'lgan hamma narsa
                        </h2>
                    </Reveal>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {FEATURES.map((f, i) => (
                            <Reveal key={i} delay={i * 0.07}>
                                <div className="card card-hover" style={{ height: '100%' }}>
                                    <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-4"
                                        style={{ background: `${f.color}18` }}>
                                        <f.icon className="h-5 w-5" style={{ color: f.color }} />
                                    </div>
                                    <h3 className="font-bold text-base mb-1.5">{f.title}</h3>
                                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FAQ ─────────────────────────────────────────────── */}
            <section className="py-20 px-5">
                <div className="max-w-2xl mx-auto">
                    <Reveal className="text-center mb-12">
                        <p className="section-label mb-2">Savollar</p>
                        <h2 className="text-3xl font-extrabold tracking-tight">Tez-tez so'raladigan savollar</h2>
                    </Reveal>
                    <Reveal delay={0.1}>
                        <div className="card" style={{ padding: '0 1.5rem' }}>
                            {FAQ_ITEMS.map((item, i) => (
                                <FAQItem key={i} q={item.q} a={item.a} />
                            ))}
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ── CTA ─────────────────────────────────────────────── */}
            <section className="py-20 px-5" style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
                <Reveal className="max-w-xl mx-auto text-center">
                    <h2 className="text-3xl font-extrabold tracking-tight mb-4">Tayyormisiz?</h2>
                    <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>
                        Bugun boshlang — bepul, hech qanday ro'yxatdan o'tish qarori kerak emas.
                    </p>
                    <Link
                        to="/royxat"
                        className="btn btn-lg"
                        style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}
                    >
                        Bepul boshlash <ArrowRight className="h-4 w-4" />
                    </Link>
                    <div className="flex items-center justify-center gap-4 mt-6 flex-wrap">
                        <a
                            href="https://t.me/+rUid8dzewCBkYTRi"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition"
                            style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                        >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 14.146l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.978.413z"/></svg>
                            Telegram kanal
                        </a>
                        <a
                            href="https://t.me/uzdatalabsupport"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition"
                            style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                        >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            Support
                        </a>
                    </div>
                </Reveal>
            </section>

            {/* ── Footer ──────────────────────────────────────────── */}
            <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                <div className="max-w-5xl mx-auto px-5 py-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ background: 'var(--brand)' }}>
                            <BrainCircuit className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className="font-bold text-sm">DTMMax</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>© 2026</span>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                        <a href="https://t.me/+rUid8dzewCBkYTRi" target="_blank" rel="noopener noreferrer"
                            className="text-xs hover:underline transition" style={{ color: 'var(--text-muted)' }}>
                            Telegram
                        </a>
                        <a href="https://t.me/uzdatalabsupport" target="_blank" rel="noopener noreferrer"
                            className="text-xs hover:underline transition" style={{ color: 'var(--text-muted)' }}>
                            Support
                        </a>
                        <Link
                            to="/shartlar"
                            className="text-xs hover:underline transition"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            Foydalanish shartlari
                        </Link>
                        <Link
                            to="/maxfiylik"
                            className="text-xs hover:underline transition"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            Maxfiylik siyosati
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    )
}
