import React, { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Send, BrainCircuit, User } from "lucide-react"
import { Link } from "react-router-dom"
import { fetchApi } from "@/lib/api"

type Message = { role: "user" | "assistant", content: string }

export default function Chat() {
    const [messages, setMessages] = useState<Message[]>([
        { role: "assistant", content: "Assalomu alaykum! Men sizning shaxsiy AI ustozingizman. 🧠\n\nQaysi mavzuda yordam bera olaman? Masalan:\n• Formulalarni tushuntirish\n• Masala yechish usullari\n• Nazariy savollar" }
    ])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim()) return

        const newMsgs: Message[] = [...messages, { role: "user", content: input }]
        setMessages(newMsgs)
        setInput("")
        setLoading(true)

        try {
            const data = await fetchApi("/chat", {
                method: "POST",
                body: JSON.stringify({ messages: newMsgs })
            })
            if (data.role) {
                setMessages([...newMsgs, { role: data.role as "assistant", content: data.content }])
            }
        } catch {
            setMessages([...newMsgs, { role: "assistant", content: "Kechirasiz, xatolik yuz berdi. Iltimos qayta urinib ko'ring." }])
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen bg-gradient-auth flex flex-col">
            {/* Top Bar */}
            <header className="glass-light sticky top-0 z-40 border-b border-slate-200/50">
                <div className="max-w-4xl mx-auto flex items-center gap-4 py-3 px-6">
                    <Button variant="ghost" size="sm" asChild className="text-slate-500 hover:text-slate-700">
                        <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                            <BrainCircuit className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-slate-900 text-sm">AI Ustoz</h1>
                            <p className="text-xs text-emerald-600 font-medium">Online</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Messages */}
            <div className="flex-grow overflow-y-auto">
                <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in-up`}>
                            {msg.role === "assistant" && (
                                <div className="h-8 w-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0 mt-1 shadow-md shadow-emerald-200">
                                    <BrainCircuit className="h-4 w-4 text-white" />
                                </div>
                            )}
                            <div className={`max-w-[80%] px-5 py-3.5 rounded-2xl whitespace-pre-wrap text-[15px] leading-relaxed ${msg.role === "user"
                                    ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-br-md shadow-lg shadow-blue-200"
                                    : "bg-white text-slate-800 border border-slate-100 shadow-sm rounded-bl-md"
                                }`}>
                                {msg.content}
                            </div>
                            {msg.role === "user" && (
                                <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 mt-1 shadow-md shadow-blue-200">
                                    <User className="h-4 w-4 text-white" />
                                </div>
                            )}
                        </div>
                    ))}
                    {loading && (
                        <div className="flex gap-3 animate-fade-in-up">
                            <div className="h-8 w-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-200">
                                <BrainCircuit className="h-4 w-4 text-white" />
                            </div>
                            <div className="bg-white border border-slate-100 px-5 py-4 rounded-2xl rounded-bl-md shadow-sm">
                                <div className="flex gap-1.5">
                                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>
            </div>

            {/* Input */}
            <div className="glass-light border-t border-slate-200/50 sticky bottom-0 z-40">
                <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-3 px-6 py-4">
                    <Input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Savolingizni yozing..."
                        className="flex-grow h-12 rounded-xl border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        disabled={loading}
                    />
                    <Button type="submit" disabled={loading} className="h-12 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-200">
                        <Send className="h-5 w-5" />
                    </Button>
                </form>
            </div>
        </div>
    )
}
