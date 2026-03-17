import { Router } from 'express'
import multer from 'multer'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import OpenAI from 'openai'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole, optionalAuthenticate } from '../middleware/auth'
import { updateAbility } from '../utils/rasch'
import { uploadToS3 } from '../utils/s3'

// MS (Milliy Sertifikat) Rasch model baho chegaralari — uzbmb.uz rasmiy ma'lumotlari asosida
function getGrade(score: number): string {
    if (score >= 70) return 'A+'
    if (score >= 65) return 'A'
    if (score >= 60) return 'B+'
    if (score >= 55) return 'B'
    if (score >= 50) return 'C+'
    if (score >= 46) return 'C'
    return 'D'
}

// DTM ball hisoblash
// Majburiy fanlar (10 savol * 1.1 = max 11 ball)
// Ixtisoslik 1-fan (30 savol * 3.1 = max 93 ball)
// Ixtisoslik 2-fan (30 savol * 2.1 = max 63 ball)
// Ustoz testlari uchun: bir fan bo'lgani uchun 3.1 koeffitsient ishlatiladi
const MANDATORY_SUBJECTS = ["Ona tili", "Tarix", "O'zbekiston tarixi"]
function getDtmBall(subject: string | null, correct: number, total: number): { ball: number; max: number; coefficient: number } {
    const coef = subject && MANDATORY_SUBJECTS.includes(subject) ? 1.1 : 3.1
    return {
        ball: Math.round(correct * coef * 10) / 10,
        max: Math.round(total * coef * 10) / 10,
        coefficient: coef
    }
}

// MS (Milliy Sertifikat) ball hisoblash
// Har bir fan 20 balldan — foizga mutanosib
function getMsBall(correct: number, total: number): { ball: number; max: number } {
    if (total === 0) return { ball: 0, max: 20 }
    return {
        ball: Math.round(correct / total * 20 * 10) / 10,
        max: 20
    }
}

const router = Router()

// Test submit uchun rate limit (brute force javob topish oldini olish)
const submitLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 daqiqa
    max: 20,
    keyGenerator: (req: any) => req.user?.id || ipKeyGenerator(req),
    message: { error: 'Juda ko\'p test topshirish urinishi. 15 daqiqadan keyin qayta urinib ko\'ring.' },
    standardHeaders: true,
    legacyHeaders: false,
})

// AI test generatsiya uchun rate limit (qimmat API chaqiruv)
const generateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 daqiqa
    max: 5,
    keyGenerator: (req: any) => req.user?.id || ipKeyGenerator(req),
    message: { error: 'AI test yaratish limiti. Bir daqiqadan keyin qayta urinib ko\'ring.' },
    standardHeaders: true,
    legacyHeaders: false,
})

// Test yaratish uchun rate limit (spam oldini olish)
const createLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 daqiqa
    max: 10,
    keyGenerator: (req: any) => req.user?.id || ipKeyGenerator(req),
    message: { error: 'Test yaratish limiti. Bir daqiqadan keyin qayta urinib ko\'ring.' },
    standardHeaders: true,
    legacyHeaders: false,
})

// Test yaratish/o'zgartirish uchun (questions qo'shish)
const testMutateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    keyGenerator: (req: any) => req.user?.id || ipKeyGenerator(req),
    message: { error: 'Juda ko\'p so\'rov. Biroz kuting.' },
})

// Test o'qish uchun (by-link brute force oldini olish)
const testReadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    keyGenerator: (req: any) => req.user?.id || ipKeyGenerator(req),
})

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

const hasDeepseek = !!process.env.DEEPSEEK_API_KEY
const aiClient = new OpenAI({
    baseURL: hasDeepseek ? 'https://api.deepseek.com' : undefined,
    apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || ''
})
const aiModel = hasDeepseek ? 'deepseek-chat' : 'gpt-4.1-mini'

const gptClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || ''
})

