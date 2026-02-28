import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"

const DUMMY_QUESTIONS = [
    { id: "q1", text: "Nyutonning ikkinchi qonuni qanday ifodalanadi?", options: ["F = m/a", "F = m*a", "F = m-a", "F = m+a"], correct: 1, topic: "Dinamika" },
    { id: "q2", text: "Trigonometriyada sin(30°) nimaga teng?", options: ["1", "0", "0.5", "0.866"], correct: 2, topic: "Trigonometriya" },
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

        setResponses([...responses, {
            questionId: currentQ.id,
            isCorrect,
            topic: currentQ.topic
        }])

        if (currentIdx < DUMMY_QUESTIONS.length - 1) {
            setSelected(null)
            setCurrentIdx(currentIdx + 1)
        } else {
            finishTest()
        }
    }

    const finishTest = async () => {
        setLoading(true)
        try {
            // Simulation of hitting the Rasch model MLE endpoint
            // await fetchApi("/tests/analyze", { method: "POST", body: JSON.stringify({ responses, testId: "dummy-test" }) })
            toast.success("Test yakunlandi!", { description: "Natijalar Rasch modeli orqali tahlil qilindi." })
            navigate("/dashboard")
        } catch (e) {
            toast.error("Xatolik", { description: "Natijani saqlashda xato" })
        } finally {
            setLoading(false)
        }
    }

    const currentQ = DUMMY_QUESTIONS[currentIdx]

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-700">Test Jarayoni</h2>
                <span className="text-sm font-medium bg-blue-100 text-blue-800 py-1 px-3 rounded-full">
                    Galdagi savol ({currentIdx + 1}/{DUMMY_QUESTIONS.length})
                </span>
            </div>

            <Card className="flex-grow max-w-4xl mx-auto w-full shadow-md">
                <CardHeader className="bg-slate-50 border-b">
                    <CardTitle className="text-2xl font-serif text-slate-800 leading-relaxed">
                        {currentQ.text}
                    </CardTitle>
                    <CardDescription>Savolni diqqat bilan o'qing va bitta to'g'ri javobni tanlang</CardDescription>
                </CardHeader>

                <CardContent className="pt-8 space-y-4 flex-grow">
                    {currentQ.options.map((opt, idx) => (
                        <div
                            key={idx}
                            onClick={() => setSelected(idx)}
                            className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${selected === idx ? "border-blue-600 bg-blue-50 text-blue-800 font-medium" : "border-slate-200 hover:border-slate-300 bg-white"
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold font-mono ${selected === idx ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                                    }`}>
                                    {String.fromCharCode(65 + idx)}
                                </div>
                                <span>{opt}</span>
                            </div>
                        </div>
                    ))}
                </CardContent>
                <div className="p-6 border-t bg-slate-50 flex justify-end">
                    <Button
                        disabled={selected === null || loading}
                        onClick={handleNext}
                        size="lg"
                        className="px-8 bg-blue-600 hover:bg-blue-700 font-semibold"
                    >
                        {loading ? "Tahlil qilinmoqda..." : (currentIdx === DUMMY_QUESTIONS.length - 1 ? "Testni Yakunlash" : "Keyingi Savol")}
                    </Button>
                </div>
            </Card>
        </div>
    )
}
