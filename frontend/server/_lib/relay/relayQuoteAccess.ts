/**
 * Access + shape gates for subsidized `/api/relay/quote` owner-mutation lane.
 *
 * Quotes always forward `subsidizeFees: true` with the project Relay API key.
 * Allowed shapes (mirroring production owner-mutation clients):
 *
 *   A) CSW self-call — user=to=recipient=CSW, data=executeWithoutChainIdValidation
 *   B) Funder EOA — user=funder (any), recipient=CSW, to=EntryPoint, data=handleOps
 *
 * In both cases the principal must control the CSW (profile canonical or on-chain owner).
 */

import { getAddress, isAddress } from 'viem'

import { resolveAuthorizedWalletProfile } from '../wallet/canonicalWalletResolver.js'
import { isCswOwner } from '../wallet/cswOwner.js'
import { EXECUTE_WITHOUT_CHAIN_ID_SELECTOR } from '../../../src/lib/wallet/cswOwnerAbi.js'

const HANDLE_OPS_SELECTOR = '0x1fad948c'
const ENTRY_POINT_V06 = '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789'
const ENTRY_POINT_V07 = '0x0000000071727de22e5e9d8baf0edac6f37da032'
const ALLOWED_ENTRY_POINTS = new Set([ENTRY_POINT_V06, ENTRY_POINT_V07])

export type RelayQuoteAccessResult =
  | { ok: true; user: `0x${string}`; to: `0x${string}`; recipient: `0x${string}` }
  | { ok: false; status: 401 | 403 | 400; error: string }

function asAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string' || !isAddress(value)) return null
  try {
    return getAddress(value) as `0x${string}`
  } catch {
    return null
  }
}

async function principalControlsCsw(params: {
  principal: `0x${string}`
  csw: `0x${string}`
}): Promise<boolean> {
  const { principal, csw } = params
  if (principal.toLowerCase() === csw.toLowerCase()) return true

  const authority = await resolveAuthorizedWalletProfile(principal).catch(() => null)
  if (authority?.canonicalSmartWalletAddress?.toLowerCase() === csw.toLowerCase()) {
    return true
  }

  return isCswOwner(principal, csw).catch(() => false)
}

export async function assertRelayOwnerMutationQuoteAccess(params: {
  principalAddress: string
  user: unknown
  to: unknown
  data: unknown
  recipient: unknown
}): Promise<RelayQuoteAccessResult> {
  const principal = asAddress(params.principalAddress)
  if (!principal) {
    return { ok: false, status: 401, error: 'Authentication required' }
  }

  const user = asAddress(params.user)
  if (!user) {
    return { ok: false, status: 400, error: 'user must be a 20-byte address' }
  }
  const to = asAddress(params.to)
  if (!to) {
    return { ok: false, status: 400, error: 'to must be a 20-byte address' }
  }

  const data = typeof params.data === 'string' ? params.data.trim() : ''
  if (!/^0x[0-9a-fA-F]+$/.test(data) || data.length < 10 || data.length % 2 !== 0) {
    return {
      ok: false,
      status: 400,
      error: 'data must be 0x-prefixed hex calldata with an even number of hex chars and at least 4 bytes (function selector)',
    }
  }
  const selector = data.slice(0, 10).toLowerCase()

  // Lane A: CSW self-call (relayQuotedPreparedCalls / remove-owner prepareCalls).
  if (selector === EXECUTE_WITHOUT_CHAIN_ID_SELECTOR.toLowerCase()) {
    if (to.toLowerCase() !== user.toLowerCase()) {
      return {
        ok: false,
        status: 400,
        error: 'to must equal user (CSW self-call only for executeWithoutChainIdValidation quotes)',
      }
    }

    let recipient = user
    if (params.recipient !== undefined && params.recipient !== null && params.recipient !== '') {
      const parsedRecipient = asAddress(params.recipient)
      if (!parsedRecipient) {
        return { ok: false, status: 400, error: 'recipient must be a 20-byte address when provided' }
      }
      if (parsedRecipient.toLowerCase() !== user.toLowerCase()) {
        return {
          ok: false,
          status: 400,
          error: 'recipient must equal user for CSW self-call subsidized quotes',
        }
      }
      recipient = parsedRecipient
    }

    const controls = await principalControlsCsw({ principal, csw: user })
    if (!controls) {
      return {
        ok: false,
        status: 403,
        error: 'user must be your canonical smart wallet (or a CSW you own on-chain)',
      }
    }
    return { ok: true, user, to, recipient }
  }

  // Lane B: funder EOA pays; EntryPoint.handleOps lands the owner mutation.
  if (selector === HANDLE_OPS_SELECTOR) {
    if (!ALLOWED_ENTRY_POINTS.has(to.toLowerCase())) {
      return {
        ok: false,
        status: 400,
        error: 'to must be the EntryPoint v0.6 or v0.7 address for handleOps quotes',
      }
    }

    const recipient =
      params.recipient !== undefined && params.recipient !== null && params.recipient !== ''
        ? asAddress(params.recipient)
        : null
    if (!recipient) {
      return {
        ok: false,
        status: 400,
        error: 'recipient must be the CSW address for funder-EOA handleOps quotes',
      }
    }

    const controls = await principalControlsCsw({ principal, csw: recipient })
    if (!controls) {
      return {
        ok: false,
        status: 403,
        error: 'recipient must be your canonical smart wallet (or a CSW you own on-chain)',
      }
    }
    return { ok: true, user, to, recipient }
  }

  return {
    ok: false,
    status: 400,
    error:
      `data must start with executeWithoutChainIdValidation (${EXECUTE_WITHOUT_CHAIN_ID_SELECTOR}) ` +
      `or EntryPoint.handleOps (${HANDLE_OPS_SELECTOR})`,
  }
}
