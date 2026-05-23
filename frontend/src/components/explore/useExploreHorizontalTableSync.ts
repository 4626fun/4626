import { useCallback, useEffect, useState, type UIEvent } from 'react'

type ScrollDirection = 'left' | 'right'

type ExploreHorizontalControls = {
  overflow: boolean
  atLeftEdge: boolean
  atRightEdge: boolean
}

type UseExploreHorizontalTableSyncParams = {
  /** Single horizontal scroll container (ExploreTableSurface bodyId). */
  bodyId: string
  onControlsChange?: (controls: ExploreHorizontalControls) => void
}

export function useExploreHorizontalTableSync({
  bodyId,
  onControlsChange,
}: UseExploreHorizontalTableSyncParams) {
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateControls = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return
      const overflow = el.scrollWidth > el.clientWidth + 1
      const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth)
      const atLeftEdge = el.scrollLeft <= 1
      const atRightEdge = el.scrollLeft >= maxLeft - 1
      setHasHorizontalOverflow(overflow)
      setCanScrollLeft(overflow && !atLeftEdge)
      setCanScrollRight(overflow && !atRightEdge)
      onControlsChange?.({ overflow, atLeftEdge, atRightEdge })
    },
    [onControlsChange],
  )

  useEffect(() => {
    const scrollEl = document.getElementById(bodyId)
    if (!scrollEl) return

    const handleResize = () => updateControls(scrollEl)
    handleResize()
    window.addEventListener('resize', handleResize)

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(handleResize)
      observer.observe(scrollEl)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      observer?.disconnect()
    }
  }, [bodyId, updateControls])

  const handleBodyScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const scrollEl = e.currentTarget
      const scrolled = scrollEl.scrollLeft > 0
      updateControls(scrollEl)
      scrollEl.dataset.scrolled = scrolled ? '1' : '0'
    },
    [updateControls],
  )

  const handleArrowClick = useCallback(
    (direction: ScrollDirection, stops: number[]) => {
      const scrollEl = document.getElementById(bodyId)
      if (!scrollEl) return

      const maxLeft = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth)
      const currentLeft = scrollEl.scrollLeft

      if (direction === 'right') {
        const nextStop = stops.find((stop) => stop > currentLeft + 1) ?? maxLeft
        scrollEl.scrollTo({ left: Math.min(maxLeft, nextStop), behavior: 'smooth' })
        return
      }

      let prevStop = 0
      for (let i = stops.length - 1; i >= 0; i -= 1) {
        const stop = stops[i]
        if (stop !== undefined && stop < currentLeft - 1) {
          prevStop = stop
          break
        }
      }
      scrollEl.scrollTo({ left: Math.max(0, prevStop), behavior: 'smooth' })
    },
    [bodyId],
  )

  return {
    hasHorizontalOverflow,
    canScrollLeft,
    canScrollRight,
    handleBodyScroll,
    handleArrowClick,
  }
}
