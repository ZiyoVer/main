import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BrainCircuit, LogOut, Plus, FileText } from "lucide-react"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"

export default function TeacherDashboard() {
    const [loading, setLoading] = useState(false)
    const [title, setTitle] = useState("")
    const { logout } = useAuthStore()
    const navigate = useNavigate()

    const handleLogout = () => {
        logout()
        navigate("/login")
    }

    const handleCreateTest = (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setTimeout(() => {
            toast.success("Test yaratildi!", { description: "Endi savollarni qo'shishingiz mumkin." })
            setLoading(false)
            setTitle("")
        }, 1000)
    }

    return (
        <div className="min-h-screen bg-gradient-auth">
            {/* Header */}
            <header className="glass-light sticky top-0 z-40 border-b border-slate-200/50">
                <div className="max-w-6xl mx-auto flex justify-between items-center py-4 px-6">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center">
                            <BrainCircuit className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <span className="text-lg font-bold text-slate-900">msert</span>
                            <span className="text-xs text-slate-400 ml-2 font-medium">Boshqaruv</span>
                        </div>
                    </div>
                    <Button variant="ghost" onClick={handleLogout} className="text-slate-500 hover:text-slate-700 gap-2">
                        <LogOut className="h-4 w-4" /> Chiqish
                    </Button>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
                <div className="animate-fade-in-up">
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">O'qituvchi Paneli</h1>
                    <p className="text-slate-500 mt-1 font-light">Testlarni yarating va o'quvchilar holatini kuzating</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Create Test Card */}
                    <Card className="rounded-2xl border-0 shadow-xl shadow-blue-100/50 overflow-hidden animate-fade-in-up delay-100">
                        <CardHeader className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white pb-6 pt-8 px-8">
                            <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
                                <Plus className="h-6 w-6 text-white" />
                            </div>
                            <CardTitle className="text-xl font-bold">Yangi Test Yaratish</CardTitle>
                            <p className="text-blue-100 text-sm font-light mt-1">O'quvchilar uchun adaptiv bazaga test qo'shish</p>
                        </CardHeader>
                        <CardContent className="p-8">
                            <form onSubmit={handleCreateTest} className="space-y-5">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-slate-700">Test Nomi</Label>
                                    <Input
                                        required
                                        placeholder="Masalan: Optika bo'limi 1-qism"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="h-12 rounded-xl border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed">Barcha savollarning qiyinlik darajasi dastlab 0.0 logit (odatiy qiyinlik) deb belgilanadi va Rasch modeli o'zi to'g'irlab oladi.</p>
                                <Button type="submit" className="w-full h-12 rounded-xl font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 shadow-lg shadow-blue-200 transition-all" disabled={loading}>
                                    {loading ? "Saqlanmoqda..." : "Testni Saqlash"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Test List */}
                    <Card className="rounded-2xl border-0 shadow-lg shadow-slate-100 bg-white animate-fade-in-up delay-200">
                        <CardHeader className="px-8 pt-8">
                            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-3">
                                <FileText className="h-5 w-5 text-slate-400" /> Mening Testlarim
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-8 pb-8">
                            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
                                <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <FileText className="h-8 w-8 text-slate-300" />
                                </div>
                                <p className="text-slate-400 font-medium">Hozircha testlar yo'q</p>
                                <p className="text-sm text-slate-300 mt-1">Birinchi testingizni yarating</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
