import assert from 'node:assert/strict'
import test from 'node:test'
import { buildS3Url, extractS3Key, toStoredS3Ref } from './s3'

test('stable s3key refdan object keyni ajratadi', () => {
    assert.equal(extractS3Key(toStoredS3Ref('chat/example.png')), 'chat/example.png')
})

test('eski signed URL query parametrlarini object keyga qo‘shmaydi', () => {
    const signedLikeUrl = `${buildS3Url('chat/example%20file.png')}?X-Amz-Signature=secret&X-Amz-Expires=60`
    assert.equal(extractS3Key(signedLikeUrl), 'chat/example file.png')
})

test('boshqa host va buzilgan qiymatni S3 key deb qabul qilmaydi', () => {
    assert.equal(extractS3Key('https://example.com/dtmmax/chat/example.png'), null)
    assert.equal(extractS3Key('data:image/png;base64,abc'), null)
    assert.equal(extractS3Key('s3key:'), null)
})
