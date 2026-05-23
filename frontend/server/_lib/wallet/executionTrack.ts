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
 * A persisted `profiles.base_sub_account` / arch-b CIEC row may still exist
 * for audit or future app-scoped work, but it does **not** select the
 * execution track. Sub-account / `migration-pending` tracks are dormant.
 *
 * Possible tracks:
 *
 *   - `legacy-owner-install` — embedded EOA is a direct owner of the parent CSW.
 *   - `none-yet`             — parent CSW known but embedded owner not confirmed.
 *
 * `sub-account` and `migration-pending` remain in the union for typed API
 * compatibility but are not returned by `resolveExecutionTrack`.
 *
 * Server-side agent / deploy-session delegation is a separate, orthogonal
 * track defined in `.cursor/rules/csw-agent-lifecycle.mdc`.
 */

const EVM_ADDRESS_RE = /^0x[a-f0-9]{40}$/

export type ExecutionTrack =
  | 'sub-account'
  | 'legacy-owner-install'
  | 'none-yet'
  | 'migration-pending'

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
  return 'none-yet'
}
