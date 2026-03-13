import { getAddress, isAddress } from 'viem'
import { apiFetch } from '@/lib/apiBase'
import {
  getBasename,
  getBasenameProfile,
  getBasenameProfileByName,
  resolveBasenameAddress,
} from '@/lib/basename-api'

const OPTIONAL_LOOKUP_TIMEOUT_MS = 1_200

type BasenameProfileLite = {
  name: string | null
  avatar?: string | null
}

const EMPTY_BASENAME_PROFILE: BasenameProfileLite = {
  name: null,
  avatar: null,
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}

/**
 * Chat identity helpers.
 *
 * NOTE: Basenames reverse resolution can't be done reliably using `viem` on Base L2 in browsers
 * because the chain config may not include ENS universal resolver info (and some RPCs can fail
 * under CORS). This wrapper keeps the logic in one place.
 */

export async function getBasenameName(address: string): Promise<string | null> {
  const raw = await getBasename(address).catch(() => null)
  if (!raw) return null
  // Ensure we only treat *.base.eth as a basename.
  if (!raw.toLowerCase().endsWith('.base.eth')) return null
  return raw
}

export type DmRecipientResolution = {
  address: `0x${string}`
  basenameHint: string | null
  avatarUrl: string | null
}

export function getBasenameAutocompleteCandidate(input: string): string | null {
  const raw = input.trim().toLowerCase()
  if (!raw) return null
  if (isAddress(raw)) return null
  const withoutAt = raw.startsWith('@') ? raw.slice(1).trim() : raw
  if (!withoutAt) return null
  if (withoutAt.endsWith('.base.eth')) return withoutAt
  if (withoutAt.includes('.')) return null
  if (!/^[a-z0-9-]{1,255}$/.test(withoutAt)) return null
  return `${withoutAt}.base.eth`
}

function basenameHintFromInput(input: string): string | null {
  const candidate = getBasenameAutocompleteCandidate(input)
  if (!candidate) return null
  if (!candidate.endsWith('.base.eth')) return null
  const short = candidate.slice(0, -'.base.eth'.length).trim()
  if (!short) return null
  if (short.includes('.')) return null
  return short
}

type RecipientResolverApiData = {
  recipientAddress?: string | null
}

type RecipientResolverApiEnvelope = {
  success?: boolean
  data?: RecipientResolverApiData | null
}

function normalizeDmAddress(value: string): `0x${string}` | null {
  if (!isAddress(value)) return null
  return getAddress(value).toLowerCase() as `0x${string}`
}

async function resolveCanonicalRecipientAddress(address: `0x${string}`): Promise<`0x${string}`> {
  try {
    const res = await apiFetch(`/api/social/recipient?address=${encodeURIComponent(address)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return address

    const json = (await res.json().catch(() => null)) as RecipientResolverApiEnvelope | null
    if (json?.success !== true) return address

    const resolved = typeof json?.data?.recipientAddress === 'string' ? json.data.recipientAddress : ''
    return normalizeDmAddress(resolved) ?? address
  } catch {
    return address
  }
}

async function resolveReverseBasename(
  recipientAddress: `0x${string}`,
  fallbackAddress: `0x${string}` | null,
): Promise<string | null> {
  const primary = await withTimeout(
    getBasenameName(recipientAddress).catch(() => null),
    OPTIONAL_LOOKUP_TIMEOUT_MS,
    null,
  )
  if (primary) return primary
  if (!fallbackAddress) return null
  if (fallbackAddress.toLowerCase() === recipientAddress.toLowerCase()) return null

  return withTimeout(
    getBasenameName(fallbackAddress).catch(() => null),
    OPTIONAL_LOOKUP_TIMEOUT_MS,
    null,
  )
}

/**
 * Resolve a "new DM" recipient input into an EVM address.
 * Supports raw addresses and basename handles (e.g. "akita", "@akita", "akita.base.eth").
 */
export async function resolveDmRecipient(input: string): Promise<DmRecipientResolution | null> {
  const raw = input.trim()
  if (!raw) return null
  const inputIsAddress = isAddress(raw)
  const inputHint = basenameHintFromInput(raw)

  let normalizedResolved: `0x${string}` | null = null

  if (inputIsAddress) {
    normalizedResolved = normalizeDmAddress(raw)
  } else {
    const resolvedAddress = await resolveBasenameAddress(raw).catch(() => null)
    if (!resolvedAddress) return null
    normalizedResolved = normalizeDmAddress(resolvedAddress)
  }
  if (!normalizedResolved) return null

  const recipientAddress = await resolveCanonicalRecipientAddress(normalizedResolved)

  const inputBasenameProfilePromise: Promise<BasenameProfileLite> = inputIsAddress
    ? Promise.resolve(EMPTY_BASENAME_PROFILE)
    : withTimeout(
        getBasenameProfileByName(raw).catch(() => EMPTY_BASENAME_PROFILE),
        OPTIONAL_LOOKUP_TIMEOUT_MS,
        EMPTY_BASENAME_PROFILE,
      )
  const recipientBasenameProfilePromise = withTimeout(
    getBasenameProfile(recipientAddress).catch(() => EMPTY_BASENAME_PROFILE),
    OPTIONAL_LOOKUP_TIMEOUT_MS,
    EMPTY_BASENAME_PROFILE,
  )

  const normalizedRecipient = recipientAddress.toLowerCase()
  const normalizedInitial = normalizedResolved.toLowerCase()
  const shouldLookupReverse = !inputHint && !inputIsAddress
  const reverseBasename = shouldLookupReverse
    ? await resolveReverseBasename(
        recipientAddress,
        normalizedRecipient !== normalizedInitial ? normalizedResolved : null,
      )
    : null

  const [inputBasenameProfile, recipientBasenameProfile] = await Promise.all([
    inputBasenameProfilePromise,
    recipientBasenameProfilePromise,
  ])

  const basenameHint = inputIsAddress
    ? null
    : reverseBasename?.replace(/\.base\.eth$/i, '').trim() || inputHint

  return {
    address: recipientAddress,
    basenameHint: basenameHint || null,
    avatarUrl: inputBasenameProfile?.avatar ?? recipientBasenameProfile?.avatar ?? null,
  }
}

