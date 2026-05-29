/**
 * Core tombstone-aware + alias-chasing identity resolvers.
 *
 * These are the **canonical** entry points for resolving 4626 profiles from Privy user IDs
 * while correctly handling merges (merged_into_profile_id) and aliases (privy_user_aliases).
 *
 * New code **must** import from here (via `@4626/server-core`).
 *
 * This module is part of the 2026-05 general audit remediation for Lens A (account model invariants).
 */

export {
  listProfileIdsForPrivyUser,
  resolvePrimaryProfileIdForPrivyUser,
} from './profileIdForPrivyUser.js'

// Command issuer context — full implementation now lives in server-core.
export {
  resolveCommandIssuerContextByAddress,
  resolveCommandIssuerContextByProfileId,
  isExecutionReady,
  envBigInt,
  provisionCommandIssuerContext,
  revokeCommandIssuerContext,
  revokeSubAccountSpendPermission,
  readIssuerDailySpend,
  recordIssuerDailySpend,
  rollbackIssuerDailySpend,
  type CommandIssuerContext,
  type CommandIssuerResolution,
  type CommandIssuerSubAccount,
  type SpendPermissionPayload,
  type ExecutionReadiness,
} from './commandIssuerContext.js'