export const AI_MODELS = {
    deepseekPro: 'deepseek-v4-pro',
    deepseekFlash: 'deepseek-v4-flash',
    geminiFlash: 'gemini-3.5-flash',
    geminiFlashLite: 'gemini-3.5-flash-lite',
    geminiLegacyFlashLite: 'gemini-3.1-flash-lite',
    geminiTts: 'gemini-3.1-flash-tts-preview',
} as const

export interface DeepSeekThinkingOptions {
    thinking: { type: 'enabled' | 'disabled' }
    reasoning_effort?: 'high'
}

export function deepseekThinking(enabled: boolean): DeepSeekThinkingOptions {
    return enabled
        ? { thinking: { type: 'enabled' }, reasoning_effort: 'high' }
        : { thinking: { type: 'disabled' } }
}
