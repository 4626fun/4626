/**
 * Pure classifier for the user-initiated frontend execution track.
 *
 * Canonical architecture reference: `docs/4626-connection-methods.md`.
 *
 * Two observable signals determine which track an account is on:
 *
 *   1. Does the user have a real, distinct sub-account persisted in
 *      `profiles.base_sub_account`? A "real" sub-account means the persisted
 *      address is NOT equal to the parent CSW — legacy accounts sometimes
 *      have that column mirroring the CSW address as a backfill, which is
 *      not a real sub-account.
 *
 *   2. Is the user's Privy embedded EOA installed as a direct owner of the
 *      parent CSW? This is the legacy owner-install model (pre-sub-account
 *      migration). Current architecture does NOT install the embedded EOA
 *      as a direct CSW owner on the user-initiated track; it routes signing
 *      through the sub-account via `setToOwnerAccount()` instead.
 *
 * Possible tracks:
 *
 *   - `sub-account`            — real sub-account persisted, embedded EOA NOT
 *                                an owner. The clean new-model shape.
 *   - `legacy-owner-install`   — embedded EOA IS an owner, no real sub-account.
 *                                The pre-migration shape. Still fully functional.
 *   - `migration-pending`      — both signals present. Legacy account that
 *                                subsequently set up a sub-account. Functional
 *                                on either path; the app should prefer the
 *                                sub-account and can optionally clean up the
 *                                direct ownership later.
 *   - `none-yet`               — neither signal. New user who has authenticated
 *                                but has not completed activation.
 *
 * Server-side agent / deploy-session delegation is a separate, orthogonal
 * track defined in `.cursor/rules/csw-agent-lifecycle.mdc`. It does not
 * appear in this classifier; this is strictly the user-initiated frontend
 * execution track.
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
  const subAccount = summarizeBaseSubAccount(input)
  const legacyOwnerInstall = input.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true

  if (subAccount.registered && legacyOwnerInstall) return 'migration-pending'
  if (subAccount.registered) return 'sub-account'
  if (legacyOwnerInstall) return 'legacy-owner-install'
  return 'none-yet'
}
