import { prisma } from "@/lib/db/prisma"

function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const words = text.split(/\s+/)
  const chunks: string[] = []
  let i = 0
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(" ")
    if (chunk.trim()) chunks.push(chunk.trim())
    i += chunkSize - overlap
  }
  return chunks
}

export async function parsePDF(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse")
  const data = await pdfParse(buffer)
  return data.text
}

export async function parseWord(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth")
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

export async function ingestDocument(
  title: string,
  content: string,
  subjectId: string,
  sourceType: string = "manual"
): Promise<number> {
  const chunks = chunkText(content)
  let count = 0
  for (const chunk of chunks) {
    await prisma.rAGDocument.create({
      data: {
        title: chunks.length > 1 ? `${title} (${count + 1}/${chunks.length})` : title,
        content: chunk,
        subjectId,
        sourceType,
      },
    })
    count++
  }
  return count
}
