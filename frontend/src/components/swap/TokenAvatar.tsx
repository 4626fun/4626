import { useEffect, useMemo, useState } from 'react'

import { getTokenLogo, markTokenLogoSuccess, type TokenLogoSeed } from '@/lib/tokens/tokenLogo'

function initials(label: string): string {
  const text = (label || '').trim()
  if (!text) return '??'
  const chunks = text.split(/[^A-Za-z0-9]+/).filter(Boolean)
  if (chunks.length >= 2) return `${chunks[0]?.[0] ?? ''}${chunks[1]?.[0] ?? ''}`.toUpperCase()
  return text.slice(0, 2).toUpperCase()
}

export function TokenAvatar(props: {
  token?: TokenLogoSeed
  imageUrl?: string | null
  symbol: string
  size?: number
  ringClass?: string
  className?: string
  withFallbackLabel?: boolean
  noFallback?: boolean
  badge?: string
  badgeLabel?: string
  variant?: 'default' | 'hero'
}) {
  const size = props.size ?? 28
  const variant = props.variant ?? 'default'
  const tokenLogo = useMemo(() => {
    if (!props.token) {
      return {
        preferred: null,
        fallbackUrls: [],
        cacheHit: true,
        cacheKey: '',
      }
    }
    return getTokenLogo(props.token)
  }, [props.token])
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState(false)

  const candidates = useMemo(() => {
    const seen = new Set<string>()
    const ordered = [props.imageUrl, tokenLogo.preferred, ...tokenLogo.fallbackUrls]
      .filter((value): value is string => Boolean(value))
      .filter((value) => {
        if (seen.has(value)) return false
        seen.add(value)
        return true
      })
    return ordered
  }, [props.imageUrl, tokenLogo.preferred, tokenLogo.fallbackUrls])

  const candidateKey = useMemo(() => candidates.join('|'), [candidates])
  const resolvedIndex = index < candidates.length ? index : 0
  const current = candidates[resolvedIndex]
  const finalRingClass = props.ringClass ?? 'border-white/12'

  useEffect(() => {
    // Reset failed/image cursor whenever the token candidate list changes.
    // Without this, one failed token can leave subsequent tokens stuck on fallback initials.
    setIndex(0)
    setFailed(false)
  }, [candidateKey])

  function handleImageError() {
    if (resolvedIndex < candidates.length - 1) {
      setIndex((value) => value + 1)
      setFailed(false)
      return
    }
    setFailed(true)
  }

  function handleImageLoad() {
    if (!props.token) return
    if (!tokenLogo.cacheHit && current) {
      markTokenLogoSuccess(tokenLogo.cacheKey, current)
    }
  }

  if (!candidates.length) {
    if (props.noFallback) return null
    return (
      <div
        className={`grid place-items-center rounded-full border bg-vault-cardRaised text-[10px] font-semibold text-vault-text ${props.className ?? ''}`}
        style={{ width: size, height: size, borderColor: 'rgb(var(--vault-border-strong) / 0.75)' }}
      >
        {props.withFallbackLabel ? initials(props.symbol) : ''}
      </div>
    )
  }

  if (variant === 'hero') {
    return (
      <div
        className={`relative shrink-0 ${props.className ?? ''}`}
        style={{ width: size, height: size }}
      >
        <div className="absolute inset-0 rounded-full overflow-hidden bg-black border border-white/10 shadow-[inset_0_0_24px_rgba(0,0,0,0.9)]">
          {!failed ? (
            <img
              key={current}
              src={current}
              alt={props.symbol}
              loading="lazy"
              onError={handleImageError}
              onLoad={handleImageLoad}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-white/6 via-black to-black">
              <span className="font-serif text-white/80 select-none">{initials(props.symbol).slice(0, 1)}</span>
            </div>
          )}
          <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_32px_rgba(0,0,0,0.85)]" />
          <div className="absolute inset-0 pointer-events-none opacity-35 mix-blend-overlay bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.75)_0%,transparent_60%)]" />
        </div>

        {props.badge ? (
          <div
            className="absolute -bottom-1 -right-1 rounded-full backdrop-blur-md border border-brand-primary/20 bg-black/70 text-brand-accent leading-none text-[10px] px-2 py-0.5"
            aria-label={props.badgeLabel ?? props.badge}
            title={props.badgeLabel ?? props.badge}
          >
            {props.badge}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={`grid place-items-center rounded-full bg-vault-cardRaised/70 ${props.className ?? ''}`}
      style={{
        width: size,
        height: size,
        border: `1px solid rgb(var(--vault-border-strong) / 0.72)`,
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
          style={{ borderColor: 'rgb(var(--vault-border-strong) / 0.72)' }}
        />
      ) : (
        <span className="text-[10px] font-semibold text-vault-text">{initials(props.symbol)}</span>
      )}
    </div>
  )
}
