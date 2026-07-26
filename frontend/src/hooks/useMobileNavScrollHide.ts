import { useEffect, useState } from 'react'

export const MOBILE_NAV_SCROLL_HIDE_THRESHOLD_PX = 10
export const MOBILE_NAV_SCROLL_NEAR_TOP_PX = 16

type ScrollTarget = Window | Element

function isScrollableElement(target: EventTarget | null): target is Element {
  return target instanceof Element
}

function readScrollTop(target: ScrollTarget): number {
  if (target === window) {
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
  }
  return (target as Element).scrollTop
}

function resolveScrollTarget(event: Event): ScrollTarget | null {
  const { target } = event
  if (
    target === window ||
    target === document ||
    target === document.documentElement ||
    target === document.body
  ) {
    return window
  }
  if (isScrollableElement(target)) {
    return target
  }
  return null
}

/**
 * Soft-hide the mobile dock on scroll-down; restore on scroll-up / near-top / route change.
 * Uses capture-phase listeners so nested overflow containers count.
 */
export function useMobileNavScrollHide(options: {
  enabled: boolean
  pathname: string
}): boolean {
  const { enabled, pathname } = options
  const [isScrollHidden, setIsScrollHidden] = useState(false)
  const resetKey = `${enabled ? '1' : '0'}:${pathname}`
  const [trackedResetKey, setTrackedResetKey] = useState(resetKey)

  // Reset during render when route/enabled changes (avoids setState-in-effect).
  if (resetKey !== trackedResetKey) {
    setTrackedResetKey(resetKey)
    setIsScrollHidden(false)
  }

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return
    }

    // Recreate baselines whenever enabled/pathname changes so the first scroll
    // after navigation cannot delta against a pre-navigation scrollTop.
    const lastScrollTopByTarget = new WeakMap<object, number>()

    const onScroll = (event: Event) => {
      const scrollTarget = resolveScrollTarget(event)
      if (!scrollTarget) return

      const scrollTop = readScrollTop(scrollTarget)
      const previous = lastScrollTopByTarget.get(scrollTarget)
      lastScrollTopByTarget.set(scrollTarget, scrollTop)

      if (previous === undefined) return

      if (scrollTop < MOBILE_NAV_SCROLL_NEAR_TOP_PX) {
        setIsScrollHidden(false)
        return
      }

      const delta = scrollTop - previous
      if (delta > MOBILE_NAV_SCROLL_HIDE_THRESHOLD_PX) {
        setIsScrollHidden(true)
      } else if (delta < -MOBILE_NAV_SCROLL_HIDE_THRESHOLD_PX) {
        setIsScrollHidden(false)
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true })
    }
  }, [enabled, pathname])

  return enabled ? isScrollHidden : false
}
