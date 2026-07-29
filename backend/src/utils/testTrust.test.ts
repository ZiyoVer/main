import test from 'node:test'
import assert from 'node:assert/strict'
import {
    isAcceptedOpenAnswer,
    parseStrictMatchingData,
    parseStrictTextOptions,
    stripPreSubmitAnswerFields,
} from './testTrust'

test('MCQ variant indeksini siljitmaydi va bo\'sh/duplicate variantni rad etadi', () => {
    assert.equal(parseStrictTextOptions(['A', '', 'C', 'D'], { exactCount: 4 }), null)
    assert.equal(parseStrictTextOptions(['A', ' a ', 'C', 'D'], { exactCount: 4 }), null)
    assert.deepEqual(parseStrictTextOptions([' A ', 'B', 'C', 'D'], { exactCount: 4 }), ['A', 'B', 'C', 'D'])
})

test('matching correctIdx har doim answers chegarasida bo\'lishi kerak', () => {
    assert.equal(parseStrictMatchingData({
        answers: ['Birinchi', 'Ikkinchi'],
        subQuestions: [{ text: 'X', correctIdx: 2 }],
    }), null)
    assert.deepEqual(parseStrictMatchingData({
        answers: [' Birinchi ', 'Ikkinchi'],
        subQuestions: [{ text: ' X ', correctIdx: 1 }],
    }), {
        answers: ['Birinchi', 'Ikkinchi'],
        subQuestions: [{ text: 'X', correctIdx: 1 }],
    })
})

test('open answer faqat normalizatsiyalangan accepted answer bilan deterministik moslashadi', () => {
    assert.equal(isAcceptedOpenAnswer('  O‘ZBEKISTON  ', "O'zbekiston\nUzbekistan"), true)
    assert.equal(isAcceptedOpenAnswer('Toshkent', "O'zbekiston\nUzbekistan"), false)
})

test('test ochilganda javob kaliti va yechim reference\'i brauzerga chiqmaydi', () => {
    const sanitized = stripPreSubmitAnswerFields({
        id: 'q1',
        text: '2 + 2?',
        options: '["3","4","5","6"]',
        correctIdx: 1,
        correctText: '4',
        solutionImageUrl: 's3key:private-solution',
        answerSource: 'PDF_KEY',
        answerVerified: true,
    })
    assert.deepEqual(sanitized, {
        id: 'q1',
        text: '2 + 2?',
        options: '["3","4","5","6"]',
    })
})
