# Owner mutation on Base App CSWs: decision

Status: **decided** · Author: computer · Date: 2026-05-05

> **Canonical reference:** [docs/ACCOUNT_MODEL.md](./ACCOUNT_MODEL.md) §3 captures this decision as a load-bearing invariant ("`addOwnerAddress` from a third-party dapp is dead for Base App-managed CSWs"). This file is the original decision record; the canonical doc is the place new designs reconcile against.

## Decision

**Drop "add owner to a Base App-managed CSW" as a product flow.**

The default user-side path for Base App users (passkey-owned CSW) is
**parent CSW + Privy embedded-owner signer** (`legacy-owner-install`) —
the embedded EOA is installed as a direct owner of the parent CSW, which
becomes the `canonical4337` sender. The optional sub-account lane
(`WAITLIST_SUBACCOUNT_FLOW_ENABLED` / `VITE_WAITLIST_SUBACCOUNT_FLOW_ENABLED`)
is a flag-gated, swap-only fallback, not the default. Keep
`addOwnerAddress` only as a path for **Zora-CSW users where an EOA owner
is already known** (per the Supabase mapping).

## Why we ended up here

PR [#523](https://github.com/wenakita/4626/pull/523) started as a Relay quote
endpoint fix (`to must be the EntryPoint v0.6 or v0.7 address`) and grew into a
multi-day investigation of why owner mutations fail on Base App CSWs. The root
cause is **architectural, not a bug**:

- Coinbase Smart Wallet gates `addOwnerAddress` /
  `executeWithoutChainIdValidation` to the EntryPoint, requiring a UserOp signed
  by an existing owner. Confirmed in
  [coinbase/smart-wallet README](https://github.com/coinbase/smart-wallet/blob/main/README.md).
- Base App's session-key middleware **refuses to construct UserOps for
  owner-mutating selectors** from third-party dapps. Surfaces as
  `Error generating transaction / not enough funds`. Confirmed by:
  - 25 successful UserOps on the test CSW `0x4bEa…704EF` in the last week,
    all non-privileged (Uniswap swaps).
  - Every privileged lane on `/dev/csw-signature-probe` failing with the
    same "not enough funds" surface regardless of wrapping
    (`wallet_sendCalls` sponsored, native, `executeBatch`,
    `executeWithoutChainIdValidation`).
  - No demo in [base/demos](https://github.com/base/demos) covers owner
    mutation — the official integration patterns are Sub Accounts +
    Spend Permissions.
- The only path that bypasses Base App is direct WebAuthn
  (`navigator.credentials.get`) signing a UserOp ourselves. **Mechanically
  works**, but the passkey lives on the user's phone in Apple Keychain /
  Google Password Manager. Asking a user to import that passkey into our dapp
  domain is the wrong UX even when it's possible.

## What this means in practice

| User population | Path | Status |
|---|---|---|
| Base App users (passkey-owned CSW) | Parent CSW + embedded-owner signer (`legacy-owner-install`); optional sub-account is flag-gated swap-only fallback | shipped (default path); sub-account lane ships dark behind `WAITLIST_SUBACCOUNT_FLOW_ENABLED` |
| Privy email-signup users (no CSW) | Use embedded EOA directly; vault accepts any `msg.sender` | should already work |
| Zora CSW users with a known EOA owner | `CSW.executeBatch([{target=CSW, data=addOwnerAddress(...)}])` from the EOA | shipped on PR #523 (March-9 lane) |
| Zora CSW users with no EOA owner | Spend Permissions only, or unreachable | depends on Zora exposure |

### Execution-context troubleshooting note (EntryPoint vs router)

When `addOwnerAddress` succeeds for CSWs, it is typically executed through
`EntryPoint.handleOps(...)` in a UserOperation. In that path the wallet performs
the privileged self-call, so owner checks can pass.

If the same selector is embedded directly inside a third-party router
`multicall`, the CSW sees the router as `msg.sender`; that caller is neither the
wallet itself nor an existing owner, so the call reverts before indexing and no
wallet funds move. This distinction is expected and should not be treated as a
relay pricing or calldata-shape regression.

## What ships from PR #523

The PR remains open. Useful pieces to keep:

- ✅ `fix(relay): allow CSW self-call calldata in /api/relay/quote` — real bug, independently mergeable.
- ✅ `fix(relay): enforce hex charset + even length + max bytes in isHexString` — codex bot review fix.
- ✅ `feat(csw): add owner-executeBatch lane mirroring March-9 working pattern` — useful for Zora-CSW-with-EOA-owner subset.
- ✅ `feat(csw): passkey-direct UserOp add-owner lane` — keep as **dev-only diagnostic** on `/dev/csw-signature-probe`. Do **not** surface to end users; the page is dev-scoped already.

What does **not** ship:

- ❌ Any user-facing flow that asks a Base App user to "add an owner to your wallet from this dapp." That's the wrong primitive for that population. The default path is `legacy-owner-install` (embedded EOA as direct parent-CSW owner); the optional sub-account lane is flag-gated swap-only fallback.

## Next work (separate PRs)

> The default user-side path (`legacy-owner-install`) is already shipped. The items below are for the **optional** sub-account lane and its supporting infrastructure, not the default onboarding.

1. **Sub Account provisioning** per `arch-b-sub-account-design-addendum.md` —
   `wallet_addSubAccount` integration, deterministic salt scheme, DB columns
   on `command_issuer_execution_context`. This is the flag-gated swap-only
   fallback lane, not the default user-side path.
2. **Spend Permission issuance UX** — single typed-data signature from the
   parent CSW (Base App allows EIP-712 signing fine; only owner mutations
   are blocked).
3. **Vault deposit flow update** — accept deposits from sub-accounts and from
   plain EOAs; set `receiver = sub-account` so vault shares accumulate where
   the user expects them.

## What to do with `/dev/csw-signature-probe`

Keep it. It's the right place for low-level signing/UserOp experiments,
and the lanes there were diagnostically useful for landing this decision.
The page header already says "dev probe" and the route is gated under
`/dev/`. No production exposure.
