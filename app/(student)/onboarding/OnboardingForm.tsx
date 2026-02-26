"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

interface Subject {
  id: string
  name: string
}

interface Props {
  subjects: Subject[]
}

const GRADES = [
  { value: "A_PLUS", label: "A+ (eng yuqori)" },
  { value: "A", label: "A" },
  { value: "B_PLUS", label: "B+" },
  { value: "B", label: "B" },
  { value: "C_PLUS", label: "C+" },
  { value: "C", label: "C" },
]

const LEVELS = [
  "Boshlang'ich (asoslarni bilaman)",
  "O'rta (ba'zi mavzularni tushunaman)",
  "Yuqori (asosan tayyorman)",
]

export default function OnboardingForm({ subjects }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [motivation, setMotivation] = useState("")
  const [form, setForm] = useState({
    subjectId: subjects[0]?.id || "",
    currentLevel: LEVELS[0],
    targetGrade: "A",
    availableDays: 30,
    hoursPerDay: 2,
  })

  const steps = [
    {
      title: "Qaysi fandan tayyorlanasiz?",
      content: (
        <div className="grid grid-cols-1 gap-3">
          {subjects.map((s) => (
            <button
              key={s.id}
              onClick={() => setForm({ ...form, subjectId: s.id })}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                form.subjectId === s.id
                  ? "border-blue-500 bg-blue-500/10 text-white"
                  : "border-slate-700 text-slate-400 hover:border-slate-600"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: "Hozirgi darajangiz qanday?",
      content: (
        <div className="grid grid-cols-1 gap-3">
          {LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => setForm({ ...form, currentLevel: level })}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                form.currentLevel === level
                  ? "border-blue-500 bg-blue-500/10 text-white"
                  : "border-slate-700 text-slate-400 hover:border-slate-600"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: "Qaysi bahoni olmoqchisiz?",
      content: (
        <div className="grid grid-cols-2 gap-3">
          {GRADES.map((g) => (
            <button
              key={g.value}
              onClick={() => setForm({ ...form, targetGrade: g.value })}
              className={`p-4 rounded-lg border-2 text-center transition-all ${
                form.targetGrade === g.value
                  ? "border-blue-500 bg-blue-500/10 text-white"
                  : "border-slate-700 text-slate-400 hover:border-slate-600"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: "Imtihongacha necha kun bor?",
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <span className="text-5xl font-bold text-blue-400">{form.availableDays}</span>
            <span className="text-slate-400 ml-2">kun</span>
          </div>
          <input
            type="range"
            min={7}
            max={180}
            value={form.availableDays}
            onChange={(e) => setForm({ ...form, availableDays: Number(e.target.value) })}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-slate-500 text-sm">
            <span>7 kun</span>
            <span>180 kun</span>
          </div>
        </div>
      ),
    },
    {
      title: "Kuniga necha soat o'qiy olasiz?",
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <span className="text-5xl font-bold text-blue-400">{form.hoursPerDay}</span>
            <span className="text-slate-400 ml-2">soat</span>
          </div>
          <input
            type="range"
            min={1}
            max={8}
            value={form.hoursPerDay}
            onChange={(e) => setForm({ ...form, hoursPerDay: Number(e.target.value) })}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-slate-500 text-sm">
            <span>1 soat</span>
            <span>8 soat</span>
          </div>
        </div>
      ),
    },
  ]

  async function handleFinish() {
    setLoading(true)
    const res = await fetch("/api/student/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (res.ok) {
      setMotivation(data.motivation)
      setStep(steps.length)
    }
    setLoading(false)
  }

  if (step === steps.length && motivation) {
    return (
      <Card className="w-full max-w-lg bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-xl">Tabriklaymiz!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-slate-800 rounded-lg p-4 text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">
            {motivation}
          </div>
          <Button
            onClick={() => router.push("/dashboard")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            Boshlash
          </Button>
        </CardContent>
      </Card>
    )
  }

  const current = steps[step]

  return (
    <Card className="w-full max-w-lg bg-slate-900 border-slate-800">
      <CardHeader>
        <div className="flex gap-1 mb-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all ${
                i <= step ? "bg-blue-500" : "bg-slate-700"
              }`}
            />
          ))}
        </div>
        <Label className="text-slate-400 text-sm">
          {step + 1} / {steps.length}
        </Label>
        <CardTitle className="text-white text-xl">{current.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {current.content}
        <div className="flex gap-3">
          {step > 0 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              className="flex-1 border-slate-700 text-slate-300"
            >
              Orqaga
            </Button>
          )}
          <Button
            onClick={step === steps.length - 1 ? handleFinish : () => setStep(step + 1)}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? "Yuklanmoqda..." : step === steps.length - 1 ? "Tugatish" : "Keyingi"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
