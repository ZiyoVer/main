import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { BrainCircuit, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { fetchApi } from "@/lib/api"

export default function Register() {
    const navigate = useNavigate()
    const [data, setData] = useState({ name: "", email: "", password: "", role: "STUDENT" })
    const [showPass, setShowPass] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            await fetchApi("/auth/register", {
                method: "POST",
                body: JSON.stringify(data),
            })
            toast.success("Muvaffaqiyatli!", { description: "Akkaunt yaratildi. Endi kiring." })
            navigate("/login")
        } catch (e: any) {
            toast.error("Xatolik", { description: e.message || "Server bilan bog'lanishda xato" })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-auth flex">
            {/* Left Panel - Branding */}
            <div className="hidden lg:flex flex-1 bg-gradient-mesh items-center justify-center relative overflow-hidden">
                <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-float" />
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-emerald-500/8 rounded-full blur-3xl animate-float delay-200" />
                <div className="text-center relative z-10 px-12 animate-fade-in-up">
                    <div className="h-20 w-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-blue-500/30">
                        <BrainCircuit className="h-10 w-10 text-white" />
                    </div>
                    <h2 className="text-4xl font-extrabold text-white mb-4 tracking-tight">msert</h2>
                    <p className="text-slate-400 text-lg font-light max-w-sm">Sun'iy intellekt yordamida o'qib, milliy sertifikat oling</p>
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-md animate-fade-in-up">
                    <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
                        <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center">
                            <BrainCircuit className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">msert</span>
                    </div>

                    <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Akkaunt yarating</h1>
                    <p className="text-slate-500 mb-8 text-base">Bepul ro'yxatdan o'ting va darhol boshlang</p>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-medium text-slate-700">To'liq ismingiz</Label>
                            <Input
                                id="name"
                                placeholder="Ali Valiyev"
                                className="h-12 rounded-xl border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                required
                                value={data.name}
                                onChange={(e) => setData({ ...data, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email manzil</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="ali@example.com"
                                className="h-12 rounded-xl border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                required
                                value={data.email}
                                onChange={(e) => setData({ ...data, email: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm font-medium text-slate-700">Parol</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPass ? "text" : "password"}
                                    placeholder="Kamida 6 belgi"
                                    className="h-12 rounded-xl border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all pr-12"
                                    required
                                    value={data.password}
                                    onChange={(e) => setData({ ...data, password: e.target.value })}
                                />
                                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                                    {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>
                        <Button type="submit" className="w-full h-12 rounded-xl text-base font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 shadow-lg shadow-blue-500/25 transition-all" disabled={loading}>
                            {loading ? "Yaratilmoqda..." : "Ro'yxatdan O'tish"}
                        </Button>
                    </form>

                    <p className="mt-8 text-center text-sm text-slate-500">
                        Akkauntingiz bormi?{" "}
                        <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                            Kirish
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
