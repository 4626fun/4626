Arch B Sub-Account Design Addendum
Status: proposed · Author: computer · Date: 2026-04-18

> **Canonical reference:** [docs/ACCOUNT_MODEL.md](./ACCOUNT_MODEL.md) is the single source of truth for the 4626 account model. Where this addendum's column types (e.g., `CITEXT`, `BYTEA`) differ from what actually shipped in [`frontend/db/migrations/028_arch_b_sub_accounts.sql`](../frontend/db/migrations/028_arch_b_sub_accounts.sql) (`TEXT`, `JSONB`), trust the migration. ACCOUNT_MODEL.md §4 documents the as-shipped types. The invariants in this file's "Invariants preserved" section remain authoritative and are cited verbatim from ACCOUNT_MODEL.md §3.

Why
The canonical CSW 0xab6d…67b5 for profile 1 has on-chain owners [0x6c0e…f9b3, 0xb05c…0fdd, (empty), 0xd178…9361]. The current Privy embedded EOA recorded in profile_wallets.privy_embedded_eoa_address is 0xceca…85e9, which is not a CSW owner. Every Arch B UserOp today fails at bundler submission with userop_submission_failed because the signature produced by Privy for 0xceca…85e9 cannot be validated by the parent CSW.

Rather than rotating owners on the parent CSW (which loses auditability of the parent) or trusting a legacy EOA as the permanent signer, we deploy a Coinbase Smart Wallet sub-account owned jointly by the parent and 0xceca…85e9. The sub-account becomes the execution surface for /coin buy, /coin sell, /keepr send, and /coin trend reserve; the parent CSW remains the settlement balance and funds the sub-account via a signed SpendPermission.

Invariants preserved
Verified email is canonical identity. Unchanged.

Canonical CSW (profile_wallets.is_canonical_smart_wallet=true) remains the parent 0xab6d…67b5. Sub-account is a child record.

Hard-fail semantics in submitUserOpOrRefuse. All new preflight checks return typed refusals, no silent fallback.

Trust boundaries: bundler URL, Privy wallet id, spend permission payload all server-side. Never from client payload.

Daily spend ledger remains profile-scoped, not sub-account-scoped — a user's daily cap is a property of the issuer, independent of which sub-account executes.

Paymaster policy unchanged (cdp_default).

On-chain building blocks (all already deployed on Base mainnet)
Contract	Address	Purpose
CoinbaseSmartWalletFactory	0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a	deploys sub-accounts at deterministic addresses via createAccount(owners, nonce)
SpendPermissionManager	0xf85210B21cC50302F477BA56686d2019dC9b67Ad	singleton that records parent→spender allowances signed via EIP-712
EntryPoint v0.6	0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789	ERC-4337 entry point used by CDP bundler
Sub-account shape
owners array: [parentCSW, 0xceca…85e9]

factory nonce (salt): keccak256("4626:subacct:v1:" + profileId + ":" + parentCSW) — deterministic per profile, so re-provisioning computes the same address.

deployed via initCode on first UserOp (counterfactual deploy). No separate deploy step; the sub-account doesn't need to exist on chain until its first operation.

owner index for 0xceca…85e9 on the sub-account: 1 (parent CSW at index 0). This is what gets written to command_issuer_execution_context.owner_index.

Spend permission shape
EIP-712 typed data signed by parent CSW (via 0xB05C…0FDD, which is the current parent-side EOA you control). One permission per sub-account per token kind; we issue one for native ETH.

text
SpendPermission {
  account:    0xab6d5c10b03300326cd7fab7267ae192842967b5,  // parent
  spender:    <sub-account address>,
  token:      0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE,  // native ETH sentinel
  allowance:  500000000000000000,                          // 0.5 ETH per period
  period:     86400,                                       // 1 day
  start:      <unix now>,
  end:        <unix + 100 years>,                          // "no yearly cap"
  salt:       <random bytes32>,
  extraData:  0x,
}
Per-tx cap (0.1 ETH) enforced inside submitUserOpOrRefuse via issuer.perTxCapWei — the spend permission itself has no per-tx dimension, only per-period.

DB changes
New columns on command_issuer_execution_context:

