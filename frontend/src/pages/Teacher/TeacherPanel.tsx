import { useState, useEffect, useRef, useMemo } from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { BrainCircuit, Plus, Trash2, LogOut, Copy, Check, Globe, Lock, ClipboardList, Upload, Sparkles, FileText, Image, BarChart2, X, Users, Bell } from 'lucide-react'
import { fetchApi, uploadFile } from '@/lib/api'
import { saveScopedItem } from '@/lib/storagePrune'
import { renderMathHtml } from '@/lib/mathRender'
import { useAuthStore } from '@/store/authStore'
import { SUBJECTS } from '../../constants'
import 'katex/dist/katex.min.css'

function MathPreview({ text, inline }: { text: string; inline?: boolean }) {
    const html = renderMathHtml(text || '', inline ? 'inline' : 'display')
    if (!html) return null
    try {
        if (inline) {
            return (
                <span className="inline-flex items-center gap-1 text-[10px] ml-1 px-2 py-1 rounded-md"
                    style={{ background: 'color-mix(in srgb, var(--brand) 8%, transparent)', color: 'var(--text-muted)', border: '1px solid color-mix(in srgb, var(--brand) 14%, transparent)' }}>
                    <span style={{ fontWeight: 600 }}>Preview</span>
                    <span dangerouslySetInnerHTML={{ __html: html }} />
                </span>
            )
        }

        return (
            <div className="mt-2 px-2.5 py-2 rounded-lg overflow-x-auto"
                style={{ background: 'color-mix(in srgb, var(--brand) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--brand) 15%, transparent)', color: 'var(--text-primary)' }}>
                <p className="text-[10px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Formula preview</p>
                <div className="text-sm" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
        )
    } catch { return null }
}

