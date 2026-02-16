import { lazy, Suspense, useEffect, useRef, useState } from 'react'

const WaitlistFlowWithProviders = lazy(async () => import('./WaitlistFlowWithProviders'))

/**
 * Defers loading heavy auth/wallet provider code until the waitlist section is near viewport.
 * This keeps the initial landing bundle lighter while preserving the embedded waitlist experience.
 */
export function DeferredWaitlistFlow() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    if (shouldLoad) return
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true)
          observer.disconnect()
        }
      },
      { rootMargin: '600px 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [shouldLoad])

  return (
    <div id="waitlist" ref={ref}>
      {shouldLoad ? (
        <Suspense fallback={<div className="h-24" />}>
          <WaitlistFlowWithProviders />
        </Suspense>
      ) : (
        <div className="h-24" />
      )}
    </div>
  )
}
