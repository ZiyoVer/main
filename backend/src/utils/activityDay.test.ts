import test from 'node:test'
import assert from 'node:assert/strict'
import {
    tashkentDayDifference,
    tashkentDayKey,
    tashkentDayWindow,
} from './activityDay'

test('Tashkent kuni UTC+5 chegarasida almashadi', () => {
    assert.equal(tashkentDayKey(new Date('2026-07-18T18:59:59.999Z')), '2026-07-18')
    assert.equal(tashkentDayKey(new Date('2026-07-18T19:00:00.000Z')), '2026-07-19')
})

test('Tashkent kun oynasi UTC vaqtida aniq qaytadi', () => {
    const window = tashkentDayWindow(new Date('2026-07-18T20:00:00.000Z'))
    assert.equal(window.key, '2026-07-19')
    assert.equal(window.start.toISOString(), '2026-07-18T19:00:00.000Z')
    assert.equal(window.end.toISOString(), '2026-07-19T19:00:00.000Z')
})

test('streak farqi Tashkent kalendar kunlari bo‘yicha hisoblanadi', () => {
    assert.equal(
        tashkentDayDifference(
            new Date('2026-07-19T19:01:00.000Z'),
            new Date('2026-07-18T18:59:00.000Z'),
        ),
        2,
    )
})