function MathInlineText({ text, className = '' }: { text: string; className?: string }) {
    const html = renderMathHtml(text || '', 'inline')
    if (!html) return <span className={className}>{text}</span>
    try {
        return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
    } catch {
        return <span className={className}>{text}</span>
    }
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function renderPrintableMath(text: string, mode: 'inline' | 'display' = 'inline'): string {
    return renderMathHtml(text, mode) || escapeHtml(text)
}

function formatAcceptedAnswerHint(text: string) {
    return text
        .split(/\r?\n+/)
        .map(part => part.trim())
        .filter(Boolean)
        .join(' / ')
}

// 's3key:' ko'rinishidagi xom ref brauzerda ochilmaydi — <img> uchun signed/lokal
// preview'ni afzal ko'ramiz, xom ref bo'lsa null qaytaramiz (singan rasm chiqmasin)
function displayableImageSrc(previewUrl?: string | null, rawUrl?: string | null): string | null {
    if (previewUrl) return previewUrl
    if (rawUrl && !rawUrl.startsWith('s3key:')) return rawUrl
    return null
}

interface MatchingSubQ { text: string; correctIdx: number }
interface MultipartOpenSubQ { label: string; text: string; correctText: string }
type TestTypeValue = 'REGULAR' | 'DTM_BLOCK' | 'MILLIY_SERTIFIKAT'
type DtmBlockTypeValue = 'GENERIC' | 'MANDATORY_LANGUAGE' | 'MANDATORY_MATH' | 'MANDATORY_HISTORY' | 'SPECIALTY_1' | 'SPECIALTY_2'
interface Question {
    uid: string                       // klient-tomon barqaror kalit (React key) — API ga YUBORILMAYDI
    text: string; imageUrl?: string | null; options: string[]; correctIdx: number
    questionType: 'mcq' | 'open' | 'matching' | 'multipart_open'; correctText?: string
    imagePreviewUrl?: string | null
    imageUploading?: boolean          // rasm yuklanmoqda (spinner + disable uchun)
    optionImages?: (string | null)[]          // variant rasmlari ('s3key:' ref, options bilan indeks-mos) — API ga YUBORILADI
    optionImagePreviews?: (string | null)[]   // signed URL preview'lar — klient-only, API ga yuborilmaydi
    optionImageUploading?: number | null      // hozir yuklanayotgan variant indeksi — klient-only
    solutionImageUrl?: string | null          // yechim rasmi ('s3key:' ref) — API ga YUBORILADI
    solutionImagePreviewUrl?: string | null   // signed URL preview — klient-only
    solutionImageUploading?: boolean          // klient-only
    matchingAnswers?: string[]       // A–F shared answer bank
    matchingSubQuestions?: MatchingSubQ[]  // each sub-question + correct answer idx
    multipartSubQuestions?: MultipartOpenSubQ[]
    blockType?: DtmBlockTypeValue
    coefficient?: number | null
}

interface TeacherTestListItem {
    id: string
    title: string
    subject: string
    subject2: string | null
    isPublic: boolean
    approved?: boolean
    testType: string | null
    timeLimit: number | null
    shareLink: string
    createdAt: string
    avgScore: number
    _count?: {
        questions?: number
        attempts?: number
    }
}

interface AnalyticsStudentRow {
    attemptId: string
    name: string
    email: string
    score: number
    rawScore?: number
    scoreMax?: number
    dtmBall?: number
    dtmMax?: number
    msBall?: number
    msMax?: number
    grade?: string | null
    raschAbility?: number | null
    createdAt: string
}

interface AnalyticsQuestionStat {
    id: string
    text: string
    questionType: string
    correctIdx: number
    options: string[]
    totalAnswered: number
    correctCount: number
    errorRate: number
    optionCounts: number[]
}

interface AnalyticsResponse {
    test: {
        id: string
        title: string
        subject: string
        subject2: string | null
        testType: string
        testTypeLabel: string
        createdAt: string
    }
    totalAttempts: number
    avgScore: number
    students: AnalyticsStudentRow[]
    questionStats: AnalyticsQuestionStat[]
}

interface TeacherTestDetailResponse {
    id: string
    title: string
    description?: string | null
    subject: string
    subject2: string | null
    isPublic: boolean
    timeLimit: number | null
    testType: TestTypeValue
    source?: 'OFFICIAL' | 'UNOFFICIAL' | 'AI_PREDICTION'
    premium?: boolean
    attemptsCount: number
    // Server ref ('s3key:') + signed preview maydonlarini yuboradi, lekin klient-only
    // yuklanish flaglarini (imageUploading/optionImageUploading/solutionImageUploading) yubormaydi
    questions: Array<Omit<Question, 'uid' | 'imageUploading' | 'optionImageUploading' | 'solutionImageUploading'>>
}

interface AttemptDetailItem {
    label: string
    prompt: string
    studentAnswer: string
    correctAnswer: string
    isCorrect: boolean
}

interface AttemptDetailQuestion {
    id: string
    orderIdx: number
    text: string
    questionType: string
    isCorrect: boolean
    options?: string[]
    studentAnswer?: string
    correctAnswer?: string
    details?: AttemptDetailItem[]
}

interface AttemptDetailResponse {
    test: {
        id: string
        title: string
        subject: string
        subject2: string | null
        testType: string
        testTypeLabel: string
    }
    student: {
        attemptId: string
        name: string
        email: string
        score: number
        rawScore: number | null
        scoreMax: number | null
        grade: string | null
        createdAt: string
    }
    questions: AttemptDetailQuestion[]
}

const DTM_OFFICIAL_QUESTION_TOTAL = 90
const DTM_OFFICIAL_SCORE_TOTAL = 189

const TEST_TYPES: Array<{ value: TestTypeValue; title: string; description: string; accent: string; icon: string }> = [
    { value: 'REGULAR', title: 'Oddiy test', description: 'Mavzuli, kichik va moslashuvchan test', accent: '#0f766e', icon: '🧩' },
    { value: 'DTM_BLOCK', title: 'DTM blok test', description: '189 ball · koeffitsientli bloklar', accent: 'var(--brand)', icon: '🎯' },
    { value: 'MILLIY_SERTIFIKAT', title: 'Milliy Sertifikat', description: 'Rasch modeli · 75 ball', accent: 'var(--info)', icon: '📋' },
]

// aiSubject — blok AI importida generate-from-file'ga yuboriladigan fan;
// ixtisoslik bloklari uchun yo'q (formadagi subject/subject2 dan olinadi)
const DTM_BLOCK_OPTIONS: Array<{ value: DtmBlockTypeValue; label: string; shortLabel: string; coefficient: number; target: number; aiSubject?: string }> = [
    { value: 'MANDATORY_LANGUAGE', label: 'Ona tili', shortLabel: 'Ona tili', coefficient: 1.1, target: 10, aiSubject: 'Ona tili' },
    { value: 'MANDATORY_MATH', label: 'Majburiy matematika', shortLabel: 'Matem.', coefficient: 1.1, target: 10, aiSubject: 'Matematika' },
    { value: 'MANDATORY_HISTORY', label: 'O‘zbekiston tarixi', shortLabel: 'Tarix', coefficient: 1.1, target: 10, aiSubject: 'Tarix' },
    { value: 'SPECIALTY_1', label: '1-ixtisoslik', shortLabel: '1-ixt.', coefficient: 3.1, target: 30 },
    { value: 'SPECIALTY_2', label: '2-ixtisoslik', shortLabel: '2-ixt.', coefficient: 2.1, target: 30 },
]

// Payload'da savollar rasmiy DTM tartibida ketadi (orderIdx massiv tartibidan olinadi)
const DTM_BLOCK_RANK: Record<string, number> = {
    MANDATORY_LANGUAGE: 0, MANDATORY_MATH: 1, MANDATORY_HISTORY: 2, SPECIALTY_1: 3, SPECIALTY_2: 4
}

// Qoralama avtosaqlash — brauzer yopilib qolsa 90 savollik mehnat yo'qolmasin.
// Kalit user id bilan scoped: umumiy kompyuterda boshqa o'qituvchi qoralamasi ko'rinmasin
const teacherDraftKeyFor = (userId: string | undefined) => `dtmmax_teacher_draft_${userId || 'anon'}_v1`
interface TeacherDraft {
    savedAt: string
    title: string
    subject: string
    subject2: string
    isPublic: boolean
    testType: TestTypeValue
    source: 'OFFICIAL' | 'UNOFFICIAL' | 'AI_PREDICTION'
    premium: boolean
    timeLimit: number
    timeLimitTouched: boolean
    questions: Question[]
}

function getDefaultCoefficient(blockType: DtmBlockTypeValue): number {
    return DTM_BLOCK_OPTIONS.find(option => option.value === blockType)?.coefficient ?? 3.1
}

function formatDtmNumber(value: number): string {
    const rounded = Math.round(value * 10) / 10
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function getDtmControlStats(questions: Question[]) {
    const rows = DTM_BLOCK_OPTIONS.map(option => {
        const count = questions.filter(question => question.blockType === option.value).length
        return {
            ...option,
            count,
            percent: Math.min(100, Math.round((count / option.target) * 100))
        }
    })
    const scoreMax = questions.reduce((sum, question) => {
        const blockType = question.blockType || 'SPECIALTY_1'
        const coefficient = typeof question.coefficient === 'number' && Number.isFinite(question.coefficient) && question.coefficient > 0
            ? question.coefficient
            : getDefaultCoefficient(blockType)
        return sum + coefficient
    }, 0)
    const overLimit = rows.filter(row => row.count > row.target)
    const officialReady = questions.length === DTM_OFFICIAL_QUESTION_TOTAL && overLimit.length === 0 && rows.every(row => row.count === row.target)

    return {
        rows,
        total: questions.length,
        scoreMax,
        overLimit,
        officialReady,
        officialMismatch: questions.length === DTM_OFFICIAL_QUESTION_TOTAL && !officialReady,
        hasSpecialty2: rows.some(row => row.value === 'SPECIALTY_2' && row.count > 0)
    }
}

function getTestTypeLabel(testType: string | null | undefined): string {
    const matched = TEST_TYPES.find(item => item.value === testType)
    return matched?.title || 'Oddiy test'
}

function createDefaultMultipartSubQuestions(): MultipartOpenSubQ[] {
    return ['A', 'B', 'C'].map(label => ({ label, text: '', correctText: '' }))
}

// Savol uchun barqaror klient-kalit (React key + ochiq/yopiq holat). Indeks emas —
// savol o'chirilganda qo'shni savollarning state'i adashib ketmasin.
let questionUidSeq = 0
function nextQuestionUid(): string {
    questionUidSeq += 1
    return `q${Date.now().toString(36)}-${questionUidSeq}`
}

function createEmptyQuestion(): Question {
    return {
        uid: nextQuestionUid(),
        text: '',
        imageUrl: null,
        options: ['', '', '', ''],
        correctIdx: 0,
        questionType: 'mcq',
        correctText: '',
        matchingAnswers: ['', '', '', '', '', ''],
        matchingSubQuestions: [{ text: '', correctIdx: 0 }],
        multipartSubQuestions: createDefaultMultipartSubQuestions(),
        blockType: 'SPECIALTY_1',
        coefficient: 3.1
    }
}

export default function TeacherPanel() {
    const nav = useNavigate()
    const { logout, user } = useAuthStore()
    const [tab, setTab] = useState<'create' | 'list'>('list')
    const [tests, setTests] = useState<TeacherTestListItem[]>([])

    const [title, setTitle] = useState('')
    const [subject, setSubject] = useState('Matematika')
    const [subject2, setSubject2] = useState('')
    const [isPublic, setIsPublic] = useState(false)
    const [testType, setTestType] = useState<TestTypeValue>('REGULAR')
    const [source, setSource] = useState<'OFFICIAL' | 'UNOFFICIAL' | 'AI_PREDICTION'>('UNOFFICIAL') // manba (faqat ADMIN o'zgartiradi)
    const [premium, setPremium] = useState(false) // Premium test (faqat ADMIN; Pro userlar ochadi)
    const [timeLimit, setTimeLimit] = useState<number>(0)
    const [timeLimitTouched, setTimeLimitTouched] = useState(false)
    const [questions, setQuestions] = useState<Question[]>([createEmptyQuestion()])
    // Ko'p savolли formada (DTM 90) savollar yopiq ko'rinadi — ochilgan savollarning uid to'plami.
    // 6 tadan kam bo'lsa hammasi ochiq (oddiy test). Ko'p bo'lsa — bossangiz ochiladi.
    const [expandedQ, setExpandedQ] = useState<Set<string>>(new Set())
    const isQExpanded = (uid: string) => questions.length <= 6 || expandedQ.has(uid)
    const toggleQ = (uid: string) => setExpandedQ(prev => { const n = new Set(prev); if (n.has(uid)) n.delete(uid); else n.add(uid); return n })
    const [loading, setLoading] = useState(false)
    const [msg, setMsg] = useState('')
    const [copied, setCopied] = useState<string | null>(null)
    const [analyticsId, setAnalyticsId] = useState<string | null>(null)
    const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
    const [loadingAnalytics, setLoadingAnalytics] = useState(false)
    const [analyticsError, setAnalyticsError] = useState('')
    const [editingTestId, setEditingTestId] = useState<string | null>(null)
    const [editingSourceTitle, setEditingSourceTitle] = useState('')
    const [cloneMode, setCloneMode] = useState(false)
    const [loadingEditor, setLoadingEditor] = useState(false)
    const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null)
    const [attemptDetail, setAttemptDetail] = useState<AttemptDetailResponse | null>(null)
    const [loadingAttemptDetail, setLoadingAttemptDetail] = useState(false)
    const [attemptDetailError, setAttemptDetailError] = useState('')

    const [showNotifModal, setShowNotifModal] = useState(false)
    const [notifForm, setNotifForm] = useState({ title: '', message: '' })
    const [sendingNotif, setSendingNotif] = useState(false)

    const [aiFile, setAiFile] = useState<File | null>(null)
    const [aiGenerating, setAiGenerating] = useState(false)
    const [aiError, setAiError] = useState('')
    const [aiDone, setAiDone] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const dtmControlStats = useMemo(() => getDtmControlStats(questions), [questions])

    // DTM blok-bo'limli forma: yopiq bo'limlar + har blokka alohida AI import
    const [collapsedBlocks, setCollapsedBlocks] = useState<Set<DtmBlockTypeValue>>(new Set())
    const [blockAiGenerating, setBlockAiGenerating] = useState<DtmBlockTypeValue | null>(null)
    // Ref (state emas) — tugma bosilishi bilan sinxron yoziladi, file input onChange kechroq o'qiydi
    const blockAiTargetRef = useRef<DtmBlockTypeValue | null>(null)
    const blockFileInputRef = useRef<HTMLInputElement>(null)

    // Qoralama: mount'da topilgan bo'lsa banner ko'rsatamiz
    const [draftMeta, setDraftMeta] = useState<{ title: string; count: number; savedAt: string } | null>(null)

    useEffect(() => { loadTests() }, [])
    useEffect(() => {
        const sendPing = () => fetchApi('/auth/ping', { method: 'POST', body: JSON.stringify({ page: 'teacher' }), silent: true }).catch(() => { })
        sendPing()
        const pingInterval = setInterval(sendPing, 60000)
        return () => clearInterval(pingInterval)
    }, [])
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return
            // Qatlam tartibi: eng ustki modal birinchi yopiladi.
            // Urinish tafsiloti (z-60) ochiq bo'lsa — faqat uni yopamiz, statistika ochiq qoladi.
            if (selectedAttemptId) { setSelectedAttemptId(null); return }
            if (analyticsId) { setAnalyticsId(null); return }
            if (showNotifModal) setShowNotifModal(false)
        }
        window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [selectedAttemptId, analyticsId, showNotifModal])
    // Vaqtni aqlli default bilan to'ldirish — ustoz qo'lda o'zgartirsa qayta bosmaymiz
    useEffect(() => {
        if (timeLimitTouched) return
        if (testType === 'DTM_BLOCK') {
            setTimeLimit(180)
            return
        }
        if (testType === 'MILLIY_SERTIFIKAT') {
            setTimeLimit(Math.max(45, Math.ceil(questions.length * 2)))
            return
        }
        const count = questions.length
        if (count >= 2) setTimeLimit(Math.ceil(count * 1.5))
        else setTimeLimit(0)
    }, [questions.length, testType, timeLimitTouched])
    async function loadTests() {
        try { setTests(await fetchApi('/tests/my-tests')) } catch { }
    }

    const teacherDraftKey = teacherDraftKeyFor(user?.id)

    // Mount'da saqlangan qoralama bor-yo'qligini tekshiramiz (banner uchun)
    useEffect(() => {
        try {
            const raw = localStorage.getItem(teacherDraftKey)
            if (!raw) return
            const draft = JSON.parse(raw) as TeacherDraft
            if (!Array.isArray(draft.questions) || draft.questions.length === 0) return
            setDraftMeta({ title: draft.title || 'Nomsiz test', count: draft.questions.length, savedAt: draft.savedAt })
        } catch {
            localStorage.removeItem(teacherDraftKey)
        }
    }, [teacherDraftKey])

    // Qoralama avtosaqlash (debounce 800ms) — faqat YANGI test yaratishda.
    // Tahrirlash/nusxa rejimida yozmaymiz: tiklash semantikasi chalkashadi.
    // MUHIM: banner turganда (draftMeta) ham yozmaymiz — aks holda yangi bir harf
    // eski 90 savollik qoralamani 800ms ichida yozib yuborardi, banner esa hali eskisini taklif qilib turardi
    useEffect(() => {
        if (tab !== 'create' || editingTestId || cloneMode || draftMeta) return
        const timer = setTimeout(() => {
            const hasContent = title.trim().length > 0
                || questions.some(q => q.text.trim() || q.imageUrl || q.options.some(option => option.trim()))
            if (!hasContent) return
            const draft: TeacherDraft = {
                savedAt: new Date().toISOString(),
                title, subject, subject2, isPublic, testType, source, premium, timeLimit, timeLimitTouched,
                // Yuklanish flaglari saqlanmaydi (spinner osilib qolmasin); blob: preview'lar ham —
                // ular brauzer yopilganda o'ladi va tiklanganда singan rasm ko'rsatardi.
                // Signed URL preview'lar (7 kun yashaydi) saqlanadi.
                questions: questions.map(({ imageUploading: _a, optionImageUploading: _b, solutionImageUploading: _c, ...rest }) => ({
                    ...rest,
                    imagePreviewUrl: rest.imagePreviewUrl?.startsWith('blob:') ? null : rest.imagePreviewUrl,
                    optionImagePreviews: rest.optionImagePreviews?.map(preview => (preview?.startsWith('blob:') ? null : preview)),
                    solutionImagePreviewUrl: rest.solutionImagePreviewUrl?.startsWith('blob:') ? null : rest.solutionImagePreviewUrl
                }))
            }
            // saveScopedItem: quota to'lsa eski dtmmax_* kalitlarni prune qilib qayta urinadi
            saveScopedItem(teacherDraftKey, JSON.stringify(draft))
        }, 800)
        return () => clearTimeout(timer)
    }, [tab, editingTestId, cloneMode, draftMeta, teacherDraftKey, title, subject, subject2, isPublic, testType, source, premium, timeLimit, timeLimitTouched, questions])

    function restoreDraft() {
        try {
            const raw = localStorage.getItem(teacherDraftKey)
            if (!raw) { setDraftMeta(null); return }
            const draft = JSON.parse(raw) as TeacherDraft
            // Formada yozilgan (banner sabab avtosaqlanmagan) kontent bo'lsa — so'raymiz
            const hasFormContent = title.trim().length > 0
                || questions.some(q => q.text.trim() || q.imageUrl || q.options.some(option => option.trim()))
            if (hasFormContent && !confirm('Joriy formadagi kontent qoralama bilan almashtiriladi. Davom etasizmi?')) return
            resetEditorState()
            setTitle(draft.title || '')
            setSubject(draft.subject || 'Matematika')
            setSubject2(draft.subject2 || '')
            setIsPublic(Boolean(draft.isPublic))
            setTestType(draft.testType || 'REGULAR')
            setSource(draft.source || 'UNOFFICIAL')
            setPremium(Boolean(draft.premium))
            setTimeLimit(draft.timeLimit || 0)
            setTimeLimitTouched(Boolean(draft.timeLimitTouched))
            setQuestions(draft.questions.length > 0
                ? draft.questions.map(q => ({ ...q, uid: q.uid || nextQuestionUid() }))
                : [createEmptyQuestion()])
            setTab('create')
            setMsg('')
            setDraftMeta(null)
            toast.success('Qoralama tiklandi')
        } catch {
            localStorage.removeItem(teacherDraftKey)
            setDraftMeta(null)
            toast.error('Qoralama buzilgan — tiklab bo\'lmadi')
        }
    }

    function discardDraft() {
        localStorage.removeItem(teacherDraftKey)
        setDraftMeta(null)
    }

    function resetEditorState() {
        setEditingTestId(null)
        setEditingSourceTitle('')
        setCloneMode(false)
    }

    function selectTestType(nextType: TestTypeValue) {
        setTestType(nextType)
        setTimeLimitTouched(false)
        setQuestions(prev => prev.map(question => {
            if (nextType !== 'DTM_BLOCK') {
                return question
            }
            return {
                ...question,
                questionType: 'mcq',
                blockType: question.blockType || 'SPECIALTY_1',
                coefficient: question.coefficient ?? getDefaultCoefficient(question.blockType || 'SPECIALTY_1')
            }
        }))
    }

    const sendNotification = async () => {
        if (!notifForm.title.trim() || !notifForm.message.trim()) {
            return toast.error("Sarlavha va xabar kerak")
        }
        const confirmed = window.confirm("Bildirishnoma barcha o'quvchilarga yuboriladi. Davom etasizmi?")
        if (!confirmed) return
        setSendingNotif(true)
        try {
            const data = await fetchApi('/notifications/send', {
                method: 'POST',
                body: JSON.stringify({ title: notifForm.title, message: notifForm.message, broadcastAll: true })
            })
            toast.success(`${data.sent} ta o'quvchiga yuborildi!`)
            setNotifForm({ title: '', message: '' })
            setShowNotifModal(false)
        } catch (e: any) { toast.error(e.message) }
        finally { setSendingNotif(false) }
    }

    // Faqat DTM bo'lmagan testlarda ishlatiladi — DTM'da savol bo'lim ichidan qo'shiladi (addQuestionToBlock)
    function addQuestion() {
        setQuestions(prev => [...prev, createEmptyQuestion()])
    }

    // DTM bo'limidan savol qo'shish — blok turi va koeffitsient bo'limdan avtomatik
    function addQuestionToBlock(blockType: DtmBlockTypeValue) {
        const question = { ...createEmptyQuestion(), questionType: 'mcq' as const, blockType, coefficient: getDefaultCoefficient(blockType) }
        setQuestions(prev => [...prev, question])
        setExpandedQ(prev => { const next = new Set(prev); next.add(question.uid); return next })
    }

    function toggleBlockCollapse(blockType: DtmBlockTypeValue) {
        setCollapsedBlocks(prev => {
            const next = new Set(prev)
            if (next.has(blockType)) next.delete(blockType); else next.add(blockType)
            return next
        })
    }

    // AI javobidagi MCQ savolni forma savoliga aylantirish — global va blok importlari
    // BIR XIL qoidada ishlasin (drift bo'lsa bir import boshqasidan farqli savol chiqarardi)
    function mapAiMcqQuestion(q: { text?: string; options?: unknown[]; correctIdx?: number }, blockType: DtmBlockTypeValue, coefficient: number): Question {
        // Variantlar POZITSIYASI saqlanadi — bo'shlarini filter qilish indekslarni surib,
        // correctIdx boshqa variantga ko'rsatib qolardi (noto'g'ri javob "to'g'ri" bo'lib saqlanardi)
        const opts = (Array.isArray(q.options) ? q.options.map(option => (option == null ? '' : String(option))) : []).slice(0, 4)
        while (opts.length < 4) opts.push('')
        return {
            ...createEmptyQuestion(),
            text: q.text || '',
            options: opts.slice(0, 4),
            // correctIdx 0-3 oralig'iga clamp — AI ba'zan chegaradan tashqari indeks qaytaradi
            correctIdx: typeof q.correctIdx === 'number' ? Math.max(0, Math.min(q.correctIdx, 3)) : 0,
            questionType: 'mcq',
            blockType,
            coefficient
        }
    }

    // AI fayl tekshiruvi — backend qabul qiladigan turlar va multer 20MB limiti.
    // Eski .doc YO'Q: backend mammoth faqat .docx o'qiydi, .doc yuborilsa chalg'ituvchi 500 qaytardi
    function aiFileError(file: File): string | null {
        const isAllowedType = file.type.startsWith('image/')
            || file.type === 'application/pdf'
            || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        if (!isAllowedType) return 'Faqat PDF, Word (.docx) yoki rasm (PNG, JPG) fayllari qo\'llab-quvvatlanadi'
        if (file.size > 20 * 1024 * 1024) return 'Fayl hajmi 20MB dan oshmasligi kerak'
        return null
    }

    // Bitta DTM blokiga AI import: savollar shu blokka avto-belgilanadi.
    // (Avval hamma import SPECIALTY_1 ga majburlanardi — 90 savolda saqlash darrov rad etilardi.)
    async function generateBlockFromFile(blockType: DtmBlockTypeValue, file: File) {
        const option = DTM_BLOCK_OPTIONS.find(item => item.value === blockType)
        if (!option) return
        const fileError = aiFileError(file)
        if (fileError) { toast.error(fileError); return }
        // Majburiy bloklar fani jadvaldan (aiSubject), ixtisoslik bloklari formadan
        const blockSubject = option.aiSubject ?? (blockType === 'SPECIALTY_2' ? (subject2 || subject) : subject)
        // Rasm-only savollar ham kontent (matni bo'sh bo'lsa ham) — ularni jimgina o'chirib yubormaslik kerak
        const hasContent = questions.some(q => q.blockType === blockType
            && (q.text.trim() || q.imageUrl || q.options.some(option2 => option2.trim()) || q.optionImages?.some(Boolean) || q.solutionImageUrl))
        if (hasContent && !confirm(`${option.label} blokidagi mavjud savollar import qilingan savollar bilan almashtiriladi. Davom etasizmi?`)) return
        setBlockAiGenerating(blockType)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('subject', blockSubject)
            const data = await uploadFile('/tests/generate-from-file', formData)
            const totalParsed = (data.questions || []).length
            const mapped: Question[] = (data.questions || [])
                .filter((q: { questionType?: string }) => q.questionType !== 'matching')
                .map((q: { text?: string; options?: unknown[]; correctIdx?: number }) => mapAiMcqQuestion(q, blockType, option.coefficient))
                .filter((q: Question) => q.text.trim().length > 0)
            if (mapped.length === 0) { toast.error('Fayldan A/B/C/D savollar topilmadi'); return }
            // Limitdan oshsa ham HAMMASI olinadi — savol yo'qolmaydi. Bo'lim qizarib
            // over-limit ko'rsatadi, ortiqchasini "Blok turi" bilan boshqa blokka ko'chirish mumkin
            if (mapped.length > option.target) {
                toast(`${mapped.length} ta savol keldi — blok limiti ${option.target}. Ortiqchasini "Blok turi" orqali boshqa blokka ko'chiring.`, { duration: 7000 })
            }
            if (totalParsed > mapped.length) {
                toast(`${totalParsed - mapped.length} ta A/B/C/D bo'lmagan yoki bo'sh savol o'tkazib yuborildi`)
            }
            if (data.truncated) toast('Fayl katta — AI bo\'lib-bo\'lib tahlil qildi, natijani tekshirib chiqing')
            setQuestions(prev => [...prev.filter(q => q.blockType !== blockType), ...mapped])
            setCollapsedBlocks(prev => { const next = new Set(prev); next.delete(blockType); return next })
            toast.success(`${option.label}: ${mapped.length} ta savol import qilindi`)
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'AI import ishlamadi')
        } finally {
            setBlockAiGenerating(null)
        }
    }

    function applyOfficialDtmTemplate() {
        if (!subject2) {
            toast.error('DTM blok test uchun 2-ixtisoslik fanini tanlang')
            return
        }
        const hasCustomContent = questions.some((question) => question.text.trim() || question.options.some((option) => option.trim()))
        if (hasCustomContent && !confirm('Joriy savollar rasmiy 90 savollik shablon bilan almashtiriladi. Davom etasizmi?')) {
            return
        }

        const template: Array<{ count: number; blockType: DtmBlockTypeValue }> = [
            { count: 10, blockType: 'MANDATORY_LANGUAGE' },
            { count: 10, blockType: 'MANDATORY_MATH' },
            { count: 10, blockType: 'MANDATORY_HISTORY' },
            { count: 30, blockType: 'SPECIALTY_1' },
            { count: 30, blockType: 'SPECIALTY_2' },
        ]

        const nextQuestions = template.flatMap((group) =>
            Array.from({ length: group.count }, () => ({
                ...createEmptyQuestion(),
                questionType: 'mcq' as const,
                blockType: group.blockType,
                coefficient: getDefaultCoefficient(group.blockType)
            }))
        )

        setQuestions(nextQuestions)
        setTimeLimitTouched(false)
        toast.success('Rasmiy 90 savollik DTM shabloni qo\'yildi')
    }

    async function startEditing(testId: string, asClone = false) {
        setLoadingEditor(true)
        try {
            const detail = await fetchApi(`/tests/${testId}`) as TeacherTestDetailResponse
            setTitle(asClone || detail.attemptsCount > 0 ? `${detail.title} (nusxa)` : detail.title)
            setSubject(detail.subject)
            setSubject2(detail.subject2 || '')
            setIsPublic(detail.isPublic)
            setTestType(detail.testType)
            setSource(detail.source ?? 'UNOFFICIAL')
            setPremium(detail.premium ?? false)
            setTimeLimit(detail.timeLimit || 0)
            setTimeLimitTouched(Boolean(detail.timeLimit))
            // Serverdan kelgan savollarga klient-kalit (uid) beramiz — React key barqaror bo'lsin.
            // Rasm maydonlari: xom ref (imageUrl/optionImages/solutionImageUrl) payload uchun saqlanadi,
            // signed preview'lar (imagePreviewUrl/optionImagePreviews/solutionImagePreviewUrl) ko'rsatish uchun
            setQuestions(detail.questions.length > 0
                ? detail.questions.map(question => ({
                    ...question,
                    uid: nextQuestionUid(),
                    imagePreviewUrl: question.imagePreviewUrl ?? null,
                    optionImages: question.optionImages ?? undefined,
                    optionImagePreviews: question.optionImagePreviews ?? undefined,
                    solutionImageUrl: question.solutionImageUrl ?? null,
                    solutionImagePreviewUrl: question.solutionImagePreviewUrl ?? null
                }))
                : [createEmptyQuestion()])
            setTab('create')
            setMsg('')
            setAiFile(null)
            setAiDone(false)
            if (fileInputRef.current) fileInputRef.current.value = ''

            if (asClone || detail.attemptsCount > 0) {
                setEditingTestId(null)
                setCloneMode(true)
                setEditingSourceTitle(detail.title)
                setMsg(detail.attemptsCount > 0
                    ? 'Bu testda urinishlar bor. Xavfsizlik uchun nusxa rejimi ochildi — saqlasangiz yangi test yaratiladi.'
                    : 'Nusxa rejimi ochildi — o\'zgartirib yangi test sifatida saqlaysiz.')
            } else {
                setEditingTestId(detail.id)
                setEditingSourceTitle(detail.title)
                setCloneMode(false)
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Test yuklanmadi'
            toast.error(message)
        } finally {
            setLoadingEditor(false)
        }
    }

    async function openAttemptDetail(testId: string, attemptId: string) {
        setSelectedAttemptId(attemptId)
        setAttemptDetail(null)
        setAttemptDetailError('')
        setLoadingAttemptDetail(true)
        try {
            const detail = await fetchApi(`/tests/${testId}/attempts/${attemptId}/detail`) as AttemptDetailResponse
            setAttemptDetail(detail)
        } catch (error) {
            setAttemptDetailError(error instanceof Error ? error.message : 'Urinish yuklanmadi')
        } finally {
            setLoadingAttemptDetail(false)
        }
    }

    // Faylni serverga yuklaydi (compress qilingan yoki original). Xatoni YUQORIGA uzatadi
    // (handleImageUpload uni toast bilan ko'rsatadi) — avval catch ichida qayta chaqirilib,
    // ikkinchi xato JIM yo'qolardi.
    // Savol INDEKS emas, uid orqali topiladi — yuklash async, orada savol o'chirilsa
    // indekslar suriladi va rasm noto'g'ri savolga yozilardi (variant/yechim yo'llari kabi)
    async function uploadQuestionImage(uid: string, file: File): Promise<void> {
        const formData = new FormData()
        formData.append('image', file)
        const uploaded = await uploadFile('/tests/upload-image', formData)
        if (!uploaded?.imageUrl) throw new Error('Server rasm manzilini qaytarmadi')
        setQuestions(prev => prev.map(q => q.uid === uid ? {
            ...q,
            imageUrl: uploaded.imageUrl,
            imagePreviewUrl: uploaded.url || q.imagePreviewUrl, // signed URL kelmasa lokal preview qoladi
        } : q))
    }

    // Rasmni JPEG'ga compress qiladi (max 1200px). Xato bo'lsa null — chaqiruvchi originalni yuboradi.
    async function compressImage(file: File): Promise<File | null> {
        try {
            const bitmap = await createImageBitmap(file)
            const MAX_DIM = 1200
            const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
            const w = Math.round(bitmap.width * scale)
            const h = Math.round(bitmap.height * scale)
            const canvas = document.createElement('canvas')
            canvas.width = w
            canvas.height = h
            const ctx = canvas.getContext('2d')
            if (!ctx) return null
            ctx.drawImage(bitmap, 0, 0, w, h)
            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
            return blob ? new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' }) : null
        } catch { return null }
    }

    async function handleImageUpload(uid: string, file: File) {
        const MAX_SIZE = 10 * 1024 * 1024 // 10MB
        if (!file.type.startsWith('image/')) { toast.error('Faqat rasm fayllari (PNG, JPG) qo\'yiladi'); return }
        if (file.size > MAX_SIZE) { toast.error('Rasm hajmi 10MB dan oshmasligi kerak'); return }

        // 1) DARROV lokal preview ko'rsatamiz (xira, spinner bilan) — o'qituvchi yuklanayotganini KO'RADI
        const localPreview = URL.createObjectURL(file)
        setQuestions(prev => prev.map(q => q.uid === uid
            ? { ...q, imagePreviewUrl: localPreview, imageUploading: true }
            : q))

        // 2) Compress (ixtiyoriy) → yuklash. Compress bo'lmasa original bilan urinamiz.
        const compressed = await compressImage(file)
        try {
            await uploadQuestionImage(uid, compressed || file)
        } catch (e: any) {
            // Xato — endi JIM emas: aniq sabab ko'rsatiladi (masalan S3 sozlanmagan bo'lsa)
            setQuestions(prev => prev.map(q => q.uid === uid
                ? { ...q, imagePreviewUrl: null, imageUploading: false }
                : q))
            URL.revokeObjectURL(localPreview)
            const reason = e?.status === 401 ? 'ruxsat tugagan — qayta kiring'
                : e?.status === 403 ? 'faqat o\'qituvchi/admin rasm yuklaydi'
                : e?.data?.error || e?.message || 'server xatosi'
            toast.error(`Rasm yuklanmadi: ${reason}`)
            return
        }
        // 3) Muvaffaqiyat — spinnerni o'chiramiz (imagePreviewUrl uploadQuestionImage ichida signed URL bo'ldi)
        setQuestions(prev => prev.map(q => q.uid === uid ? { ...q, imageUploading: false } : q))
        URL.revokeObjectURL(localPreview)
    }

    // Variant/yechim rasmlari uchun umumiy klient-tomon tekshiruv (faqat rasm, ≤10MB)
    function validateImageFile(file: File): boolean {
        if (!file.type.startsWith('image/')) { toast.error('Faqat rasm fayllari (PNG, JPG) qo\'yiladi'); return false }
        if (file.size > 10 * 1024 * 1024) { toast.error('Rasm hajmi 10MB dan oshmasligi kerak'); return false }
        return true
    }

    // Yuklash xatosining sababini o'qituvchiga tushunarli matnga aylantiradi
    function uploadErrorReason(e: unknown): string {
        const err = e as { status?: number; data?: { error?: string } | null; message?: string }
        if (err?.status === 401) return 'ruxsat tugagan — qayta kiring'
        if (err?.status === 403) return 'faqat o\'qituvchi/admin rasm yuklaydi'
        return err?.data?.error || err?.message || 'server xatosi'
    }

    // Compress → serverga yuklash. ref ('s3key:' — payload uchun) + preview (signed URL) qaytaradi
    async function uploadImageToServer(file: File): Promise<{ ref: string; preview: string | null }> {
        const compressed = await compressImage(file)
        const formData = new FormData()
        formData.append('image', compressed || file)
        const uploaded = await uploadFile('/tests/upload-image', formData)
        if (!uploaded?.imageUrl) throw new Error('Server rasm manzilini qaytarmadi')
        return { ref: uploaded.imageUrl, preview: uploaded.url || null }
    }

    // Variant (option) rasmini yuklaydi. Savol INDEKS emas, uid orqali topiladi —
    // yuklash async, orada savol o'chirilsa indekslar suriladi va noto'g'ri savolga yozilardi
    async function handleOptionImageUpload(uid: string, oi: number, file: File) {
        if (!validateImageFile(file)) return
        setQuestions(prev => prev.map(q => q.uid === uid ? { ...q, optionImageUploading: oi } : q))
        try {
            const { ref, preview } = await uploadImageToServer(file)
            setQuestions(prev => prev.map(q => {
                if (q.uid !== uid) return q
                // Massivlar options bilan indeks-mos bo'lishi shart — uzunlikni tenglashtiramiz
                const optionImages = q.options.map((_, j) => q.optionImages?.[j] ?? null)
                const optionImagePreviews = q.options.map((_, j) => q.optionImagePreviews?.[j] ?? null)
                if (oi < optionImages.length) {
                    optionImages[oi] = ref
                    optionImagePreviews[oi] = preview
                }
                return { ...q, optionImages, optionImagePreviews, optionImageUploading: null }
            }))
        } catch (e) {
            setQuestions(prev => prev.map(q => q.uid === uid ? { ...q, optionImageUploading: null } : q))
            toast.error(`Variant rasmi yuklanmadi: ${uploadErrorReason(e)}`)
        }
    }

    function removeOptionImage(uid: string, oi: number) {
        setQuestions(prev => prev.map(q => {
            if (q.uid !== uid) return q
            const optionImages = q.options.map((_, j) => (j === oi ? null : q.optionImages?.[j] ?? null))
            const optionImagePreviews = q.options.map((_, j) => (j === oi ? null : q.optionImagePreviews?.[j] ?? null))
            return { ...q, optionImages, optionImagePreviews }
        }))
    }

    // Yechim rasmini yuklaydi (o'quvchiga test topshirilgandan keyin ko'rsatiladi)
    async function handleSolutionImageUpload(uid: string, file: File) {
        if (!validateImageFile(file)) return
        setQuestions(prev => prev.map(q => q.uid === uid ? { ...q, solutionImageUploading: true } : q))
        try {
            const { ref, preview } = await uploadImageToServer(file)
            setQuestions(prev => prev.map(q => q.uid === uid
                ? { ...q, solutionImageUrl: ref, solutionImagePreviewUrl: preview, solutionImageUploading: false }
                : q))
        } catch (e) {
            setQuestions(prev => prev.map(q => q.uid === uid ? { ...q, solutionImageUploading: false } : q))
            toast.error(`Yechim rasmi yuklanmadi: ${uploadErrorReason(e)}`)
        }
    }

    function removeSolutionImage(uid: string) {
        setQuestions(prev => prev.map(q => q.uid === uid
            ? { ...q, solutionImageUrl: null, solutionImagePreviewUrl: null }
            : q))
    }

    function updateQ(idx: number, field: string, value: any) {
        setQuestions(prev => prev.map((q, i) => {
            if (i !== idx) return q
            if (field === 'text') return { ...q, text: value }
            if (field === 'imageUrl') return { ...q, imageUrl: value, imagePreviewUrl: value ? q.imagePreviewUrl : null }
            if (field === 'imagePreviewUrl') return { ...q, imagePreviewUrl: value }
            if (field === 'correctIdx') return { ...q, correctIdx: value }
            if (field === 'correctText') return { ...q, correctText: value }
            if (field === 'blockType') {
                const blockType = value as DtmBlockTypeValue
                return { ...q, blockType, coefficient: getDefaultCoefficient(blockType) }
            }
            if (field === 'coefficient') {
                const parsed = Number(value)
                return { ...q, coefficient: Number.isFinite(parsed) && parsed > 0 ? parsed : q.coefficient ?? 0 }
            }
            if (field === 'questionType') {
                return {
                    ...q,
                    questionType: value,
                    matchingAnswers: q.matchingAnswers || ['', '', '', '', '', ''],
                    matchingSubQuestions: q.matchingSubQuestions || [{ text: '', correctIdx: 0 }],
                    multipartSubQuestions: q.multipartSubQuestions?.length ? q.multipartSubQuestions : createDefaultMultipartSubQuestions()
                }
            }
            if (field.startsWith('opt')) {
                const oi = parseInt(field.replace('opt', ''))
                const newOptions = [...q.options]
                newOptions[oi] = value
                return { ...q, options: newOptions }
            }
            // Matching: answer bank
            if (field.startsWith('matchingAnswer_')) {
                const ai = parseInt(field.replace('matchingAnswer_', ''))
                const newAnswers = [...(q.matchingAnswers || ['', '', '', '', '', ''])]
                newAnswers[ai] = value
                return { ...q, matchingAnswers: newAnswers }
            }
            // Matching: sub-question fields (matchingSubQ_{si}_text / matchingSubQ_{si}_correctIdx)
            if (field.startsWith('matchingSubQ_')) {
                const parts = field.split('_')
                const si = parseInt(parts[1])
                const subField = parts[2]
                const newSubs = [...(q.matchingSubQuestions || [])]
                newSubs[si] = { ...newSubs[si], [subField]: subField === 'correctIdx' ? parseInt(value) : value }
                return { ...q, matchingSubQuestions: newSubs }
            }
            if (field === 'addMatchingSubQ') {
                return { ...q, matchingSubQuestions: [...(q.matchingSubQuestions || []), { text: '', correctIdx: 0 }] }
            }
            if (field.startsWith('removeMatchingSubQ_')) {
                const si = parseInt(field.replace('removeMatchingSubQ_', ''))
                return { ...q, matchingSubQuestions: (q.matchingSubQuestions || []).filter((_, ii) => ii !== si) }
            }
            if (field.startsWith('multipartSubQ_')) {
                const parts = field.split('_')
                const si = parseInt(parts[1])
                const subField = parts[2] as 'text' | 'correctText' | 'label'
                const newSubs = [...(q.multipartSubQuestions || createDefaultMultipartSubQuestions())]
                newSubs[si] = { ...newSubs[si], [subField]: value }
                return { ...q, multipartSubQuestions: newSubs }
            }
            if (field === 'addMultipartSubQ') {
                const currentSubs = q.multipartSubQuestions || createDefaultMultipartSubQuestions()
                const nextLabel = String.fromCharCode(65 + currentSubs.length)
                return { ...q, multipartSubQuestions: [...currentSubs, { label: nextLabel, text: '', correctText: '' }] }
            }
            if (field.startsWith('removeMultipartSubQ_')) {
                const si = parseInt(field.replace('removeMultipartSubQ_', ''))
                const remaining = (q.multipartSubQuestions || []).filter((_, ii) => ii !== si)
                return {
                    ...q,
                    multipartSubQuestions: remaining.map((subQuestion, subIndex) => ({
                        ...subQuestion,
                        label: String.fromCharCode(65 + subIndex)
                    }))
                }
            }
            return q
        }))
    }

    function removeQ(idx: number) {
        setQuestions(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx))
    }

    async function generateFromFile() {
        if (!aiFile) return
        // Klient-tomon tekshiruv — backend qabul qiladigan turlar (PDF, Word, rasm) va multer 20MB limiti bilan mos
        const fileError = aiFileError(aiFile)
        if (fileError) { setAiError(fileError); return }
        setAiGenerating(true); setAiError(''); setAiDone(false)
        try {
            const formData = new FormData()
            formData.append('file', aiFile)
            formData.append('subject', subject)
            // uploadFile — auth/xato boshqaruvi upload-image bilan bir xil bo'lsin
            const data = await uploadFile('/tests/generate-from-file', formData)
            const mapped: Question[] = data.questions.map((q: any) => {
                // Moslashtirish (matching) savol
                if (q.questionType === 'matching') {
                    const matchingAnswers = (q.answers || []).map(String).slice(0, 6)
                    while (matchingAnswers.length < 2) matchingAnswers.push('')
                    // BUG-7: correctIdx ni slice qilingan answers uzunligiga clamp qilish
                    const maxIdx = matchingAnswers.length - 1
                    const matchingSubQuestions = (q.subQuestions || []).map((sq: any) => ({
                        text: String(sq.text || ''),
                        correctIdx: typeof sq.correctIdx === 'number' ? Math.max(0, Math.min(sq.correctIdx, maxIdx)) : 0
                    }))
                    return {
                        uid: nextQuestionUid(),
                        text: q.text || '',
                        options: ['', '', '', ''],
                        correctIdx: -1,
                        questionType: 'matching' as const,
                        correctText: '',
                        matchingAnswers,
                        matchingSubQuestions,
                        blockType: 'SPECIALTY_1',
                        coefficient: 3.1
                    }
                }
                // MCQ savol — blok importi bilan BIR XIL mapper (indeks/clamp qoidalari yagona)
                return mapAiMcqQuestion(q, 'SPECIALTY_1', 3.1)
            })

            // Bu karta DTM_BLOCK'da ko'rinmaydi (u yerda blok importi ishlaydi) — DTM normalizatsiya kerak emas
            setQuestions(mapped.length > 0 ? mapped : [createEmptyQuestion()])
            setAiDone(true)
            if (!title) setTitle(`${subject} testi`)
            if (data.truncated) {
                setAiError('Fayl katta bo\'lgani uchun AI uni bo\'lib-bo\'lib tahlil qildi. Natijalarni tekshirib chiqing.')
            }
        } catch (e: any) {
            setAiError(e.message || 'AI test yarata olmadi')
        }
        setAiGenerating(false)
    }

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        if (loading) return

        // Rasm hali yuklanayotganda saqlansa, test rasmsiz ketardi — kutamiz
        const uploadingImages = questions.some(q => q.imageUploading || q.optionImageUploading != null || q.solutionImageUploading)
        if (uploadingImages) {
            setMsg('Rasm hali yuklanmoqda — tugashini kutib, qayta saqlang')
            return
        }

        // Xato xabarida o'qituvchi ko'rgan raqam chiqsin: DTM'da "1-ixtisoslik 5-savol", oddiyda "Savol 5"
        const questionLabel = (i: number) => {
            if (testType !== 'DTM_BLOCK') return `Savol ${i + 1}`
            const blockType = questions[i]?.blockType
            const option = DTM_BLOCK_OPTIONS.find(item => item.value === blockType)
            if (!option) return `Savol ${i + 1}`
            const position = questions.slice(0, i + 1).filter(item => item.blockType === blockType).length
            return `${option.label}, ${position}-savol`
        }

        // Auto-fill empty options or text if there's an image
        const finalQuestions = questions.map(q => {
            if (q.questionType === 'open') {
                // optionImages faqat MCQ uchun — tur almashtirilgan bo'lsa eski massiv yuborilmasin
                return { ...q, text: q.text?.trim() || (q.imageUrl ? ' ' : ''), options: [], correctIdx: -1, optionImages: undefined }
            }
            if (q.questionType === 'multipart_open') {
                const multipartPayload = {
                    subQuestions: (q.multipartSubQuestions || []).map(subQuestion => ({
                        label: subQuestion.label,
                        text: subQuestion.text,
                        correctText: subQuestion.correctText
                    }))
                }
                return { ...q, text: q.text?.trim() || (q.imageUrl ? ' ' : ''), options: JSON.stringify(multipartPayload) as any, correctIdx: -1, optionImages: undefined }
            }
            if (q.questionType === 'matching') {
                // Serialize matching data into options JSON
                const matchingPayload = {
                    answers: q.matchingAnswers || [],
                    subQuestions: q.matchingSubQuestions || []
                }
                return { ...q, text: q.text?.trim() || (q.imageUrl ? ' ' : ''), options: JSON.stringify(matchingPayload) as any, correctIdx: -1, optionImages: undefined }
            }
            const newOpts = [...(q.options || ['', '', '', ''])]
            for (let j = 0; j < 4; j++) {
                if (!newOpts[j].trim() && q.imageUrl) {
                    newOpts[j] = String.fromCharCode(65 + j)
                }
            }
            // optionImages options bilan indeks-mos qoladi: newOpts tartibi q.options bilan bir xil,
            // faqat bo'sh matnlar to'ldiriladi. Uzunlikni baribir tenglashtirib yuboramiz.
            const alignedOptionImages = q.optionImages ? newOpts.map((_, j) => q.optionImages?.[j] ?? null) : undefined
            return { ...q, text: q.text?.trim() || (q.imageUrl ? ' ' : ''), options: newOpts, optionImages: alignedOptionImages }
        })

        for (let i = 0; i < finalQuestions.length; i++) {
            if (!finalQuestions[i].text?.trim() && !finalQuestions[i].imageUrl) { setMsg(`${questionLabel(i)} matni bo'sh`); return }
            if (finalQuestions[i].questionType === 'open') continue
            if (finalQuestions[i].questionType === 'multipart_open') {
                let multipartPayload: { subQuestions?: MultipartOpenSubQ[] } = {}
                try { multipartPayload = JSON.parse(finalQuestions[i].options as any) } catch { }
                const subQuestions = multipartPayload.subQuestions || []
                if (subQuestions.length < 2) { setMsg(`Savol ${i + 1}: kamida 2 ta bo'lim bo'lishi kerak`); return }
                for (let si = 0; si < subQuestions.length; si++) {
                    if (!subQuestions[si].text?.trim()) { setMsg(`Savol ${i + 1}, bo'lim ${subQuestions[si].label || String.fromCharCode(65 + si)} matni bo'sh`); return }
                    if (!subQuestions[si].correctText?.trim()) { setMsg(`Savol ${i + 1}, bo'lim ${subQuestions[si].label || String.fromCharCode(65 + si)} uchun to'g'ri javob bo'sh`); return }
                }
                continue
            }
            if (finalQuestions[i].questionType === 'matching') {
                // Matching validatsiyasi
                let mp: any = {}
                try { mp = JSON.parse(finalQuestions[i].options as any) } catch { }
                const nonEmptyAnswers = (mp.answers || []).filter((a: string) => a.trim().length > 0)
                if (nonEmptyAnswers.length < 2) { setMsg(`Savol ${i + 1}: kamida 2 ta javob varianti to'ldirilishi kerak`); return }
                const subs: any[] = mp.subQuestions || []
                if (subs.length === 0) { setMsg(`Savol ${i + 1}: kamida 1 ta kichik savol bo'lishi kerak`); return }
                for (let si = 0; si < subs.length; si++) {
                    if (!subs[si].text?.trim()) { setMsg(`Savol ${i + 1}, kichik savol ${si + 1} matni bo'sh`); return }
                    // correctIdx — FULL answers array indeksi (0-5), nonEmptyAnswers.length EMAS!
                    if (!mp.answers?.[subs[si].correctIdx]?.trim()) { setMsg(`Savol ${i + 1}, kichik savol ${si + 1}: to'g'ri javob bo'sh yoki tanlanmagan`); return }
                }
                continue
            }
            for (let j = 0; j < 4; j++) {
                if (!finalQuestions[i].options[j]?.trim()) { setMsg(`${questionLabel(i)}, variant ${String.fromCharCode(65 + j)} bo'sh`); return }
            }
        }

        if (testType === 'DTM_BLOCK') {
            const finalDtmStats = getDtmControlStats(finalQuestions as Question[])
            if (finalDtmStats.total > DTM_OFFICIAL_QUESTION_TOTAL) {
                setMsg(`DTM blok testida eng ko'pi bilan ${DTM_OFFICIAL_QUESTION_TOTAL} ta savol bo'lishi kerak`)
                return
            }
            const overLimitBlock = finalDtmStats.overLimit[0]
            if (overLimitBlock) {
                setMsg(`${overLimitBlock.label} bloki ${overLimitBlock.target} savoldan oshmasligi kerak`)
                return
            }
            if (finalDtmStats.hasSpecialty2 && !subject2) {
                setMsg('2-ixtisoslik savollari bor — 2-fanni tanlang')
                return
            }
            if (finalDtmStats.officialMismatch) {
                setMsg('Rasmiy 90 savollik DTM testda taqsimot 10+10+10+30+30 bo‘lishi kerak')
                return
            }
        }
        setLoading(true); setMsg('')
        // DTM'da savollar rasmiy blok tartibida yuboriladi (orderIdx massivdan olinadi) —
        // o'quvchi testni Ona tili → Matematika → Tarix → Ixtisoslik tartibida ko'radi.
        // Barqaror sort: blok ichidagi tartib o'zgarmaydi.
        const payloadQuestions = testType === 'DTM_BLOCK'
            ? [...finalQuestions].sort((a, b) => (DTM_BLOCK_RANK[a.blockType || ''] ?? 9) - (DTM_BLOCK_RANK[b.blockType || ''] ?? 9))
            : finalQuestions
        try {
            await fetchApi(editingTestId ? `/tests/${editingTestId}` : '/tests/create', {
                method: editingTestId ? 'PATCH' : 'POST',
                body: JSON.stringify({
                    title,
                    subject,
                    subject2: testType === 'DTM_BLOCK' ? subject2 || null : null,
                    isPublic,
                    testType,
                    source,
                    premium,
                    timeLimit: timeLimit || null,
                    // uid va boshqa klient-only maydonlar API ga yuborilmaydi
                    // (optionImages va solutionImageUrl — 's3key:' ref'lar — payloadda QOLADI)
                    questions: payloadQuestions.map(({
                        uid: _uid,
                        imagePreviewUrl: _preview,
                        imageUploading: _uploading,
                        optionImagePreviews: _optPreviews,
                        optionImageUploading: _optUploading,
                        solutionImagePreviewUrl: _solPreview,
                        solutionImageUploading: _solUploading,
                        ...apiQuestion
                    }) => apiQuestion)
                })
            })
            setMsg('success')
            // Teacher public test admin tasdig'igacha o'quvchilarga ko'rinmaydi — buni ochiq aytamiz,
            // aks holda "joyladim, lekin chiqmayapti" bo'lib tuyuladi
            if (isPublic && user?.role !== 'ADMIN') {
                toast.success('Test saqlandi — admin tasdig\'idan so\'ng o\'quvchilarga ko\'rinadi', { duration: 6000 })
            }
            // Muvaffaqiyatli saqlandi — qoralama endi kerak emas
            localStorage.removeItem(teacherDraftKey)
            setDraftMeta(null)
            setTitle('')
            setQuestions([createEmptyQuestion()])
            setTimeLimit(0)
            setTimeLimitTouched(false)
            setIsPublic(false)
            setTestType('REGULAR')
            setSource('UNOFFICIAL')
            setPremium(false)
            setSubject2('')
            resetEditorState()
            setAiFile(null); setAiDone(false)
            // fileInput ni tozalash — bir xil faylni qayta yuklash mumkin bo'lsin
            if (fileInputRef.current) fileInputRef.current.value = ''
            setTab('list'); loadTests()
        } catch (e: any) { setMsg(e.message) }
        finally { setLoading(false) }
    }

    async function deleteTest(id: string) {
        if (!confirm('Testni o\'chirmoqchimisiz?')) return
        try { await fetchApi(`/tests/${id}`, { method: 'DELETE' }); loadTests() } catch { }
    }

    async function toggleVisibility(testId: string, currentIsPublic: boolean) {
        try {
            const res = await fetchApi(`/tests/${testId}/visibility`, {
                method: 'PATCH',
                body: JSON.stringify({ isPublic: !currentIsPublic })
            })
            if (currentIsPublic) {
                toast.success('Test private qilindi')
            } else if (res?.approved === false) {
                // TEACHER public qilganda backend approved=false qo'yadi — tasdiqqacha o'quvchi ko'rmaydi
                toast.success('Test tasdiqqa yuborildi — admin tasdig\'idan so\'ng o\'quvchilarga ko\'rinadi', { duration: 6000 })
            } else {
                const notified = typeof res?.notified === 'number' ? res.notified : 0
                toast.success(notified > 0
                    ? `Test public qilindi! ${notified} o'quvchiga bildirishnoma yuborildi.`
                    : 'Test ko\'rinishi yangilandi (hozircha o\'quvchi yo\'q)')
            }
            loadTests()
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    function copyLink(shareLink: string, pendingApproval = false) {
        const url = `${window.location.origin}/test/${shareLink}`
        navigator.clipboard.writeText(url)
        setCopied(shareLink)
        setTimeout(() => setCopied(null), 2000)
        // Tasdiqlanmagan public test havolasini o'quvchi ochsa 403 oladi — o'qituvchini ogohlantiramiz
        if (pendingApproval) {
            toast('Havola nusxalandi, lekin test hali tasdiqlanmagan — o\'quvchilar admin tasdig\'idan keyin ocha oladi', { duration: 6000 })
        }
    }

    async function openAnalytics(testId: string) {
        setAnalyticsId(testId)
        setAnalytics(null)
        setAnalyticsError('')
        setLoadingAnalytics(true)
        try {
            setAnalytics(await fetchApi(`/tests/${testId}/analytics`))
        } catch (e: any) {
            setAnalyticsError(e?.message || 'Statistika yuklanmadi')
        } finally {
            setLoadingAnalytics(false)
        }
    }

    function downloadAnalyticsPdf(analytics: any) {
        if (!analytics) return
        const { test, students, questionStats, totalAttempts, avgScore } = analytics

        function gradeColor(score: number) {
            if (score >= 90) return '#15803d'
            if (score >= 80) return '#16a34a'
            if (score >= 70) return '#65a30d'
            if (score >= 60) return '#F15A24'
            if (score >= 50) return '#DA4A12'
            if (score >= 40) return '#dc2626'
            return '#9f1239'
        }
        function rowBg(score: number) {
            if (score >= 90) return '#f0fdf4'
            if (score >= 80) return '#f0fdf4'
            if (score >= 70) return '#fefce8'
            if (score >= 60) return '#FFF1EA'
            if (score >= 50) return '#fff7ed'
            return '#fef2f2'
        }

        const dateStr = test?.createdAt
            ? new Date(test.createdAt).toLocaleDateString('uz-UZ')
            : new Date().toLocaleDateString('uz-UZ')

        const rows = (students || []).map((s: any, i: number) => {
            const ball = typeof s.rawScore === 'number' ? s.rawScore : (s.dtmBall ?? s.score)
            const maxBall = typeof s.scoreMax === 'number' ? s.scoreMax : (s.dtmMax ?? 100)
            const foiz = s.score
            const daraja = s.grade || '—'
            const bg = rowBg(foiz)
            const col = gradeColor(foiz)
            return `<tr style="background:${bg}">
            <td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151">${i + 1}</td>
            <td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;font-weight:500">${escapeHtml(String(s.name ?? ''))}</td>
            <td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700;color:${col}">${escapeHtml(String(ball ?? ''))} / ${escapeHtml(String(maxBall ?? ''))}</td>
            <td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;text-align:center;color:#374151">${escapeHtml(String(foiz ?? ''))}%</td>
            <td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:800;color:${col}">${escapeHtml(String(daraja ?? ''))}</td>
        </tr>`
        }).join('')

        const questionRows = (questionStats || []).map((q: any, i: number) => `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280">${i + 1}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${renderPrintableMath(String(q.text || '—'))}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${escapeHtml(String(q.totalAnswered ?? ''))}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:600;color:${q.errorRate > 50 ? '#dc2626' : q.errorRate > 30 ? '#F15A24' : '#16a34a'}">${escapeHtml(String(q.errorRate ?? ''))}%</td>
        </tr>`).join('')

        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(String(test?.title ?? 'Test'))} — Natijalar</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 28px; color: #111; background: #fff; }
  .header { text-align: center; margin-bottom: 24px; }
  .title { font-size: 17px; font-weight: 700; color: #111; margin-bottom: 4px; }
  .subtitle { color: #6b7280; font-size: 13px; }
  .stats-row { display: flex; gap: 16px; margin-bottom: 20px; justify-content: center; }
  .stat { background: #f3f4f6; padding: 10px 18px; border-radius: 8px; text-align: center; min-width: 100px; }
  .stat-val { font-size: 22px; font-weight: 800; color: #111; }
  .stat-lbl { font-size: 11px; color: #6b7280; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 28px; border-radius: 8px; overflow: hidden; box-shadow: 0 0 0 1px #e5e7eb; }
  thead tr { background: #1e293b; }
  th { color: #fff; padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 600; letter-spacing: 0.5px; }
  th:not(:first-child) { text-align: center; }
  td { font-size: 13px; }
  h2 { font-size: 14px; font-weight: 700; margin: 20px 0 8px; color: #374151; }
  .footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
  @media print { body { padding: 12px; } @page { margin: 1cm; } }
</style>
</head>
<body>
<div class="header">
  <div class="title">${escapeHtml(String(dateStr ?? ''))} imtihon natijalari</div>
  <div class="subtitle">${escapeHtml(String(test?.title ?? 'Test'))} ${test?.subject ? '· ' + escapeHtml(String(test.subject)) : ''} · Jami: ${escapeHtml(String(totalAttempts ?? ''))} o'quvchi</div>
</div>
<div class="stats-row">
  <div class="stat"><div class="stat-val">${escapeHtml(String(totalAttempts ?? ''))}</div><div class="stat-lbl">Ishtirokchi</div></div>
  <div class="stat"><div class="stat-val">${escapeHtml(String(avgScore ?? ''))}%</div><div class="stat-lbl">O'rtacha foiz</div></div>
  <div class="stat"><div class="stat-val">${(students || []).filter((s: any) => s.score >= 70).length}</div><div class="stat-lbl">O'tdi (≥70%)</div></div>
  <div class="stat"><div class="stat-val">${(students || []).filter((s: any) => s.score < 70).length}</div><div class="stat-lbl">O'tmadi</div></div>
</div>

<table>
<thead><tr>
  <th style="width:40px">#</th>
  <th>F.I.SH</th>
  <th style="width:110px">NATIJA</th>
  <th style="width:70px">FOIZ</th>
  <th style="width:80px">DARAJA</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>

<h2>Savollar tahlili (xato foizi bo'yicha)</h2>
<table>
<thead><tr>
  <th style="width:40px">#</th><th>Savol</th><th style="width:90px">Javob berildi</th><th style="width:90px">Xato foizi</th>
</tr></thead>
<tbody>${questionRows}</tbody>
</table>

<div class="footer">DTMMax · dtmmax.uz · ${new Date().toLocaleDateString('uz-UZ')}</div>
</body>
</html>`

        const w = window.open('', '_blank')
        if (!w) { toast.error('Popup bloklangan. Brauzer ruxsat bering.'); return }
        w.document.write(html)
        w.document.close()
        // KaTeX CSS CDN'dan yuklanadi — print undan OLDIN ochilsa formulalar stilsiz chiqadi.
        // Stylesheet load bo'lishini kutamiz; CDN sekin/ishlamasa 2 soniyalik zaxira taymer print'ni baribir ochadi.
        let printed = false
        const doPrint = () => {
            if (printed) return
            printed = true
            try { w.print() } catch { /* oyna yopilgan bo'lsa e'tiborsiz */ }
        }
        const katexCss = w.document.querySelector('link[rel="stylesheet"]') as HTMLLinkElement | null
        if (katexCss && !katexCss.sheet) {
            katexCss.addEventListener('load', () => setTimeout(doPrint, 100))
            katexCss.addEventListener('error', () => doPrint())
            setTimeout(doPrint, 2000)
        } else {
            // CSS allaqachon tayyor (kesh) yoki link topilmadi — qisqa kutish bilan print
            setTimeout(doPrint, 300)
        }
    }

    // Helpers
    const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)' }
    const mutedText = { color: 'var(--text-muted)' }
    const secondaryText = { color: 'var(--text-secondary)' }

    // Yechim rasmi bloki (MCQ va yozma savollar uchun bir xil) — savol uid orqali yangilanadi
    function renderSolutionImageControl(q: Question) {
        const src = displayableImageSrc(q.solutionImagePreviewUrl, q.solutionImageUrl)
        return (
            <div className="mt-2 space-y-1">
                <p className="text-[11px] font-medium" style={secondaryText}>Yechim rasmi (ixtiyoriy)</p>
                <p className="text-[10px]" style={mutedText}>O'quvchiga test topshirilgandan keyin ko'rsatiladi</p>
                {q.solutionImageUploading ? (
                    <div className="flex items-center gap-1.5 text-[11px]" style={mutedText}>
                        <div className="h-3.5 w-3.5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
                        Yuklanmoqda...
                    </div>
                ) : (src || q.solutionImageUrl) ? (
                    <div className="relative inline-block">
                        <img src={src || ''} alt="Yechim rasmi" className="max-h-16 rounded border" style={{ borderColor: 'var(--border)' }} />
                        <button type="button" onClick={() => removeSolutionImage(q.uid)}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition shadow-md">
                            <X className="h-2.5 w-2.5" />
                        </button>
                    </div>
                ) : (
                    <label className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border cursor-pointer transition text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }} title="Yechim rasmini yuklash">
                        <input type="file" accept="image/*" className="hidden" onChange={e => {
                            if (e.target.files?.[0]) handleSolutionImageUpload(q.uid, e.target.files[0])
                            e.target.value = ''
                        }} />
                        <Image className="h-3.5 w-3.5" style={{ color: 'var(--brand)' }} /> Rasm tanlash
                    </label>
                )}
            </div>
        )
    }

    return (
        <div className="kelviq">
            <div className="h-screen overflow-y-auto w-full" style={{ background: 'var(--bg-page)' }}>
                {/* Header */}
                <header className="sticky top-0 z-40" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
                    <div className="max-w-5xl mx-auto flex items-center justify-between py-2.5 px-5">
                        <div className="flex items-center gap-2">
                            <img src="/dtmmax-logo.png" alt="DtmMax" className="h-8 w-8 rounded-md flex items-center justify-center" style={{ objectFit: 'contain' }} />
                            <span className="text-sm font-bold">DTMMax</span>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)' }}>O'qituvchi</span>
                        </div>
                        <button onClick={() => { logout(); nav('/') }} className="h-7 w-7 flex items-center justify-center rounded-lg transition"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-light)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}>
                            <LogOut className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </header>

                <div className="max-w-5xl mx-auto px-5 py-5">
                    {/* Tabs */}
                    <div className="flex gap-0.5 mb-5 p-0.5 rounded-lg w-fit" style={{ background: 'var(--bg-surface)' }}>
                        <button onClick={() => { setTab('list'); setMsg('') }}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-medium transition"
                            style={tab === 'list' ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : { color: 'var(--text-secondary)' }}>
                            <ClipboardList className="h-3.5 w-3.5" /> Testlarim
                        </button>
                        <button onClick={() => {
                            resetEditorState()
                            setTitle('')
                            setSubject('Matematika')
                            setSubject2('')
                            setIsPublic(false)
                            setTestType('REGULAR')
                            setTimeLimit(0)
                            setTimeLimitTouched(false)
                            setQuestions([createEmptyQuestion()])
                            setTab('create')
                            setMsg('')
                        }}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-medium transition"
                            style={tab === 'create' ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : { color: 'var(--text-secondary)' }}>
                            <Plus className="h-3.5 w-3.5" /> Yangi Test
                        </button>
                    </div>

                    {/* Saqlanmagan qoralama banneri — brauzer yopilib qolgan bo'lsa mehnat tiklanadi */}
                    {draftMeta && !editingTestId && !cloneMode && (
                        <div className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3 flex-wrap" style={{ ...cardStyle, background: 'color-mix(in srgb, var(--info) 6%, transparent)', borderColor: 'color-mix(in srgb, var(--info) 25%, transparent)' }}>
                            <div>
                                <p className="text-[12px] font-semibold" style={secondaryText}>Saqlanmagan qoralama topildi</p>
                                <p className="text-[11px]" style={mutedText}>
                                    "{draftMeta.title}" · {draftMeta.count} savol · {new Date(draftMeta.savedAt).toLocaleString('uz-UZ')}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button type="button" className="btn btn-primary btn-sm" onClick={restoreDraft}>Tiklash</button>
                                <button type="button" className="btn btn-outline btn-sm" onClick={discardDraft}>O'chirish</button>
                            </div>
                        </div>
                    )}

                    {/* Test List */}
                    {tab === 'list' && (
                        <div className="space-y-1.5 anim-up">
                            <div className="flex items-center justify-between mb-1.5">
                                {tests.length > 0 && <p className="text-[11px]" style={mutedText}>{tests.length} ta test</p>}
                                {tests.length === 0 && <span />}
                                <button className="btn btn-outline btn-sm flex items-center gap-1.5"
                                    onClick={() => setShowNotifModal(true)}>
                                    <Bell className="h-4 w-4" />
                                    Xabar yuborish
                                </button>
                            </div>
                            {tests.length === 0 && (
                                <div className="card rounded-xl p-12 text-center">
                                    <ClipboardList className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--border-strong)' }} />
                                    <p className="text-sm mb-2" style={mutedText}>Hozircha testlar yo'q</p>
                                    <button onClick={() => setTab('create')} className="text-[13px] font-medium px-3 py-1.5 rounded-lg transition"
                                        style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}>
                                        Birinchi testni yarating
                                    </button>
                                </div>
                            )}
                            {tests.map(t => (
                                <div key={t.id} className="card px-4 py-3 flex flex-wrap items-center gap-3">
                                    <div className="flex-1 min-w-0 basis-full sm:basis-auto">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <p className="text-[13px] font-medium truncate">{t.title}</p>
                                            {t.isPublic
                                                ? (t.approved === false
                                                    ? <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" title="Admin tasdig'idan so'ng o'quvchilarga ko'rinadi" style={{ color: '#B45309', background: 'color-mix(in srgb, #F59E0B 14%, transparent)' }}>⏳ Tasdiq kutilmoqda</span>
                                                    : <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: 'var(--success)', background: 'var(--success-light)' }}><Globe className="h-2.5 w-2.5" /> Public</span>)
                                                : <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)' }}><Lock className="h-2.5 w-2.5" /> Private</span>}
                                        </div>
                                        <p className="text-[11px]" style={mutedText}>
                                            {t._count?.questions || 0} savol · {t._count?.attempts || 0} urinish · {t.subject}
                                            {t.subject2 ? ` + ${t.subject2}` : ''}
                                            {t.timeLimit ? ` · ⏱ ${t.timeLimit} min` : ''}
                                            {` · ${new Date(t.createdAt).toLocaleDateString('uz-UZ')}`}
                                            {' · '}
                                            <span style={{ color: t.testType === 'DTM_BLOCK' ? 'var(--brand)' : t.testType === 'MILLIY_SERTIFIKAT' ? 'var(--info)' : '#0f766e' }}>
                                                {getTestTypeLabel(t.testType)}
                                            </span>
                                            {t._count?.attempts ? ` · O'rtacha ${t.avgScore}%` : ''}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => startEditing(t.id)}
                                        disabled={loadingEditor}
                                        className="h-7 px-2.5 flex items-center gap-1 rounded-lg text-[11px] font-medium transition flex-shrink-0"
                                        style={{ color: 'var(--brand)', background: 'color-mix(in srgb, var(--brand) 10%, transparent)' }}
                                    >
                                        {t._count?.attempts ? 'Nusxa' : 'Tahrirlash'}
                                    </button>
                                    <button
                                        onClick={() => toggleVisibility(t.id, t.isPublic)}
                                        className="h-7 px-2.5 flex items-center gap-1 rounded-lg text-[11px] font-medium transition flex-shrink-0"
                                        style={t.isPublic
                                            ? { color: 'var(--success)', background: 'var(--success-light)' }
                                            : { color: 'var(--text-muted)', background: 'var(--bg-surface)' }
                                        }
                                        title={t.isPublic ? 'Private qilish' : 'Public qilish'}
                                    >
                                        {t.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                                        {t.isPublic ? 'Public' : 'Private'}
                                    </button>
                                    <button onClick={() => openAnalytics(t.id)} className="h-7 px-2.5 flex items-center gap-1 rounded-lg text-[11px] font-medium transition flex-shrink-0"
                                        style={{ color: 'var(--info)', background: 'var(--info-light)' }}>
                                        <BarChart2 className="h-3 w-3" /> Statistika
                                    </button>
                                    <button onClick={() => copyLink(t.shareLink, t.isPublic && t.approved === false)} className="h-7 px-2.5 flex items-center gap-1 rounded-lg text-[11px] font-medium transition flex-shrink-0"
                                        style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}>
                                        {copied === t.shareLink ? <><Check className="h-3 w-3" style={{ color: 'var(--success)' }} /> Nusxalandi</> : <><Copy className="h-3 w-3" /> Link</>}
                                    </button>
                                    <button onClick={() => deleteTest(t.id)} className="h-7 w-7 flex items-center justify-center rounded-lg transition flex-shrink-0"
                                        style={{ color: 'var(--border-strong)' }}
                                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-light)' }}
                                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--border-strong)'; e.currentTarget.style.background = 'transparent' }}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Create Test */}
                    {tab === 'create' && (
                        <form onSubmit={submit} className="space-y-3 anim-up max-w-2xl">
                            {msg === 'success' && (
                                <div className="text-[13px] px-3 py-2 rounded-lg" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
                                    Test muvaffaqiyatli saqlandi
                                </div>
                            )}
                            {msg && msg !== 'success' && (
                                <div className="text-[13px] px-3 py-2 rounded-lg" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>{msg}</div>
                            )}

                            {/* DTM nazorat — yopishqoq panel: 90 savol orasida ham holat va Saqlash doim ko'z oldida */}
                            {testType === 'DTM_BLOCK' && (
                                <div className="rounded-xl px-3 py-2 space-y-1" style={{ position: 'sticky', top: 58, zIndex: 30, background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.07)' }}>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[12px] font-bold flex-shrink-0" style={{ color: dtmControlStats.officialReady ? 'var(--success)' : 'var(--brand)' }}>
                                            {dtmControlStats.total}/{DTM_OFFICIAL_QUESTION_TOTAL}
                                        </span>
                                        <span className="text-[11px] flex-shrink-0" style={mutedText}>{formatDtmNumber(dtmControlStats.scoreMax)}/{DTM_OFFICIAL_SCORE_TOTAL} ball</span>
                                        <div className="flex gap-1 flex-wrap flex-1 min-w-0">
                                            {dtmControlStats.rows.map(row => {
                                                const isOver = row.count > row.target
                                                const isComplete = row.count === row.target
                                                return (
                                                    <button key={row.value} type="button"
                                                        onClick={() => document.getElementById(`dtm-block-${row.value}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                                        title={`${row.label} bo'limiga o'tish`}
                                                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full transition"
                                                        style={isOver
                                                            ? { color: 'var(--danger)', background: 'var(--danger-light)' }
                                                            : isComplete
                                                                ? { color: 'var(--success)', background: 'var(--success-light)' }
                                                                : { color: 'var(--text-muted)', background: 'var(--bg-surface)' }}>
                                                        {row.shortLabel} {row.count}/{row.target}{isComplete ? ' ✓' : ''}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                        <button type="submit" disabled={loading} className="btn btn-primary btn-sm flex-shrink-0">
                                            {loading ? 'Saqlanmoqda...' : 'Saqlash'}
                                        </button>
                                    </div>
                                    {dtmControlStats.hasSpecialty2 && !subject2 && (
                                        <p className="text-[10px]" style={{ color: 'var(--danger)' }}>2-ixtisoslik savollari bor — "Umumiy ma'lumot"da 2-fanni tanlang.</p>
                                    )}
                                    {dtmControlStats.overLimit.length > 0 && (
                                        <p className="text-[10px]" style={{ color: 'var(--danger)' }}>{dtmControlStats.overLimit[0].label} bloki {dtmControlStats.overLimit[0].target} savoldan oshgan.</p>
                                    )}
                                    {dtmControlStats.officialMismatch && dtmControlStats.overLimit.length === 0 && (
                                        <p className="text-[10px]" style={{ color: 'var(--brand)' }}>90 savollik test rasmiy hisoblanishi uchun taqsimot 10+10+10+30+30 bo'lishi kerak.</p>
                                    )}
                                </div>
                            )}

                            {/* Blok AI import uchun yashirin file input — nishon blok ref orqali sinxron o'qiladi */}
                            <input ref={blockFileInputRef} type="file" accept=".pdf,.docx,image/*" className="hidden"
                                onChange={e => {
                                    const file = e.target.files?.[0]
                                    const target = blockAiTargetRef.current
                                    if (file && target) generateBlockFromFile(target, file)
                                    e.target.value = ''
                                }} />
                            {(editingTestId || cloneMode) && (
                                <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3" style={{ ...cardStyle, background: 'color-mix(in srgb, var(--brand) 5%, transparent)' }}>
                                    <div>
                                        <p className="text-[12px] font-semibold" style={secondaryText}>
                                            {editingTestId ? 'Tahrirlash rejimi' : 'Nusxa rejimi'}
                                        </p>
                                        <p className="text-[11px]" style={mutedText}>
                                            {editingTestId
                                                ? `"${editingSourceTitle}" testini to'g'ridan-to'g'ri yangilayapsiz`
                                                : `"${editingSourceTitle}" asosida yangi test yaratiladi`}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-outline btn-sm"
                                        onClick={() => {
                                            resetEditorState()
                                            setTitle('')
                                            setSubject('Matematika')
                                            setSubject2('')
                                            setIsPublic(false)
                                            setTestType('REGULAR')
                                            setTimeLimit(0)
                                            setTimeLimitTouched(false)
                                            setQuestions([createEmptyQuestion()])
                                            setMsg('')
                                        }}
                                    >
                                        Tozalash
                                    </button>
                                </div>
                            )}

                            {/* Test turi — birinchi va eng muhim */}
                            <div className="rounded-xl p-4" style={cardStyle}>
                                <p className="text-[11px] font-semibold mb-2.5 uppercase tracking-wide" style={mutedText}>Test turi</p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {TEST_TYPES.map(type => (
                                        <button key={type.value} type="button" onClick={() => selectTestType(type.value)}
                                            className="flex flex-col items-start gap-1 py-3 px-4 rounded-xl border-2 transition font-medium text-[13px] text-left"
                                            style={testType === type.value
                                                ? { borderColor: type.accent, background: `color-mix(in srgb, ${type.accent} 10%, transparent)`, color: type.accent }
                                                : { borderColor: 'var(--border)', background: 'transparent', color: 'var(--text-secondary)' }}>
                                            <span className="text-lg">{type.icon}</span>
                                            <span>{type.title}</span>
                                            <span className="text-[10px] font-normal" style={{ color: testType === type.value ? `${type.accent}cc` : 'var(--text-muted)' }}>{type.description}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Umumiy ma'lumot */}
                            <div className="rounded-xl p-4 space-y-2.5" style={cardStyle}>
                                <h3 className="text-[13px] font-semibold" style={secondaryText}>Umumiy ma'lumot</h3>
                                <input placeholder="Test nomi" required value={title} onChange={e => setTitle(e.target.value)}
                                    className="input" />
                                <div className="flex flex-wrap gap-2">
                                    <select value={subject} onChange={e => setSubject(e.target.value)}
                                        className="input" style={{ flex: 1, cursor: 'pointer' }}>
                                        {SUBJECTS.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                    {testType === 'DTM_BLOCK' && (
                                        <select value={subject2} onChange={e => setSubject2(e.target.value)}
                                            className="input" style={{ flex: 1, cursor: 'pointer' }}>
                                            <option value="">2-ixtisoslik</option>
                                            {SUBJECTS.filter(f => f !== subject).map(f => <option key={f} value={f}>{f}</option>)}
                                        </select>
                                    )}
                                    <label className="flex items-center gap-2 text-[13px] cursor-pointer select-none h-9 px-3 rounded-lg transition"
                                        style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
                                        <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-3.5 h-3.5 rounded" style={{ accentColor: 'var(--brand)' }} />
                                        <span>Public</span>
                                    </label>
                                    {user?.role === 'ADMIN' && (
                                        <select value={source} onChange={e => setSource(e.target.value as 'OFFICIAL' | 'UNOFFICIAL' | 'AI_PREDICTION')}
                                            className="h-9 px-3 rounded-lg text-[13px] outline-none"
                                            style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
                                            title="Test manbasi (badge)">
                                            <option value="UNOFFICIAL">Norasmiy</option>
                                            <option value="OFFICIAL">Rasmiy</option>
                                            <option value="AI_PREDICTION">AI bashorat</option>
                                        </select>
                                    )}
                                    {user?.role === 'ADMIN' && (
                                        <label className="flex items-center gap-2 text-[13px] cursor-pointer select-none h-9 px-3 rounded-lg transition"
                                            style={{ border: `1px solid ${premium ? '#B8860B' : 'var(--border)'}`, background: premium ? 'rgba(184,134,11,0.10)' : 'var(--bg-card)', color: premium ? '#B8860B' : 'var(--text-secondary)' }}
                                            title="Premium test — faqat Pro userlar ochadi">
                                            <input type="checkbox" checked={premium} onChange={e => setPremium(e.target.checked)} className="w-3.5 h-3.5 rounded" style={{ accentColor: '#B8860B' }} />
                                            <span>Premium ⭐</span>
                                        </label>
                                    )}
                                </div>
                                {testType === 'DTM_BLOCK' && (
                                    <div className="space-y-2">
                                        <div className="rounded-lg px-3 py-2 text-[11px]" style={{ background: 'color-mix(in srgb, var(--brand) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--brand) 20%, transparent)', color: 'var(--text-secondary)' }}>
                                            Savollar 5 ta blok bo'limiga bo'lingan — blok turi va koeffitsient bo'limdan avtomatik keladi. Har bo'limga alohida AI import qilsa bo'ladi.
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={applyOfficialDtmTemplate}
                                                className="btn btn-outline btn-sm"
                                            >
                                                Rasmiy 90 savollik shablon
                                            </button>
                                            <span className="text-[11px] self-center" style={mutedText}>10 + 10 + 10 + 30 + 30 blok</span>
                                        </div>
                                        <p className="text-[11px]" style={mutedText}>Qisqa test ham saqlanadi (mashq sifatida). Rasmiy blok uchun 90 savol to'liq bo'lishi kerak — holat yuqoridagi panelda.</p>
                                    </div>
                                )}
                                {/* Vaqt chegarasi */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[11px] mr-1" style={mutedText}>⏱ Vaqt:</span>
                                    {[0, 30, 45, 60, 90, 180].map(min => (
                                        <button key={min} type="button" onClick={() => { setTimeLimit(min); setTimeLimitTouched(true) }}
                                            className="h-7 px-2.5 rounded-md text-[11px] font-medium transition"
                                            style={timeLimit === min ? { background: 'var(--brand)', color: '#fff' } : { background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                                            {min === 0 ? 'Cheksiz' : `${min} min`}
                                        </button>
                                    ))}
                                    <input type="number" min="1" max="180" placeholder="boshqa (min)"
                                        value={timeLimit > 0 && ![30, 45, 60, 90, 180].includes(timeLimit) ? String(timeLimit) : ''}
                                        onChange={e => {
                                            const val = parseInt(e.target.value)
                                            setTimeLimitTouched(true)
                                            if (!isNaN(val) && val > 0) setTimeLimit(val)
                                            else if (e.target.value === '') setTimeLimit(0)
                                        }}
                                        className="input" style={{ height: '1.75rem', width: '6.5rem', fontSize: '11px', padding: '0 0.5rem' }} />
                                </div>
                            </div>

                            {/* AI bilan yaratish — DTM'da yashirin: u yerda har blokning o'z AI importi bor
                                (global import hamma savolni bitta blokka tiqib, saqlashni buzardi) */}
                            {testType !== 'DTM_BLOCK' && (
                            <div className="rounded-xl p-4 space-y-2.5" style={{ ...cardStyle, borderColor: aiDone ? 'color-mix(in srgb, var(--info) 30%, transparent)' : 'var(--border)' }}>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, var(--info), var(--brand))' }}>
                                        <Sparkles className="h-3 w-3 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-semibold">AI bilan yaratish</p>
                                        <p className="text-[11px]" style={aiDone ? { color: 'var(--info)' } : mutedText}>
                                            {aiDone ? `✨ ${questions.length} ta savol yaratildi` : 'PDF yoki screenshot yuklang — AI savollarni tayyorlaydi'}
                                        </p>
                                    </div>
                                </div>
                                <input ref={fileInputRef} type="file" accept=".pdf,.docx,image/*" className="hidden"
                                    onChange={e => { setAiFile(e.target.files?.[0] || null); setAiError(''); setAiDone(false) }} />
                                <div onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed rounded-lg p-3.5 text-center cursor-pointer transition-colors"
                                    style={aiFile
                                        ? { borderColor: 'color-mix(in srgb, var(--brand) 40%, transparent)', background: 'color-mix(in srgb, var(--brand) 5%, transparent)' }
                                        : { borderColor: 'var(--border)', background: 'transparent' }}>
                                    {aiFile ? (
                                        <div className="flex items-center justify-center gap-2">
                                            {aiFile.type.startsWith('image/') ? <Image className="h-4 w-4" style={{ color: 'var(--brand)' }} /> : <FileText className="h-4 w-4" style={{ color: 'var(--brand)' }} />}
                                            <div className="text-left">
                                                <p className="text-[13px] font-medium truncate max-w-[260px]">{aiFile.name}</p>
                                                <p className="text-[11px]" style={mutedText}>{(aiFile.size / 1024).toFixed(0)} KB · O'zgartirish uchun bosing</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center gap-2.5">
                                            <Upload className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--border-strong)' }} />
                                            <div className="text-left">
                                                <p className="text-[13px]" style={secondaryText}>Screenshot yoki PDF yuklash</p>
                                                <p className="text-[11px]" style={mutedText}>PNG, JPG, PDF · max 20MB</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {aiError && <div className="text-[13px] px-3 py-2 rounded-lg" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>{aiError}</div>}
                                <button type="button" onClick={generateFromFile} disabled={!aiFile || aiGenerating}
                                    style={{ background: 'linear-gradient(90deg, var(--info), var(--brand))' }}
                                    className="w-full h-9 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 transition text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
                                    {aiGenerating
                                        ? <><div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> AI tayyorlamoqda...</>
                                        : <><Sparkles className="h-3.5 w-3.5" /> AI bilan savollar yaratish</>}
                                </button>
                            </div>
                            )}

                            {/* Savollar */}
                            <div className="flex items-center justify-between">
                                <p className="text-[12px] font-semibold" style={secondaryText}>{questions.length} ta savol</p>
                                {aiDone && <span className="text-[11px] px-2 py-0.5 rounded" style={{ color: 'var(--info)', background: 'color-mix(in srgb, var(--info) 10%, transparent)' }}>✨ AI yaratgan</span>}
                            </div>

                            {(() => {
                                // Bitta savol kartasi — tekis ro'yxatda ham, DTM blok bo'limida ham ishlatiladi.
                                // qi — questions massividagi HAQIQIY indeks (updateQ/removeQ shu bilan ishlaydi).
                                const renderQuestionCard = (q: Question, qi: number, displayLabel: string) => (
                                <div key={q.uid} className="rounded-xl p-3.5 space-y-2 transition" style={{ ...cardStyle, borderColor: aiDone ? 'color-mix(in srgb, var(--info) 20%, transparent)' : 'var(--border)' }}
                                    onPaste={(e) => {
                                        const items = e.clipboardData?.items
                                        if (!items) return
                                        for (const item of items) {
                                            if (item.type.startsWith('image/')) {
                                                const file = item.getAsFile()
                                                if (file) {
                                                    e.preventDefault()
                                                    handleImageUpload(q.uid, file)
                                                    break
                                                }
                                            }
                                        }
                                    }}
                                >
                                    {/* Savol header */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <button type="button" onClick={() => toggleQ(q.uid)} className="flex items-center gap-1 text-[12px] font-semibold" style={secondaryText}>
                                                {questions.length > 6 && <span style={{ fontSize: 9 }}>{isQExpanded(q.uid) ? '▾' : '▸'}</span>}
                                                {displayLabel}
                                            </button>
                                            {/* Yopiq kartada holat belgisi — 90 savol ichida to'ldirilmaganini topish oson bo'lsin */}
                                            {!isQExpanded(q.uid) && (() => {
                                                const qDone = Boolean((q.text.trim() || q.imageUrl)
                                                    && (q.questionType !== 'mcq' || q.imageUrl || q.options.every(option => option.trim())))
                                                return (
                                                    <span className="text-[10px] font-bold flex-shrink-0"
                                                        title={qDone ? 'To\'ldirilgan' : 'To\'ldirilmagan'}
                                                        style={{ color: qDone ? 'var(--success)' : 'var(--brand)' }}>
                                                        {qDone ? '✓' : '●'}
                                                    </span>
                                                )
                                            })()}
                                            {!isQExpanded(q.uid) && q.text.trim() && <span className="text-[11px] truncate max-w-[150px]" style={{ color: 'var(--text-muted)' }}>{q.text.trim().slice(0, 38)}</span>}
                                            {/* MCQ / Yozma / Moslashtirish toggle */}
                                            <div className="flex flex-wrap rounded-md overflow-hidden border text-[11px] font-medium" style={{ borderColor: 'var(--border)' }}>
                                                <button type="button" onClick={() => updateQ(qi, 'questionType', 'mcq')}
                                                    className="px-2 py-0.5 transition"
                                                    style={q.questionType === 'mcq' ? { background: 'var(--brand)', color: '#fff' } : { background: 'transparent', color: 'var(--text-muted)' }}>
                                                    A/B/C/D
                                                </button>
                                                {testType !== 'DTM_BLOCK' && (
                                                    <>
                                                        <button type="button" onClick={() => updateQ(qi, 'questionType', 'open')}
                                                            className="px-2 py-0.5 transition"
                                                            style={q.questionType === 'open' ? { background: 'var(--brand)', color: '#fff' } : { background: 'transparent', color: 'var(--text-muted)' }}>
                                                            Yozma
                                                        </button>
                                                        <button type="button" onClick={() => updateQ(qi, 'questionType', 'matching')}
                                                            className="px-2 py-0.5 transition"
                                                            style={q.questionType === 'matching' ? { background: 'var(--info)', color: '#fff' } : { background: 'transparent', color: 'var(--text-muted)' }}>
                                                            Moslashtirish
                                                        </button>
                                                    </>
                                                )}
                                                {testType === 'MILLIY_SERTIFIKAT' && (
                                                    <button type="button" onClick={() => updateQ(qi, 'questionType', 'multipart_open')}
                                                        className="px-2 py-0.5 transition"
                                                        style={q.questionType === 'multipart_open'
                                                            ? { background: '#0f766e', color: '#fff' }
                                                            : { background: 'transparent', color: 'var(--text-muted)' }}>
                                                        Multi-part
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {questions.length > 1 && (
                                            <button type="button" onClick={() => removeQ(qi)} className="h-6 w-6 flex items-center justify-center rounded-md transition"
                                                style={{ color: 'var(--border-strong)' }}
                                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-light)' }}
                                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--border-strong)'; e.currentTarget.style.background = 'transparent' }}>
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                    {isQExpanded(q.uid) && (<>
                                    <div className="relative">
                                        <textarea placeholder="Savol matni ($formula$ yoki \\frac{a}{b} yozsa preview chiqadi)" required={!q.imageUrl} value={q.text} onChange={e => updateQ(qi, 'text', e.target.value)} rows={2}
                                            className="input resize-none w-full pr-12" style={{ height: 'auto', padding: '0.5rem 0.75rem', fontSize: '13px' }} />
                                        <label className={`absolute right-2 top-2 p-1.5 rounded-md transition hover:bg-slate-100 dark:hover:bg-slate-800 ${q.imageUploading ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}
                                            title="Rasm yuklash yoki Ctrl+V (Paste) orqali kiritish">
                                            <input type="file" accept="image/*" className="hidden" disabled={q.imageUploading} onChange={e => {
                                                if (e.target.files?.[0]) handleImageUpload(q.uid, e.target.files[0]);
                                                e.target.value = ''
                                            }} />
                                            {q.imageUploading
                                                ? <div className="h-4 w-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
                                                : <Image className="h-4 w-4" style={{ color: 'var(--brand)' }} />}
                                        </label>
                                    </div>
                                    {(q.imagePreviewUrl || q.imageUrl) && (
                                        <div className="relative inline-block mt-2">
                                            <img src={displayableImageSrc(q.imagePreviewUrl, q.imageUrl) || ''} alt="Savol rasmi" className="max-h-32 rounded-lg border shadow-sm transition-all" style={{ borderColor: 'var(--border)', filter: q.imageUploading ? 'blur(2px) brightness(0.8)' : undefined }} />
                                            {q.imageUploading && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="h-6 w-6 border-2 rounded-full animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                                                </div>
                                            )}
                                            {!q.imageUploading && (
                                                <button type="button" onClick={() => setQuestions(prev => prev.map((question, i) => i === qi ? { ...question, imageUrl: null, imagePreviewUrl: null } : question))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition shadow-md">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    <MathPreview text={q.text} />
                                    {testType === 'DTM_BLOCK' && (
                                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
                                            <div>
                                                <label className="text-[11px] font-medium mb-1 block" style={mutedText}>Blok turi</label>
                                                <select
                                                    value={q.blockType || 'SPECIALTY_1'}
                                                    onChange={event => updateQ(qi, 'blockType', event.target.value)}
                                                    className="input"
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    {DTM_BLOCK_OPTIONS.map(option => (
                                                        <option key={option.value} value={option.value}>{option.label} · {option.coefficient}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-medium mb-1 block" style={mutedText}>Koeffitsient</label>
                                                <input
                                                    type="number"
                                                    min="0.1"
                                                    step="0.1"
                                                    value={q.coefficient ?? getDefaultCoefficient(q.blockType || 'SPECIALTY_1')}
                                                    onChange={event => updateQ(qi, 'coefficient', event.target.value)}
                                                    className="input"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {q.questionType === 'open' ? (
                                        /* Yozma savol uchun to'g'ri javob kirish maydoni */
                                        <div className="mt-1 space-y-1">
                                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>To'g'ri javob variantlari (har bir variantni yangi qatordan yozing):</p>
                                            <textarea
                                                placeholder={`Masalan:\n42\n42 ta\nx=3`}
                                                value={q.correctText || ''}
                                                onChange={e => updateQ(qi, 'correctText', e.target.value)}
                                                rows={4}
                                                className="input w-full text-[13px] resize-none"
                                                style={{ minHeight: 108, padding: '0.7rem 0.85rem', borderColor: 'color-mix(in srgb, var(--success) 40%, transparent)', background: 'color-mix(in srgb, var(--success) 4%, transparent)' }}
                                            />
                                            {q.correctText?.trim() && <p className="text-[10px]" style={{ color: 'var(--success)' }}>Qabul qilinadigan variantlar: {formatAcceptedAnswerHint(q.correctText)}</p>}
                                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Katta-kichik harf farq qilmaydi · Matematik formulalar uchun oddiy yozing: 1/2, sqrt(2) · Har yangi qatordagi matn alohida to'g'ri javob hisoblanadi</p>
                                            {renderSolutionImageControl(q)}
                                        </div>
                                    ) : q.questionType === 'multipart_open' ? (
                                        <div className="space-y-3">
                                            <div className="rounded-lg px-3 py-2 text-[11px]" style={{ background: 'color-mix(in srgb, #0f766e 8%, transparent)', border: '1px solid color-mix(in srgb, #0f766e 20%, transparent)', color: 'var(--text-secondary)' }}>
                                                Bitta umumiy kontekst ostida A, B, C kabi bo'limli yozma savollar uchun.
                                            </div>
                                            <div className="space-y-2">
                                                {(q.multipartSubQuestions || createDefaultMultipartSubQuestions()).map((subQuestion, subIndex) => (
                                                    <div key={subIndex} className="rounded-lg p-3 space-y-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-[11px] font-bold" style={{ color: '#0f766e' }}>{subQuestion.label}) Bo'lim</span>
                                                            {(q.multipartSubQuestions || []).length > 2 && (
                                                                <button type="button"
                                                                    onClick={() => updateQ(qi, `removeMultipartSubQ_${subIndex}`, null)}
                                                                    className="h-6 w-6 flex items-center justify-center rounded-md transition"
                                                                    style={{ color: 'var(--border-strong)' }}
                                                                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-light)' }}
                                                                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--border-strong)'; e.currentTarget.style.background = 'transparent' }}>
                                                                    <Trash2 className="h-3 w-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <textarea
                                                                value={subQuestion.text}
                                                                onChange={e => updateQ(qi, `multipartSubQ_${subIndex}_text`, e.target.value)}
                                                                placeholder={`${subQuestion.label}) Savol matni`}
                                                                className="input w-full resize-none text-[13px]"
                                                                rows={2}
                                                                style={{ padding: '0.45rem 0.7rem' }}
                                                            />
                                                            <MathPreview text={subQuestion.text} />
                                                        </div>
                                                        <textarea
                                                            value={subQuestion.correctText}
                                                            onChange={e => updateQ(qi, `multipartSubQ_${subIndex}_correctText`, e.target.value)}
                                                            placeholder={`${subQuestion.label}) To'g'ri javob variantlari\nMasalan:\n2440\n2 440`}
                                                            rows={4}
                                                            className="input w-full text-[13px] resize-none"
                                                            style={{ minHeight: 108, padding: '0.65rem 0.85rem', borderColor: 'color-mix(in srgb, var(--success) 40%, transparent)', background: 'color-mix(in srgb, var(--success) 4%, transparent)' }}
                                                        />
                                                        {subQuestion.correctText?.trim() && <p className="text-[10px]" style={{ color: 'var(--success)' }}>Variantlar: {formatAcceptedAnswerHint(subQuestion.correctText)}</p>}
                                                    </div>
                                                ))}
                                            </div>
                                            <button type="button"
                                                onClick={() => updateQ(qi, 'addMultipartSubQ', null)}
                                                className="w-full h-8 rounded-lg border-2 border-dashed text-[11px] transition flex items-center justify-center gap-1"
                                                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#0f766e'; e.currentTarget.style.color = '#0f766e' }}
                                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                                                <Plus className="h-3 w-3" /> Bo'lim qo'shish
                                            </button>
                                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Talaba javobni A), B), C) ko'rinishida alohida maydonlarga yozadi. Har bo'lim uchun bir nechta to'g'ri variantni yangi qatordan kiritsa bo'ladi.</p>
                                        </div>
                                    ) : q.questionType === 'matching' ? (
                                        /* Moslashtirish savol uchun UI */
                                        <div className="space-y-3">
                                            {/* A–F answer bank */}
                                            <div>
                                                <p className="text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Javob variantlari (A–F):</p>
                                                <div className="space-y-1.5">
                                                    {(q.matchingAnswers || ['', '', '', '', '', '']).map((ans, ai) => (
                                                        <div key={ai} className="flex items-center gap-2">
                                                            <span className="text-[11px] font-bold w-5 text-right flex-shrink-0" style={{ color: 'var(--info)' }}>{String.fromCharCode(65 + ai)})</span>
                                                            <div className="flex-1 min-w-0">
                                                                <input
                                                                    value={ans}
                                                                    onChange={e => updateQ(qi, `matchingAnswer_${ai}`, e.target.value)}
                                                                    placeholder={`Javob ${String.fromCharCode(65 + ai)}`}
                                                                    className="input flex-1 text-[13px]"
                                                                    style={{ padding: '0.35rem 0.65rem' }}
                                                                />
                                                                <MathPreview text={ans} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            {/* Sub-questions */}
                                            <div>
                                                <p className="text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Kichik savollar:</p>
                                                <div className="space-y-2">
                                                    {(q.matchingSubQuestions || [{ text: '', correctIdx: 0 }]).map((sq, si) => (
                                                        <div key={si} className="flex items-start gap-2 p-2.5 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                                            <span className="text-[11px] font-bold mt-2 flex-shrink-0 w-4" style={{ color: 'var(--text-muted)' }}>{si + 1}.</span>
                                                            <div className="flex-1 space-y-1.5 min-w-0">
                                                                <div>
                                                                    <input
                                                                        value={sq.text}
                                                                        onChange={e => updateQ(qi, `matchingSubQ_${si}_text`, e.target.value)}
                                                                        placeholder={`${si + 1}-kichik savol matni`}
                                                                        className="input w-full text-[13px]"
                                                                        style={{ padding: '0.35rem 0.65rem' }}
                                                                    />
                                                                    <MathPreview text={sq.text} />
                                                                </div>
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>To'g'ri javob:</span>
                                                                    {(q.matchingAnswers || ['', '', '', '', '', '']).map((_, ai) => (
                                                                        <button key={ai} type="button"
                                                                            onClick={() => updateQ(qi, `matchingSubQ_${si}_correctIdx`, ai)}
                                                                            className="w-6 h-6 rounded text-[10px] font-bold transition flex items-center justify-center"
                                                                            style={sq.correctIdx === ai
                                                                                ? { background: 'var(--info)', color: 'white' }
                                                                                : { background: 'var(--bg-muted)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                                                            {String.fromCharCode(65 + ai)}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            {(q.matchingSubQuestions || []).length > 1 && (
                                                                <button type="button"
                                                                    onClick={() => updateQ(qi, `removeMatchingSubQ_${si}`, null)}
                                                                    className="mt-1.5 p-1 rounded flex-shrink-0 transition"
                                                                    style={{ color: 'var(--border-strong)' }}
                                                                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-light)' }}
                                                                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--border-strong)'; e.currentTarget.style.background = 'transparent' }}>
                                                                    <Trash2 className="h-3 w-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                <button type="button"
                                                    onClick={() => updateQ(qi, 'addMatchingSubQ', null)}
                                                    className="mt-2 w-full h-7 rounded-lg border-dashed border-2 text-[11px] transition flex items-center justify-center gap-1"
                                                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--info)'; e.currentTarget.style.color = 'var(--info)' }}
                                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                                                    <Plus className="h-3 w-3" /> Kichik savol qo'shish
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* MCQ variantlari */
                                        <>
                                        <div className="grid grid-cols-2 gap-2">
                                            {q.options.map((o, oi) => (
                                                <div key={oi} className="space-y-1.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <label className="flex flex-1 min-w-0 items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition"
                                                            style={q.correctIdx === oi ? { border: '1px solid color-mix(in srgb, var(--success) 40%, transparent)', background: 'color-mix(in srgb, var(--success) 6%, transparent)' } : { border: '1px solid var(--border)' }}>
                                                            <input type="radio" name={`correct-${q.uid}`} checked={q.correctIdx === oi} onChange={() => updateQ(qi, 'correctIdx', oi)} className="w-3 h-3 flex-shrink-0" style={{ accentColor: 'var(--success)' }} />
                                                            <input placeholder={`Variant ${String.fromCharCode(65 + oi)}`} required={!q.imageUrl} value={o} onChange={e => updateQ(qi, `opt${oi}`, e.target.value)}
                                                                className="flex-1 bg-transparent outline-none text-[13px] min-w-0" />
                                                        </label>
                                                        {/* Variant rasmi: yuklanish holati / yuklash tugmasi (rasm bo'lsa pastda thumbnail) */}
                                                        {q.optionImageUploading === oi ? (
                                                            <div className="flex items-center gap-1 text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                                                                <div className="h-3 w-3 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
                                                                Yuklanmoqda...
                                                            </div>
                                                        ) : !(q.optionImagePreviews?.[oi] || q.optionImages?.[oi]) && (
                                                            <label className="p-1.5 rounded-md cursor-pointer transition flex-shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                                title={`Variant ${String.fromCharCode(65 + oi)} uchun rasm yuklash`}>
                                                                <input type="file" accept="image/*" className="hidden"
                                                                    disabled={q.optionImageUploading != null}
                                                                    onChange={e => {
                                                                        if (e.target.files?.[0]) handleOptionImageUpload(q.uid, oi, e.target.files[0])
                                                                        e.target.value = ''
                                                                    }} />
                                                                <Image className="h-3.5 w-3.5" style={{ color: 'var(--brand)' }} />
                                                            </label>
                                                        )}
                                                    </div>
                                                    {(q.optionImagePreviews?.[oi] || q.optionImages?.[oi]) && (
                                                        <div className="relative inline-block">
                                                            <img src={displayableImageSrc(q.optionImagePreviews?.[oi], q.optionImages?.[oi]) || ''} alt={`Variant ${String.fromCharCode(65 + oi)} rasmi`}
                                                                className="max-h-16 rounded border" style={{ borderColor: 'var(--border)' }} />
                                                            <button type="button" onClick={() => removeOptionImage(q.uid, oi)}
                                                                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition shadow-md">
                                                                <X className="h-2.5 w-2.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                    <MathPreview text={o} />
                                                </div>
                                            ))}
                                        </div>
                                        {renderSolutionImageControl(q)}
                                        </>
                                    )}
                                    {q.questionType !== 'open' && q.questionType !== 'matching' && q.questionType !== 'multipart_open' && (
                                        <p className="text-[10px]" style={{ color: 'var(--border-strong)' }}>
                                            Yashil doira = to&apos;g&apos;ri javob · $formula$ yoki sof LaTeX (masalan: <code>{'\\frac{a}{b}'}</code>) yozsa preview chiqadi
                                        </p>
                                    )}
                                    {q.questionType === 'matching' && <p className="text-[10px]" style={{ color: 'color-mix(in srgb, var(--info) 38%, transparent)' }}>Ko'k = to'g'ri javob · Savol matni = umumiy kontekst (ixtiyoriy)</p>}
                                    </>)}
                                </div>
                                )

                                // Oddiy va Milliy Sertifikat testlari — avvalgidek tekis ro'yxat
                                if (testType !== 'DTM_BLOCK') {
                                    return questions.map((q, qi) => renderQuestionCard(q, qi, `Savol ${qi + 1}`))
                                }

                                // DTM blok test — savollar 5 ta bo'limga guruhlangan, blok turi bo'limdan avtomatik
                                const rows = questions.map((question, index) => ({ question, index }))
                                const knownBlocks = new Set<string>(DTM_BLOCK_OPTIONS.map(option => option.value))
                                const orphanRows = rows.filter(row => !knownBlocks.has(row.question.blockType || ''))
                                return (
                                    <>
                                        {DTM_BLOCK_OPTIONS.map(option => {
                                            const blockRows = rows.filter(row => row.question.blockType === option.value)
                                            const collapsed = collapsedBlocks.has(option.value)
                                            const isOver = blockRows.length > option.target
                                            const isComplete = blockRows.length === option.target
                                            const accent = isOver ? 'var(--danger)' : isComplete ? 'var(--success)' : 'var(--brand)'
                                            return (
                                                <div key={option.value} id={`dtm-block-${option.value}`} className="rounded-xl overflow-hidden"
                                                    style={{ scrollMarginTop: 130, border: `1px solid ${isOver ? 'var(--danger)' : isComplete ? 'color-mix(in srgb, var(--success) 35%, transparent)' : 'var(--border)'}`, background: 'var(--bg-card)' }}>
                                                    <div className="flex items-center gap-2 px-3.5 py-2.5 flex-wrap">
                                                        <button type="button" onClick={() => toggleBlockCollapse(option.value)}
                                                            className="flex items-center gap-1.5 text-[13px] font-semibold flex-1 min-w-0 text-left" style={secondaryText}>
                                                            <span style={{ fontSize: 10 }}>{collapsed ? '▸' : '▾'}</span>
                                                            <span className="truncate">{option.label}</span>
                                                            <span className="text-[11px] font-bold flex-shrink-0" style={{ color: accent }}>{blockRows.length}/{option.target}</span>
                                                            <span className="text-[10px] font-normal flex-shrink-0" style={mutedText}>×{option.coefficient}</span>
                                                        </button>
                                                        <button type="button" disabled={blockAiGenerating !== null}
                                                            onClick={() => { blockAiTargetRef.current = option.value; blockFileInputRef.current?.click() }}
                                                            title={`${option.label} blokiga PDF/rasm/Word'dan savollar import qilish`}
                                                            className="h-7 px-2 rounded-md text-[11px] font-medium transition flex items-center gap-1 flex-shrink-0 disabled:opacity-40"
                                                            style={{ color: 'var(--info)', background: 'color-mix(in srgb, var(--info) 10%, transparent)' }}>
                                                            {blockAiGenerating === option.value
                                                                ? <><div className="h-3 w-3 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--info)', borderTopColor: 'transparent' }} /> AI o'qimoqda...</>
                                                                : <><Sparkles className="h-3 w-3" /> AI import</>}
                                                        </button>
                                                        <button type="button" onClick={() => addQuestionToBlock(option.value)}
                                                            className="h-7 px-2 rounded-md text-[11px] font-medium transition flex items-center gap-1 flex-shrink-0"
                                                            style={{ color: 'var(--brand)', background: 'color-mix(in srgb, var(--brand) 10%, transparent)' }}>
                                                            <Plus className="h-3 w-3" /> Savol
                                                        </button>
                                                    </div>
                                                    <div className="h-0.5" style={{ background: 'var(--bg-surface)' }}>
                                                        <div className="h-full transition-all" style={{ width: `${Math.min(100, Math.round((blockRows.length / option.target) * 100))}%`, background: accent }} />
                                                    </div>
                                                    {!collapsed && (
                                                        <div className="px-2.5 py-2.5 space-y-2">
                                                            {blockRows.length === 0 && (
                                                                <p className="text-[11px] px-1" style={mutedText}>Bu blokda hali savol yo'q — "+ Savol" yoki "AI import" bilan qo'shing.</p>
                                                            )}
                                                            {blockRows.map((row, position) => renderQuestionCard(row.question, row.index, `${position + 1}-savol`))}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                        {orphanRows.length > 0 && (
                                            <div className="rounded-xl p-3 space-y-2" style={{ border: '1px dashed var(--danger)', background: 'var(--bg-card)' }}>
                                                <p className="text-[12px] font-semibold" style={{ color: 'var(--danger)' }}>Blok tanlanmagan savollar — har biriga "Blok turi"ni tanlang, ular tegishli bo'limga o'tadi</p>
                                                {orphanRows.map((row, position) => renderQuestionCard(row.question, row.index, `${position + 1}-savol`))}
                                            </div>
                                        )}
                                    </>
                                )
                            })()}

                            {/* DTM'da savol bo'lim ichidan qo'shiladi (blok turi avtomatik) — global tugma chalkashtirardi */}
                            {testType !== 'DTM_BLOCK' && (
                                <button type="button" onClick={addQuestion}
                                    className="w-full h-9 rounded-xl border-2 border-dashed text-[13px] transition flex items-center justify-center gap-1.5"
                                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                                    <Plus className="h-3.5 w-3.5" /> Savol qo'shish
                                </button>
                            )}
                            <button type="submit" disabled={loading}
                                className="btn btn-primary" style={{ width: '100%', height: '2.5rem' }}>
                                {loading ? 'Saqlanmoqda...' : editingTestId ? `Testni Yangilash (${questions.length} savol)` : `Testni Saqlash (${questions.length} savol)`}
                            </button>
                        </form>
                    )}
                </div>
            </div>

            {/* Notification Modal */}
            {showNotifModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <div className="rounded-2xl w-full max-w-md p-6 shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <h3 className="font-bold text-lg mb-4">Barcha o'quvchilarga xabar yuborish</h3>
                        <div className="space-y-3 mb-5">
                            <div>
                                <label className="text-sm font-medium block mb-1">Sarlavha</label>
                                <input className="input" placeholder="Masalan: Yangi test qo'shildi!"
                                    value={notifForm.title}
                                    onChange={e => setNotifForm(f => ({ ...f, title: e.target.value }))} />
                            </div>
                            <div>
                                <label className="text-sm font-medium block mb-1">Xabar</label>
                                <textarea className="input" rows={4}
                                    placeholder="O'quvchilarga yetkazmoqchi bo'lgan xabaringiz..."
                                    value={notifForm.message}
                                    onChange={e => setNotifForm(f => ({ ...f, message: e.target.value }))} />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button className="btn btn-primary flex-1" onClick={sendNotification} disabled={sendingNotif}>
                                {sendingNotif ? 'Yuborilmoqda...' : 'Yuborish'}
                            </button>
                            <button className="btn btn-outline" onClick={() => setShowNotifModal(false)}>
                                Bekor
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Analytics Modal */}
            {analyticsId && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setAnalyticsId(null); setSelectedAttemptId(null) }}>
                    <div className="rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl" style={{ background: 'var(--bg-card)' }} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                            <div className="flex items-center gap-2.5">
                                <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand)' }}>
                                    <BarChart2 className="h-4 w-4 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-[13px] font-semibold">{analytics?.test?.title || 'Yuklanmoqda...'}</h2>
                                    {analytics && <p className="text-[11px]" style={mutedText}>{analytics.totalAttempts} urinish · O'rtacha: {analytics.avgScore}%</p>}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => downloadAnalyticsPdf(analytics)}
                                    className="btn btn-outline btn-sm flex items-center gap-1.5 mr-2"
                                    style={{ fontSize: '12px' }}
                                >
                                    <FileText className="h-3.5 w-3.5" />
                                    PDF yuklash
                                </button>
                                <button onClick={() => { setAnalyticsId(null); setSelectedAttemptId(null) }} className="h-7 w-7 flex items-center justify-center rounded-lg transition"
                                    style={mutedText}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {loadingAnalytics ? (
                            <div className="flex-1 flex items-center justify-center p-12">
                                <div className="h-5 w-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
                            </div>
                        ) : analyticsError ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                                <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Statistika yuklanmadi</p>
                                <p className="text-[12px] mb-4" style={mutedText}>{analyticsError}</p>
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => analyticsId && openAnalytics(analyticsId)}
                                >
                                    Qayta urinish
                                </button>
                            </div>
                        ) : analytics?.totalAttempts === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                                <Users className="h-8 w-8 mb-2" style={{ color: 'var(--border)' }} />
                                <p className="text-sm" style={mutedText}>Bu testni hali hech kim yechmagan</p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-5 space-y-5 min-h-0">
                                <div className="grid grid-cols-3 gap-2.5">
                                    <div className="rounded-xl p-3 text-center" style={{ background: 'color-mix(in srgb, var(--brand) 10%, transparent)' }}>
                                        <p className="text-xl font-bold" style={{ color: 'var(--brand)' }}>{analytics?.totalAttempts}</p>
                                        <p className="text-[11px] mt-0.5" style={secondaryText}>Jami urinish</p>
                                    </div>
                                    <div className="rounded-xl p-3 text-center" style={{ background: 'color-mix(in srgb, var(--success) 10%, transparent)' }}>
                                        <p className="text-xl font-bold" style={{ color: 'var(--success)' }}>{analytics?.avgScore}%</p>
                                        <p className="text-[11px] mt-0.5" style={secondaryText}>O'rtacha ball</p>
                                    </div>
                                    <div className="rounded-xl p-3 text-center" style={{ background: 'color-mix(in srgb, var(--brand) 10%, transparent)' }}>
                                        <p className="text-xl font-bold" style={{ color: 'var(--brand)' }}>
                                            {analytics?.questionStats ? Math.round(analytics.questionStats.reduce((s: number, q: any) => s + q.errorRate, 0) / (analytics.questionStats.length || 1)) : 0}%
                                        </p>
                                        <p className="text-[11px] mt-0.5" style={secondaryText}>O'rtacha xato</p>
                                    </div>
                                </div>

                                {analytics && analytics.students.length > 0 && (
                                    <div>
                                        <h3 className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={mutedText}>O'quvchilar reytingi</h3>
                                        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                                            <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: '12px' }}>
                                                <thead>
                                                    <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                                                        <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--text-muted)', width: 28 }}>#</th>
                                                        <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--text-muted)' }}>F.I.SH</th>
                                                        <th className="text-center px-2 py-2 font-semibold" style={{ color: 'var(--text-muted)', width: 110 }}>NATIJA</th>
                                                        <th className="text-center px-2 py-2 font-semibold" style={{ color: 'var(--text-muted)', width: 55 }}>FOIZ</th>
                                                        <th className="text-center px-2 py-2 font-semibold" style={{ color: 'var(--text-muted)', width: 60 }}>DARAJA</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {analytics.students.map((s: AnalyticsStudentRow, i: number) => {
                                                        const col = s.score >= 70 ? 'var(--success)' : s.score >= 50 ? 'var(--brand)' : 'var(--danger)'
                                                        const scoreLabel = typeof s.rawScore === 'number' && typeof s.scoreMax === 'number'
                                                            ? `${s.rawScore} / ${s.scoreMax}`
                                                            : `${s.dtmBall ?? s.score}`
                                                        return (
                                                            <tr
                                                                key={s.attemptId}
                                                                style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-surface)', cursor: 'pointer' }}
                                                                onClick={() => openAttemptDetail(analytics.test.id, s.attemptId)}
                                                                title="Batafsil natijani ko'rish"
                                                            >
                                                                <td className="px-3 py-2 font-bold" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                                                                <td className="px-3 py-2">
                                                                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                                                                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{new Date(s.createdAt).toLocaleDateString('uz')}</p>
                                                                </td>
                                                                <td className="px-2 py-2 text-center font-bold" style={{ color: col }}>{scoreLabel}</td>
                                                                <td className="px-2 py-2 text-center" style={{ color: 'var(--text-secondary)' }}>{s.score}%</td>
                                                                <td className="px-2 py-2 text-center font-extrabold" style={{ color: col }}>{s.grade || '—'}</td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {analytics && analytics.questionStats.length > 0 && (
                                    <div>
                                        <h3 className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={mutedText}>Savollar tahlili</h3>
                                        <div className="space-y-2">
                                            {analytics.questionStats.map((q: AnalyticsQuestionStat, i: number) => (
                                                <div key={q.id} className="rounded-xl p-3" style={{ background: 'var(--bg-surface)' }}>
                                                    <div className="flex items-start justify-between gap-2 mb-2.5">
                                                        <p className="text-[12px] flex-1 leading-relaxed">
                                                            {i + 1}. <MathInlineText text={q.text} />
                                                        </p>
                                                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md flex-shrink-0"
                                                            style={q.errorRate >= 60 ? { background: 'color-mix(in srgb, var(--danger) 15%, transparent)', color: 'var(--danger)' } : q.errorRate >= 30 ? { background: 'color-mix(in srgb, var(--brand) 15%, transparent)', color: 'var(--brand)' } : { background: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)' }}>
                                                            {q.errorRate}% xato
                                                        </span>
                                                    </div>
                                                    {q.totalAnswered > 0 ? (
                                                        q.questionType === 'matching' ? (
                                                            <p className="text-[11px]" style={mutedText}>
                                                                Moslashtirish savoli — {q.correctCount}/{q.totalAnswered} to'liq to'g'ri
                                                            </p>
                                                        ) : (
                                                        <div className="grid grid-cols-4 gap-1.5">
                                                            {q.options.map((opt: string, oi: number) => {
                                                                const count = q.optionCounts[oi] || 0
                                                                const pct = Math.round((count / q.totalAnswered) * 100)
                                                                const isCorrect = q.correctIdx === oi
                                                                return (
                                                                    <div key={oi} className="rounded-lg p-2 text-center"
                                                                        style={isCorrect ? { border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)', background: 'color-mix(in srgb, var(--success) 6%, transparent)' } : { border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                                                                        <p className="text-[10px] font-bold mb-0.5" style={isCorrect ? { color: 'var(--success)' } : mutedText}>
                                                                            {String.fromCharCode(65 + oi)}{isCorrect ? ' ✓' : ''}
                                                                        </p>
                                                                        <p className="text-[15px] font-bold" style={isCorrect ? { color: 'var(--success)' } : pct > 0 ? {} : mutedText}>{pct}%</p>
                                                                        <p className="text-[10px]" style={mutedText}>{count} kishi</p>
                                                                        <div className="mt-1 text-[10px] leading-4" style={mutedText}>
                                                                            <MathInlineText text={opt} />
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                        )
                                                    ) : (
                                                        <p className="text-[11px]" style={mutedText}>Hali javob berilmagan</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {selectedAttemptId && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedAttemptId(null)}>
                    <div className="rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl" style={{ background: 'var(--bg-card)' }} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                            <div>
                                <h3 className="text-[14px] font-semibold">{attemptDetail?.student.name || 'Natija tafsiloti'}</h3>
                                {attemptDetail && (
                                    <p className="text-[11px]" style={mutedText}>
                                        {attemptDetail.student.rawScore ?? attemptDetail.student.score} / {attemptDetail.student.scoreMax ?? 100}
                                        {' · '}
                                        {attemptDetail.student.score}%{attemptDetail.student.grade ? ` · ${attemptDetail.student.grade}` : ''}
                                        {' · '}
                                        {new Date(attemptDetail.student.createdAt).toLocaleString('uz-UZ')}
                                    </p>
                                )}
                            </div>
                            <button onClick={() => setSelectedAttemptId(null)} className="h-7 w-7 flex items-center justify-center rounded-lg transition"
                                style={mutedText}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        {loadingAttemptDetail ? (
                            <div className="flex-1 flex items-center justify-center p-12">
                                <div className="h-5 w-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
                            </div>
                        ) : attemptDetailError ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                                <p className="text-sm font-medium mb-1">Natija ochilmadi</p>
                                <p className="text-[12px] mb-4" style={mutedText}>{attemptDetailError}</p>
                                {analyticsId && (
                                    <button className="btn btn-primary btn-sm" onClick={() => openAttemptDetail(analyticsId, selectedAttemptId)}>
                                        Qayta urinish
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-5 space-y-3">
                                {attemptDetail?.questions.map((question, index) => (
                                    <div key={question.id} className="rounded-xl p-4 space-y-2" style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-[12px] font-semibold" style={secondaryText}>
                                                    Savol {index + 1}
                                                </p>
                                                <p className="text-[13px] leading-relaxed">
                                                    <MathInlineText text={question.text} />
                                                </p>
                                            </div>
                                            <span className="text-[11px] font-semibold px-2 py-1 rounded-md"
                                                style={question.isCorrect
                                                    ? { color: 'var(--success)', background: 'color-mix(in srgb, var(--success) 12%, transparent)' }
                                                    : { color: 'var(--danger)', background: 'color-mix(in srgb, var(--danger) 12%, transparent)' }}>
                                                {question.isCorrect ? 'To‘g‘ri' : 'Xato'}
                                            </span>
                                        </div>
                                        {question.details?.length ? (
                                            <div className="space-y-2">
                                                {question.details.map((detail) => (
                                                    <div key={`${question.id}-${detail.label}`} className="rounded-lg px-3 py-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                                        <p className="text-[11px] font-semibold mb-1" style={secondaryText}>{detail.label}. {detail.prompt}</p>
                                                        <p className="text-[11px]" style={mutedText}>Talaba: <span style={{ color: detail.isCorrect ? 'var(--success)' : 'var(--danger)' }}>{detail.studentAnswer}</span></p>
                                                        <p className="text-[11px]" style={mutedText}>To‘g‘ri javob: {detail.correctAnswer}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                                    <p className="text-[10px] uppercase tracking-wide mb-1" style={mutedText}>Talaba javobi</p>
                                                    <p className="text-[12px]"><MathInlineText text={question.studentAnswer || '—'} /></p>
                                                </div>
                                                <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                                    <p className="text-[10px] uppercase tracking-wide mb-1" style={mutedText}>To‘g‘ri javob</p>
                                                    <p className="text-[12px]"><MathInlineText text={question.correctAnswer || '—'} /></p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
