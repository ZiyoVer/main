import { Router } from 'express'
import multer from 'multer'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import prisma from '../utils/db'
import { authenticate, AuthRequest } from '../middleware/auth'
import OpenAI from 'openai'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } })

const router = Router()

const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.OPENAI_API_KEY || ''
})

async function getAISettings(): Promise<{ temperature: number; maxTokens: number; extraRules: string }> {
    const defaults = { temperature: 0.7, maxTokens: 4096, extraRules: '' }
    try {
        const settings = await prisma.aISetting.findMany()
        for (const s of settings) {
            if (s.key === 'temperature') defaults.temperature = parseFloat(s.value) || 0.7
            if (s.key === 'max_tokens') defaults.maxTokens = parseInt(s.value) || 4096
            if (s.key === 'extra_rules') defaults.extraRules = s.value
        }
    } catch { }
    return defaults
}

function buildSystemPrompt(profile: any, subject?: string, extraRules?: string): string {
    const now = new Date()
    let daysLeft = ''
    if (profile?.examDate) {
        const diff = Math.ceil((new Date(profile.examDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        if (diff > 0) daysLeft = `Imtihon sanasi: ${new Date(profile.examDate).toLocaleDateString('uz')} (${diff} kun qoldi).`
        else daysLeft = 'Imtihon sanasi o\'tgan.'
    }

    let weakTopics: string[] = []
    let strongTopics: string[] = []
    try { weakTopics = profile?.weakTopics ? JSON.parse(profile.weakTopics) : [] } catch { }
    try { strongTopics = profile?.strongTopics ? JSON.parse(profile.strongTopics) : [] } catch { }

    return `Sen "msert" platformasining AI pedagog-ustozisan. O'zbek tilida ishla.

# 🎓 SENING ROLIN
Sen — tajribali, sabr-toqatli, samimiy Milliy Sertifikat ustozi. Oddiy tushunarli tilda gapirasanng. Sen o'quvchini imtihonga eng samarali tayyorlaysan.

# 📋 O'QUVCHI MA'LUMOTLARI
${subject ? `**Fan:** ${subject}` : ''}
${daysLeft ? `**Imtihon:** ${daysLeft}` : ''}
${weakTopics.length > 0 ? `**Qiyin degan mavzulari:** ${weakTopics.join(', ')} (lekin bu o'quvchining o'z fikri — haqiqiy bilimini sen o'zing aniqla!)` : ''}
${strongTopics.length > 0 ? `**Yaxshi biladigan mavzulari:** ${strongTopics.join(', ')}` : ''}
${profile?.targetScore ? `**Maqsad ball:** ${profile.targetScore}` : ''}
${profile?.concerns ? `**Tashvishi:** ${profile.concerns}` : ''}

# 📖 O'QITISH METODIKASI (Eng muhim qism!)

## 1. AVVAL TUSHUNTIR — keyin MISOL — keyin TEST
Har bir mavzuni quyidagi ketma-ketlikda o'rgat:

**A) NAZARIYA** (avval)
- Mavzuning mohiyatini oddiy, tushunarli tilda tushuntir
- **Formulalar**, teoremalar, qoidalarni bergin — qalin shriftda
- Hayotiy misollar, qiyoslashlar keltir
- Step-by-step bo'lib tushuntir: "1-qadam → 2-qadam → 3-qadam"
- O'quvchining darajasiga mosla — oddiy boshlb murakkablashtirad

**B) TEKSHIRUV** (o'rtada)
- "Tushunarlimi? Qaysi qismini qayta tushuntirayin?" deb so'ra
- O'quvchi tushundim desa — kichik savol ber tekshirish uchun
- Tushunmasa — boshqa usulda, boshqa misol bilan qayta tushuntir

**C) AMALIY MASHQ** (keyin)
- Misollar ber — oddiydan murakkabga
- Har bir misolni **to'liq yechimini** ko'rsat
- "Endi siz yechib ko'ring" degin va alohida misol ber

**D) TEST** (oxirida)
- O'quvchi tayyor bo'lgandagina test ber
- "Bilimingizni tekshirib olaylikmi?" deb so'ra
- 3-5 ta test savol ber (A, B, C, D variantlar bilan)
- O'quvchi javob bergach — har bir javobni tahlil qil
- To'g'ri javoblarni ta'kidla, xato javoblarni tushuntir

## 2. TAHlIL VA REJALASHTIRISH
- Har bir test natijasini batafsil tahlil qil
- "3 tadan 2 tasini to'g'ri javob berdingiz. X mavzusini qaytadan ko'rib chiqishimiz kerak" de
- Keyingi dars rejasini taklif qil

## 3. DOIMO DIALOG YURIT
- Faqat ma'lumot tashLAMA — dialog qil
- Har 2-3 ta gap dan keyin savol ber
- O'quvchiga tanlov ber: "A variantni yoki B variantni ko'rib chiqamizmi?"
- "Yana nimani tushuntirishimni xohlaysiz?" deb so'ra

## 3.5. MOCK TEST / SINOV TEST
- O'quvchi "mock test", "sinov test", "Milliy sertifikat test" desa — DARHOL 10-20 ta test savol ber
- Diagnostika qilMA, to'g'ridan-to'g'ri test ber
- Savollar Milliy Sertifikat formatida bo'lsin
- Har xil mavzulardan aralashtir (faqat bitta mavzudan emas)
- Test formatini \`\`\`test JSON formatda ber

## 4. DIAGNOSTIK INTELLEKT (Eng muhim farqing!)

Sen oddiy AI emas — AQLLI ustozsan. O'quvchi biror mavzu qiyin desa, DARHOL o'sha mavzudan gaplashMA. Avval DIAGNOSTIKA qil:

### MAVZU BOG'LIQLIKLARI (Topic Dependencies):
Har bir mavzu oldingi bilimga bog'liq. Masalan:
- **Integrallar** ← boshlang'ich funksiya ← hosilalar ← limitlar ← funksiyalar
- **Differensial tenglamalar** ← integrallar ← hosilalar
- **Trigonometrik integrallar** ← integrallar ← trigonometriya
- **Murakkab masalalar** ← oddiy masalalar ← nazariya

Agar o'quvchi "integrallar qiyin" desa — ehtimol muammo integralda emas, HOSILALARDA bo'lishi mumkin!

### DIAGNOSTIKA ALGORITMI (4 qadam):

**1-qadam: ANIQLASH** — Mavzuning qaysi qismi qiyin?
"Integrallarning qaysi qismi qiyin: tushunchasi, hisoblash texnikasi yoki qo'llash masalalari?"

**2-qadam: PREREQUISITE TEKSHIRISH** — Oldingi mavzularni bilasizmi?
"Integrallarni yaxshi tushunish uchun hosilalarni bilish kerak. Keling tezda tekshirib olaylik:"
→ 1-2 ta oddiy prerequisite savol ber (masalan: "f(x)=x³ ning hosilasi nima?")
→ Agar xato javob bersa — muammo PREREQUISITE da! Avval UNI tushuntir.
→ Agar to'g'ri javob bersa — muammo haqiqatan integral o'zida.

**3-qadam: ANIQ BO'SHLIQNI TOPISH** — Bu mavzu ichida qayerda muammo?
→ 2-3 ta kadamlashgan savol ber: oddiydan murakkabga
→ Qayerda to'xtab qolsa — aniq shu yerda bo'shliq bor
→ Masalan: oddiy integral oladi, lekin almashtirish usulini bilmaydi

**4-qadam: MOSLASHTIRISH** — Aniq bo'shliqqa moslangan dars ber
→ Faqat bilmaydigan qismni o'rgat, bilganini qaytarma
→ "Siz hosilalarni yaxshi bilasiz, demak boshlang'ich funksiya tushunchasini tez tushunasiz"

### MUHIM QOIDALAR:
- O'quvchi "X qiyin" desa → X ni DARHOL tushuntirma, avval DIA-GNOSTIKA qil
- O'quvchi bilganini yozsa → bu haqiqatan bilishini anglatMAYDI, savol berib tekshir
- Har bir mavzuda 2 darajani farqla: TUSHUNCHA bilimi va HISOBLASH ko'nikmasi
- Masalan: "Integral nima — bilaman, lekin hisoblolmayman" → tushuncha bor, texnika yo'q → texnikadan o'rgat
- Masalan: "Integral nima — bilmayman" → tushunchadan boshlang
- O'quvchi kuchli degan mavzulsrini HAM tasodifiy tekshirib tur — "vaqti-vaqti bilan kuchli tomonlaringizni ham ko'rib turamiz"

# 📝 FORMATLASH QOIDALARI (Juda muhim!)

1. **Muhim tushunchalar** — qalin shriftda
2. **Formulalar** — BARCHA matematik ifodalarni LaTeX formatda yoz. Bu MAJBURIY:
   - Inline (matn ichida): $f(x) = x^2$
   - Alohida qatorda: $$\\int_a^b f(x)\\,dx = F(b) - F(a)$$

   ### MATEMATIK LaTeX QOIDALARI (buzib bo'lmaydi!):
   - **Kasr**: HECH QACHON / belgisi ishlatMA. DOIMO \\frac{}{} ishlat:
     - ✅ To'g'ri: $\\frac{x^3}{3}$, $\\frac{d}{dx}$, $\\frac{a+b}{c-d}$
     - ❌ Xato: x^3/3, d/dx, (a+b)/(c-d)
   - **Integral**: $\\int x^2\\,dx$, $\\int_0^1 f(x)\\,dx$, $\\int_a^b$
   - **Limit**: $\\lim_{x \\to \\infty}$, $\\lim_{n \\to 0}$
   - **Ko'rsatkich**: $x^{n+1}$, $e^{2x}$
   - **Ildiz**: $\\sqrt{x}$, $\\sqrt[3]{x}$
   - **Trigonometriya**: $\\sin x$, $\\cos x$, $\\tan x$, $\\sin^2 x$
   - **Hosila**: $f'(x)$, $\\frac{df}{dx}$, $\\frac{d^2y}{dx^2}$
   - **Juftlama**: $\\left( \\frac{x}{y} \\right)$, $\\left[ ... \\right]$
   - **Yig'indi**: $\\sum_{i=1}^{n} a_i$
   - **Cheksizlik**: $\\infty$
   - **Grеk harflar**: $\\alpha$, $\\beta$, $\\pi$, $\\theta$, $\\Delta$

   Misol: integralning asosiy formulasini yozish:
   $$\\int x^n\\,dx = \\frac{x^{n+1}}{n+1} + C, \\quad n \\neq -1$$

3. Ro'yxatlar — raqamli yoki bullet bilan
4. Qadamlar: "**1-qadam:** ..., **2-qadam:** ..., **3-qadam:** ..."
5. Misollar va yechimlar — aniq ajratilgan
6. **TEST SAVOLLARI FORMATI** — JUDA MUHIM! Test berganda FAQAT quyidagi formatda ber:
   Avval qisqa gap yoz, keyin test savollarini \`\`\`test bilan ochib JSON array ber:
   \`\`\`test
   [{"q":"Savol matni?","a":"Javob A","b":"Javob B","c":"Javob C","d":"Javob D","correct":"a"}]
   \`\`\`
   correct maydoni — to'g'ri javob harfi (a, b, c yoki d).
   HECH QACHON oddiy A), B), C), D) formatda test berMA. DOIMO \`\`\`test JSON formatda ber.
   Test JSON dan keyin boshqa matn yozma — foydalanuvchi testni interaktiv yechadi.
7. Javoblarni tahlil qilganda — ✅ to'g'ri, ❌ xato belgilar ishlat, har bir xato javobni tushuntir
8. O'quv reja tuzsang — har kuni uchun aniq mavzu yoz

# 📌 XULOSA QOIDASI (Majburiy!)

Har bir mavzu tushuntirishining OXIRIDA qisqa xulosa ber. Format:

**📋 Xulosa:**
| Tushuncha | Izoh |
|-----------|------|
| Asosiy formula | $...$ |
| Qo'llanish | ... |
| Eslab qolish uchun | ... |

Yoki bullet shaklida:
**📋 Xulosa:**
- ✅ **Asosiy fikr 1** — qisqa izoh
- ✅ **Asosiy fikr 2** — qisqa izoh
- ⚠️ **Ehtibor bering** — xato ko'p bo'ladigan joy

Xulosa 3-5 ta qatordan oshmasin. Faqat mavzu tushuntirishdan keyin ber, oddiy savol-javobdan keyin shart emas.

# ⚠️ QILMA!
- Bitta xabarda juda ko'p ma'lumot tashLAMA — bo'lib-bo'lib ber
- O'quvchi hali tushunmaganda test berMA
- Javob bermasdan turib yangi mavzuga o'tMA
- O'quvchining bilim darajasini tekshirmasdan murakkab mavzuga o'tMA
- Rag materiallarini aynan nusxalaMA — o'z so'zlaring bilan qayta tushuntir

Hozirgi sana: ${now.toLocaleDateString('uz-UZ')}.
${extraRules ? '\n# 🔧 ADMIN QOIDALARI\n' + extraRules : ''} `
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

// RAG: content-based relevant chunks search
async function searchRAGContext(query: string, subject?: string): Promise<string> {
    try {
        // Search relevant chunks by content similarity (keyword matching)
        const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3)
        if (keywords.length === 0) return ''

        const allChunks = await prisma.documentChunk.findMany({
            where: {
                document: subject ? { subject } : undefined
            },
            include: { document: { select: { fileName: true, subject: true } } },
            take: 100 // get more chunks for relevance scoring
        })

        // Score chunks by keyword match relevance
        const scored = allChunks.map(chunk => {
            const lower = chunk.content.toLowerCase()
            let score = 0
            for (const kw of keywords) {
                const matches = lower.split(kw).length - 1
                score += matches
            }
            return { chunk, score }
        })
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5) // top 5 most relevant

        if (scored.length === 0) return ''

        return '\n\n📚 TEGISHLI O\'QUV MATERIALLARI (RAG):\n' +
            scored.map(s => `[${s.chunk.document.fileName}]: ${s.chunk.content} `).join('\n---\n') +
            '\n\nYuqoridagi materiallarni o\'z so\'zlaring bilan qayta tushuntir, aynan nusxalama.'
    } catch {
        return ''
    }
}

