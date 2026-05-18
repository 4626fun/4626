import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ExternalLink, ArrowLeft, Coins, TrendingUp, MessageSquare, Play, FileText, Image as ImageIcon, X } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { PageMeta } from '@/components/seo/PageMeta'
import { getAddress, isAddress } from 'viem'
import { useQuery } from '@tanstack/react-query'

import { ExploreCopyButton } from '@/components/explore/ExploreUiPrimitives'
import { InfiniteContentGallery3D } from '@/components/explore/InfiniteContentGallery3D'
import { LoadingInline, LoadingText } from '@/components/ui/LoadingState'
import { requestOpenChat } from '@/lib/chat/openChat'
import { fetchZoraCoin } from '@/lib/zora/client'
import { useZoraProfile, useZoraProfileCoins } from '@/lib/zora/hooks'
import type { ZoraCoin, ZoraProfile } from '@/lib/zora/types'
import { getPoolSwaps, getPoolsByToken } from '@/lib/uniswap/client'
import type { UniswapPool, UniswapSwap } from '@/lib/uniswap/types'
import {
  formatDateLabel,
  formatShortAddress,
  formatTimestamp,
  formatTokenAmount,
  formatUsd,
  isSupportedExploreChain,
  parseNumber,
  toDisplayAssetUrl,
} from '@/features/explore/exploreShared'

const CONTENT_COINS_PAGE_SIZE = 20
gsap.registerPlugin(ScrollTrigger)

type ContentMediaKind = 'video' | 'text' | 'visual'
type FlybyLayout = {
  top: string
  left: string
  size: string
  rotate: number
  startY: number
  endY: number
  opacity: number
}

const FLYBY_LAYOUTS: FlybyLayout[] = [
  { top: '8%', left: '7%', size: 'w-20 h-20 sm:w-24 sm:h-24', rotate: -7, startY: -140, endY: 60, opacity: 0.65 },
  { top: '14%', left: '74%', size: 'w-24 h-24 sm:w-28 sm:h-28', rotate: 5, startY: -170, endY: 45, opacity: 0.82 },
  { top: '28%', left: '18%', size: 'w-16 h-16 sm:w-20 sm:h-20', rotate: 8, startY: -120, endY: 72, opacity: 0.58 },
  { top: '34%', left: '62%', size: 'w-20 h-20 sm:w-24 sm:h-24', rotate: -5, startY: -110, endY: 80, opacity: 0.68 },
  { top: '48%', left: '84%', size: 'w-24 h-24 sm:w-32 sm:h-32', rotate: 6, startY: -150, endY: 50, opacity: 0.86 },
  { top: '59%', left: '11%', size: 'w-20 h-20 sm:w-24 sm:h-24', rotate: -9, startY: -130, endY: 70, opacity: 0.7 },
  { top: '66%', left: '55%', size: 'w-16 h-16 sm:w-20 sm:h-20', rotate: 7, startY: -100, endY: 75, opacity: 0.56 },
  { top: '78%', left: '73%', size: 'w-20 h-20 sm:w-24 sm:h-24', rotate: -4, startY: -105, endY: 60, opacity: 0.7 },
  { top: '83%', left: '29%', size: 'w-16 h-16 sm:w-20 sm:h-20', rotate: 9, startY: -120, endY: 68, opacity: 0.6 },
  { top: '21%', left: '41%', size: 'w-14 h-14 sm:w-16 sm:h-16', rotate: -6, startY: -90, endY: 82, opacity: 0.5 },
]
const ZORA_TOKEN_LOGO_URL = '/brands/zora-token.svg'

function formatNumber(value: string | number | undefined): string {
  if (!value) return '-'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '-'
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`
  return `$${num.toFixed(2)}`
}

function shortAddress(addr: string): string {
  return formatShortAddress(addr, '')
}

function formatMonthDay(value?: string | null): string {
  if (!value) return '-- --'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-- --'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function PremiumCursor({ enabled }: { enabled: boolean }) {
  const cursorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!enabled) return
    const cursor = cursorRef.current
    if (!cursor) return

    let fadeTimeout: ReturnType<typeof setTimeout> | null = null
    const moveHandler = (event: MouseEvent) => {
      cursor.style.left = `${event.clientX}px`
      cursor.style.top = `${event.clientY}px`
      cursor.style.opacity = '1'
      if (fadeTimeout) clearTimeout(fadeTimeout)
      fadeTimeout = setTimeout(() => {
        cursor.style.opacity = '0.28'
      }, 1200)
    }

    document.addEventListener('mousemove', moveHandler, { passive: true })
    return () => {
      document.removeEventListener('mousemove', moveHandler)
      if (fadeTimeout) clearTimeout(fadeTimeout)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <div
      ref={cursorRef}
      className="fixed left-0 top-0 w-8 h-8 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[120] transition-opacity duration-300 mix-blend-difference"
      style={{
        opacity: 0.28,
        background: 'radial-gradient(circle, rgba(165,243,252,0.55) 0%, transparent 72%)',
        border: '1px solid rgba(165,243,252,0.32)',
        borderRadius: '9999px',
      }}
      aria-hidden
    />
  )
}

// Dexscreener Chart Embed Component
function DexscreenerChart({ pairAddress, tokenAddress }: { pairAddress?: string; tokenAddress: string }) {
  // Dexscreener embeds work with pair addresses, but we can use token address as fallback
  const embedUrl = pairAddress 
    ? `https://dexscreener.com/base/${pairAddress}?embed=1&theme=dark&trades=0&info=0`
    : `https://dexscreener.com/base/${tokenAddress}?embed=1&theme=dark&trades=0&info=0`

  return (
    <div className="w-full rounded-xl overflow-hidden bg-vault-card/40">
      <div className="w-full min-h-[280px] sm:min-h-[360px] md:min-h-[420px] aspect-4/3 sm:aspect-video md:aspect-16/10">
        <iframe
          src={embedUrl}
          title="Price Chart"
          className="w-full h-full border-0"
          loading="lazy"
          allow="clipboard-write"
          allowFullScreen
        />
      </div>
    </div>
  )
}

// ============================================================================
// OFFICIAL BRAND ICONS
// Social icons from Simple Icons (https://simpleicons.org) - MIT licensed
// Web3 platform logos use official favicon URLs
// ============================================================================

// X (Twitter) - Simple Icons: https://simpleicons.org/icons/x.svg
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  )
}

// Instagram - Simple Icons: https://simpleicons.org/icons/instagram.svg
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077" />
    </svg>
  )
}

// TikTok - Simple Icons: https://simpleicons.org/icons/tiktok.svg
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  )
}

// Calculate total earnings from creatorEarnings array
function calculateTotalEarnings(earnings: ZoraCoin['creatorEarnings']): string {
  if (!earnings || !Array.isArray(earnings) || earnings.length === 0) return '$0.00'
  let total = 0
  for (const e of earnings) {
    const usd = parseFloat(e.amountUsd || '0')
    if (!isNaN(usd)) total += usd
  }
  if (total === 0) return '$0.00'
  if (total < 0.01) return `$${total.toFixed(4)}`
  if (total < 1) return `$${total.toFixed(3)}`
  if (total < 1000) return `$${total.toFixed(2)}`
  if (total >= 1_000_000) return `$${(total / 1_000_000).toFixed(2)}M`
  if (total >= 1_000) return `$${(total / 1_000).toFixed(2)}K`
  return `$${total.toFixed(2)}`
}

const VIDEO_EXTENSION_REGEX = /\.(mp4|webm|mov|m4v|m3u8|mpd|ogv)(\?.*)?$/i

function detectContentMediaKind(coin: ZoraCoin): ContentMediaKind {
  const mime = String(coin.mediaContent?.mimeType || '').toLowerCase()
  const originalUri = String(coin.mediaContent?.originalUri || '').toLowerCase()

  if (mime.startsWith('video/') || VIDEO_EXTENSION_REGEX.test(originalUri)) return 'video'
  if (
    mime.startsWith('text/') ||
    mime.includes('json') ||
    mime.includes('markdown') ||
    mime.includes('html') ||
    (!coin.mediaContent?.previewImage?.small &&
      !coin.mediaContent?.previewImage?.medium &&
      Boolean((coin.description || '').trim()))
  ) {
    return 'text'
  }
  return 'visual'
}

