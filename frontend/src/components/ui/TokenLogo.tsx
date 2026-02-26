import { memo, useState } from 'react'

type TokenLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface TokenLogoProps {
  symbol: string
  logoUrl?: string | null
  logoUrls?: string[]
  size?: TokenLogoSize
  className?: string
}

const sizeMap: Record<TokenLogoSize, { container: string; text: string; initials: number }> = {
  xs: { container: 'h-5 w-5', text: 'text-[8px]', initials: 1 },
  sm: { container: 'h-6 w-6', text: 'text-[9px]', initials: 1 },
  md: { container: 'h-8 w-8', text: 'text-[11px]', initials: 2 },
  lg: { container: 'h-10 w-10', text: 'text-sm', initials: 2 },
  xl: { container: 'h-12 w-12', text: 'text-base', initials: 2 },
}

function buildCandidates(logoUrl: string | null | undefined, logoUrls: string[] | undefined): string[] {
  const raw = [logoUrl, ...(logoUrls ?? [])]
  const valid = raw.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
  return Array.from(new Set(valid))
}

function generateColor(symbol: string): string {
  let hash = 0
  const s = (symbol || '??').toUpperCase()
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 35%, 25%)`
}

export const TokenLogo = memo(function TokenLogo({
  symbol,
  logoUrl,
  logoUrls,
  size = 'md',
  className = '',
}: TokenLogoProps) {
  const candidates = buildCandidates(logoUrl, logoUrls)
  const [idx, setIdx] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const current = candidates[idx] ?? null
  const { container, text, initials } = sizeMap[size]
  const initStr = (symbol || '??').slice(0, initials).toUpperCase()

  if (!current) {
    return (
      <div
        className={`${container} rounded-full border border-white/10 flex items-center justify-center ${text} font-semibold text-zinc-100 shrink-0 ${className}`}
        style={{ backgroundColor: generateColor(symbol) }}
        role="img"
        aria-label={symbol || 'Token'}
      >
        {initStr}
      </div>
    )
  }

  return (
    <div className={`${container} relative rounded-full shrink-0 ${className}`}>
      {!loaded && (
        <div
          className={`absolute inset-0 rounded-full border border-white/10 animate-pulse shrink-0`}
          style={{ backgroundColor: generateColor(symbol) }}
        />
      )}
      <img
        src={current}
        alt={symbol || 'Token'}
        className={`${container} rounded-full object-cover border border-white/10 bg-black/30 shrink-0 transition-opacity duration-150 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false)
          setIdx((prev) => prev + 1)
        }}
      />
    </div>
  )
})
