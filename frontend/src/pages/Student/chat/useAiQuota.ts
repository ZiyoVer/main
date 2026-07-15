import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchApi } from '@/lib/api'

export interface AiQuota {
    unlimited: boolean
    chat: { used: number; limit: number }
    vision: { used: number; limit: number }
    resetsAt: string
}

interface UseAiQuotaOptions {
    generationLoading: boolean
}

export function useAiQuota({ generationLoading }: UseAiQuotaOptions) {
    const [quota, setQuota] = useState<AiQuota | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const requestIdRef = useRef(0)
    const previousGenerationLoadingRef = useRef(generationLoading)

    const refresh = useCallback(async () => {
        const requestId = ++requestIdRef.current
        try {
            const data = await fetchApi('/auth/ai-quota', { silent: true }) as AiQuota
            if (requestId !== requestIdRef.current) return
            setQuota(data)
            setError(false)
        } catch {
            if (requestId !== requestIdRef.current) return
            setError(true)
        } finally {
            if (requestId === requestIdRef.current) setLoading(false)
        }
    }, [])

    useEffect(() => {
        void refresh()
        return () => { requestIdRef.current += 1 }
    }, [refresh])

    useEffect(() => {
        if (previousGenerationLoadingRef.current && !generationLoading) void refresh()
        previousGenerationLoadingRef.current = generationLoading
    }, [generationLoading, refresh])

    return { quota, loading, error, refresh }
}
