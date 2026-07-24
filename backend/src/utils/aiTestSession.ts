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

const TEST_BLOCK_RE = /```test\s*([\s\S]*?)```/gi

function asTrimmedString(value: unknown, maxLength: number): string {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

/**
 * Only accepts a complete, strict interactive test emitted in a persisted
 * assistant message. Client supplied answer keys must never reach this path.
 */
export function extractTrustedAiTestQuestions(messageContent: string): TrustedAiTestQuestion[] | null {
    // Model ba'zan birinchi blokni chala yopib, keyingi recovery blokini to'g'ri
    // qaytaradi. Har bir blokni ko'rib, faqat birinchi TO'LIQ va qat'iy validini olamiz.
    for (const match of messageContent.matchAll(TEST_BLOCK_RE)) {
        if (!match[1]) continue
        let parsed: unknown
        try {
            parsed = JSON.parse(match[1].trim())
        } catch {
            continue
        }
        if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 120) continue

        const questions: TrustedAiTestQuestion[] = []
        let valid = true
        for (const item of parsed) {
            if (!item || typeof item !== 'object') {
                valid = false
                break
            }
            const source = item as Record<string, unknown>
            const q = asTrimmedString(source.q, 2000)
            const a = asTrimmedString(source.a, 1000)
            const b = asTrimmedString(source.b, 1000)
            const c = asTrimmedString(source.c, 1000)
            const d = asTrimmedString(source.d, 1000)
            const correct = asTrimmedString(source.correct, 1).toLowerCase()
            const options = [a, b, c, d]
            if (
                !q
                || options.some(option => !option)
                || !['a', 'b', 'c', 'd'].includes(correct)
                || new Set(options.map(option => option.toLocaleLowerCase('uz-UZ'))).size !== 4
            ) {
                valid = false
                break
            }

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
        if (valid) return questions
    }
    return null
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
