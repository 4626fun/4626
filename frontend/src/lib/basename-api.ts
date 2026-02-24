// Basenames integration using OnchainKit
// Docs: https://docs.base.org/base-account/basenames/basenames-onchainkit-tutorial

import { createPublicClient, http, toCoinType } from 'viem'
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
    const client = createPublicClient({
      chain: mainnet,
      transport: http(),
    })

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

    const client = createPublicClient({
      chain: mainnet,
      transport: http(),
    })

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