sql
ALTER TABLE command_issuer_execution_context
  ADD COLUMN sub_account_address           CITEXT,
  ADD COLUMN parent_csw_address            CITEXT,
  ADD COLUMN spend_permission_payload      JSONB,       -- full SpendPermission struct for replay
  ADD COLUMN spend_permission_signature    BYTEA,       -- parent's signature over EIP-712 hash
  ADD COLUMN spend_permission_hash         BYTEA,       -- cached EIP-712 hash for dedupe
  ADD COLUMN spend_allowance_wei           NUMERIC,
  ADD COLUMN spend_period_seconds          INTEGER,
  ADD COLUMN spend_permission_end_at       TIMESTAMPTZ,
  ADD COLUMN spend_permission_revoked_at   TIMESTAMPTZ;
Semantics:

smart_wallet_address on this table now means the execution address. If sub_account_address IS NOT NULL, then smart_wallet_address = sub_account_address and parent_csw_address holds the funding CSW. If sub_account_address IS NULL, behavior is unchanged (legacy direct-CSW execution for profiles where the canonical CSW already has the Privy signer as an owner).

owner_eoa_address = 0xceca…85e9, owner_index = 1 (on the sub-account).

privy_owner_wallet_id = l8pocg69pnk3djdrp6t4lm0n (same Privy wallet — signs on behalf of the sub-account owner at index 1).

resolveCommandIssuerContextByAddress extended: when matching sender EOA against the context, it should also match against sub_account_address and join parent_csw_address back to profile_wallets for canonical account binding.

Submitter patch
frontend/server/_lib/wallet/userOperationSubmitter.ts:

ts
// New: when issuer has a spend permission, prepend a SpendPermissionManager.spend call
// so the parent CSW funds the sub-account atomically in the same UserOp.

const spendCall = issuer.spendPermission && input.valueWei > 0n
  ? buildSpendPermissionCall({
      manager: SPEND_PERMISSION_MANAGER_BASE,
      permission: issuer.spendPermission.payload,
      amountWei: input.valueWei,
    })
  : null

const effectiveCalls = spendCall ? [spendCall, ...input.calls] : input.calls

// Preflight: if sub-account path, check parent (not sub-account) balance for valueWei + gasBuffer.
// If direct path, unchanged.
const balanceSource = issuer.parentCswAddress ?? issuer.smartWallet
No change to sendPrivyCoinbaseSmartWalletUserOperation — it already accepts any CSW-shaped address and uses whatever ownerIndex is passed.

Provisioning flow
New endpoint: POST /api/arch-b/sub-account/provision

SIWE-gated. User signs the SIWE challenge with 0xB05C…0FDD (an EOA they control that is also a current parent CSW owner), proving parent authority.

Steps:

Verify SIWE session binds sender EOA ↔ profile 1.

Compute sub-account address deterministically from (factory, [parentCSW, 0xceca…85e9], salt). Deploy not required — the first UserOp will deploy via initCode.

Construct EIP-712 SpendPermission payload for sub-account as spender, native ETH, 0.5 ETH / day, end = now + 100y.

Return the typed-data payload to the client. Client signs via 0xB05C…0FDD (metamask / in-app popup). Parent signature is an EOA signature from an owner, which the parent CSW recognizes.

