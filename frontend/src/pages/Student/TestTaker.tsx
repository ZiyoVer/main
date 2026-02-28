import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import { BrainCircuit, ArrowLeft, CheckCircle2 } from "lucide-react"
import { Link } from "react-router-dom"

const DUMMY_QUESTIONS = [
    { id: "q1", text: "Nyutonning ikkinchi qonuni qanday ifodalanadi?", options: ["F = m/a", "F = m·a", "F = m−a", "F = m+a"], correct: 1, topic: "Dinamika" },
    { id: "q2", text: "Trigonometriyada sin(30°) nimaga teng?", options: ["1", "0", "0.5", "0.866"], correct: 2, topic: "Trigonometriya" },
    { id: "q3", text: "1 km/soat necha m/s ga teng?", options: ["1 m/s", "3.6 m/s", "0.28 m/s", "10 m/s"], correct: 2, topic: "Kinematika" },
]

export default function TestTaker() {
    const navigate = useNavigate()
    const [currentIdx, setCurrentIdx] = useState(0)
    const [selected, setSelected] = useState<number | null>(null)
    const [loading, setLoading] = useState(false)
    const [responses, setResponses] = useState<any[]>([])

    const handleNext = async () => {
        if (selected === null) return

        const currentQ = DUMMY_QUESTIONS[currentIdx]
        const isCorrect = selected === currentQ.correct

        setResponses([...responses, { questionId: currentQ.id, isCorrect, topic: currentQ.topic }])

        if (currentIdx < DUMMY_QUESTIONS.length - 1) {
            setSelected(null)
            setCurrentIdx(currentIdx + 1)
        } else {
            finishTest()
        }
    }

    const finishTest = async () => {
        setLoading(true)
        setTimeout(() => {
            toast.success("Test yakunlandi!", { description: "Natijalar Rasch modeli orqali tahlil qilindi." })
            navigate("/dashboard")
        }, 1500)
    }

    const currentQ = DUMMY_QUESTIONS[currentIdx]
    const progress = ((currentIdx + 1) / DUMMY_QUESTIONS.length) * 100

    return (
        <div className="min-h-screen bg-gradient-auth flex flex-col">
            {/* Header */}
            <header className="glass-light sticky top-0 z-40 border-b border-slate-200/50">
                <div className="max-w-4xl mx-auto flex items-center justify-between py-3 px-6">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" asChild className="text-slate-500">
                            <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
                        </Button>
                        <div className="flex items-center gap-2">
                            <BrainCircuit className="h-5 w-5 text-blue-600" />
                            <span className="font-bold text-slate-900 text-sm">Adaptiv Test</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-slate-400">{currentIdx + 1} / {DUMMY_QUESTIONS.length}</span>
                        <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                </div>
            </header>

            {/* Question Area */}
            <div className="flex-grow flex items-center justify-center p-6">
                <div className="w-full max-w-2xl animate-fade-in-up">
                    <Card className="rounded-3xl border-0 shadow-2xl shadow-slate-200/50 bg-white overflow-hidden">
                        <CardHeader className="pb-6 pt-10 px-10">
                            <p className="text-xs font-semibold text-blue-600 tracking-wider uppercase mb-3">Savol {currentIdx + 1}</p>
                            <CardTitle className="text-2xl md:text-3xl font-bold text-slate-900 leading-snug tracking-tight">
                                {currentQ.text}
                            </CardTitle>
                        </CardHeader>

                        <CardContent className="px-10 pb-10 space-y-3">
                            {currentQ.options.map((opt, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => setSelected(idx)}
                                    className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-200 ${selected === idx
                                            ? "bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-500 shadow-lg shadow-blue-100"
                                            : "border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 bg-white"
                                        }`}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-200 ${selected === idx
                                            ? "bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-200"
                                            : "bg-slate-100 text-slate-500"
                                        }`}>
                                        {selected === idx ? <CheckCircle2 className="h-5 w-5" /> : String.fromCharCode(65 + idx)}
                                    </div>
                                    <span className={`text-base ${selected === idx ? "font-semibold text-blue-800" : "text-slate-700"}`}>{opt}</span>
                                </div>
                            ))}

                            <div className="pt-6">
                                <Button
                                    disabled={selected === null || loading}
                                    onClick={handleNext}
                                    size="lg"
                                    className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 shadow-lg shadow-blue-200 disabled:opacity-40 disabled:shadow-none transition-all"
                                >
                                    {loading ? "Tahlil qilinmoqda..." : (currentIdx === DUMMY_QUESTIONS.length - 1 ? "Testni Yakunlash" : "Keyingi Savol →")}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
