// Rasch Model Formula - P(θ, b) = exp(θ - b) / (1 + exp(θ - b))

export function raschProbability(ability: number, difficulty: number): number {
    const diff = ability - difficulty;
    return Math.exp(diff) / (1 + Math.exp(diff));
}

export function updatePersonAbility(currentAbility: number, isCorrect: boolean, itemDifficulty: number): number {
    // Simplified MLE update
    const prob = raschProbability(currentAbility, itemDifficulty);
    const score = isCorrect ? 1 : 0;

    // Learning rate (k) controls how fast ability changes
    const k = 0.5;
    const newAbility = currentAbility + k * (score - prob);

    // Cap abilities between -4.0 and 4.0 logits
    return Math.max(-4.0, Math.min(4.0, newAbility));
}

export function recalibrateItemDifficulty(currentDifficulty: number, totalAttempts: number, correctCount: number): number {
    // Prevent division by zero or log(0)
    if (totalAttempts <= 0 || correctCount <= 0 || correctCount >= totalAttempts) {
        return currentDifficulty;
    }

    // Simplified item recalibration based on classical test theory converging to Rasch
    const pValue = correctCount / totalAttempts;
    const estimatedNewDiff = Math.log((1 - pValue) / pValue);

    // Exponential moving average to prevent wild swings
    const alpha = 0.1;
    return (alpha * estimatedNewDiff) + ((1 - alpha) * currentDifficulty);
}

// Recommends difficulty of next item. Target prob of getting it right should be ~0.5 for max info
export function recommendNextItemDifficulty(studentAbility: number): number {
    // In a perfect Rasch setup, we give an item with difficulty equal to student ability
    return studentAbility;
}
