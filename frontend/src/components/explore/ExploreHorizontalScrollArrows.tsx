import { ChevronLeft, ChevronRight } from 'lucide-react'

type ExploreHorizontalScrollArrowsProps = {
  hasOverflow: boolean
  canScrollLeft: boolean
  canScrollRight: boolean
  onScrollLeft: () => void
  onScrollRight: () => void
  leftAriaLabel: string
  rightAriaLabel: string
  className?: string
}

const DEFAULT_ARROW_BUTTON_CLASS =
  'inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-300/30 bg-blue-500/15 backdrop-blur-md text-blue-100 shadow-[0_10px_24px_-16px_rgba(37,99,235,0.9)] transition-all duration-200 hover:-translate-y-[1px] hover:border-blue-200/60 hover:bg-blue-500/25 hover:text-white hover:shadow-[0_14px_26px_-14px_rgba(59,130,246,0.95)] active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/40'

export function ExploreHorizontalScrollArrows({
  hasOverflow,
  canScrollLeft,
  canScrollRight,
  onScrollLeft,
  onScrollRight,
  leftAriaLabel,
  rightAriaLabel,
  className = DEFAULT_ARROW_BUTTON_CLASS,
}: ExploreHorizontalScrollArrowsProps) {
  return (
    <>
      {hasOverflow && canScrollLeft ? (
        <div className="absolute left-2 top-10 z-60">
          <button type="button" onClick={onScrollLeft} aria-label={leftAriaLabel} className={className}>
            <ChevronLeft size={14} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {hasOverflow && canScrollRight ? (
        <div className="absolute right-2 top-10 z-60">
          <button type="button" onClick={onScrollRight} aria-label={rightAriaLabel} className={className}>
            <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </>
  )
}
