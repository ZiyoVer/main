import { Check } from 'lucide-react'
import type { LearningSessionInfo } from './useLearningSession'

// ============================================================
// Sessiya raili — AI ustoz suhbatining o'quv bosqichlari.
// MUHIM QOIDA: rail FAQAT backend LearningSession real holatidan
// ishlaydi. Xabar matni, uzunligi yoki regex taxminlari ishlatilmaydi —
// soxta progress taqiqlangan. Sessiya yo'q bo'lsa rail umuman
// chizilmaydi.
// ============================================================

export type SessionPhaseId = 'diagnostika' | 'reja' | 'tushuntirish' | 'mashq' | 'natija'

export interface SessionPhaseState {
    current: SessionPhaseId
    done: SessionPhaseId[]
    /** LESSON bosqichida real qadam ko'rsatkichi, masalan "2/4" (backend stepIndex/plan) */
    stepLabel?: string
}

export const SESSION_PHASES: Array<{ id: SessionPhaseId; label: string }> = [
    { id: 'diagnostika', label: 'Diagnostika' },
    { id: 'reja', label: 'Reja' },
    { id: 'tushuntirish', label: 'Tushuntirish' },
    { id: 'mashq', label: 'Mashq' },
    { id: 'natija', label: 'Natija' },
]

/**
 * Backend LearningSession → rail holati.
 * - PREREQUISITE: diagnostika joriy (reja DBda yaratilgan — real)
 * - LESSON/REMEDIATION: diagnostika+reja o'tgan, tushuntirish joriy;
 *   lastCheckpoint bor bo'lsa mashq ham real bajarilgan
 * - COMPLETED: hamma bosqich o'tgan, natija joriy
 */
export function deriveSessionPhaseFromLearning(session: LearningSessionInfo | null): SessionPhaseState | null {
    if (!session) return null

    const stepLabel = session.plan.length > 0
        ? `${Math.min(session.stepIndex + 1, session.plan.length)}/${session.plan.length}`
        : undefined

    if (session.status === 'COMPLETED' || session.stage === 'COMPLETED') {
        return { current: 'natija', done: ['diagnostika', 'reja', 'tushuntirish', 'mashq'], stepLabel }
    }
    if (session.stage === 'LESSON' || session.stage === 'REMEDIATION') {
        const done: SessionPhaseId[] = ['diagnostika', 'reja']
        if (session.hasCheckpoint) done.push('mashq')
        return { current: 'tushuntirish', done, stepLabel }
    }
    // PREREQUISITE — reja sessiya yaratilganda DBga yozilgan (real holat)
    return { current: 'diagnostika', done: ['reja'], stepLabel }
}

export default function SessionRail({ phase, session }: { phase: SessionPhaseState; session: LearningSessionInfo }) {
    const progressLabel = session.plan.length > 0
        ? `${Math.min(session.stepIndex + 1, session.plan.length)}/${session.plan.length} qadam`
        : null

    return (
        <nav className="session-rail" aria-label="O‘quv sessiyasi bosqichlari">
            <div className="session-rail__context" aria-label="Joriy o‘quv mavzusi">
                {session.subject && <span>{session.subject}</span>}
                {session.subject && <span aria-hidden="true">·</span>}
                <strong>{session.topic}</strong>
                {progressLabel && <span aria-hidden="true">·</span>}
                {progressLabel && <span>{progressLabel}</span>}
            </div>
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
                            <span className="session-rail__label">
                                {step.label}
                                {isCurrent && phase.stepLabel && step.id === 'tushuntirish' ? ` · ${phase.stepLabel}` : ''}
                            </span>
                        </li>
                    )
                })}
            </ol>
        </nav>
    )
}
