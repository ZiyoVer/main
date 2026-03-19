import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    ArrowRight,
    BarChart3,
    BookOpen,
    BrainCircuit,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    ClipboardCheck,
    FileText,
    GraduationCap,
    MessageSquare,
    ShieldCheck,
    Sparkles,
    Target,
    Users,
    Zap
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

const FAQ_ITEMS = [
    {
        q: "DTMMax nima?",
        a: "DTMMax — DTM va Milliy Sertifikat uchun AI yordamida tayyorlaydigan platforma. Unda savol-javob, test ishlash, natijani AI bilan tahlil qilish va progressni kuzatish bir joyda jamlangan."
    },
    {
        q: "Qaysi fanlardan foydalanish mumkin?",
        a: "Matematika, Fizika, Kimyo, Biologiya, Ona tili, Ingliz tili, Tarix va Geografiya fanlari bo'yicha ishlatiladi."
    },
    {
        q: "AI nima qiladi?",
        a: "AI mavzuni tushuntiradi, test tuzadi, testdagi xatolaringizni tahlil qiladi, zaif mavzularingizni ko'rsatadi va keyingi mashq uchun tavsiya beradi."
    },
    {
        q: "Material yuklash mumkinmi?",
        a: "Ha. Rasm, PDF yoki Word fayl yuklasangiz, AI materialni o'qib tushuntirish va tahlil qilishda ishlatadi."
    },
    {
        q: "O'qituvchi test ulasha oladimi?",
        a: "Ha. O'qituvchi test yaratadi va havola orqali o'quvchilarga yuboradi. O'quvchi linkni ochib ko'rishi mumkin, ishlash uchun esa kirish yoki ro'yxatdan o'tish kerak bo'ladi."
    },
    {
        q: "Natijalar saqlanadimi?",
        a: "Ha. Test natijalari, o'rtacha ko'rsatkich va ayrim zaif mavzular profilingizda saqlanadi."
    },
    {
        q: "Telefonda ishlaydimi?",
        a: "Ha. Platforma telefon va kompyuterda ishlashga moslashtirilgan."
    },
    {
        q: "Bepulmi?",
        a: "Ha. Hozirgi asosiy funksiyalar bepul taqdim etilgan."
    }
]

const VALUE_PROPS = [
    {
        icon: MessageSquare,
        title: "Savol bering",
        desc: "Mavzuni so'rang, AI sizga tushunarli qilib izohlaydi."
    },
    {
        icon: ClipboardCheck,
        title: "Test ishlang",
        desc: "DTM yoki Milliy Sertifikat uslubida mashq qiling."
    },
    {
        icon: Sparkles,
        title: "AI tahlilini oling",
        desc: "Xatolar, zaif joylar va keyingi qadamlar avtomatik chiqadi."
    }
]

const FEATURES = [
    {
        icon: BrainCircuit,
        title: "AI ustoz",
        desc: "Savol-javob, tushuntirish va mashq bir oqimda ishlaydi.",
        color: "#6366F1"
    },
    {
        icon: Target,
        title: "Test platforma",
        desc: "DTM va Milliy Sertifikat uchun testlar ishlanadi va tekshiriladi.",
        color: "#D97706"
    },
    {
        icon: FileText,
        title: "Material bilan ishlash",
        desc: "Kitob, rasm yoki fayldan ham foydalanib tayyorlanish mumkin.",
        color: "#DC2626"
    },
    {
        icon: BarChart3,
        title: "Natija kuzatuvi",
        desc: "O'rtacha ko'rsatkich, urinishlar va zaif mavzular ko'rinadi.",
        color: "#7C3AED"
    },
    {
        icon: BookOpen,
        title: "Ishonchli baza",
        desc: "Fanlar bo'yicha yuklangan materiallar va model bilimi birga ishlaydi.",
        color: "#0891B2"
    },
    {
        icon: ShieldCheck,
        title: "Bir joyda",
        desc: "Chat, test, tahlil va profil bir tizim ichida boshqariladi.",
        color: "#16A34A"
    }
]

