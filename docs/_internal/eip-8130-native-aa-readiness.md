---
title: EIP-8130 Native Account Abstraction Readiness
sidebar_position: 5
---

# EIP-8130 Native Account Abstraction Readiness

**Internal Documentation — 4626 Project Team**

Preparation plan for [Base Cobalt / native account abstraction](https://chain.base.org/upgrades/changelog/native-account-abstraction), which ships [EIP-8130](https://eips.ethereum.org/EIPS/eip-8130). Companion authorities: [ACCOUNT_MODEL.md](./ACCOUNT_MODEL.md) (who signs what), `.cursor/rules/ERC-4337-Wallet-Invariants.mdc` (sender/account selection), [4626-connection-methods.md](./4626-connection-methods.md) (execution tracks).

## 1. Bottom line

**Nothing is broken and nothing needs to change yet.** Base's own migration notes say applications keep working unchanged, `wallet_sendCalls` keeps working, and wallets keep working. Our exposure is concentrated in one place: we do not only *use* smart accounts, we *construct and submit ERC-4337 UserOperations ourselves*, pinned to EntryPoint v0.6, through a CDP bundler and a paymaster policy proxy we own. Those are the parts a native-AA world eventually makes redundant.

The upgrade is also not imminent. As of this writing EIP-8130 is a **Draft** standards-track EIP, live on **Vibenet only**, with Sepolia and mainnet both listed as *Planning*. The reference implementation at `base/eip-8130` carries an explicit "spec is changing, not audited, do not use in production" warning.

So the correct preparation is: **instrument the rollout, write down the migration, and avoid deepening the v0.6 coupling** — not to build a native-AA lane against a moving draft.

## 2. What we measured

`pnpm -C frontend ops:check-native-aa` probes each Base network for the 8130 system surface. Observed today:

| Network | Chain ID | Nonce Manager precompile | Tx Context precompile | Readiness |
|---|---|---|---|---|
| Base mainnet | 8453 | absent | absent | `unsupported` |
| Base Sepolia | 84532 | absent | absent | `unsupported` |
| Base Vibenet | 84538453 | **present** (`eth_getCode` → `0xef`) | absent | `partial` |

Vibenet's `NONCE_MANAGER_ADDRESS` (`0x8130…aa01`) is the only 8130 surface live anywhere on Base, and its `getNonce(address,uint256)` currently reverts with an unrecognized custom error (`0x1bc81ca9`) — the draft ABI is still moving. Treat Vibenet as a signal that work has started, not as an integration target.

The script exits `2` when mainnet or Sepolia leaves `unsupported` — the tripwire that says "start executing section 6" — and `1` when an endpoint could not be probed at all, because an unreachable RPC means readiness is *unknown*, not unchanged. Vibenet is the one exception: it is an ephemeral devnet, so its downtime alone never fails the run.

## 3. What EIP-8130 actually changes

8130 is *not* a new EntryPoint. It moves account abstraction into the protocol:

- **New transaction type** `AA_TX_TYPE = 0x79` (EIP-2718) carrying `calls`, `account_changes`, `metadata`, `expiry`, `payer`, `sender_auth`, `payer_auth`. There is no `UserOperation`, no bundler, and no `handleOps` in this path.
- **Account Configuration contract** at `ACCOUNT_CONFIG_ADDRESS` holds each account's *actors* (credentials) and their *authenticators* (`k1`, `p256`, `passkey`, `delegate`), scopes, expiries, and policies.
- **Sponsorship is native.** A `payer` address plus `payer_auth` replaces the paymaster contract + `pm_getPaymasterData` RPC dance. The payer actor needs the `SPONSOR_PAYER` (`0x10`) scope.
- **Session keys and sub-accounts are native**, expressed as scoped actors with `POLICY` (`0x02`) gating a key to a single manager contract, plus optional `expiry`.
- **2D nonces** via a precompile, including a nonce-free mode (`nonce_key == NONCE_KEY_MAX`) that relies on `expiry` + a `replay_id` ring buffer.
- **Metadata** is a first-class signed field — the natural home for our builder/attribution suffix.

Crucially for us: **existing ERC-4337 wallets are not stranded.** They opt in through a one-time `importAccount(account, chainId, initialActors, signature)` call on the Account Configuration contract, authorized by the account's own ERC-1271 `isValidSignature`. ERC-4337 infrastructure keeps operating alongside.

## 4. Our exposure, by subsystem

Our stack is Coinbase Smart Wallet + EntryPoint v0.6 + CDP bundler/paymaster, driven by `viem/account-abstraction`. Sixteen files reference the v0.6 EntryPoint address or `entryPoint06Address`.

| Subsystem | Files | Native-AA impact |
|---|---|---|
| UserOp construction + signing | `frontend/src/lib/aa/coinbaseErc4337.ts` | **Highest.** Hard build-time assert on the v0.6 address, `toCoinbaseSmartAccount`, bundler `eth_supportedEntryPoints` probe. This is the module a native lane would sit beside. |
| Send-mode routing | `frontend/src/lib/tx/txRouter.ts` | `TxSendMode` union (`sendCalls` / `canonical4337` / `canonicalDirect` / `eoaDirect`) is the extension point for any future native mode. |
| Paymaster policy proxy | `frontend/api/_handlers/paymaster/_paymaster.ts` | Rejects anything that is not EntryPoint v0.6 on chain 8453. Sponsorship allowlists live here and would need a `payer_auth` equivalent. |
| Server automation | `frontend/server/_lib/wallet/userOperationSubmitter.ts`, `privyCoinbaseSmartWallet.ts` | Keepr / XMTP / ERC-8004 sender is `PROTOCOL_CSW_ADDRESS`; same v0.6 assumptions. |
| Deploy-session | `frontend/api/_handlers/deploy/v2/session/_advanceCore.ts`, `deployUserOpGas.ts` | Self-bundles fat UserOps past the CDP gas ceiling. Native `calls` arrays would remove that workaround entirely. |
| Relay execute allowlist | `frontend/api/_handlers/relay/_execute.ts` | Allowlists `handleOps` to EntryPoint v0.6/v0.7 on chain 8453. A native AA tx never targets an EntryPoint, so this gate would need a parallel rule rather than an edit. |
| EIP-5792 lane | `frontend/src/lib/wallet/walletSendCallsPayload.ts`, `cswSendCalls.ts`, `frontend/src/wallet/accountContext/getCapabilities.ts` | **Lowest risk.** Base states `wallet_sendCalls` keeps working; the wallet absorbs the change. |
| Owner install / prepared calls | `frontend/src/lib/wallet/onboardingWalletPrepared.ts`, `onboardingWalletReplayable.ts`, `eoaOwnerPreparedCalls.ts` | Manual v0.6 UserOp hashing plus `wallet_prepareCalls`. Native actor authorization (`authorizeActor`) is a much simpler replacement, but only after Base App supports it. |
| Contracts | — | No repo-authored 4337 accounts, factories, or paymasters. `Registry4626` only stores the creator's CSW address. Nothing to migrate onchain from our side. |

Two second-order notes:

- `contracts/creator/vault/CreatorShareOFT.sol` and `contracts/agent/vault/AgentShareOFT.sol` carry comments assuming `tx.origin` may be a bundler EOA under 4337. Under 8130 there is no bundler and `tx.origin` semantics change again. Nothing depends on it today, but re-read those comments before touching origin-sensitive logic.
- `permissionless` is in `frontend/package.json` with zero imports. It is dead weight on any AA dependency audit; drop it in unrelated cleanup.

## 5. Opportunities this unlocks (for later)

Not action items — the reasons this is worth tracking closely:

- **Cost.** Base claims a >2× per-transaction cost reduction versus current smart accounts. Our sponsored swap path pays that overhead on every batch.
- **Sponsorship without a proxy.** `payer` + `SPONSOR_PAYER` scope could replace `/api/paymaster` entirely, along with the CDP dependency and the `approve_only_not_allowed` / native-ETH-sell restrictions we currently work around.
- **Deploy-session gets simpler.** Scoped, expiring actors (`POLICY` + `expiry`) are a direct protocol-level replacement for "add a temporary server owner, then remove it". The invariant that temporary owners must be removed becomes an `expiry` field.
- **Owner install stops being a fight.** Base App's session-key middleware blocking `addOwnerAddress` from third-party dapps is the root of our Relay owner-install ladder. Native actor authorization is a different mechanism with different constraints — worth re-testing when it lands.
- **Metadata.** Our builder-code suffix (`coinbaseErc4337BuilderSuffix.ts`) currently rides on calldata; 8130 gives it a signed, first-class field.
- **High-throughput sends.** Parallel nonce channels would remove the AA25 in-flight nonce collisions we hit on the CSW `ownerIndex` nonce key.

## 6. Migration sequence (execute when the tripwire fires)

Ordered by dependency, not by calendar. Do not start a stage before its predecessor is green.

1. **Confirm the surface.** `pnpm -C frontend ops:check-native-aa` reports mainnet or Sepolia off `unsupported`. Re-read the final EIP text — the draft moved between spec revisions and this document may be stale.
2. **Pin the addresses.** `ACCOUNT_CONFIG_ADDRESS` and `DEFAULT_ACCOUNT_ADDRESS` are CREATE2-derived and unpublished as of this writing. Once Base publishes them, add them to `EIP_8130` in `frontend/src/features/status/nativeAaReadiness.ts` and re-run the probe with `--account-config`.
3. **Confirm the wallet side first.** We do not control the CSW implementation. Nothing changes for population (b) and (c) users until Base App / Zora expose `importAccount` or ship 8130-aware accounts. Verify against a real Base App wallet before writing lane code; assume nothing from the spec about what the wallet exposes.
4. **Read-only observability.** Extend the probe to report whether `profiles.csw_address` accounts have 8130 state (non-zero change-sequence channels). This tells us the actual migrated share of our users, which decides whether a dual lane is even worth building.
5. **Add a native mode behind a flag.** New `TxSendMode` variant in `frontend/src/lib/tx/txRouter.ts`, defaulting off, with `canonical4337` as the fallback. Do not remove the v0.6 path. Per `ERC-4337-Wallet-Invariants.mdc`, the *sender* stays the parent CSW (`profiles.csw_address`) regardless of transport — 8130 changes how a transaction is carried, not which account holds assets.
6. **Sponsorship.** Only after step 5 is exercised end-to-end: introduce a payer actor with `SPONSOR_PAYER` scope as an alternative to `/api/paymaster`. Keep the existing selector/target allowlists — the policy is ours, not the protocol's.
7. **Server automation last.** Keepr, XMTP, ERC-8004, and deploy-session are unattended. They migrate only after the user-facing lane has run in production.
8. **Retire.** Only once native is default and stable: relax the v0.6 assert in `coinbaseErc4337.ts`, the paymaster proxy's EntryPoint check, and the relay `handleOps` allowlist.

## 7. Hard rules that survive the migration

These come from `ERC-4337-Wallet-Invariants.mdc` and [ACCOUNT_MODEL.md](./ACCOUNT_MODEL.md) and are **not** relaxed by native AA:

- Verified email stays the canonical 4626 identity. Actors are credentials, not identities.
- The parent CSW (`profiles.csw_address`) stays the asset-holding account and the user-initiated execution address. An 8130 actor is a signer, exactly as the Privy embedded EOA is today.
- `PROTOCOL_CSW_ADDRESS` and `CANONICAL_CSW_ADDRESS` stay distinct. Do not merge them because actors make delegation cheaper.
- Server delegation stays scoped and revocable. `expiry` is an improvement on "remove the temporary owner", not permission to skip revocation.
- No silent fallback. If a native lane is unavailable, hard-fail or route to `canonical4337` explicitly — never downgrade sponsorship silently.
- Asset checks always read the parent CSW regardless of execution track.
- User-facing copy never mentions Base or Coinbase **sub-accounts**, even though 8130 markets them.

## 8. Open questions for Base

Unanswered by the spec or the changelog; worth asking before committing to any design:

1. What are the deployed `ACCOUNT_CONFIG_ADDRESS` and `DEFAULT_ACCOUNT_ADDRESS` on each network?
2. Will Base App and Zora call `importAccount` on behalf of existing Coinbase Smart Wallets, or is it user-initiated? This decides whether we ever see a mixed population.
3. Does `wallet_sendCalls` transparently choose the 8130 path once an account is imported, and can a dapp detect that via `wallet_getCapabilities`?
4. Does CDP intend to offer an 8130 payer service, or does native sponsorship mean self-hosting a payer account?
5. `importAccount` sets `DEFAULT_EOA_REVOKED` — what happens to CSW owner slots (our `ownerIndex` nonce-key assumption) after import?
6. Is there a Sepolia target for Cobalt, or does Vibenet feed straight into mainnet planning?

## 9. Tooling

| What | Where |
|---|---|
| Protocol constants + readiness classifier | `frontend/src/features/status/nativeAaReadiness.ts` |
| Tests | `frontend/src/features/status/nativeAaReadiness.test.ts` |
| Rollout tripwire | `pnpm -C frontend ops:check-native-aa` (`--json`, `--markdown`, `--rpc`, `--expect`, `--account-config`) |

The constants live under `features/status` because today they only serve observability. When a native execution lane exists, move `EIP_8130` to `frontend/src/lib/aa/` alongside the EntryPoint constants and leave the classifier behind.
