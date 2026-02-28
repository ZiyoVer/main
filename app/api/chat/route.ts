import OpenAI from "openai"
import { NextResponse } from "next/server"

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: "https://api.deepseek.com/v1", // Using deepseek
})

export async function POST(req: Request) {
    try {
        const { messages, studentProfileId } = await req.json()

        // Context Injection: A real app would retrieve weak topics here
        // const weakTopics = await prisma.weakTopic.findMany({ where: { studentProfileId } })

        const systemPrompt = `Sen O'zbekistondagi maqsadli Milliy Sertifikat imtihonlari (Matematika, Fizika, Tarix va h.k) uchun maxsus yaratilgan "msert" aqlli ustozisan. 
Sening vazifang o'quvchilarga qisqa, aniq va tushunarli tilda dars berish.
O'quvchini aslo chalg'itma va murakkab ilmiy atamalarni oddiy til bilan tushuntir.
O'quvchining savollariga to'g'ridan-to'g'ri javob ber.`

        const response = await openai.chat.completions.create({
            model: "deepseek-chat",
            messages: [
                { role: "system", content: systemPrompt },
                ...messages
            ],
            temperature: 0.7,
        })

        return NextResponse.json({
            role: 'assistant',
            content: response.choices[0].message.content
        })
    } catch (error) {
        return NextResponse.json({ error: "AI bog'lanishida xatolik" }, { status: 500 })
    }
}
