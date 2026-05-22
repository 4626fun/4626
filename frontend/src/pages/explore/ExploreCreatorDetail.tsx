import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ExternalLink, ArrowLeft, Coins, TrendingUp, MessageSquare, Image as ImageIcon, X } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { PageMeta } from '@/components/seo/PageMeta'
import { getAddress, isAddress } from 'viem'
import { useQuery } from '@tanstack/react-query'

import { ExploreCopyButton } from '@/components/explore/ExploreUiPrimitives'
import { CreatorEthosAvatar } from '@/components/explore/CreatorEthosAvatar'
import { EthosBlurOrbs, EthosHeroScoreWash, EthosPageAmbience } from '@/components/explore/EthosPageAmbience'
import { ExploreEthosRefreshButton } from '@/components/explore/ExploreEthosRefreshButton'
import { useCreatorEthosPageTheme } from '@/components/explore/ethosPageTheme'
import { CREATOR_PAGE_LIME, CreatorScrollBridge } from '@/components/explore/CreatorScrollBridge'
import { InfiniteContentGallery3D } from '@/components/explore/InfiniteContentGallery3D'
import { LoadingInline, LoadingText } from '@/components/ui/LoadingState'
import { requestOpenChat } from '@/lib/chat/openChat'
import { fetchZoraCoin } from '@/lib/zora/client'
import { useZoraProfile, useZoraProfileCoins } from '@/lib/zora/hooks'
import type { ZoraCoin, ZoraProfile } from '@/lib/zora/types'
import { getPoolSwaps, getPoolsByToken } from '@/lib/uniswap/client'
import type { UniswapPool, UniswapSwap } from '@/lib/uniswap/types'
import { cn } from '@/lib/shared/utils'
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
const UNISWAP_ICON_URL = '/protocols/uniswap.svg'
gsap.registerPlugin(ScrollTrigger)

type ContentMediaKind = 'video' | 'text' | 'visual'
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
function calculateTotalEarningsValue(earnings: ZoraCoin['creatorEarnings']): number {
  if (!earnings || !Array.isArray(earnings) || earnings.length === 0) return 0
  let total = 0
  for (const e of earnings) {
    const usd = parseFloat(e.amountUsd || '0')
    if (!isNaN(usd)) total += usd
  }
  return total
}

