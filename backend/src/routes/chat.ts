import { Router } from 'express'
import { authenticate } from '../middlewares/authMiddleware'
import OpenAI from "openai"

const router = Router()

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: "https://api.deepseek.com/v1",
})

router.post('/', authenticate, async (req, res) => {
    try {
        const { messages } = req.body

        const systemPrompt = `Sen O'zbekistondagi maqsadli Milliy Sertifikat imtihonlari uchun maxsus yaratilgan "msert" aqlli ustozisan. 
Sening vazifang o'quvchilarga qisqa, aniq va tushunarli tilda dars berish.
O'quvchini aslo chalg'itma va murakkab ilmiy atamalarni oddiy til bilan tushuntir.`

        const response = await openai.chat.completions.create({
            model: "deepseek-chat",
            messages: [
                { role: "system", content: systemPrompt },
                ...messages
            ],
            temperature: 0.7,
        })

        res.json({
            role: 'assistant',
            content: response.choices[0].message.content
        })
    } catch (error) {
        res.status(500).json({ error: "AI bog'lanishida xatolik" })
    }
})

export default router