// O'qituvchining testlari
router.get('/my-tests', authenticate, requireRole('TEACHER', 'ADMIN'), async (req: AuthRequest, res) => {
    try {
        const tests = await prisma.test.findMany({
            where: { creatorId: req.user.id },
            include: { _count: { select: { questions: true, attempts: true } } },
            orderBy: { createdAt: 'desc' }
        })
        res.json(tests)
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Admin: barcha testlar (qidiruv, filter, avg score)
router.get('/all', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const search = (req.query.search as string || '').trim()
        const visibility = req.query.visibility as string | undefined // 'public' | 'private'
        const subject = req.query.subject as string | undefined
        const sortBy = (req.query.sortBy as string) || 'createdAt'
        const page = Math.max(1, parseInt(req.query.page as string) || 1)
        const limit = 50

        const where: any = {}
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { creator: { name: { contains: search, mode: 'insensitive' } } }
            ]
        }
        if (visibility === 'public') where.isPublic = true
        if (visibility === 'private') where.isPublic = false
        if (subject) where.subject = subject

        const orderBy: any = sortBy === 'attempts'
            ? { attempts: { _count: 'desc' } }
            : sortBy === 'questions'
            ? { questions: { _count: 'desc' } }
            : { createdAt: 'desc' }

        const [tests, total] = await Promise.all([
            prisma.test.findMany({
                where,
                include: {
                    _count: { select: { questions: true, attempts: true } },
                    creator: { select: { name: true, email: true, role: true } }
                },
                orderBy,
                take: limit,
                skip: (page - 1) * limit,
            }),
            prisma.test.count({ where })
        ])

        // Har bir test uchun o'rtacha ball
        const testIds = tests.map(t => t.id)
        const avgScores = testIds.length > 0
            ? await prisma.testAttempt.groupBy({
                by: ['testId'],
                where: { testId: { in: testIds } },
                _avg: { score: true },
                _count: true,
            })
            : []

        const avgMap: Record<string, number> = {}
        for (const a of avgScores) {
            avgMap[a.testId] = Math.round((a._avg.score || 0) * 10) / 10
        }

        // Umumiy statistika
        const [totalPublic, totalPrivate, totalAttempts] = await Promise.all([
            prisma.test.count({ where: { isPublic: true } }),
            prisma.test.count({ where: { isPublic: false } }),
            prisma.testAttempt.count(),
        ])

        res.json({
            tests: tests.map(t => ({ ...t, avgScore: avgMap[t.id] ?? null })),
            total,
            pages: Math.ceil(total / limit),
            summary: { totalPublic, totalPrivate, totalAttempts }
        })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// O'quvchining test natijalari
router.get('/my-results', authenticate, async (req: AuthRequest, res) => {
    try {
        const attempts = await prisma.testAttempt.findMany({
            where: { userId: req.user.id },
            include: { test: { select: { title: true, subject: true } } },
            orderBy: { createdAt: 'desc' }
        })
        res.json(attempts)
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Public testlar ro'yxati (barcha o'quvchilar uchun)
router.get('/public', authenticate, async (req: AuthRequest, res) => {
    try {
        const tests = await prisma.test.findMany({
            where: { isPublic: true },
            include: {
                _count: { select: { questions: true, attempts: true } },
                creator: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        })
        res.json(tests)
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Test olish (link bo'yicha ham)
router.get('/by-link/:shareLink', optionalAuthenticate, testReadLimiter, async (req: AuthRequest, res) => {
    try {
        const shareLink = req.params.shareLink as string
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(shareLink)) return res.status(400).json({ error: 'Noto\'g\'ri link formati' })

        const test = await prisma.test.findUnique({
            where: { shareLink },
            include: {
                questions: { orderBy: { orderIdx: 'asc' }, select: { id: true, text: true, imageUrl: true, options: true, orderIdx: true, questionType: true } },
                creator: { select: { name: true } }
            }
        })
        if (!test) return res.status(404).json({ error: 'Test topilmadi' })
        res.json(test)
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// AI yordamida fayl/screenshot dan test savollari yaratish
router.post('/generate-from-file', authenticate, requireRole('TEACHER', 'ADMIN'), generateLimiter, upload.single('file'), async (req: AuthRequest, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Fayl yuklanmadi' })
        const { mimetype, buffer } = req.file
        const subject = (req.body.subject as string) || ''
        const jsonFormat = `[{"text":"Savol matni (masalan: $\\\\sqrt{2}$ yoki $\\\\frac{a}{b}$)?","options":["A variant","B variant","C variant","D variant"],"correctIdx":0}]`
        const subjectNote = subject ? ` Fan: ${subject}.` : ''

        let messages: any[] = []
        let truncated = false

        if (mimetype === 'application/pdf') {
            const data = await pdfParse(buffer)
            const fullText = data.text.trim()
            let hasImageContent = false

            // Skanerlangan PDF: matn yo'q bo'lsa pdfjs-dist + canvas bilan render
            if (!fullText || fullText.length < 50) {
                try {
                    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as any)
                    const { createCanvas } = await import('@napi-rs/canvas')

                    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
                    const pdfDoc = await loadingTask.promise
                    const pageCount = Math.min(pdfDoc.numPages, 3)
                    const imageMessages: any[] = []

                    for (let i = 1; i <= pageCount; i++) {
                        const page = await pdfDoc.getPage(i)
                        const viewport = page.getViewport({ scale: 1.5 })
                        const canvas = createCanvas(viewport.width, viewport.height)
                        const ctx = canvas.getContext('2d')
                        await page.render({ canvasContext: ctx as any, viewport }).promise
                        const base64 = canvas.toBuffer('image/png').toString('base64')
                        imageMessages.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } })
                    }

                    if (imageMessages.length > 0) {
                        hasImageContent = true
                        messages = [{
                            role: 'user',
                            content: [
                                ...imageMessages,
                                {
                                    type: 'text', text: `Bu skanerlangan PDF sahifalaridan test savollari va variantlarini AYNAN ajratib ol.${subjectNote}

MUHIM QOIDALAR:
- Rasmdagi mavjud savol va variantlarni AYNAN ko'chir
- Kamida 5 ta, ko'pi 90 ta savol
- correctIdx: to'g'ri javob indeksi (0=A, 1=B, 2=C, 3=D)
- Matematik ifodalarni KaTeX formatida yoz: $\\sqrt{x}$, $\\frac{a}{b}$, $x^{2}$, $a_{n}$, $\\pi$
- Rasmdagi har qanday formula, ildiz, kasr, daraja, indeksni LaTeX bilan ifodalash SHART

Javobni FAQAT JSON array formatda qaytargil:
${jsonFormat}`
                                }
                            ]
                        }]
                    }
                } catch (err) {
                    console.error("PDF render failed:", err)
                }
            }

            if (!hasImageContent) {
                if (!fullText) {
                    return res.status(400).json({ error: 'PDF fayldan matn o\'qib bo\'lmadi. Iltimos, PDF ni PNG/JPG rasmga aylantiring va yuklang, yoki Word (.docx) fayl yuklang.' })
                }

                truncated = fullText.length > 12000
                const text = fullText.substring(0, 12000)

                const userMsg = `Quyidagi matnda TAYYOR test savollari va variantlari bor. Ularni AYNAN o'sha holda ajratib ol — o'zing savol to'qima, o'zgartirma.${subjectNote}

MUHIM QOIDALAR:
- Matndagi mavjud savol va variantlarni AYNAN ko'chir
- Agar matnda savol topilmasa YOKI matn o'quv material bo'lsa — o'sha materialdan YANGI savol yaratishga ruxsat beriladi
- correctIdx: to'g'ri javob indeksi (0=A, 1=B, 2=C, 3=D)
- Kamida 5 ta, ko'pi 90 ta savol
- Matematik ifodalarni KaTeX formatida yoz: $\\sqrt{x}$, $\\frac{a}{b}$, $x^{2}$, $a_{n}$, $\\pi$
- Har qanday formula, ildiz, kasr, daraja, indeksni LaTeX bilan ifodalash SHART
${truncated ? '- DIQQAT: PDF katta, faqat birinchi qism berildi\n' : ''}
Javobni FAQAT JSON array formatda qaytargil, boshqa hech narsa yozma:
${jsonFormat}

Matn:
${text}`
                messages = [{ role: 'user', content: userMsg }]
            }

        } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimetype === 'application/msword') {
            const result = await mammoth.extractRawText({ buffer })
            const fullText = result.value.trim()
            if (!fullText) return res.status(400).json({ error: 'Word fayli bo\'sh' })

            truncated = fullText.length > 12000
            const text = fullText.substring(0, 12000)

            const userMsg = `Quyidagi matnda TAYYOR test savollari va variantlari bor. Ularni AYNAN o'sha holda ajratib ol — o'zing savol to'qima.${subjectNote}

MUHIM QOIDALAR:
- Matndagi mavjud savol va variantlarni AYNAN ko'chir
- correctIdx: to'g'ri javob indeksi (0=A, 1=B, 2=C, 3=D)
- Kamida 5 ta, ko'pi 90 ta savol
- Matematik ifodalarni KaTeX formatida yoz: $\\sqrt{x}$, $\\frac{a}{b}$, $x^{2}$, $a_{n}$, $\\pi$
- Har qanday formula, ildiz, kasr, daraja, indeksni LaTeX bilan ifodalash SHART
${truncated ? '- DIQQAT: Fayl katta, faqat birinchi qism berildi\n' : ''}
Javobni FAQAT JSON array formatda qaytargil:
${jsonFormat}

Matn:
${text}`
            messages = [{ role: 'user', content: userMsg }]
        } else if (mimetype.startsWith('image/')) {
            const base64 = buffer.toString('base64')
            messages = [{
                role: 'user',
                content: [
                    { type: 'image_url', image_url: { url: `data:${mimetype};base64,${base64}` } },
                    {
                        type: 'text', text: `Bu rasmdagi test savollari va variantlarini AYNAN ajratib ol — o'zing savol to'qima.${subjectNote}

MUHIM QOIDALAR:
- Rasmdagi mavjud savol va variantlarni AYNAN ko'chir
- Agar rasmda savol topilmasa — rasmda ko'rsatilgan mavzudan yangi savol yaratishga ruxsat beriladi
- correctIdx: to'g'ri javob indeksi (0=A, 1=B, 2=C, 3=D)
- Kamida 5 ta, ko'pi 90 ta savol
- Matematik ifodalarni KaTeX formatida yoz: $\\sqrt{x}$, $\\frac{a}{b}$, $x^{2}$, $a_{n}$, $\\pi$
- Rasmdagi har qanday formula, ildiz, kasr, daraja, indeksni LaTeX bilan ifodalash SHART

Javobni FAQAT JSON array formatda qaytargil, boshqa hech narsa yozma:
${jsonFormat}`
                    }
                ]
            }]
        } else {
            return res.status(400).json({ error: 'Faqat PDF va rasm fayllari qo\'llab-quvvatlanadi' })
        }

        // Rasm tahlili: DeepSeek vision qabul qilmaydi, OpenAI kerak
        const isVision = messages.some(m => Array.isArray(m.content));
        if (isVision && !process.env.OPENAI_API_KEY) {
            return res.status(400).json({ error: 'Rasm/screenshot tahlili uchun OpenAI API kalit kerak. Iltimos, matnli PDF yoki Word fayl yuklang.' })
        }
        const client = isVision ? gptClient : aiClient;
        const model = isVision ? 'gpt-4.1' : aiModel;

        const completion = await client.chat.completions.create({
            model: model,
            messages: [
                {
                    role: 'system', content: `Siz test savollari generatorisiz. Sizga berilgan matn yoki rasmdan savollarni AYNAN ajratib olasiz. FAQAT JSON array formatda javob bering, boshqa hech narsa yozmasdan.

MATEMATIK IFODALAR BA GEOMETRIK CHIZMALAR UCHUN QAT'IY QOIDALAR (MUHIM):
1. Barcha matematik ifodalarni faqat KaTeX/LaTeX formatida yozing.
2. Inline formula: $formula$ — masalan: $\\sqrt{2}$, $\\frac{1}{2}$, $x^2$, $a_n$
3. Block formula xato berishi mumkin, faqat bitta $ ishlating: $x^2 + y^2 = r^2$
4. Ildiz: $\\sqrt{x}$ yoki $\\sqrt[n]{x}$
5. Kasr: $\\frac{a}{b}$
6. Daraja va Indeks: $x^{2}$, $2^{n}$, $a_{n}$, $x_{1}$
7. Logarifm va natural logarifm: $\\log_{a}{b}$, $\\ln{x}$, $\\lg{x}$
8. Limit va Integral: $\\lim_{x \\to \\infty} f(x)$, $\\int_{a}^{b} f(x) dx$
9. Trigonometriya: $\\sin(\\alpha)$, $\\cos(\\beta)$, $\\tan(x)$, $\\cot(x)$
10. Burchaklar va graduslar: $\\angle ABC = 90^\\circ$, $a^{\\circ}$
11. Geometrik chizmalar yoki grafiklar bor bo'lsa, savol matniga "[Rasmda geometrik chizma/grafik berilgan, uni e'tiborga oling]" deb yozing, va matnni to'liq o'qing.
12. PI, tengsizlik, qavslar majmui: $\\pi$, $\\leq$, $\\geq$, $\\neq$, $\\{ x \\mid x > 0 \\}$
13. Sonlar ustidagi chiziq (masalan 8962ab ustida chiziq bo'lsa): $\\overline{8962ab}$ deb yozing.
DIQQAT: Formulalarda bo'sh joylar yoki ortiqcha belgilarni qoldirmang, aynan rasmda qanday yozilgan bo'lsa shunday yarating. Qavslar $ichi$da harflar oddiy emas, balki matematik bo'lsin. Savollar orasidagi matnni (masalan "Tenglamani yeching") albatta qoldiring.`
                },
                ...messages
            ],
            max_tokens: 8000,
            temperature: 0.1,
        }, { timeout: 120000 })

        const aiContent = completion.choices[0]?.message?.content || '[]'

        let jsonStr = aiContent;
        // Trible backticks ichidagi json ni qidirish:
        const codeBlockMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (codeBlockMatch && codeBlockMatch[1]) {
            jsonStr = codeBlockMatch[1];
        } else {
            // Faqat array qavslarini ajratib olishga urinish:
            const arrayMatch = aiContent.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (arrayMatch) {
                jsonStr = arrayMatch[0];
            }
        }

        let questions: any[]
        try {
            questions = JSON.parse(jsonStr)
        } catch (e: any) {
            console.error('AI JSON parse error:', e.message, 'Raw content:', aiContent)
            return res.status(500).json({ error: 'AI noto\'g\'ri format qaytardi. Qayta urinib ko\'ring.' })
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(500).json({ error: 'AI hech qanday savol topa olmadi yoki tushunmadi. Boshqa fayl yuklang.' })
        }

        // Har bir savolni validatsiya qilish va normallashtirish
        const validatedQuestions = questions
            .filter((q: any) => q && q.text && q.options && Array.isArray(q.options))
            .map((q: any) => {
                // Bo'sh option stringlarni ham filter qilish
                const options = Array.isArray(q.options)
                    ? q.options.filter((o: any) => typeof o === 'string' && o.trim().length > 0)
                    : []
                if (options.length < 2) return null

                // correctIdx: raqam, harf ('a'/'b'/'c'/'d'), yoki turli field nomlari bo'lishi mumkin
                const letterToIdx = (s: string) => ['a', 'b', 'c', 'd'].indexOf(s.trim().toLowerCase())
                let correctIdx = 0
                if (typeof q.correctIdx === 'number') {
                    correctIdx = q.correctIdx
                } else if (typeof q.correctIdx === 'string') {
                    const i = letterToIdx(q.correctIdx)
                    correctIdx = i >= 0 ? i : 0
                } else {
                    // AI turli field nomlari qaytarishi mumkin
                    const raw = q.correct ?? q.correctAnswer ?? q.answer ?? q.correct_answer ?? null
                    if (typeof raw === 'number') correctIdx = raw
                    else if (typeof raw === 'string') {
                        const i = letterToIdx(raw)
                        correctIdx = i >= 0 ? i : 0
                    }
                }

                if (correctIdx < 0 || correctIdx >= options.length) correctIdx = 0

                return {
                    text: q.text.trim(),
                    options: options.slice(0, 4),
                    correctIdx
                }
            })
            .filter(Boolean)

        if (validatedQuestions.length === 0) {
            return res.status(500).json({ error: 'Savollar formati to\'g\'ri emas. PDF yoki rasmni tekshiring.' })
        }

        res.json({
            questions: validatedQuestions,
            truncated: truncated || false,
            total: validatedQuestions.length
        })
    } catch (e: any) {
        console.error('AI test generation error:', e.message)
        res.status(500).json({ error: 'AI test yarata olmadi. PDF formatini sinab ko\'ring.' })
    }
})

// O'qituvchi: Test yaratish
router.post('/:testId/questions', authenticate, requireRole('TEACHER', 'ADMIN'), testMutateLimiter, async (req: AuthRequest, res) => {
    try {
        const testId = req.params.testId as string
        const test = await prisma.test.findUnique({ where: { id: testId } })
        if (!test) return res.status(404).json({ error: 'Test topilmadi' })
        if (req.user.role !== 'ADMIN' && test.creatorId !== req.user.id) {
            return res.status(403).json({ error: 'Ruxsat yo\'q' })
        }

        const { text, imageUrl, options, correctIdx, orderIdx, difficulty } = req.body

        // Savol matni validatsiyasi
        if (!text || typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ error: 'Savol matni majburiy' })
        }
        if (text.trim().length > 2000) {
            return res.status(400).json({ error: 'Savol matni 2000 belgidan oshmasligi kerak' })
        }

        // Validatsiya
        if (!Array.isArray(options) || options.length < 2) {
            return res.status(400).json({ error: 'Kamida 2 ta variant bo\'lishi kerak' })
        }
        if (typeof correctIdx !== 'number' || correctIdx < 0 || correctIdx >= options.length) {
            return res.status(400).json({ error: 'To\'g\'ri javob indeksi xato' })
        }

        const q = await prisma.testQuestion.create({
            data: {
                testId: test.id,
                text,
                imageUrl: imageUrl || null,
                options: JSON.stringify(options),
                correctIdx,
                orderIdx: orderIdx || 0,
                difficulty: difficulty || 0.0
            }
        })
        res.status(201).json(q)
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// O'qituvchi: Test yaratish
router.post('/create', authenticate, requireRole('TEACHER', 'ADMIN'), createLimiter, async (req: AuthRequest, res) => {
    try {
        const { title, description, subject, isPublic, questions, timeLimit, testType } = req.body
        if (!title || !questions?.length) {
            return res.status(400).json({ error: 'Test nomi va savollar kerak' })
        }

        // Har bir savol validatsiyasi
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i]
            const hasText = q.text && typeof q.text === 'string' && q.text.trim().length > 0
            const hasImage = q.imageUrl && typeof q.imageUrl === 'string' && q.imageUrl.trim().length > 0
            if (!hasText && !hasImage) {
                return res.status(400).json({ error: `${i + 1}-savol: savol matni yoki rasmi bo'lishi shart` })
            }
            if (q.questionType !== 'open') {
                let opts: any[]
                try {
                    opts = Array.isArray(q.options) ? q.options : JSON.parse(q.options)
                } catch {
                    return res.status(400).json({ error: `${i + 1}-savol: options to'g'ri format emas` })
                }
                if (!Array.isArray(opts) || opts.length < 2) {
                    return res.status(400).json({ error: `${i + 1}-savol: kamida 2 ta variant bo'lishi kerak` })
                }
                // Bo'sh option tekshiruvi
                for (let j = 0; j < opts.length; j++) {
                    if (typeof opts[j] !== 'string' || !opts[j].trim()) {
                        return res.status(400).json({ error: `${i + 1}-savol: ${String.fromCharCode(65 + j)} variant bo'sh bo'lishi mumkin emas` })
                    }
                }
                const idx = q.correctIdx ?? 0
                if (typeof idx !== 'number' || idx < 0 || idx >= opts.length) {
                    return res.status(400).json({ error: `${i + 1}-savol: correctIdx 0 dan ${opts.length - 1} gacha bo'lishi kerak` })
                }
            }
        }

        const validTestType = testType === 'dtm' ? 'dtm' : 'milliy_sertifikat'
        const test = await prisma.test.create({
            data: {
                title,
                description: description || null,
                subject: subject || null,
                isPublic: isPublic || false,
                ...(validTestType && { testType: validTestType } as any),
                timeLimit: timeLimit || null,
                creatorId: req.user.id,
                questions: {
                    create: questions.map((q: any, i: number) => ({
                        text: q.text,
                        imageUrl: q.imageUrl || null,
                        options: q.questionType === 'open' ? '[]' : JSON.stringify(q.options),
                        correctIdx: q.questionType === 'open' ? -1 : (q.correctIdx ?? 0),
                        correctText: q.questionType === 'open' ? (q.correctText?.trim() || null) : null,
                        questionType: q.questionType || 'mcq',
                        difficulty: q.difficulty || 0.0,
                        orderIdx: i
                    }))
                }
            },
            include: { questions: true }
        })

        // Public test yaratilsa barcha studentlarga bildirishnoma
        if (isPublic) {
            try {
                const students = await prisma.user.findMany({
                    where: { role: 'STUDENT' },
                    select: { id: true }
                })
                if (students.length > 0) {
                    await prisma.notification.createMany({
                        data: students.map((s: { id: string }) => ({
                            userId: s.id,
                            senderId: req.user.id,
                            title: `📚 Yangi test: ${title}`,
                            message: `"${title}" nomli yangi ${subject || ''} testi qo'shildi. Hoziroq yechib ko'ring!`
                        }))
                    })
                }
            } catch (notifErr) {
                console.error('Notification send error:', notifErr)
                // Bildirishnoma xatosi test yaratishni to'xtatmasin
            }
        }

        res.status(201).json(test)
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Rasm yuklash endpointi (savollar uchun)
router.post('/upload-image', authenticate, requireRole('TEACHER', 'ADMIN'), upload.single('image'), async (req: AuthRequest, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Rasm yuklanmadi' })

        // s3 ga yuklash
        const fileName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '-')}`
        const fileBuffer = req.file.buffer
        const mimetype = req.file.mimetype

        const s3Result = await uploadToS3(fileBuffer, fileName, 'questions', mimetype)

        res.json({ url: s3Result.url })
    } catch (e) {
        console.error('Image upload error:', e)
        res.status(500).json({ error: 'Rasm yuklashda xatolik yuz berdi' })
    }
})

// Rasmli savollarni vision AI bilan tahlil qilish
router.post('/analyze-vision', authenticate, async (req: AuthRequest, res) => {
    try {
        const { questions } = req.body
        if (!Array.isArray(questions) || questions.length === 0) {
            return res.json({ analysis: null })
        }
        const imageQs = questions.filter((q: any) => q.imageUrl)
        if (imageQs.length === 0) return res.json({ analysis: null })

        if (!process.env.OPENAI_API_KEY) {
            return res.json({ analysis: null })
        }

        const optLabels = ['A', 'B', 'C', 'D']

        // BOSQICH 1: GPT-4o-mini rasmni o'qiydi va masalani matn sifatida chiqaradi (faqat OCR/extract)
        const extractContent: any[] = [{
            type: 'text',
            text: `Quyidagi rasmli test savollarini diqqat bilan o'qi. Har bir savol uchun:
1. Rasmdan savol matnini, formulalarni va barcha sonlarni ANIQ o'qi
2. Variantlarni aniq yoz (A, B, C, D)
3. Savol nima so'rayotganini qisqacha ayt

MUHIM: Javobni topishga urinma — faqat rasmda nima yozilganini aniq o'qi va matn sifatida chiqar.
Matematik belgilar va formulalarni LaTeX formatida yoz ($\\frac{a}{b}$, $x^2$, $\\sqrt{x}$).
`
        }]

        imageQs.forEach((q: any, idx: number) => {
            const opts = ['a', 'b', 'c', 'd'].map((k, i) => q[k] ? `${optLabels[i]}) ${q[k]}` : null).filter(Boolean).join(' | ')
            extractContent.push({
                type: 'text',
                text: `\nSavol ${idx + 1}${q.text ? ': ' + q.text : ' (rasm):'}${opts ? '\nVariantlar: ' + opts : ''}\nRasm:`
            })
            extractContent.push({ type: 'image_url', image_url: { url: q.imageUrl, detail: 'high' } })
        })

        const extractResult = await gptClient.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: extractContent }],
            max_tokens: 2000,
            temperature: 0.1
        })

        const extractedText = extractResult.choices[0]?.message?.content || ''

        // BOSQICH 2: DeepSeek (yoki GPT) matematikani hisoblaydi va o'quvchiga tahlil beradi
        const studentAnswers = imageQs.map((q: any, idx: number) => {
            const studentLabel = typeof q.studentAnswer === 'string' ? q.studentAnswer.toUpperCase() : '?'
            const correctLabel = typeof q.correctAnswer === 'string' ? q.correctAnswer.toUpperCase() : '?'
            return `Savol ${idx + 1}: O'quvchi tanladi: ${studentLabel} | Tizim to'g'ri deb belgilagan: ${correctLabel}`
        }).join('\n')

        const solvePrompt = `O'quvchi DTM test savollarini yechdi. Quyida rasmdan o'qilgan savollar:

${extractedText}

O'quvchining javoblari:
${studentAnswers}

Iltimos:
1. Har bir savolni mustaqil yech — qoida, formula yoki hisob bilan to'g'ri javobni aniqla
2. O'quvchi tanlagan javob to'g'rimi yoki xatomi — aniq ko'rsat
3. Xato bo'lsa, nima uchun xato ekanini qisqacha tushuntir
4. "Tizim to'g'ri deb belgilagan" javobni e'tiborsiz qoldirmay tekshir — tizim noto'g'ri bo'lishi mumkin

Javoblar O'zbek tilida, KaTeX formulalar bilan ($\\frac{a}{b}$ formatida) bo'lsin.`

        const solveCompletion = await aiClient.chat.completions.create({
            model: aiModel,
            messages: [{ role: 'user', content: solvePrompt }],
            max_tokens: 2500,
            temperature: 0.1
        })

        res.json({ analysis: solveCompletion.choices[0]?.message?.content || null })
    } catch (e: any) {
        console.error('analyze-vision:', e.message)
        res.json({ analysis: null })
    }
})

// Test natijasini AI bilan tahlil qilish (TestPage uchun)
router.post('/analyze-result', optionalAuthenticate, async (req: AuthRequest, res) => {
    try {
        const { title, subject, score, total, questions } = req.body
        if (!Array.isArray(questions)) return res.json({ analysis: null })

        const hasImages = questions.some((q: any) => q.imageUrl)

        // Rasmli savollar bo'lsa vision AI (GPT-4o — rasmni aniq o'qiydi va matematikani to'g'ri yechadi)
        if (hasImages && process.env.OPENAI_API_KEY) {
            const optLabels = ['A', 'B', 'C', 'D']
            const imgQs = questions.filter((q: any) => q.imageUrl).slice(0, 10)
            const systemMsg = `Sen tajribali matematika o'qituvchisisiz. O'quvchi test yechdi va natijasini tahlil qilishingiz kerak.

QOIDALAR:
1. Har bir savol uchun AVVAL rasmni diqqat bilan o'qi va savolni AYNAN qayta yoz
2. Keyin masalani BOSQICHMA-BOSQICH to'g'ri yech
3. O'quvchi to'g'ri yechgan bo'lsa — "✅ To'g'ri!" deb ta'rifla
4. O'quvchi xato qilgan bo'lsa — "❌ Xato" deb, nima uchun xato ekanini va to'g'ri yechimni ko'rsat
5. Testda YO'Q bo'lgan savolni O'YLAB CHIQARMA
6. Matematik formulalarni LaTeX formatida yoz: $formula$ (inline) yoki $$formula$$ (block)
7. O'zbek tilida yoz`

            const content: any[] = [{
                type: 'text',
                text: `Test: "${title || 'Test'}" (${subject || ''}). Natija: ${score}/${total}.\n\nQuyidagi savollarni tahlil qil:`
            }]
            imgQs.forEach((q: any, idx: number) => {
                const opts = ['a', 'b', 'c', 'd'].map((k, i) => q[k] ? `${optLabels[i]}) ${q[k]}` : null).filter(Boolean).join(' | ')
                const studentLabel = (q.studentAnswer || '?').toUpperCase()
                const correctLabel = (q.correctAnswer || '?').toUpperCase()
                const isCorrect = q.studentAnswer === q.correctAnswer
                const status = isCorrect ? '✅ TO\'G\'RI' : '❌ XATO'
                content.push({ type: 'text', text: `\n---\n${status} — Savol ${idx + 1}${q.text ? ': ' + q.text : ''}${opts ? '\nVariantlar: ' + opts : ''}\nO'quvchi javobi: ${studentLabel} | To'g'ri javob: ${correctLabel}\nRasmni diqqat bilan o'qi:` })
                content.push({ type: 'image_url', image_url: { url: q.imageUrl, detail: 'high' } })
            })

            // Rasmsiz savollar ham bo'lsa — ularni matn sifatida qo'shamiz
            const textQs = questions.filter((q: any) => !q.imageUrl)
            if (textQs.length > 0) {
                const textList = textQs.map((q: any, idx: number) => {
                    const isCorrect = q.studentAnswer === q.correctAnswer
                    const status = isCorrect ? '✅' : '❌'
                    return `${status} ${idx + 1}. ${(q.text || 'Savol').substring(0, 150)} — O'quvchi: ${(q.studentAnswer || '?').toUpperCase()}, To'g'ri: ${(q.correctAnswer || '?').toUpperCase()}`
                }).join('\n')
                content.push({ type: 'text', text: `\n\nMatnsiz savollar:\n${textList}` })
            }

            content.push({ type: 'text', text: `\n\nOxirida umumiy xulosa yoz: qaysi mavzularda kuchli, qayerda zaif, nima o'rganish kerak.` })

            const completion = await gptClient.chat.completions.create({
                model: 'gpt-4.1',
                messages: [
                    { role: 'system', content: systemMsg },
                    { role: 'user', content }
                ],
                max_tokens: 16000,
                temperature: 0.2
            })
            return res.json({ analysis: completion.choices[0]?.message?.content || null, type: 'vision' })
        }

        // Rasmsiz — DeepSeek bilan BARCHA savollar tahlili
        const allList = questions
            .slice(0, 30)
            .map((q: any, i: number) => {
                const isCorrect = q.studentAnswer === q.correctAnswer
                const status = isCorrect ? '✅' : '❌'
                return `${status} ${i + 1}. ${(q.text || 'Savol').substring(0, 150)} — O'quvchi: ${(q.studentAnswer || '?').toUpperCase()}, To'g'ri: ${(q.correctAnswer || '?').toUpperCase()}`
            })
            .join('\n')

        const prompt = `O'quvchi "${title || 'Test'}" testini yechdi (${subject || ''}). Natija: ${score}/${total} (${total > 0 ? Math.round(score / total * 100) : 0}%).

Barcha savollar:
${allList}

Har bir savolni tahlil qil:
- ✅ To'g'ri yechganlarni: "To'g'ri!" deb ta'rifla, qisqacha tushuntir
- ❌ Xato yechganlarni: batafsil yechimini ko'rsat, nima uchun xato va to'g'ri javob nima uchun to'g'ri
- Oxirida xulosa: qaysi mavzular zaif, nima o'rganish kerak

O'zbek tilida yoz. Matematik formulalar uchun KaTeX ($...$ formatda) ishlat.`

        // DeepSeek-chat max output: 8192 tokens; GPT modellari ko'proq qo'llab-quvvatlaydi
        const maxTok = hasDeepseek ? 8000 : 16000
        const completion = await aiClient.chat.completions.create({ model: aiModel, messages: [{ role: 'user', content: prompt }], max_tokens: maxTok, temperature: 0.3 })
        res.json({ analysis: completion.choices[0]?.message?.content || null, type: 'text' })
    } catch (e: any) {
        console.error('analyze-result:', e.message)
        res.json({ analysis: null })
    }
})

// AI test natijasi — faqat avgScore/totalTests yangilash (Rasch YO'Q — AI testlar ability o'zgartirmasin)
router.post('/submit-ai', authenticate, submitLimiter, async (req: AuthRequest, res) => {
    try {
        const { score, totalQuestions, results } = req.body
        if (!results || !Array.isArray(results)) {
            return res.status(400).json({ error: 'results kerak' })
        }
        const profile = await prisma.studentProfile.findUnique({ where: { userId: req.user.id } })
        if (!profile) return res.status(404).json({ error: 'Profil topilmadi' })

        // AI testlar uchun Rasch yangilanmaydi — faqat statistika
        await prisma.studentProfile.update({
            where: { userId: req.user.id },
            data: {
                totalTests: { increment: 1 },
                avgScore: Math.round(((profile.avgScore * profile.totalTests + (score || 0)) / (profile.totalTests + 1)) * 100) / 100
            }
        })

        res.json({ ok: true })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Guest (login qilmagan) test yechish — DB ga saqlanmaydi, faqat natija qaytariladi
router.post('/:testId/submit-guest', optionalAuthenticate, submitLimiter, async (req: AuthRequest, res) => {
    try {
        const { answers } = req.body
        if (!Array.isArray(answers)) {
            return res.status(400).json({ error: 'answers massiv bo\'lishi kerak' })
        }
        const test = await prisma.test.findUnique({
            where: { id: req.params.testId as string },
            include: { questions: true }
        })
        if (!test) return res.status(404).json({ error: 'Test topilmadi' })

        // Javoblarni tekshirish (AI open-answer tekshiruvisiz — guest uchun tezroq)
        const results = answers.map((a: any) => {
            const q = test.questions.find(q => q.id === a.questionId)
            let isCorrect = false
            if (q) {
                if (q.questionType === 'open') {
                    const studentAns = (a.textAnswer || '').trim().toLowerCase()
                    const correctAns = (q.correctText || '').trim().toLowerCase()
                    isCorrect = correctAns.length > 0 && studentAns === correctAns
                } else {
                    isCorrect = q.correctIdx === a.selectedIdx
                }
            }
            return {
                questionId: a.questionId,
                selectedIdx: a.selectedIdx ?? -1,
                textAnswer: a.textAnswer || null,
                isCorrect,
                difficulty: q?.difficulty || 0.0
            }
        })

        const correct = results.filter((r: any) => r.isCorrect).length
        const total = test.questions.length
        const score = total > 0 ? (correct / total) * 100 : 0
        const finalScore = Math.round(score * 100) / 100

        const correctAnswers = test.questions.map(q => ({
            id: q.id,
            correctIdx: q.correctIdx,
            correctText: (q as any).questionType === 'open' ? (q as any).correctText : undefined,
            questionType: (q as any).questionType || 'mcq'
        }))

        const testType = (test as any).testType || 'milliy_sertifikat'
        const dtm = getDtmBall(test.subject || null, correct, total)
        const ms = getMsBall(correct, total)

        // Agar user login qilgan bo'lsa — attempt saqlaymiz va Rasch yangilaymiz
        let attempt = null
        if (req.user) {
            const profile = await prisma.studentProfile.findUnique({ where: { userId: req.user.id } })
            const currentAbility = Math.max(-5, Math.min(5, profile?.abilityLevel || 0.0))
            // Degenerate case: 0/n yoki n/n bo'lsa, yoki savollar < 3 ta bo'lsa
            // Rasch MLE diverge qiladi (±∞) — ability yangilanmasin
            const canUpdateRasch = results.length >= 3 && score > 0 && score < 100
            const newAbility = canUpdateRasch
                ? updateAbility(currentAbility, results.map((r: any) => ({ difficulty: r.difficulty, isCorrect: r.isCorrect })))
                : currentAbility
            attempt = await prisma.$transaction(async (tx) => {
                const att = await tx.testAttempt.create({
                    data: {
                        testId: test.id,
                        userId: req.user!.id,
                        answers: JSON.stringify(results),
                        score: finalScore,
                        raschAbility: newAbility
                    }
                })
                if (profile) {
                    await tx.studentProfile.update({
                        where: { userId: req.user!.id },
                        data: {
                            abilityLevel: newAbility,
                            totalTests: { increment: 1 },
                            avgScore: Math.round(((profile.avgScore * profile.totalTests + score) / (profile.totalTests + 1)) * 100) / 100
                        }
                    })
                }
                return att
            })
        }

        res.json({
            attempt,
            score: finalScore,
            grade: getGrade(finalScore),
            correct,
            total,
            testType,
            dtmBall: dtm.ball,
            dtmMax: dtm.max,
            msBall: ms.ball,
            msMax: ms.max,
            results,
            correctAnswers
        })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Test yechish va Rasch baholash
router.post('/:testId/submit', authenticate, submitLimiter, async (req: AuthRequest, res) => {
    try {
        const { answers } = req.body // [{questionId, selectedIdx}]
        if (!Array.isArray(answers)) {
            return res.status(400).json({ error: 'answers massiv bo\'lishi kerak' })
        }
        const test = await prisma.test.findUnique({
            where: { id: req.params.testId as string },
            include: { questions: true }
        })
        if (!test) return res.status(404).json({ error: 'Test topilmadi' })

        // Student faqat public testni submit qila oladi
        if (!test.isPublic && req.user?.role === 'STUDENT') {
            return res.status(403).json({ error: 'Bu test uchun ruxsat yo\'q' })
        }

        // Javoblarni tekshirish
        const results = await Promise.all(answers.map(async (a: any) => {
            const q = test.questions.find(q => q.id === a.questionId)
            let isCorrect = false
            if (q) {
                if (q.questionType === 'open') {
                    const studentAns = (a.textAnswer || '').trim()
                    const correctAns = (q.correctText || '').trim()
                    if (correctAns.length === 0 || studentAns.length === 0) {
                        isCorrect = false
                    } else if (studentAns.toLowerCase() === correctAns.toLowerCase()) {
                        // To'liq mos — AI ga so'ramasdan
                        isCorrect = true
                    } else {
                        // AI bilan semantik tekshirish
                        try {
                            const aiCheck = await aiClient.chat.completions.create({
                                model: aiModel,
                                messages: [{
                                    role: 'user',
                                    content: `Test savoliga to'g'ri javob: "${correctAns}"\nO'quvchi javobi: "${studentAns}"\n\nO'quvchining javobi to'g'rimi (ma'nosi bo'yicha, yozilishi farqli bo'lsa ham)? Faqat "HA" yoki "YOQ" deb javob ber.`
                                }],
                                max_tokens: 5,
                                temperature: 0
                            })
                            const reply = aiCheck.choices[0]?.message?.content?.trim().toUpperCase() || ''
                            isCorrect = reply.startsWith('HA')
                        } catch {
                            // AI xato bo'lsa — string solishtirish fallback
                            isCorrect = studentAns.toLowerCase() === correctAns.toLowerCase()
                        }
                    }
                } else {
                    isCorrect = q.correctIdx === a.selectedIdx
                }
            }
            return {
                questionId: a.questionId,
                selectedIdx: a.selectedIdx ?? -1,
                textAnswer: a.textAnswer || null,
                isCorrect,
                difficulty: q?.difficulty || 0.0
            }
        }))

        const correct = results.filter((r: any) => r.isCorrect).length
        const score = test.questions.length > 0 ? (correct / test.questions.length) * 100 : 0

        // Rasch ability hisoblash
        const profile = await prisma.studentProfile.findUnique({
            where: { userId: req.user.id }
        })
        const currentAbility = Math.max(-5, Math.min(5, profile?.abilityLevel || 0.0))
        // Degenerate case: 0/n yoki n/n bo'lsa, yoki savollar < 3 ta bo'lsa
        // Rasch MLE diverge qiladi (±∞) — ability yangilanmasin
        const canUpdateRasch = results.length >= 3 && score > 0 && score < 100
        const newAbility = canUpdateRasch
            ? updateAbility(currentAbility, results.map((r: any) => ({ difficulty: r.difficulty, isCorrect: r.isCorrect })))
            : currentAbility

        // $transaction yordamida ACID ta'minlash
        const finalScore = Math.round(score * 100) / 100

        const attempt = await prisma.$transaction(async (tx) => {
            const att = await tx.testAttempt.create({
                data: {
                    testId: test.id,
                    userId: req.user.id,
                    answers: JSON.stringify(results),
                    score: finalScore,
                    raschAbility: newAbility
                }
            })

            if (profile) {
                await tx.studentProfile.update({
                    where: { userId: req.user.id },
                    data: {
                        abilityLevel: newAbility,
                        totalTests: { increment: 1 },
                        avgScore: Math.round(((profile.avgScore * profile.totalTests + score) / (profile.totalTests + 1)) * 100) / 100
                    }
                })
            }

            return att;
        })

        // Submit dan keyin to'g'ri javoblarni qaytaramiz (oldin emas!)
        const correctAnswers = test.questions.map(q => ({
            id: q.id,
            correctIdx: q.correctIdx,
            correctText: (q as any).questionType === 'open' ? (q as any).correctText : undefined,
            questionType: (q as any).questionType || 'mcq'
        }))

        const dtm = getDtmBall(test.subject || null, correct, test.questions.length)
        const ms = getMsBall(correct, test.questions.length)

        res.json({
            attempt,
            score: Math.round(score * 100) / 100,
            grade: getGrade(Math.round(score * 100) / 100),
            correct,
            total: test.questions.length,
            newAbility,
            testType: (test as any).testType || 'milliy_sertifikat',
            dtmBall: dtm.ball,
            dtmMax: dtm.max,
            msBall: ms.ball,
            msMax: ms.max,
            results,
            correctAnswers
        })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Test statistikasi (o'qituvchi/admin)
router.get('/:testId/analytics', authenticate, requireRole('TEACHER', 'ADMIN'), async (req: AuthRequest, res) => {
    try {
        const where = req.user.role === 'ADMIN'
            ? { id: req.params.testId as string }
            : { id: req.params.testId as string, creatorId: req.user.id }

        const test = await prisma.test.findFirst({
            where,
            include: {
                questions: { orderBy: { orderIdx: 'asc' } },
                attempts: {
                    include: { user: { select: { name: true, email: true } } },
                    orderBy: { createdAt: 'desc' }
                }
            }
        })
        if (!test) return res.status(404).json({ error: 'Test topilmadi yoki ruxsat yo\'q' })

        // Har bir savol bo'yicha statistika
        const questionStats = test.questions.map(q => {
            let opts: any[]
            try {
                opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
            } catch (e) {
                console.warn('Question options parse failed:', e)
                opts = []
            }
            let totalAnswered = 0
            let correctCount = 0
            const optionCounts = new Array(opts.length).fill(0)

            for (const attempt of test.attempts) {
                let answers: any[] = []
                try {
                    answers = typeof attempt.answers === 'string'
                        ? JSON.parse(attempt.answers)
                        : attempt.answers as any[]
                } catch (e) {
                    console.error("Noto'g'ri JSON format saqlangan:", e)
                    continue
                }
                const ans = answers.find((a: any) => a.questionId === q.id)
                if (ans != null) {
                    totalAnswered++
                    if (ans.isCorrect) correctCount++
                    const idx = ans.selectedIdx
                    if (idx >= 0 && idx < opts.length) optionCounts[idx]++
                }
            }
            return {
                id: q.id, text: q.text, correctIdx: q.correctIdx, options: opts,
                totalAnswered, correctCount,
                errorRate: totalAnswered > 0 ? Math.round((1 - correctCount / totalAnswered) * 100) : 0,
                optionCounts
            }
        })

        const totalAttempts = test.attempts.length
        const avgScore = totalAttempts > 0
            ? Math.round(test.attempts.reduce((s: number, a: any) => s + a.score, 0) / totalAttempts * 10) / 10
            : 0

        // Har bir urinish uchun to'liq statistika (reyting uchun)
        const studentRows = test.attempts.map((a: any) => {
            let answers: any[] = []
            try { answers = typeof a.answers === 'string' ? JSON.parse(a.answers) : (a.answers || []) } catch { }
            const correctCount = answers.filter((r: any) => r.isCorrect).length
            const total = test.questions.length
            const scoreVal = Math.round(a.score * 10) / 10
            const dtm = getDtmBall(test.subject || null, correctCount, total)
            const ms = getMsBall(correctCount, total)
            return {
                name: a.user?.name || 'Noma\'lum',
                email: a.user?.email || '',
                score: scoreVal,
                correct: correctCount,
                total,
                dtmBall: dtm.ball,
                dtmMax: dtm.max,
                msBall: ms.ball,
                msMax: ms.max,
                grade: getGrade(scoreVal),
                raschAbility: a.raschAbility ?? null,
                createdAt: a.createdAt
            }
        }).sort((a: any, b: any) => b.score - a.score)

        res.json({
            test: { id: test.id, title: test.title, subject: test.subject, createdAt: test.createdAt },
            totalAttempts, avgScore,
            students: studentRows,
            questionStats
        })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Test public/private o'zgartirish
router.patch('/:testId/visibility', authenticate, requireRole('TEACHER', 'ADMIN'), async (req: AuthRequest, res) => {
    try {
        const { isPublic } = req.body
        if (typeof isPublic !== 'boolean') {
            return res.status(400).json({ error: 'isPublic boolean bo\'lishi kerak' })
        }
        const where = req.user.role === 'ADMIN'
            ? { id: req.params.testId as string }
            : { id: req.params.testId as string, creatorId: req.user.id }

        const test = await prisma.test.findFirst({ where })
        if (!test) return res.status(404).json({ error: 'Test topilmadi yoki ruxsat yo\'q' })

        const updated = await prisma.test.update({
            where: { id: test.id },
            data: { isPublic }
        })

        // Private → Public bo'lganda barcha studentlarga bildirishnoma
        if (isPublic && !test.isPublic) {
            try {
                const students = await prisma.user.findMany({
                    where: { role: 'STUDENT' },
                    select: { id: true }
                })
                if (students.length > 0) {
                    await prisma.notification.createMany({
                        data: students.map((s: { id: string }) => ({
                            userId: s.id,
                            senderId: req.user.id,
                            title: `📚 Yangi test: ${test.title}`,
                            message: `"${test.title}" nomli yangi public test qo'shildi. Hoziroq yechib ko'ring!`
                        }))
                    })
                }
            } catch (notifErr) {
                console.error('Notification send error:', notifErr)
            }
        }

        res.json(updated)
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Test o'chirish (o'qituvchi/admin)
router.delete('/:testId', authenticate, requireRole('TEACHER', 'ADMIN'), async (req: AuthRequest, res) => {
    try {
        // Admin har qanday testni o'chira oladi, o'qituvchi faqat o'zinikini
        const where = req.user.role === 'ADMIN'
            ? { id: req.params.testId as string }
            : { id: req.params.testId as string, creatorId: req.user.id }
        const deleted = await prisma.test.deleteMany({ where })
        if (deleted.count === 0) return res.status(404).json({ error: 'Test topilmadi yoki ruxsat yo\'q' })
        res.json({ message: 'Test o\'chirildi' })
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

export default router
