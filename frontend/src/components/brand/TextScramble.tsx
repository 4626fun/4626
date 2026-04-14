import { useEffect, useMemo, useRef, useState } from 'react'

import { DURATION } from './motion'

export type TextScrambleFont = 'sans' | 'mono' | 'doto'
export type TextScrambleComplexity = 'simple' | 'complex'

export interface TextScrambleProps {
  text: string
  className?: string
  font?: TextScrambleFont
  trigger?: boolean
  /** Resolve speed multiplier (higher = faster). Default 1.0 */
  speed?: number
  complexity?: TextScrambleComplexity
}

const SIMPLE_SYMBOLS = ['●', '■', '▲', '◆', '○', '□', '△', '◊', '⬡', '⬢', '✶', '✕', '✧', '✦', '✢']
const COMPLEX_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'

type ScrambleChar = { char: string; style: React.CSSProperties }

function rand(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const a = new Uint32Array(1)
    crypto.getRandomValues(a)
    return a[0]! / 2 ** 32
  }
  return 0.123456789
}

function randInt(maxExclusive: number): number {
  const m = Math.max(1, Math.floor(maxExclusive))
  return Math.floor(rand() * m)
}

/**
 * Base brand "tech scramble" — vertical glyph swaps that cascade
 * left-to-right and resolve into the final message.
 *
 * Per spec: headlines & teasers only, Medium weight, sequences ≤800ms.
 * Pair with a quick fade-in of supporting content.
 */
export function TextScramble({
  text,
  className = '',
  font = 'sans',
  trigger = true,
  speed = 1.0,
  complexity = 'simple',
}: TextScrambleProps) {
  const baselineOutput = useMemo(() => {
    return text.split('').map((char) => ({ char, style: {} }))
  }, [text])

  const [output, setOutput] = useState<ScrambleChar[]>(baselineOutput)
  const frameRef = useRef<number>(0)
  const progressRef = useRef<number>(0)
  const frameCountRef = useRef<number>(0)

  useEffect(() => {
    if (!trigger) return

    progressRef.current = 0
    frameCountRef.current = 0

    const charsPerFrame = speed * 0.55
    const maxFrames = Math.ceil((text.length + 4) / charsPerFrame)

    const animate = () => {
      progressRef.current += charsPerFrame
      frameCountRef.current += 1

      const resolved = Math.floor(progressRef.current)
      const isComplex = complexity === 'complex'
      const frame = frameCountRef.current

      const next = text.split('').map((char, index): ScrambleChar => {
        if (char === ' ') return { char: ' ', style: {} }

        if (index < resolved) return { char, style: {} }

        let randomChar = SIMPLE_SYMBOLS[randInt(SIMPLE_SYMBOLS.length)]
        if (isComplex && rand() > 0.3) {
          randomChar = COMPLEX_CHARS[randInt(COMPLEX_CHARS.length)]
        }

        const yOffset = (frame % 2 === 0 ? -1 : 1) * (2 + rand() * 3)

        let style: React.CSSProperties = {
          opacity: 0.7,
          display: 'inline-block',
          width: '1ch',
          textAlign: 'center',
          transform: `translateY(${yOffset}px)`,
          transition: `transform ${DURATION.snap}s cubic-bezier(0.4, 0, 0.2, 1)`,
        }

        if (isComplex) {
          const rotate = randInt(10) - 5
          const scale = 0.9 + rand() * 0.2
          style = {
            ...style,
            transform: `translateY(${yOffset}px) rotate(${rotate}deg) scale(${scale})`,
            color: rand() > 0.8 ? '#0052FF' : 'inherit',
          }
        }

        return { char: randomChar, style }
      })

      setOutput(next)

      if (frameCountRef.current < maxFrames) {
        frameRef.current = requestAnimationFrame(animate)
      }
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [trigger, text, speed, complexity])

  const fontClass = font === 'doto' ? 'font-doto' : font === 'mono' ? 'font-mono' : 'font-sans'
  const visible = trigger ? output : baselineOutput

  return (
    <span className={`${fontClass} ${className} inline-flex whitespace-pre`}>
      {visible.map((item, i) => (
        <span key={i} style={item.style} className="transition-transform duration-150">
          {item.char}
        </span>
      ))}
    </span>
  )
}
