import { Link } from 'react-router-dom'
import { BrainCircuit, Sparkles, Target, BarChart3, MessageCircle, BookOpen, Zap, ArrowRight, ChevronRight, Shield, Clock, Trophy } from 'lucide-react'

export default function Landing() {
    return (
        <div className="min-h-screen bg-[#fafafa] overflow-hidden">
            {/* Nav */}
            <nav className="fixed top-0 inset-x-0 z-50">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex justify-between items-center bg-white/80 backdrop-blur-xl rounded-2xl px-6 py-3 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center">
                                <BrainCircuit className="h-4.5 w-4.5 text-white" />
                            </div>
                            <span className="text-lg font-extrabold tracking-tight text-gray-900">msert</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link to="/login" className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition">Kirish</Link>
                            <Link to="/register" className="group flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white bg-gray-900 rounded-xl hover:bg-gray-800 transition shadow-lg shadow-gray-900/10">
                                Boshlash <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="pt-32 pb-20 px-6 relative">
                {/* Background decoration */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-blue-100/60 via-cyan-50/40 to-transparent rounded-full blur-3xl -z-10" />
                <div className="absolute top-40 left-20 w-3 h-3 bg-blue-400 rounded-full anim-float opacity-60" />
                <div className="absolute top-60 right-32 w-2 h-2 bg-cyan-400 rounded-full anim-float d2 opacity-60" />
                <div className="absolute top-80 left-1/3 w-2.5 h-2.5 bg-purple-400 rounded-full anim-float d3 opacity-40" />

                <div className="max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 bg-white rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-600 mb-8 shadow-sm anim-up">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        <span>Milliy Sertifikat imtihonlariga tayyorgarlik</span>
                    </div>

                    <h1 className="text-5xl md:text-[4.25rem] font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-6 anim-up d1">
                        Imtihonga tayyorgarlik <br />
                        <span className="relative inline-block">
                            <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 bg-clip-text text-transparent">yangi darajada</span>
                            <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none"><path d="M2 8 C50 2, 100 2, 150 6 S250 10, 298 4" stroke="url(#grad)" strokeWidth="3" strokeLinecap="round" /><defs><linearGradient id="grad"><stop offset="0%" stopColor="#2563eb" /><stop offset="100%" stopColor="#06b6d4" /></linearGradient></defs></svg>
                        </span>
                    </h1>

                    <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-10 font-light leading-relaxed anim-up d2">
                        AI ustoz sizning kuchli va zaif tomonlaringizni aniqlaydi, shaxsiy o'quv reja tuzadi va har bir savolda yoningizda bo'ladi
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 anim-up d3">
                        <Link to="/register" className="group h-13 px-8 flex items-center gap-2 text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl shadow-xl shadow-blue-500/20 hover:shadow-2xl hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all">
                            Bepul ro'yxatdan o'tish
                            <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                        <Link to="/admin-login" className="h-13 px-8 flex items-center gap-2 text-base font-medium text-gray-600 border-2 border-gray-200 rounded-2xl hover:border-gray-300 hover:bg-white transition-all">
                            <Shield className="h-4 w-4" /> Admin kirish
                        </Link>
                    </div>
                </div>

                {/* Interactive Demo Preview */}
                <div className="max-w-4xl mx-auto mt-20 anim-up d4">
                    <div className="bg-white rounded-3xl shadow-2xl shadow-gray-200/60 border border-gray-100 overflow-hidden">
                        {/* Window chrome */}
                        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
                            <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-400/80" />
                                <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                                <div className="w-3 h-3 rounded-full bg-green-400/80" />
                            </div>
                            <div className="flex-1 flex justify-center">
                                <div className="text-xs text-gray-400 bg-gray-100 rounded-lg px-4 py-1">msert.uz — AI Ustoz</div>
                            </div>
                        </div>
                        {/* Chat preview */}
                        <div className="p-8 space-y-5">
                            <div className="flex gap-3">
                                <div className="h-9 w-9 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <BrainCircuit className="h-4.5 w-4.5 text-white" />
                                </div>
                                <div className="bg-gray-50 rounded-2xl rounded-bl-md px-5 py-3.5 max-w-md">
                                    <p className="text-sm text-gray-700 leading-relaxed">Assalomu alaykum! Bugun <strong>trigonometriya</strong> bo'yicha ishlaymiz. Avval sin va cos funksiyalarining asosiy xossalarini ko'rib chiqamiz 📐</p>
                                </div>
                            </div>
                            <div className="flex gap-3 justify-end">
                                <div className="bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl rounded-br-md px-5 py-3.5 max-w-sm">
                                    <p className="text-sm text-white">sin(90°) nima uchun 1 ga teng?</p>
                                </div>
                                <div className="h-9 w-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">A</div>
                            </div>
                            <div className="flex gap-3">
                                <div className="h-9 w-9 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <BrainCircuit className="h-4.5 w-4.5 text-white" />
                                </div>
                                <div className="bg-gray-50 rounded-2xl rounded-bl-md px-5 py-3.5 max-w-md">
                                    <p className="text-sm text-gray-700 leading-relaxed">Juda yaxshi savol! 👏 Birlik doirada 90° burchakda nuqta <strong>(0, 1)</strong> koordinatada turadi. sin — bu y-koordinata, shuning uchun sin(90°) = <strong>1</strong>.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section className="py-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <p className="text-sm font-semibold text-blue-600 tracking-wider uppercase mb-3">Qanday ishlaydi</p>
                        <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">3 qadam bilan boshlang</h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { step: '01', icon: BookOpen, title: 'Fan tanlang', desc: 'Qaysi fan bo\'yicha Milliy Sertifikat topshirishni va imtihon sanasini belgilang', color: 'blue' },
                            { step: '02', icon: MessageCircle, title: 'AI bilan o\'qing', desc: 'Shaxsiy ustoz har bir mavzuni batafsil tushuntiradi va rejangizni kuzatib boradi', color: 'emerald' },
                            { step: '03', icon: Target, title: 'Test yechib, o\'sing', desc: 'Darajangizga mos testlar orqali bilimingiz har kuni mustahkamlanadi', color: 'purple' },
                        ].map((item, i) => (
                            <div key={i} className="group relative anim-up" style={{ animationDelay: `${i * 0.15}s` }}>
                                <div className="bg-white rounded-3xl p-8 border border-gray-100 hover:border-gray-200 hover:shadow-xl hover:shadow-gray-100 transition-all duration-500 h-full">
                                    {/* Step number */}
                                    <span className="text-7xl font-black text-gray-50 absolute top-4 right-6 select-none group-hover:text-gray-100/80 transition-colors">{item.step}</span>

                                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 ${item.color === 'blue' ? 'bg-blue-50 text-blue-600' : item.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 'bg-purple-50 text-purple-600'
                                        }`}>
                                        <item.icon className="h-6 w-6" />
                                    </div>

                                    <h3 className="text-lg font-bold text-gray-900 mb-2 relative z-10">{item.title}</h3>
                                    <p className="text-sm text-gray-500 leading-relaxed relative z-10">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features grid */}
            <section className="py-24 px-6 bg-white">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <p className="text-sm font-semibold text-blue-600 tracking-wider uppercase mb-3">Imkoniyatlar</p>
                        <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">Sizga kerak bo'lgan <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">hamma narsa</span></h2>
                    </div>

                    <div className="grid md:grid-cols-2 gap-5">
                        {/* Big feature */}
                        <div className="md:row-span-2 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-3xl p-8 text-white overflow-hidden relative group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -translate-y-1/3 translate-x-1/3 group-hover:scale-110 transition-transform duration-700" />
                            <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/10 rounded-full translate-y-1/3 -translate-x-1/3" />
                            <div className="relative z-10 h-full flex flex-col">
                                <div className="h-14 w-14 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30">
                                    <BrainCircuit className="h-7 w-7 text-white" />
                                </div>
                                <h3 className="text-2xl font-bold mb-3">AI Shaxsiy Ustoz</h3>
                                <p className="text-gray-400 leading-relaxed mb-8 text-sm">24/7 ishlaydigan shaxsiy ustoz. Har bir savolingizga batafsil, misollar bilan javob beradi. Fayllar yuklang — PDF, rasm, screenshot — AI hammasini o'qiydi va tushuntiradi.</p>
                                <div className="mt-auto flex flex-wrap gap-2">
                                    {['Matematika', 'Fizika', 'Kimyo', 'Biologiya', 'Ona tili'].map(f => (
                                        <span key={f} className="px-3 py-1.5 text-xs font-medium bg-white/10 rounded-lg">{f}</span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-50 rounded-3xl p-7 border border-blue-100 group hover:shadow-lg hover:shadow-blue-100 transition-all duration-300">
                            <div className="h-11 w-11 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <BarChart3 className="h-5 w-5" />
                            </div>
                            <h3 className="text-base font-bold text-gray-900 mb-1.5">Rasch Modeli Baholash</h3>
                            <p className="text-sm text-gray-500 leading-relaxed">Har bir savol va o'quvchining darajasi ilmiy usulda hisoblanadi — aniq va adolatli natija</p>
                        </div>

                        <div className="bg-emerald-50 rounded-3xl p-7 border border-emerald-100 group hover:shadow-lg hover:shadow-emerald-100 transition-all duration-300">
                            <div className="h-11 w-11 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Clock className="h-5 w-5" />
                            </div>
                            <h3 className="text-base font-bold text-gray-900 mb-1.5">Vaqtni Kuzatish</h3>
                            <p className="text-sm text-gray-500 leading-relaxed">AI imtihongacha qolgan vaqtni doim hisobga oladi va o'quv rejani optimizatsiya qiladi</p>
                        </div>

                        <div className="bg-amber-50 rounded-3xl p-7 border border-amber-100 group hover:shadow-lg hover:shadow-amber-100 transition-all duration-300">
                            <div className="h-11 w-11 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Zap className="h-5 w-5" />
                            </div>
                            <h3 className="text-base font-bold text-gray-900 mb-1.5">Adaptiv Testlar</h3>
                            <p className="text-sm text-gray-500 leading-relaxed">O'qituvchilar yaratgan testlar — public va private. AI bilan birga tahlil qilasiz</p>
                        </div>

                        <div className="bg-purple-50 rounded-3xl p-7 border border-purple-100 group hover:shadow-lg hover:shadow-purple-100 transition-all duration-300">
                            <div className="h-11 w-11 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Trophy className="h-5 w-5" />
                            </div>
                            <h3 className="text-base font-bold text-gray-900 mb-1.5">Progress Tracking</h3>
                            <p className="text-sm text-gray-500 leading-relaxed">Zaif mavzularingiz AI kuzatishida — har bir dars, har bir test sizni maqsadga yaqinlashtiradi</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 px-6 relative">
                <div className="max-w-3xl mx-auto">
                    <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-[2rem] p-12 md:p-16 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-60 h-60 bg-cyan-500/10 rounded-full translate-y-1/2 -translate-x-1/2" />
                        <div className="relative z-10">
                            <Sparkles className="h-8 w-8 text-amber-400 mx-auto mb-6 anim-float" />
                            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">Tayyormisiz?</h2>
                            <p className="text-gray-400 mb-8 max-w-md mx-auto font-light">Sizning Milliy Sertifikat natijangiz AI yordamida ancha yaxshi bo'lishi mumkin. Bugun boshlang.</p>
                            <Link to="/register" className="group inline-flex items-center gap-2 h-13 px-10 text-base font-semibold text-gray-900 bg-white rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all">
                                Bepul ro'yxatdan o'tish
                                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-gray-100 py-8 bg-white">
                <div className="max-w-6xl mx-auto px-6 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center">
                            <BrainCircuit className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-sm font-bold text-gray-900">msert</span>
                        <span className="text-xs text-gray-400 ml-1">© 2026</span>
                    </div>
                    <span className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer transition">Maxfiylik siyosati</span>
                </div>
            </footer>
        </div>
    )
}
