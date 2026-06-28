import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useIdentity } from '@/hooks/useIdentity'
import { getBasenameProfileByName } from '@/lib/basename/basename-api'
import { fetchZoraProfile } from '@/lib/zora/client'
import { getBasenameAutocompleteCandidate } from '@/lib/xmtp/socialIdentity'

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
  loading: boolean
}

export function isTruncatedAddressLabel(value: string | null | undefined): boolean {
  const trimmed = (value ?? '').trim()
  return /^0x[a-fA-F0-9]{4}(?:…|\.{3})[a-fA-F0-9]{4}$/i.test(trimmed) || /^0x[a-fA-F0-9]{40}$/i.test(trimmed)
}

function resolveMeaningfulFallbackName(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim()
  if (!trimmed || isTruncatedAddressLabel(trimmed)) return null
  return trimmed
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
  const avatar = profile?.avatar
  const medium = String(avatar?.previewImage?.medium ?? avatar?.medium ?? '').trim()
  if (medium) return medium
  const small = String(avatar?.previewImage?.small ?? avatar?.small ?? '').trim()
  if (small) return small
  return null
}

function resolveBasenameLabelFromProfile(
  profile: Awaited<ReturnType<typeof getBasenameProfileByName>> | null | undefined,
): string | null {
  const rawName = String(profile?.name ?? '').trim()
  if (!rawName) return null
  const displayName = String(profile?.displayName ?? '').trim()
  if (displayName) return displayName
  if (rawName.toLowerCase().endsWith('.base.eth')) {
    const shortHandle = rawName.replace(/\.base\.eth$/i, '').trim()
    if (shortHandle) return shortHandle
  }
  return rawName
}

export function useChatIdentity(
  address: string | null | undefined,
  options: UseChatIdentityOptions = {},
): ChatIdentityResult {
  const normalizedAddress = normalizeAddress(address)
  const identity = useIdentity(normalizedAddress)
  const meaningfulFallbackName = resolveMeaningfulFallbackName(options.fallbackName)
  const basenameHandle = meaningfulFallbackName ? getBasenameAutocompleteCandidate(meaningfulFallbackName) : null

  const zoraProfile = useQuery({
    queryKey: ['chatIdentityZoraProfile', normalizedAddress],
    queryFn: async () => {
      if (!normalizedAddress) return null
      return fetchZoraProfile(normalizedAddress)
    },
    enabled: Boolean(normalizedAddress),
    staleTime: 5 * 60_000,
  })

  const basenameProfileByName = useQuery({
    queryKey: ['chatIdentityBasenameProfileByName', basenameHandle],
    queryFn: async () => {
      if (!basenameHandle) return null
      return getBasenameProfileByName(basenameHandle)
    },
    enabled: Boolean(basenameHandle),
    staleTime: 5 * 60_000,
  })

  return useMemo(() => {
    const fallbackAddress = normalizedAddress ? shortAddress(normalizedAddress) : 'XMTP contact'
    const fallbackName = meaningfulFallbackName ?? fallbackAddress
    const zoraName = resolveZoraDisplayName(zoraProfile.data)
    const zoraAvatar = resolveZoraAvatar(zoraProfile.data)
    const basenameFromFallbackName = resolveBasenameLabelFromProfile(basenameProfileByName.data)
    const basenameFromFallbackAvatar = String(basenameProfileByName.data?.avatar ?? '').trim() || null
    const basenameName = identity.basenameDisplayName ?? identity.basename ?? basenameFromFallbackName
    const ensName = identity.ensName
    const addressName = fallbackAddress
    const loading = Boolean(normalizedAddress && identity.loading) || zoraProfile.isLoading || basenameProfileByName.isLoading

    const avatarFromFallbacks =
      zoraAvatar ??
      identity.basenameAvatar ??
      identity.avatar ??
      options.fallbackAvatar ??
      basenameFromFallbackAvatar ??
      null

    if (zoraName) {
      return {
        displayName: zoraName,
        avatar: avatarFromFallbacks,
        secondary: compactUnique([basenameName, ensName, addressName]),
        source: 'zora',
        loading,
      }
    }

    if (basenameName) {
      return {
        displayName: basenameName,
        avatar: avatarFromFallbacks,
        secondary: compactUnique([ensName, addressName]),
        source: 'basename',
        loading,
      }
    }

    if (ensName) {
      return {
        displayName: ensName,
        avatar: avatarFromFallbacks,
        secondary: compactUnique([addressName]),
        source: 'ens',
        loading,
      }
    }

    if (loading) {
      return {
        displayName: meaningfulFallbackName ?? (normalizedAddress ? addressName : fallbackName),
        avatar: avatarFromFallbacks,
        secondary: normalizedAddress && meaningfulFallbackName
          ? compactUnique([meaningfulFallbackName, addressName])
          : normalizedAddress
            ? null
            : meaningfulFallbackName,
        source: 'address',
        loading,
      }
    }

    return {
      displayName: meaningfulFallbackName ?? (normalizedAddress ? addressName : fallbackName),
      avatar: avatarFromFallbacks,
      secondary:
        normalizedAddress && meaningfulFallbackName && lc(meaningfulFallbackName) !== lc(addressName)
          ? compactUnique([meaningfulFallbackName, addressName])
          : normalizedAddress
            ? null
            : meaningfulFallbackName,
      source: 'address',
      loading,
    }
  }, [
    basenameProfileByName.data,
    basenameProfileByName.isLoading,
    identity.avatar,
    identity.basename,
    identity.basenameAvatar,
    identity.basenameDisplayName,
    identity.ensName,
    identity.loading,
    meaningfulFallbackName,
    normalizedAddress,
    options.fallbackAvatar,
    zoraProfile.data,
    zoraProfile.isLoading,
  ])
}