Client POSTs signature back; server verifies via SpendPermissionManager.isAuthorized(permission, signature) (read-only sim against the manager's approveWithSignature path), then writes the command_issuer_execution_context row with sub-account fields filled.

Verify Privy delegation to quorum lr8vgu2l0wnmwg824n4jrtr3 is attached to Privy wallet l8pocg69pnk3djdrp6t4lm0n (existing check from enroll endpoint).

Return { status: "ready", subAccount: "0x…", permissionHash: "0x…" }.

Admin variant: POST /api/admin/arch-b/sub-account/provision for ops bypass, accepting the permission payload + signature directly and skipping SIWE.

Preflight additions
Added to submitUserOpOrRefuse, ordered before UserOp submission:

If issuer.subAccountAddress set:

sub-account address is non-zero ✓ (always true if row exists)

issuer.spendPermission is not revoked (check spend_permission_revoked_at IS NULL)

now() < spend_permission_end_at

parent CSW ETH balance ≥ valueWei + gasBuffer (instead of sub-account balance)

best-effort on-chain check: SpendPermissionManager.isApproved(permission) returns true

best-effort period-window check: remaining allowance in current period ≥ valueWei (via SpendPermissionManager.getCurrentPeriodSpend(permission) + subtract)

If any check fails → typed refusal (code: 'sub_account_unavailable' with scoped reason).

Otherwise proceed to existing caps check, daily ledger reserve, submit.

Coverage
Covers all four command paths with no per-command changes, because all four funnel through submitUserOpOrRefuse today:

/coin buy — handleBuyViaArchB in frontend/server/zora/commands.ts:419

/coin sell — handleSellViaArchB (same file)

/keepr send — handleSendCommandViaArchB in frontend/server/keepr/handleSendCommand.ts

/coin trend reserve — handleTrendReserveViaArchB in frontend/server/zora/commands.ts

Each already resolves an issuer context and calls submitUserOpOrRefuse({ issuer, calls, valueWei, correlationId }). The submitter patch applies uniformly.

Error handling additions
New error codes returned from submitUserOpOrRefuse:

sub_account_not_provisioned — issuer has parent_csw_address shape expected but sub_account_address is null.

spend_permission_revoked — spend_permission_revoked_at is set.

spend_permission_expired — now() > spend_permission_end_at.

spend_permission_period_exhausted — current period spend + valueWei > allowance.

sub_account_parent_insufficient_funds — parent CSW can't cover valueWei + gas buffer.

All map to friendly copy matching the existing refusal style.

Migration / backwards compat
Legacy rows (no sub_account_address) continue working for any profile whose canonical CSW already has the Privy signer as an owner. No forced migration.

Profile 1 row will be migrated during provisioning: smart_wallet_address updated from 0xab6d…67b5 to the new sub-account address, parent and permission fields filled in.

profile_wallets stays untouched: parent CSW remains canonical.

Rollout
Land schema migration in frontend/supabase/migrations/NNN_arch_b_sub_account.sql.

Land submitter patch + types update behind ARCH_B_SUB_ACCOUNTS_ENABLED flag. Default off. Row with sub_account_address IS NOT NULL is only honored when flag is on.

Land provisioning endpoints behind same flag.

Merge docs:check fix for docs CI job.

Deploy preview, run provision flow for profile 1.

Flip ARCH_B_SUB_ACCOUNTS_ENABLED=1 in preview, smoke /coin buy 0.001.

Promote to production. Flip production env flag.

Verify /coin buy, then roll out the three remaining commands by flipping their existing flags one at a time.

Risks
Parent CSW balance depletion. SpendPermission authorizes 0.5 ETH/day but parent has only 0.0498 ETH today. Any buy > ~0.04 ETH will fail at execution. Operational, not structural.

Spend permission key custody. The signature comes from 0xB05C…0FDD; if that EOA is lost the user cannot rotate the permission. Mitigation: store the permission payload + signature in DB so revocation and re-signing is a UI affair, and document that losing this EOA requires signing a new permission from any other parent owner (or adding a new parent owner via the CSW).

EntryPoint version drift. If CDP bundler migrates to EP v0.7, sub-account validation via viem's toCoinbaseSmartAccount must be revalidated. Covered by standard upgrade testing.

Paymaster policy rejection. Unchanged risk from Phase 2; cdp_default sponsors the sub-account deploy + SpendPermissionManager call + inner buy. If any single call exceeds per-op cost cap, bundler_unavailable refusal fires as today.

Replay of spend permission. Every period resets the allowance; an attacker who captures the signed permission cannot inflate the allowance, but CAN invoke SpendPermissionManager.spend(permission, X) themselves only if they are the spender (the sub-account's EOA signer). This is the whole point of the pattern — no additional risk beyond losing the Privy signer.

Out of scope
ERC-20 spend permissions (USDC, coins). Can be added later as additional command_issuer_execution_context rows or additional JSONB entries.

Multi-sub-account per profile. v1 is one sub-account per profile.

Revocation UI. v1 requires an admin call to flip spend_permission_revoked_at.

Funding sub-account directly (bypassing spend permission). v1 always pulls from parent.

Sources
Coinbase Smart Wallet sub-account reference: https://docs.base.org/smart-wallet/concepts/sub-accounts

SpendPermissionManager repo: https://github.com/coinbase/spend-permissions

4626 existing design: architecture-b-design.md, arch-b-coin-trading-design.md, arch-b-delegation-flow-design.md

frontend/server/_lib/wallet/userOperationSubmitter.ts (main, rev 417bf023)

frontend/server/_lib/wallet/privyCoinbaseSmartWallet.ts (main)