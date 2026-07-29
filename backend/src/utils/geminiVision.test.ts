import assert from 'node:assert/strict'
import test from 'node:test'
import { generateGeminiVisionContent } from './geminiVision'

function jsonResponse(payload: unknown, status = 200): Response {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json' },
    })
}

test('primary vision modeli 503 bo‘lsa Flash-Lite modeliga o‘tadi', async () => {
    const requestedModels: string[] = []
    const fetchImpl: typeof fetch = async input => {
        const url = String(input)
        requestedModels.push(url)
        if (url.includes('primary-model')) {
            return jsonResponse({ error: { message: 'High demand' } }, 503)
        }
        return jsonResponse({
            candidates: [{
                content: {
                    parts: [{ text: '[{"text":"2+3?","options":["4","5","6","7"],"correctIdx":1}]' }],
                },
            }],
            usageMetadata: { totalTokenCount: 42 },
        })
    }

    const result = await generateGeminiVisionContent({
        apiKey: 'test-key',
        prompt: 'Savolni ajrat',
        images: [{ mimeType: 'image/png', data: 'aGVsbG8=' }],
        models: ['primary-model', 'fallback-model'],
        fetchImpl,
    })

    assert.equal(result.model, 'fallback-model')
    assert.match(result.text, /2\+3/)
    assert.equal(requestedModels.length, 2)
})

test('doimiy auth xatosida boshqa modelga yashirincha o‘tmaydi', async () => {
    let calls = 0
    const fetchImpl: typeof fetch = async () => {
        calls++
        return jsonResponse({ error: { message: 'API key invalid' } }, 401)
    }

    await assert.rejects(
        generateGeminiVisionContent({
            apiKey: 'bad-key',
            prompt: 'Savolni ajrat',
            images: [{ mimeType: 'image/png', data: 'aGVsbG8=' }],
            models: ['primary-model', 'fallback-model'],
            fetchImpl,
        }),
        /API key invalid/,
    )
    assert.equal(calls, 1)
})

test('thought qismi yakuniy JSON matniga qo‘shilmaydi', async () => {
    const fetchImpl: typeof fetch = async () => jsonResponse({
        candidates: [{
            content: {
                parts: [
                    { text: 'ichki fikr', thought: true },
                    { text: '[{"text":"Tayyor savol"}]' },
                ],
            },
        }],
    })

    const result = await generateGeminiVisionContent({
        apiKey: 'test-key',
        prompt: 'Savolni ajrat',
        images: [{ mimeType: 'image/jpeg', data: 'aGVsbG8=' }],
        models: ['vision-model'],
        fetchImpl,
    })

    assert.equal(result.text, '[{"text":"Tayyor savol"}]')
})
