import { Check } from 'lucide-react'

// ============================================================
// Sessiya raili — AI ustoz suhbatining o'quv bosqichlari.
// Handoff'dagi oqim: diagnostika → reja → tushuntirish → mashq → natija.
// Fevristik aniqlash: faqat chatdagi REAL dalillarga tayanadi
// (struktur bloklar, test holati) — dekorativ progress emas.
// ============================================================

export type SessionPhaseId = 'diagnostika' | 'reja' | 'tushuntirish' | 'mashq' | 'natija'

export interface SessionPhaseState {
    current: SessionPhaseId
    done: SessionPhaseId[]
}

export interface SessionPhaseInput {
    messages: Array<{ role: string; content: string }>
    testActive: boolean
    testSubmitted: boolean
}

export const SESSION_PHASES: Array<{ id: SessionPhaseId; label: string }> = [
    { id: 'diagnostika', label: 'Diagnostika' },
    { id: 'reja', label: 'Reja' },
    { id: 'tushuntirish', label: 'Tushuntirish' },
    { id: 'mashq', label: 'Mashq' },
    { id: 'natija', label: 'Natija' },
]

const PHASE_ORDER: SessionPhaseId[] = SESSION_PHASES.map(p => p.id)

/**
 * Joriy bosqich — dalili topilgan ENG OXIRGI bosqich.
 * "done" — joriydan oldingi, dalili bor bosqichlar (o'tkazib yuborilganlar
 * neutral qoladi — rail haqiqatni ko'rsatadi, taxminni emas).
 * Hech qanday dalil bo'lmasa null — rail umuman chizilmaydi.
 */
export function deriveSessionPhase({ messages, testActive, testSubmitted }: SessionPhaseInput): SessionPhaseState | null {
    if (messages.length === 0 && !testActive) return null

    const assistant = messages.filter(m => m.role === 'assistant')
    const user = messages.filter(m => m.role === 'user')

    const hit: Record<SessionPhaseId, boolean> = {
        diagnostika: user.some(m => /diagnostik|darajamni aniqla/i.test(m.content)),
        reja: assistant.some(m => m.content.includes('```todo')),
        // Struktur bloklarsiz 400+ belgilik javob — haqiqiy tushuntirish bo'lgan
        tushuntirish: assistant.some(m => m.content.replace(/```[\s\S]*?```/g, '').trim().length > 400),
        mashq: testActive || assistant.some(m => m.content.includes('```test')),
        natija: testSubmitted || assistant.some(m => /natija[\s\S]{0,80}\d+\s*%|\d+\s*%[\s\S]{0,80}natija/i.test(m.content)),
    }

    let currentIdx = -1
    PHASE_ORDER.forEach((id, i) => { if (hit[id]) currentIdx = Math.max(currentIdx, i) })
    if (currentIdx < 0) return null

    return {
        current: PHASE_ORDER[currentIdx],
        done: PHASE_ORDER.filter((id, i) => i < currentIdx && hit[id]),
    }
}

export default function SessionRail({ phase }: { phase: SessionPhaseState }) {
    return (
        <nav className="session-rail" aria-label="O‘quv sessiyasi bosqichlari">
            <ol>
                {SESSION_PHASES.map((step, idx) => {
                    const isDone = phase.done.includes(step.id)
                    const isCurrent = phase.current === step.id
                    return (
                        <li
                            key={step.id}
                            className={`session-rail__step${isDone ? ' is-done' : ''}${isCurrent ? ' is-current' : ''}`}
                            aria-current={isCurrent ? 'step' : undefined}
                        >
                            <span className="session-rail__dot" aria-hidden="true">
                                {isDone ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : idx + 1}
                            </span>
                            <span className="session-rail__label">{step.label}</span>
                        </li>
                    )
                })}
            </ol>
        </nav>
    )
}
