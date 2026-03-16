// AI sozlamalar uchun umumiy cache moduli
// chat.ts va aiSettings.ts tomonidan ishlatiladi

export type AISettingsData = {
    temperature: number
    maxTokens: number
    extraRules: string
    promptOverrides: Record<string, string>
}

export let aiSettingsCache: AISettingsData | null = null
export let aiSettingsCacheTime = 0

export const AI_SETTINGS_TTL = 5 * 60 * 1000 // 5 daqiqa

// Cache ni tozalash — admin sozlamalarni yangilaganda chaqiriladi
export function invalidateAISettingsCache() {
    aiSettingsCache = null
    aiSettingsCacheTime = 0
}

export function setAISettingsCache(data: AISettingsData) {
    aiSettingsCache = data
    aiSettingsCacheTime = Date.now()
}