function getContentCoinAssetUrl(coin: ZoraCoin): string | undefined {
  return toDisplayAssetUrl(
    coin.mediaContent?.previewImage?.medium ||
      coin.mediaContent?.previewImage?.small ||
      coin.mediaContent?.originalUri
  )
}

function getMediaTone(kind: ContentMediaKind): {
  panelClass: string
  accentClass: string
  overlayClass: string
} {
  if (kind === 'video') {
    return {
      panelClass: 'border-cyan-300/25 bg-cyan-500/5 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_0_20px_rgba(34,211,238,0.12)]',
      accentClass: 'text-cyan-200',
      overlayClass: 'from-cyan-400/0 via-cyan-400/16 to-blue-400/0',
    }
  }
  if (kind === 'text') {
    return {
      panelClass: 'border-amber-300/25 bg-amber-500/5 shadow-[0_0_0_1px_rgba(251,191,36,0.08),0_0_20px_rgba(251,191,36,0.1)]',
      accentClass: 'text-amber-200',
      overlayClass: 'from-amber-400/0 via-amber-300/14 to-orange-400/0',
    }
  }
  return {
    panelClass: 'border-blue-300/25 bg-blue-500/5 shadow-[0_0_0_1px_rgba(96,165,250,0.08),0_0_20px_rgba(59,130,246,0.12)]',
    accentClass: 'text-blue-200',
    overlayClass: 'from-blue-500/0 via-sky-400/16 to-cyan-400/0',
  }
}

function getSceneCardEntrance(index: number) {
  const patterns = [
    {
      gsapFrom: { opacity: 0, x: -56, y: 40, rotation: -6, scale: 0.9, filter: 'blur(9px)' },
      hover: { y: -8, rotate: -1.1, scale: 1.015 },
      duration: 0.78,
      delay: 0.04 * index,
    },
    {
      gsapFrom: { opacity: 0, x: 54, y: 54, rotation: 5, scale: 0.88, filter: 'blur(10px)' },
      hover: { y: -10, rotate: 1.2, scale: 1.02 },
      duration: 0.83,
      delay: 0.05 * index,
    },
    {
      gsapFrom: { opacity: 0, y: 80, rotationX: 12, scale: 0.86, filter: 'blur(7px)' },
      hover: { y: -7, scale: 1.014 },
      duration: 0.72,
      delay: 0.06 * index,
    },
    {
      gsapFrom: { opacity: 0, x: -36, y: -24, rotation: -4, scale: 0.92, filter: 'blur(8px)' },
      hover: { y: -9, rotate: -0.9, scale: 1.018 },
      duration: 0.76,
      delay: 0.03 * index,
    },
    {
      gsapFrom: { opacity: 0, x: 26, y: -40, rotation: 4, scale: 0.9, filter: 'blur(8px)' },
      hover: { y: -8, rotate: 0.8, scale: 1.016 },
      duration: 0.7,
      delay: 0.045 * index,
    },
    {
      gsapFrom: { opacity: 0, x: 0, y: 72, rotation: 0, scale: 0.84, filter: 'blur(10px)' },
      hover: { y: -10, scale: 1.02 },
      duration: 0.8,
      delay: 0.05 * index,
    },
  ] as const
  return patterns[index % patterns.length] ?? patterns[0]
}

function ContentMediaBadge({ kind }: { kind: ContentMediaKind }) {
  if (kind === 'video') {
    return (
      <span className="inline-flex items-center gap-1.5 border border-cyan-300/35 bg-cyan-500/10 px-2 py-1 text-[10px] font-mono uppercase tracking-[1.5px] text-cyan-200 shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_0_16px_rgba(34,211,238,0.18)]">
        <Play className="w-3 h-3" />
        Video
      </span>
    )
  }
  if (kind === 'text') {
    return (
      <span className="inline-flex items-center gap-1.5 border border-amber-300/35 bg-amber-500/10 px-2 py-1 text-[10px] font-mono uppercase tracking-[1.5px] text-amber-200 shadow-[0_0_0_1px_rgba(251,191,36,0.12),0_0_16px_rgba(251,191,36,0.16)]">
        <FileText className="w-3 h-3" />
        Text
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 border border-blue-300/35 bg-blue-500/10 px-2 py-1 text-[10px] font-mono uppercase tracking-[1.5px] text-blue-200 shadow-[0_0_0_1px_rgba(96,165,250,0.12),0_0_16px_rgba(59,130,246,0.18)]">
      <ImageIcon className="w-3 h-3" />
      Visual
    </span>
  )
}

function ActionAddressHint({
  label,
  address,
  copyButtonProps,
}: {
  label: string
  address: string
  copyButtonProps: {
    title: string
    resetMs: number
    copiedIconClassName: string
  }
}) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 opacity-0 translate-y-1 transition-all duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-focus-within:translate-y-0">
      <div className="inline-flex items-center gap-2 rounded-md bg-black/90 px-2.5 py-1.5 text-[11px] font-mono text-zinc-200 shadow-[0_8px_20px_rgba(0,0,0,0.35)]">
        <span className="uppercase tracking-[1.1px] text-zinc-400">{label}</span>
        <span>{shortAddress(address)}</span>
        <ExploreCopyButton text={address} className="p-1 hover:bg-white/10" {...copyButtonProps} />
      </div>
    </div>
  )
}

function TokenGlyph({ logoUrl, symbol }: { logoUrl?: string | null; symbol: string }) {
  if (logoUrl) {
    return (
      <span className="inline-flex w-5 h-5 rounded-full overflow-hidden border border-white/20 bg-black/40 shrink-0">
        <img src={logoUrl} alt={symbol} className="w-full h-full object-cover" />
      </span>
    )
  }
  return (
    <span className="inline-flex w-5 h-5 rounded-full items-center justify-center border border-white/20 bg-white/10 text-[10px] font-mono uppercase text-zinc-200 shrink-0">
      {symbol.slice(0, 1)}
    </span>
  )
}

function resolveTokenLogo({
  symbol,
  tokenId,
  creatorTokenId,
  creatorTokenLogo,
}: {
  symbol: string
  tokenId?: string
  creatorTokenId?: string | null
  creatorTokenLogo?: string | null
}): string | null {
  const normalizedSymbol = symbol.trim().toUpperCase()
  const normalizedTokenId = tokenId?.toLowerCase() ?? ''
  const normalizedCreator = creatorTokenId?.toLowerCase() ?? ''
  if (normalizedTokenId && normalizedCreator && normalizedTokenId === normalizedCreator) {
    return creatorTokenLogo ?? null
  }
  if (normalizedSymbol === 'ZORA') return ZORA_TOKEN_LOGO_URL
  return null
}

