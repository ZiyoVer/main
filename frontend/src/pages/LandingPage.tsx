import { Button } from "@/components/ui/button"
import { ArrowRight, BrainCircuit, LineChart, MessageSquare, Sparkles, GraduationCap, Target } from "lucide-react"
import { Link } from "react-router-dom"

export default function LandingPage() {
    return (
        <div className="min-h-screen flex flex-col selection:bg-blue-300/30">

            {/* Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 glass-light">
                <div className="max-w-7xl mx-auto flex justify-between items-center py-4 px-6 md:px-12">
                    <div className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent flex items-center gap-2.5">
                        <div className="h-9 w-9 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center">
                            <BrainCircuit className="h-5 w-5 text-white" />
                        </div>
                        msert
                    </div>
                    <div className="flex gap-3 items-center">
                        <Button variant="ghost" asChild className="text-slate-600 hover:text-slate-900 font-medium">
                            <Link to="/login">Kirish</Link>
                        </Button>
                        <Button asChild className="rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 shadow-lg shadow-blue-500/25 px-6">
                            <Link to="/register">Bepul Boshlash</Link>
                        </Button>
                    </div>
                </div>
            </nav>

            <main className="flex-grow">

                {/* Hero Section with Dark Mesh Gradient */}
                <section className="bg-gradient-mesh min-h-[92vh] flex items-center relative overflow-hidden">
                    {/* Decorative orbs */}
                    <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-float" />
                    <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/8 rounded-full blur-3xl animate-float delay-200" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl" />

                    <div className="max-w-7xl mx-auto px-6 pt-28 pb-20 relative z-10 w-full">
                        <div className="flex flex-col lg:flex-row items-center gap-16">
                            <div className="flex-1 text-center lg:text-left">
                                <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-300 mb-8 animate-fade-in-up">
                                    <Sparkles className="h-4 w-4" /> Milliy Sertifikat tizimi uchun maxsus
                                </div>
                                <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.1] animate-fade-in-up delay-100">
                                    Imtihonlarga <br />
                                    <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">aqlli tayyorgarlik</span>
                                </h1>
                                <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-xl font-light leading-relaxed animate-fade-in-up delay-200">
                                    Rasch modeli asosidagi adaptiv testlar va 24/7 sun'iy intellekt ustozi yordamida siz imtihon natijangizni <strong className="text-white font-semibold">2 barobar</strong> tezroq oshirasiz.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up delay-300">
                                    <Button asChild size="lg" className="rounded-full h-14 px-10 text-base font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 shadow-xl shadow-blue-600/30 animate-pulse-glow">
                                        <Link to="/register">Bepul Ro'yxatdan O'tish <ArrowRight className="ml-2 h-5 w-5" /></Link>
                                    </Button>
                                    <Button asChild variant="outline" size="lg" className="rounded-full h-14 px-10 text-base border-slate-600 text-slate-300 hover:bg-white/5 hover:text-white bg-transparent">
                                        <Link to="/login">Profilga Kirish</Link>
                                    </Button>
                                </div>
                            </div>

                            {/* Right side: Stats/Visual */}
                            <div className="flex-1 w-full max-w-md animate-fade-in-up delay-400">
                                <div className="glass rounded-3xl p-8 space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="h-14 w-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                                            <GraduationCap className="h-7 w-7 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-3xl font-bold text-white">1,200+</p>
                                            <p className="text-sm text-slate-400">Faol o'quvchilar</p>
                                        </div>
                                    </div>
                                    <div className="h-px bg-white/10" />
                                    <div className="flex items-center gap-4">
                                        <div className="h-14 w-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                            <Target className="h-7 w-7 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-3xl font-bold text-white">87%</p>
                                            <p className="text-sm text-slate-400">O'rtacha natija o'sishi</p>
                                        </div>
                                    </div>
                                    <div className="h-px bg-white/10" />
                                    <div className="flex items-center gap-4">
                                        <div className="h-14 w-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                                            <BrainCircuit className="h-7 w-7 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-3xl font-bold text-white">5,000+</p>
                                            <p className="text-sm text-slate-400">Adaptiv savollar</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section className="py-28 bg-white relative">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="text-center mb-20">
                            <p className="text-sm font-semibold text-blue-600 tracking-wider uppercase mb-3">Platformaning Afzalliklari</p>
                            <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">Nima uchun <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">msert</span>?</h2>
                        </div>

                        <div className="grid md:grid-cols-3 gap-8">
                            {[
                                {
                                    icon: LineChart, color: "blue",
                                    title: "Adaptiv Test Tizimi",
                                    desc: "Har bir javobingiz testning keyingi qismini o'zgartiradi. Savollar sizning darajangizga moslashtiriladi — xuddi haqiqiy imtihondagidek.",
                                    gradient: "from-blue-500 to-blue-600",
                                    bg: "bg-blue-50",
                                    shadow: "shadow-blue-100"
                                },
                                {
                                    icon: MessageSquare, color: "emerald",
                                    title: "AI Ustoz bilan Suhbat",
                                    desc: "Tushunmagan mavzularingizni AI ustoz batafsil, oddiy til bilan, misol va formulalar orqali tushuntirib beradi.",
                                    gradient: "from-emerald-500 to-emerald-600",
                                    bg: "bg-emerald-50",
                                    shadow: "shadow-emerald-100"
                                },
                                {
                                    icon: BrainCircuit, color: "purple",
                                    title: "To'liq Analitika",
                                    desc: "Qaysi mavzular zaif ekanini aniq bilib oling. Muvaffaqiyat grafiklari va tavsiyalar orqali yo'nalishingizni to'g'rilang.",
                                    gradient: "from-purple-500 to-purple-600",
                                    bg: "bg-purple-50",
                                    shadow: "shadow-purple-100"
                                }
                            ].map((f, i) => (
                                <div key={i} className={`${f.bg} rounded-3xl p-8 group hover:shadow-2xl ${f.shadow} transition-all duration-500 hover:-translate-y-2`}>
                                    <div className={`h-14 w-14 bg-gradient-to-br ${f.gradient} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                                        <f.icon className="h-7 w-7 text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-3">{f.title}</h3>
                                    <p className="text-slate-600 leading-relaxed">{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="bg-gradient-mesh py-28 relative overflow-hidden">
                    <div className="absolute top-10 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
                    <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
                        <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-6">
                            Bugun boshlang, <br /> ertaga natija oling
                        </h2>
                        <p className="text-lg text-slate-400 mb-10 font-light max-w-xl mx-auto">
                            Minglab o'quvchilar allaqachon msert orqali tayyorgarlik ko'rmoqda. Ularning safiga qo'shiling.
                        </p>
                        <Button asChild size="lg" className="rounded-full h-14 px-12 text-base font-semibold bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500 shadow-xl shadow-blue-600/30">
                            <Link to="/register">Hoziroq Boshlash <ArrowRight className="ml-2 h-5 w-5" /></Link>
                        </Button>
                    </div>
                </section>
            </main>

            <footer className="border-t border-slate-100 py-10 bg-white">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="text-sm text-slate-400">&copy; 2026 msert Platform. Barcha huquqlar himoyalangan.</div>
                    <div className="flex gap-6 text-sm text-slate-400">
                        <span className="hover:text-slate-600 cursor-pointer transition-colors">Maxfiylik siyosati</span>
                        <span className="hover:text-slate-600 cursor-pointer transition-colors">Foydalanish shartlari</span>
                    </div>
                </div>
            </footer>
        </div>
    )
}
