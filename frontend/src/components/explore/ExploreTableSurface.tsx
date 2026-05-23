import type { ReactNode, UIEventHandler } from 'react'

import { ExploreHorizontalScrollArrows } from '@/components/explore/ExploreHorizontalScrollArrows'

type ExploreTableSurfaceProps = {
  /** Scroll container id — used for horizontal sync + mobile sticky collapse CSS. */
  bodyId: string
  onBodyScroll: UIEventHandler<HTMLDivElement>
  header: ReactNode
  body: ReactNode
  hasHorizontalOverflow: boolean
  canScrollLeft: boolean
  canScrollRight: boolean
  onScrollLeft: () => void
  onScrollRight: () => void
  leftAriaLabel: string
  rightAriaLabel: string
}

export function ExploreTableSurface({
  bodyId,
  onBodyScroll,
  header,
  body,
  hasHorizontalOverflow,
  canScrollLeft,
  canScrollRight,
  onScrollLeft,
  onScrollRight,
  leftAriaLabel,
  rightAriaLabel,
}: ExploreTableSurfaceProps) {
  return (
    <>
      <ExploreHorizontalScrollArrows
        hasOverflow={hasHorizontalOverflow}
        canScrollLeft={canScrollLeft}
        canScrollRight={canScrollRight}
        onScrollLeft={onScrollLeft}
        onScrollRight={onScrollRight}
        leftAriaLabel={leftAriaLabel}
        rightAriaLabel={rightAriaLabel}
      />

      <div
        id={bodyId}
        className="explore-table-scroll overflow-x-auto scrollbar-hide"
        data-scrolled="0"
        onScroll={onBodyScroll}
      >
        <div className="w-max min-w-0">
          <div className="explore-table-sticky-bar sticky top-0 z-50 border-b border-white/8">{header}</div>
          {body}
        </div>
      </div>
    </>
  )
}
