import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { fetchApi } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"

export default function Login() {
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
        <div className="flex justify-center items-center min-h-screen bg-slate-50">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-2xl">Kirish</CardTitle>
                    <CardDescription>
                        Platformaga kirish uchun pochtangizni kiriting
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="m@example.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password">Parol</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Kutilmoqda..." : "Kirish"}
                        </Button>
                    </form>
                    <div className="mt-4 text-center text-sm">
                        Akkauntingiz yo'qmi?{" "}
                        <Link to="/register" className="underline">
                            Ro'yxatdan o'tish
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
