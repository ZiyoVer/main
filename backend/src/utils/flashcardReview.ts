const DAY_MS = 24 * 60 * 60 * 1000
const MIN_EASE = 1.3
const DEFAULT_EASE = 2.5
const MAX_INTERVAL_DAYS = 36500

export interface FlashcardReviewState {
    ease: number
    interval: number
    repetitions: number
}

export interface FlashcardReviewSchedule extends FlashcardReviewState {
    nextReview: Date
}

export function parseFlashcardQuality(value: unknown): number | null {
    return typeof value === 'number'
        && Number.isFinite(value)
        && Number.isInteger(value)
        && value >= 0
        && value <= 5
        ? value
        : null
}

/**
 * Pure SM-2 scheduling step. The route is responsible for atomically claiming
 * a due card before awarding XP; keeping the arithmetic here makes the trust
 * boundary independently testable without a database or external service.
 */
export function calculateFlashcardReview(
    state: FlashcardReviewState,
    quality: number,
    reviewedAt: Date,
): FlashcardReviewSchedule {
    const parsedQuality = parseFlashcardQuality(quality)
    if (parsedQuality === null) throw new RangeError('quality must be a finite integer from 0 to 5')

    let ease = Number.isFinite(state.ease) ? Math.max(MIN_EASE, state.ease) : DEFAULT_EASE
    let interval = Number.isInteger(state.interval) && state.interval > 0 ? state.interval : 1
    let repetitions = Number.isInteger(state.repetitions) && state.repetitions >= 0 ? state.repetitions : 0

    if (parsedQuality < 3) {
        repetitions = 0
        interval = 1
    } else {
        if (repetitions === 0) interval = 1
        else if (repetitions === 1) interval = 6
        else interval = Math.max(1, Math.min(MAX_INTERVAL_DAYS, Math.round(interval * ease)))
        repetitions += 1
    }

    ease = Math.max(
        MIN_EASE,
        ease + 0.1 - (5 - parsedQuality) * (0.08 + (5 - parsedQuality) * 0.02),
    )

    return {
        ease,
        interval,
        repetitions,
        nextReview: new Date(reviewedAt.getTime() + interval * DAY_MS),
    }
}
