import { type Address, zeroAddress } from 'viem'

/** Across SpokePool: values in (0, MAX] are offsets from origin `block.timestamp`. */
export const ACROSS_MAX_EXCLUSIVITY_PERIOD_SECONDS = 31_536_000

/**
 * Default minimum exclusive-fill window for FriendKey #1659 deposits.
 * Across `/suggested-fees` currently returns `exclusivityDeadline: 3` (3s offset)
 * on RH→Base, which expired at the same second as our live fill — too short to
 * keep competitive fillers / public MEV out of the Base fill window.
 */
export const FRIENDKEY_ACROSS_MIN_EXCLUSIVITY_SEC = 60

export type ResolveAcrossExclusivityInput = {
  exclusiveRelayer: Address
  /** Raw `exclusivityDeadline` from `/suggested-fees` (offset or absolute). */
  apiExclusivityDeadline: number
  /** Minimum exclusive window when a relayer is assigned (seconds). */
  minExclusivitySec?: number
  /** Wall-clock seconds; used only when API returns an absolute timestamp. */
  nowSec?: number
}

export type ResolveAcrossExclusivityResult = {
  exclusiveRelayer: Address
  /** Value to pass as `depositV3` exclusivity parameter. */
  exclusivityParameter: number
  mode: 'none' | 'offset' | 'absolute'
  apiExclusivityDeadline: number
  bumped: boolean
}

function isOffset(value: number): boolean {
  return value > 0 && value <= ACROSS_MAX_EXCLUSIVITY_PERIOD_SECONDS
}

/**
 * Tighten Across exclusivity for destination-message deposits.
 *
 * - No relayer / zero deadline → no exclusivity.
 * - Offset from API → `max(api, minExclusivitySec)`.
 * - Absolute timestamp from API → `max(api, now + minExclusivitySec)`.
 */
export function resolveAcrossExclusivityParameter(
  input: ResolveAcrossExclusivityInput,
): ResolveAcrossExclusivityResult {
  const minExclusivitySec = input.minExclusivitySec ?? FRIENDKEY_ACROSS_MIN_EXCLUSIVITY_SEC
  const api = Number(input.apiExclusivityDeadline)
  const relayer = input.exclusiveRelayer

  if (!relayer || relayer === zeroAddress || !Number.isFinite(api) || api <= 0) {
    return {
      exclusiveRelayer: zeroAddress,
      exclusivityParameter: 0,
      mode: 'none',
      apiExclusivityDeadline: Number.isFinite(api) ? api : 0,
      bumped: false,
    }
  }

  if (isOffset(api)) {
    const exclusivityParameter = Math.max(api, minExclusivitySec)
    return {
      exclusiveRelayer: relayer,
      exclusivityParameter,
      mode: 'offset',
      apiExclusivityDeadline: api,
      bumped: exclusivityParameter > api,
    }
  }

  const nowSec = input.nowSec ?? Math.floor(Date.now() / 1000)
  const exclusivityParameter = Math.max(api, nowSec + minExclusivitySec)
  return {
    exclusiveRelayer: relayer,
    exclusivityParameter,
    mode: 'absolute',
    apiExclusivityDeadline: api,
    bumped: exclusivityParameter > api,
  }
}
