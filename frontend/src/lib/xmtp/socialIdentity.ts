import { getAddress, isAddress } from 'viem'
import { apiFetch } from '@/lib/apiBase'
import {
  getBasename,
  getBasenameProfileByName,
  resolveBasenameAddress,
} from '@/lib/basename-api'

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

/**
 * Resolve a "new DM" recipient input into an EVM address.
 * Supports raw addresses and basename handles (e.g. "akita", "@akita", "akita.base.eth").
 */
export async function resolveDmRecipient(input: string): Promise<DmRecipientResolution | null> {
  const raw = input.trim()
  if (!raw) return null

  if (isAddress(raw)) {
    const normalized = normalizeDmAddress(raw)
    if (!normalized) return null
    const recipientAddress = await resolveCanonicalRecipientAddress(normalized)
    return {
      address: recipientAddress,
      basenameHint: null,
      avatarUrl: null,
    }
  }

  const inputBasenameProfile = await getBasenameProfileByName(raw).catch(() => ({ name: null, avatar: null }))
  const resolvedAddress = await resolveBasenameAddress(raw).catch(() => null)
  if (!resolvedAddress) return null

  const normalizedResolved = normalizeDmAddress(resolvedAddress)
  if (!normalizedResolved) return null

  const recipientAddress = await resolveCanonicalRecipientAddress(normalizedResolved)

  const reverseBasename =
    await getBasenameName(recipientAddress).catch(() => null) ??
    await getBasenameName(normalizedResolved).catch(() => null)
  const basenameHint =
    reverseBasename?.replace(/\.base\.eth$/i, '').trim() || basenameHintFromInput(raw)

  return {
    address: recipientAddress,
    basenameHint: basenameHint || null,
    avatarUrl: inputBasenameProfile?.avatar ?? null,
  }
}

