"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area" // Simplified to standard div for now to avoid extra installs
import { ArrowLeft, Send } from "lucide-react"
import Link from "next/link"

type Message = { role: "user" | "assistant", content: string }

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([
        { role: "assistant", content: "Assalomu alaykum! Men sizning aqlli ustozingizman. Qaysi mavzuda yordam bera olaman?" }
    ])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim()) return

        const newMsgs: Message[] = [...messages, { role: "user", content: input }]
        setMessages(newMsgs)
        setInput("")
        setLoading(true)

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: newMsgs, studentProfileId: "current_user_id" })
            })
            const data = await res.json()
            if (data.role) {
                setMessages([...newMsgs, { role: data.role, content: data.content }])
            }
        } catch (e) {
            setMessages([...newMsgs, { role: "assistant", content: "Kechirasiz, xatolik yuz berdi. Iltimos qayta urinib ko'ring." }])
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex flex-col items-center">
            <div className="w-full max-w-3xl mb-4">
                <Button variant="ghost" asChild className="mb-4">
                    <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Bosh sahifaga qaytish</Link>
                </Button>
            </div>

            <Card className="w-full max-w-3xl flex-grow flex flex-col mt-4 min-h-[70vh]">
                <CardHeader className="border-b bg-emerald-50">
                    <CardTitle className="text-emerald-800 flex items-center gap-2">
                        msert Sun'iy Intellekt Ustozi
                    </CardTitle>
                </CardHeader>

                <CardContent className="flex-grow flex flex-col p-4 gap-4">
                    <div className="flex-grow overflow-y-auto space-y-4 max-h-[50vh] pr-4">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`p-3 rounded-lg max-w-[85%] ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="p-3 rounded-lg bg-slate-100 text-slate-500 animate-pulse">
                                    Ustoz o'ylamoqda...
                                </div>
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleSend} className="flex gap-2 pt-4 border-t mt-auto">
                        <Input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="Savolingizni yozing..."
                            className="flex-grow"
                            disabled={loading}
                        />
                        <Button type="submit" disabled={loading} className="px-6 bg-emerald-600 hover:bg-emerald-700">
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
