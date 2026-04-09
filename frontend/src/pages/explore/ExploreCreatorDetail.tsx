import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, ArrowLeft, Share2, Globe, Users, Coins, TrendingUp, Calendar, MessageSquare } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { PageMeta } from '@/components/seo/PageMeta'
import { getAddress, isAddress } from 'viem'
import { useQuery } from '@tanstack/react-query'

import { ExploreCopyButton, ExploreStatRow } from '@/components/explore/ExploreUiPrimitives'
import { ExploreUnfurlDebugCopy } from '@/components/explore/ExploreUnfurlDebugCopy'
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
} from '@/features/explore/exploreShared'

const CONTENT_COINS_PAGE_SIZE = 20

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

// Content Coin Row Component - shows revenue instead of price
function ContentCoinRow({ coin, rank }: { coin: ZoraCoin; rank: number }) {
  const avatarUrl = coin.mediaContent?.previewImage?.small
  const name = coin.name || coin.symbol || 'Untitled'
  const symbol = coin.symbol || '???'
  const earnings = calculateTotalEarnings(coin.creatorEarnings)
  const totalVolume = formatNumber(coin.totalVolume)
  const address = coin.address || ''

  return (
    <Link
      to={`/explore/content/base/${address}`}
      className="flex items-center gap-2.5 sm:gap-4 px-3 py-3 sm:p-4 hover:bg-white/5 transition-colors rounded-xl active:scale-[0.99]"
    >
      <span className="text-[11px] sm:text-xs text-zinc-600 w-5 sm:w-6 text-center shrink-0">{rank}</span>
      
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-linear-to-br from-zinc-700 to-zinc-800 flex items-center justify-center shrink-0">
          <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-500" />
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <div className="text-[13px] sm:text-sm text-white font-medium truncate">{name}</div>
        <div className="text-[10px] sm:text-xs text-zinc-500">{symbol}</div>
      </div>
      
      <div className="text-right shrink-0">
        <div className="text-[10px] sm:text-xs text-zinc-500">Earned</div>
        <div className="text-[13px] sm:text-sm text-green-400 font-medium">{earnings}</div>
      </div>
      
      <div className="text-right hidden sm:block shrink-0">
        <div className="text-xs text-zinc-500">Volume</div>
        <div className="text-sm text-white">{totalVolume}</div>
      </div>
    </Link>
  )
}

