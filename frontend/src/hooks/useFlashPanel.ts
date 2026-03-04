import { useState, useRef, useCallback } from 'react'

export function useFlashPanel() {
  const [flashPanel, setFlashPanel] = useState<Array<{ id?: string; front: string; back: string; subject?: string }> | null>(null)
  const [flashIdx, setFlashIdx] = useState(0)
  const [flashFlipped, setFlashFlipped] = useState(false)
  const [flashMaximized, setFlashMaximized] = useState(false)
  const [flashWidth, setFlashWidth] = useState(384)
  const flashDragRef = useRef(false)
  const flashWidthRef = useRef(384)

  const openFlashPanel = useCallback((jsonStr: string) => {
    try {
      const cards = JSON.parse(jsonStr)
      if (!Array.isArray(cards) || cards.length === 0) return
      setFlashPanel(cards)
      setFlashIdx(0)
      setFlashFlipped(false)
    } catch (err) { console.error('openFlashPanel:', err) }
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
