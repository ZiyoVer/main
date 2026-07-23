import { useState, useRef, useCallback } from 'react'
import { extractStructuredPayload, parseStructuredJson } from '@/lib/structuredJson'
import { stableHash } from '@/lib/stableHash'

export type AiSessionStatus = 'idle' | 'resolving' | 'ready' | 'error'

export function getAiTestCompletionKey(jsonStr: string, messageId?: string | null): string {
  if (typeof messageId === 'string' && messageId.trim()) return `message:${messageId.trim()}`
  const normalizedJson = extractStructuredPayload(jsonStr)
  const parsedQuestions = parseStructuredJson<unknown[]>(normalizedJson)
  const stableJson = Array.isArray(parsedQuestions) ? JSON.stringify(parsedQuestions) : normalizedJson
  return `content:${stableHash(stableJson)}`
}

export function getAiTestAnswersStorageKey(userId: string, completionKey: string): string {
  return `dtmmax_ans_${userId}_${stableHash(completionKey)}`
}

export function useTestPanel(
  completedTestIdsRef: React.MutableRefObject<Set<string>>,
  completedAiTestsRef: React.MutableRefObject<Set<string>>,
  userId: string
) {
  const [testPanel, setTestPanel] = useState<string | null>(null)
  const [testAnswers, setTestAnswers] = useState<Record<number, string>>({})
  const [testSubmitted, setTestSubmitted] = useState(false)
  const [testPanelMaximized, setTestPanelMaximized] = useState(false)
  const [activeTestId, setActiveTestId] = useState<string | null>(null)
  const [activeTestQuestions, setActiveTestQuestions] = useState<any[]>([])
  const [testReadOnly, setTestReadOnly] = useState(false)
  const [testWidth, setTestWidth] = useState(384)
  const testDragRef = useRef(false)
  const [testTimeLeft, setTestTimeLeft] = useState<number | null>(null)
  const [raschFeedback, setRaschFeedback] = useState<{ prev: number; next: number } | null>(null)
  const [loadingPublicTest, setLoadingPublicTest] = useState(false)
  // AI test faqat server saqlagan assistant xabari bilan bog'langan sessiya orqali baholanadi.
  const [aiSessionId, setAiSessionId] = useState<string | null>(null)
  const [aiSessionStatus, setAiSessionStatus] = useState<AiSessionStatus>('idle')
  const [aiSessionError, setAiSessionError] = useState<string | null>(null)
  const [activeAiMessageId, setActiveAiMessageId] = useState<string | null>(null)

  // Open test in side panel
  const openTestPanel = useCallback((jsonStr: string, messageId?: string) => {
    const normalizedJson = extractStructuredPayload(jsonStr)
    const parsedQuestions = parseStructuredJson<unknown[]>(normalizedJson)
    if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) return
    const stableJson = JSON.stringify(parsedQuestions)
    const completionKey = getAiTestCompletionKey(stableJson, messageId)
    setRaschFeedback(null)
    setTestTimeLeft(null)
    setAiSessionId(null)
    setAiSessionStatus(messageId ? 'resolving' : 'error')
    setAiSessionError(messageId ? null : 'Test serverda saqlanmaguncha uni boshlash mumkin emas.')
    setActiveAiMessageId(messageId || null)
    if (completedAiTestsRef.current.has(completionKey)) {
      // Allaqachon yechilgan — saqlangan javoblar bilan ko'rish rejimi
      let savedAnswers: Record<number, string> = {}
      try {
        savedAnswers = JSON.parse(localStorage.getItem(getAiTestAnswersStorageKey(userId, completionKey)) || '{}')
      } catch { }
      setTestPanel(stableJson)
      setTestAnswers(savedAnswers)
      setTestSubmitted(true)
      setTestReadOnly(true)
      setTestPanelMaximized(false)
      return
    }
    setTestPanel(stableJson)
    setTestAnswers({})
    setTestSubmitted(false)
    setTestPanelMaximized(false)
    setTestReadOnly(false)
  }, [completedAiTestsRef, userId])

  return {
    testPanel, setTestPanel,
    testAnswers, setTestAnswers,
    testSubmitted, setTestSubmitted,
    testPanelMaximized, setTestPanelMaximized,
    activeTestId, setActiveTestId,
    activeTestQuestions, setActiveTestQuestions,
    testReadOnly, setTestReadOnly,
    testWidth, setTestWidth,
    testDragRef,
    testTimeLeft, setTestTimeLeft,
    raschFeedback, setRaschFeedback,
    loadingPublicTest, setLoadingPublicTest,
    aiSessionId, setAiSessionId,
    aiSessionStatus, setAiSessionStatus,
    aiSessionError, setAiSessionError,
    activeAiMessageId, setActiveAiMessageId,
    openTestPanel,
  }
}
