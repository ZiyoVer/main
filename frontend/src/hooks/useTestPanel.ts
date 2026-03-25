import { useState, useRef, useCallback } from 'react'
import { fetchApi } from '@/lib/api'
import { extractStructuredPayload, parseStructuredJson } from '@/lib/structuredJson'

export function useTestPanel(
  completedTestIdsRef: React.MutableRefObject<Set<string>>,
  completedAiTestsRef: React.MutableRefObject<Set<string>>
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

  // Open test in side panel
  const openTestPanel = useCallback((jsonStr: string) => {
    const normalizedJson = extractStructuredPayload(jsonStr)
    const parsedQuestions = parseStructuredJson<unknown[]>(normalizedJson)
    if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) return
    const stableJson = JSON.stringify(parsedQuestions)
    const aiKey = stableJson.substring(0, 500)  // BUG-11: 120 → 500, collision xavfini kamaytirish
    setRaschFeedback(null)
    setTestTimeLeft(null)
    if (completedAiTestsRef.current.has(aiKey)) {
      // Allaqachon yechilgan — saqlangan javoblar bilan ko'rish rejimi
      let savedAnswers: Record<number, string> = {}
      try { savedAnswers = JSON.parse(localStorage.getItem('dtmmax_ans_' + aiKey) || '{}') } catch { }
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
  }, [completedAiTestsRef])

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
    openTestPanel,
  }
}
