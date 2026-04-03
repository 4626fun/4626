import type { ReactNode, UIEventHandler } from 'react'

import { ExploreHorizontalScrollArrows } from '@/components/explore/ExploreHorizontalScrollArrows'

type ExploreTableSurfaceProps = {
  headerId: string
  bodyId: string
  onHeaderScroll: UIEventHandler<HTMLDivElement>
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
  headerId,
  bodyId,
  onHeaderScroll,
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
      <div className="sticky top-0 z-50 border-b border-white/8 bg-vault-bg shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)]">
        <div className="overflow-x-auto scrollbar-hide" id={headerId} data-scrolled="0" onScroll={onHeaderScroll}>
          <div className="min-w-max">{header}</div>
        </div>
      </div>

      <ExploreHorizontalScrollArrows
        hasOverflow={hasHorizontalOverflow}
        canScrollLeft={canScrollLeft}
        canScrollRight={canScrollRight}
        onScrollLeft={onScrollLeft}
        onScrollRight={onScrollRight}
        leftAriaLabel={leftAriaLabel}
        rightAriaLabel={rightAriaLabel}
      />

      <div className="overflow-x-auto scrollbar-hide" id={bodyId} data-scrolled="0" onScroll={onBodyScroll}>
        <div className="min-w-max divide-y divide-white/6">{body}</div>
      </div>
    </>
  )
}
