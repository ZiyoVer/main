import { useState, useRef, useCallback } from 'react'
import { parseStructuredJson } from '@/lib/structuredJson'

export function useFlashPanel() {
  const [flashPanel, setFlashPanel] = useState<Array<{ id?: string; front: string; back: string; subject?: string }> | null>(null)
  const [flashIdx, setFlashIdx] = useState(0)
  const [flashFlipped, setFlashFlipped] = useState(false)
  const [flashMaximized, setFlashMaximized] = useState(false)
  const [flashWidth, setFlashWidth] = useState(384)
  const flashDragRef = useRef(false)
  const flashWidthRef = useRef(384)

  const openFlashPanel = useCallback((jsonStr: string) => {
    const cards = parseStructuredJson<Array<{ id?: string; front: string; back: string; subject?: string }>>(jsonStr)
    if (!Array.isArray(cards) || cards.length === 0) return
    setFlashPanel(cards)
    setFlashIdx(0)
    setFlashFlipped(false)
  }, [])

  return {
    flashPanel, setFlashPanel,
    flashIdx, setFlashIdx,
    flashFlipped, setFlashFlipped,
    flashMaximized, setFlashMaximized,
    flashWidth, setFlashWidth,
    flashDragRef, flashWidthRef,
    openFlashPanel,
  }
}
