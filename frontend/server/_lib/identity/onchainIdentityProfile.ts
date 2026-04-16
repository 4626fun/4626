import { createPublicClient, http, toCoinType } from 'viem'
import { base, mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'

type ProfileRecord = {
  name: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  website: string | null
  twitter: string | null
  github: string | null
  discord: string | null
}

export type OnchainIdentityProfile = {
  source: 'ens' | 'basename'
  address: string
  ensName: string | null
  basename: string | null
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  website: string | null
  twitter: string | null
  github: string | null
  discord: string | null
}

const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000
const profileCache = new Map<string, { expiresAt: number; value: OnchainIdentityProfile | null }>()

function getEthRpcUrl(): string {
  return (
    (process.env.ETH_RPC_URL ?? '').trim() ||
    (process.env.ETHEREUM_RPC_URL ?? '').trim() ||
    'https://eth.llamarpc.com'
  )
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function getClient() {
  return createPublicClient({
    chain: mainnet,
    transport: http(getEthRpcUrl(), { timeout: 10_000 }),
  })
}

async function readProfileRecord(name: string): Promise<ProfileRecord | null> {
  const trimmed = name.trim()
  if (!trimmed) return null

  try {
    const client = getClient()
    const normalized = normalize(trimmed)
    const [avatar, displayName, description, url, twitter, github, discord] = await Promise.all([
      client.getEnsAvatar({ name: normalized }).catch(() => null),
      client.getEnsText({ name: normalized, key: 'name' }).catch(() => null),
      client.getEnsText({ name: normalized, key: 'description' }).catch(() => null),
      client.getEnsText({ name: normalized, key: 'url' }).catch(() => null),
      client.getEnsText({ name: normalized, key: 'com.twitter' }).catch(() => null),
      client.getEnsText({ name: normalized, key: 'com.github' }).catch(() => null),
      client.getEnsText({ name: normalized, key: 'com.discord' }).catch(() => null),
    ])

    return {
      name: trimmed,
      displayName: typeof displayName === 'string' && displayName.trim() ? displayName.trim() : null,
      bio: typeof description === 'string' && description.trim() ? description.trim() : null,
      avatarUrl: typeof avatar === 'string' && avatar.trim() ? avatar.trim() : null,
      website: typeof url === 'string' && url.trim() ? url.trim() : null,
      twitter: typeof twitter === 'string' && twitter.trim() ? twitter.trim() : null,
      github: typeof github === 'string' && github.trim() ? github.trim() : null,
      discord: typeof discord === 'string' && discord.trim() ? discord.trim() : null,
    }
  } catch {
    return null
  }
}

async function resolveEnsName(address: `0x${string}`): Promise<string | null> {
  try {
    const client = getClient()
    const name = await client.getEnsName({ address })
    return typeof name === 'string' && name.trim() ? name.trim() : null
  } catch {
    return null
  }
}

async function resolveBasename(address: `0x${string}`): Promise<string | null> {
  try {
    const client = getClient()
    const name = await client.getEnsName({
      address,
      coinType: toCoinType(base.id),
      gatewayUrls: ['https://ccip.ens.xyz'],
    })
    const normalized = typeof name === 'string' ? name.trim().toLowerCase() : ''
    if (!normalized.endsWith('.base.eth')) return null
    return normalized
  } catch {
    return null
  }
}

export async function resolveOnchainIdentityProfile(address: string): Promise<OnchainIdentityProfile | null> {
  const normalizedAddress = typeof address === 'string' ? address.trim().toLowerCase() : ''
  if (!isAddressLike(normalizedAddress)) return null

  const cached = profileCache.get(normalizedAddress)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const checksumAddress = normalizedAddress as `0x${string}`
  const [ensName, basename] = await Promise.all([
    resolveEnsName(checksumAddress),
    resolveBasename(checksumAddress),
  ])

  const [ensRecord, basenameRecord] = await Promise.all([
    ensName ? readProfileRecord(ensName) : Promise.resolve(null),
    basename ? readProfileRecord(basename) : Promise.resolve(null),
  ])

  const selected = ensRecord ?? basenameRecord
  const source: 'ens' | 'basename' | null = ensRecord ? 'ens' : basenameRecord ? 'basename' : null

  const value: OnchainIdentityProfile | null = selected && source
    ? {
        source,
        address: normalizedAddress,
        ensName,
        basename,
        displayName: selected.displayName ?? selected.name,
        bio: selected.bio,
        avatarUrl: selected.avatarUrl,
        website: selected.website,
        twitter: selected.twitter,
        github: selected.github,
        discord: selected.discord,
      }
    : null

  profileCache.set(normalizedAddress, { expiresAt: Date.now() + PROFILE_CACHE_TTL_MS, value })
  return value
}
