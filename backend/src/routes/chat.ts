import { Router } from 'express'
import prisma from '../utils/db'
import { authenticate, AuthRequest } from '../middleware/auth'
import OpenAI from 'openai'

const router = Router()

const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.OPENAI_API_KEY || ''
})

function buildSystemPrompt(profile: any, subject?: string): string {
    const now = new Date()
    let daysLeft = ''
    if (profile?.examDate) {
        const diff = Math.ceil((new Date(profile.examDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        if (diff > 0) daysLeft = `Imtihon sanasi: ${new Date(profile.examDate).toLocaleDateString('uz')} (${diff} kun qoldi).`
        else daysLeft = 'Imtihon sanasi o\'tgan.'
    }

    const weakTopics = profile?.weakTopics ? JSON.parse(profile.weakTopics) : []
    const strongTopics = profile?.strongTopics ? JSON.parse(profile.strongTopics) : []

    return `Sen "msert" platformasining AI ustozisan — tajribali pedagog. Faqat o'zbek tilida gaplashasan.

# SEN KIM
Sen Milliy Sertifikat imtihoniga o'quvchilarni tayyorlaydigan tajribali pedagog-ustozsan. Sen samimiy, sabr-toqatli va motivatsiya beradigasan.

# O'QUVCHI HAQIDA
${subject ? `Fan: ${subject}` : ''}
${daysLeft}
${weakTopics.length > 0 ? `O'quvchi qiyin dega mavzular: ${weakTopics.join(', ')}` : ''}
${strongTopics.length > 0 ? `O'quvchi yaxshi biladigan mavzular: ${strongTopics.join(', ')}` : ''}
${profile?.targetScore ? `Maqsad ball: ${profile.targetScore}` : ''}
${profile?.concerns ? `Tashvishi: ${profile.concerns}` : ''}

# XULQ-ATVOR QOIDALARI (juda muhim!)

1. **BOSHIDA TEST TAKLIF QIL**: Birinchi suhbatda: "Keling avval bilimingizni tekshirib olaylik, shunda to'g'ri yo'nalishda ishlaymiz" de va 5-10 ta savol ber.
2. **ZAIF MAVZULARGA SHOSHILMA**: O'quvchi zaif mavzularni kiritgan bo'lsa ham, darhol o'sha mavzudan dars boshLAMA. Avval o'quvchi bilan gaplashib, uning haqiqiy bilim darajasini aniqla.
3. **REJALASH**: O'quvchi bilan birgalikda o'quv reja tuz. "Sizningcha qaysi mavzudan boshlaylik?" deb so'ra.
4. **PEDAGOG BO'L**: Faqat javob berma — o'rgatadigan ustozday bo'l. Misollar, qiyoslashlar, hayotiy parallelllar ishlatib tushuntir.
5. **QISQACHA YOZMA**: Har bir javobning oxirida qisqacha savol bilan davom ettir. Bir marta juda ko'p narsa tashLAMA.
6. **PROGRESSNI KUZAT**: O'quvchi nimani o'rgandisA eslab qol. "O'tgan safar X ni o'rgandik, endi Y ga o'tamiz" degin.
7. **MOTIVATSIYA**: Har bir muvaffaqiyatni ta'kidla. "Juda yaxshi! To'g'ri javob berdingiz!" de.
8. **VAQTNI HISOBLA**: ${daysLeft ? daysLeft + ' Buni eslatib tur va reja tuz.' : 'Imtihon sanasi noaniq, lekin rejali ishlashga undagin.'}
9. **FORMATLASH**: Javoblaringda Markdown ishlat:
   - **Muhim tushunchalar** qalin bo'lsin
   - Ro'yxatlarni raqamlab yoki bullet bilan yoz
   - Misollarni alohida ajrat
   - Formulalarni aniq yoz
10. **BIR CHATDA KO'P MAVZU**: O'quvchi bitta chatda turli mavzular so'rashi mumkin — hammasiga javob ber va kontekstni eslab qol.

Hozirgi sana: ${now.toLocaleDateString('uz-UZ')}.`
}

// Yangi chat ochish
router.post('/new', authenticate, async (req: AuthRequest, res) => {
    try {
        const { subject, title } = req.body
        const chat = await prisma.chat.create({
            data: {
                userId: req.user.id,
                title: title || `${subject || 'Umumiy'} suhbat`,
                subject: subject || null
            }
        })
        res.status(201).json(chat)
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Barcha chatlar ro'yxati
router.get('/list', authenticate, async (req: AuthRequest, res) => {
    try {
        const chats = await prisma.chat.findMany({
            where: { userId: req.user.id },
            orderBy: { updatedAt: 'desc' },
            select: { id: true, title: true, subject: true, updatedAt: true }
        })
        res.json(chats)
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Chat xabarlarini olish
router.get('/:chatId/messages', authenticate, async (req: AuthRequest, res) => {
    try {
        const chat = await prisma.chat.findFirst({
            where: { id: (req.params.chatId as string), userId: req.user.id }
        })
        if (!chat) return res.status(404).json({ error: 'Chat topilmadi' })

        const messages = await prisma.message.findMany({
            where: { chatId: chat.id },
            orderBy: { createdAt: 'asc' }
        })
        res.json({ chat, messages })
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Streaming xabar yuborish (SSE)
router.post('/:chatId/stream', authenticate, async (req: AuthRequest, res) => {
    try {
        const { content } = req.body
        if (!content?.trim()) return res.status(400).json({ error: 'Xabar bo\'sh' })

        const chat = await prisma.chat.findFirst({
            where: { id: (req.params.chatId as string), userId: req.user.id }
        })
        if (!chat) return res.status(404).json({ error: 'Chat topilmadi' })

        // Foydalanuvchi xabarini saqlash
        await prisma.message.create({
            data: { chatId: chat.id, role: 'user', content }
        })

        // Oldingi xabarlar
        const history = await prisma.message.findMany({
            where: { chatId: chat.id },
            orderBy: { createdAt: 'asc' },
            take: 50
        })

        // Profile olish
        const profile = await prisma.studentProfile.findUnique({
            where: { userId: req.user.id }
        })

        // RAG kontekst
        let ragContext = ''
        try {
            const chunks = await prisma.documentChunk.findMany({
                where: { document: { subject: chat.subject || undefined } },
                take: 5,
                orderBy: { createdAt: 'desc' }
            })
            if (chunks.length > 0) {
                ragContext = '\n\nTEGISHLI O\'QUV MATERIALLARI:\n' + chunks.map(c => c.content).join('\n---\n')
            }
        } catch { }

        const systemPrompt = buildSystemPrompt(profile, chat.subject || undefined) + ragContext

        const messages: any[] = [
            { role: 'system', content: systemPrompt },
            ...history.map(m => ({ role: m.role, content: m.content }))
        ]

        // SSE headers
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.flushHeaders()

        let fullReply = ''

        const stream = await openai.chat.completions.create({
            model: 'deepseek-chat',
            messages,
            max_tokens: 4096,
            temperature: 0.7,
            stream: true
        })

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || ''
            if (delta) {
                fullReply += delta
                res.write(`data: ${JSON.stringify({ content: delta })}\n\n`)
            }
        }

        // Stream tugagandan keyin bazaga saqlash
        const saved = await prisma.message.create({
            data: { chatId: chat.id, role: 'assistant', content: fullReply }
        })

        // Chat title yangilash (birinchi xabar bo'lsa)
        if (history.length <= 2) {
            const shortTitle = content.substring(0, 40) + (content.length > 40 ? '...' : '')
            await prisma.chat.update({ where: { id: chat.id }, data: { title: shortTitle } })
        }

        res.write(`data: ${JSON.stringify({ done: true, id: saved.id })}\n\n`)
        res.end()
    } catch (e: any) {
        console.error('AI stream error:', e.message)
        if (!res.headersSent) {
            res.status(500).json({ error: 'AI javob bera olmadi' })
        } else {
            res.write(`data: ${JSON.stringify({ error: 'AI xatoligi' })}\n\n`)
            res.end()
        }
    }
})

// Eski non-streaming endpoint (fallback)
router.post('/:chatId/send', authenticate, async (req: AuthRequest, res) => {
    try {
        const { content } = req.body
        if (!content?.trim()) return res.status(400).json({ error: 'Xabar bo\'sh' })

        const chat = await prisma.chat.findFirst({
            where: { id: (req.params.chatId as string), userId: req.user.id }
        })
        if (!chat) return res.status(404).json({ error: 'Chat topilmadi' })

        await prisma.message.create({
            data: { chatId: chat.id, role: 'user', content }
        })

        const history = await prisma.message.findMany({
            where: { chatId: chat.id },
            orderBy: { createdAt: 'asc' },
            take: 50
        })

        const profile = await prisma.studentProfile.findUnique({
            where: { userId: req.user.id }
        })

        let ragContext = ''
        try {
            const chunks = await prisma.documentChunk.findMany({
                where: { document: { subject: chat.subject || undefined } },
                take: 5,
                orderBy: { createdAt: 'desc' }
            })
            if (chunks.length > 0) {
                ragContext = '\n\nTEGISHLI O\'QUV MATERIALLARI:\n' + chunks.map(c => c.content).join('\n---\n')
            }
        } catch { }

        const systemPrompt = buildSystemPrompt(profile, chat.subject || undefined) + ragContext
        const msgs: any[] = [
            { role: 'system', content: systemPrompt },
            ...history.map(m => ({ role: m.role, content: m.content }))
        ]

        const completion = await openai.chat.completions.create({
            model: 'deepseek-chat',
            messages: msgs,
            max_tokens: 4096,
            temperature: 0.7
        })

        const reply = completion.choices[0]?.message?.content || 'Javob olinmadi'
        const saved = await prisma.message.create({
            data: { chatId: chat.id, role: 'assistant', content: reply }
        })

        if (history.length <= 2) {
            const shortTitle = content.substring(0, 40) + (content.length > 40 ? '...' : '')
            await prisma.chat.update({ where: { id: chat.id }, data: { title: shortTitle } })
        }

        res.json(saved)
    } catch (e: any) {
        console.error('AI error:', e.message)
        res.status(500).json({ error: 'AI javob bera olmadi' })
    }
})

// Chat o'chirish
router.delete('/:chatId', authenticate, async (req: AuthRequest, res) => {
    try {
        await prisma.chat.deleteMany({
            where: { id: (req.params.chatId as string), userId: req.user.id }
        })
        res.json({ message: 'Chat o\'chirildi' })
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

export default router
