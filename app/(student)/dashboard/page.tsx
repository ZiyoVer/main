import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { BrainCircuit, PenSquare, ArrowRight, MessageSquareText } from "lucide-react"
import Link from "next/link"

export default function StudentDashboard() {
    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-12">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* Welcome Banner */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Assalomu alaykum, Talaba!</h1>
                        <p className="text-slate-500 mt-1">Bugungi o'quv rejangiz tayyor. Qaysi birdan boshlaymiz?</p>
                    </div>
                    <Button variant="outline" onClick={() => { }}>Chiqish</Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Main Action Call */}
                    <Card className="col-span-1 md:col-span-2 border-blue-100 shadow-sm bg-blue-50/50">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-blue-800 flex items-center gap-2">
                                <BrainCircuit className="h-6 w-6" /> Qobiliyatga moslashtirilgan Test
                            </CardTitle>
                            <CardDescription className="text-base text-blue-700/80">
                                Sizning hozirgi bilim darajangizga moslangan maxsus test. Undagi xatolarga qarab ustoz sun'iy intellekt sizga mavzular tushuntiradi.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button size="lg" className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-base" asChild>
                                <Link href="/tests">
                                    Testni Boshlash <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Assistant Call */}
                    <Card className="shadow-sm">
                        <CardHeader className="pb-4">
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquareText className="h-5 w-5 text-emerald-600" /> Aqlli Ustoz
                            </CardTitle>
                            <CardDescription>Savollaringiz bormi? Fanga oid xohlagan savolingizni bering.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button size="lg" variant="outline" className="w-full border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" asChild>
                                <Link href="/chat">
                                    Yordam so'rash
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <Separator />

                {/* Progress Display */}
                <div>
                    <h2 className="text-xl font-semibold mb-4">O'zlashtirish holati</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">Takrorlash kerak bo'lgan mavzular</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-wrap gap-2">
                                <Badge variant="destructive" className="px-3 py-1">Trigonometriya (+14 xato)</Badge>
                                <Badge variant="destructive" className="px-3 py-1">Nyuton qonunlari (+5 xato)</Badge>
                                <Badge variant="outline" className="px-3 py-1">Kinetematika</Badge>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">Statistika</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500">Ishlangan testlar:</span>
                                    <span className="font-medium text-lg">12 ta</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500">O'rtacha natija:</span>
                                    <span className="font-medium text-lg text-emerald-600">68%</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
