import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { fetchApi } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"

export default function AdminLogin() {
    const navigate = useNavigate()
    const login = useAuthStore((state) => state.login)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const data = await fetchApi("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password })
            })
            if (data.user.role === 'STUDENT') {
                toast.error("Ruxsat yo'q", { description: "Siz admin yoki o'qituvchi emassiz" })
                return
            }

            login(data.token, data.user)
            navigate("/teacher")

        } catch (e: any) {
            toast.error("Xato", { description: e.message || "Email yoki parol noto'g'ri" })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex justify-center items-center min-h-screen bg-slate-900 border-t-4 border-red-500">
            <Card className="w-full max-w-sm bg-slate-800 text-slate-100 border-slate-700 shadow-2xl">
                <CardHeader className="space-y-3">
                    <div className="flex justify-center mb-2">
                        <ShieldAlert className="h-12 w-12 text-red-500" />
                    </div>
                    <CardTitle className="text-2xl text-center">Boshqaruv Paneli</CardTitle>
                    <CardDescription className="text-center text-slate-400">
                        Faqat Admin va O'qituvchilar tizimiga kirish
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="grid gap-5 mt-2">
                        <div className="grid gap-2">
                            <Label htmlFor="email" className="text-slate-300">Maxsus Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="admin@msert.uz"
                                className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 focus-visible:ring-red-500"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password" className="text-slate-300">Maxfiy Parol</Label>
                            <Input
                                id="password"
                                type="password"
                                className="bg-slate-900 border-slate-700 text-white focus-visible:ring-red-500"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <Button type="submit" className="w-full mt-2 bg-red-600 hover:bg-red-700 text-white" disabled={loading}>
                            {loading ? "Ruxsat tekshirilmoqda..." : "Tizimga Kirish"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
