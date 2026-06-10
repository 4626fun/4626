import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

export type OrbBorderIntensity = 'low' | 'medium' | 'high'
export type OrbBorderShape = 'round' | 'rect'

export function OrbBorder({
  children,
  className = '',
  intensity = 'medium',
  shape = 'round',
}: {
  children: ReactNode
  className?: string
  intensity?: OrbBorderIntensity
  shape?: OrbBorderShape
}) {
  const duration = intensity === 'high' ? 6 : intensity === 'medium' ? 10 : 15
  const shapeClass = shape === 'rect' ? 'rounded-xl' : 'rounded-full'

  return (
    <div className={`relative group w-full h-full ${className}`}>
      {/* Underglow */}
      <motion.div
        animate={{ opacity: [0.12, 0.22, 0.12], scale: [1, 1.05, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className={`absolute inset-0 ${shapeClass} bg-brand-primary/30 blur-[50px]`}
      />

      {/* Layer 1: electric ring (clockwise) */}
      <div className={`absolute -inset-[3px] ${shapeClass} overflow-hidden`}>
        <motion.div
          className="absolute inset-[-50%]"
          animate={{ rotate: 360 }}
          transition={{
            repeat: Infinity,
            duration,
            ease: 'linear',
          }}
          style={{
            background: `conic-gradient(
              from 0deg,
              rgb(var(--brand-primary) / 0.7) 0%,
              rgb(var(--brand-primary) / 0.45) 15%,
              rgb(var(--brand-hover)) 25%,
              rgb(var(--brand-primary)) 35%,
              #FFFFFF 42%,
              rgb(var(--brand-primary)) 48%,
              rgb(var(--brand-hover)) 58%,
              rgb(var(--brand-primary) / 0.45) 72%,
              rgb(var(--brand-hover) / 0.9) 86%,
              rgb(var(--brand-primary) / 0.7) 100%
            )`,
          }}
        />

        {/* Layer 2: interference (counter-clockwise) */}
        <motion.div
          className="absolute inset-[-50%] mix-blend-overlay opacity-70"
          animate={{ rotate: -360 }}
          transition={{
            repeat: Infinity,
            duration: duration * 1.8,
            ease: 'linear',
          }}
          style={{
            background: `conic-gradient(
              from 180deg,
              transparent 0%,
              rgb(var(--brand-primary)) 20%,
              transparent 40%,
              #EDEDED 50%,
              transparent 60%,
              rgb(var(--brand-primary)) 80%,
              transparent 100%
            )`,
          }}
        />

        <div className="absolute inset-0 backdrop-blur-[1px]" />
      </div>

      {/* Layer 3: housing */}
      <div className={`absolute inset-[2px] ${shapeClass} bg-obsidian z-10 shadow-[inset_0_2px_8px_rgba(0,0,0,1),inset_0_0_2px_rgba(255,255,255,0.3)]`} />

      {/* Layer 4: specular highlight */}
      <div className={`absolute inset-0 ${shapeClass} z-10 pointer-events-none mix-blend-screen opacity-50 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.8)_0%,transparent_60%)]`} />

      {/* Layer 5: bottom rim light */}
      <div className={`absolute inset-0 ${shapeClass} z-10 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_50%_100%,rgb(var(--brand-primary)/0.35)_0%,transparent_55%)]`} />

      {/* Inner content */}
      <div className={`relative ${shapeClass} z-20 h-full w-full flex items-center justify-center overflow-hidden`}>
        {children}
      </div>
    </div>
  )
}

