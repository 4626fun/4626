import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useIdentity } from '@/hooks/useIdentity'
import { fetchZoraProfile } from '@/lib/zora/client'

type ChatIdentitySource = 'zora' | 'basename' | 'ens' | 'address'

type UseChatIdentityOptions = {
  fallbackName?: string | null
  fallbackAvatar?: string | null
}

type ChatIdentityResult = {
  displayName: string
  avatar: string | null
  secondary: string | null
  source: ChatIdentitySource
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function lc(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function compactUnique(parts: Array<string | null | undefined>): string | null {
  const out: string[] = []
  for (const part of parts) {
    const trimmed = (part ?? '').trim()
    if (!trimmed) continue
    if (out.some((p) => lc(p) === lc(trimmed))) continue
    out.push(trimmed)
  }
  return out.length > 0 ? out.join(' · ') : null
}

function normalizeAddress(address: string | null | undefined): `0x${string}` | null {
  if (!address) return null
  const trimmed = address.trim().toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(trimmed) ? (trimmed as `0x${string}`) : null
}

function resolveZoraDisplayName(profile: Awaited<ReturnType<typeof fetchZoraProfile>> | undefined): string | null {
  const handle = String(profile?.handle ?? '').trim()
  if (handle) return handle
  const username = String(profile?.username ?? '').trim()
  if (username) return username
  const displayName = String(profile?.displayName ?? '').trim()
  if (displayName) return displayName
  return null
}

function resolveZoraAvatar(profile: Awaited<ReturnType<typeof fetchZoraProfile>> | undefined): string | null {
  const medium = String(profile?.avatar?.medium ?? '').trim()
  if (medium) return medium
  const small = String(profile?.avatar?.small ?? '').trim()
  if (small) return small
  return null
}

export function useChatIdentity(
  address: string | null | undefined,
  options: UseChatIdentityOptions = {},
): ChatIdentityResult {
  const normalizedAddress = normalizeAddress(address)
  const identity = useIdentity(normalizedAddress)
  const zoraProfile = useQuery({
    queryKey: ['chatIdentityZoraProfile', normalizedAddress],
    queryFn: async () => {
      if (!normalizedAddress) return null
      return fetchZoraProfile(normalizedAddress)
    },
    enabled: Boolean(normalizedAddress),
    staleTime: 5 * 60_000,
  })

  return useMemo(() => {
    const fallbackAddress = normalizedAddress ? shortAddress(normalizedAddress) : 'XMTP contact'
    const fallbackName = String(options.fallbackName ?? '').trim() || fallbackAddress
    const zoraName = resolveZoraDisplayName(zoraProfile.data)
    const zoraAvatar = resolveZoraAvatar(zoraProfile.data)
    const basenameName = identity.basenameDisplayName ?? identity.basename
    const ensName = identity.ensName
    const addressName = fallbackAddress

    if (zoraName) {
      return {
        displayName: zoraName,
        avatar: zoraAvatar ?? identity.basenameAvatar ?? identity.avatar ?? options.fallbackAvatar ?? null,
        secondary: compactUnique([basenameName, ensName, addressName]),
        source: 'zora',
      }
    }

    if (basenameName) {
      return {
        displayName: basenameName,
        avatar: identity.basenameAvatar ?? identity.avatar ?? options.fallbackAvatar ?? null,
        secondary: compactUnique([ensName, addressName]),
        source: 'basename',
      }
    }

    if (ensName) {
      return {
        displayName: ensName,
        avatar: identity.avatar ?? options.fallbackAvatar ?? null,
        secondary: compactUnique([addressName]),
        source: 'ens',
      }
    }

    return {
      displayName: normalizedAddress ? addressName : fallbackName,
      avatar: identity.avatar ?? options.fallbackAvatar ?? null,
      secondary: normalizedAddress ? null : fallbackName,
      source: 'address',
    }
  }, [identity.avatar, identity.basename, identity.basenameAvatar, identity.basenameDisplayName, identity.ensName, normalizedAddress, options.fallbackAvatar, options.fallbackName, zoraProfile.data])
}
