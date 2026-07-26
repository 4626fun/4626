/**
 * Creator-token authority for paid strategy rails.
 *
 * Deploy-session create already gates on coin `creator()`. Strategy checkout /
 * activate / x402 must use the same rule so an authenticated stranger cannot
 * bind entitlements (or unpaid pending blockers) to a token they do not control.
 */

import { getAddress, isAddress, type Address } from 'viem'

import { isServerAdminAddress } from '../infra/trust.js'
import { resolveCoinPartiesAndOwner } from '../onchain/coinParties.js'
import { resolveCanonicalSmartWalletAddress } from '../wallet/canonicalWalletResolver.js'

export class CreatorTokenAuthorityError extends Error {
  readonly status = 403 as const

  constructor(message = 'Creator token authority mismatch: active session or canonical smart wallet must control the creator token.') {
    super(message)
    this.name = 'CreatorTokenAuthorityError'
  }
}

/** Bundle-safe check — prefer over `instanceof` across server/api boundaries. */
export function isCreatorTokenAuthorityError(error: unknown): error is CreatorTokenAuthorityError {
  if (!error || typeof error !== 'object') return false
  const maybe = error as { name?: unknown; status?: unknown }
  return maybe.name === 'CreatorTokenAuthorityError' && maybe.status === 403
}

export type CreatorTokenAuthorityCheckResult =
  | { ok: true }
  | { ok: false; reason: 'unauthorized' | 'no_creator_parties' }

function normalizeCandidate(address: Address | string | null | undefined): string | null {
  if (typeof address !== 'string' || !isAddress(address)) return null
  try {
    return getAddress(address as Address).toLowerCase()
  } catch {
    return null
  }
}

/**
 * True when any candidate is the on-chain coin `creator()`, or is a server admin.
 */
export async function checkCreatorTokenAuthority(params: {
  creatorToken: Address
  candidateAddresses: readonly (Address | string)[]
}): Promise<CreatorTokenAuthorityCheckResult> {
  const candidates = new Set<string>()
  for (const raw of params.candidateAddresses) {
    const normalized = normalizeCandidate(raw)
    if (!normalized) continue
    if (isServerAdminAddress(normalized)) return { ok: true }
    candidates.add(normalized)
  }
  if (candidates.size === 0) return { ok: false, reason: 'unauthorized' }

  const parties = await resolveCoinPartiesAndOwner(params.creatorToken as `0x${string}`)
  const authorized = new Set<string>()
  const creator = normalizeCandidate(parties.creator)
  if (creator) authorized.add(creator)

  if (authorized.size === 0) return { ok: false, reason: 'no_creator_parties' }
  for (const candidate of candidates) {
    if (authorized.has(candidate)) return { ok: true }
  }
  return { ok: false, reason: 'unauthorized' }
}

/**
 * Resolve session + canonical CSW candidates, then require coin-creator control.
 */
export async function assertSessionControlsCreatorToken(params: {
  creatorToken: Address
  sessionAddress: Address
}): Promise<void> {
  const sessionAddress = getAddress(params.sessionAddress)
  const candidates: Address[] = [sessionAddress]

  if (isServerAdminAddress(sessionAddress)) return

  const canonical = await resolveCanonicalSmartWalletAddress(sessionAddress).catch(() => null)
  if (typeof canonical === 'string' && isAddress(canonical)) {
    candidates.push(getAddress(canonical as Address))
  }

  const result = await checkCreatorTokenAuthority({
    creatorToken: getAddress(params.creatorToken),
    candidateAddresses: candidates,
  })
  if (!result.ok) {
    throw new CreatorTokenAuthorityError()
  }
}