// Content Coin Row Component - shows revenue instead of price
function ContentCoinRow({ coin, rank, onSelect }: { coin: ZoraCoin; rank: number; onSelect: (coin: ZoraCoin) => void }) {
  const avatarUrl = coin.mediaContent?.previewImage?.small
  const name = coin.name || coin.symbol || 'Untitled'
  const symbol = coin.symbol || '???'
  const totalVolume = formatNumber(coin.totalVolume)

  return (
    <button
      type="button"
      onClick={() => onSelect(coin)}
      className="group flex items-center gap-4 sm:gap-6 px-4 sm:px-6 py-4 sm:py-5 hover:bg-white/5 transition-all rounded-2xl active:scale-[0.995]"
    >
      <span className="text-xs sm:text-sm text-zinc-500 w-7 text-center tabular-nums shrink-0">#{rank}</span>
      
      {avatarUrl ? (
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl overflow-hidden ring-1 ring-white/10 shrink-0">
          <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-linear-to-br from-zinc-800 to-zinc-900 ring-1 ring-white/10 flex items-center justify-center shrink-0">
          <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-500" />
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <div className="text-sm sm:text-base text-zinc-100 font-medium truncate group-hover:text-white transition-colors">{name}</div>
        <div className="text-xs text-zinc-500 mt-1">{symbol}</div>
      </div>
      
      <div className="text-right hidden md:block shrink-0">
        <div className="text-xs text-zinc-500">Volume</div>
        <div className="text-sm text-zinc-200">{totalVolume}</div>
      </div>
    </button>
  )
}

// Social Links Component
function SocialLinks({ profile, compact = false }: { profile: ZoraProfile | null; compact?: boolean }) {
  if (!profile?.socialAccounts) return null

  const { twitter, instagram, tiktok } = profile.socialAccounts

  const links = [
    twitter?.username && {
      name: 'X',
      url: `https://x.com/${twitter.username}`,
      icon: <XIcon className="w-4 h-4" />,
      handle: `@${twitter.username}`,
      followers: twitter.followerCount,
    },
    instagram?.username && {
      name: 'Instagram',
      url: `https://instagram.com/${instagram.username}`,
      icon: <InstagramIcon className="w-4 h-4" />,
      handle: `@${instagram.username}`,
      followers: instagram.followerCount,
    },
    tiktok?.username && {
      name: 'TikTok',
      url: `https://tiktok.com/@${tiktok.username}`,
      icon: <TikTokIcon className="w-4 h-4" />,
      handle: `@${tiktok.username}`,
      followers: tiktok.followerCount,
    },
  ].filter(Boolean) as Array<{
    name: string
    url: string
    icon: React.ReactNode
    handle: string
    followers?: number
  }>

  if (links.length === 0) return null

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={link.name}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-xs text-zinc-300"
          >
            <span className="text-zinc-400">{link.icon}</span>
            <span>{link.handle}</span>
            <ExternalLink className="w-3 h-3 text-zinc-500" />
          </a>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {links.map((link) => (
        <a
          key={link.name}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center text-zinc-300">
              <span className="scale-95">{link.icon}</span>
            </div>
            <div className="min-w-0">
              <span className="text-sm text-white">{link.handle}</span>
              {link.followers && (
                <div className="text-xs text-zinc-500">
                  {link.followers.toLocaleString()} followers
                </div>
              )}
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
        </a>
      ))}
    </div>
  )
}

function ResourceLinks({ tokenAddress, compact = false }: { tokenAddress: string; compact?: boolean }) {
  const links = [
    {
      name: 'Zora',
      href: `https://zora.co/coin/base:${tokenAddress}`,
      iconUrl: '/brands/zora-token.svg',
    },
    {
      name: 'Dexscreener',
      href: `https://dexscreener.com/base/${tokenAddress}`,
      iconUrl: 'https://green-decisive-crane-434.mypinata.cloud/ipfs/bafkreia3wpaw347dpdn5sewij3nsdpgzoa7i4n5toohojedrdvyvhx52le',
    },
    {
      name: 'Basescan',
      href: `https://basescan.org/token/${tokenAddress}`,
      iconUrl: 'https://green-decisive-crane-434.mypinata.cloud/ipfs/bafkreidse2dmc2h5myecpddbm53xwbn62yq4l4af7fnpi362prhk6f2hoi',
    },
  ]

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={link.name}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-xs text-zinc-300"
          >
            <span className="w-4 h-4 overflow-hidden shrink-0">
              <img src={link.iconUrl} alt={link.name} className="w-full h-full object-contain" />
            </span>
            <span>{link.name}</span>
            <ExternalLink className="w-3 h-3 text-zinc-500" />
          </a>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {links.map((link) => (
        <a
          key={link.name}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center p-1.5 overflow-hidden">
              <img src={link.iconUrl} alt={link.name} className="w-full h-full object-contain" />
            </div>
            <span className="text-sm text-white truncate">{link.name}</span>
          </div>
          <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
        </a>
      ))}
    </div>
  )
}

