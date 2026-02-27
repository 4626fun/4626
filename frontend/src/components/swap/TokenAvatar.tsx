import { useMemo, useState } from 'react'

import { getTokenLogo, markTokenLogoSuccess, type TokenLogoSeed } from '@/lib/tokens/tokenLogo'

function initials(label: string): string {
  const text = (label || '').trim()
  if (!text) return '??'
  const chunks = text.split(/[^A-Za-z0-9]+/).filter(Boolean)
  if (chunks.length >= 2) return `${chunks[0]?.[0] ?? ''}${chunks[1]?.[0] ?? ''}`.toUpperCase()
  return text.slice(0, 2).toUpperCase()
}

export function TokenAvatar(props: {
  token: TokenLogoSeed
  symbol: string
  size?: number
  ringClass?: string
  className?: string
  withFallbackLabel?: boolean
  noFallback?: boolean
}) {
  const size = props.size ?? 28
  const tokenLogo = useMemo(() => getTokenLogo(props.token), [props.token])
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState(false)

  const candidates = useMemo(() => {
    return [tokenLogo.preferred, ...tokenLogo.fallbackUrls].filter(Boolean) as string[]
  }, [tokenLogo.preferred, tokenLogo.fallbackUrls])

  const current = candidates[index]
  const finalRingClass = props.ringClass ?? 'border-white/12'

  function handleImageError() {
    if (index < candidates.length - 1) {
      setIndex((value) => value + 1)
      setFailed(false)
      return
    }
    setFailed(true)
  }

  function handleImageLoad() {
    if (!tokenLogo.cacheHit && current) {
      markTokenLogoSuccess(tokenLogo.cacheKey, current)
    }
  }

  if (!candidates.length) {
    if (props.noFallback) return null
    return (
      <div
        className={`grid place-items-center rounded-full border bg-vault-card text-[10px] font-semibold text-zinc-100 ${props.className ?? ''}`}
        style={{ width: size, height: size, borderColor: 'rgba(255,255,255,0.14)' }}
      >
        {props.withFallbackLabel ? initials(props.symbol) : ''}
      </div>
    )
  }

  return (
    <div
      className={`grid place-items-center rounded-full bg-black/30 ${props.className ?? ''}`}
      style={{
        width: size,
        height: size,
        border: `1px solid rgba(255,255,255,0.16)`,
        overflow: 'hidden',
      }}
    >
      {!failed ? (
        <img
          key={current}
          src={current}
          alt={props.symbol}
          loading="lazy"
          onError={handleImageError}
          onLoad={handleImageLoad}
          className={`h-full w-full rounded-full object-cover ${finalRingClass}`}
          style={{ borderColor: 'rgba(255,255,255,0.16)' }}
        />
      ) : (
        <span className="text-[10px] font-semibold text-zinc-100">{initials(props.symbol)}</span>
      )}
    </div>
  )
}
