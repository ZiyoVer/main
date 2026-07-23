export interface TrustedAiTestQuestion {
    q: string
    a: string
    b: string
    c: string
    d: string
    correct: 'a' | 'b' | 'c' | 'd'
    topic: string
    difficulty: number | null
}

const TEST_BLOCK_RE = /```test\s*([\s\S]*?)```/i

function asTrimmedString(value: unknown, maxLength: number): string {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

/**
 * Only accepts a complete, strict interactive test emitted in a persisted
 * assistant message. Client supplied answer keys must never reach this path.
 */
export function extractTrustedAiTestQuestions(messageContent: string): TrustedAiTestQuestion[] | null {
    const match = messageContent.match(TEST_BLOCK_RE)
    if (!match?.[1]) return null

    let parsed: unknown
    try {
        parsed = JSON.parse(match[1].trim())
    } catch {
        return null
    }
    if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 120) return null

    const questions: TrustedAiTestQuestion[] = []
    for (const item of parsed) {
        if (!item || typeof item !== 'object') return null
        const source = item as Record<string, unknown>
        const q = asTrimmedString(source.q, 2000)
        const a = asTrimmedString(source.a, 1000)
        const b = asTrimmedString(source.b, 1000)
        const c = asTrimmedString(source.c, 1000)
        const d = asTrimmedString(source.d, 1000)
        const correct = asTrimmedString(source.correct, 1).toLowerCase()
        const options = [a, b, c, d]
        if (!q || options.some(option => !option) || !['a', 'b', 'c', 'd'].includes(correct)) return null
        if (new Set(options.map(option => option.toLocaleLowerCase('uz-UZ'))).size !== 4) return null

        questions.push({
            q,
            a,
            b,
            c,
            d,
            correct: correct as TrustedAiTestQuestion['correct'],
            topic: asTrimmedString(source.topic, 120),
            difficulty: typeof source.difficulty === 'number' && Number.isFinite(source.difficulty)
                ? Math.max(-5, Math.min(5, source.difficulty))
                : null,
        })
    }
    return questions
}

export function learningPurposeForStage(stage: string, lastCheckpoint: string | null): string {
    if (stage === 'PREREQUISITE') return 'PREREQUISITE'
    if (stage !== 'REMEDIATION') return 'CHECKPOINT'

    try {
        const parsed: unknown = JSON.parse(lastCheckpoint || '{}')
        if (parsed && typeof parsed === 'object' && 'purpose' in parsed) {
            return String((parsed as { purpose?: unknown }).purpose || '').startsWith('PREREQUISITE')
                ? 'PREREQUISITE_REMEDIATION'
                : 'CHECKPOINT_REMEDIATION'
        }
    } catch { /* malformed legacy state falls back to checkpoint remediation */ }
    return 'CHECKPOINT_REMEDIATION'
}
