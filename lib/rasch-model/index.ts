/**
 * Calculates the probability of a correct response based on the simple Rasch model.
 * @param personAbility The ability parameter of the person (theta)
 * @param itemDifficulty The difficulty parameter of the item (b)
 * @returns A probability between 0 and 1
 */
export function raschProbability(personAbility: number, itemDifficulty: number): number {
    const diff = personAbility - itemDifficulty;
    return Math.exp(diff) / (1 + Math.exp(diff));
}

/**
 * Updates a person's ability estimate after a single test item response using Maximum Likelihood Estimation (MLE) approximation.
 * @param currentAbility Current ability logit of the student
 * @param itemDifficulty Difficulty logit of the question answered
 * @param isCorrect Boolean indicating if the student answered correctly
 * @returns The new ability logit estimate for the student
 */
export function updatePersonAbility(
    currentAbility: number,
    itemDifficulty: number,
    isCorrect: boolean
): number {
    const p = raschProbability(currentAbility, itemDifficulty);
    const actualResponse = isCorrect ? 1 : 0;

    // A simple heuristic update step. Real MLE requires iterative Newton-Raphson 
    // over an entire test, but for an adaptive real-time system, a step-based 
    // approach (like Elo rating) works well.
    const stepSize = 0.5; // Learning rate/step size

    return currentAbility + stepSize * (actualResponse - p);
}

/**
 * Updates an item's difficulty estimate based on a mass of responses.
 * @param currentDifficulty Current difficulty logit of the question
 * @param totalAttempts Total number of times the question was attempted
 * @param correctAttempts Number of times it was answered correctly
 * @returns The recalibrated item difficulty
 */
export function recalibrateItemDifficulty(
    currentDifficulty: number,
    totalAttempts: number,
    correctAttempts: number
): number {
    if (totalAttempts === 0) return currentDifficulty;

    const pActual = correctAttempts / totalAttempts;

    // Prevent Infinity logs (Logit transformation from proportion correct)
    // If everyone gets it right, it's very easy. If no one does, it's very hard.
    let boundedP = pActual;
    const epsilon = 0.01;
    if (boundedP < epsilon) boundedP = epsilon;
    if (boundedP > 1 - epsilon) boundedP = 1 - epsilon;

    // The higher the proportion correct, the lower the difficulty
    const empiricalDifficulty = -Math.log(boundedP / (1 - boundedP));

    // Exponential moving average to smoothly update difficulty over time
    const smoothingFactor = 0.1;
    return currentDifficulty * (1 - smoothingFactor) + empiricalDifficulty * smoothingFactor;
}

/**
 * Recommends the difficulty logit for the next item based on current ability.
 * @param currentAbility The student's current ability logit
 * @returns The target difficulty logit for the next item
 */
export function recommendNextItemDifficulty(currentAbility: number): number {
    // In adaptive testing, we want items where the student has a 50% chance of success
    // Therefore, the ideal item difficulty is exactly equal to the person's ability.
    return currentAbility;
}
