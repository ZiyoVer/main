const DEFAULT_MAX_PAGES = 120

export interface PdfTextExtraction {
    text: string
    pageCount: number
    processedPages: number
    truncated: boolean
}

/**
 * PDF matn qatlamini zamonaviy pdf.js bilan o'qiydi.
 *
 * Eski `pdf-parse` PDF.js 1.10 ga bog'langan va pdf-lib hamda zamonaviy
 * generatorlar yaratgan valid Flate streamlarni "Invalid PDF structure" deb
 * rad etishi mumkin edi. Test import va scan-detection bir xil, yangilanadigan
 * engine'dan foydalanishi uchun extraction shu utilityga markazlashtirildi.
 */
export async function extractPdfText(
    buffer: Buffer,
    maxPages = DEFAULT_MAX_PAGES,
): Promise<PdfTextExtraction> {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new Error('PDF fayl bo‘sh')
    }
    if (!Number.isInteger(maxPages) || maxPages < 1) {
        throw new Error('PDF sahifa limiti noto‘g‘ri')
    }

    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs' as any)
    const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(buffer),
        disableFontFace: true,
        useSystemFonts: true,
    })

    let document: any
    try {
        document = await loadingTask.promise
        const processedPages = Math.min(document.numPages, maxPages)
        const pages: string[] = []

        for (let pageNumber = 1; pageNumber <= processedPages; pageNumber++) {
            const page = await document.getPage(pageNumber)
            const content = await page.getTextContent()
            let pageText = ''

            for (const item of content.items) {
                if (!item || typeof item !== 'object' || !('str' in item)) continue
                const value = typeof item.str === 'string' ? item.str : ''
                if (value) pageText += value
                pageText += item.hasEOL ? '\n' : ' '
            }

            pages.push(pageText.trim())
            page.cleanup?.()
        }

        return {
            text: pages.filter(Boolean).join('\n\n').trim(),
            pageCount: document.numPages,
            processedPages,
            truncated: document.numPages > processedPages,
        }
    } finally {
        try {
            await document?.destroy?.()
        } catch {
            // Extraction natijasini cleanup xatosi bilan almashtirmaymiz.
        }
        try {
            await loadingTask.destroy?.()
        } catch {
            // Loading task allaqachon document bilan yopilgan bo‘lishi mumkin.
        }
    }
}
