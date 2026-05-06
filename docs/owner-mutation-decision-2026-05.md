# Owner mutation on Base App CSWs: decision

Status: **decided** · Author: computer · Date: 2026-05-05

## Decision

**Drop "add owner to a Base App-managed CSW" as a product flow.**

Use Sub Accounts + Spend Permissions for that population, per the existing
[Arch B Sub-Account Design Addendum](./arch-b-sub-account-design-addendum.md).
Keep `addOwnerAddress` only as a path for **Zora-CSW users where an EOA owner
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
| Base App users (passkey-owned CSW) | Sub Accounts + Spend Permissions | not yet implemented; design exists in `arch-b-sub-account-design-addendum.md` |
| Privy email-signup users (no CSW) | Use embedded EOA directly; vault accepts any `msg.sender` | should already work |
| Zora CSW users with a known EOA owner | `CSW.executeBatch([{target=CSW, data=addOwnerAddress(...)}])` from the EOA | shipped on PR #523 (March-9 lane) |
| Zora CSW users with no EOA owner | Spend Permissions only, or unreachable | depends on Zora exposure |

## What ships from PR #523

The PR remains open. Useful pieces to keep:

- ✅ `fix(relay): allow CSW self-call calldata in /api/relay/quote` — real bug, independently mergeable.
- ✅ `fix(relay): enforce hex charset + even length + max bytes in isHexString` — codex bot review fix.
- ✅ `feat(csw): add owner-executeBatch lane mirroring March-9 working pattern` — useful for Zora-CSW-with-EOA-owner subset.
- ✅ `feat(csw): passkey-direct UserOp add-owner lane` — keep as **dev-only diagnostic** on `/dev/csw-signature-probe`. Do **not** surface to end users; the page is dev-scoped already.

What does **not** ship:

- ❌ Any user-facing flow that asks a Base App user to "add an owner to your wallet from this dapp." That's the wrong primitive for that population.

## Next work (separate PRs)

1. **Sub Account provisioning** per `arch-b-sub-account-design-addendum.md` —
   `wallet_addSubAccount` integration, deterministic salt scheme, DB columns
   on `command_issuer_execution_context`.
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
