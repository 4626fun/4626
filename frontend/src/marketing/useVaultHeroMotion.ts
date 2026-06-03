import { useEffect, useState } from 'react'

function detectLowPowerDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  return typeof dm === 'number' && dm > 0 && dm < 4
}

export function useVaultHeroMotion() {
  const [reduceMotion, setReduceMotion] = useState(false)
  const [lowPower] = useState(() => detectLowPowerDevice())
  const [lightningPulse, setLightningPulse] = useState(0)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduceMotion(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setMouse({
        x: e.clientX / window.innerWidth - 0.5,
        y: e.clientY / window.innerHeight - 0.5,
      })
    }
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  useEffect(() => {
    const onLightning = (e: Event) => {
      const detail = (e as CustomEvent<{ intensity?: number }>).detail
      setLightningPulse(detail?.intensity ?? 1)
      window.setTimeout(() => setLightningPulse(0), 900)
    }
    window.addEventListener('vault:lightning', onLightning)
    return () => window.removeEventListener('vault:lightning', onLightning)
  }, [])

  return { reduceMotion, lowPower, lightningPulse, mouse, scrollY }
}
