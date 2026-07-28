import { getAddress, type Address } from 'viem'

import { AKITA } from '@/config/contracts'
import { ZORA_NATIVE_ETH_TOKEN } from '@/lib/alfaclub/ethFundingRouter'
import { NATIVE_TOKEN_ADDRESS } from '@/lib/uniswap/swapUtils'

/**
 * Official Sudoswap FriendKey markets price keys in an ERC-20 pair asset.
 *
 * Live today: Creator Coin (Zora AKITA) ↔ FriendKey ERC-1155.
 * Planned when vaults are live: ShareOFT ↔ FriendKey ERC-1155, with ETH funding
 * as ETH → ShareOFT (Uniswap) → key — fewer hops / less slippage than
 * ETH → Creator Coin (Zora) → key.
 *
 * Do not flip `kind` to `shareOft` until (1) a ShareOFT/FriendKey Sudoswap pair
 * is deployed + registered, (2) ETH→ShareOFT liquidity is verified, and
 * (3) paymaster/access-policy envs point at the ShareOFT pair ERC-20.
 */

export type FriendKeyPairErc20Kind = 'creatorCoin' | 'shareOft'

export type FriendKeyEthFundingProvider = 'zora' | 'uniswap'

export type FriendKeyFundingLane = {
  kind: FriendKeyPairErc20Kind
  /** ERC-20 held on the Sudoswap ERC-1155/ERC-20 TRADE pair. */
  pairErc20: Address
  /** How ETH is converted into `pairErc20` before the Sudoswap key buy. */
  ethFundingProvider: FriendKeyEthFundingProvider
  /** Native ETH address form expected by the funding quote provider. */
  ethTokenIn: string
  pairSymbol: string
  pairName: string
  routeSummary: string
  /** Short UI hint under the Pay-with toggle. */
  routeHint: string
}

export const ROOM_1659_CREATOR_COIN = getAddress(
  '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
)

const ZERO = '0x0000000000000000000000000000000000000000'

function readKindFromEnv(raw: string | undefined): FriendKeyPairErc20Kind {
  const normalized = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (
    normalized === 'shareoft' ||
    normalized === 'share_oft' ||
    normalized === 'share-oft' ||
    normalized === 'share'
  ) {
    return 'shareOft'
  }
  return 'creatorCoin'
}

export function resolveFriendKeyFundingLane(params?: {
  kind?: FriendKeyPairErc20Kind
  creatorCoin?: Address
  shareOft?: Address
}): FriendKeyFundingLane {
  const kind =
    params?.kind ??
    readKindFromEnv(
      (import.meta as { env?: Record<string, string | undefined> }).env
        ?.VITE_ALFACLUB_FRIENDKEY_PAIR_ERC20_KIND,
    )

  if (kind === 'shareOft') {
    const shareOft = getAddress(
      params?.shareOft ?? AKITA.shareOFT ?? ZERO,
    )
    if (shareOft === ZERO) {
      throw new Error('ShareOFT address is not configured for FriendKey funding')
    }
    return {
      kind: 'shareOft',
      pairErc20: shareOft,
      ethFundingProvider: 'uniswap',
      ethTokenIn: NATIVE_TOKEN_ADDRESS,
      pairSymbol: '■AKITA',
      pairName: 'AKITA ShareOFT',
      routeSummary: 'ETH → Uniswap → ShareOFT → Sudoswap',
      routeHint: 'ETH → ShareOFT → key',
    }
  }

  const creatorCoin = getAddress(params?.creatorCoin ?? ROOM_1659_CREATOR_COIN)
  return {
    kind: 'creatorCoin',
    pairErc20: creatorCoin,
    ethFundingProvider: 'zora',
    ethTokenIn: ZORA_NATIVE_ETH_TOKEN,
    pairSymbol: 'AKITA',
    pairName: 'AKITA Creator Coin',
    routeSummary: 'ETH → ZORA → AKITA → Sudoswap',
    routeHint: 'ETH → ZORA → AKITA → key',
  }
}

/** Room 1659 helper — same resolver, explicit room-facing name. */
export function resolveRoom1659FriendKeyFundingLane(params?: {
  kind?: FriendKeyPairErc20Kind
}): FriendKeyFundingLane {
  return resolveFriendKeyFundingLane(params)
}
