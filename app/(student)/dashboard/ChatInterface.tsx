"use client"

import { useState, useRef, useEffect } from "react"
import { signOut } from "next-auth/react"
import { Send, LogOut, BookOpen, Brain, Target, Calendar, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface Message {
  role: "user" | "assistant"
  content: string
}

interface Profile {
  id: string
  currentLevel: string
  targetGrade: string
  availableDays: number
  hoursPerDay: number
  subject: { id: string; name: string }
  weakTopics: { topic: string; mistakeCount: number }[]
}

interface Props {
  profile: Profile
  initialMessages: Message[]
  conversationId: string | null
  userName: string
}

const GRADE_LABELS: Record<string, string> = {
  A_PLUS: "A+",
  A: "A",
  B_PLUS: "B+",
  B: "B",
  C_PLUS: "C+",
  C: "C",
}

const QUICK_ACTIONS = [
  { icon: Brain, label: "Bilimni baholash", prompt: "Mening bilim darajamni baholash uchun 5 ta savol ber" },
  { icon: Target, label: "Zaif mavzularim", prompt: "Mening zaif tomonlarimni tahlil qilib, qanday yaxshilash mumkinligini ayt" },
  { icon: BookOpen, label: "Mavzu tushuntir", prompt: "Eng muhim mavzulardan birini tushuntir" },
  { icon: Calendar, label: "Bugungi reja", prompt: "Bugun nima o'rganishim kerakligini reja qilib ber" },
]

export default function ChatInterface({ profile, initialMessages, conversationId, userName }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [convId, setConvId] = useState(conversationId)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function sendMessage(content: string) {
    if (!content.trim() || loading) return
    const userMsg: Message = { role: "user", content: content.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)

    const assistantMsg: Message = { role: "assistant", content: "" }
    setMessages((prev) => [...prev, assistantMsg])

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content.trim(),
          conversationId: convId,
        }),
      })

      if (!res.ok) throw new Error("Request failed")
      if (!res.body) throw new Error("No response body")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ""

      const newConvId = res.headers.get("X-Conversation-Id")
      if (newConvId) setConvId(newConvId)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split("\n")
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)
            if (data === "[DONE]") break
            try {
              const parsed = JSON.parse(data)
              const text = parsed.choices?.[0]?.delta?.content || ""
              full += text
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: "assistant", content: full }
                return updated
              })
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Xatolik yuz berdi. Iltimos qayta urinib ko'ring.",
        }
        return updated
      })
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex h-screen bg-slate-950">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-white font-semibold text-sm">Milliy Sertifikat AI</h1>
          <p className="text-slate-400 text-xs mt-1">{userName}</p>
        </div>

        <div className="p-4 border-b border-slate-800">
          <div className="bg-slate-800 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Fan:</span>
              <span className="text-white">{profile.subject.name}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Maqsad:</span>
              <span className="text-blue-400 font-semibold">{GRADE_LABELS[profile.targetGrade]}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Qolgan kun:</span>
              <span className="text-white">{profile.availableDays}</span>
            </div>
          </div>
        </div>

        {profile.weakTopics.length > 0 && (
          <div className="p-4 border-b border-slate-800">
            <p className="text-slate-400 text-xs mb-2">Zaif mavzular</p>
            {profile.weakTopics.map((t) => (
              <div key={t.topic} className="flex items-center justify-between py-1">
                <span className="text-slate-300 text-xs truncate">{t.topic}</span>
                <span className="text-red-400 text-xs ml-1">{t.mistakeCount}</span>
              </div>
            ))}
          </div>
        )}

        <div className="p-4 space-y-2">
          <p className="text-slate-400 text-xs mb-2">Tezkor harakatlar</p>
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => sendMessage(action.prompt)}
              disabled={loading}
              className="w-full flex items-center gap-2 p-2 rounded-lg text-left text-xs text-slate-400 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
            >
              <action.icon size={14} />
              <span>{action.label}</span>
              <ChevronRight size={12} className="ml-auto" />
            </button>
          ))}
        </div>

        <div className="mt-auto p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <LogOut size={14} className="mr-2" />
            Chiqish
          </Button>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4">
                <Brain size={32} className="text-white" />
              </div>
              <h2 className="text-white text-xl font-semibold mb-2">Assalomu alaykum, {userName}!</h2>
              <p className="text-slate-400 max-w-md">
                Men siz bilan {profile.subject.name} fanidan birga tayyorlanaman. Savol bering yoki chap tarafdagi tezkor harakatlardan foydalaning.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-200"
                }`}
              >
                {msg.content || (loading && i === messages.length - 1 ? (
                  <span className="flex gap-1">
                    <span className="animate-bounce">.</span>
                    <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>.</span>
                  </span>
                ) : "")}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex gap-3 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Savol yozing... (Enter — yuborish, Shift+Enter — yangi qator)"
              rows={1}
              className="flex-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 resize-none min-h-[44px] max-h-32"
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white h-11 w-11 p-0"
            >
              <Send size={18} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
