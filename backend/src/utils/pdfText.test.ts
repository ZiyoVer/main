import test from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { extractPdfText } from './pdfText'

async function createTextPdf(pageTexts: string[]): Promise<Buffer> {
    const pdf = await PDFDocument.create()
    const font = await pdf.embedFont(StandardFonts.Helvetica)

    for (const text of pageTexts) {
        const page = pdf.addPage([595, 842])
        page.drawText(text, { x: 48, y: 790, size: 12, font })
    }

    return Buffer.from(await pdf.save())
}

test('pdf-lib yaratgan zamonaviy PDF matnini o‘qiydi', async () => {
    const buffer = await createTextPdf([
        '1. 2 + 3? A) 4 B) 5 C) 6 D) 7. Javob: B',
    ])

    const result = await extractPdfText(buffer)

    assert.match(result.text, /2 \+ 3/)
    assert.match(result.text, /Javob: B/)
    assert.equal(result.pageCount, 1)
    assert.equal(result.processedPages, 1)
    assert.equal(result.truncated, false)
})

test('sahifa limiti oshsa natijani truncated deb belgilaydi', async () => {
    const buffer = await createTextPdf(['Birinchi sahifa', 'Ikkinchi sahifa'])

    const result = await extractPdfText(buffer, 1)

    assert.match(result.text, /Birinchi sahifa/)
    assert.doesNotMatch(result.text, /Ikkinchi sahifa/)
    assert.equal(result.pageCount, 2)
    assert.equal(result.processedPages, 1)
    assert.equal(result.truncated, true)
})

