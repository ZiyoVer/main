const DAY_MS = 24 * 60 * 60 * 1000
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000

export function tashkentDayIndex(value: Date): number {
    return Math.floor((value.getTime() + TASHKENT_OFFSET_MS) / DAY_MS)
}

export function tashkentDayKey(value: Date): string {
    return new Date(value.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 10)
}

export function tashkentDayWindow(value: Date): { key: string; start: Date; end: Date } {
    const index = tashkentDayIndex(value)
    return {
        key: tashkentDayKey(value),
        start: new Date(index * DAY_MS - TASHKENT_OFFSET_MS),
        end: new Date((index + 1) * DAY_MS - TASHKENT_OFFSET_MS),
    }
}

export function tashkentDayDifference(current: Date, previous: Date): number {
    return tashkentDayIndex(current) - tashkentDayIndex(previous)
}
