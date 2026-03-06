import { Router } from 'express'
import multer from 'multer'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import OpenAI from 'openai'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'
import { updateAbility } from '../utils/rasch'
import { uploadToS3 } from '../utils/s3'

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
const aiModel = hasDeepseek ? 'deepseek-chat' : 'gpt-4o-mini'

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

// Admin: barcha testlar
router.get('/all', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
        const tests = await prisma.test.findMany({
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
router.get('/by-link/:shareLink', authenticate, testReadLimiter, async (req: AuthRequest, res) => {
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
- Kamida 5 ta, ko'pi 30 ta savol
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
- Kamida 5 ta, ko'pi 30 ta savol
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
- Kamida 5 ta, ko'pi 30 ta savol
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
- Kamida 5 ta, ko'pi 30 ta savol
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
        const model = isVision ? 'gpt-4o-mini' : aiModel;

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
            temperature: 0.1
        })

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
                const options = Array.isArray(q.options) ? q.options.filter((o: any) => typeof o === 'string') : []
                if (options.length < 2) return null

                // correctIdx: raqam yoki harf ('A','B','C','D' yoki 'a','b','c','d') bo'lishi mumkin
                let correctIdx = 0
                if (typeof q.correctIdx === 'number') {
                    correctIdx = q.correctIdx
                } else if (typeof q.correctIdx === 'string') {
                    const letterIdx = ['a', 'b', 'c', 'd'].indexOf(q.correctIdx.toLowerCase())
                    correctIdx = letterIdx >= 0 ? letterIdx : 0
                } else if (typeof q.correct === 'string') {
                    const letterIdx = ['a', 'b', 'c', 'd'].indexOf(q.correct.toLowerCase())
                    correctIdx = letterIdx >= 0 ? letterIdx : 0
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
        const { title, description, subject, isPublic, questions, timeLimit } = req.body
        if (!title || !questions?.length) {
            return res.status(400).json({ error: 'Test nomi va savollar kerak' })
        }

        const test = await prisma.test.create({
            data: {
                title,
                description: description || null,
                subject: subject || null,
                isPublic: isPublic || false,
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

// AI test natijasi — faqat Rasch abilityLevel yangilash (test entity saqlanmaydi)
router.post('/submit-ai', authenticate, submitLimiter, async (req: AuthRequest, res) => {
    try {
        const { score, totalQuestions, results } = req.body
        if (!results || !Array.isArray(results)) {
            return res.status(400).json({ error: 'results kerak' })
        }
        const profile = await prisma.studentProfile.findUnique({ where: { userId: req.user.id } })
        if (!profile) return res.status(404).json({ error: 'Profil topilmadi' })

        const currentAbility = profile.abilityLevel
        const newAbility = updateAbility(currentAbility, results.map((r: any) => ({
            difficulty: r.difficulty || 0.0,
            isCorrect: r.isCorrect
        })))

        await prisma.studentProfile.update({
            where: { userId: req.user.id },
            data: {
                abilityLevel: newAbility,
                totalTests: { increment: 1 },
                avgScore: Math.round(((profile.avgScore * profile.totalTests + (score || 0)) / (profile.totalTests + 1)) * 100) / 100
            }
        })

        res.json({ newAbility, prevAbility: currentAbility })
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

        // Javoblarni tekshirish
        const results = answers.map((a: any) => {
            const q = test.questions.find(q => q.id === a.questionId)
            let isCorrect = false
            if (q) {
                if (q.questionType === 'open') {
                    // Yozma javob: case-insensitive, trim bilan solishtirish
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
        const score = test.questions.length > 0 ? (correct / test.questions.length) * 100 : 0

        // Rasch ability hisoblash
        const profile = await prisma.studentProfile.findUnique({
            where: { userId: req.user.id }
        })
        const currentAbility = profile?.abilityLevel || 0.0
        const newAbility = updateAbility(currentAbility, results.map((r: any) => ({
            difficulty: r.difficulty,
            isCorrect: r.isCorrect
        })))

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

        res.json({
            attempt,
            score: Math.round(score * 100) / 100,
            correct,
            total: test.questions.length,
            newAbility,
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
                    answers = JSON.parse(attempt.answers as string)
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

        res.json({
            test: { id: test.id, title: test.title, subject: test.subject },
            totalAttempts, avgScore,
            students: test.attempts.map((a: any) => ({
                name: a.user?.name || 'Noma\'lum',
                score: a.score,
                createdAt: a.createdAt
            })),
            questionStats
        })
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
