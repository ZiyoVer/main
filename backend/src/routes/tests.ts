import { Router } from 'express'
import crypto from 'crypto'
import multer from 'multer'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import OpenAI from 'openai'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { DtmBlockType } from '@prisma/client'
import prisma from '../utils/db'
import { authenticate, AuthRequest, requireRole, optionalAuthenticate } from '../middleware/auth'
import { consumeAiQuota, quotaExceededMessage } from '../utils/aiQuota'
import { uploadToS3, getSignedS3Url, resolveStoredS3Url, toStoredS3Ref, isStorageConfigured } from '../utils/s3'
import { logAdminAction } from '../utils/adminAudit'
import { getSubjectVariants, normalizeSubject, categoryForTest } from '../utils/subjects'
import { getEntitlement } from './billing'
import {
    getDefaultDtmCoefficient,
    getMsGrade,
    getTestTypeLabel,
    normalizeDtmBlockType,
    normalizeTestType,
    roundScore,
    scoreDtmBlockAttempt,
    scoreMilliySertifikatAttempt,
    scoreRegularAttempt,
} from '../utils/testScoring'

const TEST_SUBMIT_GRACE_MS = 5000

// Test allaqachon yechilgan bo'lsa (double-submit/replay) — 409 qaytarish uchun sentinel xato.
class AlreadySubmittedError extends Error {
    constructor() {
        super('Bu test allaqachon yechilgan')
        this.name = 'AlreadySubmittedError'
    }
}

function getTimeLimitMs(timeLimit: number | null | undefined): number | null {
    if (typeof timeLimit !== 'number' || !Number.isFinite(timeLimit) || timeLimit <= 0) return null
    return Math.round(timeLimit * 60 * 1000)
}

function getTimeRemainingSeconds(expiresAt: Date, now = new Date()): number {
    return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000))
}

// ---- Zaiflik tahlili (closed learning loop) yordamchilari ----
// DTM majburiy bloklarining inson-o'qiydigan yorliqlari.
const DTM_BLOCK_LABELS: Partial<Record<DtmBlockType, string>> = {
    MANDATORY_LANGUAGE: 'Ona tili',
    MANDATORY_MATH: 'Majburiy matematika',
    MANDATORY_HISTORY: "O'zbekiston tarixi",
}

// TopicStat uchun subject kaliti: testning normalizatsiyalangan fani (yoki 'Umumiy').
function subjectKeyForTest(test: { subject?: string | null }): string {
    return normalizeSubject(test.subject) ?? test.subject ?? 'Umumiy'
}

// Savol uchun mavzu kaliti: avval AI bergan topic, bo'lmasa blockType yorlig'i,
// bo'lmasa test fani. Ixtisoslik bloklari mos fanga tushadi.
function topicKeyForQuestion(
    q: { topic?: string | null; blockType?: DtmBlockType | null },
    test: { subject?: string | null; subject2?: string | null },
): string {
    const t = normalizeTopicKey(q.topic)
    if (t) return t
    const bt = q.blockType ?? 'GENERIC'
    if (bt === 'SPECIALTY_1') return normalizeSubject(test.subject) ?? test.subject ?? '1-ixtisoslik'
    if (bt === 'SPECIALTY_2') return normalizeSubject(test.subject2) ?? test.subject2 ?? '2-ixtisoslik'
    const label = DTM_BLOCK_LABELS[bt]
    if (label) return label
    return normalizeSubject(test.subject) ?? test.subject ?? 'Umumiy'
}

// Har bir savol natijasidan (to'g'ri/jami) hissasi — matching/multipart partial-credit bilan.
function topicContribution(r: { isCorrect?: boolean; correctSubCount?: number; totalSubs?: number }): { correct: number; total: number } {
    if (typeof r.totalSubs === 'number' && r.totalSubs > 0) {
        return { correct: r.correctSubCount || 0, total: r.totalSubs }
    }
    return { correct: r.isCorrect ? 1 : 0, total: 1 }
}

async function ensureTestSession(testId: string, userId: string, timeLimit: number, shareLink?: string | null) {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + timeLimit * 60 * 1000)
    const where = { testId_userId: { testId, userId } }
    const existing = await prisma.testSession.findUnique({ where })

    if (!existing || existing.submittedAt || existing.expiresAt.getTime() <= now.getTime()) {
        return prisma.testSession.upsert({
            where,
            create: {
                testId,
                userId,
                shareLink: shareLink ?? null,
                startedAt: now,
                expiresAt
            },
            update: {
                shareLink: shareLink ?? null,
                startedAt: now,
                expiresAt,
                submittedAt: null
            }
        })
    }

    return existing
}

function normalizeOpenAnswer(text: string | null | undefined): string {
    return (text || '')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[’`]/g, '\'')
        .toLowerCase()
}

// YOPIQ HALQA: mavzu kalitini birxillashtirish — "Kvadrat tenglamalar" /
// "kvadrat tenglamalar." / "Kvadrat  tenglamalar" bitta TopicStat qatoriga tushsin.
// Aks holda har variant alohida qator bo'lib total>= porogga yetmaydi (halqa ochilmaydi).
function normalizeTopicKey(raw: string | null | undefined): string {
    return (raw || '')
        .toLowerCase()
        .replace(/[`´ʼ’‘ʻ]/g, '\'')   // apostrof variantlari -> bitta
        .replace(/\s+/g, ' ')
        .replace(/[.,;:!?]+$/u, '')     // oxiridagi tinish belgilari
        .trim()
}

function parseAcceptedAnswers(text: string | null | undefined): string[] {
    return String(text || '')
        .split(/\r?\n+/)
        .map((part) => part.trim())
        .filter(Boolean)
}

function formatAcceptedAnswers(text: string | null | undefined): string {
    const answers = parseAcceptedAnswers(text)
    return answers.join(' / ')
}

function repairAiJson(raw: string): string {
    return raw
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, '\'')
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
}

function isAnalysisAnswerCorrect(questionType: string | null | undefined, studentAnswer: string | null | undefined, correctAnswer: string | null | undefined): boolean {
    if (questionType === 'open' || questionType === 'multipart_open') {
        const normalizedStudent = normalizeOpenAnswer(studentAnswer)
        if (!normalizedStudent) return false
        const acceptedAnswers = parseAcceptedAnswers(correctAnswer).map(normalizeOpenAnswer)
        return acceptedAnswers.includes(normalizedStudent)
    }
    return String(studentAnswer || '').trim().toUpperCase() !== ''
        && String(studentAnswer || '').trim().toUpperCase() === String(correctAnswer || '').trim().toUpperCase()
}

function formatQuestionForAnalysis(question: any, index: number): string {
    const questionType = question?.questionType || 'mcq'
    const questionText = String(question?.text || 'Savol').substring(0, 180)

    if ((questionType === 'matching' || questionType === 'multipart_open') && Array.isArray(question?.subAnswers)) {
        const subLines = question.subAnswers.map((subAnswer: any, subIndex: number) => {
            const studentAnswer = String(subAnswer?.studentAnswer || '—')
            const rawCorrectAnswer = String(subAnswer?.correctAnswer || '—')
            const correctAnswer = formatAcceptedAnswers(rawCorrectAnswer) || '—'
            const isCorrect = isAnalysisAnswerCorrect(questionType, studentAnswer, rawCorrectAnswer)
            const label = String(subAnswer?.label || (questionType === 'multipart_open' ? String.fromCharCode(65 + subIndex) : subIndex + 1))
            const subText = String(subAnswer?.subText || 'Bo\'lim').substring(0, 140)
            return `   ${isCorrect ? '✅' : '❌'} ${label}. ${subText} — O'quvchi: ${studentAnswer} | To'g'ri: ${correctAnswer}`
        }).join('\n')

        const allCorrect = question.subAnswers.length > 0 && question.subAnswers.every((subAnswer: any) =>
            isAnalysisAnswerCorrect(questionType, subAnswer?.studentAnswer, subAnswer?.correctAnswer)
        )

        return `${allCorrect ? '✅' : '❌'} ${index + 1}. ${questionText}\n${subLines}`
    }

    const optLabels = ['A', 'B', 'C', 'D']
    const variants = ['a', 'b', 'c', 'd']
        .map((key, optionIndex) => question?.[key] ? `${optLabels[optionIndex]}) ${question[key]}` : null)
        .filter(Boolean)
        .join(' | ')
    const studentAnswer = String(question?.studentAnswer || '—')
    const rawCorrectAnswer = String(question?.correctAnswer || '—')
    const correctAnswer = questionType === 'open'
        ? (formatAcceptedAnswers(rawCorrectAnswer) || '—')
        : rawCorrectAnswer
    const isCorrect = isAnalysisAnswerCorrect(questionType, studentAnswer, rawCorrectAnswer)

    return `${isCorrect ? '✅' : '❌'} ${index + 1}. ${questionText}${variants ? `\n   Variantlar: ${variants}` : ''}\n   O'quvchi: ${studentAnswer.toUpperCase()} | To'g'ri: ${correctAnswer.toUpperCase()}`
}

// Yozma javob baholash natijasi: aiVerified=false — AI tekshira olmadi (texnik xato),
// javob "xato" deb belgilanadi, LEKIN bu holat JIM yutilmaydi: yuqoriga unverified
// sifatida chiqadi va submit javobida unverifiedOpenCount bo'lib ko'rinadi.
interface OpenAnswerVerdict { correct: boolean; aiVerified: boolean }

async function evaluateOpenAnswer(studentAnswer: string, correctAnswer: string): Promise<OpenAnswerVerdict> {
    const normalizedStudent = normalizeOpenAnswer(studentAnswer)
    const acceptedAnswers = parseAcceptedAnswers(correctAnswer)
    const normalizedAnswers = [...new Set(acceptedAnswers.map(normalizeOpenAnswer).filter(Boolean))]

    if (!normalizedStudent || normalizedAnswers.length === 0) {
        return { correct: false, aiVerified: true }
    }

    if (normalizedAnswers.includes(normalizedStudent)) {
        return { correct: true, aiVerified: true }
    }

    // AI semantik tekshiruv — 2 urinish (avval bitta xato = o'quvchi javobi jimgina 0 olardi)
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const aiCheck = await aiClient.chat.completions.create({
                model: aiModel,
                messages: [{
                    role: 'user',
                    content: `Test savoli uchun to'g'ri javob variantlari:\n${acceptedAnswers.map((answer, index) => `${index + 1}) "${answer}"`).join('\n')}\n\nO'quvchi javobi: "${studentAnswer.trim()}"\n\nO'quvchining javobi shu variantlardan biriga ma'nosi bo'yicha mos keladimi? Faqat "HA" yoki "YOQ" deb javob ber.`
                }],
                max_tokens: 5,
                temperature: 0
            }, { timeout: 8000 })
            const reply = aiCheck.choices[0]?.message?.content?.trim().toUpperCase() || ''
            return { correct: reply.startsWith('HA'), aiVerified: true }
        } catch (e) {
            if (attempt === 1) console.warn('evaluateOpenAnswer: AI 2 urinishda ham javob bermadi:', (e as Error)?.message)
        }
    }
    return { correct: false, aiVerified: false }
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

// AI tahlil endpointlari (/explain, /analyze-result, /analyze-vision) uchun rate limit.
// Bular faqat authenticate bilan himoyalangan edi (limiter yo'q) — qimmat LLM chaqiruvlari
// cheksiz chaqirilib xarajat abuse'iga sabab bo'lardi. 20/5daqiqa oddiy foydalanuvchi uchun
// yetarlicha keng (xatolarni birma-bir tushuntirish), lekin abuse'ni to'sadi.
const aiAnalysisLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 20,
    keyGenerator: (req: any) => req.user?.id || ipKeyGenerator(req),
    message: { error: 'AI tahlil limiti. Bir necha daqiqadan keyin qayta urinib ko\'ring.' },
    standardHeaders: true,
    legacyHeaders: false,
})

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

// ASOSIY: DeepSeek (test generatsiya — JSON bloklarni ishonchli beradi). Gemini — FAQAT vision (rasm/OCR).
const hasGemini = !!process.env.GEMINI_API_KEY
const hasDeepseek = !!process.env.DEEPSEEK_API_KEY
const VISION_MODEL = 'gemini-2.5-flash'

const geminiClient = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY || '',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
})
const deepseekClient = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY || ''
})
// aiClient/aiModel ASOSIY = DeepSeek (key bo'lsa). gptClient = Gemini (vision).
const aiClient = hasDeepseek ? deepseekClient : geminiClient
const aiModel = hasDeepseek ? 'deepseek-chat' : 'gemini-2.5-flash'
const gptClient = geminiClient // vision (OCR) — Gemini

const QUESTION_GENERATION_MAX_OUTPUT_TOKENS = 8000
const QUESTION_GENERATION_MAX_TOTAL = 90
const QUESTION_GENERATION_MAX_PER_CHUNK = 24
const QUESTION_GENERATION_TEXT_CHUNK_SIZE = 18000
const QUESTION_GENERATION_TEXT_MAX_CHUNKS = 4
const QUESTION_GENERATION_VISION_BATCH_PAGES = 2
const QUESTION_GENERATION_VISION_MAX_PAGES = 12

interface IncomingCreateQuestion {
    text?: string
    imageUrl?: string | null
    options?: string[] | string
    optionImages?: unknown // (string|null)[] — MCQ variant rasmlari (s3key: ref'lar)
    correctIdx?: number
    correctText?: string | null
    solutionImageUrl?: unknown // yechim rasmi (s3key: ref)
    questionType?: string
    difficulty?: number
    blockType?: DtmBlockType | string | null
    coefficient?: number | string | null
}

const DTM_OFFICIAL_TOTAL_QUESTIONS = 90
const DTM_OFFICIAL_BLOCKS: Array<{ blockType: DtmBlockType; label: string; count: number }> = [
    { blockType: 'MANDATORY_LANGUAGE', label: 'Ona tili', count: 10 },
    { blockType: 'MANDATORY_MATH', label: 'Majburiy matematika', count: 10 },
    { blockType: 'MANDATORY_HISTORY', label: 'O‘zbekiston tarixi', count: 10 },
    { blockType: 'SPECIALTY_1', label: '1-ixtisoslik', count: 30 },
    { blockType: 'SPECIALTY_2', label: '2-ixtisoslik', count: 30 },
]

function parseQuestionCoefficient(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return roundScore(value)
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value)
        if (Number.isFinite(parsed) && parsed > 0) return roundScore(parsed)
    }
    return null
}

function createDtmBlockCounts(): Record<DtmBlockType, number> {
    return {
        GENERIC: 0,
        MANDATORY_LANGUAGE: 0,
        MANDATORY_MATH: 0,
        MANDATORY_HISTORY: 0,
        SPECIALTY_1: 0,
        SPECIALTY_2: 0,
    }
}

// Rasmiy DTM blok tartibi — saqlashda savollar shu tartibda joylanadi (orderIdx massivdan olinadi).
// Invariant serverda turadi: eski klient, to'g'ridan-to'g'ri API chaqiruv yoki kelajakdagi
// import yo'li ham blok tartibini buza olmaydi.
const DTM_BLOCK_SAVE_ORDER: Record<string, number> = {
    MANDATORY_LANGUAGE: 0, MANDATORY_MATH: 1, MANDATORY_HISTORY: 2, SPECIALTY_1: 3, SPECIALTY_2: 4
}

function sortDtmQuestionsInPlace(questions: unknown[]): void {
    const rank = (question: unknown) => {
        const rawBlockType = (question as IncomingCreateQuestion | null)?.blockType
        const blockType = normalizeDtmBlockType(typeof rawBlockType === 'string' ? rawBlockType : undefined)
        return DTM_BLOCK_SAVE_ORDER[blockType] ?? 9
    }
    // Array.prototype.sort barqaror — blok ichidagi tartib o'zgarmaydi
    questions.sort((a, b) => rank(a) - rank(b))
}

