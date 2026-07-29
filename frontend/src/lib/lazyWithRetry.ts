import {
    lazy,
    type ComponentType,
    type LazyExoticComponent,
} from 'react'

const CHUNK_RECOVERY_KEY = 'dtmmax_chunk_recovery_at'
const CHUNK_RECOVERY_WINDOW_MS = 60_000

export function isChunkLoadError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? '')
    return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|chunkloaderror|loading chunk [\w-]+ failed/i.test(message)
}

function recoverFromChunkFailure(error: unknown): boolean {
    if (typeof window === 'undefined' || !isChunkLoadError(error)) return false

    let previousRecovery = 0
    try {
        previousRecovery = Number(sessionStorage.getItem(CHUNK_RECOVERY_KEY) || 0)
    } catch {
        // Storage bloklangan bo'lsa ham joriy URL'ni bir marta yangilashga urinib ko'ramiz.
    }

    const now = Date.now()
    if (Number.isFinite(previousRecovery) && now - previousRecovery < CHUNK_RECOVERY_WINDOW_MS) {
        return false
    }

    try {
        sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(now))
    } catch {
        // Safari private mode yoki storage policy navigatsiyani bloklamasligi kerak.
    }

    const url = new URL(window.location.href)
    url.searchParams.set('recover', String(now))
    window.location.replace(url.toString())
    return true
}

function clearChunkRecoveryMarker(): void {
    if (typeof window === 'undefined') return
    try {
        sessionStorage.removeItem(CHUNK_RECOVERY_KEY)
    } catch {
        // Marker qolishi sahifani sindirmaydi; keyingi sessiyada qayta urinadi.
    }
}

export function lazyWithRetry<T extends ComponentType<any>>(
    importer: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
    return lazy(async () => {
        try {
            const module = await importer()
            clearChunkRecoveryMarker()
            return module
        } catch (error) {
            if (recoverFromChunkFailure(error)) {
                // `location.replace` bajarilguncha ErrorBoundary miltillamasin.
                return await new Promise<never>(() => undefined)
            }
            throw error
        }
    })
}

let preloadRecoveryInstalled = false

export function installChunkRecovery(): void {
    if (typeof window === 'undefined' || preloadRecoveryInstalled) return
    preloadRecoveryInstalled = true

    window.addEventListener('vite:preloadError', event => {
        const preloadEvent = event as Event & { payload?: unknown }
        if (recoverFromChunkFailure(preloadEvent.payload ?? new Error('Failed to fetch dynamically imported module'))) {
            event.preventDefault()
        }
    })
}
