import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

export default function Onboarding() {
    const navigate = useNavigate()
    const [data, setData] = useState({ subject: "", level: "", time: "" })
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        setTimeout(() => {
            toast.success("Tayyor!", { description: "Profil muvaffaqiyatli saqlandi" })
            navigate("/dashboard")
            setLoading(false)
        }, 1000)
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle className="text-2xl text-blue-600">Xush Kelibsiz!</CardTitle>
                    <CardDescription>O'quv rejangizni shakllantirish uchun bir nechta savollarga javob bering</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="grid gap-6">
                        <div className="grid gap-2">
                            <Label>Qaysi fandan Milliy Sertifikat olmoqchisiz?</Label>
                            <Select onValueChange={(v) => setData({ ...data, subject: v })}>
                                <SelectTrigger><SelectValue placeholder="Fanni tanlang" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="matematika">Matematika</SelectItem>
                                    <SelectItem value="fizika">Fizika</SelectItem>
                                    <SelectItem value="ingliz-tili">Ingliz tili</SelectItem>
                                    <SelectItem value="tarix">Tarix</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label>O'zingizni hozirgi bilim darajangiz qanday deb bilasiz?</Label>
                            <Select onValueChange={(v) => setData({ ...data, level: v })}>
                                <SelectTrigger><SelectValue placeholder="Darajani tanlang" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="boshlangich">Boshlang'ich (Hech narsa bilmayman)</SelectItem>
                                    <SelectItem value="urtacha">O'rtacha (Asoslarni bilaman)</SelectItem>
                                    <SelectItem value="yaxshi">Yaxshi (Faqat mashq qilish kerak)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label>Kuniga o'rtacha necha soat shug'ullana olasiz?</Label>
                            <Select onValueChange={(v) => setData({ ...data, time: v })}>
                                <SelectTrigger><SelectValue placeholder="Vaqtni tanlang" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1 soat</SelectItem>
                                    <SelectItem value="2">2 soat</SelectItem>
                                    <SelectItem value="3">3+ soat</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Button type="submit" disabled={loading} size="lg" className="w-full mt-4 text-base">
                            {loading ? "Saqlanmoqda..." : "Boshlash"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
