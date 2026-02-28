import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { BrainCircuit, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { fetchApi } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"

export default function Login() {
    const navigate = useNavigate()
    const login = useAuthStore((state) => state.login)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPass, setShowPass] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const data = await fetchApi("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password })
            })
            login(data.token, data.user)
            if (data.user.role === 'TEACHER' || data.user.role === 'ADMIN') {
                navigate("/teacher")
            } else {
                navigate("/dashboard")
            }
        } catch (e: any) {
            toast.error("Xato", { description: e.message || "Email yoki parol noto'g'ri" })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-auth flex">
            {/* Left Panel - Branding */}
            <div className="hidden lg:flex flex-1 bg-gradient-mesh items-center justify-center relative overflow-hidden">
                <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-float" />
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/8 rounded-full blur-3xl animate-float delay-200" />
                <div className="text-center relative z-10 px-12 animate-fade-in-up">
                    <div className="h-20 w-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-blue-500/30">
                        <BrainCircuit className="h-10 w-10 text-white" />
                    </div>
                    <h2 className="text-4xl font-extrabold text-white mb-4 tracking-tight">msert</h2>
                    <p className="text-slate-400 text-lg font-light max-w-sm">Milliy Sertifikat imtihonlariga aqlli tayyorgarlik platformasi</p>
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

                    <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Xush kelibsiz!</h1>
                    <p className="text-slate-500 mb-8 text-base">Platformaga kirish uchun ma'lumotlaringizni kiriting</p>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email manzil</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="m@example.com"
                                className="h-12 rounded-xl border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm font-medium text-slate-700">Parol</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPass ? "text" : "password"}
                                    placeholder="••••••••"
                                    className="h-12 rounded-xl border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all pr-12"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                                    {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>
                        <Button type="submit" className="w-full h-12 rounded-xl text-base font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 shadow-lg shadow-blue-500/25 transition-all" disabled={loading}>
                            {loading ? "Tekshirilmoqda..." : "Kirish"}
                        </Button>
                    </form>

                    <p className="mt-8 text-center text-sm text-slate-500">
                        Hali akkauntingiz yo'qmi?{" "}
                        <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                            Ro'yxatdan o'tish
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
