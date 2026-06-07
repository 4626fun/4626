import { useMemo, useState } from 'react'

import {
  getTokenLogo,
  isBlockedTokenLogoUrl,
  markTokenLogoSuccess,
  type TokenLogoSeed,
} from '@/lib/tokens/tokenLogo'

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
  const [cursor, setCursor] = useState(() => ({
    candidateKey: '',
    index: 0,
    failed: false,
  }))

  const candidates = useMemo(() => {
    const seen = new Set<string>()
    const ordered = [props.imageUrl, tokenLogo.preferred, ...tokenLogo.fallbackUrls]
      .filter((value): value is string => Boolean(value))
      .filter((value) => !isBlockedTokenLogoUrl(value))
      .filter((value) => {
        if (seen.has(value)) return false
        seen.add(value)
        return true
      })
    return ordered
  }, [props.imageUrl, tokenLogo.preferred, tokenLogo.fallbackUrls])

  const candidateKey = useMemo(() => candidates.join('|'), [candidates])
  const activeCursor =
    cursor.candidateKey === candidateKey
      ? cursor
      : {
          candidateKey,
          index: 0,
          failed: false,
        }
  const resolvedIndex = activeCursor.index < candidates.length ? activeCursor.index : 0
  const current = candidates[resolvedIndex]
  const finalRingClass = props.ringClass ?? 'border-white/12'

  if (props.noFallback && activeCursor.failed) {
    return null
  }

  function handleImageError() {
    if (resolvedIndex < candidates.length - 1) {
      setCursor((value) => {
        const base =
          value.candidateKey === candidateKey
            ? value
            : {
                candidateKey,
                index: 0,
                failed: false,
              }
        return {
          candidateKey,
          index: base.index + 1,
          failed: false,
        }
      })
      return
    }
    setCursor({
      candidateKey,
      index: resolvedIndex,
      failed: true,
    })
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
        className={`grid place-items-center rounded-full border bg-[#121212] text-[10px] font-semibold text-zinc-400 ${props.className ?? ''}`}
        style={{ width: size, height: size, borderColor: 'rgb(255 255 255 / 0.12)' }}
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
          {!activeCursor.failed ? (
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
      className={`grid place-items-center rounded-full bg-[#121212]/90 ${props.className ?? ''}`}
      style={{
        width: size,
        height: size,
        border: `1px solid rgb(255 255 255 / 0.12)`,
        overflow: 'hidden',
      }}
    >
      {!activeCursor.failed ? (
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
        <span className="text-[10px] font-semibold text-zinc-400">{initials(props.symbol)}</span>
      )}
    </div>
  )
}
