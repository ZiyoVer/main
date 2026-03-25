export function extractStructuredPayload(raw: string): string {
    const text = String(raw || '').trim()
    if (!text) return ''

    const codeBlockMatch = text.match(/```(?:json|test|flashcard|formula|todo|essay|vocab|profile-update|todo-done)?\s*([\s\S]*?)\s*```/i)
    if (codeBlockMatch?.[1]) return codeBlockMatch[1].trim()

    const arrayMatch = text.match(/\[\s*[\s\S]*\]/)
    if (arrayMatch?.[0]) return arrayMatch[0].trim()

    const objectMatch = text.match(/\{\s*[\s\S]*\}/)
    if (objectMatch?.[0]) return objectMatch[0].trim()

    return text
}

function repairStructuredJson(raw: string): string {
    return raw
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, '\'')
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
}

export function parseStructuredJson<T>(raw: string): T | null {
    const extracted = extractStructuredPayload(raw)
    if (!extracted) return null

    try {
        return JSON.parse(extracted) as T
    } catch {
        try {
            return JSON.parse(repairStructuredJson(extracted)) as T
        } catch {
            return null
        }
    }
}
