import type { VercelRequest } from '@vercel/node'

import { readSessionFromRequest } from '../auth/_shared.js'
import { readSiwaAgentFromRequest } from '../auth/_siwa.js'
import { resolveAuthorizedWalletProfile } from './canonicalWalletResolver.js'

export type RequestPrincipal = {
  source: 'session' | 'siwa'
  address: string
}

export type AuthorizedRequestPrincipal = RequestPrincipal & {
  authSource: 'session' | 'siwa'
  profileId: number
  canonicalSmartWalletAddress: string | null
  activeOwnerWalletAddress: string | null
  signerRole: 'canonical_smart_wallet' | 'active_owner_wallet'
}

type ReadPrincipalOptions = {
  lowercase?: boolean
}

export function readRequestPrincipal(req: VercelRequest, opts: ReadPrincipalOptions = {}): RequestPrincipal | null {
  const lowercase = opts.lowercase !== false
  const normalize = (value: unknown): string => {
    const raw = typeof value === 'string' ? value.trim() : ''
    return lowercase ? raw.toLowerCase() : raw
  }

  const session = readSessionFromRequest(req)
  const sessionAddress = normalize(session?.address)
  if (sessionAddress) {
    return { source: 'session', address: sessionAddress }
  }

  const siwa = readSiwaAgentFromRequest(req)
  const siwaAddress = normalize(siwa?.address)
  if (siwaAddress) {
    return { source: 'siwa', address: siwaAddress }
  }

  return null
}

export function readRequestPrincipalAddress(req: VercelRequest, opts: ReadPrincipalOptions = {}): string {
  return readRequestPrincipal(req, opts)?.address ?? ''
}

export async function resolveAuthorizedRequestPrincipal(
  req: VercelRequest,
  opts: ReadPrincipalOptions = {},
): Promise<AuthorizedRequestPrincipal | null> {
  const principal = readRequestPrincipal(req, opts)
  if (!principal) return null

  const authority = await resolveAuthorizedWalletProfile(principal.address)
  if (!authority) return null

  return {
    ...principal,
    authSource: principal.source,
    profileId: authority.profileId,
    canonicalSmartWalletAddress: authority.canonicalSmartWalletAddress,
    activeOwnerWalletAddress: authority.activeOwnerWalletAddress,
    signerRole:
      authority.canonicalSmartWalletAddress === principal.address
        ? 'canonical_smart_wallet'
        : 'active_owner_wallet',
  }
}