// Social Links Component
function SocialLinks({ profile }: { profile: ZoraProfile | null }) {
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

  return (
    <div className="space-y-2">
      {links.map((link) => (
        <a
          key={link.name}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/8/90 border border-zinc-700/70 flex items-center justify-center text-zinc-200">
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

function ResourceLinks({ tokenAddress }: { tokenAddress: string }) {
  const links = [
    {
      name: 'Zora',
      href: `https://zora.co/coin/base:${tokenAddress}`,
      iconUrl: 'https://green-decisive-crane-434.mypinata.cloud/ipfs/bafkreiby3cnzgdxvaadcgl2z2wos34hfqqoynyzgh3uxm2qxl2qka6cllq',
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

  return (
    <div className="space-y-2">
      {links.map((link) => (
        <a
          key={link.name}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/8/90 border border-zinc-700/70 flex items-center justify-center p-1.5 overflow-hidden">
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
    return [...pools].sort((a, b) => parseNumber(b.totalValueLockedUSD) - parseNumber(a.totalValueLockedUSD))[0]
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
        wallet: swap.origin || swap.sender,
        txHash: swap.transaction?.id ?? '',
      }
    })
  }, [swaps, tokenAddress, symbol])

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
  const creatorChatHref =
    creatorChatPeer && isAddress(creatorChatPeer)
      ? `/?chatAction=help&chatPeer=${creatorChatPeer}&chatName=${encodeURIComponent(displayName)}`
      : null
  const copyButtonProps = {
    title: 'Copy address',
    resetMs: 2000,
    copiedIconClassName: 'w-4 h-4 text-green-500',
  } as const
  const statRowStyleProps = {
    labelClassName: 'text-sm text-zinc-400',
    valueClassName: 'text-sm text-white font-medium',
  } as const
  const normalizedChain = chain.toLowerCase()
  const socialPreviewPath = `/explore/creators/${normalizedChain}/${tokenAddress.toLowerCase()}`

  return (
    <div className="relative min-h-screen bg-black">
      <PageMeta
        title={displayName !== 'Creator' ? `${displayName} (${symbol})` : 'Creator Detail'}
        description={`Explore ${displayName}'s creator coin ${symbol} — view vault, trades, and activity on 4626.`}
        canonicalPath={`/explore/${chain}/${tokenAddressRaw}`}
      />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {/* Back navigation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-3 sm:mb-4"
        >
          <Link
            to="/explore/creators"
            className="inline-flex items-center gap-1.5 text-[13px] sm:text-sm text-zinc-400 hover:text-white transition-colors active:scale-[0.97]"
          >
            <ArrowLeft className="w-4 h-4" />
            Creators
          </Link>
        </motion.div>

        {/* Creator Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-xl sm:rounded-2xl border border-white/8 bg-white/3 p-4 sm:p-6 mb-4 sm:mb-6"
        >
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
            {/* Avatar & Name */}
            <div className="flex items-start gap-3 sm:gap-4">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl object-cover shrink-0" />
              ) : (
                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-linear-to-br from-zinc-600 to-zinc-700 flex items-center justify-center shrink-0">
                  <span className="text-lg sm:text-2xl font-medium text-zinc-300">{displayName.slice(0, 2).toUpperCase()}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold text-white truncate">{displayName}</h1>
                {handle && (
                  <div className="text-zinc-400 text-[13px] sm:text-sm">@{handle}</div>
                )}
                {bio && (
                  <p className="text-zinc-500 text-[13px] sm:text-sm mt-1.5 sm:mt-2 line-clamp-2">{bio}</p>
                )}
                {website && (
                  <a
                    href={website.startsWith('http') ? website : `https://${website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 text-[13px] sm:text-sm mt-1 inline-flex items-center gap-1"
                  >
                    <Globe className="w-3 h-3" />
                    {website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
            </div>

            {/* Quick Stats — 2x2 grid on mobile, inline on desktop */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 sm:gap-6 sm:ml-auto">
              <div className="text-center sm:text-center">
                <div className="text-lg sm:text-2xl font-semibold text-white">{volume24h}</div>
                <div className="text-[11px] sm:text-xs text-zinc-500">24H Volume</div>
              </div>
              <div className="text-center sm:text-center">
                <div className="text-lg sm:text-2xl font-semibold text-white">{marketCap}</div>
                <div className="text-[11px] sm:text-xs text-zinc-500">Market Cap</div>
              </div>
              <div className="text-center sm:text-center">
                <div className="text-lg sm:text-2xl font-semibold text-white">{holders}</div>
                <div className="text-[11px] sm:text-xs text-zinc-500">Holders</div>
              </div>
              <div className="text-center sm:text-center">
                <div className="text-lg sm:text-2xl font-semibold text-white">{totalCoinsCreated}</div>
                <div className="text-[11px] sm:text-xs text-zinc-500">Coins Created</div>
              </div>
            </div>
          </div>

          <div className="mt-4 sm:mt-5 pt-4 border-t border-white/8 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg sm:rounded-xl border border-white/8 bg-white/4 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-zinc-500">Creator Coin</div>
                  <div className="text-xs sm:text-sm text-zinc-300 font-mono truncate">{shortAddress(tokenAddress)}</div>
                </div>
                <ExploreCopyButton
                  text={tokenAddress}
                  className="p-2 rounded-lg hover:bg-white/8 shrink-0"
                  {...copyButtonProps}
                />
              </div>
            </div>

            {creatorAddress ? (
              <div className="rounded-lg sm:rounded-xl border border-white/8 bg-white/4 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-zinc-500">Creator Wallet</div>
                    <div className="text-xs sm:text-sm text-zinc-300 font-mono truncate">{shortAddress(creatorAddress)}</div>
                  </div>
                  <ExploreCopyButton
                    text={creatorAddress}
                    className="p-2 rounded-lg hover:bg-white/8 shrink-0"
                    {...copyButtonProps}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-lg sm:rounded-xl border border-white/8 bg-white/4 px-3 py-2.5">
                <div className="text-[11px] font-medium text-zinc-500">Creator Wallet</div>
                <div className="text-xs sm:text-sm text-zinc-500">Unavailable</div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Main content - Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 sm:gap-6">
          {/* Left Column - Chart & Content Coins */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-4 sm:space-y-6"
          >
            {/* Tab Navigation */}
            <div className="flex items-center gap-1.5 sm:gap-2 border-b border-white/8 pb-2 overflow-x-auto scrollbar-hide">
              <button
                type="button"
                onClick={() => setActiveTab('chart')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[13px] sm:text-sm font-medium transition-colors whitespace-nowrap active:scale-[0.97] ${
                  activeTab === 'chart'
                    ? 'bg-white/8 text-white'
                    : 'text-zinc-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1.5 sm:mr-2" />
                Chart
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('coins')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[13px] sm:text-sm font-medium transition-colors whitespace-nowrap active:scale-[0.97] ${
                  activeTab === 'coins'
                    ? 'bg-white/8 text-white'
                    : 'text-zinc-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1.5 sm:mr-2" />
                Content ({contentCoins.length})
              </button>
            </div>

            {/* Chart Tab */}
            {activeTab === 'chart' && (
              <>
                <div className="rounded-xl sm:rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
                  <div className="px-3 py-3 sm:p-4 border-b border-white/8">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-white font-medium">{displayName}</span>
                        <span className="text-zinc-500 ml-2">{symbol}</span>
                      </div>
                      <a
                        href={`https://dexscreener.com/base/${tokenAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-zinc-500 hover:text-white flex items-center gap-1"
                      >
                        Open in Dexscreener
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  {isLoading ? (
                    <div className="h-[400px] flex items-center justify-center">
                      <div className="h-8 w-8 border-2 border-zinc-700 border-t-cyan-500 rounded-full animate-spin" />
                    </div>
                  ) : (
                    <DexscreenerChart tokenAddress={tokenAddress} />
                  )}
                </div>

                <div className="rounded-xl sm:rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
                    <div>
                      <div className="text-sm text-white font-medium">Recent transactions</div>
                      <div className="text-xs text-zinc-500">Latest swaps from the primary pool</div>
                    </div>
                    {primaryPool?.id ? (
                      <a
                        href={`https://app.uniswap.org/explore/pools/base/${primaryPool.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-zinc-400 hover:text-white"
                      >
                        Pool
                      </a>
                    ) : null}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className="bg-vault-card/60/70">
                        <tr className="text-left text-zinc-500 text-xs font-medium">
                          <th className="px-4 py-3">Time</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3 text-right">USD</th>
                          <th className="px-4 py-3 text-right">{symbol}</th>
                          <th className="px-4 py-3 text-right">Pair</th>
                          <th className="px-4 py-3 text-right">Wallet</th>
                        </tr>
                      </thead>
                      <tbody>
                        {swapsLoading ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-zinc-600">
                              Loading swaps...
                            </td>
                          </tr>
                        ) : recentTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-zinc-600">
                              No swap data available for this creator coin yet.
                            </td>
                          </tr>
                        ) : (
                          recentTransactions.map((row) => (
                            <tr key={row.id} className="border-t border-white/8/70">
                              <td className="px-4 py-3 text-zinc-400">{formatTimestamp(row.timestamp)}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                    row.side === 'Buy'
                                      ? 'bg-emerald-500/15 text-emerald-300'
                                      : row.side === 'Sell'
                                        ? 'bg-rose-500/15 text-rose-300'
                                        : 'bg-zinc-600/25 text-zinc-300'
                                  }`}
                                >
                                  {row.side}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-white tabular-nums">{formatUsd(row.amountUsd)}</td>
                              <td className="px-4 py-3 text-right text-zinc-300 tabular-nums">
                                {formatTokenAmount(row.creatorCoinAmount)} {row.creatorCoinSymbol}
                              </td>
                              <td className="px-4 py-3 text-right text-zinc-300 tabular-nums">
                                {formatTokenAmount(row.otherAmount)} {row.otherSymbol}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {row.txHash ? (
                                  <a
                                    href={`https://basescan.org/tx/${row.txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-zinc-300 hover:text-white"
                                  >
                                    {shortAddress(row.wallet)}
                                  </a>
                                ) : (
                                  <span className="text-zinc-400">{shortAddress(row.wallet)}</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Content Coins Tab */}
            {activeTab === 'coins' && (
              <div className="rounded-xl sm:rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
                <div className="px-3 py-3 sm:p-4 border-b border-white/8">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-white font-medium">Content Coins by {displayName}</h3>
                      <p className="text-xs text-zinc-500 mt-1">
                        All content coins created by this creator on Zora
                      </p>
                    </div>
                    {contentCoins.length > CONTENT_COINS_PAGE_SIZE && (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        <button
                          type="button"
                          onClick={() => setContentCoinsPage((p) => Math.max(1, p - 1))}
                          disabled={contentPage <= 1}
                          className="px-3 py-1.5 rounded-full border border-white/8 text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-40 disabled:hover:text-zinc-400"
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
                                className={`min-w-[28px] px-2 py-1 rounded-md border text-[11px] ${
                                  item === contentPage
                                    ? 'border-zinc-700 bg-white/8 text-white'
                                    : 'border-white/8 text-zinc-400 hover:text-white hover:border-zinc-700'
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
                          className="px-3 py-1.5 rounded-full border border-white/8 text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-40 disabled:hover:text-zinc-400"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {profileCoinsLoading ? (
                  <div className="p-8 flex items-center justify-center">
                    <div className="h-8 w-8 border-2 border-zinc-700 border-t-cyan-500 rounded-full animate-spin" />
                  </div>
                ) : contentCoins.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500">
                    No content coins found for this creator.
                  </div>
                ) : (
                  <div className="divide-y divide-white/6">
                    {pagedContentCoins.map((contentCoin, index) => (
                      <ContentCoinRow 
                        key={contentCoin.address || contentCoin.id || index} 
                        coin={contentCoin} 
                        rank={(contentPage - 1) * CONTENT_COINS_PAGE_SIZE + index + 1}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            {coin?.description && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="rounded-xl sm:rounded-2xl border border-white/8 bg-white/3 p-4 sm:p-6"
              >
                <h3 className="text-sm font-medium text-zinc-400 mb-3">About {displayName}</h3>
                <p className="text-sm text-zinc-300 leading-relaxed">{coin.description}</p>
              </motion.div>
            )}
          </motion.div>

          {/* Right Column - Info Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="space-y-3 sm:space-y-4"
          >
            {/* Swap Card */}
            <div className="rounded-xl sm:rounded-2xl border border-white/8 bg-white/3 p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-zinc-600 to-zinc-700 flex items-center justify-center">
                      <span className="text-sm font-medium text-zinc-300">{symbol.slice(0, 2)}</span>
                    </div>
                  )}
                  <div>
                    <div className="text-white font-medium">{displayName}</div>
                    <div className="text-xs text-zinc-500">{symbol}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ExploreUnfurlDebugCopy path={socialPreviewPath} className="px-2.5 py-0.5" />
                  <ExploreCopyButton
                    text={tokenAddress}
                    {...copyButtonProps}
                  />
                  <button
                    type="button"
                    className="text-zinc-400 hover:text-white transition-colors"
                    title="Share"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <Link
                to={`/swap?token=${tokenAddress}`}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-[#FF007A] hover:bg-[#FF007A]/90 text-white font-semibold text-base transition-colors"
              >
                Buy Creator Coin
              </Link>

              {creatorChatHref ? (
                <Link
                  to={creatorChatHref}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/8 text-white font-medium text-sm transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Chat with Creator
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="mt-3 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-white/10 bg-white/5 text-zinc-500 font-medium text-sm cursor-not-allowed"
                >
                  <MessageSquare className="w-4 h-4" />
                  Chat unavailable
                </button>
              )}
            </div>

            {/* Social + Links Card */}
            <div className="rounded-xl sm:rounded-2xl border border-white/8 bg-white/3 p-4 sm:p-5">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">Social &amp; Links</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-[11px] font-medium text-zinc-500 mb-2">Social</div>
                  <SocialLinks profile={profile} />
                  {!profile?.socialAccounts && (
                    <div className="text-sm text-zinc-600">No social accounts linked.</div>
                  )}
                </div>
                <div>
                  <div className="text-[11px] font-medium text-zinc-500 mb-2">Links</div>
                  <ResourceLinks tokenAddress={tokenAddress} />
                </div>
              </div>
            </div>

            {/* Stats Card */}
            <div className="rounded-xl sm:rounded-2xl border border-white/8 bg-white/3 p-4 sm:p-5">
              <h3 className="text-sm font-medium text-zinc-400 mb-2">Creator Coin Stats</h3>
              <ExploreStatRow
                label="Market cap"
                value={marketCap}
                icon={<TrendingUp className="w-3 h-3" />}
                {...statRowStyleProps}
              />
              <ExploreStatRow
                label="24H volume"
                value={volume24h}
                icon={<TrendingUp className="w-3 h-3" />}
                {...statRowStyleProps}
              />
              <ExploreStatRow
                label="All-time volume"
                value={totalVolume}
                icon={<TrendingUp className="w-3 h-3" />}
                {...statRowStyleProps}
              />
              <ExploreStatRow
                label="Holders"
                value={holders}
                icon={<Users className="w-3 h-3" />}
                {...statRowStyleProps}
              />
              <ExploreStatRow
                label="Created"
                value={createdAt}
                icon={<Calendar className="w-3 h-3" />}
                {...statRowStyleProps}
              />
              <ExploreStatRow
                label="Content coins"
                value={String(contentCoins.length)}
                icon={<Coins className="w-3 h-3" />}
                {...statRowStyleProps}
              />
            </div>

          </motion.div>
        </div>
      </div>
    </div>
  )
}
