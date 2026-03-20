import OpenAI from 'openai'

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
const MAX_EMBEDDING_INPUT_CHARS = 6000
const EMBEDDING_BATCH_SIZE = 32

const embeddingClient = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null

export function hasEmbeddingClient() {
    return Boolean(embeddingClient)
}

export function normalizeEmbeddingText(text: string): string {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_EMBEDDING_INPUT_CHARS)
}

export function serializeEmbedding(values: number[]): string {
    return JSON.stringify(values)
}

export function parseEmbedding(value?: string | null): number[] | null {
    if (!value) return null
    try {
        const parsed = JSON.parse(value)
        if (!Array.isArray(parsed)) return null
        const numbers = parsed.filter((item) => typeof item === 'number')
        return numbers.length > 0 ? numbers : null
    } catch {
        return null
    }
}

export function cosineSimilarity(left: number[], right: number[]): number {
    if (left.length === 0 || right.length === 0 || left.length !== right.length) return 0

    let dot = 0
    let leftNorm = 0
    let rightNorm = 0

    for (let index = 0; index < left.length; index++) {
        const leftValue = left[index]
        const rightValue = right[index]
        dot += leftValue * rightValue
        leftNorm += leftValue * leftValue
        rightNorm += rightValue * rightValue
    }

    if (!leftNorm || !rightNorm) return 0
    return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))
}

export async function createEmbeddings(texts: string[]): Promise<number[][] | null> {
    if (!embeddingClient) return null

    const normalizedTexts = texts
        .map(normalizeEmbeddingText)
        .filter(Boolean)

    if (normalizedTexts.length === 0) return []

    const result: number[][] = []

    for (let index = 0; index < normalizedTexts.length; index += EMBEDDING_BATCH_SIZE) {
        const batch = normalizedTexts.slice(index, index + EMBEDDING_BATCH_SIZE)
        const response = await embeddingClient.embeddings.create({
            model: EMBEDDING_MODEL,
            input: batch,
        }, { timeout: 30000 })

        result.push(...response.data.map((item) => item.embedding))
    }

    return result
}

export async function createEmbedding(text: string): Promise<number[] | null> {
    const embeddings = await createEmbeddings([text])
    return embeddings?.[0] || null
}
