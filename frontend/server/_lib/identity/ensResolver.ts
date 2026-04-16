/**
 * ENS mainnet resolution via viem.
 *
 * Resolves Ethereum mainnet ENS names and text records for a wallet address.
 * Follows the same pattern as the Basenames client but targets Ethereum L1.
 */

import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'

export type EnsProfile = {
  /** ENS primary name (e.g. "vitalik.eth"). Null if no reverse record. */
  name: string | null
  avatar?: string | null
  displayName?: string | null
  description?: string | null
  twitter?: string | null
  github?: string | null
  discord?: string | null
  email?: string | null
  url?: string | null
}

function getEthRpcUrl(): string {
  // Prefer explicit env var, fall back to public endpoint.
  return (
    (process.env.ETH_RPC_URL ?? '').trim() ||
    (process.env.ETHEREUM_RPC_URL ?? '').trim() ||
    'https://eth.llamarpc.com'
  )
}

function getClient() {
  return createPublicClient({
    chain: mainnet,
    transport: http(getEthRpcUrl(), { timeout: 10_000 }),
  })
}

/**
 * Resolve the primary ENS name for an address.
 */
export async function getEnsName(address: string): Promise<string | null> {
  try {
    const client = getClient()
    const name = await client.getEnsName({
      address: address as `0x${string}`,
    })
    return name
  } catch {
    return null
  }
}

/**
 * Resolve full ENS profile with text records.
 */
export async function getEnsProfile(address: string): Promise<EnsProfile> {
  try {
    const name = await getEnsName(address)

    if (!name) {
      return { name: null }
    }

    const client = getClient()
    const normalized = normalize(name)

    const [avatar, displayName, description, twitter, github, discord, email, url] =
      await Promise.all([
        client.getEnsAvatar({ name: normalized }).catch(() => null),
        client.getEnsText({ name: normalized, key: 'name' }).catch(() => null),
        client.getEnsText({ name: normalized, key: 'description' }).catch(() => null),
        client.getEnsText({ name: normalized, key: 'com.twitter' }).catch(() => null),
        client.getEnsText({ name: normalized, key: 'com.github' }).catch(() => null),
        client.getEnsText({ name: normalized, key: 'com.discord' }).catch(() => null),
        client.getEnsText({ name: normalized, key: 'email' }).catch(() => null),
        client.getEnsText({ name: normalized, key: 'url' }).catch(() => null),
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
  } catch {
    return { name: null }
  }
}