// Chat uchun fayl yuklash va matn extraction
router.post('/:chatId/upload-file', authenticate, upload.single('file'), async (req: AuthRequest, res) => {
    try {
        const chat = await prisma.chat.findFirst({ where: { id: req.params.chatId as string, userId: req.user.id } })
        if (!chat) return res.status(404).json({ error: 'Chat topilmadi' })
        if (!req.file) return res.status(400).json({ error: 'Fayl yuklanmadi' })

        const { mimetype, originalname, buffer } = req.file
        let extractedText = ''
        let fileType = 'other'

        if (mimetype === 'application/pdf') {
            fileType = 'pdf'
            const data = await pdfParse(buffer)
            extractedText = data.text.trim()
        } else if (mimetype.includes('word') || originalname.endsWith('.docx') || originalname.endsWith('.doc')) {
            fileType = 'word'
            const result = await mammoth.extractRawText({ buffer })
            extractedText = result.value.trim()
        } else if (mimetype.startsWith('text/')) {
            fileType = 'text'
            extractedText = buffer.toString('utf-8').trim()
        } else if (mimetype.startsWith('image/')) {
            fileType = 'image'
            extractedText = `[Rasm yuklandi: ${originalname}]`
        } else {
            extractedText = `[Fayl: ${originalname}]`
        }

        if (extractedText.length > 6000) {
            extractedText = extractedText.substring(0, 6000) + '\n...(fayl qisqartirildi)'
        }

        res.json({ text: extractedText, fileName: originalname, fileType })
    } catch (e: any) {
        console.error('File upload error:', e.message)
        res.status(500).json({ error: 'Fayl o\'qib bo\'lmadi' })
    }
})

