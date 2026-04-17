/**
 * Utility to resolve CreatorCoin contract addresses to actual creator addresses.
 * Based on a CreatorCoin token page on BaseScan.
 *
 * Canonical lane naming (see AGENTS.md "Canonical Lane Terminology" +
 * docs/audits/creatorvault-business-logic-core-structure-audit.md §3):
 *
 * - `getCreatorCoinPayoutRecipient(...)` returns CreatorCoin `payoutRecipient()`
 *   — i.e. the `creatorCoinPayoutRecipient` lane (CreatorCoin EXTERNAL
 *   earnings routing; router mode feeds holder PPS accretion via
 *   `PayoutRouter.convertAndQueue(...)`).
 * - It is NOT the `tradeFeeCollector` lane. Do not use this helper to
 *   resolve ShareOFT/hook trade-fee destinations.
 */

import { createPublicClient, http, type Address } from 'viem'
import { base } from 'viem/chains'
import { getBrowserBaseReadRpcUrl } from '@/lib/base/baseReadRpcPolicy'
import { debugLogsFlag } from '@/lib/flags/featureFlags'
import { logger } from '@/lib/observability/logger'

const CREATOR_COIN_DEBUG = import.meta.env.DEV && debugLogsFlag()
const ZERO_ADDRESS = `0x${'0000000000000000000000000000000000000000'}` as Address
const IS_BROWSER = typeof window !== 'undefined'
const BASE_RPC_RAW =
  (import.meta.env.VITE_BASE_READ_RPC_URL as string | undefined)?.trim() ||
  (import.meta.env.VITE_BASE_RPC as string | undefined)?.trim() ||
  ''

function getBaseRpcUrl(): string {
  if (IS_BROWSER) return getBrowserBaseReadRpcUrl(BASE_RPC_RAW)
  if (BASE_RPC_RAW) return BASE_RPC_RAW
  return 'https://base-mainnet.public.blastapi.io'
}

const publicClient = createPublicClient({
  chain: base,
  transport: (() => {
    const rpcUrl = getBaseRpcUrl()
    if (rpcUrl.startsWith('/api/rpc')) {
      // Same-origin RPC proxy already retries upstream; avoid multiplying retries in the client.
      return http(rpcUrl, {
        retryCount: 0,
        retryDelay: 150,
      })
    }
    return http(rpcUrl)
  })(),
})

// CreatorCoin ABI - we only need the functions we're calling
const CREATOR_COIN_ABI = [
  {
    inputs: [],
    name: 'payoutRecipient',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'index', type: 'uint256' }],
    name: 'ownerAt',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalOwners',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

/**
 * Resolve CreatorCoin payoutRecipient.
 */
export async function getCreatorCoinPayoutRecipient(coinAddress: Address): Promise<Address | null> {
  try {
    const recipient = await publicClient.readContract({
      address: coinAddress,
      abi: CREATOR_COIN_ABI,
      functionName: 'payoutRecipient',
    })
    
    if (CREATOR_COIN_DEBUG) logger.debug('[CreatorCoin] payoutRecipient', { recipient })
    return recipient as Address
  } catch (error) {
    logger.error('[CreatorCoin] Failed to get payoutRecipient', error)
    return null
  }
}

/**
 * Get the owner at a specific index
 * Index 0: Coinbase Smart Account
 * Index 1: Privy
 * Index 2: Main EOA (Externally Owned Account)
 */
export async function getOwnerAt(coinAddress: Address, index: number): Promise<Address | null> {
  try {
    const owner = await publicClient.readContract({
      address: coinAddress,
      abi: CREATOR_COIN_ABI,
      functionName: 'ownerAt',
      args: [BigInt(index)],
    })
    
    if (CREATOR_COIN_DEBUG) logger.debug('[CreatorCoin] Owner at index', { index, owner })
    return owner as Address
  } catch (error) {
    logger.error('[CreatorCoin] Failed to get owner at index', { index, error })
    return null
  }
}

const MAX_OWNERS_SCAN = 128

/**
 * Get all owners of a CreatorCoin (capped to prevent DoS from malicious contracts).
 */
export async function getAllOwners(coinAddress: Address): Promise<Address[]> {
  try {
    const totalOwners = await publicClient.readContract({
      address: coinAddress,
      abi: CREATOR_COIN_ABI,
      functionName: 'totalOwners',
    })
    
    const count = Math.min(Number(totalOwners), MAX_OWNERS_SCAN)
    const owners: Address[] = []
    for (let i = 0; i < count; i++) {
      const owner = await getOwnerAt(coinAddress, i)
      if (owner) {
        owners.push(owner)
      }
    }
    
    if (CREATOR_COIN_DEBUG) logger.debug('[CreatorCoin] All owners', owners)
    return owners
  } catch (error) {
    logger.error('[CreatorCoin] Failed to get all owners', error)
    return []
  }
}

/**
 * Resolve a CreatorCoin address to the creator's main wallet
 * Priority:
 * 1. payoutRecipient (most reliable)
 * 2. Owner at index 2 (main EOA)
 * 3. Fallback to the contract address itself
 */
export async function resolveCreatorAddress(addressOrCoin: Address): Promise<Address> {
  if (CREATOR_COIN_DEBUG) logger.debug('[CreatorCoin] Resolving address', { addressOrCoin })
  
  try {
    // First try to resolve CreatorCoin payoutRecipient.
    const payoutRecipient = await getCreatorCoinPayoutRecipient(addressOrCoin)
    if (payoutRecipient && payoutRecipient !== ZERO_ADDRESS) {
      if (CREATOR_COIN_DEBUG) logger.debug('[CreatorCoin] Using payoutRecipient', { payoutRecipient })
      return payoutRecipient
    }
    
    // Fallback to owner at index 2 (main EOA)
    const mainEOA = await getOwnerAt(addressOrCoin, 2)
    if (mainEOA && mainEOA !== ZERO_ADDRESS) {
      if (CREATOR_COIN_DEBUG) logger.debug('[CreatorCoin] Using owner at index 2', { owner: mainEOA })
      return mainEOA
    }
    
    // If all else fails, return the original address
    if (CREATOR_COIN_DEBUG) logger.debug('[CreatorCoin] Using original address (not a CreatorCoin or no payoutRecipient)')
    return addressOrCoin
  } catch (error) {
    logger.error('[CreatorCoin] Error resolving address, using original', error)
    return addressOrCoin
  }
}

/**
 * Check if an address is a CreatorCoin contract
 */
export async function isCreatorCoin(address: Address): Promise<boolean> {
  try {
    // Try to call payoutRecipient getter - if it works, it's a CreatorCoin.
    await publicClient.readContract({
      address,
      abi: CREATOR_COIN_ABI,
      functionName: 'payoutRecipient',
    })
    return true
  } catch {
    return false
  }
}

