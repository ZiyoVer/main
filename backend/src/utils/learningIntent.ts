const APOSTROPHE = "['‘’`]"

function firstLearningClause(content: string): string {
    return content
        .trim()
        .split(/[.!?]/, 1)[0]
        .split(/,\s*(?:avval|oldin|keyin|so['‘’`]?ng)/i, 1)[0]
        .trim()
}

function normalizeTopic(rawTopic: string): string | null {
    const topic = rawTopic
        .replace(/^(?:iltimos\s+)?(?:menga\s+)?/i, '')
        .replace(/\s+mavzusini$/i, '')
        .replace(/ni$/i, '')
        .replace(/integeral/gi, 'integral')
        .trim()

    if (!topic || /^(?:bu|shu|uni|nimani|nima)$/i.test(topic)) return null
    return topic.charAt(0).toUpperCase() + topic.slice(1)
}

export function detectBroadLearningTopic(content: string): string | null {
    const clause = firstLearningClause(content)
    if (!clause || /(?:tushuntirma|o['‘’`]?rgatma)/i.test(clause)) return null

    const learningVerb = [
        'tushuntir(?:ib\\s+ber)?',
        `o${APOSTROPHE}?rgat(?:ib\\s+ber)?`,
        `o${APOSTROPHE}?rganmoqchiman`,
        `o${APOSTROPHE}?rganishni\\s+(?:boshlamoqchiman|xohlayman|istayman)`,
    ].join('|')

    const match = clause.match(new RegExp(`^(.{2,100}?)\\s+(?:haqida\\s+)?(?:${learningVerb})$`, 'i'))
    return match?.[1] ? normalizeTopic(match[1]) : null
}
