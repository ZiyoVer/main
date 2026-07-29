import test from 'node:test'
import assert from 'node:assert/strict'
import { teacherDeletionRequiresAdmin } from './accountDeletionPolicy'

test('faqat o‘qituvchining o‘z testlari bo‘lsa self-delete bloklanmaydi', () => {
    assert.equal(teacherDeletionRequiresAdmin({ tests: 4, attempts: 0, sessions: 0 }), false)
})

test('boshqa o‘quvchining natijasi bo‘lsa self-delete admin talab qiladi', () => {
    assert.equal(teacherDeletionRequiresAdmin({ tests: 1, attempts: 1, sessions: 0 }), true)
})

test('tugallanmagan test sessiyasi ham kollateral ma’lumot hisoblanadi', () => {
    assert.equal(teacherDeletionRequiresAdmin({ tests: 1, attempts: 0, sessions: 1 }), true)
})
