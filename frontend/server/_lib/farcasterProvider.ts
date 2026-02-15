import { readNeynarApiKey } from './neynarConfig.js'
import { logger } from './logger.js'

export type FarcasterProviderMode = 'neynar' | 'protocol' | 'hybrid'

export type FarcasterProfile = {
  fid: number | null
  username: string | null
  displayName: string | null
  avatar: string | null
  bio: string | null
  followers: number | null
  following: number | null
  verified: boolean | null
  verifications: string[]
  url: string | null
  custodyAddress: string | null
  verifiedEthAddresses: string[]
  primaryAddress: string | null
  fetchedAt: number
}

export type FarcasterProfileResolution = {
  profile: FarcasterProfile | null
  source: 'neynar' | 'protocol' | 'none'
  mode: FarcasterProviderMode
}

declare const process: { env: Record<string, string | undefined> }

const NEYNAR_API_BASE = 'https://api.neynar.com/v2/farcaster'

export function getFarcasterProviderMode(): FarcasterProviderMode {
  const raw = String(process.env.FARCASTER_PROVIDER_MODE ?? 'hybrid').trim().toLowerCase()
  if (raw === 'neynar' || raw === 'protocol' || raw === 'hybrid') return raw
  return 'hybrid'
}

function normalizeAddressLike(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(v)) return null
  return v
}

function uniqueAddresses(values: Array<string | null | undefined>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const normalized = normalizeAddressLike(value)
    if (!normalized) continue
    const lc = normalized.toLowerCase()
    if (seen.has(lc)) continue
    seen.add(lc)
    out.push(normalized)
  }
  return out
}

function profileFromNeynarUser(user: any, now: number): FarcasterProfile {
  const fid = Number(user?.fid)
  const username = typeof user?.username === 'string' ? user.username : null
  return {
    fid: Number.isFinite(fid) && fid > 0 ? fid : null,
    username,
    displayName: typeof user?.display_name === 'string' ? user.display_name : null,
    avatar: typeof user?.pfp_url === 'string' ? user.pfp_url : null,
    bio: typeof user?.profile?.bio?.text === 'string' ? user.profile.bio.text : null,
    followers: Number.isFinite(Number(user?.follower_count)) ? Number(user.follower_count) : null,
    following: Number.isFinite(Number(user?.following_count)) ? Number(user.following_count) : null,
    verified: typeof user?.power_badge === 'boolean' ? user.power_badge : null,
    verifications: uniqueAddresses(Array.isArray(user?.verifications) ? user.verifications : []),
    url: username ? `https://warpcast.com/${username}` : null,
    custodyAddress:
      normalizeAddressLike(user?.custody_address) ??
      normalizeAddressLike(user?.custodyAddress) ??
      normalizeAddressLike(user?.custody?.address),
    verifiedEthAddresses: uniqueAddresses(
      Array.isArray(user?.verified_addresses?.eth_addresses) ? user.verified_addresses.eth_addresses : [],
    ),
    primaryAddress: null,
    fetchedAt: now,
  }
}

async function fetchNeynarProfile(params: { address?: string | null; fid?: number | null }): Promise<FarcasterProfile | null> {
  const apiKey = readNeynarApiKey({ context: 'farcasterProvider' })
  if (!apiKey) return null

  const headers = {
    api_key: apiKey,
    'Content-Type': 'application/json',
  } as const

  let response: Response
  if (params.fid && Number.isFinite(params.fid) && params.fid > 0) {
    response = await fetch(`${NEYNAR_API_BASE}/user/bulk?fids=${params.fid}`, { headers })
  } else if (params.address) {
    response = await fetch(
      `${NEYNAR_API_BASE}/user/bulk-by-address?addresses=${encodeURIComponent(params.address)}`,
      { headers },
    )
  } else {
    return null
  }

  if (!response.ok) return null
  const data = (await response.json()) as any

  let user: any | null = null
  if (params.fid) {
    const users = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : null
    user = Array.isArray(users) && users.length > 0 ? users[0] : null
  } else {
    const map = data as Record<string, any>
    const k = Object.keys(map ?? {})[0]
    const users = k ? map[k] : null
    user = Array.isArray(users) && users.length > 0 ? users[0] : null
  }

  if (!user) return null
  return profileFromNeynarUser(user, Math.floor(Date.now() / 1000))
}

async function fetchProtocolProfile(params: { address?: string | null; fid?: number | null }): Promise<FarcasterProfile | null> {
  // Protocol/public fallback today: primarily supports fid -> primary address.
  if (!params.fid || !Number.isFinite(params.fid) || params.fid <= 0) return null

  try {
    const res = await fetch(
      `https://api.farcaster.xyz/fc/primary-address?fid=${encodeURIComponent(String(params.fid))}&protocol=ethereum`,
      { headers: { Accept: 'application/json' } },
    )
    if (!res.ok) return null
    const json = (await res.json().catch(() => null)) as any
    const primaryAddress = normalizeAddressLike(json?.result?.address?.address)
    return {
      fid: params.fid,
      username: null,
      displayName: null,
      avatar: null,
      bio: null,
      followers: null,
      following: null,
      verified: null,
      verifications: [],
      url: null,
      custodyAddress: primaryAddress,
      verifiedEthAddresses: primaryAddress ? [primaryAddress] : [],
      primaryAddress,
      fetchedAt: Math.floor(Date.now() / 1000),
    }
  } catch {
    return null
  }
}

export async function resolveFarcasterProfile(params: {
  address?: string | null
  fid?: number | null
}): Promise<FarcasterProfileResolution> {
  const mode = getFarcasterProviderMode()

  if (mode === 'neynar') {
    const profile = await fetchNeynarProfile(params)
    return { profile, source: profile ? 'neynar' : 'none', mode }
  }

  if (mode === 'protocol') {
    const profile = await fetchProtocolProfile(params)
    return { profile, source: profile ? 'protocol' : 'none', mode }
  }

  // hybrid: prefer protocol, fall back to neynar when needed.
  const protocol = await fetchProtocolProfile(params)
  if (protocol) return { profile: protocol, source: 'protocol', mode }

  const neynar = await fetchNeynarProfile(params)
  if (neynar) {
    logger.info('[farcasterProvider] Falling back to Neynar profile resolution', {
      hasFid: Boolean(params.fid),
      hasAddress: Boolean(params.address),
    })
    return { profile: neynar, source: 'neynar', mode }
  }

  return { profile: null, source: 'none', mode }
}
