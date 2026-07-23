import test from 'node:test'
import assert from 'node:assert/strict'
import { extractTrustedAiTestQuestions, learningPurposeForStage } from './aiTestSession'

test('extracts a strict test only from a complete assistant block', () => {
    const content = `Dars tugadi.\n\n\`\`\`test\n${JSON.stringify([
        { q: '2 + 2?', a: '1', b: '2', c: '4', d: '5', correct: 'c', topic: 'Arifmetika', difficulty: 0 },
    ])}\n\`\`\``
    assert.deepEqual(extractTrustedAiTestQuestions(content), [{
        q: '2 + 2?', a: '1', b: '2', c: '4', d: '5', correct: 'c', topic: 'Arifmetika', difficulty: 0,
    }])
})

test('rejects malformed, blank and duplicate options', () => {
    const wrap = (questions: unknown) => `\`\`\`test\n${JSON.stringify(questions)}\n\`\`\``
    assert.equal(extractTrustedAiTestQuestions('```test\n[{"q":'), null)
    assert.equal(extractTrustedAiTestQuestions(wrap([{ q: 'Q', a: 'A', b: '', c: 'C', d: 'D', correct: 'a' }])), null)
    assert.equal(extractTrustedAiTestQuestions(wrap([{ q: 'Q', a: 'A', b: 'A', c: 'C', d: 'D', correct: 'a' }])), null)
    assert.equal(extractTrustedAiTestQuestions(wrap([{ q: 'Q', a: 'A', b: 'B', c: 'C', d: 'D', correct: 'x' }])), null)
})

test('derives deterministic learning checkpoint purpose', () => {
    assert.equal(learningPurposeForStage('PREREQUISITE', null), 'PREREQUISITE')
    assert.equal(learningPurposeForStage('LESSON', null), 'CHECKPOINT')
    assert.equal(learningPurposeForStage('REMEDIATION', JSON.stringify({ purpose: 'PREREQUISITE' })), 'PREREQUISITE_REMEDIATION')
    assert.equal(learningPurposeForStage('REMEDIATION', '{broken'), 'CHECKPOINT_REMEDIATION')
})
