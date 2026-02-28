"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

export default function RegisterPage() {
    const router = useRouter()
    const [data, setData] = useState({ name: "", email: "", password: "", role: "STUDENT" })
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })

            if (res.ok) {
                toast.success("Muvaffaqiyatli", { description: "Akkaunt yaratildi" })
                router.push("/login")
            } else {
                toast.error("Xatolik", { description: "Ma'lumotlar xato yuborildi" })
            }
        } catch (e) {
            toast.error("Xatolik", { description: "Server bilan bog'lanishda xato" })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex justify-center items-center min-h-screen bg-slate-50">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-2xl">Ro'yxatdan O'tish</CardTitle>
                    <CardDescription>
                        Yangi akkaunt yaratish uchun ma'lumotlarni kiriting
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Ism</Label>
                            <Input id="name" required value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" required value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password">Parol</Label>
                            <Input id="password" type="password" required value={data.password} onChange={(e) => setData({ ...data, password: e.target.value })} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Rol (Kim bo'lib kirmasiz?)</Label>
                            <Select value={data.role} onValueChange={(v) => setData({ ...data, role: v })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Rolni tanlang" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="STUDENT">Talaba</SelectItem>
                                    <SelectItem value="TEACHER">O'qituvchi</SelectItem>
                                    <SelectItem value="ADMIN">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Kutilmoqda..." : "Ro'yxatdan O'tish"}
                        </Button>
                    </form>
                    <div className="mt-4 text-center text-sm">
                        Akkauntingiz bormi?{" "}
                        <a href="/login" className="underline">
                            Kirish
                        </a>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
