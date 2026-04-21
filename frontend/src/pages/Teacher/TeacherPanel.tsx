import { useState, useEffect, useRef, useMemo } from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { BrainCircuit, Plus, Trash2, LogOut, Copy, Check, Globe, Lock, ClipboardList, Upload, Sparkles, FileText, Image, BarChart2, X, Users, Bell } from 'lucide-react'
import { fetchApi, uploadFile } from '@/lib/api'
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

interface MatchingSubQ { text: string; correctIdx: number }
interface MultipartOpenSubQ { label: string; text: string; correctText: string }
type TestTypeValue = 'REGULAR' | 'DTM_BLOCK' | 'MILLIY_SERTIFIKAT'
type DtmBlockTypeValue = 'GENERIC' | 'MANDATORY_LANGUAGE' | 'MANDATORY_MATH' | 'MANDATORY_HISTORY' | 'SPECIALTY_1' | 'SPECIALTY_2'
interface Question {
    text: string; imageUrl?: string | null; options: string[]; correctIdx: number
    questionType: 'mcq' | 'open' | 'matching' | 'multipart_open'; correctText?: string
    imagePreviewUrl?: string | null
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
    attemptsCount: number
    questions: Question[]
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
    { value: 'DTM_BLOCK', title: 'DTM blok test', description: '189 ball · koeffitsientli bloklar', accent: '#d97706', icon: '🎯' },
    { value: 'MILLIY_SERTIFIKAT', title: 'Milliy Sertifikat', description: 'Rasch modeli · 75 ball', accent: '#8b5cf6', icon: '📋' },
]

const DTM_BLOCK_OPTIONS: Array<{ value: DtmBlockTypeValue; label: string; coefficient: number; target: number }> = [
    { value: 'MANDATORY_LANGUAGE', label: 'Ona tili', coefficient: 1.1, target: 10 },
    { value: 'MANDATORY_MATH', label: 'Majburiy matematika', coefficient: 1.1, target: 10 },
    { value: 'MANDATORY_HISTORY', label: 'O‘zbekiston tarixi', coefficient: 1.1, target: 10 },
    { value: 'SPECIALTY_1', label: '1-ixtisoslik', coefficient: 3.1, target: 30 },
    { value: 'SPECIALTY_2', label: '2-ixtisoslik', coefficient: 2.1, target: 30 },
]

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

