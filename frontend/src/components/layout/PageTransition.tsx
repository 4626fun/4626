import { Suspense, type ReactNode } from 'react'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Outlet, useLocation } from 'react-router-dom'

import { BASE_EASE, DURATION } from '@/components/brand/motion'
import { AppLoadingRegistrar } from '@/components/layout/AppLoadingOverlay'
import { cn } from '@/lib/shared/utils'

export type PageTransitionVariant = 'route' | 'nested'

function transitionTiming(variant: PageTransitionVariant, reduceMotion: boolean | null) {
  if (reduceMotion) {
    return { duration: 0, ease: BASE_EASE }
  }
  return {
    duration: variant === 'nested' ? DURATION.snap : DURATION.standard,
    ease: BASE_EASE,
  }
}

function motionOffset(variant: PageTransitionVariant) {
  return variant === 'nested'
    ? { enterY: 4, exitY: -2 }
    : { enterY: 6, exitY: -4 }
}

export type PageTransitionSurfaceProps = {
  transitionKey: string
  children: ReactNode
  className?: string
  variant?: PageTransitionVariant
}

/** Shared fade + slight vertical shift for route and nested tab surfaces. */
export function PageTransitionSurface(props: PageTransitionSurfaceProps) {
  const reduceMotion = useReducedMotion()
  const variant = props.variant ?? 'route'
  const { enterY, exitY } = motionOffset(variant)
  const transition = transitionTiming(variant, reduceMotion)

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={props.transitionKey}
        className={cn(variant === 'route' ? 'flex min-h-0 flex-1 flex-col' : undefined, props.className)}
        initial={reduceMotion ? false : { opacity: 0, y: enterY }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: exitY }}
        transition={transition}
      >
        {props.children}
      </motion.div>
    </AnimatePresence>
  )
}

/** Nested tab / sub-route transitions (Explore tabs, Admin sections). */
export function PageTransitionNestedOutlet(props: { className?: string }) {
  const location = useLocation()

  return (
    <PageTransitionSurface transitionKey={location.pathname} variant="nested" className={props.className}>
      <Outlet />
    </PageTransitionSurface>
  )
}

export function PageTransitionOutlet() {
  const location = useLocation()

  return (
    <PageTransitionSurface transitionKey={location.key} variant="route">
      <Suspense fallback={<AppLoadingRegistrar label="route-transition-suspense" />}>
        <Outlet />
      </Suspense>
    </PageTransitionSurface>
  )
}
