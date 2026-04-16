import { useCallback, useEffect, useState, type UIEvent } from 'react'

type ScrollDirection = 'left' | 'right'

type ExploreHorizontalControls = {
  overflow: boolean
  atLeftEdge: boolean
  atRightEdge: boolean
}

type UseExploreHorizontalTableSyncParams = {
  headerId: string
  bodyId: string
  onControlsChange?: (controls: ExploreHorizontalControls) => void
}

export function useExploreHorizontalTableSync({
  headerId,
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
    const body = document.getElementById(bodyId)
    if (!body) return

    const handleResize = () => updateControls(body)
    handleResize()
    window.addEventListener('resize', handleResize)

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(handleResize)
      observer.observe(body)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      observer?.disconnect()
    }
  }, [bodyId, updateControls])

  const handleHeaderScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const header = e.currentTarget
      const body = document.getElementById(bodyId)
      const scrolled = header.scrollLeft > 0
      updateControls(header)
      header.dataset.scrolled = scrolled ? '1' : '0'
      if (body) {
        body.scrollLeft = header.scrollLeft
        body.dataset.scrolled = scrolled ? '1' : '0'
      }
    },
    [bodyId, updateControls],
  )

  const handleBodyScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const body = e.currentTarget
      const header = document.getElementById(headerId)
      const scrolled = body.scrollLeft > 0
      updateControls(body)
      if (header) {
        header.scrollLeft = body.scrollLeft
        header.dataset.scrolled = scrolled ? '1' : '0'
      }
      body.dataset.scrolled = scrolled ? '1' : '0'
    },
    [headerId, updateControls],
  )

  const handleArrowClick = useCallback(
    (direction: ScrollDirection, stops: number[]) => {
      const body = document.getElementById(bodyId)
      if (!body) return

      const maxLeft = Math.max(0, body.scrollWidth - body.clientWidth)
      const currentLeft = body.scrollLeft

      if (direction === 'right') {
        const nextStop = stops.find((stop) => stop > currentLeft + 1) ?? maxLeft
        body.scrollTo({ left: Math.min(maxLeft, nextStop), behavior: 'smooth' })
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
      body.scrollTo({ left: Math.max(0, prevStop), behavior: 'smooth' })
    },
    [bodyId],
  )

  return {
    hasHorizontalOverflow,
    canScrollLeft,
    canScrollRight,
    handleHeaderScroll,
    handleBodyScroll,
    handleArrowClick,
  }
}
