/**
 * Read-only helpers for inspecting a SpendPermission's current window on
 * chain. Used by the user-facing `GET /api/arch-b/status` endpoint to
 * tell creators how much of their daily cap they've spent so they can
 * decide whether to wait for the window to roll over, top up, or revoke.
 *
 * Non-fatal by design — a failed RPC should never break the status
 * endpoint. Callers receive `null` on error and render a muted "usage
 * unavailable" affordance instead.
 */

import { type Address, type Hex } from 'viem'

import {
  SPEND_PERMISSION_MANAGER_BASE,
  spendPermissionManagerAbi,
} from './spendPermission.js'
// Canonical SpendPermissionPayload / command issuer logic lives in @4626/server-core.
// This sibling import resolves through the transitional _lib re-export shim.
import type { SpendPermissionPayload } from '@4626/server-core/identity'

type ViemReadClient = {
  readContract: (args: {
    address: Address
    abi: typeof spendPermissionManagerAbi
    functionName: 'getCurrentPeriodSpend' | 'isApproved'
    args: readonly unknown[]
  }) => Promise<unknown>
}

export type SpendPermissionCurrentPeriod = {
  /** Unix seconds (uint48 from chain). */
  start: number
  /** Unix seconds (uint48 from chain). */
  end: number
  /** Wei spent in the current period so far, stringified bigint. */
  spendWei: string
  /** Wei remaining in the current period (allowance − spend), stringified. */
  remainingWei: string
}

/**
 * Convert a JSON-friendly SpendPermissionPayload into the viem-friendly
 * tuple the manager ABI expects. Mirrors `toOnchainPermission` in
 * `spendPermission.ts` but kept local to avoid exporting that private
 * helper.
 */
function toViemTuple(payload: SpendPermissionPayload): {
  account: Address
  spender: Address
  token: Address
  allowance: bigint
  period: number
  start: number
  end: number
  salt: bigint
  extraData: Hex
} {
  return {
    account: payload.account,
    spender: payload.spender,
    token: payload.token,
    allowance: BigInt(payload.allowance),
    period: payload.period,
    start: payload.start,
    end: payload.end,
    salt: BigInt(payload.salt),
    extraData: payload.extraData as Hex,
  }
}

/**
 * Read `SpendPermissionManager.getCurrentPeriodSpend(permission)` on
 * Base and return the normalized shape the UI needs.
 *
 * Returns `null` when the underlying RPC fails — the status endpoint
 * treats that as "usage unavailable" rather than surfacing a 5xx to
 * users just because an RPC blipped.
 */
export async function readSpendPermissionCurrentPeriod(
  client: ViemReadClient,
  payload: SpendPermissionPayload,
): Promise<SpendPermissionCurrentPeriod | null> {
  try {
    const onchain = toViemTuple(payload)
    const raw = await client.readContract({
      address: SPEND_PERMISSION_MANAGER_BASE,
      abi: spendPermissionManagerAbi,
      functionName: 'getCurrentPeriodSpend',
      args: [onchain],
    })
    if (!raw || typeof raw !== 'object') return null
    const { start, end, spend } = raw as { start: number; end: number; spend: bigint }
    const allowance = BigInt(payload.allowance)
    const spendBig = typeof spend === 'bigint' ? spend : BigInt(String(spend))
    const remaining = allowance > spendBig ? allowance - spendBig : 0n
    return {
      start: Number(start),
      end: Number(end),
      spendWei: spendBig.toString(),
      remainingWei: remaining.toString(),
    }
  } catch {
    return null
  }
}
