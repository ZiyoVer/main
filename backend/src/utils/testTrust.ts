export interface StrictMatchingData {
    answers: string[]
    subQuestions: Array<{ text: string; correctIdx: number }>
}

const PRE_SUBMIT_SECRET_FIELDS = new Set([
    'correctIdx',
    'correctText',
    'solutionImageUrl',
    'answerSource',
    'answerVerified',
])

interface StrictTextOptionsConfig {
    minCount?: number
    maxCount?: number
    exactCount?: number
}

function normalizedUniqueKey(value: string): string {
    return value.normalize('NFKC').toLocaleLowerCase('uz-UZ')
}

/**
 * Variantlarni indekslarini o'zgartirmasdan tekshiradi. Bo'sh elementni filter qilish
 * taqiqlangan: aks holda correctIdx boshqa variantga ko'chib qoladi.
 */
export function parseStrictTextOptions(
    value: unknown,
    config: StrictTextOptionsConfig = {},
): string[] | null {
    if (!Array.isArray(value)) return null
    const { minCount = 2, maxCount = 20, exactCount } = config
    if (exactCount !== undefined && value.length !== exactCount) return null
    if (value.length < minCount || value.length > maxCount) return null

    const options = value.map((option) => typeof option === 'string' ? option.trim() : '')
    if (options.some((option) => !option)) return null
    if (new Set(options.map(normalizedUniqueKey)).size !== options.length) return null
    return options
}

export function parseStrictMatchingData(value: unknown): StrictMatchingData | null {
    let parsed = value
    if (typeof value === 'string') {
        try {
            parsed = JSON.parse(value)
        } catch {
            return null
        }
    }
    if (!parsed || typeof parsed !== 'object') return null

    const source = parsed as { answers?: unknown; subQuestions?: unknown }
    if (!Array.isArray(source.answers) || source.answers.length < 2 || source.answers.length > 20) return null
    if (!Array.isArray(source.subQuestions) || source.subQuestions.length < 1 || source.subQuestions.length > 50) return null

    const answers = source.answers.map((answer) => typeof answer === 'string' ? answer.trim() : '')
    if (answers.some((answer) => !answer)) return null
    if (new Set(answers.map(normalizedUniqueKey)).size !== answers.length) return null

    const subQuestions: StrictMatchingData['subQuestions'] = []
    for (const rawSubQuestion of source.subQuestions) {
        if (!rawSubQuestion || typeof rawSubQuestion !== 'object') return null
        const subQuestion = rawSubQuestion as { text?: unknown; correctIdx?: unknown }
        const text = typeof subQuestion.text === 'string' ? subQuestion.text.trim() : ''
        if (!text || !Number.isInteger(subQuestion.correctIdx)) return null
        const correctIdx = subQuestion.correctIdx as number
        if (correctIdx < 0 || correctIdx >= answers.length) return null
        subQuestions.push({ text, correctIdx })
    }

    return { answers, subQuestions }
}

/** Testni ochish javobidan answer-key va xom yechim reference'larini olib tashlaydi. */
export function stripPreSubmitAnswerFields(
    question: Record<string, unknown>,
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(question).filter(([key]) => !PRE_SUBMIT_SECRET_FIELDS.has(key))
    )
}

export function normalizeOpenAnswer(text: string | null | undefined): string {
    return String(text || '')
        .normalize('NFKC')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[`’‘ʻʼ]/g, '\'')
        .toLocaleLowerCase('uz-UZ')
}

export function parseAcceptedAnswers(text: string | null | undefined): string[] {
    return String(text || '')
        .split(/\r?\n+/)
        .map((part) => part.trim())
        .filter(Boolean)
}

/** Deterministik baho: faqat serverdagi accepted-answer qatorlaridan biri mos kelsa to'g'ri. */
export function isAcceptedOpenAnswer(
    studentAnswer: string | null | undefined,
    acceptedAnswerText: string | null | undefined,
): boolean {
    const normalizedStudent = normalizeOpenAnswer(studentAnswer)
    if (!normalizedStudent) return false
    const accepted = new Set(parseAcceptedAnswers(acceptedAnswerText).map(normalizeOpenAnswer).filter(Boolean))
    return accepted.has(normalizedStudent)
}