function validateDtmBlockStructure(questions: IncomingCreateQuestion[], subject2: string | null): string | null {
    if (questions.length > DTM_OFFICIAL_TOTAL_QUESTIONS) {
        return `DTM blok testida eng ko'pi bilan ${DTM_OFFICIAL_TOTAL_QUESTIONS} ta savol bo'lishi kerak`
    }

    const counts = createDtmBlockCounts()
    questions.forEach((question) => {
        const blockType = normalizeDtmBlockType(typeof question.blockType === 'string' ? question.blockType : undefined)
        counts[blockType] += 1
    })

    if (counts.GENERIC > 0) {
        return `DTM blok testida ${counts.GENERIC} ta savolda blok turi tanlanmagan`
    }

    const specialty2Questions = counts.SPECIALTY_2
    if (specialty2Questions > 0 && !subject2) {
        return 'DTM blok testida 2-ixtisoslik savollari bor, lekin 2-fan tanlanmagan'
    }

    const overLimitBlock = DTM_OFFICIAL_BLOCKS.find((block) => counts[block.blockType] > block.count)
    if (overLimitBlock) {
        return `${overLimitBlock.label} bloki ${overLimitBlock.count} savoldan oshmasligi kerak`
    }

    if (questions.length !== DTM_OFFICIAL_TOTAL_QUESTIONS) {
        return null
    }

    if (!subject2) {
        return 'Rasmiy 90 savollik DTM blok test uchun 2-ixtisoslik fani tanlanishi kerak'
    }

    const mismatch = DTM_OFFICIAL_BLOCKS.find((block) => counts[block.blockType] !== block.count)
    if (mismatch) {
        return `Rasmiy DTM blok taqsimoti xato: ${mismatch.label} ${mismatch.count} ta bo'lishi kerak, hozir ${counts[mismatch.blockType]} ta`
    }

    return null
}

interface StoredMatchingData {
    answers: string[]
    subQuestions: Array<{ text: string; correctIdx: number }>
}

interface StoredMultipartData {
    subQuestions: Array<{ label: string; text: string; correctText: string }>
}

function parseStoredQuestionOptions(questionType: string | null | undefined, rawOptions: string): string[] | StoredMatchingData | StoredMultipartData {
    try {
        const parsed = JSON.parse(rawOptions)
        if (questionType === 'matching') {
            const answers = Array.isArray((parsed as { answers?: unknown }).answers)
                ? (parsed as { answers: unknown[] }).answers.map((answer) => String(answer || ''))
                : []
            const subQuestions = Array.isArray((parsed as { subQuestions?: unknown }).subQuestions)
                ? (parsed as { subQuestions: Array<{ text?: unknown; correctIdx?: unknown }> }).subQuestions.map((subQuestion) => ({
                    text: String(subQuestion.text || ''),
                    correctIdx: typeof subQuestion.correctIdx === 'number' ? subQuestion.correctIdx : 0,
                }))
                : []
            return { answers, subQuestions }
        }

        if (questionType === 'multipart_open') {
            const subQuestions = Array.isArray((parsed as { subQuestions?: unknown }).subQuestions)
                ? (parsed as { subQuestions: Array<{ label?: unknown; text?: unknown; correctText?: unknown }> }).subQuestions.map((subQuestion, subIndex) => ({
                    label: String(subQuestion.label || String.fromCharCode(65 + subIndex)),
                    text: String(subQuestion.text || ''),
                    correctText: String(subQuestion.correctText || ''),
                }))
                : []
            return { subQuestions }
        }

        return Array.isArray(parsed) ? parsed.map((option) => String(option || '')) : []
    } catch {
        if (questionType === 'matching') return { answers: [], subQuestions: [] }
        if (questionType === 'multipart_open') return { subQuestions: [] }
        return []
    }
}

// ── Variant/yechim rasmlari (FAZA 3) ─────────────────────────────────────────
// optionImages DB'da options bilan PARALLEL JSON massiv: ["s3key:...", null, ...]
const MAX_IMAGE_REF_LENGTH = 500

function parseStoredOptionImages(raw?: string | null): (string | null)[] {
    if (!raw) return []
    try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed)
            ? parsed.map((value) => (typeof value === 'string' && value.trim() ? value.trim() : null))
            : []
    } catch {
        return []
    }
}

function sanitizeIncomingImageRef(value: unknown): string | null {
    return typeof value === 'string' && value.trim() && value.length <= MAX_IMAGE_REF_LENGTH ? value.trim() : null
}

// Klientdan kelgan variant-rasm massivi: options soniga qirqiladi, har element tozalanadi;
// birorta rasm bo'lmasa null (DB'da ortiqcha "[null,null,...]" saqlamaymiz)
function sanitizeIncomingOptionImages(value: unknown, optionCount: number): string | null {
    if (!Array.isArray(value) || optionCount <= 0) return null
    const cleaned: (string | null)[] = []
    for (let i = 0; i < optionCount; i++) {
        cleaned.push(sanitizeIncomingImageRef(value[i]))
    }
    return cleaned.some((v) => v !== null) ? JSON.stringify(cleaned) : null
}

// O'qish yo'llari uchun: saqlangan ref'larni signed URL'ga aylantiradi (rasm bo'lmasa null)
async function resolveStoredOptionImages(raw?: string | null): Promise<(string | null)[] | null> {
    const refs = parseStoredOptionImages(raw)
    if (refs.length === 0 || !refs.some((r) => r !== null)) return null
    return Promise.all(refs.map((ref) => (ref ? resolveStoredS3Url(ref) : Promise.resolve(null))))
}

function buildQuestionGeneratorSystemPrompt() {
    return `Siz test savollari generatorisiz. Sizga berilgan matn yoki rasmdan savollarni AYNAN ajratib olasiz. FAQAT JSON array formatda javob bering, boshqa hech narsa yozmasdan.

SAVOL TURLARI:
1. MCQ (ko'p tanlovli, standart): {"text":"...","options":["A","B","C","D"],"correctIdx":0}
   - correctIdx: to'g'ri javob indeksi (0=A, 1=B, 2=C, 3=D)
2. MOSLASHTIRISH (matching/juftlash): {"text":"...","questionType":"matching","answers":["...","...","..."],"subQuestions":[{"text":"...","correctIdx":0},{"text":"...","correctIdx":1}]}
   - Juftlash, moslashtirish, "qaysi guruhga/ustonga tegishli" kabi savollarda ishlating
   - "answers": umumiy javoblar banki (2-6 ta element, masalan poytaxtlar yoki ta'riflar ro'yxati)
   - "subQuestions": kichik savollar, har biri {"text":"...","correctIdx":N} ko'rinishida
   - correctIdx — "answers" massividagi to'g'ri javob indeksi (0 dan boshlanadi)

MATEMATIK IFODALAR VA GEOMETRIK CHIZMALAR UCHUN QAT'IY QOIDALAR (MUHIM):
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
}

function buildTextQuestionPrompt(params: {
    text: string
    subjectNote: string
    jsonFormat: string
    chunkIndex?: number
    chunkTotal?: number
    truncated?: boolean
    maxQuestions: number
}) {
    const { text, subjectNote, jsonFormat, chunkIndex, chunkTotal, truncated, maxQuestions } = params
    const chunkLabel = chunkTotal && chunkTotal > 1 ? ` Bu ${chunkIndex! + 1}/${chunkTotal} qism.` : ''

    return `Quyidagi matnda TAYYOR test savollari va variantlari bor. Ularni AYNAN o'sha holda ajratib ol — o'zing savol to'qima, o'zgartirma.${subjectNote}${chunkLabel}

MUHIM QOIDALAR:
- Matndagi mavjud savol va variantlarni AYNAN ko'chir
- Agar matnda savol topilmasa YOKI matn o'quv material bo'lsa — o'sha materialdan YANGI savol yaratishga ruxsat beriladi
- MCQ savol: {"text":"...","options":["A","B","C","D"],"correctIdx":0}
- Moslashtirish savol: {"text":"...","questionType":"matching","answers":[...],"subQuestions":[{"text":"...","correctIdx":0}]}
- Ko'pi bilan ${maxQuestions} ta sifatli savol qaytaring
- Matematik ifodalarni KaTeX formatida yoz: $\\sqrt{x}$, $\\frac{a}{b}$, $x^{2}$, $a_{n}$, $\\pi$
- Har qanday formula, ildiz, kasr, daraja, indeksni LaTeX bilan ifodalash SHART
${truncated ? '- DIQQAT: Fayl katta, barcha qismi sig\'madi; berilgan bo\'lakdan maksimal foydali savollar qaytaring\n' : ''}
Javobni FAQAT JSON array formatda qaytargil, boshqa hech narsa yozma:
${jsonFormat}

Matn:
${text}`
}

function chunkTextForQuestionGeneration(fullText: string): { chunks: string[]; truncated: boolean } {
    const text = fullText.trim()
    if (!text) return { chunks: [], truncated: false }

    const chunks: string[] = []
    let remaining = text

    while (remaining.length > 0 && chunks.length < QUESTION_GENERATION_TEXT_MAX_CHUNKS) {
        if (remaining.length <= QUESTION_GENERATION_TEXT_CHUNK_SIZE) {
            chunks.push(remaining.trim())
            remaining = ''
            break
        }

        let splitAt = Math.max(
            remaining.lastIndexOf('\n\n', QUESTION_GENERATION_TEXT_CHUNK_SIZE),
            remaining.lastIndexOf('\n', QUESTION_GENERATION_TEXT_CHUNK_SIZE),
            remaining.lastIndexOf('. ', QUESTION_GENERATION_TEXT_CHUNK_SIZE),
            remaining.lastIndexOf('? ', QUESTION_GENERATION_TEXT_CHUNK_SIZE),
            remaining.lastIndexOf('! ', QUESTION_GENERATION_TEXT_CHUNK_SIZE),
        )

        if (splitAt < QUESTION_GENERATION_TEXT_CHUNK_SIZE * 0.4) {
            splitAt = QUESTION_GENERATION_TEXT_CHUNK_SIZE
        }

        const chunk = remaining.slice(0, splitAt).trim()
        if (chunk) chunks.push(chunk)
        remaining = remaining.slice(splitAt).trim()
    }

    return { chunks, truncated: remaining.length > 0 }
}

async function generateQuestionsFromScannedPdf(buffer: Buffer, subjectNote: string, jsonFormat: string) {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as any)
    const { createCanvas } = await import('@napi-rs/canvas')

    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
    const pdfDoc = await loadingTask.promise
    const pageLimit = Math.min(pdfDoc.numPages, QUESTION_GENERATION_VISION_MAX_PAGES)
    const truncated = pdfDoc.numPages > QUESTION_GENERATION_VISION_MAX_PAGES
    let rawQuestions: any[] = []

    for (let startPage = 1; startPage <= pageLimit; startPage += QUESTION_GENERATION_VISION_BATCH_PAGES) {
        const remainingSlots = QUESTION_GENERATION_MAX_TOTAL - rawQuestions.length
        if (remainingSlots <= 0) break

        const endPage = Math.min(pageLimit, startPage + QUESTION_GENERATION_VISION_BATCH_PAGES - 1)
        const imageMessages: any[] = []

        for (let pageNumber = startPage; pageNumber <= endPage; pageNumber++) {
            const page = await pdfDoc.getPage(pageNumber)
            const viewport = page.getViewport({ scale: 1.5 })
            const canvas = createCanvas(viewport.width, viewport.height)
            const ctx = canvas.getContext('2d')
            await page.render({ canvasContext: ctx as any, viewport }).promise
            const base64 = canvas.toBuffer('image/png').toString('base64')
            imageMessages.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } })
        }

        if (imageMessages.length === 0) continue

        try {
            const aiContent = await generateQuestionJson([{
                role: 'user',
                content: [
                    ...imageMessages,
                    {
                        type: 'text',
                        text: `Bu skanerlangan PDF sahifalaridan test savollari va variantlarini AYNAN ajratib ol.${subjectNote}

Sahifalar: ${startPage}-${endPage}${truncated ? ` (PDF katta, faqat birinchi ${QUESTION_GENERATION_VISION_MAX_PAGES} sahifa tahlil qilinyapti)` : ''}

MUHIM QOIDALAR:
- Rasmdagi mavjud savol va variantlarni AYNAN ko'chir
- Agar bu sahifalarda tayyor test bo'lmasa, shu sahifadagi mavzu/materialdan yangi savollar tuzishga ruxsat beriladi
- Ko'pi bilan ${Math.min(18, remainingSlots)} ta sifatli savol qaytaring
- MCQ savol: {"text":"...","options":["A","B","C","D"],"correctIdx":0}
- Moslashtirish savol: {"text":"...","questionType":"matching","answers":[...],"subQuestions":[{"text":"...","correctIdx":0}]}
- Matematik ifodalarni KaTeX formatida yoz: $\\sqrt{x}$, $\\frac{a}{b}$, $x^{2}$, $a_{n}$, $\\pi$
- Rasmdagi har qanday formula, ildiz, kasr, daraja, indeksni LaTeX bilan ifodalash SHART

Javobni FAQAT JSON array formatda qaytargil:
${jsonFormat}`
                    }
                ]
            }], true)

            const parsed = parseQuestionJson(aiContent)
            const validated = validateGeneratedQuestions(parsed)
            rawQuestions = dedupeGeneratedQuestions([...rawQuestions, ...validated]).slice(0, QUESTION_GENERATION_MAX_TOTAL)
        } catch (batchErr: any) {
            console.warn(`Scanned PDF pages ${startPage}-${endPage} generation failed:`, batchErr?.message || batchErr)
        }
    }

    return { questions: rawQuestions, truncated }
}

// ── To'liq DTM blok test PDF import ──────────────────────────────────────────
// Bitta kitobcha (≈16-24 sahifa, 90 savol) → savollar blockType teglari bilan.
// Javoblar jadvali ("KALIT") topilsa AI taxminidan USTUN qo'llanadi — fromKey=true.
const DTM_VISION_MAX_PAGES = 30
const DTM_VISION_BATCH_PAGES = 3 // 24 sahifalik kitobcha ≈ 8 ta AI chaqiruv
const DTM_MAX_QUESTIONS = 90

type DtmAnswerKey = { blockType: string | null; answers: Record<string, unknown> }

function buildDtmImportPrompt(params: {
    subject: string; subject2: string; lastBlock: string; pageLabel: string
}): string {
    const { subject, subject2, lastBlock, pageLabel } = params
    return `Bu — DTM blok test kitobchasining ${pageLabel}. Undagi TAYYOR savollarni AYNAN ko'chirib JSON qaytar — o'zing savol to'qima.

KITOBCHA TARTIBI (blok aniqlashda shundan foydalaning):
1) Majburiy fanlar: Ona tili (10 savol) → Matematika (10 savol) → O'zbekiston tarixi (10 savol)
2) 1-ixtisoslik: ${subject} (30 savol)
3) 2-ixtisoslik: ${subject2} (30 savol)

BLOK ANIQLASH QOIDALARI:
- Sahifada bo'lim sarlavhasi ko'rinsa (masalan "ONA TILI", "MATEMATIKA", "O'ZBEKISTON TARIXI", "${subject.toUpperCase()}", "${subject2.toUpperCase()}") — keyingi savollar o'sha blokka tegishli
- Sarlavha ko'rinmasa — savollar ${lastBlock} blokining DAVOMI
- blockType qiymatlari: MANDATORY_LANGUAGE (ona tili), MANDATORY_MATH (majburiy matematika, 10 talik), MANDATORY_HISTORY (tarix), SPECIALTY_1 (${subject}, 30 talik), SPECIALTY_2 (${subject2}, 30 talik)
- DIQQAT: majburiy fanlar kitob BOSHIDA 10 tadan keladi; 30 talik bo'limlar — ixtisoslik. Ixtisoslik fani majburiy fan bilan bir xil bo'lsa (masalan ikkalasi ham Matematika) — savol soni va joylashuvidan farqlang.

HAR SAVOL shu formatda:
{"num": <savolning kitobchadagi raqami>, "blockType": "...", "text": "...", "options": ["...","...","...","..."], "correctIdx": 0}
- correctIdx: kitobda to'g'ri javob belgilangan bo'lsa — o'shani ol; belgilanmagan bo'lsa savolni O'ZING yechib eng ishonchli javobni tanla

JAVOBLAR JADVALI: sahifada "JAVOBLAR" / "KALIT" / javoblar jadvali (raqam→harf) ko'rsang, uni savol sifatida EMAS, shunday element sifatida qaytar:
{"answerKey": true, "blockType": "SPECIALTY_1 (jadval qaysi fanga tegishli bo'lsa; umumiy bo'lsa null)", "answers": {"1":"A","2":"C"}}

- Chizma/grafik/jadvalli savolda matnga "[Chizma: qisqa tavsif]" qo'shib qo'y
- Formulalar FAQAT KaTeX: $\\frac{a}{b}$, $\\sqrt{x}$, $x^{2}$
- Sahifadagi BARCHA savollarni qaytar, tashlab ketma

