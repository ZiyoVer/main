import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateFlashcardReview, parseFlashcardQuality } from './flashcardReview'

test('accepts only finite integer quality values from 0 through 5', () => {
    for (let quality = 0; quality <= 5; quality++) {
        assert.equal(parseFlashcardQuality(quality), quality)
    }

    for (const invalid of [-1, 6, 2.5, Number.NaN, Number.POSITIVE_INFINITY, '4', null, undefined]) {
        assert.equal(parseFlashcardQuality(invalid), null)
    }
})

test('schedules a first successful review for the next day', () => {
    const reviewedAt = new Date('2026-07-18T10:00:00.000Z')
    const result = calculateFlashcardReview({ ease: 2.5, interval: 1, repetitions: 0 }, 4, reviewedAt)

    assert.equal(result.interval, 1)
    assert.equal(result.repetitions, 1)
    assert.equal(result.ease, 2.5)
    assert.equal(result.nextReview.toISOString(), '2026-07-19T10:00:00.000Z')
})

test('failed review resets repetitions without dropping ease below the SM-2 floor', () => {
    const reviewedAt = new Date('2026-07-18T10:00:00.000Z')
    const result = calculateFlashcardReview({ ease: 1.3, interval: 20, repetitions: 5 }, 0, reviewedAt)

    assert.equal(result.interval, 1)
    assert.equal(result.repetitions, 0)
    assert.equal(result.ease, 1.3)
    assert.equal(result.nextReview.toISOString(), '2026-07-19T10:00:00.000Z')
})

test('later successful reviews use the existing interval and ease', () => {
    const reviewedAt = new Date('2026-07-18T10:00:00.000Z')
    const result = calculateFlashcardReview({ ease: 2.5, interval: 6, repetitions: 2 }, 5, reviewedAt)

    assert.equal(result.interval, 15)
    assert.equal(result.repetitions, 3)
    assert.equal(result.ease, 2.6)
    assert.equal(result.nextReview.toISOString(), '2026-08-02T10:00:00.000Z')
})
