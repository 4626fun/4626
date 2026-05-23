import { useEffect, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import { cn } from '@/lib/shared/utils'

/** Soft ease-out — slow start, unhurried settle (no snap). */
const REVEAL_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]
const REVEAL_DURATION_S = 1.65
const REVEAL_ZOOM_FROM = 1.014
const OVERLAY_DELAY_S = 0.22
const OVERLAY_DURATION_S = 1.15

type ExploreHeroImageRevealProps = {
  src: string
  alt: string
  className?: string
  imageClassName?: string
  targetOpacity?: number
  overlays?: ReactNode
}

function preloadHeroImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('hero_image_load_failed'))
    img.src = src
    if (typeof img.decode === 'function') {
      void img.decode().then(() => resolve()).catch(() => resolve())
    }
  })
}

export function ExploreHeroImageReveal({
  src,
  alt,
  className,
  imageClassName,
  targetOpacity = 0.65,
  overlays,
}: ExploreHeroImageRevealProps) {
  const prefersReducedMotion = useReducedMotion()
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const ready = loadedSrc === src

  useEffect(() => {
    let cancelled = false

    void preloadHeroImage(src)
      .then(() => {
        if (!cancelled) setLoadedSrc(src)
      })
      .catch(() => {
        if (!cancelled) setLoadedSrc(src)
      })

    return () => {
      cancelled = true
    }
  }, [src])

  const image = (
    <img
      src={src}
      alt={alt}
      fetchPriority="high"
      loading="eager"
      decoding="async"
      className={cn('h-full w-full object-cover', imageClassName)}
      style={{ opacity: targetOpacity }}
    />
  )

  if (prefersReducedMotion) {
    return (
      <div className={cn('absolute inset-0 pointer-events-none overflow-hidden', className)}>
        <div
          className="absolute inset-0 transition-opacity duration-700 ease-out"
          style={{ opacity: ready ? 1 : 0 }}
        >
          {image}
        </div>
        {overlays ? (
          <div
            className="absolute inset-0 transition-opacity duration-700 ease-out"
            style={{ opacity: ready ? 1 : 0, transitionDelay: '120ms' }}
          >
            {overlays}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn('absolute inset-0 pointer-events-none overflow-hidden', className)}>
      <div
        className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900/95 to-black transition-opacity duration-700 ease-out"
        style={{ opacity: ready ? 0 : 1 }}
        aria-hidden
      />

      <motion.div
        className="absolute inset-0 will-change-[opacity,transform]"
        initial={false}
        animate={ready ? { opacity: 1, scale: 1 } : { opacity: 0, scale: REVEAL_ZOOM_FROM }}
        transition={{ duration: REVEAL_DURATION_S, ease: REVEAL_EASE }}
        style={{ transformOrigin: 'center center' }}
      >
        {image}
      </motion.div>

      {overlays ? (
        <motion.div
          className="absolute inset-0"
          initial={false}
          animate={ready ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: OVERLAY_DURATION_S, ease: REVEAL_EASE, delay: OVERLAY_DELAY_S }}
        >
          {overlays}
        </motion.div>
      ) : null}
    </div>
  )
}
