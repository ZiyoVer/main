import { Link } from 'react-router-dom'

export default function Landing() {
    return (
        <div className="min-h-screen flex flex-col">
            {/* Nav */}
            <nav className="fixed top-0 inset-x-0 z-50 glass-light border-b border-gray-100">
                <div className="max-w-6xl mx-auto flex justify-between items-center py-3.5 px-6">
                    <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">msert</span>
                    <div className="flex gap-2">
                        <Link to="/login" className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-full transition">Kirish</Link>
                        <Link to="/register" className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full shadow-lg shadow-blue-500/25 hover:shadow-xl transition">Bepul Boshlash</Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="bg-mesh-dark min-h-screen flex items-center relative overflow-hidden">
                <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl anim-float" />
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/8 rounded-full blur-3xl anim-float d2" />
                <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 w-full">
                    <div className="flex flex-col lg:flex-row items-center gap-16">
                        <div className="flex-1 text-center lg:text-left">
                            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-300 mb-7 anim-up">
                                ✨ Milliy Sertifikat uchun maxsus
                            </div>
                            <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-5 leading-tight tracking-tight anim-up d1">
                                Imtihonlarga <br /><span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">aqlli tayyorgarlik</span>
                            </h1>
                            <p className="text-lg text-gray-400 mb-9 max-w-lg font-light leading-relaxed anim-up d2">
                                Adaptiv testlar va 24/7 AI ustoz yordamida natijangizni <strong className="text-white font-semibold">2 barobar</strong> tezroq oshiring.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 anim-up d3">
                                <Link to="/register" className="h-13 px-8 flex items-center justify-center text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full shadow-xl shadow-blue-600/30 hover:shadow-2xl transition anim-glow">
                                    Bepul Boshlash →
                                </Link>
                                <Link to="/login" className="h-13 px-8 flex items-center justify-center text-base text-gray-300 border border-gray-600 rounded-full hover:bg-white/5 transition">
                                    Kirish
                                </Link>
                            </div>
                        </div>
                        <div className="flex-1 max-w-sm anim-up d4">
                            <div className="glass rounded-3xl p-7 space-y-5">
                                {[
                                    { n: '1,200+', l: 'Faol o\'quvchilar', c: 'from-blue-500 to-blue-600' },
                                    { n: '87%', l: 'Natija o\'sishi', c: 'from-emerald-500 to-emerald-600' },
                                    { n: '5,000+', l: 'Adaptiv savollar', c: 'from-purple-500 to-purple-600' },
                                ].map((s, i) => (
                                    <div key={i}>
                                        {i > 0 && <div className="h-px bg-white/10 mb-5" />}
                                        <div className="flex items-center gap-4">
                                            <div className={`h-12 w-12 bg-gradient-to-br ${s.c} rounded-2xl`} />
                                            <div><p className="text-2xl font-bold text-white">{s.n}</p><p className="text-sm text-gray-400">{s.l}</p></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="py-24 bg-white">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <p className="text-sm font-semibold text-blue-600 tracking-wider uppercase mb-2">Imkoniyatlar</p>
                        <h2 className="text-4xl font-extrabold text-gray-900">Nima uchun <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">msert</span>?</h2>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            { t: 'AI Ustoz', d: 'Tushunmagan mavzularingizni 24/7 AI ustoz batafsil tushuntiradi. Fayllar ham yuklash mumkin.', bg: 'bg-blue-50', c: 'from-blue-500 to-blue-600' },
                            { t: 'Adaptiv Testlar', d: 'Rasch modeli asosida har savol sizning darajangizga moslashadi.', bg: 'bg-emerald-50', c: 'from-emerald-500 to-emerald-600' },
                            { t: 'To\'liq Analitika', d: 'Zaif va kuchli tomonlaringizni aniq bilib, yo\'nalishingizni to\'g\'rilang.', bg: 'bg-purple-50', c: 'from-purple-500 to-purple-600' },
                        ].map((f, i) => (
                            <div key={i} className={`${f.bg} rounded-3xl p-7 group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300`}>
                                <div className={`h-12 w-12 bg-gradient-to-br ${f.c} rounded-2xl mb-5 group-hover:scale-110 transition-transform`} />
                                <h3 className="text-lg font-bold text-gray-900 mb-2">{f.t}</h3>
                                <p className="text-gray-600 text-sm leading-relaxed">{f.d}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="bg-mesh-dark py-24 relative overflow-hidden">
                <div className="max-w-2xl mx-auto px-6 text-center relative z-10">
                    <h2 className="text-4xl font-extrabold text-white mb-5">Bugun boshlang</h2>
                    <p className="text-gray-400 mb-8 font-light">Minglab o'quvchilar allaqachon msert orqali tayyorgarlik ko'rmoqda.</p>
                    <Link to="/register" className="inline-flex h-13 px-10 items-center text-base font-semibold text-white bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full shadow-xl">Hoziroq Boshlash →</Link>
                </div>
            </section>

            <footer className="border-t py-8 bg-white">
                <div className="max-w-6xl mx-auto px-6 flex justify-between items-center text-sm text-gray-400">
                    <span>© 2026 msert</span>
                    <span className="hover:text-gray-600 cursor-pointer">Maxfiylik siyosati</span>
                </div>
            </footer>
        </div>
    )
}
