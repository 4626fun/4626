import type { ZoraCoin, ZoraProfile } from '@/lib/zora/types'

export function normalizeXUsername(value: string | null | undefined): string | null {
  const username = typeof value === 'string' ? value.trim().replace(/^@+/, '') : ''
  if (!/^[A-Za-z0-9_]{1,15}$/.test(username)) return null
  return username
}

export function buildEthosSocialUserkeyFromXUsername(value: string | null | undefined): string | null {
  const xUsername = normalizeXUsername(value)
  if (!xUsername) return null
  return `service:x.com:username:${xUsername}`
}

export function buildEthosSocialUserkeyFromZoraProfile(profile: ZoraProfile | null | undefined): string | null {
  return buildEthosSocialUserkeyFromXUsername(profile?.socialAccounts?.twitter?.username)
}

export function getZoraCreatorProfileIdentifier(coin: ZoraCoin | null | undefined): string | null {
  const handle = typeof coin?.creatorProfile?.handle === 'string' ? coin.creatorProfile.handle.trim() : ''
  if (handle) return handle
  const creatorAddress = typeof coin?.creatorAddress === 'string' ? coin.creatorAddress.trim() : ''
  if (creatorAddress) return creatorAddress
  return null
}
