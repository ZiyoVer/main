import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BrainCircuit, ArrowRight, MessageSquareText, TrendingUp, BookOpen, LogOut, Zap } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"

export default function Dashboard() {
    const { user, logout } = useAuthStore()
    const navigate = useNavigate()

    const handleLogout = () => {
        logout()
        navigate("/login")
    }

    return (
        <div className="min-h-screen bg-gradient-auth">
            {/* Top Bar */}
            <header className="glass-light sticky top-0 z-40">
                <div className="max-w-6xl mx-auto flex justify-between items-center py-4 px-6">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center">
                            <BrainCircuit className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">msert</span>
                    </div>
                    <Button variant="ghost" onClick={handleLogout} className="text-slate-500 hover:text-slate-700 gap-2">
                        <LogOut className="h-4 w-4" /> Chiqish
                    </Button>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">

                {/* Welcome */}
                <div className="animate-fade-in-up">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
                        Salom, <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">{user?.name || "Talaba"}</span>!
                    </h1>
                    <p className="text-slate-500 mt-2 text-lg font-light">Bugungi o'quv rejangiz tayyor. Boshlaysizmi?</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main CTA Card */}
                    <Card className="lg:col-span-2 rounded-2xl border-0 shadow-xl shadow-blue-100/50 bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-600 text-white overflow-hidden relative group animate-fade-in-up delay-100">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3 group-hover:scale-110 transition-transform duration-700" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/3" />
                        <CardHeader className="pb-2 relative z-10">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center">
                                    <Zap className="h-6 w-6 text-white" />
                                </div>
                            </div>
                            <CardTitle className="text-2xl font-bold">Adaptiv Testni Boshlang</CardTitle>
                        </CardHeader>
                        <CardContent className="relative z-10 space-y-4">
                            <p className="text-blue-100 text-base font-light leading-relaxed max-w-lg">
                                Sizning hozirgi bilim darajangizga mos savollar. Xato qilgan mavzularingizga AI ustoz yechim taqdim etadi.
                            </p>
                            <Button size="lg" className="rounded-full h-12 px-8 font-semibold bg-white text-blue-700 hover:bg-blue-50 shadow-lg" asChild>
                                <Link to="/test-taker">
                                    Testni Boshlash <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>

                    {/* AI Chat CTA */}
                    <Card className="rounded-2xl border-0 shadow-xl shadow-emerald-100/50 bg-gradient-to-br from-emerald-50 to-emerald-100/80 group hover:shadow-2xl transition-all duration-300 animate-fade-in-up delay-200">
                        <CardHeader className="pb-2">
                            <div className="h-12 w-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-emerald-200">
                                <MessageSquareText className="h-6 w-6 text-white" />
                            </div>
                            <CardTitle className="text-emerald-900">Aqlli Ustoz</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-emerald-700/80 text-sm font-light">Tushunmagan mavzularingizni batafsil so'rang</p>
                            <Button variant="outline" size="lg" className="w-full rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-semibold" asChild>
                                <Link to="/chat">Suhbat boshlash</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up delay-300">
                    <Card className="rounded-2xl border-0 shadow-lg shadow-slate-100 bg-white">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="h-12 w-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                                <BookOpen className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">12</p>
                                <p className="text-sm text-slate-500">Ishlangan testlar</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-0 shadow-lg shadow-slate-100 bg-white">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="h-12 w-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                                <TrendingUp className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-emerald-600">68%</p>
                                <p className="text-sm text-slate-500">O'rtacha natija</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-0 shadow-lg shadow-slate-100 bg-white">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="h-12 w-12 bg-purple-50 rounded-2xl flex items-center justify-center">
                                <BrainCircuit className="h-6 w-6 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">+0.45</p>
                                <p className="text-sm text-slate-500">Qobiliyat darajasi (logit)</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Weak Topics */}
                <Card className="rounded-2xl border-0 shadow-lg shadow-slate-100 bg-white animate-fade-in-up delay-400">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold text-slate-900">Takrorlash kerak bo'lgan mavzular</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-3">
                        <Badge className="px-4 py-2 rounded-full bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-medium">Trigonometriya · 14 xato</Badge>
                        <Badge className="px-4 py-2 rounded-full bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 font-medium">Nyuton qonunlari · 5 xato</Badge>
                        <Badge className="px-4 py-2 rounded-full bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 font-medium">Kinematika</Badge>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
