import type { CSSProperties, ReactNode, UIEventHandler } from 'react'

import { ExploreHorizontalScrollArrows } from '@/components/explore/ExploreHorizontalScrollArrows'
import { EXPLORE_COLLAPSED_IDENTITY_WIDTH_PX } from '@/components/explore/tableColumns'

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
  /** When true, left scroll control sits past the collapsed sticky identity column. */
  collapseIdentity?: boolean
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
  collapseIdentity = false,
}: ExploreTableSurfaceProps) {
  const scrollBodyStyle = {
    ['--explore-collapsed-identity-width' as string]: `${EXPLORE_COLLAPSED_IDENTITY_WIDTH_PX}px`,
  } satisfies CSSProperties

  const leftScrollInsetPx = collapseIdentity ? EXPLORE_COLLAPSED_IDENTITY_WIDTH_PX + 8 : 8

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
        leftInsetPx={leftScrollInsetPx}
      />

      <div
        id={bodyId}
        className="explore-table-scroll overflow-x-auto scrollbar-hide"
        data-scrolled="0"
        style={scrollBodyStyle}
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
