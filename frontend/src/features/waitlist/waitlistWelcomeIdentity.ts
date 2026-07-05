import { isAddress } from 'viem'

import { pickPrivyEmbeddedEoaWallet } from '@/lib/privy/privyEmbeddedEoa'

export type WaitlistIdentitySource = 'zora' | 'basename' | 'ens' | 'address'

const FULL_EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

export function formatWaitlistShortAddress(address: string): string {
  const trimmed = address.trim()
  if (trimmed.length < 10) return trimmed
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`
}

export function isWaitlistAddressLabel(label: string): boolean {
  const trimmed = label.trim()
  return (
    /^0x[a-fA-F0-9]{4}(?:…|\.{3})[a-fA-F0-9]{4}$/.test(trimmed) ||
    FULL_EVM_ADDRESS_RE.test(trimmed)
  )
}

function looksLikeEvmAddress(value: string): boolean {
  const trimmed = value.trim().replace(/^@+/, '')
  if (isWaitlistAddressLabel(trimmed)) return true
  if (!trimmed.startsWith('0x')) return false
  return /^0x[a-fA-F0-9]+$/i.test(trimmed)
}

function normalizeAddressSet(values: Array<string | null | undefined>): Set<string> {
  const out = new Set<string>()
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed && isAddress(trimmed)) out.add(trimmed.toLowerCase())
  }
  return out
}

function firstUsableAddress(
  candidates: Array<string | null | undefined>,
  excludedAddresses: ReadonlySet<string>,
): string | null {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim()
    if (!trimmed || !isAddress(trimmed)) continue
    if (excludedAddresses.has(trimmed.toLowerCase())) continue
    return trimmed
  }
  return null
}

/** Returns a Zora handle or null when the value is missing, address-shaped, or a Basename mislabel. */
export function sanitizeWaitlistZoraHandle(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed || looksLikeEvmAddress(trimmed)) return null
  if (trimmed.toLowerCase().endsWith('.base.eth')) return null
  return trimmed.replace(/^@+/, '')
}

export function sanitizeWaitlistBasename(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase()
  if (!trimmed?.endsWith('.base.eth')) return null
  return trimmed
}

export function resolvePrivyEmbeddedEoaAddress(
  privyUser: unknown,
  cswAddress?: string | null,
): string | null {
  const user =
    privyUser && typeof privyUser === 'object' ? (privyUser as Record<string, unknown>) : null
  if (!user) return null

  const accounts = [
    ...(Array.isArray(user.linkedAccounts) ? user.linkedAccounts : []),
    ...(Array.isArray(user.linked_accounts) ? user.linked_accounts : []),
  ]
  const wallet = pickPrivyEmbeddedEoaWallet(accounts, cswAddress)
  const address = typeof wallet?.address === 'string' ? wallet.address.trim() : ''
  return address && isAddress(address) ? address : null
}

export function buildWaitlistExcludedSignerAddresses(input: {
  privyEmbeddedEoaAddress?: string | null
  extraExcludedAddresses?: Array<string | null | undefined>
}): Set<string> {
  return normalizeAddressSet([
    input.privyEmbeddedEoaAddress,
    ...(input.extraExcludedAddresses ?? []),
  ])
}

/** Verified email local-part for waitlist greeting when no public identity exists yet. */
export function resolveWaitlistEmailWelcomeLabel(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase()
  if (!trimmed || !trimmed.includes('@')) return null
  const localPart = trimmed.split('@')[0]?.trim()
  return localPart || trimmed
}

function isNamedWelcomeIdentity(
  label: string | null | undefined,
  source: WaitlistIdentitySource | null | undefined,
): label is string {
  const trimmed = label?.trim()
  if (!trimmed || !source || source === 'address') return false
  if (looksLikeEvmAddress(trimmed)) return false
  if (source === 'zora' && !sanitizeWaitlistZoraHandle(trimmed)) return false
  return true
}

export function formatWaitlistNamedIdentityLabel(
  label: string,
  source: Exclude<WaitlistIdentitySource, 'address'>,
): string {
  const trimmed = label.trim()
  if (!trimmed) return trimmed

  if (source === 'basename') {
    return trimmed.toLowerCase().endsWith('.base.eth')
      ? trimmed.replace(/\.base\.eth$/i, '')
      : trimmed
  }

  if (source === 'ens') {
    return trimmed.toLowerCase().endsWith('.eth') ? trimmed : `${trimmed}.eth`
  }

  if (source === 'zora') {
    return trimmed.replace(/^@+/, '')
  }

  return trimmed
}

/**
 * Address used for Zora / basename / ENS lookups. Mirrors server profile seed order:
 * Zora cross-app → external EOA → canonical CSW. Wallet return may also consult the
 * linked external wallet before CSW in address fallback. Never embedded EOA / session cookie.
 */
export function resolveWaitlistIdentityLookupAddress(input: {
  zoraCrossAppAddress?: string | null
  linkedEoaAddress?: string | null
  walletReturnAddress?: string | null
  cswAddress?: string | null
  primaryWalletAddress?: string | null
  embeddedEoaAddress?: string | null
  returningViaWallet?: boolean
  excludedAddresses?: ReadonlySet<string>
}): `0x${string}` | null {
  const excluded = input.excludedAddresses ?? new Set<string>()
  const address =
    firstUsableAddress(
      [
        input.zoraCrossAppAddress,
        input.linkedEoaAddress,
        ...(input.returningViaWallet ? [input.walletReturnAddress] : []),
        input.cswAddress,
      ],
      excluded,
    ) ??
    firstUsableAddress([input.primaryWalletAddress, input.embeddedEoaAddress], new Set())
  return address ? (address as `0x${string}`) : null
}

function resolveWelcomeAddressFallback(input: {
  linkedEoaAddress?: string | null
  walletReturnAddress?: string | null
  cswAddress?: string | null
  returningViaWallet?: boolean
  excludedAddresses?: ReadonlySet<string>
}): string | null {
  const excluded = input.excludedAddresses ?? new Set<string>()
  return firstUsableAddress(
    input.returningViaWallet
      ? [input.linkedEoaAddress, input.walletReturnAddress, input.cswAddress]
      : [input.linkedEoaAddress, input.cswAddress],
    excluded,
  )
}

export type WaitlistWelcomeCopy = {
  prefix: 'Welcome back' | 'Welcome'
  label: string
}

export function resolveWaitlistWelcomeCopy(input: {
  zoraHandle?: string | null
  basename?: string | null
  identityDisplayName?: string | null
  identitySource?: WaitlistIdentitySource | null
  linkedEoaAddress?: string | null
  cswAddress?: string | null
  walletReturnAddress?: string | null
  returningViaWallet?: boolean
  email?: string | null
  excludedAddresses?: ReadonlySet<string>
  primaryWalletAddress?: string | null
  embeddedEoaAddress?: string | null
}): WaitlistWelcomeCopy | null {
  const zoraRaw = sanitizeWaitlistZoraHandle(input.zoraHandle)
  const zoraLabel = zoraRaw
  const basenameRaw = sanitizeWaitlistBasename(input.basename)

  let label: string | null = null
  let isNamedIdentity = false

  if (zoraLabel) {
    label = zoraLabel
    isNamedIdentity = true
  } else if (basenameRaw) {
    label = formatWaitlistNamedIdentityLabel(basenameRaw, 'basename')
    isNamedIdentity = true
  } else if (isNamedWelcomeIdentity(input.identityDisplayName, input.identitySource)) {
    label = formatWaitlistNamedIdentityLabel(
      input.identityDisplayName,
      input.identitySource as Exclude<WaitlistIdentitySource, 'address'>,
    )
    isNamedIdentity = true
  }

  if (!label) {
    if (!input.returningViaWallet) {
      const emailLabel = resolveWaitlistEmailWelcomeLabel(input.email)
      if (emailLabel) {
        label = emailLabel
        isNamedIdentity = true
      }
    }
  }

  if (!label) {
    const address = resolveWelcomeAddressFallback(input)
    if (address) label = formatWaitlistShortAddress(address)
  }

  if (!label) {
    const emailLabel = resolveWaitlistEmailWelcomeLabel(input.email)
    if (emailLabel) {
      label = emailLabel
      isNamedIdentity = true
    }
  }

  if (!label) return null

  const prefix = input.returningViaWallet || isNamedIdentity ? 'Welcome back' : 'Welcome'
  return { prefix, label }
}