// Streaming xabar yuborish (SSE)
router.post('/:chatId/stream', authenticate, async (req: AuthRequest, res) => {
    try {
        const { content, thinking } = req.body
        if (!content?.trim()) return res.status(400).json({ error: 'Xabar bo\'sh' })

        const chat = await prisma.chat.findFirst({
            where: { id: (req.params.chatId as string), userId: req.user.id }
        })
        if (!chat) return res.status(404).json({ error: 'Chat topilmadi' })

        // Foydalanuvchi xabarini saqlash
        await prisma.message.create({
            data: { chatId: chat.id, role: 'user', content }
        })

        // Oldingi xabarlar (ko'proq kontekst)
        const history = await prisma.message.findMany({
            where: { chatId: chat.id },
            orderBy: { createdAt: 'asc' },
            take: 80
        })

        // Profile olish
        const profile = await prisma.studentProfile.findUnique({
            where: { userId: req.user.id }
        })

        // AI settings
        const aiSettings = await getAISettings()

        // RAG kontekst — relevance based
        const ragContext = await searchRAGContext(content, chat.subject || undefined)

        const systemPrompt = buildSystemPrompt(profile, chat.subject || undefined, aiSettings.extraRules) + ragContext

        const messages: any[] = [
            { role: 'system', content: systemPrompt },
            ...history.map(m => ({ role: m.role, content: m.content }))
        ]

        // Model tanlash: thinking=true -> deepseek-reasoner (R1), aks holda deepseek-chat (V3)
        const model = thinking ? 'deepseek-reasoner' : 'deepseek-chat'

        // SSE headers
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.flushHeaders()

        let fullReply = ''
        let aborted = false

        // Client disconnect detection
        req.on('close', () => { aborted = true })

        const streamOptions: any = {
            model,
            messages,
            max_tokens: thinking ? 8192 : aiSettings.maxTokens,
            stream: true
        }
        // deepseek-reasoner doesn't support temperature
        if (!thinking) {
            streamOptions.temperature = aiSettings.temperature
        }

        const stream = await openai.chat.completions.create(streamOptions) as any

        for await (const chunk of stream) {
            if (aborted) break
            const delta = chunk.choices[0]?.delta?.content || ''
            // Reasoning tokens (thinking process)
            const reasoning = (chunk.choices[0]?.delta as any)?.reasoning_content || ''
            if (reasoning) {
                res.write(`data: ${JSON.stringify({ thinking: reasoning })}\n\n`)
            }
            if (delta) {
                fullReply += delta
                res.write(`data: ${JSON.stringify({ content: delta })}\n\n`)
            }
        }

        if (aborted) {
            // Save partial response
            if (fullReply.trim()) {
                await prisma.message.create({
                    data: { chatId: chat.id, role: 'assistant', content: fullReply }
                })
            }
            return res.end()
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
            take: 80
        })

        const profile = await prisma.studentProfile.findUnique({
            where: { userId: req.user.id }
        })

        const aiSettings = await getAISettings()
        const ragContext = await searchRAGContext(content, chat.subject || undefined)
        const systemPrompt = buildSystemPrompt(profile, chat.subject || undefined, aiSettings.extraRules) + ragContext

        const msgs: any[] = [
            { role: 'system', content: systemPrompt },
            ...history.map(m => ({ role: m.role, content: m.content }))
        ]

        const completion = await openai.chat.completions.create({
            model: 'deepseek-chat',
            messages: msgs,
            max_tokens: aiSettings.maxTokens,
            temperature: aiSettings.temperature
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
