import { Button } from "@/components/ui/button"
import { ArrowRight, BrainCircuit, LineChart, MessageSquare } from "lucide-react"
import { Link } from "react-router-dom"

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-blue-200">

            {/* Navbar */}
            <nav className="border-b bg-white flex justify-between items-center py-4 px-6 md:px-12 sticky top-0 z-50">
                <div className="text-2xl font-bold tracking-tight text-blue-600 flex items-center gap-2">
                    <BrainCircuit className="h-7 w-7" /> msert
                </div>
                <div className="flex gap-4 items-center">
                    <Link to="/login" className="text-sm font-medium hover:text-blue-600 transition-colors">Kirish</Link>
                    <Button asChild className="rounded-full bg-blue-600 hover:bg-blue-700">
                        <Link to="/register">Ro'yxatdan O'tish</Link>
                    </Button>
                </div>
            </nav>

            <main className="flex-grow">

                {/* Hero Section */}
                <div className="max-w-6xl mx-auto px-6 py-20 md:py-32 flex flex-col items-center text-center">
                    <div className="inline-flex items-center rounded-full border px-3 py-1 text-sm text-blue-600 border-blue-200 bg-blue-50 mb-6 font-medium">
                        Milliy Sertifikat tizimi uchun maxsus
                    </div>
                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-6 leading-tight max-w-4xl">
                        Sirtqi imtihonlarga
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-500 block sm:inline"> aqlli tayyorgarlik</span>
                    </h1>
                    <p className="text-lg md:text-xl text-slate-500 mb-10 max-w-2xl font-light">
                        Sizning qobiliyatingizga qarab o'zgaruvchi (Rasch modeli asosidagi) testlar va 24/7 ishlaydigan sun'iy intellekt ustozi yordamida o'zlashtirish tezligingizni x2 oshiring.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Button asChild size="lg" className="rounded-full h-14 px-8 text-base bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200">
                            <Link to="/register">Bepul Boshlash <ArrowRight className="ml-2 h-5 w-5" /></Link>
                        </Button>
                        <Button asChild variant="outline" size="lg" className="rounded-full h-14 px-8 text-base bg-white">
                            <Link to="/login">Mening Profilim</Link>
                        </Button>
                    </div>
                </div>

                {/* Features Minimalist Section */}
                <div className="bg-white py-24 border-t">
                    <div className="max-w-6xl mx-auto px-6">
                        <div className="grid md:grid-cols-3 gap-12">
                            <div className="space-y-4">
                                <div className="h-12 w-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                                    <LineChart className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-semibold text-slate-900">Adaptiv Test Tizimi</h3>
                                <p className="text-slate-600 leading-relaxed font-light">Test savollari xuddi haqiqiy imtihondagidek sizning har bir to'g'ri va noto'g'ri javoblaringiz asosida qiyinlashib yoki osonlashib boradi.</p>
                            </div>
                            <div className="space-y-4">
                                <div className="h-12 w-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                                    <MessageSquare className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-semibold text-slate-900">Aqlli Ustoz bilan Chat</h3>
                                <p className="text-slate-600 leading-relaxed font-light">Sizni tushunmayotgan yoki xato qilgan mavzularingizni ustoz sun'iy intellekt batafsil va oddiy til bilan tushuntirib beradi.</p>
                            </div>
                            <div className="space-y-4">
                                <div className="h-12 w-12 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600">
                                    <BrainCircuit className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-semibold text-slate-900">To'liq Analitika</h3>
                                <p className="text-slate-600 leading-relaxed font-light">O'zingizning qisqa vaqt ichidagi muvaffaqiyat grafiklaringizni va tizimdagi zaif mavzularingiz ro'yxatini doimiy kuzatib boring.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="border-t py-12 bg-slate-50">
                <div className="max-w-6xl mx-auto px-6 text-center text-slate-400 text-sm">
                    &copy; 2026 msert Platform. Developed for National Certificates.
                </div>
            </footer>
        </div>
    )
}
