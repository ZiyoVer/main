import test from 'node:test'
import assert from 'node:assert/strict'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { prepareQuestionImage, QuestionImageValidationError } from './questionImage'

function createPng(width: number, height: number): Buffer {
    const canvas = createCanvas(width, height)
    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.fillStyle = '#171717'
    context.font = `${Math.max(20, Math.round(width / 30))}px sans-serif`
    context.fillText('DTM: x² + y² = 25', width * 0.08, height * 0.3)
    return canvas.toBuffer('image/png')
}

test('katta savol rasmini 2200px WebP ga tayyorlaydi', async () => {
    const input = createPng(3200, 2000)

    const result = await prepareQuestionImage(input, 'formula.png', 'image/png')
    const decoded = await loadImage(result.buffer)

    assert.equal(result.optimized, true)
    assert.equal(result.contentType, 'image/webp')
    assert.equal(result.fileName, 'formula.webp')
    assert.equal(decoded.width, 2200)
    assert.equal(decoded.height, 1375)
    assert.equal(result.width, 2200)
    assert.equal(result.height, 1375)
})

test('kichik PNG ni qayta kodlamasdan saqlaydi', async () => {
    const input = createPng(600, 400)

    const result = await prepareQuestionImage(input, 'kichik.png', 'image/png')

    assert.equal(result.optimized, false)
    assert.equal(result.contentType, 'image/png')
    assert.equal(result.buffer, input)
    assert.equal(result.width, 600)
    assert.equal(result.height, 400)
})

test('xavfli yoki qo‘llanmaydigan image MIME turini rad etadi', async () => {
    await assert.rejects(
        () => prepareQuestionImage(Buffer.from('<svg/>'), 'x.svg', 'image/svg+xml'),
        (error: unknown) => error instanceof QuestionImageValidationError,
    )
})
