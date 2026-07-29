import { useEffect, useState } from 'react'
import { fetchApi } from '@/lib/api'

// ============================================================
// useLearningSession — chatdagi REAL o'quv sessiyasi holati.
// Backend LearningSession (PREREQUISITE | LESSON | REMEDIATION |
// COMPLETED) — sessiya railining yagona ishonchli manbai.
// Sessiya yo'q bo'lsa null qaytaradi (rail chizilmaydi).
// ============================================================

export interface LearningSessionInfo {
    id: string
    topic: string
    subject: string | null
    status: string
    stage: string
    stepIndex: number
    plan: string[]
    hasCheckpoint: boolean
}

export function useLearningSession(chatId: string | undefined, ...refreshDeps: unknown[]) {
    const [session, setSession] = useState<LearningSessionInfo | null>(null)

    useEffect(() => {
        if (!chatId) {
            setSession(null)
            return
        }
        let cancelled = false
        fetchApi(`/chat/${chatId}/learning-session`)
            .then((data: { session?: LearningSessionInfo | null }) => {
                if (!cancelled) setSession(data?.session ?? null)
            })
            .catch(() => {
                // Endpoint xatosi railni yashiradi — soxta holat ko'rsatmaymiz
                if (!cancelled) setSession(null)
            })
        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatId, ...refreshDeps])

    return session
}
