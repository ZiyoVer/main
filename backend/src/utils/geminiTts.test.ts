import assert from 'node:assert/strict'
import test from 'node:test'
import { generateCharonSpeech, sanitizeSpeechText } from './geminiTts'

test('speech matnidan yashirin test va markdownni olib tashlaydi', () => {
    const text = sanitizeSpeechText(`# Sarlavha

**Hosila** — o‘zgarish tezligi. [Batafsil](https://example.com).

\`\`\`test
[{"q":"Javob kaliti","correct":"a"}]
\`\`\``)

    assert.equal(text, 'Sarlavha Hosila — o‘zgarish tezligi. Batafsil.')
    assert.doesNotMatch(text, /Javob kaliti|correct/)
})

test('Gemini so‘rovda doim Charon va WAV ishlatadi', async () => {
    let requestBody: any = null
    const wav = Buffer.concat([
        Buffer.from('RIFF'),
        Buffer.alloc(4),
        Buffer.from('WAVE'),
        Buffer.alloc(48),
    ])
    const fetchImpl: typeof fetch = async (_input, init) => {
        requestBody = JSON.parse(String(init?.body))
        return new Response(JSON.stringify({
            steps: [{
                type: 'model_output',
                content: [{
                    type: 'audio',
                    data: wav.toString('base64'),
                    mime_type: 'audio/wav',
                    sample_rate: 24000,
                }],
            }],
            usage: { total_tokens: 12 },
        }), { status: 200 })
    }

    const result = await generateCharonSpeech({
        apiKey: 'test-key',
        text: 'Welcome to DTMMax.',
        fetchImpl,
    })

    assert.equal(requestBody.generation_config.speech_config[0].voice, 'Charon')
    assert.equal(requestBody.response_format.mime_type, 'audio/wav')
    assert.equal(requestBody.store, false)
    assert.equal(result.voice, 'Charon')
    assert.equal(result.audio.subarray(0, 4).toString('ascii'), 'RIFF')
})

test('raw PCM javobi standart WAV konteyneriga o‘raladi', async () => {
    const pcm = Buffer.from([0, 0, 1, 0, 2, 0, 3, 0])
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
        steps: [{
            type: 'model_output',
            content: [{
                type: 'audio',
                data: pcm.toString('base64'),
                mime_type: 'audio/l16',
                sample_rate: 24000,
            }],
        }],
    }), { status: 200 })

    const result = await generateCharonSpeech({
        apiKey: 'test-key',
        text: 'Audio',
        fetchImpl,
    })

    assert.equal(result.audio.subarray(0, 4).toString('ascii'), 'RIFF')
    assert.equal(result.audio.subarray(8, 12).toString('ascii'), 'WAVE')
    assert.equal(result.audio.length, 44 + pcm.length)
})
