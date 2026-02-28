// Rasch Model Formula - P(θ, b) = exp(θ - b) / (1 + exp(θ - b))

export function raschProbability(ability: number, difficulty: number): number {
    const diff = ability - difficulty;
    return Math.exp(diff) / (1 + Math.exp(diff));
}

export function updatePersonAbility(currentAbility: number, isCorrect: boolean, itemDifficulty: number): number {
    const prob = raschProbability(currentAbility, itemDifficulty);
    const score = isCorrect ? 1 : 0;

    const k = 0.5;
    const newAbility = currentAbility + k * (score - prob);
    return Math.max(-4.0, Math.min(4.0, newAbility));
}

export function recalibrateItemDifficulty(currentDifficulty: number, totalAttempts: number, correctCount: number): number {
    if (totalAttempts <= 0 || correctCount <= 0 || correctCount >= totalAttempts) {
        return currentDifficulty;
    }

    const pValue = correctCount / totalAttempts;
    const estimatedNewDiff = Math.log((1 - pValue) / pValue);

    const alpha = 0.1;
    return (alpha * estimatedNewDiff) + ((1 - alpha) * currentDifficulty);
}
