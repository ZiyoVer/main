import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
        <div className="min-h-screen bg-slate-50 p-6 md:p-12">
            <div className="max-w-5xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">O'qituvchi Boshqaruvi</h1>
                        <p className="text-slate-500">Testlarni yarating va holatni kuzating</p>
                    </div>
                    <Button variant="outline" onClick={handleLogout}>Chiqish</Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="shadow-sm">
                        <CardHeader className="bg-blue-50/50 pb-4 border-b border-blue-100">
                            <CardTitle className="text-blue-800">Yangi o'qituvchi Testini Yaratish</CardTitle>
                            <CardDescription>O'quvchilar uchun adaptiv bazaga test qo'shish</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={handleCreateTest} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Test Nomi (yoki Modul nomi)</Label>
                                    <Input required placeholder="Masalan: Optika bo'limi 1-qism" value={title} onChange={(e) => setTitle(e.target.value)} />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 mb-4 block">Barcha qo'shilgan savollarning qiyinlik darajasi dastlab 0.0 logit (odatiy qiyinlik) deb belgilanadi va o'quvchilar ishlagani sari Rasch modeli o'zi to'g'irlab oladi.</p>
                                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                                        Yangi Testni Saqlash
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Mening platformadagi testlarim</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-center p-8 text-slate-400 border-2 border-dashed rounded-lg">
                                Hozircha testlar yo'q
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
