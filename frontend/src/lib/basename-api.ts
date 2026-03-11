// Basenames integration using OnchainKit
// Docs: https://docs.base.org/base-account/basenames/basenames-onchainkit-tutorial

import { createPublicClient, fallback, getAddress, http, isAddress, toCoinType } from 'viem'
import { base, baseSepolia, mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'
import { logger } from './logger'

export interface BasenameInfo {
  name: string | null // e.g., "akita.base.eth"
  avatar?: string | null
  displayName?: string | null
  description?: string | null
  twitter?: string | null
  github?: string | null
  discord?: string | null
  email?: string | null
  url?: string | null
}

const IS_BROWSER = typeof window !== 'undefined'

function createMainnetReadClient() {
  // Avoid viem's default public endpoint selection in browsers (can pick
  // providers without permissive CORS, e.g. eth.merkle.io).
  return createPublicClient({
    chain: mainnet,
    transport: fallback(
      (IS_BROWSER
        ? ['/api/rpc?chain=mainnet']
        : ['https://ethereum-rpc.publicnode.com', 'https://rpc.ankr.com/eth', 'https://eth.llamarpc.com']).map((url) =>
        http(url),
      ),
    ),
  })
}

/**
 * Get Basename for an address
 */
export async function getBasename(
  address: string,
  chainId: number = base.id
): Promise<string | null> {
  try {
    // Basenames are resolved via ENSIP-19 reverse resolution on Ethereum mainnet,
    // using Base chain coinType + CCIP gateways.
    //
    // This works in browsers without requiring Base L2 ENS universal resolver config.
    const client = createMainnetReadClient()

    const name = await client.getEnsName({
      address: address as `0x${string}`,
      coinType: toCoinType(chainId === baseSepolia.id ? baseSepolia.id : base.id),
      gatewayUrls: ['https://ccip.ens.xyz'],
    })

    if (!name) return null
    // Guardrail: ENSIP-19 can resolve non-Basenames depending on user config.
    // For 4626 identity UI, only treat *.base.eth as a Basename.
    if (!name.toLowerCase().endsWith('.base.eth')) return null
    return name
  } catch (error) {
    logger.error('Failed to fetch Basename', error)
    return null
  }
}

function normalizeBasenameInput(input: string): string | null {
  const raw = input.trim().toLowerCase()
  if (!raw) return null
  const withoutAt = raw.startsWith('@') ? raw.slice(1).trim() : raw
  if (!withoutAt) return null
  if (withoutAt.endsWith('.base.eth')) return withoutAt
  if (withoutAt.includes('.')) return null
  if (!/^[a-z0-9-]{1,255}$/.test(withoutAt)) return null
  return `${withoutAt}.base.eth`
}

/**
 * Resolve a Basename handle (or full basename) to an EVM address.
 * Accepts:
 * - "akita"
 * - "@akita"
 * - "akita.base.eth"
 * - "0x..." (passes through normalized checksum)
 */
export async function resolveBasenameAddress(
  input: string,
  chainId: number = base.id,
): Promise<string | null> {
  try {
    const raw = input.trim()
    if (!raw) return null
    if (isAddress(raw)) return getAddress(raw)

    const basename = normalizeBasenameInput(raw)
    if (!basename) return null

    const client = createMainnetReadClient()
    const resolved = await client.getEnsAddress({
      name: normalize(basename),
      coinType: toCoinType(chainId === baseSepolia.id ? baseSepolia.id : base.id),
      gatewayUrls: ['https://ccip.ens.xyz'],
    })
    return resolved ? getAddress(resolved) : null
  } catch (error) {
    logger.error('Failed to resolve Basename address', error)
    return null
  }
}

/**
 * Get Basename with full profile info
 */
export async function getBasenameProfile(
  address: string,
  chainId: number = base.id
): Promise<BasenameInfo> {
  try {
    const name = await getBasename(address, chainId)
    
    if (!name) {
      return { name: null }
    }

    const client = createMainnetReadClient()

    // Fetch ENS text records in parallel
    const [avatar, displayName, description, twitter, github, discord, email, url] = 
      await Promise.all([
        client.getEnsAvatar({ name: normalize(name) }).catch(() => null),
        client.getEnsText({ name: normalize(name), key: 'name' }).catch(() => null),
        client.getEnsText({ name: normalize(name), key: 'description' }).catch(() => null),
        client.getEnsText({ name: normalize(name), key: 'com.twitter' }).catch(() => null),
        client.getEnsText({ name: normalize(name), key: 'com.github' }).catch(() => null),
        client.getEnsText({ name: normalize(name), key: 'com.discord' }).catch(() => null),
        client.getEnsText({ name: normalize(name), key: 'email' }).catch(() => null),
        client.getEnsText({ name: normalize(name), key: 'url' }).catch(() => null),
      ])

    return {
      name,
      avatar,
      displayName,
      description,
      twitter,
      github,
      discord,
      email,
      url,
    }
  } catch (error) {
    logger.error('Failed to fetch Basename profile', error)
    return { name: null }
  }
}

/**
 * Get Basename profile info directly from a basename handle.
 * Accepts "akita", "@akita", or "akita.base.eth".
 */
export async function getBasenameProfileByName(
  input: string,
): Promise<BasenameInfo> {
  try {
    const basename = normalizeBasenameInput(input)
    if (!basename) return { name: null }

    const client = createMainnetReadClient()

    const [avatar, displayName, description, twitter, github, discord, email, url] =
      await Promise.all([
        client.getEnsAvatar({ name: normalize(basename) }).catch(() => null),
        client.getEnsText({ name: normalize(basename), key: 'name' }).catch(() => null),
        client.getEnsText({ name: normalize(basename), key: 'description' }).catch(() => null),
        client.getEnsText({ name: normalize(basename), key: 'com.twitter' }).catch(() => null),
        client.getEnsText({ name: normalize(basename), key: 'com.github' }).catch(() => null),
        client.getEnsText({ name: normalize(basename), key: 'com.discord' }).catch(() => null),
        client.getEnsText({ name: normalize(basename), key: 'email' }).catch(() => null),
        client.getEnsText({ name: normalize(basename), key: 'url' }).catch(() => null),
      ])

    return {
      name: basename,
      avatar,
      displayName,
      description,
      twitter,
      github,
      discord,
      email,
      url,
    }
  } catch (error) {
    logger.error('Failed to fetch Basename profile by name', error)
    return { name: null }
  }
}

/**
 * Format Basename for display (remove .base.eth suffix for cleaner look)
 */
export function formatBasename(name: string | null): string {
  if (!name) return ''
  return name.replace('.base.eth', '')
}

/**
 * Check if address has a Basename
 */
export async function hasBasename(address: string): Promise<boolean> {
  const name = await getBasename(address)
  return name !== null
}