export function ExploreCreatorDetail() {
  const params = useParams()
  const chain = String(params.chain ?? '').trim()
  const tokenAddressRaw = String(params.tokenAddress ?? '').trim()
  const [activeTab, setActiveTab] = useState<'chart' | 'coins'>('chart')
  const [contentCoinsPage, setContentCoinsPage] = useState(1)
  const [volumeWindow, setVolumeWindow] = useState<'24h' | 'all'>('24h')
  const [allowParallax, setAllowParallax] = useState(false)
  const [showCursor, setShowCursor] = useState(false)
  const [isContentTrayOpen, setIsContentTrayOpen] = useState(false)
  const [activeContentCoin, setActiveContentCoin] = useState<ZoraCoin | null>(null)
  const [narrativeProgress, setNarrativeProgress] = useState(0)
  const [timelineDragging, setTimelineDragging] = useState(false)
  const heroRef = useRef<HTMLDivElement | null>(null)
  const sceneSectionRef = useRef<HTMLElement | null>(null)
  const timelineScrollerRef = useRef<HTMLDivElement | null>(null)
  const narrativeTargetRef = useRef(0)
  const narrativeProgressRef = useRef(0)
  const timelineDragRef = useRef<{ active: boolean; startX: number; scrollLeft: number }>({
    active: false,
    startX: 0,
    scrollLeft: 0,
  })

  const tokenAddress = isAddress(tokenAddressRaw) ? getAddress(tokenAddressRaw) : null

  // Fetch the main creator coin
  const { data: coin, isLoading } = useQuery({
    queryKey: ['coin', tokenAddress],
    queryFn: async () => {
      if (!tokenAddress) return null
      return fetchZoraCoin(tokenAddress as `0x${string}`, 8453)
    },
    enabled: !!tokenAddress,
    staleTime: 30_000,
  })

  // Get creator address from the coin
  const creatorAddress = coin?.creatorAddress || coin?.payoutRecipientAddress

  // Fetch creator profile using their address or handle
  const profileIdentifier = coin?.creatorProfile?.handle || creatorAddress
  const { data: creatorProfile } = useZoraProfile(profileIdentifier ?? undefined)

  // Fetch all coins created by this creator (profileCoins) - no limit
  const { data: profileCoinsData, isLoading: profileCoinsLoading } = useZoraProfileCoins(
    profileIdentifier ?? undefined,
    { count: 1000 } // Fetch all coins
  )

  // Extract created coins from profile data
  const createdCoins = useMemo(() => {
    const edges = (profileCoinsData as ZoraProfile | null)?.createdCoins?.edges ?? []
    return edges.map((e) => e.node).filter(Boolean) as ZoraCoin[]
  }, [profileCoinsData])

  // Separate content coins from creator coin
  const contentCoins = useMemo(() => {
    return createdCoins.filter((c) => c.coinType !== 'CREATOR')
  }, [createdCoins])

  const visualStoryCoins = useMemo(
    () =>
      [...contentCoins]
        .filter((coin) => detectContentMediaKind(coin) !== 'text')
        .sort((a, b) => parseNumber(b.totalVolume) - parseNumber(a.totalVolume))
        .slice(0, 8),
    [contentCoins]
  )
  const narrativeFlybyCoins = useMemo(() => {
    const merged = [...visualStoryCoins, ...contentCoins]
    const seen = new Set<string>()
    const picked: ZoraCoin[] = []
    for (const coin of merged) {
      const key = coin.address || coin.id || `${coin.name || coin.symbol || 'coin'}-${picked.length}`
      if (seen.has(key)) continue
      const image = getContentCoinAssetUrl(coin)
      if (!image) continue
      seen.add(key)
      picked.push(coin)
      if (picked.length >= 10) break
    }
    return picked
  }, [visualStoryCoins, contentCoins])
  const timelineCoins = useMemo(
    () =>
      [...contentCoins]
        .sort((a, b) => {
          const aTs = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const bTs = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return bTs - aTs
        })
        .slice(0, 30),
    [contentCoins]
  )
  const totalContentPages = Math.max(1, Math.ceil(contentCoins.length / CONTENT_COINS_PAGE_SIZE))
  const contentPage = Math.min(Math.max(contentCoinsPage, 1), totalContentPages)
  const pagedContentCoins = useMemo(() => {
    const start = (contentPage - 1) * CONTENT_COINS_PAGE_SIZE
    return contentCoins.slice(start, start + CONTENT_COINS_PAGE_SIZE)
  }, [contentCoins, contentPage])

  const contentPageItems = useMemo(() => {
    if (totalContentPages <= 7) {
      return Array.from({ length: totalContentPages }, (_, i) => i + 1)
    }

    const items: Array<number | 'ellipsis'> = [1]
    const start = Math.max(2, contentPage - 1)
    const end = Math.min(totalContentPages - 1, contentPage + 1)

    if (start > 2) items.push('ellipsis')
    for (let i = start; i <= end; i++) items.push(i)
    if (end < totalContentPages - 1) items.push('ellipsis')
    items.push(totalContentPages)

    return items
  }, [contentPage, totalContentPages])

  const symbol = coin?.symbol || '...'

  const { data: pools = [] } = useQuery({
    queryKey: ['uniswap', 'poolsByToken', tokenAddress],
    queryFn: async () => {
      if (!tokenAddress) return []
      return getPoolsByToken(tokenAddress)
    },
    enabled: Boolean(tokenAddress),
    staleTime: 60_000,
  })

  const primaryPool = useMemo<UniswapPool | null>(() => {
    if (!pools || pools.length === 0) return null
    return [...pools].sort((a, b) => parseNumber(b.totalValueLockedUSD) - parseNumber(a.totalValueLockedUSD))[0] ?? null
  }, [pools])

  const { data: swaps = [], isLoading: swapsLoading } = useQuery({
    queryKey: ['uniswap', 'poolSwaps', primaryPool?.id],
    queryFn: async () => {
      if (!primaryPool?.id) return []
      return getPoolSwaps(primaryPool.id, 10)
    },
    enabled: Boolean(primaryPool?.id),
    staleTime: 30_000,
  })

  const recentTransactions = useMemo(() => {
    const creatorCoinAddressLower = tokenAddress?.toLowerCase() ?? ''
    return (swaps ?? []).map((swap: UniswapSwap) => {
      const amount0 = parseNumber(swap.amount0)
      const amount1 = parseNumber(swap.amount1)
      const creatorCoinInToken0 = swap.token0.id.toLowerCase() === creatorCoinAddressLower
      const creatorCoinAmount = creatorCoinInToken0 ? amount0 : amount1
      const side = creatorCoinAmount < 0 ? 'Buy' : creatorCoinAmount > 0 ? 'Sell' : 'Swap'
      return {
        id: swap.id,
        timestamp: parseNumber(swap.timestamp || swap.transaction?.timestamp || 0),
        side,
        amountUsd: parseNumber(swap.amountUSD),
        creatorCoinAmount,
        otherAmount: creatorCoinInToken0 ? amount1 : amount0,
        creatorCoinSymbol: creatorCoinInToken0 ? (swap.token0.symbol || symbol) : (swap.token1.symbol || symbol),
        otherSymbol: creatorCoinInToken0 ? (swap.token1.symbol || 'TOKEN') : (swap.token0.symbol || 'TOKEN'),
        creatorCoinTokenId: creatorCoinInToken0 ? swap.token0.id : swap.token1.id,
        otherTokenId: creatorCoinInToken0 ? swap.token1.id : swap.token0.id,
        wallet: swap.origin || swap.sender,
        txHash: swap.transaction?.id ?? '',
      }
    })
  }, [swaps, tokenAddress, symbol])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const reducedMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const finePointerMq = window.matchMedia('(pointer: fine)')
    const desktopMq = window.matchMedia('(min-width: 1024px)')

    const updateMotionPrefs = () => {
      const canAnimate = !reducedMotionMq.matches
      setAllowParallax(canAnimate)
      setShowCursor(canAnimate && finePointerMq.matches && desktopMq.matches)
    }
    updateMotionPrefs()

    const listener = () => updateMotionPrefs()
    reducedMotionMq.addEventListener('change', listener)
    finePointerMq.addEventListener('change', listener)
    desktopMq.addEventListener('change', listener)
    return () => {
      reducedMotionMq.removeEventListener('change', listener)
      finePointerMq.removeEventListener('change', listener)
      desktopMq.removeEventListener('change', listener)
    }
  }, [])

  useEffect(() => {
    let rafId = 0
    const cycleMs = 32000
    const startAt = performance.now()
    const animate = () => {
      const elapsed = performance.now() - startAt
      narrativeTargetRef.current = elapsed / cycleMs
      const current = narrativeProgressRef.current
      const target = narrativeTargetRef.current
      const next = current + (target - current) * 0.05
      narrativeProgressRef.current = next
      setNarrativeProgress(next)
      rafId = window.requestAnimationFrame(animate)
    }
    rafId = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(rafId)
  }, [])

  useGSAP(
    () => {
      const cleanups: Array<() => void> = []
      if (heroRef.current && allowParallax) {
        const tween = gsap.to(heroRef.current, {
          yPercent: -8,
          ease: 'none',
          scrollTrigger: {
            trigger: heroRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.9,
          },
        })
        cleanups.push(() => {
          tween.scrollTrigger?.kill()
          tween.kill()
        })
      }
      if (sceneSectionRef.current && allowParallax) {
        const sceneCards = gsap.utils.toArray<HTMLElement>('[data-scene-card]', sceneSectionRef.current)
        if (sceneCards.length > 0) {
          gsap.set(sceneCards, { transformPerspective: 1000, willChange: 'transform,opacity,filter' })
          const timeline = gsap.timeline({
            defaults: { ease: 'power3.out' },
            scrollTrigger: {
              trigger: sceneSectionRef.current,
              start: 'top 78%',
              end: 'bottom 55%',
              scrub: 0.8,
            },
          })
          sceneCards.forEach((card, index) => {
            const entrance = getSceneCardEntrance(index)
            timeline.fromTo(
              card,
              entrance.gsapFrom,
              {
                opacity: 1,
                x: 0,
                y: 0,
                rotation: 0,
                rotationX: 0,
                scale: 1,
                filter: 'blur(0px)',
                duration: entrance.duration,
              },
              entrance.delay,
            )
          })
          cleanups.push(() => {
            timeline.scrollTrigger?.kill()
            timeline.kill()
            gsap.set(sceneCards, { clearProps: 'all' })
          })
        }
      }
      return () => {
        cleanups.forEach((cleanup) => cleanup())
      }
    },
    { dependencies: [allowParallax] }
  )

  useEffect(() => {
    if (!isContentTrayOpen) return
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsContentTrayOpen(false)
    }
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [isContentTrayOpen])

  if (!chain || !isSupportedExploreChain(chain)) {
    return <Navigate replace to="/explore/creators" />
  }

  if (!tokenAddress) {
    return <Navigate replace to="/explore/creators" />
  }

  // Profile info
  const profile = creatorProfile || (profileCoinsData as ZoraProfile | null)
  const avatarUrl = profile?.avatar?.medium || profile?.avatar?.small || coin?.mediaContent?.previewImage?.medium || coin?.creatorProfile?.avatar?.previewImage?.medium
  const displayName = profile?.displayName || coin?.name || 'Creator'
  const handle = profile?.handle || coin?.creatorProfile?.handle
  const bio = profile?.bio
  const website = profile?.website
  const marketCap = formatNumber(coin?.marketCap)
  const volume24h = formatNumber(coin?.volume24h)
  const totalVolume = formatNumber(coin?.totalVolume)
  const holders = coin?.uniqueHolders ? coin.uniqueHolders.toLocaleString() : '-'
  const createdAt = formatDateLabel(coin?.createdAt)
  const totalCoinsCreated = createdCoins.length
  const creatorChatPeer = profile?.publicWallet?.walletAddress || creatorAddress || coin?.payoutRecipientAddress || ''
  const creatorChatAddress = creatorChatPeer && isAddress(creatorChatPeer) ? getAddress(creatorChatPeer) : null
  const copyButtonProps = {
    title: 'Copy address',
    resetMs: 2000,
    copiedIconClassName: 'w-4 h-4 text-green-500',
  } as const
  const sceneCandidates = [...contentCoins].sort((a, b) => parseNumber(b.totalVolume) - parseNumber(a.totalVolume))
  const imageBasedSceneCoins = sceneCandidates.filter(
    (candidate) => detectContentMediaKind(candidate) === 'visual' && Boolean(getContentCoinAssetUrl(candidate))
  )
  const fallbackSceneCoins = sceneCandidates.filter(
    (candidate) => !imageBasedSceneCoins.includes(candidate)
  )
  const sceneCoins = [...imageBasedSceneCoins, ...fallbackSceneCoins].slice(0, 7)
  const leadSceneCoin = imageBasedSceneCoins[0] ?? sceneCoins[0] ?? null
  const leadSceneCoinImage = (leadSceneCoin ? getContentCoinAssetUrl(leadSceneCoin) : undefined) || avatarUrl || null
  const creatorCoinKind = coin ? detectContentMediaKind(coin) : null
  const creatorCoinImage =
    coin && creatorCoinKind === 'visual'
      ? getContentCoinAssetUrl(coin)
      : undefined
  const heroIconImage = creatorCoinImage || leadSceneCoinImage || avatarUrl || null
  const leadSceneCoinName = leadSceneCoin?.name || leadSceneCoin?.symbol || displayName
  const creatorTokenLogo =
    coin?.mediaContent?.previewImage?.small ||
    coin?.mediaContent?.previewImage?.medium ||
    leadSceneCoinImage ||
    null
  const openContentTray = (coin: ZoraCoin) => {
    setActiveContentCoin(coin)
    setIsContentTrayOpen(true)
  }
  const closeContentTray = () => setIsContentTrayOpen(false)
  const ambientNarrativeProgress = allowParallax ? narrativeProgress : 0.5
  const onTimelinePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = timelineScrollerRef.current
    if (!container) return
    timelineDragRef.current = {
      active: true,
      startX: event.clientX,
      scrollLeft: container.scrollLeft,
    }
    setTimelineDragging(true)
    container.setPointerCapture(event.pointerId)
  }
  const onTimelinePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!timelineDragRef.current.active) return
    const container = timelineScrollerRef.current
    if (!container) return
    const delta = event.clientX - timelineDragRef.current.startX
    container.scrollLeft = timelineDragRef.current.scrollLeft - delta
  }
  const onTimelinePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = timelineScrollerRef.current
    timelineDragRef.current.active = false
    setTimelineDragging(false)
    if (container) {
      const step = window.innerWidth >= 640 ? 340 : 280
      const snapped = Math.round(container.scrollLeft / step) * step
      container.scrollTo({ left: snapped, behavior: 'smooth' })
    }
    if (container?.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId)
    }
  }
  const onTimelinePointerCancel = () => {
    timelineDragRef.current.active = false
    setTimelineDragging(false)
  }
  const onTimelineWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const container = timelineScrollerRef.current
    if (!container) return
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
    event.preventDefault()
    container.scrollBy({ left: event.deltaY * 0.85, behavior: 'smooth' })
  }
  const activeCoinMediaKind = activeContentCoin ? detectContentMediaKind(activeContentCoin) : null
  const activeCoinImage = activeContentCoin ? getContentCoinAssetUrl(activeContentCoin) : undefined
  const activeCoinOriginal = activeContentCoin ? toDisplayAssetUrl(activeContentCoin.mediaContent?.originalUri) : undefined
  const activeCoinAddress = activeContentCoin?.address || ''
  const activeCoinDescription = (activeContentCoin?.description || '').trim()

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white overflow-hidden">
      <PremiumCursor enabled={showCursor} />
      <PageMeta
        title={displayName !== 'Creator' ? `${displayName} (${symbol})` : 'Creator Detail'}
        description={`Explore ${displayName}'s creator coin ${symbol} — view vault, trades, and activity on 4626.`}
        canonicalPath={`/explore/${chain}/${tokenAddressRaw}`}
      />
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(59,130,246,0.12),transparent_50%),radial-gradient(circle_at_82%_78%,rgba(56,189,248,0.1),transparent_52%)]" />
        {narrativeFlybyCoins.map((coin, idx) => {
          const layout: FlybyLayout = FLYBY_LAYOUTS[idx % FLYBY_LAYOUTS.length] ?? FLYBY_LAYOUTS[0]!
          const image = getContentCoinAssetUrl(coin)
          const phase = ambientNarrativeProgress * 0.018 + idx * 0.135
          const lane = phase - Math.floor(phase)
          const depth = 1 - Math.abs(lane - 0.5) * 2

          // Match the gallery's intentional fade windows (in/out by lane depth)
          let depthOpacity = 0
          if (lane >= 0.05 && lane <= 0.25) {
            depthOpacity = (lane - 0.05) / 0.2
          } else if (lane > 0.25 && lane < 0.86) {
            depthOpacity = 1
          } else if (lane >= 0.86 && lane <= 0.98) {
            depthOpacity = 1 - (lane - 0.86) / 0.12
          }

          // Subtle lane drift so cards feel like moving through depth
          const xDrift = Math.sin(phase * Math.PI * 2 * 0.62 + idx) * 6
          const yDrift = Math.cos(phase * Math.PI * 2 * 0.48 + idx * 0.75) * 5
          const zPush = (depth - 0.5) * 38
          const scale = 0.84 + depth * 0.26
          const blur = (1 - depth) * 1.6
          const flyOpacity = depthOpacity * Math.min(layout.opacity + 0.08, 0.72)

          if (!image) return null
          return (
            <div
              key={coin.address || coin.id || `ambient-flyby-${idx}`}
              className={`absolute ${layout.size} overflow-hidden rounded-xl transition-opacity`}
              style={{
                top: layout.top,
                left: layout.left,
                opacity: flyOpacity,
                zIndex: 1,
                transform: `perspective(900px) translate3d(${xDrift}px, ${yDrift}px, ${zPush}px) scale(${scale})`,
                willChange: 'transform, opacity',
                filter: `blur(${blur}px)`,
              }}
            >
              <img
                src={image}
                alt={coin.name || coin.symbol || 'Content coin'}
                className="w-full h-full object-cover"
                style={{ filter: `brightness(${0.62 + depth * 0.3}) saturate(${0.7 + depth * 0.18}) contrast(0.92)` }}
              />
            </div>
          )
        })}
      </div>
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Back navigation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8"
        >
          <Link
            to="/explore/creators"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-all duration-200 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Creators
          </Link>
        </motion.div>

        {/* Recreated hero scene */}
        <section className="relative mb-16 sm:mb-20 overflow-hidden bg-black">
          {leadSceneCoinImage ? (
            <div className="absolute inset-0 pointer-events-none">
              <img src={leadSceneCoinImage} alt={leadSceneCoinName} className="w-full h-full object-cover opacity-40" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/35" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/70" />
            </div>
          ) : null}
          <div className="absolute inset-0 opacity-15 pointer-events-none">
            {[...Array(7)].map((_, i) => (
              <div key={`hero-grid-h-${i}`} className="absolute h-px bg-white/30 left-0 right-0" style={{ top: `${12.5 * (i + 1)}%` }} />
            ))}
            {[...Array(11)].map((_, i) => (
              <div key={`hero-grid-v-${i}`} className="absolute w-px bg-white/30 top-0 bottom-0" style={{ left: `${8.3 * (i + 1)}%` }} />
            ))}
          </div>

          <motion.div
            ref={heroRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative min-h-[78vh] p-6 sm:p-8 lg:p-12 flex flex-col justify-between"
          >
            <div className="max-w-4xl">
              <span className="inline-flex items-center gap-3 text-[11px] sm:text-xs font-mono uppercase tracking-[2px] text-zinc-400 mb-8">
                <span className="w-10 sm:w-12 h-px bg-white/30" />
                {handle ? `@${handle}` : 'Creator'}
              </span>

              <div className="flex items-start gap-4 sm:gap-6">
                <div className="mt-1 w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden border border-white/20 bg-black/40 shrink-0">
                  {heroIconImage ? (
                    <img
                      src={heroIconImage}
                      alt={`${symbol} creator coin icon`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300 text-sm font-mono uppercase">
                      {symbol.slice(0, 1)}
                    </div>
                  )}
                </div>
                <h1 className="text-[clamp(2.2rem,8vw,7rem)] leading-[0.9] tracking-tight font-semibold text-white">
                  {displayName}
                  <br />
                  <span className="text-white/35">creator economy.</span>
                </h1>
              </div>

              {bio ? (
                <p className="mt-8 text-base sm:text-lg text-zinc-300 leading-relaxed max-w-2xl">{bio}</p>
              ) : null}

              <div className="flex flex-wrap gap-3 mt-8">
                <div className="group relative inline-flex">
                  <Link
                    to={`/swap?token=${tokenAddress}`}
                    className="px-7 py-3 rounded-full bg-white text-black font-semibold text-sm sm:text-base hover:bg-white/90 transition-colors"
                  >
                    Buy {symbol}
                  </Link>
                  <ActionAddressHint label="Creator coin" address={tokenAddress} copyButtonProps={copyButtonProps} />
                </div>
                {creatorChatAddress ? (
                  <div className="group relative inline-flex">
                    <button
                      type="button"
                      onClick={() =>
                        requestOpenChat({
                          kind: 'dm',
                          peerAddress: creatorChatAddress,
                          nameHint: displayName || undefined,
                          imageUrl: avatarUrl || undefined,
                        })
                      }
                      className="px-7 py-3 rounded-full border border-white/20 text-white font-medium text-sm sm:text-base inline-flex items-center gap-2 hover:bg-white/10 transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Message Creator
                    </button>
                    <ActionAddressHint label="Creator wallet" address={creatorAddress || creatorChatAddress} copyButtonProps={copyButtonProps} />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8 mt-10">
              {[
                { value: volumeWindow === '24h' ? volume24h : totalVolume, label: volumeWindow === '24h' ? '24H volume' : 'All-time volume' },
                { value: marketCap, label: 'Market cap' },
                { value: holders, label: 'Holders' },
                { value: totalCoinsCreated, label: 'Coins created' },
                { value: createdAt, label: 'Created' },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col gap-2">
                  <span className="text-3xl sm:text-4xl font-semibold text-white">{stat.value}</span>
                  <span className="text-xs text-zinc-400 font-mono uppercase tracking-[2px]">{stat.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="absolute bottom-0 inset-x-0 z-20 px-6 sm:px-8 py-3 flex flex-wrap items-center gap-3 pointer-events-auto text-zinc-300">
            {website ? (
              <a
                href={website.startsWith('http') ? website : `https://${website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono uppercase tracking-[2px] text-cyan-400 hover:text-white transition-colors px-2"
              >
                {website.replace(/^https?:\/\//, '')}
              </a>
            ) : null}
            <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-3">
              <SocialLinks profile={profile} compact />
              <ResourceLinks tokenAddress={tokenAddress} compact />
            </div>
          </div>
        </section>

        <section
          ref={sceneSectionRef}
          className="relative mb-20 sm:mb-24 -mx-4 sm:-mx-6 px-4 sm:px-6 py-10 sm:py-12 overflow-hidden"
        >
          <div className="pointer-events-none absolute inset-0 opacity-20 [background:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:90px_90px]" />
          <div className="pointer-events-none absolute -top-20 left-1/4 w-72 h-72 bg-blue-500/14 blur-[120px]" />
          <div className="pointer-events-none absolute -bottom-16 right-1/4 w-80 h-80 bg-sky-500/12 blur-[130px]" />
          <div className="relative mb-10 sm:mb-12 px-2 sm:px-4">
            <div className="grid lg:grid-cols-12 gap-6 sm:gap-8 items-end">
              <div className="lg:col-span-7">
                <span className="inline-flex items-center gap-3 text-[11px] sm:text-xs font-mono uppercase tracking-[2px] text-zinc-500 mb-6">
                  <span className="w-10 sm:w-12 h-px bg-white/30" />
                  Collections
                </span>
                <h2 className="text-5xl sm:text-6xl lg:text-[96px] font-semibold tracking-tight leading-[0.9]">
                  Content
                  <br />
                  <span className="text-white/35">coins.</span>
                </h2>
              </div>
              <div className="lg:col-span-5 lg:pb-4">
                <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
                  A live collection built from {displayName}&apos;s highest-activity coins — ordered by volume, surfaced as a visual scene.
                </p>
              </div>
            </div>
          </div>

          {imageBasedSceneCoins.length > 0 ? (
            <div className="relative grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4 sm:gap-5 px-2 sm:px-4">
              {(() => {
                const leadCoin = imageBasedSceneCoins[0]
                const leadCoinName = leadCoin?.name || leadCoin?.symbol || 'Untitled'
                const leadCoinSymbol = leadCoin?.symbol || '???'
                const leadCoinImage = leadCoin?.mediaContent?.previewImage?.medium || leadCoin?.mediaContent?.previewImage?.small || null
                const leadCoinVolume = formatNumber(leadCoin?.totalVolume)
                const leadCoinKind = leadCoin ? detectContentMediaKind(leadCoin) : 'visual'
                const leadTone = getMediaTone(leadCoinKind)
                const sideCoins = sceneCoins.filter((coin) => coin !== leadCoin)

                return (
                  <>
                    <motion.button
                      type="button"
                      onClick={() => leadCoin && openContentTray(leadCoin)}
                      data-scene-card
                      className="group relative border-0 bg-black/90 overflow-hidden min-h-[380px] sm:min-h-[500px]"
                      whileHover={{ y: -10, scale: 1.012 }}
                    >
                      <div className="absolute inset-0">
                        {leadCoinImage ? (
                          <img src={leadCoinImage} alt={leadCoinName} className="w-full h-full object-cover opacity-75 group-hover:scale-[1.045] transition-transform duration-700" />
                        ) : (
                          <div className="w-full h-full bg-linear-to-br from-zinc-800 to-zinc-950" />
                        )}
                        <div className="absolute inset-0 bg-linear-to-t from-black via-black/55 to-black/5" />
                        <div className={`absolute inset-0 bg-linear-to-r ${leadTone.overlayClass} opacity-45 group-hover:opacity-70 transition-opacity duration-500`} />
                      </div>
                      <div className="relative h-full p-6 sm:p-8 flex flex-col justify-end">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-5xl sm:text-6xl font-semibold tracking-tight text-white/20 leading-none">01</span>
                          <span className="text-[11px] font-mono uppercase tracking-[2px] text-zinc-300">Featured Content Coin</span>
                        </div>
                        <h3 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white">{leadCoinName}</h3>
                        <div className={`text-sm mt-1 font-mono tracking-[1.2px] uppercase ${leadTone.accentClass}`}>{leadCoinSymbol}</div>
                        <div className="mt-5">
                          <div className="text-[10px] uppercase tracking-[1.5px] text-zinc-400">All-time volume</div>
                          <div className="mt-1 text-xl sm:text-2xl font-medium text-white/95 tracking-tight">{leadCoinVolume}</div>
                        </div>
                      </div>
                    </motion.button>

                    <motion.div
                      data-scene-card
                      className="min-h-[380px] sm:min-h-[500px]"
                      whileHover={{ y: -6, scale: 1.005 }}
                    >
                      <InfiniteContentGallery3D
                        coins={sideCoins}
                        onSelect={openContentTray}
                        className="h-full"
                      />
                    </motion.div>
                  </>
                )
              })()}
            </div>
          ) : (
            <div className="rounded-3xl bg-zinc-900/50 backdrop-blur p-10 text-center text-zinc-500">
              No visual content coins available to render the scene yet.
            </div>
          )}
        </section>

        <section className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 mb-16 sm:mb-20 bg-[#d9df72] text-zinc-900 px-4 sm:px-6 py-10 sm:py-12">
          <div className="px-2 sm:px-4 pb-8">
            <div className="grid lg:grid-cols-12 gap-6 items-end">
              <div className="lg:col-span-8">
                <span className="inline-flex items-center gap-3 text-[11px] sm:text-xs font-mono uppercase tracking-[2px] text-zinc-700 mb-4">
                  <span className="w-10 sm:w-12 h-px bg-black/35" />
                  Content Timeline
                </span>
                <h3 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[0.9]">
                  A trail of creator
                  <br />
                  content momentum.
                </h3>
              </div>
              <div className="lg:col-span-4 flex lg:justify-end">
                <div className="inline-flex items-center gap-3 border border-black/20 bg-white/65 px-4 py-2 text-[11px] font-mono uppercase tracking-[1.8px]">
                  <span className="w-8 h-8 rounded-full bg-white border border-black/20 inline-flex items-center justify-center text-[10px]">
                    DRAG
                  </span>
                  Swipe or drag horizontally
                </div>
              </div>
            </div>
          </div>

          <div
            ref={timelineScrollerRef}
            className={`overflow-x-auto scrollbar-hide select-none scroll-smooth snap-x snap-mandatory pl-[10vw] sm:pl-[14vw] lg:pl-[18vw] pr-2 sm:pr-4 ${timelineDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            onPointerDown={onTimelinePointerDown}
            onPointerMove={onTimelinePointerMove}
            onPointerUp={onTimelinePointerUp}
            onPointerLeave={onTimelinePointerCancel}
            onPointerCancel={onTimelinePointerCancel}
            onWheel={onTimelineWheel}
          >
            <div className="flex min-w-max">
              {timelineCoins.length === 0 ? (
                <div className="px-8 py-10 text-sm text-zinc-700">No content coins available for timeline yet.</div>
              ) : (
                timelineCoins.map((coin, idx) => {
                  const image = getContentCoinAssetUrl(coin)
                  const monthDay = formatMonthDay(coin.createdAt)
                  return (
                    <button
                      key={coin.address || coin.id || `timeline-${idx}`}
                      type="button"
                      onClick={() => openContentTray(coin)}
                      className={`w-[280px] sm:w-[340px] p-6 text-left hover:bg-black/5 transition-all duration-300 snap-start ${
                        idx === 0 ? 'ml-2 sm:ml-4 lg:ml-10' : ''
                      } ${
                        idx === timelineCoins.length - 1 ? 'mr-8 sm:mr-12 lg:mr-16' : ''
                      } ${
                        idx % 3 === 1 ? 'sm:translate-y-10' : idx % 3 === 2 ? 'sm:-translate-y-6' : ''
                      }`}
                    >
                      <div className="text-5xl sm:text-6xl font-semibold tracking-tight leading-none mb-5">{monthDay}</div>
                      {image ? (
                        <div className="w-full aspect-[4/3] bg-white/80 overflow-hidden mb-4 shadow-[0_10px_28px_rgba(0,0,0,0.12)]">
                          <img src={image} alt={coin.name || coin.symbol || 'Content coin'} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-full aspect-[4/3] bg-white/60 mb-4 flex items-center justify-center text-zinc-500">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                      )}
                      <div className="text-lg font-medium leading-tight">{coin.name || coin.symbol || 'Untitled'}</div>
                      <div className="mt-2 text-xs font-mono uppercase tracking-[1.4px] text-zinc-700">{coin.symbol || '???'}</div>
                      <p className="mt-3 text-xs text-zinc-800 leading-relaxed line-clamp-3">
                        {(coin.description || 'Open tray for full content context.').trim()}
                      </p>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </section>

        {/* Main content */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-8 sm:space-y-10"
          >
            <section className="relative bg-black overflow-hidden">
              <div className="pointer-events-none absolute inset-0 opacity-10">
                {[...Array(5)].map((_, i) => (
                  <div key={`tabs-grid-h-${i}`} className="absolute h-px bg-white/40 left-0 right-0" style={{ top: `${16.6 * (i + 1)}%` }} />
                ))}
              </div>
              <div className="px-5 sm:px-7 pt-5 sm:pt-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <span className="inline-flex items-center gap-3 text-[11px] sm:text-xs font-mono uppercase tracking-[2px] text-zinc-500">
                    <span className="w-10 sm:w-12 h-px bg-white/35" />
                    Market Interface
                  </span>
                  <div className="text-[10px] sm:text-xs text-zinc-500 font-mono uppercase tracking-[2px]">
                    {activeTab === 'chart' ? 'Chart mode' : 'Coin index mode'}
                  </div>
                </div>
                <div className="flex overflow-x-auto scrollbar-hide gap-2 pb-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab('chart')}
                    className={`group inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                      activeTab === 'chart'
                        ? 'bg-white text-black'
                        : 'bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    Price Chart
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('coins')}
                    className={`group inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                      activeTab === 'coins'
                        ? 'bg-white text-black'
                        : 'bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Coins className="w-4 h-4" />
                    Content Coins ({contentCoins.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setVolumeWindow((w) => (w === '24h' ? 'all' : '24h'))}
                    className="ml-auto inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-300" />
                    Volume: {volumeWindow === '24h' ? '24H' : 'ALL'}
                  </button>
                </div>
              </div>
            </section>

            {/* Chart Tab */}
            {activeTab === 'chart' && (
              <>
                <section className="relative -mt-8 sm:-mt-10 bg-black overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-fuchsia-500/10" />
                  <div className="relative px-6 sm:px-8 pt-2 pb-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <span className="inline-flex items-center gap-3 text-[11px] sm:text-xs font-mono uppercase tracking-[2px] text-zinc-500 mb-4">
                          <span className="w-10 sm:w-12 h-px bg-white/35" />
                          Price Discovery
                        </span>
                        <h3 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-[0.95]">
                          {displayName}
                          <br />
                          <span className="text-white/35">{symbol} market tape.</span>
                        </h3>
                      </div>
                      <a
                        href={`https://dexscreener.com/base/${tokenAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[2px] text-zinc-400 hover:text-white transition-colors"
                      >
                        Open Dexscreener
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  <div className="relative">
                    {isLoading ? (
                      <div className="h-[400px] flex items-center justify-center">
                        <LoadingInline intent="page" labelOverride="Loading..." />
                      </div>
                    ) : (
                      <DexscreenerChart tokenAddress={tokenAddress} />
                    )}
                  </div>
                </section>

                <section className="-mt-8 sm:-mt-10 bg-black overflow-hidden">
                  <div className="px-6 sm:px-8 pt-2 pb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <span className="inline-flex items-center gap-3 text-[11px] sm:text-xs font-mono uppercase tracking-[2px] text-zinc-500 mb-3">
                        <span className="w-10 sm:w-12 h-px bg-white/35" />
                        Transactions
                      </span>
                      <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Recent Activity</div>
                      <div className="text-xs sm:text-sm text-zinc-400 mt-2">Latest swaps from the highest-liquidity pool</div>
                    </div>
                    {primaryPool?.id ? (
                      <a
                        href={`https://app.uniswap.org/explore/pools/base/${primaryPool.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[2px] text-zinc-400 hover:text-white transition-colors"
                      >
                        View Pool
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : null}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] text-sm">
                      <thead>
                        <tr className="text-left text-zinc-500 text-[11px] uppercase tracking-[1.5px] font-mono">
                          <th className="px-6 sm:px-8 py-4 sm:py-5 font-normal">Time</th>
                          <th className="px-6 sm:px-8 py-4 sm:py-5 font-normal">Type</th>
                          <th className="px-6 sm:px-8 py-4 sm:py-5 text-right font-normal">USD</th>
                          <th className="px-6 sm:px-8 py-4 sm:py-5 text-right font-normal">{symbol}</th>
                          <th className="px-6 sm:px-8 py-4 sm:py-5 text-right font-normal">Pair</th>
                          <th className="px-6 sm:px-8 py-4 sm:py-5 text-right font-normal">Wallet</th>
                        </tr>
                      </thead>
                      <tbody>
                        {swapsLoading ? (
                          <tr>
                            <td colSpan={6} className="px-6 sm:px-8 py-10 text-center text-zinc-600">
                              <LoadingText intent="processing" labelOverride="Loading swaps..." />
                            </td>
                          </tr>
                        ) : recentTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 sm:px-8 py-10 text-center text-zinc-600">
                              No swap data available for this creator coin yet.
                            </td>
                          </tr>
                        ) : (
                          recentTransactions.map((row) => (
                            <tr key={row.id} className="hover:bg-white/[0.03] transition-colors">
                              <td className="px-6 sm:px-8 py-4 sm:py-5 text-zinc-400">{formatTimestamp(row.timestamp)}</td>
                              <td className="px-6 sm:px-8 py-4 sm:py-5">
                                <span
                                  className={`inline-flex px-2.5 py-1 text-[11px] font-medium font-mono uppercase tracking-[1px] ${
                                    row.side === 'Buy'
                                      ? 'bg-emerald-500/10 text-emerald-300'
                                      : row.side === 'Sell'
                                        ? 'bg-rose-500/10 text-rose-300'
                                        : 'bg-zinc-600/20 text-zinc-300'
                                  }`}
                                >
                                  {row.side}
                                </span>
                              </td>
                              <td className="px-6 sm:px-8 py-4 sm:py-5 text-right text-white tabular-nums">{formatUsd(row.amountUsd)}</td>
                              <td className="px-6 sm:px-8 py-4 sm:py-5 text-right text-zinc-300 tabular-nums">
                                <div className="inline-flex items-center justify-end gap-2 w-full">
                                  <span>{formatTokenAmount(row.creatorCoinAmount)}</span>
                                  <TokenGlyph
                                    symbol={row.creatorCoinSymbol}
                                    logoUrl={resolveTokenLogo({
                                      symbol: row.creatorCoinSymbol,
                                      tokenId: row.creatorCoinTokenId,
                                      creatorTokenId: tokenAddress,
                                      creatorTokenLogo,
                                    })}
                                  />
                                </div>
                              </td>
                              <td className="px-6 sm:px-8 py-4 sm:py-5 text-right text-zinc-300 tabular-nums">
                                <div className="inline-flex items-center justify-end gap-2 w-full">
                                  <span>{formatTokenAmount(row.otherAmount)}</span>
                                  <TokenGlyph
                                    symbol={row.otherSymbol}
                                    logoUrl={resolveTokenLogo({
                                      symbol: row.otherSymbol,
                                      tokenId: row.otherTokenId,
                                      creatorTokenId: tokenAddress,
                                      creatorTokenLogo,
                                    })}
                                  />
                                </div>
                              </td>
                              <td className="px-6 sm:px-8 py-4 sm:py-5 text-right">
                                {row.txHash ? (
                                  <a
                                    href={`https://basescan.org/tx/${row.txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-zinc-300 hover:text-white font-mono text-xs"
                                  >
                                    {shortAddress(row.wallet)}
                                  </a>
                                ) : (
                                  <span className="text-zinc-400 font-mono text-xs">{shortAddress(row.wallet)}</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {/* Content Coins Tab */}
            {activeTab === 'coins' && (
              <section className="bg-black overflow-hidden">
                <div className="px-6 sm:px-8 py-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <span className="inline-flex items-center gap-3 text-[11px] sm:text-xs font-mono uppercase tracking-[2px] text-zinc-500 mb-3">
                        <span className="w-10 sm:w-12 h-px bg-white/35" />
                        Content Index
                      </span>
                      <h3 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-[0.95]">
                        {displayName}&apos;s content
                        <br />
                        <span className="text-white/35">coin archive.</span>
                      </h3>
                    </div>
                    <div className="text-xs sm:text-sm text-zinc-400 max-w-sm sm:text-right">
                      Ranked collection of all creator-minted content coins on Zora.
                    </div>
                  </div>
                  {contentCoins.length > CONTENT_COINS_PAGE_SIZE && (
                    <div className="mt-5 pt-5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <button
                        type="button"
                        onClick={() => setContentCoinsPage((p) => Math.max(1, p - 1))}
                        disabled={contentPage <= 1}
                        className="px-3 py-1.5 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:hover:text-zinc-400"
                      >
                        Prev
                      </button>
                      <div className="flex items-center gap-1">
                        {contentPageItems.map((item, idx) =>
                          item === 'ellipsis' ? (
                            <span key={`ellipsis-${idx}`} className="px-1 text-zinc-600">
                              …
                            </span>
                          ) : (
                            <button
                              key={`page-${item}`}
                              type="button"
                              onClick={() => setContentCoinsPage(item)}
                              className={`min-w-[30px] px-2 py-1 text-[11px] font-mono ${
                                item === contentPage
                                  ? 'bg-white text-black'
                                  : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                              }`}
                              aria-current={item === contentPage ? 'page' : undefined}
                            >
                              {item}
                            </button>
                          )
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setContentCoinsPage((p) => Math.min(totalContentPages, p + 1))}
                        disabled={contentPage >= totalContentPages}
                        className="px-3 py-1.5 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:hover:text-zinc-400"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>

                {profileCoinsLoading ? (
                  <div className="p-8 flex items-center justify-center">
                    <LoadingInline intent="processing" labelOverride="Loading..." />
                  </div>
                ) : contentCoins.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500">
                    No content coins found for this creator.
                  </div>
                ) : (
                  <div className="divide-y divide-white/10">
                    {pagedContentCoins.map((contentCoin, index) => (
                      <ContentCoinRow
                        key={contentCoin.address || contentCoin.id || index}
                        coin={contentCoin}
                        rank={(contentPage - 1) * CONTENT_COINS_PAGE_SIZE + index + 1}
                        onSelect={openContentTray}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Description */}
            {coin?.description && (
              <motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="relative bg-black overflow-hidden"
              >
                <div className="pointer-events-none absolute inset-y-0 left-0 w-[2px] bg-linear-to-b from-cyan-300/80 via-white/60 to-fuchsia-300/80" />
                <div className="px-6 sm:px-8 py-6 sm:py-7">
                  <span className="inline-flex items-center gap-3 text-[11px] sm:text-xs font-mono uppercase tracking-[2px] text-zinc-500 mb-3">
                    <span className="w-10 sm:w-12 h-px bg-white/35" />
                    Creator Statement
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mb-4">About {displayName}</h3>
                  <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-4xl">{coin.description}</p>
                </div>
              </motion.section>
            )}
          </motion.div>
        </div>
      </div>
      {isContentTrayOpen && activeContentCoin ? (
        <div className="fixed inset-0 z-[130]">
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
            onClick={closeContentTray}
            aria-label="Close content coin tray"
          />
          <aside className="absolute left-0 top-0 h-full w-full max-w-[460px] bg-black/95 shadow-[22px_0_80px_rgba(0,0,0,0.65)] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-black/90 backdrop-blur px-5 sm:px-6 py-4 flex items-center justify-between">
              <span className="inline-flex items-center gap-3 text-[11px] sm:text-xs font-mono uppercase tracking-[2px] text-zinc-500">
                <span className="w-10 h-px bg-white/35" />
                Content Coin Tray
              </span>
              <button
                type="button"
                onClick={closeContentTray}
                    className="inline-flex items-center justify-center w-8 h-8 text-zinc-400 hover:text-white transition-colors"
                aria-label="Close tray"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 sm:p-6 space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/15 bg-zinc-900 shrink-0">
                  {activeCoinImage ? (
                    <img src={activeCoinImage} alt={activeContentCoin.name || activeContentCoin.symbol || 'Content coin'} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500">
                      <Coins className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-2xl font-semibold tracking-tight text-white truncate">
                    {activeContentCoin.name || activeContentCoin.symbol || 'Untitled'}
                  </h3>
                  <div className="text-sm text-zinc-400 mt-1">{activeContentCoin.symbol || '???'}</div>
                  <div className="mt-3">
                    {activeCoinMediaKind ? <ContentMediaBadge kind={activeCoinMediaKind} /> : null}
                  </div>
                </div>
              </div>

              <div className="bg-zinc-950/30 overflow-hidden rounded-xl">
                {activeCoinMediaKind === 'video' && activeCoinOriginal ? (
                  <video
                    src={activeCoinOriginal}
                    controls
                    muted
                    playsInline
                    poster={activeCoinImage}
                    className="w-full aspect-video bg-black"
                  />
                ) : activeCoinImage ? (
                  <img
                    src={activeCoinImage}
                    alt={activeContentCoin.name || activeContentCoin.symbol || 'Content asset'}
                    className="w-full aspect-video object-contain bg-black"
                  />
                ) : (
                  <div className="w-full aspect-video bg-zinc-900 flex items-center justify-center text-zinc-500">
                    No media preview
                  </div>
                )}
                {activeCoinMediaKind === 'text' ? (
                  <div className="p-4">
                    <div className="text-[11px] font-mono uppercase tracking-[1.8px] text-zinc-500 mb-2">Text payload</div>
                    <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                      {activeCoinDescription || 'Text coin detected via metadata. Open full detail for source context.'}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-500/10 px-3 py-3 rounded-lg">
                  <div className="text-[11px] font-mono uppercase tracking-[1.5px] text-zinc-500">Earned</div>
                  <div className="text-base text-blue-200 mt-1">{calculateTotalEarnings(activeContentCoin.creatorEarnings)}</div>
                </div>
                <div className="bg-zinc-950/20 px-3 py-3 rounded-lg">
                  <div className="text-[11px] font-mono uppercase tracking-[1.5px] text-zinc-500">All-time volume</div>
                  <div className="text-base text-white mt-1">{formatNumber(activeContentCoin.totalVolume)}</div>
                </div>
              </div>

              <div className="bg-zinc-950/20 px-3 py-3 rounded-lg">
                <div className="text-[11px] font-mono uppercase tracking-[1.5px] text-zinc-500 mb-1">Address</div>
                <div className="inline-flex items-center gap-2 text-xs font-mono text-zinc-300">
                  {shortAddress(activeCoinAddress)}
                  <ExploreCopyButton text={activeCoinAddress} className="p-1 hover:bg-white/10" {...copyButtonProps} />
                </div>
              </div>

              {activeCoinDescription ? (
                <div className="bg-zinc-950/20 px-3 py-3 rounded-lg">
                  <div className="text-[11px] font-mono uppercase tracking-[1.5px] text-zinc-500 mb-2">Description</div>
                  <p className="text-sm text-zinc-300 leading-relaxed">{activeCoinDescription}</p>
                </div>
              ) : null}

              {activeCoinAddress ? (
                <Link
                  to={`/explore/content/base/${activeCoinAddress}`}
                  className="inline-flex items-center justify-center w-full px-4 py-3 text-white font-medium bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  Open Full Content Coin Page
                </Link>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
