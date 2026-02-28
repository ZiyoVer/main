// Rasch Model Utilities
// P(correct) = 1 / (1 + exp(-(ability - difficulty)))

export function raschProbability(ability: number, difficulty: number): number {
    return 1 / (1 + Math.exp(-(ability - difficulty)))
}

export function updateAbility(
    currentAbility: number,
    responses: { difficulty: number; isCorrect: boolean }[],
    maxIterations = 25,
    tolerance = 0.001
): number {
    let ability = currentAbility
    for (let iter = 0; iter < maxIterations; iter++) {
        let sumResidual = 0
        let sumInfo = 0
        for (const r of responses) {
            const p = raschProbability(ability, r.difficulty)
            sumResidual += (r.isCorrect ? 1 : 0) - p
            sumInfo += p * (1 - p)
        }
        if (sumInfo === 0) break
        const delta = sumResidual / sumInfo
        ability += delta
        if (Math.abs(delta) < tolerance) break
    }
    return Math.round(ability * 1000) / 1000
}

export function updateDifficulty(
    currentDifficulty: number,
    attempts: { ability: number; isCorrect: boolean }[],
    maxIterations = 25,
    tolerance = 0.001
): number {
    let difficulty = currentDifficulty
    for (let iter = 0; iter < maxIterations; iter++) {
        let sumResidual = 0
        let sumInfo = 0
        for (const a of attempts) {
            const p = raschProbability(a.ability, difficulty)
            sumResidual += p - (a.isCorrect ? 1 : 0)
            sumInfo += p * (1 - p)
        }
        if (sumInfo === 0) break
        const delta = sumResidual / sumInfo
        difficulty += delta
        if (Math.abs(delta) < tolerance) break
    }
    return Math.round(difficulty * 1000) / 1000
}
