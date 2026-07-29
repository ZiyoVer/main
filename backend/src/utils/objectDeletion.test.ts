import assert from 'node:assert/strict'
import test from 'node:test'
import { buildS3Url, toStoredS3Ref } from './s3'
import { collectObjectKeys, objectDeletionBackoffMs } from './objectDeletion'

test('chat va test maydonlaridan unique object key inventarini tuzadi', () => {
    const oldSigned = `${buildS3Url('chat/old.png')}?X-Amz-Signature=secret`
    const keys = collectObjectKeys(
        [
            { content: `![Rasm](${toStoredS3Ref('chat/new.png')})` },
            { content: `![Eski](${oldSigned})`, fileUrl: oldSigned },
        ],
        [{
            imageUrl: toStoredS3Ref('tests/question.webp'),
            optionImages: JSON.stringify([
                toStoredS3Ref('tests/option-a.webp'),
                toStoredS3Ref('tests/question.webp'),
            ]),
            solutionImageUrl: null,
        }],
    )

    assert.deepEqual(keys.sort(), [
        'chat/new.png',
        'chat/old.png',
        'tests/option-a.webp',
        'tests/question.webp',
    ])
})

test('deletion retry backoff bir daqiqadan boshlanib 24 soatda to‘xtaydi', () => {
    assert.equal(objectDeletionBackoffMs(1), 60_000)
    assert.equal(objectDeletionBackoffMs(2), 120_000)
    assert.equal(objectDeletionBackoffMs(20), 24 * 60 * 60 * 1000)
})