const AUDIENCES = [
    {
        icon: GraduationCap,
        title: "O'quvchi uchun",
        points: [
            "Qaysi fandan nimani boshlashni tez tushunadi",
            "Testdan keyin xatoni sabab bilan ko'radi",
            "AI bilan mustaqil tayyorlanish osonlashadi"
        ]
    },
    {
        icon: Users,
        title: "O'qituvchi uchun",
        points: [
            "Test yaratadi va link orqali ulashadi",
            "O'quvchilar natijasini ko'radi",
            "AI yordamida materialni tezroq testga aylantiradi"
        ]
    }
]

const TESTIMONIALS = [
    {
        name: "Sarvar T.",
        role: "11-sinf · DTM tayyorgarlik",
        text: "AI testlar tuzib beradi, xatolarimni darhol ko'rsatadi va qaysi mavzuda sust ekanimni aniq aytadi. Tayyorgarligim ancha tizimli bo'ldi.",
        stars: 5,
        subject: "Matematika"
    },
    {
        name: "Dilnoza A.",
        role: "Milliy Sertifikat · Ingliz tili",
        text: "Eng foydali tomoni — testdan keyin shunchaki ball emas, nima uchun xato qilganimni ham ko'rsatadi. Oddiy test platformadan foydaliroq.",
        stars: 5,
        subject: "Ingliz tili"
    },
    {
        name: "Jasur M.",
        role: "11-sinf · Tarix",
        text: "Platforma savol berish, test ishlash va natijani tahlil qilishni bir joyga yig'ib bergani uchun vaqt tejaydi.",
        stars: 5,
        subject: "Tarix"
    },
    {
        name: "Mohira K.",
        role: "11-sinf · DTM tayyorgarlik",
        text: "Qaysi mavzuni ko'proq ishlash kerakligini AI ko'rsatib beradi. Shu tomoni menga eng ko'p yordam berdi.",
        stars: 5,
        subject: "Kimyo"
    },
    {
        name: "Bobur N.",
        role: "11-sinf · Fizika",
        text: "Testdan keyingi tahlil sababli xatoni faqat yodlab emas, tushunib to'g'rilash osonlashdi.",
        stars: 4,
        subject: "Fizika"
    },
    {
        name: "Zulfiya R.",
        role: "Milliy Sertifikat · Ona tili",
        text: "Ko'proq mashq qilish va darhol izoh olish imkoniyati tayyorlanish jarayonini sezilarli yaxshiladi.",
        stars: 4,
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
    }, [total])

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
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold">{t.name}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.role}</p>
                        </div>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: 'var(--brand-light)', color: 'var(--brand-hover)' }}>{t.subject}</span>
                    </div>
                </div>
            ))}
        </div>
    )
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
    const ref = useRef<HTMLDivElement>(null)
    const [visible, setVisible] = useState(false)
    useEffect(() => {
        const el = ref.current
        if (!el) return
        const obs = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true)
                    obs.disconnect()
                }
            },
            { threshold: 0.08 }
        )
        obs.observe(el)
        return () => obs.disconnect()
    }, [])

    return (
        <div
            ref={ref}
            className={className}
            style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(22px)',
                transition: `opacity 0.55s ease ${delay}s, transform 0.55s ease ${delay}s`
            }}
        >
            {children}
        </div>
    )
}

function FAQItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false)
    return (
        <div className="faq-item">
            <button className="faq-question" onClick={() => setOpen(!open)} aria-expanded={open}>
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

function ProductPreview() {
    return (
        <div className="relative anim-up d3 max-w-[560px] ml-auto">
            <div className="rounded-[2.25rem] p-8 sm:p-10" style={{ background: 'color-mix(in srgb, var(--bg-card) 72%, transparent)', boxShadow: '0 30px 80px rgba(0,0,0,0.08)' }}>
                <div className="rounded-[2rem] p-6 sm:p-7" style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.5)', boxShadow: '0 18px 40px rgba(0,0,0,0.08)' }}>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand-light)' }}>
                            <BrainCircuit className="h-5 w-5" style={{ color: 'var(--brand)' }} />
                        </div>
                        <div>
                            <p className="text-base font-semibold">DTMMax AI Ustoz</p>
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Hozir onlayn</p>
                        </div>
                    </div>
                    <div className="space-y-5">
                        <div className="rounded-[1.25rem] px-5 py-4 text-sm sm:text-[15px] leading-relaxed" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
                            Salom! Bugun qaysi mavzuni tahlil qilamiz? Tarix yoki Matematika?
                        </div>

                        <div className="flex justify-end">
                            <div className="rounded-[1.25rem] px-5 py-4 text-sm sm:text-[15px] font-medium" style={{ background: 'color-mix(in srgb, var(--brand-light) 50%, white)', color: 'var(--brand-hover)' }}>
                                Tarix fanidan yangi testlar kerak.
                            </div>
                        </div>

                        <div className="pt-1">
                            <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                                <div className="h-full rounded-full" style={{ width: '67%', background: 'var(--brand)' }} />
                            </div>
                            <div className="flex items-center justify-between mt-3 text-sm">
                                <span style={{ color: 'var(--text-secondary)' }}>Kunlik maqsad</span>
                                <span style={{ color: 'var(--text-secondary)' }}>67% bajarildi</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function Landing() {
    const nav = useNavigate()
    const { token, user } = useAuthStore()
    const [publicStats, setPublicStats] = useState<{ totalStudents: number; totalPublicTests: number } | null>(null)

    useEffect(() => {
        const load = () => {
            if (document.visibilityState === 'hidden') return
            fetch('/api/analytics/public-stats')
                .then(r => r.json())
                .then(d => setPublicStats(d))
                .catch(() => { })
        }
        load()
        const timer = setInterval(load, 30000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        if (token && user) {
            if (user.role === 'ADMIN') nav('/boshqaruv', { replace: true })
            else if (user.role === 'TEACHER') nav('/oqituvchi', { replace: true })
            else nav('/suhbat', { replace: true })
        }
    }, [token, user, nav])

    return (
        <div className="h-[100dvh] overflow-y-auto flex flex-col w-full" style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
            <nav className="sticky top-0 z-50" style={{ borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--bg-page) 90%, transparent)', backdropFilter: 'blur(12px)' }}>
                <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between relative">
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand)' }}>
                            <BrainCircuit className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-bold text-base tracking-tight">DTMMax</span>
                    </div>

                    <div className="hidden lg:flex items-center gap-10 absolute left-1/2 -translate-x-1/2">
                        <a href="#imkoniyatlar" className="text-sm font-medium transition hover:opacity-70" style={{ color: 'var(--brand-hover)', borderBottom: '2px solid var(--brand)', paddingBottom: '0.35rem' }}>
                            Imkoniyatlar
                        </a>
                        <a href="#qanday-ishlaydi" className="text-sm font-medium transition hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
                            Qanday ishlaydi
                        </a>
                        <a href="#savollar" className="text-sm font-medium transition hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
                            Savollar
                        </a>
                        <Link to="/kirish" className="text-sm font-medium transition hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
                            Kirish
                        </Link>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link to="/royxat" className="hidden lg:inline-flex btn btn-sm" style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)', minWidth: '10rem' }}>
                            Boshlash
                        </Link>
                        <div className="flex items-center gap-1 lg:hidden">
                            <Link to="/kirish" className="btn btn-ghost btn-sm">
                                Kirish
                            </Link>
                            <Link to="/royxat" className="btn btn-sm" style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}>
                                Boshlash <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            <section className="relative py-16 sm:py-24 px-5">
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background: 'radial-gradient(ellipse 60% 50% at 50% -20%, color-mix(in srgb, var(--brand) 10%, transparent), transparent)'
                    }}
                />

                <div className="max-w-6xl mx-auto relative grid lg:grid-cols-[minmax(0,1fr)_520px] gap-14 items-center">
                    <div className="max-w-[620px]">
                        <div className="inline-flex items-center gap-2 mb-5 px-3.5 py-1.5 rounded-full text-sm font-medium anim-up" style={{ background: 'var(--brand-light)', color: 'var(--brand-hover)', border: '1px solid var(--brand-muted)' }}>
                            <Sparkles className="h-3.5 w-3.5" />
                            Yangi avlod ta'limi
                        </div>

                        <h1 className="text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.02] mb-5 anim-up d1">
                            DTM va Milliy Sertifikatga
                            <span style={{ color: 'var(--brand)' }}> aqlli </span>
                            tayyorlaning
                        </h1>

                        <p className="text-lg leading-relaxed max-w-[560px] mb-8 anim-up d2" style={{ color: 'var(--text-secondary)' }}>
                            AI shaxsiy ustoz yordamida savol bering, test ishlang va har bir xatongiz ustida individual ishlang.
                        </p>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 anim-up d3">
                            <Link to="/royxat" className="btn btn-lg" style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}>
                                Bepul boshlash <ArrowRight className="h-4 w-4" />
                            </Link>
                            <Link to="/kirish" className="btn btn-lg btn-outline">
                                Kirish
                            </Link>
                        </div>

                        {publicStats && publicStats.totalStudents > 0 && (
                            <div className="mt-10 flex items-center gap-4 anim-up d4">
                                <div className="flex -space-x-2">
                                    {['A', 'B', 'C'].map((letter, index) => (
                                        <div
                                            key={letter}
                                            className="h-10 w-10 rounded-full border flex items-center justify-center text-xs font-semibold"
                                            style={{
                                                background: index === 0 ? 'var(--bg-card)' : index === 1 ? 'color-mix(in srgb, var(--brand-light) 65%, white)' : 'color-mix(in srgb, var(--bg-surface) 80%, white)',
                                                borderColor: 'var(--bg-page)',
                                                color: 'var(--text-secondary)'
                                            }}
                                        >
                                            {letter}
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <div className="text-2xl font-extrabold">{publicStats.totalStudents.toLocaleString()}+ faol foydalanuvchi</div>
                                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                        {publicStats.totalPublicTests}+ public test · 8 asosiy fan
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <ProductPreview />
                </div>
            </section>

            <section id="qanday-ishlaydi" className="py-18 px-5">
                <div className="max-w-6xl mx-auto">
                    <Reveal className="text-center mb-12">
                        <p className="section-label mb-2">Qanday ishlaydi</p>
                        <h2 className="text-3xl font-extrabold tracking-tight">DTMMax ichidagi asosiy oqim</h2>
                        <p className="text-sm mt-3 max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
                            Savol berasiz, test ishlaysiz va natijani AI bilan ko'rasiz. Asosiy jarayon shu uchta blok bilan tushuniladi.
                        </p>
                    </Reveal>

                    {publicStats && publicStats.totalStudents > 0 && (
                        <div className="grid sm:grid-cols-3 gap-4 mb-10">
                            {[
                                { value: `${publicStats.totalStudents.toLocaleString()}+`, label: "ro'yxatdan o'tgan foydalanuvchi" },
                                { value: `${publicStats.totalPublicTests}+`, label: 'platformadagi public test' },
                                { value: '8', label: 'asosiy fan' },
                            ].map(item => (
                                <div key={item.label} className="rounded-2xl px-4 py-4 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                    <div className="text-2xl font-extrabold">{item.value}</div>
                                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="grid md:grid-cols-3 gap-4">
                        {VALUE_PROPS.map((item, index) => (
                            <Reveal key={item.title} delay={index * 0.08}>
                                <div className="card card-hover h-full">
                                    <div className="h-11 w-11 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--bg-surface)' }}>
                                        <item.icon className="h-5 w-5" style={{ color: 'var(--brand)' }} />
                                    </div>
                                    <h3 className="font-bold text-base mb-2">{item.title}</h3>
                                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.desc}</p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-20 px-5" style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                <div className="max-w-6xl mx-auto">
                    <Reveal className="text-center mb-12">
                        <p className="section-label mb-2">Kimlar uchun</p>
                        <h2 className="text-3xl font-extrabold tracking-tight">Platforma ikkita asosiy foydalanuvchi uchun ishlaydi</h2>
                    </Reveal>

                    <div className="grid md:grid-cols-2 gap-4">
                        {AUDIENCES.map((item, index) => (
                            <Reveal key={item.title} delay={index * 0.1}>
                                <div className="card h-full">
                                    <div className="h-11 w-11 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--bg-card)' }}>
                                        <item.icon className="h-5 w-5" style={{ color: 'var(--brand)' }} />
                                    </div>
                                    <h3 className="font-bold text-lg mb-4">{item.title}</h3>
                                    <div className="space-y-3">
                                        {item.points.map(point => (
                                            <div key={point} className="flex items-start gap-2">
                                                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--success)' }} />
                                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{point}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            <section id="imkoniyatlar" className="py-20 px-5">
                <div className="max-w-6xl mx-auto">
                    <Reveal className="text-center mb-12">
                        <p className="section-label mb-2">Imkoniyatlar</p>
                        <h2 className="text-3xl font-extrabold tracking-tight">Tayyorgarlik uchun kerak bo'lgan asosiy bloklar</h2>
                    </Reveal>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {FEATURES.map((item, index) => (
                            <Reveal key={item.title} delay={index * 0.07}>
                                <div className="card card-hover h-full">
                                    <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${item.color}18` }}>
                                        <item.icon className="h-5 w-5" style={{ color: item.color }} />
                                    </div>
                                    <h3 className="font-bold text-base mb-1.5">{item.title}</h3>
                                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.desc}</p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-20 px-5" style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                <div className="max-w-6xl mx-auto">
                    <Reveal className="text-center mb-12">
                        <p className="section-label mb-2">Fikrlar</p>
                        <h2 className="text-3xl font-extrabold tracking-tight">Foydalanuvchilar nima deydi</h2>
                        <p className="text-sm mt-3 max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
                            Platforma foydalanuvchiga tayyorlanish jarayonini aniqroq va yengilroq his qildirishi kerak.
                        </p>
                    </Reveal>
                    <TestimonialsCarousel />
                </div>
            </section>

            <section id="savollar" className="py-20 px-5">
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

            <section className="py-20 px-5" style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
                <Reveal className="max-w-2xl mx-auto text-center">
                    <h2 className="text-3xl font-extrabold tracking-tight mb-4">Tayyor bo'lsangiz, boshlang</h2>
                    <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>
                        DTMMax birinchi kirishdayoq nimaga xizmat qilishini tushuntiradi, keyin o'qish jarayonini bir joyda davom ettirasiz.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Link to="/royxat" className="btn btn-lg" style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}>
                            Bepul boshlash <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link to="/kirish" className="btn btn-lg btn-outline">
                            Kirish
                        </Link>
                    </div>
                    <div className="flex items-center justify-center gap-4 mt-6 flex-wrap">
                        <a
                            href="https://t.me/+rUid8dzewCBkYTRi"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition"
                            style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                        >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 14.146l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.978.413z" /></svg>
                            Telegram kanal
                        </a>
                        <a
                            href="https://t.me/uzdatalabsupport"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition"
                            style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                        >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                            Support
                        </a>
                    </div>
                </Reveal>
            </section>

            <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                <div className="max-w-6xl mx-auto px-5 py-6 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ background: 'var(--brand)' }}>
                            <BrainCircuit className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className="font-bold text-sm">DTMMax</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>© 2026</span>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                        <a href="https://t.me/+rUid8dzewCBkYTRi" target="_blank" rel="noopener noreferrer" className="text-xs hover:underline transition" style={{ color: 'var(--text-muted)' }}>
                            Telegram
                        </a>
                        <a href="https://t.me/uzdatalabsupport" target="_blank" rel="noopener noreferrer" className="text-xs hover:underline transition" style={{ color: 'var(--text-muted)' }}>
                            Support
                        </a>
                        <Link to="/shartlar" className="text-xs hover:underline transition" style={{ color: 'var(--text-muted)' }}>
                            Foydalanish shartlari
                        </Link>
                        <Link to="/maxfiylik" className="text-xs hover:underline transition" style={{ color: 'var(--text-muted)' }}>
                            Maxfiylik siyosati
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    )
}