Javob FAQAT JSON array, boshqa hech narsa yozma.`
}

// AI javobidan savollar va javob-kalit jadvallarini ajratadi
function collectDtmGeneratedItems(items: any[]): { questions: any[]; answerKeys: DtmAnswerKey[] } {
    const letterToIdx = (s: unknown) => ['a', 'b', 'c', 'd'].indexOf(String(s ?? '').trim().toLowerCase())
    const questions: any[] = []
    const answerKeys: DtmAnswerKey[] = []
    for (const item of Array.isArray(items) ? items : []) {
        if (!item) continue
        if (item.answerKey && item.answers && typeof item.answers === 'object') {
            const blockType = normalizeDtmBlockType(typeof item.blockType === 'string' ? item.blockType : undefined)
            answerKeys.push({ blockType: blockType === 'GENERIC' ? null : blockType, answers: item.answers })
            continue
        }
        if (!item.text || !Array.isArray(item.options)) continue
        const options = item.options.filter((o: any) => typeof o === 'string' && o.trim().length > 0).slice(0, 4)
        if (options.length < 2) continue
        let correctIdx = typeof item.correctIdx === 'number' ? item.correctIdx : letterToIdx(item.correctIdx ?? item.correct ?? item.answer)
        if (correctIdx < 0 || correctIdx >= options.length) correctIdx = 0
        const blockType = normalizeDtmBlockType(typeof item.blockType === 'string' ? item.blockType : undefined)
        const num = Number.parseInt(String(item.num ?? ''), 10)
        questions.push({
            text: String(item.text).trim(),
            options,
            correctIdx,
            blockType: blockType === 'GENERIC' ? null : blockType,
            num: Number.isFinite(num) ? num : null,
            fromKey: false,
        })
    }
    return { questions, answerKeys }
}

// Javob-kalit jadvalini savollarga qo'llaydi (AI taxminidan ustun) — nechtasi qo'llanganini qaytaradi
function applyDtmAnswerKeys(questions: any[], answerKeys: DtmAnswerKey[]): number {
    let applied = 0
    for (const key of answerKeys) {
        for (const [numStr, rawAnswer] of Object.entries(key.answers)) {
            const num = Number.parseInt(numStr, 10)
            if (!Number.isFinite(num)) continue
            const idx = typeof rawAnswer === 'number'
                ? rawAnswer
                : ['a', 'b', 'c', 'd'].indexOf(String(rawAnswer ?? '').trim().toLowerCase())
            if (idx < 0 || idx > 3) continue
            // Jadval bloki ma'lum bo'lsa faqat o'sha blokda qidiramiz, bo'lmasa hamma savolda
            const pool = key.blockType ? questions.filter(q => q.blockType === key.blockType) : questions
            const target = pool.find(q => q.num === num)
            if (target && idx < target.options.length) {
                target.correctIdx = idx
                target.fromKey = true
                applied++
            }
        }
    }
    return applied
}

async function generateDtmQuestionsFromPdf(buffer: Buffer, subject: string, subject2: string) {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as any)
    const { createCanvas } = await import('@napi-rs/canvas')

    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
    const pdfDoc = await loadingTask.promise
    const pageLimit = Math.min(pdfDoc.numPages, DTM_VISION_MAX_PAGES)
    const truncated = pdfDoc.numPages > DTM_VISION_MAX_PAGES

    let allQuestions: any[] = []
    const allAnswerKeys: DtmAnswerKey[] = []
    // Batch orasida blok kontekstini tashiymiz — sarlavhasiz sahifa oldingi blokning davomi
    let lastBlock = 'MANDATORY_LANGUAGE (kitob boshi — ona tili)'

    // DIQQAT: savol soni yetganda ham TO'XTAMAYMIZ — javoblar jadvali kitob OXIRIDA bo'ladi
    for (let startPage = 1; startPage <= pageLimit; startPage += DTM_VISION_BATCH_PAGES) {
        const endPage = Math.min(pageLimit, startPage + DTM_VISION_BATCH_PAGES - 1)
        const imageMessages: any[] = []
        for (let pageNumber = startPage; pageNumber <= endPage; pageNumber++) {
            const page = await pdfDoc.getPage(pageNumber)
            const viewport = page.getViewport({ scale: 1.5 })
            const canvas = createCanvas(viewport.width, viewport.height)
            const ctx = canvas.getContext('2d')
            await page.render({ canvasContext: ctx as any, viewport }).promise
            const base64 = canvas.toBuffer('image/png').toString('base64')
            imageMessages.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } })
        }
        if (imageMessages.length === 0) continue

        try {
            const aiContent = await generateQuestionJson([{
                role: 'user',
                content: [
                    ...imageMessages,
                    { type: 'text', text: buildDtmImportPrompt({ subject, subject2, lastBlock, pageLabel: `${startPage}-${endPage} sahifalari` }) }
                ]
            }], true)
            const { questions, answerKeys } = collectDtmGeneratedItems(parseQuestionJson(aiContent))
            allQuestions = dedupeGeneratedQuestions([...allQuestions, ...questions])
            allAnswerKeys.push(...answerKeys)
            const lastTagged = [...questions].reverse().find(q => q.blockType)
            if (lastTagged) lastBlock = lastTagged.blockType
        } catch (batchErr: any) {
            console.warn(`DTM PDF pages ${startPage}-${endPage} generation failed:`, batchErr?.message || batchErr)
        }
    }

    const keyApplied = applyDtmAnswerKeys(allQuestions, allAnswerKeys)
    return { questions: allQuestions.slice(0, DTM_MAX_QUESTIONS), truncated, keyApplied }
}

async function generateQuestionJson(messages: any[], isVision = false): Promise<string> {
    const client = isVision ? gptClient : aiClient
    const model = isVision ? VISION_MODEL : aiModel

    const completion = await client.chat.completions.create({
        model,
        messages: [
            { role: 'system', content: buildQuestionGeneratorSystemPrompt() },
            ...messages
        ],
        max_tokens: QUESTION_GENERATION_MAX_OUTPUT_TOKENS,
        temperature: 0.1,
    }, { timeout: 180000 })

    return completion.choices[0]?.message?.content || '[]'
}

function parseQuestionJson(aiContent: string): any[] {
    let jsonStr = aiContent
    const codeBlockMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    if (codeBlockMatch?.[1]) {
        jsonStr = codeBlockMatch[1]
    } else {
        const arrayMatch = aiContent.match(/\[\s*\{[\s\S]*\}\s*\]/)
        if (arrayMatch) {
            jsonStr = arrayMatch[0]
        }
    }

    try {
        return JSON.parse(jsonStr)
    } catch {
        const repairedJson = repairAiJson(jsonStr)
        try {
            return JSON.parse(repairedJson)
        } catch (e: any) {
            const lastBrace = repairedJson.lastIndexOf('},{')
            if (lastBrace > 0) {
                const truncated = repairedJson.substring(0, lastBrace + 1) + ']'
                return JSON.parse(truncated)
            }
            throw e
        }
    }
}

function validateGeneratedQuestions(questions: any[]): any[] {
    const letterToIdx = (s: string) => ['a', 'b', 'c', 'd'].indexOf(s.trim().toLowerCase())

    return questions
        .filter((q: any) => q && q.text)
        .map((q: any) => {
            if (q.questionType === 'matching') {
                const answers: string[] = Array.isArray(q.answers)
                    ? q.answers.filter((a: any) => typeof a === 'string' && a.trim()).slice(0, 6)
                    : []
                const subQuestions = Array.isArray(q.subQuestions)
                    ? q.subQuestions
                        .filter((sq: any) => sq && typeof sq.text === 'string' && sq.text.trim())
                        .map((sq: any) => ({
                            text: sq.text.trim(),
                            correctIdx: typeof sq.correctIdx === 'number'
                                ? Math.max(0, Math.min(sq.correctIdx, answers.length - 1))
                                : 0
                        }))
                    : []
                if (answers.length < 2 || subQuestions.length < 1) return null
                return { text: q.text.trim(), questionType: 'matching', answers, subQuestions }
            }

            if (!q.options || !Array.isArray(q.options)) return null
            const options = q.options.filter((o: any) => typeof o === 'string' && o.trim().length > 0)
            if (options.length < 2) return null

            let correctIdx = 0
            if (typeof q.correctIdx === 'number') {
                correctIdx = q.correctIdx
            } else if (typeof q.correctIdx === 'string') {
                const i = letterToIdx(q.correctIdx)
                correctIdx = i >= 0 ? i : 0
            } else {
                const raw = q.correct ?? q.correctAnswer ?? q.answer ?? q.correct_answer ?? null
                if (typeof raw === 'number') correctIdx = raw
                else if (typeof raw === 'string') {
                    const i = letterToIdx(raw)
                    correctIdx = i >= 0 ? i : 0
                }
            }

            if (correctIdx < 0 || correctIdx >= options.length) correctIdx = 0
            return { text: q.text.trim(), options: options.slice(0, 4), correctIdx }
        })
        .filter(Boolean)
}

function dedupeGeneratedQuestions(questions: any[]): any[] {
    const seen = new Set<string>()
    return questions.filter((question) => {
        const key = String(question.text || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim()
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
    })
}

// O'qituvchining testlari
router.get('/my-tests', authenticate, requireRole('TEACHER', 'ADMIN'), async (req: AuthRequest, res) => {
    try {
        const tests = await prisma.test.findMany({
            where: { creatorId: req.user.id },
            include: { _count: { select: { questions: true, attempts: true } } },
            orderBy: { createdAt: 'desc' }
        })
        const avgScores = tests.length > 0
            ? await prisma.testAttempt.groupBy({
                by: ['testId'],
                where: { testId: { in: tests.map((test) => test.id) } },
                _avg: { score: true },
            })
            : []

        const avgScoreMap = new Map(avgScores.map((row) => [row.testId, roundScore(row._avg.score || 0)]))
        res.json(tests.map((test) => ({
            ...test,
            avgScore: avgScoreMap.get(test.id) ?? 0
        })))
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
        const subjectVariants = getSubjectVariants(subject)
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
        if (subjectVariants) where.subject = { in: subjectVariants }

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
            include: { test: { select: { title: true, subject: true, subject2: true, testType: true } } },
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
        // XAVFSIZLIK: faqat admin tasdiqlagan (approved) public testlar ko'rinadi.
        // Tasdiqlanmagan (TEACHER yaratgan, kutilayotgan) testlar bu yerda chiqmaydi.
        const tests = await prisma.test.findMany({
            where: { isPublic: true, approved: true },
            include: {
                _count: { select: { questions: true, attempts: true } },
                creator: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        })
        // Kategoriya: tanlangan fan yoki nom-pattern bo'yicha (frontend chiplari uchun)
        res.json(tests.map(t => ({ ...t, category: categoryForTest(t) })))
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

router.get('/:testId', authenticate, requireRole('TEACHER', 'ADMIN'), async (req: AuthRequest, res) => {
    try {
        const where = req.user.role === 'ADMIN'
            ? { id: req.params.testId as string }
            : { id: req.params.testId as string, creatorId: req.user.id }

        const test = await prisma.test.findFirst({
            where,
            include: {
                questions: { orderBy: { orderIdx: 'asc' } },
                _count: { select: { attempts: true } }
            }
        })

        if (!test) {
            return res.status(404).json({ error: 'Test topilmadi yoki ruxsat yo\'q' })
        }

        const normalizedTestType = normalizeTestType(test.testType)

        // 3.6: tahrirlash preview'i uchun rasm ref'lari signed URL bilan BIRGA qaytadi —
        // imageUrl (xom ref) saqlash uchun qoladi, *PreviewUrl esa <img> ko'rsatish uchun.
        const detailQuestions = await Promise.all(test.questions.map(async (question) => {
                const parsedOptions = parseStoredQuestionOptions(question.questionType, question.options)
                const optionImageRefs = parseStoredOptionImages(question.optionImages)
                return {
                    id: question.id,
                    text: question.text,
                    imageUrl: question.imageUrl,
                    imagePreviewUrl: await resolveStoredS3Url(question.imageUrl),
                    optionImages: optionImageRefs.length > 0 ? optionImageRefs : undefined,
                    optionImagePreviews: (await resolveStoredOptionImages(question.optionImages)) || undefined,
                    solutionImageUrl: question.solutionImageUrl,
                    solutionImagePreviewUrl: await resolveStoredS3Url(question.solutionImageUrl),
                    questionType: question.questionType,
                    correctIdx: question.correctIdx,
                    correctText: question.correctText,
                    options: Array.isArray(parsedOptions) ? parsedOptions : [],
                    matchingAnswers: !Array.isArray(parsedOptions) && 'answers' in parsedOptions ? parsedOptions.answers : ['', '', '', '', '', ''],
                    matchingSubQuestions: !Array.isArray(parsedOptions) && 'answers' in parsedOptions ? parsedOptions.subQuestions : [{ text: '', correctIdx: 0 }],
                    multipartSubQuestions: !Array.isArray(parsedOptions) && 'subQuestions' in parsedOptions && !('answers' in parsedOptions) ? parsedOptions.subQuestions : [],
                    blockType: normalizeDtmBlockType(question.blockType),
                    coefficient: typeof question.coefficient === 'number'
                        ? roundScore(question.coefficient)
                        : (normalizedTestType === 'DTM_BLOCK'
                            ? getDefaultDtmCoefficient(normalizeDtmBlockType(question.blockType), test.subject)
                            : null)
                }
            }))

        res.json({
            id: test.id,
            title: test.title,
            description: test.description,
            subject: test.subject,
            subject2: test.subject2,
            isPublic: test.isPublic,
            timeLimit: test.timeLimit,
            testType: normalizedTestType,
            source: test.source,
            premium: test.premium,
            attemptsCount: test._count.attempts,
            questions: detailQuestions
        })
    } catch (e) {
        console.error(e)
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
                questions: { orderBy: { orderIdx: 'asc' }, select: { id: true, text: true, imageUrl: true, options: true, optionImages: true, orderIdx: true, questionType: true } },
                creator: { select: { name: true } }
            }
        })
        if (!test) return res.status(404).json({ error: 'Test topilmadi' })

        // MODERATSIYA: tasdiqlanmagan (approved=false) public testlar link orqali ham
        // tarqalmasligi kerak. Faqat test egasi yoki admin tasdiqlanmagan testni
        // link orqali ko'ra oladi (preview uchun). Private testlar (isPublic=false)
        // link bilan ulashiladi va approved=true bo'ladi — ular bu cheklovga tushmaydi.
        if (test.isPublic && !test.approved) {
            const viewerId = req.user?.id
            const viewerRole = req.user?.role
            const isOwnerOrAdmin = viewerRole === 'ADMIN' || (viewerId && viewerId === test.creatorId)
            if (!isOwnerOrAdmin) {
                return res.status(403).json({ error: 'Bu test hali admin tomonidan tasdiqlanmagan' })
            }
        }

        // PREMIUM: premium testlar faqat Pro userlarga. Beta'da PRO_ENFORCED=false → getEntitlement
        // hammага isPro:true qaytaradi (hamma ochiq); to'lov yoqilganda avtomatik gate bo'ladi.
        if (test.premium) {
            const ent = req.user ? await getEntitlement(req.user.id) : { isPro: false }
            if (!ent.isPro) {
                return res.status(403).json({ error: 'Bu — Premium test. Pro obuna talab qilinadi.', code: 'PRO_REQUIRED' })
            }
        }

        // Matching savollar uchun to'g'ri javoblarni (correctIdx) options dan olib tashlaymiz —
        // aks holda o'quvchi devtools orqali barcha javoblarni ko'ra oladi
        const sanitizedQuestions = await Promise.all(test.questions.map(async (q: any) => {
            const resolvedImageUrl = await resolveStoredS3Url(q.imageUrl)
            // FAZA 3: variant rasmlari — o'quvchiga signed URL massivi ketadi (xom ref emas)
            const resolvedOptionImages = await resolveStoredOptionImages(q.optionImages)
            const { optionImages: _rawOptionImages, ...qRest } = q
            const base = { ...qRest, imageUrl: resolvedImageUrl, ...(resolvedOptionImages ? { optionImages: resolvedOptionImages } : {}) }
            if (q.questionType === 'matching' && q.options) {
                try {
                    const parsed = JSON.parse(q.options as string)
                    const sanitized = {
                        answers: parsed.answers || [],
                        subQuestions: (parsed.subQuestions || []).map((sq: any) => ({ text: sq.text }))
                    }
                    return { ...base, options: JSON.stringify(sanitized) }
                } catch { return base }
            }
            if (q.questionType === 'multipart_open' && q.options) {
                try {
                    const parsed = JSON.parse(q.options as string)
                    const sanitized = {
                        subQuestions: (parsed.subQuestions || []).map((subQuestion: any, subIndex: number) => ({
                            label: String(subQuestion.label || String.fromCharCode(65 + subIndex)),
                            text: subQuestion.text
                        }))
                    }
                    return { ...base, options: JSON.stringify(sanitized) }
                } catch { return base }
            }
            return base
        }))
        let timeWindow: {
            serverStartedAt?: string
            serverExpiresAt?: string
            serverNow?: string
            timeRemainingSeconds?: number
        } = {}
        if (req.user && getTimeLimitMs(test.timeLimit)) {
            const session = await ensureTestSession(test.id, req.user.id, test.timeLimit as number, shareLink)
            const now = new Date()
            timeWindow = {
                serverStartedAt: session.startedAt.toISOString(),
                serverExpiresAt: session.expiresAt.toISOString(),
                serverNow: now.toISOString(),
                timeRemainingSeconds: getTimeRemainingSeconds(session.expiresAt, now)
            }
        }

        // Ichki maydonlarni (foydalanuvchi UUID'lari — creatorId/approvedById) test-yechuvchiga
        // oshkor qilmaymiz. Qolgan meta (title/subject/testType/timeLimit/creator.name) qoladi —
        // frontend shularга tayanadi, shuning uchun faqat aniq maxfiy maydonlar olib tashlanadi.
        const { creatorId: _creatorId, approvedById: _approvedById, approvedAt: _approvedAt, ...safeTest } = test
        res.json({ ...safeTest, questions: sanitizedQuestions, ...timeWindow })
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

        // TO'LIQ DTM BLOK REJIMI: bitta kitobcha PDF → 90 savol blockType teglari bilan.
        // Har doim vision yo'li (matnli PDF ham render qilinadi — blok sarlavhalari va
        // javoblar jadvali sahifada KO'RINGANIDAY o'qiladi, matn oqimida adashmaydi).
        if (req.body.dtmBlock === '1') {
            if (mimetype !== 'application/pdf') {
                return res.status(400).json({ error: 'To\'liq DTM import faqat PDF qabul qiladi' })
            }
            if (!process.env.GEMINI_API_KEY) {
                return res.status(400).json({ error: 'DTM PDF tahlili uchun vision AI kaliti sozlanmagan' })
            }
            const dtmSubject = subject || 'Ixtisoslik fani'
            const dtmSubject2 = (req.body.subject2 as string) || '2-ixtisoslik fani'
            const dtmResult = await generateDtmQuestionsFromPdf(buffer, dtmSubject, dtmSubject2)
            return res.json({
                questions: dtmResult.questions,
                truncated: dtmResult.truncated,
                keyApplied: dtmResult.keyApplied, // javoblar jadvalidan olingan javoblar soni
            })
        }
        // MCQ va Moslashtirish (matching) format namunasi
        const jsonFormat = `[
  {"text":"MCQ savol matni?","options":["A variant","B variant","C variant","D variant"],"correctIdx":0},
  {"text":"Juftlash/Moslashtirish savoli matni","questionType":"matching","answers":["Paris","London","Berlin","Tokio","Madrid","Rim"],"subQuestions":[{"text":"Fransiya","correctIdx":0},{"text":"Angliya","correctIdx":1},{"text":"Germaniya","correctIdx":2}]}
]`
        const subjectNote = subject ? ` Fan: ${subject}.` : ''

        let messages: any[] = []
        let truncated = false
        let rawQuestions: any[] = []

        if (mimetype === 'application/pdf') {
            const data = await pdfParse(buffer)
            const fullText = data.text.trim()
            const needsVisionPdf = !fullText || fullText.length < 50

            if (needsVisionPdf) {
                if (!process.env.GEMINI_API_KEY) {
                    return res.status(400).json({ error: 'Skanerlangan PDF tahlili uchun OpenAI API kalit kerak. Iltimos, OCR qilingan PDF yoki Word fayl yuklang.' })
                }

                try {
                    const scannedResult = await generateQuestionsFromScannedPdf(buffer, subjectNote, jsonFormat)
                    rawQuestions = scannedResult.questions
                    truncated = scannedResult.truncated
                } catch (err) {
                    console.error('PDF render failed:', err)
                }
            } else {
                if (!fullText) {
                    return res.status(400).json({ error: 'PDF fayldan matn o\'qib bo\'lmadi. Iltimos, PDF ni PNG/JPG rasmga aylantiring va yuklang, yoki Word (.docx) fayl yuklang.' })
                }

                const textChunks = chunkTextForQuestionGeneration(fullText)
                truncated = textChunks.truncated

                for (const [chunkIndex, textChunk] of textChunks.chunks.entries()) {
                    const remainingSlots = QUESTION_GENERATION_MAX_TOTAL - rawQuestions.length
                    if (remainingSlots <= 0) break

                    const userMsg = buildTextQuestionPrompt({
                        text: textChunk,
                        subjectNote,
                        jsonFormat,
                        chunkIndex,
                        chunkTotal: textChunks.chunks.length,
                        truncated,
                        maxQuestions: Math.min(QUESTION_GENERATION_MAX_PER_CHUNK, remainingSlots)
                    })

                    try {
                        const aiContent = await generateQuestionJson([{ role: 'user', content: userMsg }])
                        const parsed = parseQuestionJson(aiContent)
                        const validated = validateGeneratedQuestions(parsed)
                        rawQuestions = dedupeGeneratedQuestions([...rawQuestions, ...validated]).slice(0, QUESTION_GENERATION_MAX_TOTAL)
                    } catch (chunkErr: any) {
                        console.warn(`PDF chunk ${chunkIndex + 1} generation failed:`, chunkErr?.message || chunkErr)
                    }
                }
            }

        } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimetype === 'application/msword') {
            const result = await mammoth.extractRawText({ buffer })
            const fullText = result.value.trim()
            if (!fullText) return res.status(400).json({ error: 'Word fayli bo\'sh' })

            const textChunks = chunkTextForQuestionGeneration(fullText)
            truncated = textChunks.truncated

            for (const [chunkIndex, textChunk] of textChunks.chunks.entries()) {
                const remainingSlots = QUESTION_GENERATION_MAX_TOTAL - rawQuestions.length
                if (remainingSlots <= 0) break

                const userMsg = buildTextQuestionPrompt({
                    text: textChunk,
                    subjectNote,
                    jsonFormat,
                    chunkIndex,
                    chunkTotal: textChunks.chunks.length,
                    truncated,
                    maxQuestions: Math.min(QUESTION_GENERATION_MAX_PER_CHUNK, remainingSlots)
                })

                try {
                    const aiContent = await generateQuestionJson([{ role: 'user', content: userMsg }])
                    const parsed = parseQuestionJson(aiContent)
                    const validated = validateGeneratedQuestions(parsed)
                    rawQuestions = dedupeGeneratedQuestions([...rawQuestions, ...validated]).slice(0, QUESTION_GENERATION_MAX_TOTAL)
                } catch (chunkErr: any) {
                    console.warn(`Word chunk ${chunkIndex + 1} generation failed:`, chunkErr?.message || chunkErr)
                }
            }
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
- MCQ savol: {"text":"...","options":["A","B","C","D"],"correctIdx":0}
- Moslashtirish savol: {"text":"...","questionType":"matching","answers":[...],"subQuestions":[{"text":"...","correctIdx":0}]}
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
        if (isVision && !process.env.GEMINI_API_KEY) {
            return res.status(400).json({ error: 'Rasm/screenshot tahlili uchun OpenAI API kalit kerak. Iltimos, matnli PDF yoki Word fayl yuklang.' })
        }
        if (messages.length > 0) {
            try {
                const aiContent = await generateQuestionJson(messages, isVision)
                rawQuestions = parseQuestionJson(aiContent)
            } catch (e: any) {
                console.error('AI JSON parse error:', e.message)
                return res.status(500).json({ error: 'AI noto\'g\'ri format qaytardi. Qayta urinib ko\'ring.' })
            }
        }

        if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
            return res.status(500).json({ error: 'AI hech qanday savol topa olmadi yoki tushunmadi. Boshqa fayl yuklang.' })
        }

        const validatedQuestions = dedupeGeneratedQuestions(validateGeneratedQuestions(rawQuestions))

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

        const { text, imageUrl, options, correctIdx, orderIdx, difficulty, questionType } = req.body
        const normalizedTestType = normalizeTestType(test.testType)

        // Savol matni validatsiyasi
        if (!text || typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ error: 'Savol matni majburiy' })
        }
        if (normalizedTestType === 'DTM_BLOCK' && questionType !== 'mcq') {
            return res.status(400).json({ error: 'DTM blok testida faqat A/B/C/D savollar bo\'lishi kerak' })
        }
        if (text.trim().length > 2000) {
            return res.status(400).json({ error: 'Savol matni 2000 belgidan oshmasligi kerak' })
        }

        // Validatsiya — questionType ga qarab
        if (questionType === 'matching') {
            let matchData: any = {}
            try { matchData = typeof options === 'string' ? JSON.parse(options) : options } catch {
                return res.status(400).json({ error: 'Matching options formati xato' })
            }
            const mAnswers = (matchData.answers || []).filter((a: any) => typeof a === 'string' && a.trim())
            const mSubs = matchData.subQuestions || []
            if (mAnswers.length < 2) return res.status(400).json({ error: 'Kamida 2 ta javob varianti bo\'lishi kerak' })
            if (mSubs.length < 1) return res.status(400).json({ error: 'Kamida 1 ta kichik savol bo\'lishi kerak' })
        } else if (questionType === 'multipart_open') {
            let multipartData: any = {}
            try { multipartData = typeof options === 'string' ? JSON.parse(options) : options } catch {
                return res.status(400).json({ error: 'Multi-part format xato' })
            }
            const subQuestions = multipartData.subQuestions || []
            if (subQuestions.length < 2) return res.status(400).json({ error: 'Kamida 2 ta bo\'lim bo\'lishi kerak' })
            for (const subQuestion of subQuestions) {
                if (typeof subQuestion?.text !== 'string' || !subQuestion.text.trim()) {
                    return res.status(400).json({ error: 'Har bir bo\'lim savol matni bilan bo\'lishi kerak' })
                }
                if (typeof subQuestion?.correctText !== 'string' || !subQuestion.correctText.trim()) {
                    return res.status(400).json({ error: 'Har bir bo\'lim uchun to\'g\'ri javob kerak' })
                }
            }
        } else if (questionType !== 'open') {
            if (!Array.isArray(options) || options.length < 2) {
                return res.status(400).json({ error: 'Kamida 2 ta variant bo\'lishi kerak' })
            }
            if (typeof correctIdx !== 'number' || correctIdx < 0 || correctIdx >= options.length) {
                return res.status(400).json({ error: 'To\'g\'ri javob indeksi xato' })
            }
        }

        if (normalizedTestType === 'DTM_BLOCK' && questionType !== 'mcq') {
            return res.status(400).json({ error: 'DTM blok testida faqat A/B/C/D savollar bo\'lishi kerak' })
        }

        const parsedBlockType = normalizeDtmBlockType(req.body.blockType)
        const parsedCoefficient = parseQuestionCoefficient(req.body.coefficient)

        const q = await prisma.testQuestion.create({
            data: {
                testId: test.id,
                text,
                imageUrl: imageUrl || null,
                questionType: questionType || 'mcq',
                options: questionType === 'open' ? '[]'
                       : questionType === 'multipart_open' ? (typeof options === 'string' ? options : JSON.stringify(options))
                       : questionType === 'matching' ? (typeof options === 'string' ? options : JSON.stringify(options))
                       : JSON.stringify(options),
                // FAZA 3: variant/yechim rasmlari
                optionImages: (questionType === 'open' || questionType === 'matching' || questionType === 'multipart_open')
                    ? null
                    : sanitizeIncomingOptionImages(req.body.optionImages, Array.isArray(options) ? options.length : 0),
                solutionImageUrl: sanitizeIncomingImageRef(req.body.solutionImageUrl),
                correctIdx: (questionType === 'open' || questionType === 'matching' || questionType === 'multipart_open') ? -1 : (correctIdx ?? 0),
                orderIdx: orderIdx || 0,
                difficulty: difficulty || 0.0,
                blockType: parsedBlockType,
                coefficient: normalizedTestType === 'DTM_BLOCK'
                    ? (parsedCoefficient ?? getDefaultDtmCoefficient(parsedBlockType, test.subject))
                    : null
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
        const { title, description, subject, subject2, isPublic, questions, timeLimit, testType } = req.body
        const normalizedSubject = normalizeSubject(subject)
        const normalizedSubject2 = normalizeSubject(subject2)
        const normalizedTestType = normalizeTestType(typeof testType === 'string' ? testType : undefined)
        if (!title || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: 'Test nomi va savollar kerak' })
        }

        if (normalizedTestType === 'DTM_BLOCK') {
            // Savollar HAR DOIM rasmiy blok tartibida saqlanadi — validatsiya xato indekslari ham shu tartibda
            sortDtmQuestionsInPlace(questions)
            const structureError = validateDtmBlockStructure(questions as IncomingCreateQuestion[], normalizedSubject2)
            if (structureError) {
                return res.status(400).json({ error: structureError })
            }
        }

        // Har bir savol validatsiyasi
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i] as IncomingCreateQuestion
            const questionType = q.questionType || 'mcq'
            const hasText = q.text && typeof q.text === 'string' && q.text.trim().length > 0
            const hasImage = q.imageUrl && typeof q.imageUrl === 'string' && q.imageUrl.trim().length > 0
            if (!hasText && !hasImage) {
                return res.status(400).json({ error: `${i + 1}-savol: savol matni yoki rasmi bo'lishi shart` })
            }
            if (normalizedTestType === 'DTM_BLOCK' && questionType !== 'mcq') {
                return res.status(400).json({ error: `${i + 1}-savol: DTM blok testida faqat A/B/C/D savollar bo'lishi kerak` })
            }
            if (questionType === 'matching') {
                // Moslashtirish savol validatsiyasi
                let matchData: any = {}
                try { matchData = typeof q.options === 'string' ? JSON.parse(q.options) : q.options } catch {
                    return res.status(400).json({ error: `${i + 1}-savol: matching options formati xato` })
                }
                const mAnswers = (matchData.answers || []).filter((a: any) => typeof a === 'string' && a.trim())
                const mSubs = matchData.subQuestions || []
                if (mAnswers.length < 2) return res.status(400).json({ error: `${i + 1}-savol: kamida 2 ta javob varianti bo'lishi kerak` })
                if (mSubs.length < 1) return res.status(400).json({ error: `${i + 1}-savol: kamida 1 ta kichik savol bo'lishi kerak` })
            } else if (questionType === 'multipart_open') {
                let multipartData: any = {}
                try { multipartData = typeof q.options === 'string' ? JSON.parse(q.options) : q.options } catch {
                    return res.status(400).json({ error: `${i + 1}-savol: multi-part formati xato` })
                }
                const subQuestions = multipartData.subQuestions || []
                if (subQuestions.length < 2) {
                    return res.status(400).json({ error: `${i + 1}-savol: kamida 2 ta bo'lim bo'lishi kerak` })
                }
                for (let si = 0; si < subQuestions.length; si++) {
                    const subQuestion = subQuestions[si]
                    const subQuestionText = typeof subQuestion?.text === 'string' ? subQuestion.text.trim() : ''
                    if (!subQuestionText) {
                        return res.status(400).json({ error: `${i + 1}-savol: ${si + 1}-bo'lim matni bo'sh` })
                    }
                    const subQuestionCorrectText = typeof subQuestion?.correctText === 'string' ? subQuestion.correctText.trim() : ''
                    if (!subQuestionCorrectText) {
                        return res.status(400).json({ error: `${i + 1}-savol: ${si + 1}-bo'lim uchun to'g'ri javob yo'q` })
                    }
                }
            } else if (questionType !== 'open') {
                // MCQ validatsiyasi
                let opts: any[]
                try {
                    opts = Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]')
                } catch {
                    return res.status(400).json({ error: `${i + 1}-savol: options to'g'ri format emas` })
                }
                if (!Array.isArray(opts) || opts.length < 2) {
                    return res.status(400).json({ error: `${i + 1}-savol: kamida 2 ta variant bo'lishi kerak` })
                }
                // Variant rasmi bo'lsa matn bo'sh bo'lishi mumkin (rasm-only variantlar)
                const optionImageRefs = parseStoredOptionImages(sanitizeIncomingOptionImages(q.optionImages, opts.length))
                for (let j = 0; j < opts.length; j++) {
                    if (typeof opts[j] !== 'string' || (!opts[j].trim() && !optionImageRefs[j])) {
                        return res.status(400).json({ error: `${i + 1}-savol: ${String.fromCharCode(65 + j)} variantda matn yoki rasm bo'lishi kerak` })
                    }
                }
                const idx = q.correctIdx ?? 0
                if (typeof idx !== 'number' || idx < 0 || idx >= opts.length) {
                    return res.status(400).json({ error: `${i + 1}-savol: correctIdx 0 dan ${opts.length - 1} gacha bo'lishi kerak` })
                }
            }

            if (normalizedTestType === 'DTM_BLOCK') {
                const blockType = normalizeDtmBlockType(typeof q.blockType === 'string' ? q.blockType : undefined)
                if (blockType === 'SPECIALTY_2' && !normalizedSubject2) {
                    return res.status(400).json({ error: `${i + 1}-savol: 2-ixtisoslik bloki uchun 2-fan tanlanishi kerak` })
                }
                const coefficient = parseQuestionCoefficient(q.coefficient) ?? getDefaultDtmCoefficient(blockType, normalizedSubject)
                if (!Number.isFinite(coefficient) || coefficient <= 0) {
                    return res.status(400).json({ error: `${i + 1}-savol: koeffitsient xato` })
                }
            }
        }
        // Moderatsiya: ADMIN yaratgan public test darrov tasdiqlanadi,
        // TEACHER (yoki kelajakdagi STUDENT) yaratganlari admin tasdig'ini kutadi.
        // Private (isPublic=false) testlar uchun approved muhim emas — ular ro'yxatda chiqmaydi.
        const isAdminCreator = req.user.role === 'ADMIN'
        const wantsPublic = Boolean(isPublic)
        const approvedOnCreate = isAdminCreator ? true : !wantsPublic

        // Manba tegi: faqat ADMIN OFFICIAL/AI_PREDICTION qo'ya oladi; boshqalar → UNOFFICIAL (halollik).
        const reqSource = String(req.body.source || 'UNOFFICIAL')
        const resolvedSource: 'OFFICIAL' | 'UNOFFICIAL' | 'AI_PREDICTION' =
            (isAdminCreator && (reqSource === 'OFFICIAL' || reqSource === 'AI_PREDICTION' || reqSource === 'UNOFFICIAL'))
                ? reqSource
                : 'UNOFFICIAL'

        const test = await prisma.test.create({
            data: {
                title,
                description: description || null,
                subject: normalizedSubject,
                subject2: normalizedSubject2,
                isPublic: isPublic || false,
                approved: approvedOnCreate,
                approvedAt: approvedOnCreate && wantsPublic ? new Date() : null,
                approvedById: approvedOnCreate && wantsPublic && isAdminCreator ? req.user.id : null,
                source: resolvedSource,
                premium: isAdminCreator && Boolean(req.body.premium), // premium faqat ADMIN joylaydi
                testType: normalizedTestType,
                timeLimit: timeLimit || null,
                creatorId: req.user.id,
                questions: {
                    create: questions.map((q: IncomingCreateQuestion, i: number) => {
                        const questionType = q.questionType || 'mcq'
                        const blockType = normalizeDtmBlockType(typeof q.blockType === 'string' ? q.blockType : undefined)
                        const coefficient = normalizedTestType === 'DTM_BLOCK'
                            ? (parseQuestionCoefficient(q.coefficient) ?? getDefaultDtmCoefficient(blockType, normalizedSubject))
                            : null

                        return ({
                        text: q.text || '',
                        imageUrl: q.imageUrl || null,
                        // matching: options allaqachon JSON string (frontend JSON.stringify qilgan)
                        // mcq: options array → JSON.stringify kerak
                        // open: bo'sh array
                        options: questionType === 'open' ? '[]'
                               : questionType === 'multipart_open' ? (typeof q.options === 'string' ? q.options : JSON.stringify(q.options))
                               : questionType === 'matching' ? (typeof q.options === 'string' ? q.options : JSON.stringify(q.options))
                               : JSON.stringify(q.options),
                        // FAZA 3: variant rasmlari faqat MCQ'da; yechim rasmi hamma turda mumkin
                        optionImages: (questionType === 'open' || questionType === 'matching' || questionType === 'multipart_open')
                            ? null
                            : sanitizeIncomingOptionImages(q.optionImages, Array.isArray(q.options) ? q.options.length : 0),
                        solutionImageUrl: sanitizeIncomingImageRef(q.solutionImageUrl),
                        correctIdx: (questionType === 'open' || questionType === 'matching' || questionType === 'multipart_open') ? -1 : (q.correctIdx ?? 0),
                        correctText: questionType === 'open' ? (q.correctText?.trim() || null) : null,
                        questionType,
                        difficulty: q.difficulty || 0.0,
                        orderIdx: i,
                        blockType,
                        coefficient
                    })
                    })
                }
            },
            include: { questions: true }
        })

        // Bildirishnoma FAQAT test public VA tasdiqlangan bo'lsa yuboriladi
        // (ya'ni ADMIN yaratgan public test). TEACHER public testi tasdiqlanmaguncha
        // studentlar ko'ra olmaydi — shuning uchun bildirishnoma ham yubormaymiz
        // (u admin approve qilganda yuboriladi).
        if (wantsPublic && approvedOnCreate) {
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
                            message: `"${title}" nomli yangi ${normalizedSubject || ''} testi qo'shildi. Hoziroq yechib ko'ring!`,
                            targetType: 'test',
                            targetId: test.id
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

router.patch('/:testId', authenticate, requireRole('TEACHER', 'ADMIN'), testMutateLimiter, async (req: AuthRequest, res) => {
    try {
        const { title, description, subject, subject2, isPublic, questions, timeLimit, testType } = req.body
        const where = req.user.role === 'ADMIN'
            ? { id: req.params.testId as string }
            : { id: req.params.testId as string, creatorId: req.user.id }

        const existing = await prisma.test.findFirst({
            where,
            include: { _count: { select: { attempts: true } } }
        })

        if (!existing) {
            return res.status(404).json({ error: 'Test topilmadi yoki ruxsat yo\'q' })
        }

        if (existing._count.attempts > 0) {
            return res.status(409).json({ error: 'Bu testni tahrirlab bo\'lmaydi. Unda allaqachon urinishlar bor, nusxa yaratib ishlang.' })
        }

        const normalizedSubject = normalizeSubject(subject)
        const normalizedSubject2 = normalizeSubject(subject2)
        const normalizedTestType = normalizeTestType(typeof testType === 'string' ? testType : undefined)
        if (!title || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: 'Test nomi va savollar kerak' })
        }

        if (normalizedTestType === 'DTM_BLOCK') {
            // Savollar HAR DOIM rasmiy blok tartibida saqlanadi — validatsiya xato indekslari ham shu tartibda
            sortDtmQuestionsInPlace(questions)
            const structureError = validateDtmBlockStructure(questions as IncomingCreateQuestion[], normalizedSubject2)
            if (structureError) {
                return res.status(400).json({ error: structureError })
            }
        }

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i] as IncomingCreateQuestion
            const questionType = q.questionType || 'mcq'
            const hasText = q.text && typeof q.text === 'string' && q.text.trim().length > 0
            const hasImage = q.imageUrl && typeof q.imageUrl === 'string' && q.imageUrl.trim().length > 0
            if (!hasText && !hasImage) {
                return res.status(400).json({ error: `${i + 1}-savol: savol matni yoki rasmi bo'lishi shart` })
            }
            if (normalizedTestType === 'DTM_BLOCK' && questionType !== 'mcq') {
                return res.status(400).json({ error: `${i + 1}-savol: DTM blok testida faqat A/B/C/D savollar bo'lishi kerak` })
            }
            if (questionType === 'matching') {
                let matchData: { answers?: string[]; subQuestions?: Array<{ text?: string; correctIdx?: number }> } = {}
                try { matchData = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options as typeof matchData) } catch {
                    return res.status(400).json({ error: `${i + 1}-savol: matching options formati xato` })
                }
                const matchingAnswers = (matchData.answers || []).filter((answer) => typeof answer === 'string' && answer.trim())
                const matchingSubQuestions = matchData.subQuestions || []
                if (matchingAnswers.length < 2) return res.status(400).json({ error: `${i + 1}-savol: kamida 2 ta javob varianti bo'lishi kerak` })
                if (matchingSubQuestions.length < 1) return res.status(400).json({ error: `${i + 1}-savol: kamida 1 ta kichik savol bo'lishi kerak` })
            } else if (questionType === 'multipart_open') {
                let multipartData: { subQuestions?: Array<{ text?: string; correctText?: string }> } = {}
                try { multipartData = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options as typeof multipartData) } catch {
                    return res.status(400).json({ error: `${i + 1}-savol: multi-part formati xato` })
                }
                const subQuestions = multipartData.subQuestions || []
                if (subQuestions.length < 2) {
                    return res.status(400).json({ error: `${i + 1}-savol: kamida 2 ta bo'lim bo'lishi kerak` })
                }
                for (let si = 0; si < subQuestions.length; si++) {
                    const subQuestion = subQuestions[si]
                    const subQuestionText = typeof subQuestion?.text === 'string' ? subQuestion.text.trim() : ''
                    if (!subQuestionText) {
                        return res.status(400).json({ error: `${i + 1}-savol: ${si + 1}-bo'lim matni bo'sh` })
                    }
                    const subQuestionCorrectText = typeof subQuestion?.correctText === 'string' ? subQuestion.correctText.trim() : ''
                    if (!subQuestionCorrectText) {
                        return res.status(400).json({ error: `${i + 1}-savol: ${si + 1}-bo'lim uchun to'g'ri javob yo'q` })
                    }
                }
            } else if (questionType !== 'open') {
                let options: string[]
                try {
                    options = Array.isArray(q.options) ? q.options.map((option) => String(option || '')) : JSON.parse(q.options || '[]')
                } catch {
                    return res.status(400).json({ error: `${i + 1}-savol: options to'g'ri format emas` })
                }
                if (!Array.isArray(options) || options.length < 2) {
                    return res.status(400).json({ error: `${i + 1}-savol: kamida 2 ta variant bo'lishi kerak` })
                }
                // Variant rasmi bo'lsa matn bo'sh bo'lishi mumkin (rasm-only variantlar)
                const optionImageRefs = parseStoredOptionImages(sanitizeIncomingOptionImages(q.optionImages, options.length))
                for (let j = 0; j < options.length; j++) {
                    if (typeof options[j] !== 'string' || (!options[j].trim() && !optionImageRefs[j])) {
                        return res.status(400).json({ error: `${i + 1}-savol: ${String.fromCharCode(65 + j)} variantda matn yoki rasm bo'lishi kerak` })
                    }
                }
                const idx = q.correctIdx ?? 0
                if (typeof idx !== 'number' || idx < 0 || idx >= options.length) {
                    return res.status(400).json({ error: `${i + 1}-savol: correctIdx 0 dan ${options.length - 1} gacha bo'lishi kerak` })
                }
            }

            if (normalizedTestType === 'DTM_BLOCK') {
                const blockType = normalizeDtmBlockType(typeof q.blockType === 'string' ? q.blockType : undefined)
                if (blockType === 'SPECIALTY_2' && !normalizedSubject2) {
                    return res.status(400).json({ error: `${i + 1}-savol: 2-ixtisoslik bloki uchun 2-fan tanlanishi kerak` })
                }
                const coefficient = parseQuestionCoefficient(q.coefficient) ?? getDefaultDtmCoefficient(blockType, normalizedSubject)
                if (!Number.isFinite(coefficient) || coefficient <= 0) {
                    return res.status(400).json({ error: `${i + 1}-savol: koeffitsient xato` })
                }
            }
        }

        // MODERATSIYA: TEACHER public testni tahrirlasa — qayta tasdiqlash uchun
        // approved=false bo'ladi. ADMIN tahrirlasa approved=true qoladi.
        // Private testlar (isPublic=false) ro'yxatda chiqmaydi — ular uchun approved=true qoldiramiz.
        const wantsPublicEdit = Boolean(isPublic)
        const isAdminEditor = req.user.role === 'ADMIN'
        const approvedAfterEdit = isAdminEditor ? true : !wantsPublicEdit

        // Manba: faqat ADMIN o'zgartira oladi; aks holda mavjud manba o'zgarishsiz qoladi.
        const reqSourceEdit = String(req.body.source || '')
        const resolvedSourceEdit: 'OFFICIAL' | 'UNOFFICIAL' | 'AI_PREDICTION' | undefined =
            (isAdminEditor && (reqSourceEdit === 'OFFICIAL' || reqSourceEdit === 'AI_PREDICTION' || reqSourceEdit === 'UNOFFICIAL'))
                ? reqSourceEdit
                : undefined

        const updated = await prisma.test.update({
            where: { id: existing.id },
            data: {
                title,
                description: description || null,
                subject: normalizedSubject,
                subject2: normalizedSubject2,
                isPublic: Boolean(isPublic),
                approved: approvedAfterEdit,
                approvedAt: approvedAfterEdit && wantsPublicEdit && isAdminEditor ? new Date() : null,
                approvedById: approvedAfterEdit && wantsPublicEdit && isAdminEditor ? req.user.id : null,
                testType: normalizedTestType,
                ...(resolvedSourceEdit ? { source: resolvedSourceEdit } : {}),
                ...(isAdminEditor ? { premium: Boolean(req.body.premium) } : {}), // premiumни faqat admin o'zgartiradi
                timeLimit: timeLimit || null,
                questions: {
                    deleteMany: {},
                    create: questions.map((q: IncomingCreateQuestion, i: number) => {
                        const questionType = q.questionType || 'mcq'
                        const blockType = normalizeDtmBlockType(typeof q.blockType === 'string' ? q.blockType : undefined)
                        const coefficient = normalizedTestType === 'DTM_BLOCK'
                            ? (parseQuestionCoefficient(q.coefficient) ?? getDefaultDtmCoefficient(blockType, normalizedSubject))
                            : null

                        return {
                            text: q.text || '',
                            imageUrl: q.imageUrl || null,
                            options: questionType === 'open' ? '[]'
                                : questionType === 'multipart_open' ? (typeof q.options === 'string' ? q.options : JSON.stringify(q.options))
                                    : questionType === 'matching' ? (typeof q.options === 'string' ? q.options : JSON.stringify(q.options))
                                        : JSON.stringify(q.options),
                            // FAZA 3: variant/yechim rasmlari (create bilan bir xil mantiq)
                            optionImages: (questionType === 'open' || questionType === 'matching' || questionType === 'multipart_open')
                                ? null
                                : sanitizeIncomingOptionImages(q.optionImages, Array.isArray(q.options) ? q.options.length : 0),
                            solutionImageUrl: sanitizeIncomingImageRef(q.solutionImageUrl),
                            correctIdx: (questionType === 'open' || questionType === 'matching' || questionType === 'multipart_open') ? -1 : (q.correctIdx ?? 0),
                            correctText: questionType === 'open' ? (q.correctText?.trim() || null) : null,
                            questionType,
                            difficulty: q.difficulty || 0,
                            orderIdx: i,
                            blockType,
                            coefficient
                        }
                    })
                }
            },
            include: { questions: true }
        })

        res.json(updated)
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Rasm yuklash endpointi (savollar uchun)
router.post('/upload-image', authenticate, requireRole('TEACHER', 'ADMIN'), upload.single('image'), async (req: AuthRequest, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Rasm yuklanmadi' })
        if (!req.file.mimetype.startsWith('image/')) {
            return res.status(400).json({ error: 'Faqat rasm fayllari yuklanadi' })
        }
        // Storage (Railway Bucket / S3) sozlanmagan bo'lsa — aniq xabar (umumiy 500 chalg'itadi).
        if (!isStorageConfigured) {
            console.error('upload-image: storage kalitlari sozlanmagan (Bucket ulanmagan)')
            return res.status(503).json({ error: 'Rasm saqlash hali sozlanmagan (Bucket ulanmagan). Administrator bilan bog\'laning.' })
        }

        // s3 ga yuklash
        const fileName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '-')}`
        const fileBuffer = req.file.buffer
        const mimetype = req.file.mimetype

        const s3Result = await uploadToS3(fileBuffer, fileName, 'questions', mimetype)

        res.json({
            url: await getSignedS3Url(s3Result.key),
            imageUrl: toStoredS3Ref(s3Result.key),
            key: s3Result.key
        })
    } catch (e: any) {
        console.error('Image upload error:', e?.message || e)
        res.status(500).json({ error: `Rasm yuklashda xatolik: ${e?.name === 'CredentialsProviderError' || /credential|access.?key|signature/i.test(String(e?.message)) ? 'S3 kaliti noto\'g\'ri' : 'saqlash xizmati javob bermadi'}` })
    }
})

// Rasmli savollarni vision AI bilan tahlil qilish
router.post('/analyze-vision', authenticate, aiAnalysisLimiter, async (req: AuthRequest, res) => {
    try {
        const { questions } = req.body
        if (!Array.isArray(questions) || questions.length === 0) {
            return res.json({ analysis: null })
        }
        const imageQs = questions.filter((q: any) => q.imageUrl)
        if (imageQs.length === 0) return res.json({ analysis: null })

        // Bepul kunlik RASM tahlili limiti — vision eng qimmat AI yo'li (OpenAI)
        const quota = await consumeAiQuota(req.user.id, req.user.role, 'vision')
        if (!quota.ok) return res.status(429).json({ error: quotaExceededMessage('vision'), code: 'DAILY_AI_LIMIT' })

        if (!process.env.GEMINI_API_KEY) {
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

        for (const [idx, q] of imageQs.entries()) {
            const imageUrl = await resolveStoredS3Url(q.imageUrl)
            if (!imageUrl) continue
            const opts = ['a', 'b', 'c', 'd'].map((k, i) => q[k] ? `${optLabels[i]}) ${q[k]}` : null).filter(Boolean).join(' | ')
            extractContent.push({
                type: 'text',
                text: `\nSavol ${idx + 1}${q.text ? ': ' + q.text : ' (rasm):'}${opts ? '\nVariantlar: ' + opts : ''}\nRasm:`
            })
            extractContent.push({ type: 'image_url', image_url: { url: imageUrl, detail: 'high' } })
        }

        const extractResult = await gptClient.chat.completions.create({
            model: VISION_MODEL,
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
// Bitta savolni QISQA tushuntirish — test panel review'da xato javob ostidagi "Nega xato?" tugmasi uchun.
router.post('/explain', authenticate, aiAnalysisLimiter, async (req: AuthRequest, res) => {
    try {
        const { question, studentAnswer, correctAnswer, subject } = req.body
        if (!question || !correctAnswer) return res.status(400).json({ error: 'question va correctAnswer kerak' })

        // Tushuntirish ham DeepSeek so'rovi — umumiy kunlik chat kvotasidan yeydi
        const quota = await consumeAiQuota(req.user.id, req.user.role, 'chat')
        if (!quota.ok) return res.status(429).json({ error: quotaExceededMessage('chat'), code: 'DAILY_AI_LIMIT' })
        const opts = (['a', 'b', 'c', 'd'] as const)
            .map(k => (req.body[k] ? `${k.toUpperCase()}) ${req.body[k]}` : null))
            .filter(Boolean).join('\n')
        const prompt = `Quyidagi ${subject || ''} test savolini QISQA tushuntir (o'zbek tilida, 2-4 jumla):

Savol: ${question}
${opts}

O'quvchining javobi: ${String(studentAnswer || '—').toUpperCase()}
To'g'ri javob: ${String(correctAnswer || '—').toUpperCase()}

Nega to'g'ri javob ${String(correctAnswer).toUpperCase()} ekanini soddagina tushuntir va o'quvchining xatosini qisqa ko'rsat. Faqat tushuntirish — kirish/yakun gapsiz. Formulani $...$ ichida yoz.`
        const completionOpts: any = {
            model: aiModel,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 500,
            temperature: 0.4,
        }
        if (aiModel.startsWith('gemini')) completionOpts.reasoning_effort = 'low'
        let explanation = ''
        try {
            const completion = await aiClient.chat.completions.create(completionOpts)
            explanation = completion.choices[0]?.message?.content?.trim() || ''
        } catch (primaryErr: any) {
            // DeepSeek 429/balans tugashi → Gemini zaxiraga (chat.ts kabi) — tugma 500 bermasin
            const st = primaryErr?.status ?? 0
            const m = String(primaryErr?.message || '').toLowerCase()
            const isAuthErr = st === 401 || m.includes('auth') || m.includes('invalid api key')
            if (!isAuthErr && hasGemini && aiModel.startsWith('deepseek')) {
                const completion = await geminiClient.chat.completions.create({
                    model: VISION_MODEL,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 500,
                    temperature: 0.4,
                    reasoning_effort: 'low',
                } as any)
                explanation = completion.choices[0]?.message?.content?.trim() || ''
            } else {
                throw primaryErr
            }
        }
        if (!explanation) return res.status(502).json({ error: 'Tushuntirib bo\'lmadi' })
        res.json({ explanation })
    } catch (e) {
        console.error('explain xato:', e)
        res.status(500).json({ error: 'Tushuntirishda xatolik' })
    }
})

router.post('/analyze-result', authenticate, aiAnalysisLimiter, async (req: AuthRequest, res) => {
    try {
        const { title, subject, score, total, questions } = req.body
        if (!Array.isArray(questions)) return res.json({ analysis: null })

        const hasImages = questions.some((q: any) => q.imageUrl)

        // Bepul kunlik AI limiti (xarajat shipi) — rasmli tahlil Vision (qimmat, 16k tok),
        // rasmsiz DeepSeek. Kind route qaysi AI yo'liga borishiga qarab tanlanadi.
        const quotaKind = (hasImages && process.env.GEMINI_API_KEY) ? 'vision' : 'chat'
        const aq = await consumeAiQuota(req.user!.id, req.user!.role, quotaKind)
        if (!aq.ok) return res.status(429).json({ error: quotaExceededMessage(quotaKind), code: 'DAILY_AI_LIMIT' })

        // Rasmli savollar bo'lsa vision AI (GPT-4o — rasmni aniq o'qiydi va matematikani to'g'ri yechadi)
        if (hasImages && process.env.GEMINI_API_KEY) {
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
            for (const [idx, q] of imgQs.entries()) {
                const imageUrl = await resolveStoredS3Url(q.imageUrl)
                if (!imageUrl) continue
                content.push({ type: 'text', text: `\n---\n${formatQuestionForAnalysis(q, idx)}\nRasmni diqqat bilan o'qi:` })
                content.push({ type: 'image_url', image_url: { url: imageUrl, detail: 'high' } })
            }

            // Rasmsiz savollar ham bo'lsa — ularni matn sifatida qo'shamiz
            const textQs = questions.filter((q: any) => !q.imageUrl)
            if (textQs.length > 0) {
                const textList = textQs.map((q: any, idx: number) => formatQuestionForAnalysis(q, idx)).join('\n\n')
                content.push({ type: 'text', text: `\n\nMatnli savollar:\n${textList}` })
            }

            content.push({ type: 'text', text: `\n\nOxirida umumiy xulosa yoz: qaysi mavzularda kuchli, qayerda zaif, nima o'rganish kerak.` })

            const completion = await gptClient.chat.completions.create({
                model: VISION_MODEL,
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
            .map((q: any, i: number) => formatQuestionForAnalysis(q, i))
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
        const { score, totalQuestions, results, subject } = req.body
        if (!results || !Array.isArray(results)) {
            return res.status(400).json({ error: 'results kerak' })
        }
        // Klient yuborgan ball'ni 0–100 oralig'iga cheklaymiz (poisoning oldini olish)
        const safeScore = Number.isFinite(Number(score)) ? Math.max(0, Math.min(100, Number(score))) : 0

        // YOPIQ O'QUV HALQASI: AI test natijalarini per-MAVZU TopicStat'ga yozamiz, shunda
        // chat-tutor real zaif mavzularni ko'radi (oldin ma'nosiz chat-sarlavha bucket'iga tushardi).
        const subjectKey = normalizeSubject(typeof subject === 'string' ? subject : '') ?? (typeof subject === 'string' && subject.trim() ? subject.trim() : 'Umumiy')
        // Poisoning blast-radiusni cheklash: real diagnostika <=90 savol, <=~25 mavzu.
        // (To'liq himoya — server-side baholash — keyinroq alohida tuzatiladi.)
        const MAX_RESULTS = 120
        const MAX_TOPICS = 50
        const topicAgg = new Map<string, { correct: number; total: number }>()
        for (const r of results.slice(0, MAX_RESULTS)) {
            const topic = normalizeTopicKey(typeof r?.topic === 'string' ? r.topic : '')
            if (!topic || topic.length > 80) continue
            if (!topicAgg.has(topic) && topicAgg.size >= MAX_TOPICS) continue
            // Klient yuborgan son'larni cheklaymiz: total 1..50 butun, correct 0..total (accuracy>1 bo'lmasin)
            const contrib = topicContribution(r)
            const safeTotal = Math.max(0, Math.min(50, Math.floor(contrib.total)))
            if (safeTotal === 0) continue
            const safeCorrect = Math.max(0, Math.min(safeTotal, Math.floor(contrib.correct)))
            const cur = topicAgg.get(topic) || { correct: 0, total: 0 }
            cur.correct += safeCorrect
            cur.total += safeTotal
            topicAgg.set(topic, cur)
        }

        // IDEMPOTENTLIK: bir xil natijani qayta yuborish statistikani shishirmasin
        // (avval bitta {score:100} ni qayta-qayta POST qilib avgScore/totalTests'ni
        // buzish mumkin edi). Payload hash unique — takrori jim qabul qilinadi, yozilmaydi.
        const payloadHash = crypto.createHash('sha256')
            .update(JSON.stringify({ s: safeScore, t: totalQuestions ?? null, r: results.slice(0, MAX_RESULTS), sub: subjectKey }))
            .digest('hex')
        try {
            await prisma.aiSubmitDedup.create({ data: { userId: req.user.id, hash: payloadHash } })
        } catch {
            return res.json({ ok: true, idempotent: true })
        }

        // AI testlar uchun Rasch yangilanmaydi — faqat statistika + TopicStat.
        // Atomik tranzaksiya: bir vaqtda kelgan submit'lar avgScore'ni buzmasin.
        await prisma.$transaction(async (tx) => {
            const profile = await tx.studentProfile.upsert({
                where: { userId: req.user.id },
                create: { userId: req.user.id, totalTests: 0, avgScore: 0 },
                update: {}
            })
            await tx.studentProfile.update({
                where: { userId: req.user.id },
                data: {
                    totalTests: { increment: 1 },
                    avgScore: Math.round(((profile.avgScore * profile.totalTests + safeScore) / (profile.totalTests + 1)) * 100) / 100
                }
            })
            const practicedAt = new Date()
            for (const [topic, agg] of topicAgg) {
                await tx.topicStat.upsert({
                    where: { userId_subject_topic: { userId: req.user.id, subject: subjectKey, topic } },
                    update: { correct: { increment: agg.correct }, total: { increment: agg.total }, lastPracticed: practicedAt },
                    create: { userId: req.user.id, subject: subjectKey, topic, correct: agg.correct, total: agg.total, lastPracticed: practicedAt },
                })
            }
        }, { timeout: 15000 })

        res.json({ ok: true, topicsTracked: topicAgg.size })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// ─── 1.1: AI-TEST SERVER-GRADE ────────────────────────────────────────────────
// Chat ichida AI generatsiya qilgan efemer testni SERVERда ro'yxatga olamiz (savollar +
// to'g'ri javoblar bilan). Submit'da klient FAQAT o'z tanlagan harflarini yuboradi; server
// to'g'riligini O'ZI hisoblaydi -> klient natijani soxtalashtira olmaydi (eski /submit-ai
// muammosi). Kalit yo'q bo'lsa ham ishlaydi (AI bloki chat streamдan keladi).
router.post('/ai-session', authenticate, createLimiter, async (req: AuthRequest, res) => {
    try {
        const { questions, subject } = req.body
        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: 'questions massiv bo\'lishi kerak' })
        }
        if (questions.length > 120) {
            return res.status(400).json({ error: 'Juda ko\'p savol (maks 120)' })
        }
        // Faqat kerakli maydonlar; to'g'ri javob = 'a'|'b'|'c'|'d' harfi (server-only saqlanadi).
        const cleaned = questions.slice(0, 120).map((q: any) => ({
            q: typeof q?.q === 'string' ? q.q.slice(0, 2000) : '',
            a: typeof q?.a === 'string' ? q.a.slice(0, 1000) : '',
            b: typeof q?.b === 'string' ? q.b.slice(0, 1000) : '',
            c: typeof q?.c === 'string' ? q.c.slice(0, 1000) : '',
            d: typeof q?.d === 'string' ? q.d.slice(0, 1000) : '',
            correct: typeof q?.correct === 'string' ? q.correct.trim().toLowerCase().slice(0, 1) : '',
            topic: typeof q?.topic === 'string' ? q.topic.slice(0, 120) : '',
            difficulty: typeof q?.difficulty === 'number' && Number.isFinite(q.difficulty) ? q.difficulty : null,
        }))
        const subjectKey = normalizeSubject(typeof subject === 'string' ? subject : '')
            ?? (typeof subject === 'string' && subject.trim() ? subject.trim() : null)
        const sess = await prisma.aiTestSession.create({
            data: { userId: req.user.id, subject: subjectKey, questions: JSON.stringify(cleaned) }
        })
        res.json({ sessionId: sess.id })
    } catch (e) {
        console.error('ai-session create xato:', e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// AI-test sessiyasini SERVER baholaydi. Klient faqat javob harflarini yuboradi.
router.post('/ai-session/:sessionId/submit', authenticate, submitLimiter, async (req: AuthRequest, res) => {
    try {
        const { answers } = req.body // { "0":"a", "1":"c" } yoki ["a","c",...]
        const sess = await prisma.aiTestSession.findUnique({ where: { id: req.params.sessionId as string } })
        if (!sess || sess.userId !== req.user.id) {
            return res.status(404).json({ error: 'AI test sessiyasi topilmadi' })
        }
        if (sess.submittedAt) {
            return res.status(409).json({ error: 'Bu test allaqachon yechilgan' })
        }
        let storedQuestions: Array<{ correct?: string; topic?: string }> = []
        try { storedQuestions = JSON.parse(sess.questions) } catch { /* buzilgan JSON */ }
        if (!Array.isArray(storedQuestions) || storedQuestions.length === 0) {
            return res.status(400).json({ error: 'Sessiya savollari topilmadi' })
        }
        const getAns = (i: number): string => {
            if (Array.isArray(answers)) return typeof answers[i] === 'string' ? answers[i].trim().toLowerCase() : ''
            if (answers && typeof answers === 'object') {
                const v = (answers as Record<string, unknown>)[String(i)]
                return typeof v === 'string' ? v.trim().toLowerCase() : ''
            }
            return ''
        }
        // SERVER BAHOLAYDI — klient 'isCorrect'iga umuman ishonmaymiz.
        let correctCount = 0
        const perQuestion = storedQuestions.map((q, i) => {
            const chosen = getAns(i)
            const correctLetter = String(q.correct || '').trim().toLowerCase()
            const isCorrect = !!chosen && !!correctLetter && chosen === correctLetter
            if (isCorrect) correctCount++
            return { index: i, isCorrect, correct: correctLetter, topic: normalizeTopicKey(q.topic) }
        })
        const total = storedQuestions.length
        const scorePercent = total > 0 ? Math.round((correctCount / total) * 1000) / 10 : 0

        const subjectKey = sess.subject ?? 'Umumiy'
        const topicAgg = new Map<string, { correct: number; total: number }>()
        for (const pq of perQuestion) {
            const topic = pq.topic
            if (!topic || topic.length > 80) continue
            const cur = topicAgg.get(topic) || { correct: 0, total: 0 }
            cur.correct += pq.isCorrect ? 1 : 0
            cur.total += 1
            topicAgg.set(topic, cur)
        }

        await prisma.$transaction(async (tx) => {
            // Idempotentlik (poyga): sessiyani lock qilib, qayta submitni to'samiz.
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'aisess:' + sess.id}, 0))`
            const fresh = await tx.aiTestSession.findUnique({ where: { id: sess.id }, select: { submittedAt: true } })
            if (fresh?.submittedAt) throw new AlreadySubmittedError()
            await tx.aiTestSession.update({ where: { id: sess.id }, data: { submittedAt: new Date() } })

            const profile = await tx.studentProfile.upsert({
                where: { userId: req.user.id },
                create: { userId: req.user.id, totalTests: 0, avgScore: 0 },
                update: {}
            })
            await tx.studentProfile.update({
                where: { userId: req.user.id },
                data: {
                    totalTests: { increment: 1 },
                    avgScore: Math.round(((profile.avgScore * profile.totalTests + scorePercent) / (profile.totalTests + 1)) * 100) / 100
                }
            })
            const practicedAt = new Date()
            for (const [topic, agg] of topicAgg) {
                await tx.topicStat.upsert({
                    where: { userId_subject_topic: { userId: req.user.id, subject: subjectKey, topic } },
                    update: { correct: { increment: agg.correct }, total: { increment: agg.total }, lastPracticed: practicedAt },
                    create: { userId: req.user.id, subject: subjectKey, topic, correct: agg.correct, total: agg.total, lastPracticed: practicedAt },
                })
            }
        }, { timeout: 15000 })

        res.json({
            ok: true,
            score: scorePercent,
            correct: correctCount,
            total,
            perQuestion: perQuestion.map(p => ({ index: p.index, isCorrect: p.isCorrect, correct: p.correct }))
        })
    } catch (e) {
        if (e instanceof AlreadySubmittedError) {
            return res.status(409).json({ error: 'Bu test allaqachon yechilgan' })
        }
        console.error('ai-session submit xato:', e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Guest submit endpoint endi ishlatilmaydi — login qilgan user ham oddiy /submit endpointdan foydalanadi
router.post('/:testId/submit-guest', optionalAuthenticate, submitLimiter, async (req: AuthRequest, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Testni ishlash uchun avval kiring yoki ro\'yxatdan o\'ting' })
    }
    return res.status(400).json({ error: 'Bu endpoint endi ishlatilmaydi. Iltimos oddiy submit endpointdan foydalaning.' })
})

// Test yechish va Rasch baholash
router.post('/:testId/submit', authenticate, submitLimiter, async (req: AuthRequest, res) => {
    try {
        const { answers, shareLink } = req.body // [{questionId, selectedIdx}]
        if (!Array.isArray(answers)) {
            return res.status(400).json({ error: 'answers massiv bo\'lishi kerak' })
        }
        // BUG-10: bo'sh javoblar statistikani buzadi — kamida 1 ta javob talab qilinadi
        if (answers.length === 0) {
            return res.status(400).json({ error: 'Kamida bitta javob yuborilishi kerak' })
        }
        const test = await prisma.test.findUnique({
            where: { id: req.params.testId as string },
            include: { questions: true }
        })
        if (!test) return res.status(404).json({ error: 'Test topilmadi' })
        const normalizedTestType = normalizeTestType(test.testType)

        // Private testga faqat egasi (creatorId) yoki valid share-link bilan kirilgan
        // foydalanuvchi submit qila oladi — rol'dan qat'i nazar (begona teacher/admin ham emas).
        if (!test.isPublic && test.creatorId !== req.user?.id && shareLink !== test.shareLink) {
            return res.status(403).json({ error: 'Bu test uchun ruxsat yo\'q' })
        }
        // MODERATSIYA: student tasdiqlanmagan public testni link orqali topib submit qila olmasin.
        // (Egasi/admin preview qilishi mumkin, lekin natija yozilmasligi uchun ularni ham bloklaymiz
        // — tasdiqlanmagan test hali "tirik" emas.)
        if (test.isPublic && !test.approved) {
            return res.status(403).json({ error: 'Bu test hali admin tomonidan tasdiqlanmagan' })
        }

        // PREMIUM: premium testni faqat Pro user topshira oladi (beta'da hamma ochiq).
        if (test.premium) {
            const ent = await getEntitlement(req.user.id)
            if (!ent.isPro) {
                return res.status(403).json({ error: 'Bu — Premium test. Pro obuna talab qilinadi.', code: 'PRO_REQUIRED' })
            }
        }

        const timeLimitMs = getTimeLimitMs(test.timeLimit)
        let activeSessionId: string | null = null
        if (timeLimitMs) {
            const session = await prisma.testSession.findUnique({
                where: { testId_userId: { testId: test.id, userId: req.user.id } }
            })
            if (!session || session.submittedAt) {
                return res.status(403).json({
                    error: 'Test sessiyasi topilmadi. Testni qayta ochib boshlang.'
                })
            }

            const now = new Date()
            if (session.expiresAt.getTime() + TEST_SUBMIT_GRACE_MS < now.getTime()) {
                return res.status(403).json({
                    error: 'Test vaqti tugagan. Javoblar qabul qilinmadi.',
                    timeRemainingSeconds: 0
                })
            }
            activeSessionId = session.id
        }

        // Javoblarni tekshirish
        const answerMap = new Map<string, Record<string, unknown>>(
            answers
                .filter((answer: unknown): answer is Record<string, unknown> => Boolean(answer) && typeof answer === 'object' && typeof (answer as { questionId?: unknown }).questionId === 'string')
                .map((answer) => [String(answer.questionId), answer])
        )

        const results = await Promise.all(test.questions.map(async (q) => {
            const a = answerMap.get(q.id)
            let isCorrect = false
            if (q.questionType === 'open') {
                const studentAns = typeof a?.textAnswer === 'string' ? a.textAnswer.trim() : ''
                const correctAns = (q.correctText || '').trim()
                const verdict = studentAns ? await evaluateOpenAnswer(studentAns, correctAns) : { correct: false, aiVerified: true }
                isCorrect = verdict.correct
                return {
                    questionId: q.id,
                    selectedIdx: -1,
                    textAnswer: studentAns || null,
                    isCorrect,
                    hasAnswer: !!studentAns,
                    difficulty: q.difficulty || 0.0,
                    aiUnverified: !verdict.aiVerified
                }
            }

            if (q.questionType === 'multipart_open') {
                let multipartData: { subQuestions?: Array<{ label?: string; text?: string; correctText?: string }> } = { subQuestions: [] }
                try { multipartData = JSON.parse(q.options as string) } catch { }
                const subQuestions = multipartData.subQuestions || []
                const studentTextAnswers = Array.isArray(a?.textAnswers)
                    ? a.textAnswers.map(answer => String(answer || ''))
                    : []
                const subResults = await Promise.all(subQuestions.map(async (subQuestion, subIndex) => {
                    const studentAnswer = (studentTextAnswers[subIndex] || '').trim()
                    const correctText = String(subQuestion.correctText || '').trim()
                    const subVerdict = studentAnswer ? await evaluateOpenAnswer(studentAnswer, correctText) : { correct: false, aiVerified: true }
                    return {
                        label: String(subQuestion.label || String.fromCharCode(65 + subIndex)),
                        subText: String(subQuestion.text || ''),
                        studentAnswer,
                        correctText,
                        isCorrect: subVerdict.correct,
                        aiUnverified: !subVerdict.aiVerified
                    }
                }))
                const correctSubCount = subResults.filter((subResult) => subResult.isCorrect).length
                isCorrect = correctSubCount === subQuestions.length && subQuestions.length > 0
                return {
                    questionId: q.id,
                    selectedIdx: -1,
                    textAnswer: null,
                    textAnswers: studentTextAnswers,
                    isCorrect,
                    hasAnswer: studentTextAnswers.some((x) => typeof x === 'string' && x.trim().length > 0),
                    difficulty: q.difficulty || 0.0,
                    correctSubCount,
                    totalSubs: subQuestions.length,
                    subResults,
                    aiUnverified: subResults.some((subResult) => subResult.aiUnverified)
                }
            }

            if (q.questionType === 'matching') {
                let matchingData: { subQuestions?: Array<{ correctIdx?: number }> } = { subQuestions: [] }
                try { matchingData = JSON.parse(q.options as string) } catch { }
                const subQuestions = matchingData.subQuestions || []
                const studentMatchingAnswers = Array.isArray(a?.matchingAnswers)
                    ? a.matchingAnswers.map(answer => typeof answer === 'number' ? answer : -1)
                    : []
                let correctSubCount = 0
                subQuestions.forEach((sq, si) => {
                    if (studentMatchingAnswers[si] === sq.correctIdx) correctSubCount++
                })
                isCorrect = correctSubCount === subQuestions.length && subQuestions.length > 0
                return {
                    questionId: q.id,
                    selectedIdx: -1,
                    textAnswer: null,
                    matchingAnswers: studentMatchingAnswers,
                    isCorrect,
                    hasAnswer: studentMatchingAnswers.some((x) => typeof x === 'number' && x >= 0),
                    difficulty: q.difficulty || 0.0,
                    correctSubCount,
                    totalSubs: subQuestions.length
                }
            }

            const selectedIdx = typeof a?.selectedIdx === 'number' ? a.selectedIdx : -1
            isCorrect = q.correctIdx === selectedIdx
            return {
                questionId: q.id,
                selectedIdx,
                textAnswer: typeof a?.textAnswer === 'string' ? a.textAnswer : null,
                isCorrect,
                hasAnswer: selectedIdx >= 0,
                difficulty: q.difficulty || 0.0
            }
        }))

        // Matching va multi-part savollar: partial credit per sub-question
        let correct = 0
        let expandedTotal = 0
        results.forEach((r: any) => {
            const q = test.questions.find(q => q.id === r.questionId)
            if (q && ((q as any).questionType === 'matching' || (q as any).questionType === 'multipart_open')) {
                expandedTotal += r.totalSubs || 1
                correct += r.correctSubCount || 0
            } else {
                expandedTotal += 1
                correct += r.isCorrect ? 1 : 0
            }
        })
        const effectiveTotal = expandedTotal || test.questions.length
        const scorePercent = effectiveTotal > 0 ? (correct / effectiveTotal) * 100 : 0

        // Degenerate case: 0/n yoki n/n bo'lsa, yoki savollar < 3 ta bo'lsa
        // Rasch MLE diverge qiladi (±∞) — ability yangilanmasin
        const canUpdateRasch = normalizedTestType === 'MILLIY_SERTIFIKAT' && results.length >= 3 && scorePercent > 0 && scorePercent < 100
        // Matching savollar uchun Rasch: har bir kichik savol alohida item sifatida kengaytiriladi
        const raschItems: { difficulty: number; isCorrect: boolean }[] = []
        results.forEach((r: any) => {
            const q = test.questions.find(q => q.id === r.questionId)
            if (q && ((q as any).questionType === 'matching' || (q as any).questionType === 'multipart_open') && r.totalSubs > 0) {
                // Har bir sub-question uchun alohida Rasch item (bir xil difficulty)
                let subQuestionsData: any = { subQuestions: [] }
                try { subQuestionsData = JSON.parse((q as any).options as string) } catch { }
                const subQs = subQuestionsData.subQuestions || []
                if ((q as any).questionType === 'matching') {
                    const studentAnss: number[] = r.matchingAnswers || []
                    subQs.forEach((sq: any, si: number) => {
                        raschItems.push({ difficulty: r.difficulty, isCorrect: studentAnss[si] === sq.correctIdx })
                    })
                } else {
                    const subResults = r.subResults || []
                    subQs.forEach((_: any, si: number) => {
                        raschItems.push({ difficulty: r.difficulty, isCorrect: !!subResults[si]?.isCorrect })
                    })
                }
            } else {
                raschItems.push({ difficulty: r.difficulty, isCorrect: r.isCorrect })
            }
        })
        const totalForResponse = effectiveTotal

        // ---- Closed learning loop: real testdan per-mavzu agregatsiya ----
        const subjectKey = subjectKeyForTest(test)
        const topicAgg = new Map<string, { subject: string; correct: number; total: number }>()
        for (const r of results as Array<{ questionId: string; isCorrect?: boolean; correctSubCount?: number; totalSubs?: number }>) {
            const q = test.questions.find((qq) => qq.id === r.questionId)
            if (!q) continue
            const topic = topicKeyForQuestion(q, test)
            const { correct: c, total: tt } = topicContribution(r)
            const cur = topicAgg.get(topic) || { subject: subjectKey, correct: 0, total: 0 }
            cur.correct += c
            cur.total += tt
            topicAgg.set(topic, cur)
        }

        const attempt = await prisma.$transaction(async (tx) => {
            // 1.7 POYGA TUZATISH: bir user+test uchun bir vaqtda kelgan submit'larni SERIALIZATSIYA
            // qilamiz. Poyga oynasi jonli isbotlangan (10 parallel submit -> 2 urinish yaratilardi):
            // ikki tranzaksiya findFirst'ni ikkalasi ham "urinish yo'q" ko'rib, ikkitasini yaratardi.
            // pg_advisory_xact_lock tranzaksiya oxirida avtomatik bo'shaydi (deadlock xavfi yo'q).
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${test.id + ':' + req.user.id}, 0))`
            // Idempotentlik: vaqt-limitsiz testlarda sessiya guard'i yo'q (timeLimitMs === null),
            // shuning uchun double-submit/replay'ni shu yerda to'xtatamiz — bir foydalanuvchi
            // vaqt-limitsiz testni faqat bir marta yechadi. Vaqtli testlar sessiya orqali
            // (yuqorida 1724-1738) himoyalangan va qayta ochilganda yangi sessiya bilan
            // qayta yechilishi mumkin — bu xatti-harakatga tegmaymiz.
            if (!timeLimitMs) {
                const existingAttempt = await tx.testAttempt.findFirst({
                    where: { testId: test.id, userId: req.user.id }
                })
                if (existingAttempt) {
                    throw new AlreadySubmittedError()
                }
            } else if (activeSessionId) {
                // P0-01 ATOMIK CLAIM: vaqtli test sessiyasini faqat submittedAt hali null
                // bo'lgandagina egallaymiz (compare-and-swap). Sessiya tekshiruvi (~2404)
                // transaction TASHQARISIDA edi — ikki parallel POST ikkalasi ham submittedAt=null
                // ko'rib, ikki attempt yaratardi (advisory lock ularni faqat serializatsiya qilardi,
                // to'xtatmasdi). updateMany atomik: ikkinchi POST count=0 oladi -> AlreadySubmittedError.
                const claimed = await tx.testSession.updateMany({
                    where: { id: activeSessionId, submittedAt: null },
                    data: { submittedAt: new Date() }
                })
                if (claimed.count === 0) {
                    throw new AlreadySubmittedError()
                }
            }

            let profile = await tx.studentProfile.findUnique({
                where: { userId: req.user.id }
            })

            if (!profile) {
                profile = await tx.studentProfile.create({
                    data: {
                        userId: req.user.id,
                        subject: normalizeSubject(test.subject) ?? test.subject ?? null,
                        onboardingDone: false
                    }
                })
            }

            const currentAbility = Math.max(-5, Math.min(5, profile.abilityLevel || 0.0))
            const computedScore = normalizedTestType === 'DTM_BLOCK'
                ? scoreDtmBlockAttempt({
                    questions: test.questions.map(question => ({
                        difficulty: question.difficulty,
                        coefficient: question.coefficient,
                        blockType: question.blockType,
                    })),
                    results,
                    fallbackSubject: test.subject,
                    currentAbility,
                })
                : normalizedTestType === 'MILLIY_SERTIFIKAT'
                    ? scoreMilliySertifikatAttempt({
                        raschItems,
                        canUpdateAbility: canUpdateRasch,
                        currentAbility,
                    })
                    : scoreRegularAttempt({
                        correctCount: correct,
                        totalCount: totalForResponse,
                        currentAbility,
                    })

            const att = await tx.testAttempt.create({
                data: {
                    testId: test.id,
                    userId: req.user.id,
                    answers: JSON.stringify(results),
                    score: computedScore.scorePercent,
                    rawScore: computedScore.rawScore,
                    scoreMax: computedScore.scoreMax,
                    grade: computedScore.grade,
                    // P0-02 FREEZE: MS ability yangilanishi vaqtincha to'xtatilgan — degenerate
                    // 0%/100% test ability'ni +-5 ga reset qilardi (testScoring.ts:221) va ability
                    // subject bo'yicha ajratilmagan (S1). Snapshot joriy (o'zgarmagan) qiymatda saqlanadi.
                    // Batch 2: subject-specific EAP/Bayesian model.
                    raschAbility: currentAbility
                }
            })

            const nextTotalTests = profile.totalTests + 1
            const nextAvgScore = roundScore((((profile.avgScore || 0) * profile.totalTests + computedScore.scorePercent) / nextTotalTests))

            await tx.studentProfile.update({
                where: { userId: req.user.id },
                data: {
                    // P0-02 FREEZE: MS ham abilityLevel'ni o'zgartirmaydi (yuqoridagi izoh). Profil
                    // ability'si joriy qiymatda muzlatilgan — bitta perfect/nol test tarixiy profilni buzmaydi.
                    abilityLevel: profile.abilityLevel,
                    totalTests: nextTotalTests,
                    avgScore: nextAvgScore
                }
            })

            // Yopiq o'quv halqasi: zaif mavzular endi REAL testdan to'planadi (oldin faqat chatdan)
            const practicedAt = new Date()
            for (const [topic, agg] of topicAgg) {
                await tx.topicStat.upsert({
                    where: { userId_subject_topic: { userId: req.user.id, subject: agg.subject, topic } },
                    update: { correct: { increment: agg.correct }, total: { increment: agg.total }, lastPracticed: practicedAt },
                    create: { userId: req.user.id, subject: agg.subject, topic, correct: agg.correct, total: agg.total, lastPracticed: practicedAt },
                })
            }

            // P0-01: vaqtli test sessiyasi yuqorida ATOMIK claim qilindi (submittedAt o'rnatilgan) —
            // bu yerda qayta yozmaymiz. Vaqt-limitsiz testlarda sessiya yo'q (activeSessionId=null).

            // P0-02 FREEZE: newAbility joriy qiymatda — computedScore.ability (degenerate +-5) tarqalmasin.
            return { attempt: att, newAbility: currentAbility, computedScore }
        }, { timeout: 15000, maxWait: 5000 })

        // Submit dan keyin to'g'ri javoblarni qaytaramiz (oldin emas!)
        const correctAnswers = await Promise.all(test.questions.map(async q => {
            // FAZA 3: yechim rasmi faqat submitdan KEYIN, signed URL bilan
            const solutionImageUrl = await resolveStoredS3Url((q as any).solutionImageUrl)
            if ((q as any).questionType === 'matching') {
                let matchingData: any = { subQuestions: [] }
                try { matchingData = JSON.parse(q.options as string) } catch { }
                return {
                    id: q.id, correctIdx: -1, questionType: 'matching',
                    matchingCorrect: (matchingData.subQuestions || []).map((sq: any) => sq.correctIdx),
                    solutionImageUrl
                }
            }
            if ((q as any).questionType === 'multipart_open') {
                let multipartData: any = { subQuestions: [] }
                try { multipartData = JSON.parse(q.options as string) } catch { }
                return {
                    id: q.id,
                    correctIdx: -1,
                    questionType: 'multipart_open',
                    multipartCorrectText: (multipartData.subQuestions || []).map((subQuestion: any, subIndex: number) => ({
                        label: String(subQuestion.label || String.fromCharCode(65 + subIndex)),
                        text: String(subQuestion.text || ''),
                        correctText: String(subQuestion.correctText || '')
                    })),
                    solutionImageUrl
                }
            }
            return {
                id: q.id, correctIdx: q.correctIdx,
                correctText: (q as any).questionType === 'open' ? (q as any).correctText : undefined,
                questionType: (q as any).questionType || 'mcq',
                solutionImageUrl
            }
        }))

        const computedScore = attempt.computedScore

        // ---- Per-mavzu xatolik tahlili (eng zaif birinchi) ----
        const topicBreakdown = Array.from(topicAgg.entries())
            .map(([topic, agg]) => ({
                topic,
                subject: agg.subject,
                correct: agg.correct,
                total: agg.total,
                pct: agg.total > 0 ? Math.round((agg.correct / agg.total) * 100) : 0,
            }))
            .sort((a, b) => a.pct - b.pct || b.total - a.total)

        // ---- Adaptiv tavsiya: eng zaif mavzu + o'quvchi hali yechmagan keyingi test ----
        const focusTopic = topicBreakdown.find((t) => t.pct < 100) || topicBreakdown[0] || null
        let nextTest: { id: string; title: string; shareLink: string } | null = null
        try {
            const attempted = await prisma.testAttempt.findMany({
                where: { userId: req.user.id },
                select: { testId: true },
            })
            const attemptedIds = Array.from(new Set(attempted.map((a) => a.testId)))
            const where: { isPublic: boolean; approved: boolean; subject?: string; id?: { notIn: string[] } } = {
                isPublic: true,
                approved: true,
            }
            if (test.subject) where.subject = test.subject
            if (attemptedIds.length) where.id = { notIn: attemptedIds }
            nextTest = await prisma.test.findFirst({
                where,
                orderBy: { createdAt: 'desc' },
                select: { id: true, title: true, shareLink: true },
            })
        } catch {
            nextTest = null
        }
        const recommendation = {
            focusTopic: focusTopic ? { topic: focusTopic.topic, subject: focusTopic.subject, pct: focusTopic.pct } : null,
            nextTest,
        }

        res.json({
            attempt: attempt.attempt,
            score: computedScore.scorePercent,
            rawScore: computedScore.rawScore,
            scoreMax: computedScore.scoreMax,
            grade: computedScore.grade,
            correct,
            total: totalForResponse,
            // P0-02 FREEZE: ability o'zgarmagani uchun raschFeedback ("oldin -> keyin") ko'rsatilmaydi.
            newAbility: undefined,
            testType: normalizedTestType,
            testTypeLabel: getTestTypeLabel(normalizedTestType),
            dtmBall: normalizedTestType === 'DTM_BLOCK' ? computedScore.rawScore : undefined,
            dtmMax: normalizedTestType === 'DTM_BLOCK' ? computedScore.scoreMax : undefined,
            dtmBreakdown: normalizedTestType === 'DTM_BLOCK' && 'breakdown' in computedScore ? computedScore.breakdown : undefined,
            msBall: normalizedTestType === 'MILLIY_SERTIFIKAT' ? computedScore.rawScore : undefined,
            msMax: normalizedTestType === 'MILLIY_SERTIFIKAT' ? computedScore.scoreMax : undefined,
            results,
            correctAnswers,
            topicBreakdown,
            recommendation,
            // AI texnik xato sabab tekshirilmay "xato" deb belgilangan yozma javoblar soni —
            // frontend buni ko'rsatadi, o'quvchi jimgina noto'g'ri baholanmaydi
            unverifiedOpenCount: results.filter((resultItem) => (resultItem as { aiUnverified?: boolean }).aiUnverified).length
        })
    } catch (e) {
        if (e instanceof AlreadySubmittedError) {
            return res.status(409).json({ error: e.message })
        }
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
        const questionStats = test.questions.map((q: any) => {
            let opts: any[]
            const isMatching = q.questionType === 'matching'
            const isMultipartOpen = q.questionType === 'multipart_open'
            try {
                const parsed = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
                if (isMatching) {
                    // Matching uchun faqat javob bankini olish (array)
                    opts = Array.isArray(parsed?.answers) ? parsed.answers : []
                } else {
                    opts = Array.isArray(parsed) ? parsed : []
                }
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
                    if ((isMatching || isMultipartOpen) && (ans.totalSubs || 0) > 0) {
                        totalAnswered += ans.totalSubs || 0
                        correctCount += ans.correctSubCount || 0
                    } else {
                        totalAnswered++
                        if (ans.isCorrect) correctCount++
                    }
                    // Matching uchun selectedIdx yo'q — optionCounts hisoblanmaydi
                    if (!isMatching && !isMultipartOpen) {
                        const idx = ans.selectedIdx
                        if (idx >= 0 && idx < opts.length) optionCounts[idx]++
                    }
                }
            }
            return {
                id: q.id, text: q.text, correctIdx: q.correctIdx, options: opts,
                questionType: q.questionType || 'mcq',
                totalAnswered, correctCount,
                errorRate: totalAnswered > 0 ? Math.round((1 - correctCount / totalAnswered) * 100) : 0,
                optionCounts
            }
        })

        const totalAttempts = test.attempts.length
        const avgScore = totalAttempts > 0
            ? Math.round(test.attempts.reduce((s: number, a: any) => s + a.score, 0) / totalAttempts * 10) / 10
            : 0
        const normalizedTestType = normalizeTestType(test.testType)

        // Har bir urinish uchun to'liq statistika (reyting uchun)
        const studentRows = test.attempts.map((a: any) => {
            let answers: any[] = []
            try { answers = typeof a.answers === 'string' ? JSON.parse(a.answers) : (a.answers || []) } catch { }
            let correctCount = 0
            let total = 0
            answers.forEach((r: any) => {
                if ((r.totalSubs || 0) > 0) {
                    total += r.totalSubs || 0
                    correctCount += r.correctSubCount || 0
                } else {
                    total += 1
                    correctCount += r.isCorrect ? 1 : 0
                }
            })
            if (total === 0) total = test.questions.length
            const scoreVal = roundScore(a.score)
            const rawScore = typeof a.rawScore === 'number'
                ? roundScore(a.rawScore)
                : (normalizedTestType === 'DTM_BLOCK'
                    ? roundScore(correctCount * getDefaultDtmCoefficient(normalizeDtmBlockType('GENERIC'), test.subject))
                    : roundScore(correctCount))
            const scoreMax = typeof a.scoreMax === 'number'
                ? roundScore(a.scoreMax)
                : (normalizedTestType === 'MILLIY_SERTIFIKAT' ? 75 : total)
            return {
                attemptId: a.id,
                name: a.user?.name || 'Noma\'lum',
                email: a.user?.email || '',
                score: scoreVal,
                rawScore,
                scoreMax,
                correct: correctCount,
                total,
                dtmBall: normalizedTestType === 'DTM_BLOCK' ? rawScore : undefined,
                dtmMax: normalizedTestType === 'DTM_BLOCK' ? scoreMax : undefined,
                msBall: normalizedTestType === 'MILLIY_SERTIFIKAT' ? rawScore : undefined,
                msMax: normalizedTestType === 'MILLIY_SERTIFIKAT' ? scoreMax : undefined,
                grade: a.grade || (normalizedTestType === 'MILLIY_SERTIFIKAT' ? getMsGrade(scoreMax > 0 ? (rawScore / scoreMax) * 100 : 0) : null),
                raschAbility: a.raschAbility ?? null,
                createdAt: a.createdAt
            }
        }).sort((a: any, b: any) => b.score - a.score)

        res.json({
            test: { id: test.id, title: test.title, subject: test.subject, subject2: test.subject2, testType: normalizedTestType, testTypeLabel: getTestTypeLabel(normalizedTestType), createdAt: test.createdAt },
            totalAttempts, avgScore,
            students: studentRows,
            questionStats
        })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

router.get('/:testId/attempts/:attemptId/detail', authenticate, requireRole('TEACHER', 'ADMIN'), async (req: AuthRequest, res) => {
    try {
        const where = req.user.role === 'ADMIN'
            ? { id: req.params.testId as string }
            : { id: req.params.testId as string, creatorId: req.user.id }

        const test = await prisma.test.findFirst({
            where,
            include: {
                questions: { orderBy: { orderIdx: 'asc' } },
                attempts: {
                    where: { id: req.params.attemptId as string },
                    include: { user: { select: { name: true, email: true } } },
                    take: 1
                }
            }
        })

        if (!test || test.attempts.length === 0) {
            return res.status(404).json({ error: 'Urinish topilmadi yoki ruxsat yo\'q' })
        }

        const attempt = test.attempts[0]
        let parsedAnswers: Array<Record<string, unknown>> = []
        try {
            parsedAnswers = typeof attempt.answers === 'string'
                ? JSON.parse(attempt.answers)
                : (attempt.answers as Array<Record<string, unknown>>)
        } catch {
            parsedAnswers = []
        }

        const questionDetails = test.questions.map((question) => {
            const answer = parsedAnswers.find((item) => item.questionId === question.id)
            const parsedOptions = parseStoredQuestionOptions(question.questionType, question.options)

            if (question.questionType === 'matching') {
                const matchingData = Array.isArray(parsedOptions) ? { answers: [], subQuestions: [] } : ('answers' in parsedOptions ? parsedOptions : { answers: [], subQuestions: [] })
                const studentMatchingAnswers = Array.isArray(answer?.matchingAnswers)
                    ? answer.matchingAnswers.map((selected) => typeof selected === 'number' ? selected : -1)
                    : []
                const details = matchingData.subQuestions.map((subQuestion, subIndex) => ({
                    label: String(subIndex + 1),
                    prompt: subQuestion.text,
                    studentAnswer: matchingData.answers[studentMatchingAnswers[subIndex] || -1] || '—',
                    correctAnswer: matchingData.answers[subQuestion.correctIdx] || '—',
                    isCorrect: studentMatchingAnswers[subIndex] === subQuestion.correctIdx
                }))
                return {
                    id: question.id,
                    orderIdx: question.orderIdx,
                    text: question.text,
                    questionType: question.questionType,
                    isCorrect: Boolean(answer?.isCorrect),
                    details
                }
            }

            if (question.questionType === 'multipart_open') {
                const multipartData: StoredMultipartData = !Array.isArray(parsedOptions) && 'subQuestions' in parsedOptions && !('answers' in parsedOptions)
                    ? parsedOptions
                    : { subQuestions: [] }
                const subResults = Array.isArray(answer?.subResults)
                    ? answer.subResults.map((subResult) => ({
                        label: String((subResult as { label?: unknown }).label || '—'),
                        prompt: String((subResult as { subText?: unknown }).subText || ''),
                        studentAnswer: String((subResult as { studentAnswer?: unknown }).studentAnswer || '—'),
                        correctAnswer: String((subResult as { correctText?: unknown }).correctText || '—'),
                        isCorrect: Boolean((subResult as { isCorrect?: unknown }).isCorrect)
                    }))
                    : multipartData.subQuestions.map((subQuestion) => ({
                        label: subQuestion.label,
                        prompt: subQuestion.text,
                        studentAnswer: '—',
                        correctAnswer: subQuestion.correctText,
                        isCorrect: false
                    }))
                return {
                    id: question.id,
                    orderIdx: question.orderIdx,
                    text: question.text,
                    questionType: question.questionType,
                    isCorrect: Boolean(answer?.isCorrect),
                    details: subResults
                }
            }

            const optionList = Array.isArray(parsedOptions) ? parsedOptions : []
            const selectedIdx = typeof answer?.selectedIdx === 'number' ? answer.selectedIdx : -1
            return {
                id: question.id,
                orderIdx: question.orderIdx,
                text: question.text,
                questionType: question.questionType,
                isCorrect: Boolean(answer?.isCorrect),
                options: optionList,
                studentAnswer: question.questionType === 'open'
                    ? String(answer?.textAnswer || '—')
                    : (selectedIdx >= 0 ? optionList[selectedIdx] || '—' : '—'),
                correctAnswer: question.questionType === 'open'
                    ? formatAcceptedAnswers(question.correctText)
                    : (question.correctIdx >= 0 ? optionList[question.correctIdx] || '—' : '—')
            }
        })

        res.json({
            test: {
                id: test.id,
                title: test.title,
                subject: test.subject,
                subject2: test.subject2,
                testType: normalizeTestType(test.testType),
                testTypeLabel: getTestTypeLabel(normalizeTestType(test.testType))
            },
            student: {
                attemptId: attempt.id,
                name: attempt.user?.name || 'Noma\'lum',
                email: attempt.user?.email || '',
                score: roundScore(attempt.score),
                rawScore: typeof attempt.rawScore === 'number' ? roundScore(attempt.rawScore) : null,
                scoreMax: typeof attempt.scoreMax === 'number' ? roundScore(attempt.scoreMax) : null,
                grade: attempt.grade || null,
                createdAt: attempt.createdAt
            },
            questions: questionDetails
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

        // MODERATSIYA: TEACHER public qilsa — admin tasdig'ini kutadi (approved=false).
        // ADMIN public qilsa — darrov approved=true. Private qilinsa approved=true qoldiramiz
        // (private test ro'yxatda chiqmaydi, qayta public qilinsa yana tekshiriladi).
        const isAdminToggler = req.user.role === 'ADMIN'
        const approvedAfterToggle = !isPublic ? true : isAdminToggler

        const updated = await prisma.test.update({
            where: { id: test.id },
            data: {
                isPublic,
                approved: approvedAfterToggle,
                approvedAt: isPublic && approvedAfterToggle && isAdminToggler ? new Date() : null,
                approvedById: isPublic && approvedAfterToggle && isAdminToggler ? req.user.id : null,
            }
        })

        // Private → Public bo'lganda barcha studentlarga bildirishnoma.
        // FAQAT public VA tasdiqlangan bo'lsa yuboriladi (ADMIN toggle). TEACHER public
        // qilsa bildirishnoma admin approve qilganda yuboriladi.
        // Haqiqatda nechta bildirishnoma yaratilganini kuzatamiz (student bo'lmasa 0).
        let notified = 0
        if (isPublic && !test.isPublic && approvedAfterToggle) {
            try {
                const students = await prisma.user.findMany({
                    where: { role: 'STUDENT' },
                    select: { id: true }
                })
                if (students.length > 0) {
                    const created = await prisma.notification.createMany({
                        data: students.map((s: { id: string }) => ({
                            userId: s.id,
                            senderId: req.user.id,
                            title: `📚 Yangi test: ${test.title}`,
                            message: `"${test.title}" nomli yangi public test qo'shildi. Hoziroq yechib ko'ring!`,
                            targetType: 'test',
                            targetId: test.id
                        }))
                    })
                    notified = created.count
                }
            } catch (notifErr) {
                console.error('Notification send error:', notifErr)
            }
        }

        res.json({ ...updated, notified })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Test o'chirish (o'qituvchi/admin)
router.delete('/:testId', authenticate, requireRole('TEACHER', 'ADMIN'), async (req: AuthRequest, res) => {
    try {
        const testId = req.params.testId as string
        const isAdmin = req.user.role === 'ADMIN'
        // Admin har qanday testni o'chira oladi, o'qituvchi faqat o'zinikini
        const where = isAdmin
            ? { id: testId }
            : { id: testId, creatorId: req.user.id }

        // Audit meta uchun testni avval o'qib olamiz (faqat admin uchun)
        const existing = isAdmin
            ? await prisma.test.findUnique({ where: { id: testId }, select: { title: true, creatorId: true } })
            : null

        const deleted = await prisma.test.deleteMany({ where })
        if (deleted.count === 0) return res.status(404).json({ error: 'Test topilmadi yoki ruxsat yo\'q' })

        // AUDIT (best-effort) — faqat admin o'chirishi audit qilinadi
        if (isAdmin) {
            const actor = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { email: true }
            }).catch(() => null)
            await logAdminAction(req.user.id, actor?.email ?? null, 'TEST_DELETE', 'TEST', testId, {
                title: existing?.title ?? null,
                creatorId: existing?.creatorId ?? null,
            })
        }

        res.json({ message: 'Test o\'chirildi' })
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

export default router
