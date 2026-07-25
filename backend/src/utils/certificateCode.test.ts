import assert from 'node:assert/strict'
import test from 'node:test'
import { createCertificateCode, verifyCertificateCode } from './certificateCode'

const SECRET = 'test-certificate-secret-with-at-least-32-characters'
const ATTEMPT_ID = '5f5b9b1c-7a4a-4b17-9f3e-8e3f2ee8a1d0'

test('sertifikat kodi urinish ID sini imzolaydi va qayta tekshiradi', () => {
    const code = createCertificateCode(ATTEMPT_ID, SECRET)

    assert.match(code, /^DMS1-[0-9A-F]{32}-[0-9A-F]{20}$/)
    assert.equal(verifyCertificateCode(code, SECRET), ATTEMPT_ID)
})

test('o‘zgartirilgan sertifikat kodi rad etiladi', () => {
    const code = createCertificateCode(ATTEMPT_ID, SECRET)
    const tampered = `${code.slice(0, -1)}${code.endsWith('A') ? 'B' : 'A'}`

    assert.equal(verifyCertificateCode(tampered, SECRET), null)
})

test('noto‘g‘ri formatdagi sertifikat kodi rad etiladi', () => {
    assert.equal(verifyCertificateCode('DMS1-not-a-code', SECRET), null)
    assert.throws(() => createCertificateCode('not-a-uuid', SECRET))
})
