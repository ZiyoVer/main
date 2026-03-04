import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    BrainCircuit, ArrowRight, ChevronDown, ChevronUp,
    MessageSquare, Target, BarChart3, FileText, Zap, BookOpen
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

const FAQ_ITEMS = [
    {
        q: "msert nima?",
        a: "msert — DTM va Milliy Sertifikat imtihonlariga tayyorlaydigan bepul AI platforma. Shaxsiy ustoz, testlar va natija kuzatuvi birin-ketin bitta joyda."
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

    useEffect(() => {
        if (token && user) {
            if (user.role === 'ADMIN') nav('/boshqaruv', { replace: true })
            else if (user.role === 'TEACHER') nav('/oqituvchi', { replace: true })
            else nav('/suhbat', { replace: true })
        }
    }, [])

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}>

            {/* ── Nav ─────────────────────────────────────────────── */}
            <nav className="sticky top-0 z-50" style={{ borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--bg-page) 90%, transparent)', backdropFilter: 'blur(12px)' }}>
                <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand)' }}>
                            <BrainCircuit className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-bold text-base tracking-tight">msert</span>
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
            <section className="relative py-24 px-5 overflow-hidden">
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
                </div>

                {/* Chat demo */}
                <div className="max-w-2xl mx-auto mt-16 anim-up d4">
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        {/* Window chrome */}
                        <div
                            className="flex items-center gap-2 px-4 py-3"
                            style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
                        >
                            <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-400" />
                                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                                <div className="w-3 h-3 rounded-full bg-green-400" />
                            </div>
                            <div
                                className="flex-1 flex justify-center text-xs rounded-md px-3 py-1"
                                style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)' }}
                            >
                                msert.uz — AI Ustoz
                            </div>
                        </div>

                        {/* Chat messages */}
                        <div className="p-5 space-y-4" style={{ background: 'var(--bg-card)' }}>
                            <div className="flex gap-3">
                                <div className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ background: 'var(--brand)', flexShrink: 0 }}>
                                    AI
                                </div>
                                <div className="bubble-ai">
                                    <p>Assalomu alaykum! Bugun <strong>trigonometriya</strong> bo'yicha ishlaymiz. Qayerdan boshlashni xohlaysiz? 📐</p>
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end">
                                <div className="bubble-user">
                                    <p>sin(90°) nima uchun 1 ga teng?</p>
                                </div>
                                <div className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ background: '#6366F1' }}>
                                    A
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <div className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ background: 'var(--brand)' }}>
                                    AI
                                </div>
                                <div className="bubble-ai">
                                    <p>Birlik doirada 90° burchakda nuqta <strong>(0, 1)</strong> koordinatada turadi. sin — bu y-koordinata, shuning uchun sin(90°) = <strong>1</strong>. 👏</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Steps ───────────────────────────────────────────── */}
            <section className="py-20 px-5">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-12">
                        <p className="section-label mb-2">Qanday ishlaydi</p>
                        <h2 className="text-3xl font-extrabold tracking-tight">3 qadam, shu tamom</h2>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-6">
                        {[
                            { step: '01', title: "Fan tanlang", desc: "Qaysi fandan DTM topshirishingizni, imtihon sanasini va maqsad ballingizni kiriting." },
                            { step: '02', title: "AI bilan o'qing", desc: "Savoling bo'lsa yozing. AI mavzuni tushuntiradi, test beradi, xatoni ko'rsatadi." },
                            { step: '03', title: "Natijani ko'ring", desc: "Har bir testdan keyin zaif joylaringiz aniqlanadi va statistika yangilanadi." },
                        ].map((item, i) => (
                            <div key={i} className="card card-hover anim-up" style={{ animationDelay: `${i * 0.1}s`, position: 'relative', overflow: 'hidden' }}>
                                <span
                                    className="absolute top-3 right-4 font-black select-none"
                                    style={{ fontSize: '4.5rem', lineHeight: 1, color: 'var(--border)', userSelect: 'none' }}
                                >
                                    {item.step}
                                </span>
                                <div className="relative">
                                    <h3 className="font-bold text-base mb-2">{item.title}</h3>
                                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Features ────────────────────────────────────────── */}
            <section className="py-20 px-5 overflow-hidden" style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-12">
                        <p className="section-label mb-2">Imkoniyatlar</p>
                        <h2 className="text-3xl font-extrabold tracking-tight">
                            Tayyorgarlik uchun kerak bo'lgan hamma narsa
                        </h2>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {FEATURES.map((f, i) => (
                            <div
                                key={i}
                                className="card card-hover anim-up"
                                style={{ animationDelay: `${i * 0.08}s` }}
                            >
                                <div
                                    className="h-10 w-10 rounded-xl flex items-center justify-center mb-4"
                                    style={{ background: `${f.color}18` }}
                                >
                                    <f.icon className="h-5 w-5" style={{ color: f.color }} />
                                </div>
                                <h3 className="font-bold text-base mb-1.5">{f.title}</h3>
                                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FAQ ─────────────────────────────────────────────── */}
            <section className="py-20 px-5">
                <div className="max-w-2xl mx-auto">
                    <div className="text-center mb-12">
                        <p className="section-label mb-2">Savollar</p>
                        <h2 className="text-3xl font-extrabold tracking-tight">Tez-tez so'raladigan savollar</h2>
                    </div>

                    <div className="card" style={{ padding: '0 1.5rem' }}>
                        {FAQ_ITEMS.map((item, i) => (
                            <FAQItem key={i} q={item.q} a={item.a} />
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ─────────────────────────────────────────────── */}
            <section className="py-20 px-5" style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
                <div className="max-w-xl mx-auto text-center">
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
                </div>
            </section>

            {/* ── Footer ──────────────────────────────────────────── */}
            <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                <div className="max-w-5xl mx-auto px-5 py-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ background: 'var(--brand)' }}>
                            <BrainCircuit className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className="font-bold text-sm">msert</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>© 2026</span>
                    </div>
                    <button
                        className="text-xs hover:underline transition"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        Maxfiylik siyosati
                    </button>
                </div>
            </footer>
        </div>
    )
}
