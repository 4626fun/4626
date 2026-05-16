export type ZoraPreviewImage = {
  small?: string
  medium?: string
  blurhash?: string
}

export type ZoraMediaContent = {
  mimeType?: string
  originalUri?: string
  previewImage?: ZoraPreviewImage
}

export type ZoraCreatorProfile = {
  id?: string
  handle?: string
  avatar?: {
    previewImage?: ZoraPreviewImage
  }
}

export type ZoraEarnings = {
  amount?: {
    currencyAddress?: string
    amountRaw?: string
    amountDecimal?: number
  }
  amountUsd?: string
}

export type ZoraPoolCurrencyToken = {
  address?: string
  name?: string
  decimals?: number
}

export type ZoraTokenPrice = {
  priceInUsdc?: string
  currencyAddress?: string
  priceInPoolToken?: string
}

export type ZoraCoin = {
  id?: string
  platformBlocked?: boolean
  name?: string
  description?: string
  address?: string
  symbol?: string
  coinType?: 'CREATOR' | 'CONTENT' | string
  totalSupply?: string
  totalVolume?: string
  volume24h?: string
  createdAt?: string
  creatorAddress?: string
  creatorProfile?: ZoraCreatorProfile
  creatorEarnings?: ZoraEarnings[]
  poolCurrencyToken?: ZoraPoolCurrencyToken
  tokenPrice?: ZoraTokenPrice
  marketCap?: string
  marketCapDelta24h?: string
  chainId?: number
  uniqueHolders?: number
  tokenUri?: string
  platformReferrerAddress?: string
  payoutRecipientAddress?: string
  mediaContent?: ZoraMediaContent
  ethosScore?: number | null
  ethosLevel?: string | null
  ethosScoreSource?: string | null
}

export type ZoraEdge<T> = { node?: T; cursor?: string }

export type ZoraPageInfo = {
  hasNextPage?: boolean
  endCursor?: string
}

export type ZoraConnection<T> = {
  edges?: Array<ZoraEdge<T>>
  pageInfo?: ZoraPageInfo
}

export type ZoraExploreList = ZoraConnection<ZoraCoin> & { count?: number }

export type ZoraLinkedWallet = {
  walletType?: string
  walletAddress?: string
}

export type ZoraProfile = {
  id?: string
  handle?: string
  platformBlocked?: boolean
  displayName?: string
  bio?: string
  username?: string
  website?: string
  socialAccounts?: {
    twitter?: { username?: string; displayName?: string; followerCount?: number; id?: string | null } | null
    instagram?: { username?: string; displayName?: string; followerCount?: number; id?: string | null } | null
    tiktok?: { username?: string; displayName?: string; followerCount?: number; id?: string | null } | null
  } | null
  avatar?: {
    small?: string
    medium?: string
    blurhash?: string
  }
  publicWallet?: { walletAddress?: string }
  linkedWallets?: ZoraConnection<ZoraLinkedWallet>
  creatorCoin?: {
    address?: string
    marketCap?: string
    marketCapDelta24h?: string
  }
  createdCoins?: (ZoraConnection<ZoraCoin> & { count?: number })
}

export type ZoraExploreListType =
  | 'TOP_GAINERS'
  | 'TOP_VOLUME_24H'
  | 'MOST_VALUABLE'
  | 'NEW'
  | 'LAST_TRADED'
  | 'LAST_TRADED_UNIQUE'
  // Trend-specific lists
  | 'MOST_VALUABLE_TRENDS'
  | 'NEW_TRENDS'
  | 'TOP_VOLUME_TRENDS_24H'
  | 'TRENDING_TRENDS'
  // Creator-specific lists
  | 'NEW_CREATORS'
  | 'MOST_VALUABLE_CREATORS'
  | 'TOP_VOLUME_CREATORS_24H'
  | 'FEATURED_CREATORS'
  | 'TRENDING_CREATORS'
  // Content-specific lists
  | 'FEATURED_VIDEOS'
  | 'TRENDING_POSTS'
  // Combined lists
  | 'TRENDING_ALL'
  | 'TOP_VOLUME_ALL_24H'
  | 'NEW_ALL'
  | 'MOST_VALUABLE_ALL'


