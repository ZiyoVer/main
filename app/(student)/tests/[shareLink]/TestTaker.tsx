"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Clock, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react"

interface Question {
  id: string
  type: string
  questionText: string
  options: string[] | null
  orderIndex: number
}

interface TestData {
  id: string
  title: string
  description: string
  timeLimit: number
  subject: string
  questions: Question[]
}

interface Props {
  test: TestData
}

export default function TestTaker({ test }: Props) {
  const router = useRouter()
  const [started, setStarted] = useState(false)
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [timeLeft, setTimeLeft] = useState(test.timeLimit * 60)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState<{ score: number; analysis: string } | null>(null)

  const submit = useCallback(async () => {
    if (submitting || submitted) return
    setSubmitting(true)
    const res = await fetch("/api/student/tests/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testId: test.id, answers }),
    })
    const data = await res.json()
    setResult(data)
    setSubmitted(true)
    setSubmitting(false)
  }, [submitting, submitted, test.id, answers])

  useEffect(() => {
    if (!started || submitted) return
    if (timeLeft <= 0) {
      submit()
      return
    }
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearInterval(timer)
  }, [started, timeLeft, submitted, submit])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const question = test.questions[current]
  const progress = ((current + 1) / test.questions.length) * 100

  if (!started) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h1 className="text-white text-xl font-semibold mb-2">{test.title}</h1>
          <p className="text-slate-400 text-sm mb-1">{test.subject}</p>
          {test.description && <p className="text-slate-400 text-sm mb-4">{test.description}</p>}
          <div className="bg-slate-800 rounded-lg p-4 space-y-2 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Savollar soni:</span>
              <span className="text-white">{test.questions.length} ta</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Vaqt chegarasi:</span>
              <span className="text-white">{test.timeLimit} daqiqa</span>
            </div>
          </div>
          <Button
            onClick={() => setStarted(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            Testni boshlash
          </Button>
        </div>
      </div>
    )
  }

  if (submitted && result) {
    const scorePercent = Math.round(result.score * 100)
    const grade =
      scorePercent >= 90 ? "A+" :
        scorePercent >= 80 ? "A" :
          scorePercent >= 70 ? "B+" :
            scorePercent >= 60 ? "B" :
              scorePercent >= 50 ? "C+" : "C"

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="text-center mb-6">
            <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
            <h2 className="text-white text-xl font-semibold">Test yakunlandi!</h2>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 text-center mb-4">
            <div className="text-5xl font-bold text-blue-400 mb-1">{grade}</div>
            <div className="text-slate-400">{scorePercent}% to&apos;g&apos;ri javob</div>
          </div>
          {result.analysis && (
            <div className="bg-slate-800 rounded-lg p-4 text-slate-300 text-sm whitespace-pre-wrap leading-relaxed mb-4">
              {result.analysis}
            </div>
          )}
          <Button
            onClick={() => router.push("/dashboard")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            Dashboardga qaytish
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <span className="text-white font-medium text-sm">{test.title}</span>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-mono ${timeLeft < 60 ? "bg-red-900/50 text-red-400" : "bg-slate-800 text-slate-300"}`}>
          <Clock size={14} />
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>
      </div>

      {/* Progress */}
      <div className="h-1 bg-slate-800">
        <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
      </div>

      {/* Question */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          <div className="text-slate-400 text-sm mb-3">
            Savol {current + 1} / {test.questions.length}
          </div>
          <h2 className="text-white text-lg font-medium mb-6 leading-relaxed">
            {question.questionText}
          </h2>

          {question.type === "MULTIPLE_CHOICE" && question.options ? (
            <div className="space-y-3">
              {question.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => setAnswers({ ...answers, [question.id]: opt })}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${answers[question.id] === opt
                      ? "border-blue-500 bg-blue-500/10 text-white"
                      : "border-slate-700 text-slate-300 hover:border-slate-600"
                    }`}
                >
                  <span className="font-mono text-slate-500 mr-3">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <Textarea
              value={answers[question.id] || ""}
              onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
              placeholder="Javobingizni yozing..."
              rows={5}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-slate-900 border-t border-slate-800 px-6 py-4 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrent(Math.max(0, current - 1))}
          disabled={current === 0}
          className="border-slate-700 text-slate-300"
        >
          <ChevronLeft size={16} className="mr-1" />
          Oldingi
        </Button>

        <div className="flex gap-1">
          {test.questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-7 h-7 rounded text-xs font-medium transition-all ${i === current
                  ? "bg-blue-600 text-white"
                  : answers[test.questions[i].id]
                    ? "bg-green-700 text-white"
                    : "bg-slate-700 text-slate-400"
                }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {current === test.questions.length - 1 ? (
          <Button
            onClick={submit}
            disabled={submitting}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {submitting ? "Yuklanmoqda..." : "Tugatish"}
          </Button>
        ) : (
          <Button
            onClick={() => setCurrent(Math.min(test.questions.length - 1, current + 1))}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Keyingi
            <ChevronRight size={16} className="ml-1" />
          </Button>
        )}
      </div>
    </div>
  )
}
