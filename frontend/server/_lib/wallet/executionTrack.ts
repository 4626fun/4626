/**
 * Pure classifier for the user-initiated frontend execution track.
 *
 * Canonical architecture reference: `docs/4626-connection-methods.md`.
 *
 * User-initiated frontend execution routes through the **parent CSW**
 * (`profiles.csw_address`) only. The Privy embedded EOA must be installed as
 * a direct owner on that wallet (`legacy-owner-install`); sponsored swaps use
 * `canonical4337` with the parent as ERC-4337 sender.
 *
 * Deploy-session automation still uses parent CSW + delegated server owner.
 *
 * Possible tracks:
 *
 *   - `legacy-owner-install` — embedded EOA is a direct owner of the parent CSW.
 *   - `base-app-direct`      — parent CSW + embedded EOA exist; Base App CSW signing.
 *   - `none-yet`             — parent CSW or embedded EOA missing; no signing track ready.
 *
 * Server-side agent / deploy-session delegation is a separate, orthogonal
 * track defined in `.cursor/rules/csw-agent-lifecycle.mdc`.
 */

import { isBaseAppPopulationCanonicalSource as isBaseAccountCanonicalSource } from './canonicalSource.js'

export { isBaseAccountCanonicalSource as isBaseAppPopulationCanonicalSource }

const EVM_ADDRESS_RE = /^0x[a-f0-9]{40}$/

export type ExecutionTrack =
  | 'legacy-owner-install'
  | 'base-app-direct'
  | 'none-yet'

export type BaseSubAccountSummary = {
  /** Lowercased 0x address if one is persisted, null otherwise. */
  address: string | null
  /**
   * True iff `address` is non-null AND differs from the parent CSW address.
   * False when the column is unset or mirrors the CSW (legacy backfill).
   */
  isDistinctFromCsw: boolean
  /**
   * True iff this looks like an actual sub-account we can route user
   * transactions through. Currently an alias for `isDistinctFromCsw`, but
   * kept as a separate field so we can evolve the definition (for example
   * if we add a `base_sub_account_registered_at` column in the future).
   */
  registered: boolean
}

export type BaseSubAccountInput = {
  canonicalCswAddress: string | null | undefined
  baseSubAccountAddress: string | null | undefined
}

export type ExecutionTrackInput = BaseSubAccountInput & {
  /**
   * Whether the Privy embedded EOA is currently installed as a direct owner
   * of the parent CSW in the MultiOwnable contract. Under the new
   * architecture this is expected to be `false` for user-initiated frontend
   * execution; a `true` value signals the legacy owner-install path.
   */
  privyEmbeddedEoaIsOwnerOfCanonicalCsw: boolean | null | undefined
  /** Privy embedded EOA from `profiles.primary_embedded_eoa`. */
  embeddedEoaAddress?: string | null | undefined
  /**
   * `profile_wallets.canonical_source`. Only `base_account` unlocks the
   * Base App direct signing track without embedded-owner install.
   */
  canonicalSource?: string | null | undefined
}

function normalizeAddress(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const lowered = value.trim().toLowerCase()
  return EVM_ADDRESS_RE.test(lowered) ? lowered : null
}

export function summarizeBaseSubAccount(input: BaseSubAccountInput): BaseSubAccountSummary {
  const canonical = normalizeAddress(input.canonicalCswAddress)
  const subAccount = normalizeAddress(input.baseSubAccountAddress)
  if (!subAccount) {
    return { address: null, isDistinctFromCsw: false, registered: false }
  }
  const isDistinctFromCsw = canonical === null ? true : subAccount !== canonical
  return {
    address: subAccount,
    isDistinctFromCsw,
    registered: isDistinctFromCsw,
  }
}

export function resolveExecutionTrack(input: ExecutionTrackInput): ExecutionTrack {
  if (input.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true) {
    return 'legacy-owner-install'
  }
  const canonical = normalizeAddress(input.canonicalCswAddress)
  const embedded = normalizeAddress(input.embeddedEoaAddress)
  if (
    canonical &&
    embedded &&
    isBaseAccountCanonicalSource(input.canonicalSource)
  ) {
    return 'base-app-direct'
  }
  return 'none-yet'
}
