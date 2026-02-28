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
        daysLeft = `O'quvchining imtihoniga ${diff} kun qolgan.`
    }

    return `Sen "msert" ta'lim platformasining AI ustozisan. O'zbek tilida gaplashasan.

ROLI: O'quvchini Milliy Sertifikat imtihoniga tayyorlash.
${subject ? `FAN: ${subject}` : ''}
${daysLeft}
${profile?.weakTopics ? `ZAIF MAVZULAR: ${profile.weakTopics}` : ''}
${profile?.strongTopics ? `KUCHLI MAVZULAR: ${profile.strongTopics}` : ''}
${profile?.targetScore ? `MAQSAD BALL: ${profile.targetScore}` : ''}

QOIDALAR:
1. Faqat tanlangan fan bo'yicha ishla. Boshqa mavzularda savolga qisqa javob berib, asosiy maqsadga qaytargin.
2. Imtihongacha qolgan vaqtni doimo hisobga ol, eslatib tur.
3. O'quv rejalari tuz va progressni kuzat.
4. Batafsil, misollar bilan tushuntir. Token tejamagin.
5. Mavzu tayyorlanganida test taklif qil.
6. Xatolarni birma-bir tahlil qil.
7. O'quvchini doimo rag'batlantirib, motivatsiya ber.
8. Hozirgi sana: ${now.toLocaleDateString('uz-UZ')}.`
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

// Xabar yuborish va AI javob olish
router.post('/:chatId/send', authenticate, async (req: AuthRequest, res) => {
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
            take: 50 // Oxirgi 50 xabar
        })

        // Profile olish
        const profile = await prisma.studentProfile.findUnique({
            where: { userId: req.user.id }
        })

        // RAG kontekst — tegishli materiallarni qidirish
        let ragContext = ''
        try {
            const chunks = await prisma.documentChunk.findMany({
                where: {
                    document: { subject: chat.subject || undefined }
                },
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

        const completion = await openai.chat.completions.create({
            model: 'deepseek-chat',
            messages,
            max_tokens: 4096,
            temperature: 0.7
        })

        const reply = completion.choices[0]?.message?.content || 'Javob olinmadi'

        // AI javobini saqlash
        const saved = await prisma.message.create({
            data: { chatId: chat.id, role: 'assistant', content: reply }
        })

        // Chat title yangilash (birinchi xabar bo'lsa)
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
