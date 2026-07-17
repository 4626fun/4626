# Solana lottery relay — LZ-era P0/P1 close

Date: 2026-07-17  
Scope: source, tests, docs only  
Mutation policy: no deploy, upgrade, register, pool create, `cast send`, Solana tx, relay enablement, or boost arming.

## Verdicts

`Solana personal veLottery boost safe to enable: NO`

`Solana base-odds relay safe to enable: NO`

Relay remains disabled (`SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED` unset/`0`). No live Base/Solana mutation occurred.

## Findings delta vs 2026-07-11

| ID | Was | Now | Notes |
|----|-----|-----|-------|
| SOL-P0-01 | Mitigated / transport open | Fixed in source / enablement blocked | Twin dead; LZ fail-closed modules; OApp peer unset |
| SOL-P0-02 | Open | Fixed in source | `source_event_id` + durable inbox |
| SOL-P0-03 | Closed / superseded | Closed / superseded | Twin adapter historical only |
| SOL-P0-04 | Open | Fixed in source / venue canary deferred | B1 vs B2 locked; buy-path unit proof |
| SOL-P1-01 | Open | Fixed in source | SKIP LOCKED lease + crash recovery |
| SOL-P1-02 | Open | Fixed in source | Log ingest canonical; ring secondary |
| SOL-P1-03…P1-06 | Fixed | Fixed | Preserved |

## Identity + token mapping

| Boundary | Identity | Result |
|---|---|---|
| Hook entry owner | Destination Token-2022 account owner | Solana `Pubkey` |
| Base beneficiary | Unique `profile_wallets.is_canonical_solana_wallet` → `profiles.csw_address` | Parent CSW |
| Personal veLottery | Not attributable cross-chain | Force coverage `0` |
| Payout owner | Same parent CSW as LM request user | ShareOFT at CSW |
| Solana winner display | Original buyer pubkey via injective map | Notification only |

| Asset | Domain | Must not confuse with |
|---|---|---|
| Creator Coin | Base ERC-20 | ShareOFT |
| ShareOFT | Base | Creator Coin |
| B1 share mesh mint | Solana standard SPL | Token-2022 hook mint |
| B2 hook mint | Token-2022 + TransferHook | B1 SPL mint |
| `LotteryEntry.amount` | Hook mint u64 | USD |
| LM swap USD | 6-decimal USD | Token amount |

## Future enablement checklist

1. Keep `SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0`.
2. Deploy/review Solana lottery OApp; set `SOLANA_LOTTERY_OAPP_PEER_BYTES32`; authorize on LM `authorizedRemoteOFTs(30168, peer)`.
3. Prove live Meteora B2 buy → one `LotteryEntryRecorded` (token_badge + pool).
4. Enable ingest (`SOLANA_LOTTERY_INGEST_ENABLED`) against finalized RPC; reconcile any buffer residue.
5. Set `SOLANA_LOTTERY_LZ_TRANSPORT_READY=1` only after independent transport review.
6. Dry-run canary with flag still off for submit; then separate explicit ops auth for flag-on canary.
7. Personal boost stays off until EVM beneficiary + coverage + swapUSD proven for one identity.

**Rollback:** flag `0`; stop submit/ingest workers; preserve inbox/quarantine; no program downgrade.

## Safety statement

No deployment, provisioning, registration, pool creation, program upgrade, relay enablement, or `armBoostSourceTimelock()` occurred. LM `boostManager` / `vaultGaugeVoting` were not mutated. Retired Twin adapter was not revived as an active default.

## Validation record (2026-07-17)

| Command | Exit |
|---|---|
| `cargo test` in `programs/creator-share-hook/` | 0 (24 passed) |
| `cargo check` in `programs/creator-share-hook/` | 0 |
| `forge test --match-path 'test/LotteryManager4626.SolanaLzEntryAuth.t.sol' -vv` | 0 (6 passed) |
| `pnpm exec vitest run tests/keepr-solana-lottery-relay.test.ts tests/solana-keeper-orchestrator.test.ts` in `kpr/` | 0 (13 passed) |
| `pnpm typecheck` in `kpr/` | 0 |
| `pnpm -C frontend exec vitest run` solanaLottery* + solanaB2Readiness | 0 (29 passed) |
| `pnpm -C frontend exec vitest run api/__tests__/keeperJobs.handler.test.ts` | 0 (26 passed) |

No live mutation. Relay remains disabled.

## Review follow-up (PR #700)

Hardened after Codex/Cubic review:

- Anchor `Program data:` decode only (no JSON log fallback); events must be inside hook invoke window.
- Signature backlog drained with `before` paging; null tx fetch stops cursor advance.
- Submit intent (`submitting`) before send; receipt required; expired submitting → quarantine `submit_crash_unconfirmed` (no auto-resubmit).
- Lease-owner predicates on lease-owned transitions.
- Identity requires `profile_wallets.chain = solana`.
- Migration renamed to `20260717090000_solana_lottery_entry_inbox.sql` (avoid Alfaclub timestamp clash).
- Enablement still requires OApp payload to bind `source_event_id` for Base-side dedupe; relay flag remains off.