function calculateTotalEarnings(earnings: ZoraCoin['creatorEarnings']): string {
  const total = calculateTotalEarningsValue(earnings)
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
      <div className="flex flex-nowrap items-center gap-x-3">
        {links.map((link) => (
          <a
            key={link.name}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <span className="text-zinc-500">{link.icon}</span>
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
      <div className="flex flex-nowrap items-center gap-x-3">
        {links.map((link) => (
          <a
            key={link.name}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <span className="w-3.5 h-3.5 overflow-hidden shrink-0">
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

function resolveCreatorSmartWalletAddress(
  profile: ZoraProfile | null | undefined,
  fallbackAddress?: string | null,
): `0x${string}` | null {
  for (const edge of profile?.linkedWallets?.edges ?? []) {
    const walletType = String(edge?.node?.walletType ?? '').toUpperCase()
    const address = edge?.node?.walletAddress
    if (walletType === 'SMART_WALLET' && address && isAddress(address)) {
      return getAddress(address)
    }
  }

  const publicWallet = profile?.publicWallet?.walletAddress
  if (publicWallet && isAddress(publicWallet)) return getAddress(publicWallet)

  if (fallbackAddress && isAddress(fallbackAddress)) return getAddress(fallbackAddress)

  return null
}

function CreatorStatsRail({
  stats,
  className,
  valueClassName,
  align = 'start',
}: {
  stats: ReadonlyArray<{
    value: string | number
    label: string
    toneClass: string
    footer?: ReactNode
    valueClassName?: string
  }>
  className?: string
  valueClassName?: string
  align?: 'start' | 'end'
}) {
  return (
    <aside className={cn('flex flex-col gap-6 sm:gap-7 overflow-visible', align === 'end' && 'items-end text-right', className)}>
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col gap-1.5 overflow-visible min-w-0 max-w-full">
          <span
            className={cn(
              'font-semibold tabular-nums overflow-visible',
              valueClassName,
              stat.valueClassName,
              stat.toneClass,
            )}
          >
            {stat.value}
          </span>
          <span className="text-[11px] sm:text-xs text-zinc-400 font-mono uppercase tracking-[2px]">{stat.label}</span>
          {stat.footer ? <div className={cn(align === 'end' && 'flex justify-end')}>{stat.footer}</div> : null}
        </div>
      ))}
    </aside>
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
  const [isContentSwapTrayOpen, setIsContentSwapTrayOpen] = useState(false)
  const [activeContentCoin, setActiveContentCoin] = useState<ZoraCoin | null>(null)
  const [sceneActiveCoin, setSceneActiveCoin] = useState<ZoraCoin | null>(null)
  const [timelineDragging, setTimelineDragging] = useState(false)
  const heroRef = useRef<HTMLDivElement | null>(null)
  const heroSectionRef = useRef<HTMLElement | null>(null)
  const sceneSectionRef = useRef<HTMLElement | null>(null)
  const timelineSectionRef = useRef<HTMLElement | null>(null)
  const timelineBodyRef = useRef<HTMLDivElement | null>(null)
  const timelineScrollerRef = useRef<HTMLDivElement | null>(null)
  const timelineCameraActiveRef = useRef(false)
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

  const activeTrayCoinAddress = useMemo(() => {
    const addr = activeContentCoin?.address
    if (!addr || !isAddress(addr)) return null
    return getAddress(addr)
  }, [activeContentCoin?.address])

  const { data: activeTrayPools = [] } = useQuery({
    queryKey: ['uniswap', 'poolsByToken', 'contentTray', activeTrayCoinAddress],
    queryFn: async () => {
      if (!activeTrayCoinAddress) return []
      return getPoolsByToken(activeTrayCoinAddress)
    },
    enabled: Boolean(activeTrayCoinAddress) && isContentTrayOpen,
    staleTime: 60_000,
  })

  const activeTrayPrimaryPool = useMemo<UniswapPool | null>(() => {
    if (!activeTrayPools || activeTrayPools.length === 0) return null
    return [...activeTrayPools].sort((a, b) => parseNumber(b.totalValueLockedUSD) - parseNumber(a.totalValueLockedUSD))[0] ?? null
  }, [activeTrayPools])

  const { data: activeTraySwaps = [], isLoading: activeTraySwapsLoading } = useQuery({
    queryKey: ['uniswap', 'poolSwaps', 'contentTray', activeTrayPrimaryPool?.id],
    queryFn: async () => {
      if (!activeTrayPrimaryPool?.id) return []
      return getPoolSwaps(activeTrayPrimaryPool.id, 12)
    },
    enabled: Boolean(activeTrayPrimaryPool?.id) && isContentTrayOpen,
    staleTime: 30_000,
  })

  const activeTrayBuyers = useMemo(() => {
    const contentAddressLower = activeTrayCoinAddress?.toLowerCase() ?? ''
    return (activeTraySwaps ?? [])
      .map((swap: UniswapSwap) => {
        const amount0 = parseNumber(swap.amount0)
        const amount1 = parseNumber(swap.amount1)
        const contentInToken0 = swap.token0.id.toLowerCase() === contentAddressLower
        const contentAmount = contentInToken0 ? amount0 : amount1
        const side = contentAmount < 0 ? 'Buy' : contentAmount > 0 ? 'Sell' : 'Swap'
        return {
          id: swap.id,
          timestamp: parseNumber(swap.timestamp || swap.transaction?.timestamp || 0),
          side,
          amountUsd: parseNumber(swap.amountUSD),
          wallet: swap.origin || swap.sender,
          txHash: swap.transaction?.id ?? '',
        }
      })
      .filter((row) => row.side === 'Buy')
      .slice(0, 8)
  }, [activeTraySwaps, activeTrayCoinAddress])

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
      if (heroSectionRef.current && allowParallax) {
        const fadeTween = gsap.to(heroSectionRef.current, {
          autoAlpha: 0.18,
          ease: 'none',
          scrollTrigger: {
            trigger: heroSectionRef.current,
            start: 'bottom top',
            end: () => `+=${Math.round(window.innerHeight * 2.2)}`,
            scrub: 0.85,
          },
        })
        cleanups.push(() => {
          fadeTween.scrollTrigger?.kill()
          fadeTween.kill()
          gsap.set(heroSectionRef.current, { clearProps: 'opacity,visibility' })
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
      if (timelineSectionRef.current && timelineBodyRef.current && timelineScrollerRef.current && allowParallax) {
        const section = timelineSectionRef.current
        const sectionBody = timelineBodyRef.current
        const scroller = timelineScrollerRef.current
        const maxTimelineScrollLeft = () => Math.max(0, scroller.scrollWidth - scroller.clientWidth)

        gsap.set(sectionBody, { x: '16vw', autoAlpha: 0.8, willChange: 'transform,opacity' })
        const introTween = gsap.to(sectionBody, {
          x: '0vw',
          autoAlpha: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 88%',
            end: 'top 52%',
            scrub: 0.9,
          },
        })
        cleanups.push(() => {
          introTween.scrollTrigger?.kill()
          introTween.kill()
          gsap.set(sectionBody, { clearProps: 'all' })
        })

        if (window.innerWidth >= 1024 && maxTimelineScrollLeft() > 0) {
          timelineCameraActiveRef.current = true
          const panDistance = maxTimelineScrollLeft() + window.innerHeight * 0.55
          const panTween = gsap.to(scroller, {
            scrollLeft: () => maxTimelineScrollLeft(),
            ease: 'none',
            scrollTrigger: {
              trigger: section,
              start: 'top top',
              end: () => `+=${Math.max(window.innerHeight * 1.1, panDistance)}`,
              pin: true,
              pinSpacing: true,
              scrub: 1,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          })
          cleanups.push(() => {
            timelineCameraActiveRef.current = false
            panTween.scrollTrigger?.kill()
            panTween.kill()
          })
        }
      }
      return () => {
        cleanups.forEach((cleanup) => cleanup())
      }
    },
    { dependencies: [allowParallax, timelineCoins.length, contentCoins.length] },
  )

  useEffect(() => {
    if (!allowParallax || typeof window === 'undefined') return
    const frame = requestAnimationFrame(() => {
      ScrollTrigger.refresh()
    })
    return () => cancelAnimationFrame(frame)
  }, [allowParallax, timelineCoins.length, contentCoins.length])

  useEffect(() => {
    if (!isContentTrayOpen) return
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isContentSwapTrayOpen) {
          setIsContentSwapTrayOpen(false)
          return
        }
        setIsContentSwapTrayOpen(false)
        setIsContentTrayOpen(false)
      }
    }
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [isContentTrayOpen, isContentSwapTrayOpen])

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
  const creatorChatAddress = resolveCreatorSmartWalletAddress(profile, creatorAddress || coin?.payoutRecipientAddress || null)

  const { ethosUserkey, ethosScore, theme: ethosTheme, hasPositiveScore: ethosHasPositiveScore } = useCreatorEthosPageTheme({
    profile: profile ?? creatorProfile ?? null,
    creatorAddress: creatorAddress ?? null,
    serverEthosScore: coin?.ethosScore,
    serverEthosLevel: coin?.ethosLevel,
  })
  const ethosScoreValue = typeof ethosScore?.score === 'number' ? ethosScore.score : null
  const ethosStatDisplay =
    ethosHasPositiveScore && ethosScoreValue != null
      ? ethosScoreValue.toLocaleString(undefined, { useGrouping: false })
      : '—'
  const heroCoin = coin ?? ({
    address: tokenAddress ?? '',
    creatorAddress: creatorAddress ?? undefined,
    creatorProfile: coin?.creatorProfile ?? (profile?.handle ? { handle: profile.handle } : undefined),
  } as ZoraCoin)
  const copyButtonProps = {
    title: 'Copy address',
    resetMs: 2000,
    copiedIconClassName: 'w-4 h-4 text-green-500',
  } as const
  const sceneCandidates = useMemo(
    () => [...contentCoins].sort((a, b) => parseNumber(b.totalVolume) - parseNumber(a.totalVolume)),
    [contentCoins]
  )
  const imageBasedSceneCoins = useMemo(
    () =>
      sceneCandidates.filter(
        (candidate) => detectContentMediaKind(candidate) === 'visual' && Boolean(getContentCoinAssetUrl(candidate))
      ),
    [sceneCandidates]
  )
  const fallbackSceneCoins = useMemo(
    () => sceneCandidates.filter((candidate) => !imageBasedSceneCoins.includes(candidate)),
    [sceneCandidates, imageBasedSceneCoins]
  )
  const sceneCoins = useMemo(() => [...imageBasedSceneCoins, ...fallbackSceneCoins].slice(0, 7), [imageBasedSceneCoins, fallbackSceneCoins])
  const topVolumeContentCoins = useMemo(() => sceneCandidates.slice(0, 6), [sceneCandidates])

  if (!chain || !isSupportedExploreChain(chain)) {
    return <Navigate replace to="/explore/creators" />
  }

  if (!tokenAddress) {
    return <Navigate replace to="/explore/creators" />
  }

  const leadSceneCoin = imageBasedSceneCoins[0] ?? sceneCoins[0] ?? null
  const leadSceneCoinImage = (leadSceneCoin ? getContentCoinAssetUrl(leadSceneCoin) : undefined) || avatarUrl || null
  const creatorCoinKind = coin ? detectContentMediaKind(coin) : null
  const creatorCoinImage =
    coin && creatorCoinKind === 'visual'
      ? getContentCoinAssetUrl(coin)
      : undefined
  const heroIconImage = creatorCoinImage || leadSceneCoinImage || avatarUrl || null
  const creatorTokenLogo =
    coin?.mediaContent?.previewImage?.small ||
    coin?.mediaContent?.previewImage?.medium ||
    leadSceneCoinImage ||
    null
  const heroBackgroundImage = creatorTokenLogo || leadSceneCoinImage || null
  const openContentTray = (coin: ZoraCoin) => {
    setActiveContentCoin(coin)
    setIsContentSwapTrayOpen(false)
    setIsContentTrayOpen(true)
  }
  const closeContentTray = () => {
    setIsContentSwapTrayOpen(false)
    setIsContentTrayOpen(false)
  }
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
    if (timelineCameraActiveRef.current) return
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
    event.preventDefault()
    container.scrollBy({ left: event.deltaY * 0.85, behavior: 'smooth' })
  }
  const onSceneSectionWheelCapture = (event: React.WheelEvent<HTMLElement>) => {
    // Keep wheel interactions scoped to the scene while hovered.
    event.preventDefault()
  }
  const activeCoinMediaKind = activeContentCoin ? detectContentMediaKind(activeContentCoin) : null
  const activeCoinImage = activeContentCoin ? getContentCoinAssetUrl(activeContentCoin) : undefined
  const activeCoinOriginal = activeContentCoin ? toDisplayAssetUrl(activeContentCoin.mediaContent?.originalUri) : undefined
  const activeCoinAddress = activeContentCoin?.address || ''
  const activeCoinDescription = (activeContentCoin?.description || '').trim()
  const activeCoinEarningsUsd = activeContentCoin ? calculateTotalEarningsValue(activeContentCoin.creatorEarnings) : 0
  const activeTraySymbol = activeContentCoin?.symbol || '???'
  const compactActiveTraySymbol = activeTraySymbol.length > 18 ? `${activeTraySymbol.slice(0, 15)}…` : activeTraySymbol
  const activeTraySwapUrl = activeTrayCoinAddress ? `/swap?token=${activeTrayCoinAddress}` : '/swap'
  const activeTrayLiquidityUrl = activeTrayPrimaryPool?.id
    ? `https://app.uniswap.org/explore/pools/base/${activeTrayPrimaryPool.id}`
    : activeTrayCoinAddress
      ? `https://app.uniswap.org/explore/tokens/base/${activeTrayCoinAddress}`
      : 'https://app.uniswap.org'
  const heroStats = [
    { value: volumeWindow === '24h' ? volume24h : totalVolume, label: volumeWindow === '24h' ? '24H volume' : 'All-time volume', toneClass: 'text-white' },
    { value: marketCap, label: 'Market cap', toneClass: 'text-white' },
    { value: holders, label: 'Holders', toneClass: 'text-white' },
    {
      value: ethosStatDisplay,
      label: 'Ethos score',
      toneClass: ethosHasPositiveScore ? ethosTheme.accentTextClass : 'text-zinc-500',
      footer:
        typeof creatorAddress === 'string' && /^0x[a-fA-F0-9]{40}$/.test(creatorAddress) ? (
          <ExploreEthosRefreshButton creatorAddress={creatorAddress} />
        ) : null,
    },
    { value: totalCoinsCreated, label: 'Coins created', toneClass: 'text-white' },
    {
      value: createdAt,
      label: 'Created',
      toneClass: 'text-white',
      valueClassName: 'whitespace-nowrap text-2xl xl:text-[1.65rem] tracking-normal',
    },
  ] as const

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white overflow-hidden">
      <PremiumCursor enabled={showCursor} />
      <PageMeta
        title={displayName !== 'Creator' ? `${displayName} (${symbol})` : 'Creator Detail'}
        description={`Explore ${displayName}'s creator coin ${symbol} — view vault, trades, and activity on 4626.`}
        canonicalPath={`/explore/${chain}/${tokenAddressRaw}`}
      />
      <EthosPageAmbience theme={ethosTheme} />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pb-0">
        {/* Hero + content-coins scene share a spanning stats rail on desktop */}
        <div className="relative left-1/2 right-1/2 w-screen -translate-x-1/2">
          <div className="hidden lg:block absolute inset-y-0 right-4 xl:right-8 2xl:right-12 z-30 w-52 xl:w-60 pointer-events-none">
            <CreatorStatsRail
              stats={heroStats}
              align="end"
              className="sticky top-24 pointer-events-auto border-l border-white/10 pl-8 pr-2 pt-24 pb-24 overflow-visible [mask-image:linear-gradient(to_bottom,black_0%,black_88%,transparent_100%)]"
              valueClassName="text-3xl xl:text-4xl"
            />
          </div>

          <div className="pointer-events-none hidden lg:block absolute inset-y-0 right-4 xl:right-8 2xl:right-12 z-20 w-px bg-gradient-to-b from-white/5 via-white/10 to-transparent" />

        {/* Recreated hero scene */}
        <section
          ref={heroSectionRef}
          className="relative overflow-hidden bg-black min-h-[calc(100dvh-3.5rem)] lg:pr-60 xl:pr-64"
        >
          {heroBackgroundImage ? (
            <div className="absolute inset-0 pointer-events-none">
              <img src={heroBackgroundImage} alt={`${symbol} creator coin logo`} className="w-full h-full object-cover opacity-65" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/72 via-black/45 to-black/25" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/18 via-transparent to-black/58" />
              <EthosHeroScoreWash theme={ethosTheme} />
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

          <Link
            to="/explore/creators"
            className="absolute top-3 left-4 sm:top-4 sm:left-6 lg:left-8 z-30 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-all duration-200 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Creators
          </Link>

          <div className="absolute top-3 right-4 sm:top-4 sm:right-6 lg:right-8 z-20 flex flex-nowrap items-center justify-end gap-x-3 pointer-events-auto max-w-[min(92vw,calc(100%-2rem))] overflow-x-auto text-right">
            {website ? (
              <a
                href={website.startsWith('http') ? website : `https://${website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                <span>{website.replace(/^https?:\/\//, '')}</span>
                <ExternalLink className="w-3 h-3 text-zinc-500" />
              </a>
            ) : null}
            <SocialLinks profile={profile} compact />
            <ResourceLinks tokenAddress={tokenAddress} compact />
          </div>

          <motion.div
            ref={heroRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative min-h-[calc(100dvh-3.5rem)] px-6 sm:px-8 lg:px-12 pb-10 sm:pb-14 flex flex-col justify-end"
          >
            <div className="max-w-4xl">
              <span
                className={cn(
                  'inline-flex items-center gap-3 text-[11px] sm:text-xs font-mono uppercase tracking-[2px] mb-8',
                  ethosTheme.isActive ? ethosTheme.accentTextClass : 'text-zinc-400',
                )}
              >
                <span className="w-10 sm:w-12 h-px" style={ethosTheme.dividerStyle} />
                {handle ? `@${handle}` : 'Creator'}
                {ethosTheme.isActive ? (
                  <span className={cn('normal-case tracking-normal text-[10px]', ethosTheme.accentStrongTextClass)}>
                    · {ethosTheme.levelLabel}
                  </span>
                ) : null}
              </span>

              <div className="flex items-start gap-4 sm:gap-6">
                <div className="mt-1 shrink-0">
                  <CreatorEthosAvatar
                    coin={heroCoin}
                    imageUrl={heroIconImage}
                    fallbackLabel={symbol}
                    ethosUserkey={ethosUserkey}
                    ethosScore={ethosScore}
                    size="lg"
                  />
                </div>
                <h1 className="text-[clamp(2.2rem,8vw,7rem)] leading-[0.9] tracking-tight font-semibold text-white">
                  {displayName}
                  <br />
                  <span className={ethosTheme.isActive ? `${ethosTheme.accentTextClass} opacity-80` : 'text-white/35'}>
                    creator economy.
                  </span>
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
                      className={cn(
                        'px-7 py-3 rounded-full border font-medium text-sm sm:text-base inline-flex items-center gap-2 transition-colors',
                        ethosTheme.outlineCtaClass,
                      )}
                    >
                      <MessageSquare className="w-4 h-4" />
                      Message Creator
                    </button>
                    <ActionAddressHint label="Creator smart wallet" address={creatorChatAddress} copyButtonProps={copyButtonProps} />
                  </div>
                ) : null}
              </div>

              <CreatorStatsRail
                stats={heroStats}
                className="lg:hidden mt-10 pt-8 border-t border-white/10"
                valueClassName="text-2xl sm:text-3xl"
              />
            </div>
          </motion.div>
        </section>

        <CreatorScrollBridge tone="void" animate={allowParallax} />

        <section
          ref={sceneSectionRef}
          className="relative min-h-[calc(100dvh-3.5rem)] h-[calc(100dvh-3.5rem)] overflow-hidden lg:pr-60 xl:pr-64"
          onWheelCapture={onSceneSectionWheelCapture}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-black/28" />
          <div className="pointer-events-none absolute inset-0 opacity-20 [background:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:90px_90px]" />
          <EthosBlurOrbs theme={ethosTheme} />

          {imageBasedSceneCoins.length > 0 ? (
            <div
              data-scene-card
              className="absolute inset-0 z-10 overflow-hidden bg-black/45 backdrop-blur-[1px]"
            >
              <InfiniteContentGallery3D
                coins={imageBasedSceneCoins}
                onSelect={openContentTray}
                onActiveCoinChange={setSceneActiveCoin}
                interactive
                cameraZ={7.2}
                cameraFov={46}
                planeScale={1.02}
                laneSpacing={2.7}
                className="absolute inset-0 min-h-0"
              />
              <div className="pointer-events-none absolute inset-0 z-10 bg-linear-to-b from-black/12 via-transparent to-black/38" />
              <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_18%_20%,rgba(56,189,248,0.22),transparent_38%),radial-gradient(circle_at_82%_72%,rgba(59,130,246,0.2),transparent_42%)]" />

              <div className="absolute inset-0 z-20 flex flex-col pointer-events-none">
                <div className="flex flex-1 flex-col justify-between px-4 pt-6 pb-28 sm:px-8 sm:pt-8 sm:pb-32 lg:pr-64 xl:pr-72">
                  <div className="lg:col-span-7 flex flex-col justify-between min-h-[42vh] sm:min-h-[48vh] lg:min-h-[52vh] max-w-4xl">
                    <span className="inline-flex items-center gap-3 text-[11px] sm:text-xs font-mono uppercase tracking-[2px] text-zinc-500">
                      <span className="w-10 sm:w-12 h-px bg-white/30" />
                      Collections
                    </span>
                    <h2 className="text-[clamp(3rem,11vw,7.5rem)] font-semibold tracking-tight leading-[0.88]">
                      Content
                      <br />
                      <span className="text-white/35">coins.</span>
                    </h2>
                  </div>
                </div>
              </div>

              <div className="absolute left-4 bottom-4 z-20 w-[min(92vw,420px)] border border-white/15 bg-black/65 backdrop-blur-md p-3 sm:p-4 pointer-events-auto">
                <div className="text-[10px] sm:text-[11px] font-mono uppercase tracking-[1.8px] text-zinc-400 mb-2">
                  Top content volume
                </div>
                <div className="space-y-1.5">
                  {topVolumeContentCoins.map((coin, index) => {
                    const isActiveInScene =
                      Boolean(sceneActiveCoin?.address) &&
                      coin.address?.toLowerCase() === sceneActiveCoin?.address?.toLowerCase()
                    return (
                      <button
                        key={coin.address || coin.id || `top-volume-${index}`}
                        type="button"
                        onClick={() => openContentTray(coin)}
                        className={cn(
                          'w-full flex items-center justify-between gap-3 text-left text-xs sm:text-sm transition-colors rounded-md px-2 py-1.5 -mx-2',
                          isActiveInScene
                            ? 'bg-cyan-400/15 text-white border-l-2 border-cyan-300'
                            : 'text-zinc-200 hover:text-white hover:bg-white/5',
                        )}
                      >
                        <span className="truncate">
                          <span className={cn('font-mono mr-2', isActiveInScene ? 'text-cyan-200' : 'text-zinc-500')}>
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          {coin.name || coin.symbol || 'Untitled'}
                        </span>
                        <span className="font-mono text-zinc-300 shrink-0">{formatNumber(coin.totalVolume)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 rounded-3xl bg-zinc-900/50 backdrop-blur p-10 text-center text-zinc-500 flex items-center justify-center">
              No visual content coins available to render the scene yet.
            </div>
          )}
        </section>

        <CreatorScrollBridge
          tone="void-to-lime"
          animate={allowParallax}
          caption={
            <p className="text-sm sm:text-base lg:text-lg leading-relaxed">
              A live collection built from {displayName}&apos;s highest-activity coins — ordered by volume, surfaced as a
              visual scene.
            </p>
          }
        />
        </div>

        <div
          ref={timelineSectionRef}
          className="relative w-screen ml-[calc(50%-50vw)] isolate text-zinc-900 px-4 sm:px-6 py-14 sm:py-[4.5rem]"
          style={{ backgroundColor: CREATOR_PAGE_LIME }}
        >
          <div ref={timelineBodyRef}>
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
          </div>
        </div>

        <CreatorScrollBridge tone="lime-to-void" animate={allowParallax} />

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
            aria-label="Close content coin panel"
          />
          <aside className="absolute left-0 top-0 h-full w-full max-w-[460px] bg-black/95 shadow-[22px_0_80px_rgba(0,0,0,0.65)] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-black/90 backdrop-blur px-5 sm:px-6 py-4 flex items-center justify-between">
              <span className="inline-flex items-center gap-3 text-[11px] sm:text-xs font-mono uppercase tracking-[2px] text-zinc-500">
                <span className="w-10 h-px bg-white/35" />
                Content Coin
              </span>
              <button
                type="button"
                onClick={closeContentTray}
                className="inline-flex items-center justify-center w-8 h-8 text-zinc-400 hover:text-white transition-colors"
                aria-label="Close panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 sm:p-6 space-y-5">
              <div className="min-w-0">
                <h3 className="text-2xl font-semibold tracking-tight text-white truncate">
                  {activeContentCoin.name || activeContentCoin.symbol || 'Untitled'}
                </h3>
                <div className="text-sm text-zinc-400 mt-1">{activeContentCoin.symbol || '???'}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsContentSwapTrayOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white text-black font-medium text-sm hover:bg-white/90 transition-colors"
                >
                  <TrendingUp className="w-4 h-4" />
                  Swap
                </button>
                <a
                  href={activeTrayLiquidityUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-white/15 bg-white/5 text-white font-medium text-sm hover:bg-white/10 transition-colors"
                >
                  <img src={UNISWAP_ICON_URL} alt="Uniswap" className="h-4 w-4 object-contain" />
                  Liquidity
                </a>
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

              <div className="space-y-3">
                {activeCoinEarningsUsd > 0 ? (
                  <div className="bg-blue-500/10 px-3 py-3 rounded-lg">
                    <div className="text-[11px] font-mono uppercase tracking-[1.5px] text-zinc-500">Earned</div>
                    <div className="text-base text-blue-200 mt-1">{calculateTotalEarnings(activeContentCoin.creatorEarnings)}</div>
                  </div>
                ) : null}
                <div className="bg-zinc-950/20 px-3 py-3 rounded-lg">
                  <div className="text-[11px] font-mono uppercase tracking-[1.5px] text-zinc-500">All-time volume</div>
                  <div className="text-base text-white mt-1">{formatNumber(activeContentCoin.totalVolume)}</div>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 overflow-hidden">
                <div className="px-3 py-3 border-b border-white/10">
                  <div className="text-[11px] font-mono uppercase tracking-[1.5px] text-zinc-500">Recent buyers</div>
                  <div className="text-xs text-zinc-500 mt-1">Latest buy-side swaps from the primary pool</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[320px] text-sm">
                    <thead>
                      <tr className="text-left text-zinc-500 text-[11px] uppercase tracking-[1.2px] font-mono">
                        <th className="px-3 py-2 font-normal">Time</th>
                        <th className="px-3 py-2 text-right font-normal">USD</th>
                        <th className="px-3 py-2 text-right font-normal">Wallet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTraySwapsLoading ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-6 text-center text-zinc-600">
                            <LoadingText intent="processing" labelOverride="Loading buyers..." />
                          </td>
                        </tr>
                      ) : activeTrayBuyers.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-6 text-center text-zinc-600">
                            No recent buyers yet.
                          </td>
                        </tr>
                      ) : (
                        activeTrayBuyers.map((row) => (
                          <tr key={row.id} className="border-t border-white/8">
                            <td className="px-3 py-2.5 text-zinc-400">{formatTimestamp(row.timestamp)}</td>
                            <td className="px-3 py-2.5 text-right text-white tabular-nums">{formatUsd(row.amountUsd)}</td>
                            <td className="px-3 py-2.5 text-right">
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
      {isContentTrayOpen && isContentSwapTrayOpen && activeTrayCoinAddress ? (
        <div className="fixed inset-0 z-[145]">
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
            onClick={() => setIsContentSwapTrayOpen(false)}
            aria-label="Close swap panel"
          />
          <aside className="absolute right-0 top-0 hidden h-full w-full max-w-[380px] border-l border-white/10 bg-black/95 p-5 sm:block">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-white">Swap {compactActiveTraySymbol}</div>
              <button
                type="button"
                onClick={() => setIsContentSwapTrayOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center text-zinc-400 hover:text-white"
                aria-label="Close swap panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <Link
                to={activeTraySwapUrl}
                className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-zinc-200 hover:bg-white/10"
                onClick={() => {
                  setIsContentSwapTrayOpen(false)
                  closeContentTray()
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Open in 4626 Swap
                </span>
                <ExternalLink className="h-4 w-4" />
              </Link>
              <a
                href={`https://app.uniswap.org/explore/tokens/base/${activeTrayCoinAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-zinc-200 hover:bg-white/10"
                onClick={() => setIsContentSwapTrayOpen(false)}
              >
                <span className="inline-flex items-center gap-2">
                  <img src={UNISWAP_ICON_URL} alt="Uniswap" className="h-4 w-4 object-contain" />
                  Open in Uniswap
                </span>
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </aside>
          <aside className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t border-white/10 bg-black/95 p-5 sm:hidden">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-white">Swap {compactActiveTraySymbol}</div>
              <button
                type="button"
                onClick={() => setIsContentSwapTrayOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center text-zinc-400 hover:text-white"
                aria-label="Close swap panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <Link
                to={activeTraySwapUrl}
                className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-zinc-200 hover:bg-white/10"
                onClick={() => {
                  setIsContentSwapTrayOpen(false)
                  closeContentTray()
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Open in 4626 Swap
                </span>
                <ExternalLink className="h-4 w-4" />
              </Link>
              <a
                href={`https://app.uniswap.org/explore/tokens/base/${activeTrayCoinAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-zinc-200 hover:bg-white/10"
                onClick={() => setIsContentSwapTrayOpen(false)}
              >
                <span className="inline-flex items-center gap-2">
                  <img src={UNISWAP_ICON_URL} alt="Uniswap" className="h-4 w-4 object-contain" />
                  Open in Uniswap
                </span>
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
