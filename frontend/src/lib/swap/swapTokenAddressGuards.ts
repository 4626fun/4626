import { erc20Abi, getAddress, isAddress, type Address } from 'viem'

import {
  isCanonicalCsw,
  isProtocolCsw,
} from '@/wallet/canonicalWalletPolicy'

/** Minimal Coinbase Smart Wallet surface used only for negative detection. */
export const COINBASE_SMART_WALLET_DETECT_ABI = [
  {
    type: 'function',
    name: 'ownerCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export type PublicContractReader = {
  // Intentionally loose so wagmi/viem PublicClient is assignable without casts.
  readContract: (params: any) => Promise<any>
}

export type StrictErc20Metadata = {
  name: string
  symbol: string
  decimals: number
}

/** Platform CSWs that must never appear as selectable swap tokens. */
export function isKnownNonTokenSwapAddress(address: string | null | undefined): boolean {
  if (!address || !isAddress(address)) return false
  return isProtocolCsw(address) || isCanonicalCsw(address)
}

/**
 * True when `address` must be excluded from the token selector list.
 * Includes known protocol/operator CSWs and an optional wallet/CSW owner address
 * (the balance holder is a wallet, never a tradeable ERC-20).
 */
export function isExcludedSwapTokenAddress(
  address: string | null | undefined,
  balanceOwnerAddress?: string | null,
): boolean {
  if (!address || !isAddress(address)) return false
  if (isKnownNonTokenSwapAddress(address)) return true
  if (!balanceOwnerAddress || !isAddress(balanceOwnerAddress)) return false
  return getAddress(address).toLowerCase() === getAddress(balanceOwnerAddress).toLowerCase()
}

/** Best-effort Coinbase Smart Wallet probe via `ownerCount()`. */
export async function detectCoinbaseSmartWallet(
  client: PublicContractReader,
  address: Address,
): Promise<boolean> {
  try {
    const count = await client.readContract({
      address: getAddress(address),
      abi: COINBASE_SMART_WALLET_DETECT_ABI,
      functionName: 'ownerCount',
    })
    if (typeof count === 'bigint') return count >= 0n
    if (typeof count === 'number') return Number.isFinite(count) && count >= 0
    return false
  } catch {
    return false
  }
}

/**
 * Read ERC-20 metadata only when name, symbol, and decimals all resolve.
 * Does not invent fallback labels (that previously made CSWs look like tokens).
 */
export async function readStrictErc20Metadata(
  client: PublicContractReader,
  address: Address,
): Promise<StrictErc20Metadata | null> {
  const tokenAddress = getAddress(address)
  const [nameResult, symbolResult, decimalsResult] = await Promise.all([
    client
      .readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'name',
      })
      .catch(() => null),
    client
      .readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'symbol',
      })
      .catch(() => null),
    client
      .readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'decimals',
      })
      .catch(() => null),
  ])

  const name = typeof nameResult === 'string' ? nameResult.trim() : ''
  const symbol = typeof symbolResult === 'string' ? symbolResult.trim() : ''
  const decimalsRaw =
    typeof decimalsResult === 'number'
      ? decimalsResult
      : typeof decimalsResult === 'bigint'
        ? Number(decimalsResult)
        : Number.NaN

  if (!name || !symbol) return null
  if (!Number.isInteger(decimalsRaw) || decimalsRaw < 0 || decimalsRaw > 255) return null

  return { name, symbol, decimals: decimalsRaw }
}

export type AddressTokenImportResult =
  | { ok: true; metadata: StrictErc20Metadata }
  | { ok: false; reason: 'smart_wallet' | 'not_erc20' }

/**
 * Resolve a pasted/searched address into importable ERC-20 metadata, or reject
 * Coinbase Smart Wallets and non-token contracts.
 */
export async function resolveAddressTokenImport(params: {
  client: PublicContractReader
  address: Address
}): Promise<AddressTokenImportResult> {
  const address = getAddress(params.address)

  if (isKnownNonTokenSwapAddress(address)) {
    return { ok: false, reason: 'smart_wallet' }
  }

  // Prefer real ERC-20 metadata before CSW probing so a colliding `ownerCount`
  // selector cannot hide a valid token.
  const metadata = await readStrictErc20Metadata(params.client, address)
  if (metadata) return { ok: true, metadata }

  if (await detectCoinbaseSmartWallet(params.client, address)) {
    return { ok: false, reason: 'smart_wallet' }
  }

  return { ok: false, reason: 'not_erc20' }
}