function createEmptyQuestion(): Question {
    return {
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
    const { logout } = useAuthStore()
    const [tab, setTab] = useState<'create' | 'list'>('list')
    const [tests, setTests] = useState<TeacherTestListItem[]>([])

    const [title, setTitle] = useState('')
    const [subject, setSubject] = useState('Matematika')
    const [subject2, setSubject2] = useState('')
    const [isPublic, setIsPublic] = useState(false)
    const [testType, setTestType] = useState<TestTypeValue>('REGULAR')
    const [timeLimit, setTimeLimit] = useState<number>(0)
    const [timeLimitTouched, setTimeLimitTouched] = useState(false)
    const [questions, setQuestions] = useState<Question[]>([createEmptyQuestion()])
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

    useEffect(() => { loadTests() }, [])
    useEffect(() => {
        const sendPing = () => fetchApi('/auth/ping', { method: 'POST', body: JSON.stringify({ page: 'teacher' }), silent: true }).catch(() => { })
        sendPing()
        const pingInterval = setInterval(sendPing, 60000)
        return () => clearInterval(pingInterval)
    }, [])
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setAnalyticsId(null)
        }
        window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [])
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
        setSendingNotif(true)
        try {
            const data = await fetchApi('/notifications/send', {
                method: 'POST',
                body: JSON.stringify({ title: notifForm.title, message: notifForm.message })
            })
            toast.success(`${data.sent} ta o'quvchiga yuborildi!`)
            setNotifForm({ title: '', message: '' })
            setShowNotifModal(false)
        } catch (e: any) { toast.error(e.message) }
        finally { setSendingNotif(false) }
    }

    function addQuestion() {
        setQuestions(prev => [
            ...prev,
            testType === 'DTM_BLOCK'
                ? { ...createEmptyQuestion(), questionType: 'mcq', blockType: 'SPECIALTY_1', coefficient: 3.1 }
                : createEmptyQuestion()
        ])
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
            setTimeLimit(detail.timeLimit || 0)
            setTimeLimitTouched(Boolean(detail.timeLimit))
            setQuestions(detail.questions.length > 0 ? detail.questions : [createEmptyQuestion()])
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

    async function uploadQuestionImage(qi: number, file: File) {
        const formData = new FormData()
        formData.append('image', file)
        const uploaded = await uploadFile('/tests/upload-image', formData)
        setQuestions(prev => prev.map((q, i) => i === qi ? {
            ...q,
            imageUrl: uploaded.imageUrl,
            imagePreviewUrl: uploaded.url
        } : q))
    }

    async function handleImageUpload(qi: number, file: File) {
        const MAX_SIZE = 10 * 1024 * 1024 // 10MB
        if (file.size > MAX_SIZE) {
            toast.error('Rasm hajmi 10MB dan oshmasligi kerak')
            return
        }
        try {
            // Canvas orqali compress: max 1200px, JPEG 0.82 — ~100-300KB ga tushadi
            const bitmap = await createImageBitmap(file)
            const MAX_DIM = 1200
            const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
            const w = Math.round(bitmap.width * scale)
            const h = Math.round(bitmap.height * scale)
            const canvas = document.createElement('canvas')
            canvas.width = w
            canvas.height = h
            canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
            const compressedBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
            const uploadableFile = compressedBlob
                ? new File([compressedBlob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' })
                : file
            await uploadQuestionImage(qi, uploadableFile)
        } catch {
            await uploadQuestionImage(qi, file)
        }
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
        setAiGenerating(true); setAiError(''); setAiDone(false)
        try {
            const formData = new FormData()
            formData.append('file', aiFile)
            formData.append('subject', subject)
            const token = localStorage.getItem('token')
            const res = await fetch('/api/tests/generate-from-file', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Xatolik')
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
                // MCQ savol
                let opts = Array.isArray(q.options) ? q.options.map(String).filter((o: string) => o.trim().length > 0) : []
                while (opts.length < 4) opts.push('')
                return {
                    text: q.text || '',
                    options: opts.slice(0, 4),
                    correctIdx: typeof q.correctIdx === 'number' ? q.correctIdx : 0,
                    questionType: 'mcq' as const,
                    correctText: '',
                    blockType: 'SPECIALTY_1',
                    coefficient: 3.1
                }
            })
            const normalizedMapped = testType === 'DTM_BLOCK'
                ? mapped.filter(question => question.questionType === 'mcq').map(question => ({
                    ...question,
                    blockType: 'SPECIALTY_1' as const,
                    coefficient: 3.1
                }))
                : mapped

            setQuestions(normalizedMapped.length > 0 ? normalizedMapped : [createEmptyQuestion()])
            setAiDone(true)
            if (!title) setTitle(`${subject} testi`)
            if (testType === 'DTM_BLOCK' && normalizedMapped.length !== mapped.length) {
                setAiError('DTM blok testida faqat A/B/C/D savollar qoldirildi. Blok turini har savolda tekshiring.')
            }
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

        // Auto-fill empty options or text if there's an image
        const finalQuestions = questions.map(q => {
            if (q.questionType === 'open') {
                return { ...q, text: q.text?.trim() || (q.imageUrl ? ' ' : ''), options: [], correctIdx: -1 }
            }
            if (q.questionType === 'multipart_open') {
                const multipartPayload = {
                    subQuestions: (q.multipartSubQuestions || []).map(subQuestion => ({
                        label: subQuestion.label,
                        text: subQuestion.text,
                        correctText: subQuestion.correctText
                    }))
                }
                return { ...q, text: q.text?.trim() || (q.imageUrl ? ' ' : ''), options: JSON.stringify(multipartPayload) as any, correctIdx: -1 }
            }
            if (q.questionType === 'matching') {
                // Serialize matching data into options JSON
                const matchingPayload = {
                    answers: q.matchingAnswers || [],
                    subQuestions: q.matchingSubQuestions || []
                }
                return { ...q, text: q.text?.trim() || (q.imageUrl ? ' ' : ''), options: JSON.stringify(matchingPayload) as any, correctIdx: -1 }
            }
            const newOpts = [...(q.options || ['', '', '', ''])]
            for (let j = 0; j < 4; j++) {
                if (!newOpts[j].trim() && q.imageUrl) {
                    newOpts[j] = String.fromCharCode(65 + j)
                }
            }
            return { ...q, text: q.text?.trim() || (q.imageUrl ? ' ' : ''), options: newOpts }
        })

        for (let i = 0; i < finalQuestions.length; i++) {
            if (!finalQuestions[i].text?.trim() && !finalQuestions[i].imageUrl) { setMsg(`Savol ${i + 1} matni bo'sh`); return }
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
                if (!finalQuestions[i].options[j]?.trim()) { setMsg(`Savol ${i + 1}, variant ${String.fromCharCode(65 + j)} bo'sh`); return }
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
        try {
            await fetchApi(editingTestId ? `/tests/${editingTestId}` : '/tests/create', {
                method: editingTestId ? 'PATCH' : 'POST',
                body: JSON.stringify({
                    title,
                    subject,
                    subject2: testType === 'DTM_BLOCK' ? subject2 || null : null,
                    isPublic,
                    testType,
                    timeLimit: timeLimit || null,
                    questions: finalQuestions
                })
            })
            setMsg('success')
            setTitle('')
            setQuestions([createEmptyQuestion()])
            setTimeLimit(0)
            setTimeLimitTouched(false)
            setIsPublic(false)
            setTestType('REGULAR')
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
            await fetchApi(`/tests/${testId}/visibility`, {
                method: 'PATCH',
                body: JSON.stringify({ isPublic: !currentIsPublic })
            })
            toast.success(!currentIsPublic ? 'Test public qilindi! O\'quvchilarga bildirishnoma yuborildi.' : 'Test private qilindi')
            loadTests()
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    function copyLink(shareLink: string) {
        const url = `${window.location.origin}/test/${shareLink}`
        navigator.clipboard.writeText(url)
        setCopied(shareLink)
        setTimeout(() => setCopied(null), 2000)
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
            if (score >= 60) return '#d97706'
            if (score >= 50) return '#ea580c'
            if (score >= 40) return '#dc2626'
            return '#9f1239'
        }
        function rowBg(score: number) {
            if (score >= 90) return '#f0fdf4'
            if (score >= 80) return '#f0fdf4'
            if (score >= 70) return '#fefce8'
            if (score >= 60) return '#fffbeb'
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
            <td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;font-weight:500">${s.name}</td>
            <td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700;color:${col}">${ball} / ${maxBall}</td>
            <td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;text-align:center;color:#374151">${foiz}%</td>
            <td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:800;color:${col}">${daraja}</td>
        </tr>`
        }).join('')

        const questionRows = (questionStats || []).map((q: any, i: number) => `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280">${i + 1}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${renderPrintableMath(String(q.text || '—'))}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${q.totalAnswered}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:600;color:${q.errorRate > 50 ? '#dc2626' : q.errorRate > 30 ? '#d97706' : '#16a34a'}">${q.errorRate}%</td>
        </tr>`).join('')

        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${test?.title || 'Test'} — Natijalar</title>
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
  <div class="title">${dateStr} imtihon natijalari</div>
  <div class="subtitle">${test?.title || 'Test'} ${test?.subject ? '· ' + test.subject : ''} · Jami: ${totalAttempts} o'quvchi</div>
</div>
<div class="stats-row">
  <div class="stat"><div class="stat-val">${totalAttempts}</div><div class="stat-lbl">Ishtirokchi</div></div>
  <div class="stat"><div class="stat-val">${avgScore}%</div><div class="stat-lbl">O'rtacha foiz</div></div>
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

<div class="footer">DTMMax · dtmmax.pro · ${new Date().toLocaleDateString('uz-UZ')}</div>
</body>
</html>`

        const w = window.open('', '_blank')
        if (!w) { toast.error('Popup bloklangan. Brauzer ruxsat bering.'); return }
        w.document.write(html)
        w.document.close()
        setTimeout(() => { w.print() }, 600)
    }

    // Helpers
    const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)' }
    const mutedText = { color: 'var(--text-muted)' }
    const secondaryText = { color: 'var(--text-secondary)' }

    return (
        <>
            <div className="h-screen overflow-y-auto w-full" style={{ background: 'var(--bg-page)' }}>
                {/* Header */}
                <header className="sticky top-0 z-40" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
                    <div className="max-w-5xl mx-auto flex items-center justify-between py-2.5 px-5">
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ background: 'var(--brand)' }}>
                                <BrainCircuit className="h-3 w-3 text-white" />
                            </div>
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
                                <div key={t.id} className="card px-4 py-3 flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <p className="text-[13px] font-medium truncate">{t.title}</p>
                                            {t.isPublic
                                                ? <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: 'var(--success)', background: 'var(--success-light)' }}><Globe className="h-2.5 w-2.5" /> Public</span>
                                                : <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)' }}><Lock className="h-2.5 w-2.5" /> Private</span>}
                                        </div>
                                        <p className="text-[11px]" style={mutedText}>
                                            {t._count?.questions || 0} savol · {t._count?.attempts || 0} urinish · {t.subject}
                                            {t.subject2 ? ` + ${t.subject2}` : ''}
                                            {t.timeLimit ? ` · ⏱ ${t.timeLimit} min` : ''}
                                            {` · ${new Date(t.createdAt).toLocaleDateString('uz-UZ')}`}
                                            {' · '}
                                            <span style={{ color: t.testType === 'DTM_BLOCK' ? '#f59e0b' : t.testType === 'MILLIY_SERTIFIKAT' ? '#8b5cf6' : '#0f766e' }}>
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
                                    <button onClick={() => copyLink(t.shareLink)} className="h-7 px-2.5 flex items-center gap-1 rounded-lg text-[11px] font-medium transition flex-shrink-0"
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
                                <div className="flex gap-2">
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
                                </div>
                                {testType === 'DTM_BLOCK' && (
                                    <div className="space-y-2">
                                        <div className="rounded-lg px-3 py-2 text-[11px]" style={{ background: 'color-mix(in srgb, #f59e0b 10%, transparent)', border: '1px solid color-mix(in srgb, #f59e0b 20%, transparent)', color: 'var(--text-secondary)' }}>
                                            Har savolda blok turini tanlaysiz. Koeffitsient avtomatik keladi, xohlasangiz qo'lda ham o'zgartirasiz.
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
                                        <div className="rounded-xl p-3 space-y-3" style={{ background: 'color-mix(in srgb, #d97706 6%, transparent)', border: '1px solid color-mix(in srgb, #d97706 18%, transparent)' }}>
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div>
                                                    <p className="text-[12px] font-semibold" style={secondaryText}>DTM nazorat</p>
                                                    <p className="text-[11px]" style={mutedText}>
                                                        {dtmControlStats.total}/{DTM_OFFICIAL_QUESTION_TOTAL} savol · {formatDtmNumber(dtmControlStats.scoreMax)}/{DTM_OFFICIAL_SCORE_TOTAL} ball
                                                    </p>
                                                </div>
                                                <span
                                                    className="text-[10px] font-semibold px-2 py-1 rounded-full"
                                                    style={dtmControlStats.officialReady
                                                        ? { color: 'var(--success)', background: 'color-mix(in srgb, var(--success) 12%, transparent)' }
                                                        : { color: '#d97706', background: 'color-mix(in srgb, #d97706 12%, transparent)' }}
                                                >
                                                    {dtmControlStats.officialReady ? 'Rasmiy format tayyor' : 'Nazorat kerak'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                                                {dtmControlStats.rows.map(row => {
                                                    const isOver = row.count > row.target
                                                    const isComplete = row.count === row.target
                                                    return (
                                                        <div key={row.value} className="rounded-lg px-2.5 py-2" style={{ background: 'var(--bg-card)', border: `1px solid ${isOver ? 'var(--danger)' : isComplete ? 'color-mix(in srgb, var(--success) 28%, transparent)' : 'var(--border)'}` }}>
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="text-[10px] font-medium truncate" style={secondaryText}>{row.label}</span>
                                                                <span className="text-[10px] font-bold" style={{ color: isOver ? 'var(--danger)' : isComplete ? 'var(--success)' : 'var(--text-muted)' }}>{row.count}/{row.target}</span>
                                                            </div>
                                                            <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                                                                <div className="h-full rounded-full" style={{ width: `${row.percent}%`, background: isOver ? 'var(--danger)' : isComplete ? 'var(--success)' : '#d97706' }} />
                                                            </div>
                                                            <p className="text-[10px] mt-1" style={mutedText}>×{row.coefficient}</p>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                            {dtmControlStats.total < DTM_OFFICIAL_QUESTION_TOTAL && (
                                                <p className="text-[11px]" style={mutedText}>Bu qisqa DTM mashq testi sifatida saqlanadi. Rasmiy blok uchun 90 savol to'liq bo'lishi kerak.</p>
                                            )}
                                            {dtmControlStats.hasSpecialty2 && !subject2 && (
                                                <p className="text-[11px]" style={{ color: 'var(--danger)' }}>2-ixtisoslik savollari bor — 2-fanni tanlang.</p>
                                            )}
                                            {dtmControlStats.overLimit.length > 0 && (
                                                <p className="text-[11px]" style={{ color: 'var(--danger)' }}>{dtmControlStats.overLimit[0].label} bloki {dtmControlStats.overLimit[0].target} savoldan oshgan.</p>
                                            )}
                                            {dtmControlStats.officialMismatch && dtmControlStats.overLimit.length === 0 && (
                                                <p className="text-[11px]" style={{ color: '#d97706' }}>90 savollik test rasmiy hisoblanishi uchun taqsimot 10+10+10+30+30 bo'lishi kerak.</p>
                                            )}
                                        </div>
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

                            {/* AI bilan yaratish — doim ko'rinadi */}
                            <div className="rounded-xl p-4 space-y-2.5" style={{ ...cardStyle, borderColor: aiDone ? 'color-mix(in srgb, #8b5cf6 30%, transparent)' : 'var(--border)' }}>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="h-6 w-6 bg-gradient-to-br from-violet-500 to-blue-500 rounded-md flex items-center justify-center flex-shrink-0">
                                        <Sparkles className="h-3 w-3 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-semibold">AI bilan yaratish</p>
                                        <p className="text-[11px]" style={aiDone ? { color: '#8b5cf6' } : mutedText}>
                                            {aiDone ? `✨ ${questions.length} ta savol yaratildi` : 'PDF yoki screenshot yuklang — AI savollarni tayyorlaydi'}
                                        </p>
                                    </div>
                                </div>
                                <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="hidden"
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
                                    className="w-full h-9 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 transition bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:from-violet-700 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                                    {aiGenerating
                                        ? <><div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> AI tayyorlamoqda...</>
                                        : <><Sparkles className="h-3.5 w-3.5" /> AI bilan savollar yaratish</>}
                                </button>
                            </div>

                            {/* Savollar */}
                            <div className="flex items-center justify-between">
                                <p className="text-[12px] font-semibold" style={secondaryText}>{questions.length} ta savol</p>
                                {aiDone && <span className="text-[11px] px-2 py-0.5 rounded" style={{ color: '#8b5cf6', background: 'color-mix(in srgb, #8b5cf6 10%, transparent)' }}>✨ AI yaratgan</span>}
                            </div>

                            {questions.map((q, qi) => (
                                <div key={qi} className="rounded-xl p-3.5 space-y-2 transition" style={{ ...cardStyle, borderColor: aiDone ? 'color-mix(in srgb, #8b5cf6 20%, transparent)' : 'var(--border)' }}
                                    onPaste={(e) => {
                                        const items = e.clipboardData?.items
                                        if (!items) return
                                        for (const item of items) {
                                            if (item.type.startsWith('image/')) {
                                                const file = item.getAsFile()
                                                if (file) {
                                                    e.preventDefault()
                                                    handleImageUpload(qi, file)
                                                    break
                                                }
                                            }
                                        }
                                    }}
                                >
                                    {/* Savol header */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[12px] font-semibold" style={secondaryText}>Savol {qi + 1}</span>
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
                                                            style={q.questionType === 'matching' ? { background: '#8b5cf6', color: '#fff' } : { background: 'transparent', color: 'var(--text-muted)' }}>
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
                                    <div className="relative">
                                        <textarea placeholder="Savol matni ($formula$ yoki \\frac{a}{b} yozsa preview chiqadi)" required={!q.imageUrl} value={q.text} onChange={e => updateQ(qi, 'text', e.target.value)} rows={2}
                                            className="input resize-none w-full pr-12" style={{ height: 'auto', padding: '0.5rem 0.75rem', fontSize: '13px' }} />
                                        <label className="absolute right-2 top-2 p-1.5 rounded-md cursor-pointer transition hover:bg-slate-100 dark:hover:bg-slate-800"
                                            title="Rasm yuklash yoki Ctrl+V (Paste) orqali kiritish">
                                            <input type="file" accept="image/*" className="hidden" onChange={e => {
                                                if (e.target.files?.[0]) handleImageUpload(qi, e.target.files[0]);
                                                e.target.value = ''
                                            }} />
                                            <Image className="h-4 w-4" style={{ color: 'var(--brand)' }} />
                                        </label>
                                    </div>
                                    {(q.imagePreviewUrl || q.imageUrl) && (
                                        <div className="relative inline-block mt-2">
                                            <img src={q.imagePreviewUrl || q.imageUrl || ''} alt="Savol rasmi" className="max-h-32 rounded-lg border shadow-sm" style={{ borderColor: 'var(--border)' }} />
                                            <button type="button" onClick={() => setQuestions(prev => prev.map((question, i) => i === qi ? { ...question, imageUrl: null, imagePreviewUrl: null } : question))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition shadow-md">
                                                <X className="h-3 w-3" />
                                            </button>
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
                                                            <span className="text-[11px] font-bold w-5 text-right flex-shrink-0" style={{ color: '#8b5cf6' }}>{String.fromCharCode(65 + ai)})</span>
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
                                                                                ? { background: '#8b5cf6', color: 'white' }
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
                                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.color = '#8b5cf6' }}
                                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                                                    <Plus className="h-3 w-3" /> Kichik savol qo'shish
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* MCQ variantlari */
                                        <div className="grid grid-cols-2 gap-2">
                                            {q.options.map((o, oi) => (
                                                <div key={oi} className="space-y-1.5">
                                                    <label className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition"
                                                        style={q.correctIdx === oi ? { border: '1px solid color-mix(in srgb, var(--success) 40%, transparent)', background: 'color-mix(in srgb, var(--success) 6%, transparent)' } : { border: '1px solid var(--border)' }}>
                                                        <input type="radio" name={`correct-${qi}`} checked={q.correctIdx === oi} onChange={() => updateQ(qi, 'correctIdx', oi)} className="w-3 h-3 flex-shrink-0" style={{ accentColor: 'var(--success)' }} />
                                                        <input placeholder={`Variant ${String.fromCharCode(65 + oi)}`} required={!q.imageUrl} value={o} onChange={e => updateQ(qi, `opt${oi}`, e.target.value)}
                                                            className="flex-1 bg-transparent outline-none text-[13px] min-w-0" />
                                                    </label>
                                                    <MathPreview text={o} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {q.questionType !== 'open' && q.questionType !== 'matching' && q.questionType !== 'multipart_open' && (
                                        <p className="text-[10px]" style={{ color: 'var(--border-strong)' }}>
                                            Yashil doira = to&apos;g&apos;ri javob · $formula$ yoki sof LaTeX (masalan: <code>{'\\frac{a}{b}'}</code>) yozsa preview chiqadi
                                        </p>
                                    )}
                                    {q.questionType === 'matching' && <p className="text-[10px]" style={{ color: '#8b5cf660' }}>Binafsha = to'g'ri javob · Savol matni = umumiy kontekst (ixtiyoriy)</p>}
                                </div>
                            ))}

                            <button type="button" onClick={addQuestion}
                                className="w-full h-9 rounded-xl border-2 border-dashed text-[13px] transition flex items-center justify-center gap-1.5"
                                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                                <Plus className="h-3.5 w-3.5" /> Savol qo'shish
                            </button>
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
                                <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center">
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
                                    <div className="rounded-xl p-3 text-center" style={{ background: 'color-mix(in srgb, #f59e0b 10%, transparent)' }}>
                                        <p className="text-xl font-bold" style={{ color: '#f59e0b' }}>
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
                                                        const col = s.score >= 70 ? 'var(--success)' : s.score >= 50 ? '#f59e0b' : 'var(--danger)'
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
                                                            style={q.errorRate >= 60 ? { background: 'color-mix(in srgb, var(--danger) 15%, transparent)', color: 'var(--danger)' } : q.errorRate >= 30 ? { background: 'color-mix(in srgb, #f59e0b 15%, transparent)', color: '#f59e0b' } : { background: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)' }}>
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
        </>
    )
}
