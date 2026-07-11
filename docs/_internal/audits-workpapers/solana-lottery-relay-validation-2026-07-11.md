# Solana lottery relay audit — validation record

Date: 2026-07-11  
Branch: `audit/solana-lottery-relay`  
Mutation policy: read-only RPC/runtime checks only; no Base/Solana transaction submission.

## Read-only production checks

### Base mainnet

Command shape: `cast call` against the configured Base RPC; RPC credentials are intentionally omitted.

| Read | Result |
|---|---|
| Current LM `boostManager()` | `0x0000000000000000000000000000000000000000` |
| Current LM `vaultGaugeVoting()` | `0x0000000000000000000000000000000000000000` |
| Current LM `paused()` | `false` |
| Current LM `authorizedSwapContracts(v1.18 adapter)` | `true` |
| Current LM `deferredVrfQueueLength()` | `0` |
| v1.18 adapter `lotteryManager()` | `0xbE87AD917bE7f6a9AE1F9c9dd0A7Ec7550F3F8C1` — superseded manager; blocker |
| v1.18 adapter `owner()` | `0xB05Cf01231cF2fF99499682E64D3780d57c80FdD` |
| v1.18 adapter `BRIDGE()` | `0x3eff766C76a1be2Ce1aCF2B69c78bCae257D5188` |
| Current LM bytecode | present, 24,061 bytes |
| v1.18 adapter bytecode | present, 14,627 bytes |

All calls exited `0`. Foundry printed the pre-existing warning `Found unknown 'ignore' config for profile 'default' defined in foundry.toml` during `cast code`.

### Solana mainnet

Command:

`solana program show EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU --url https://api.mainnet-beta.solana.com`

Exit `0`:

- owner `BPFLoaderUpgradeab1e11111111111111111111111`
- ProgramData `DojrYy5obEk2w9ZMpX1bLFHU4rrZqYQsZJZaXFxFGKFU`
- authority `7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY`
- last deployed slot `431796316`
- data length `372488`

### Runtime flags

- Local `kpr/.env`: `SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0`.
- Railway MCP project listing succeeded, but service listing returned `Unauthorized. Please run railway login again.` A later robust CLI query exited `1` with `Invalid RAILWAY_TOKEN. Please check that it is valid and has access to the resource you're trying to use.` Railway production value is therefore **not independently verified**. An earlier stderr-suppressed pipeline printed `<unset>` from empty input and is not treated as evidence.
- Vercel API project `4626`, production target: relay key exists with empty value. No env write occurred.
- TierZero required authentication; the user skipped the OAuth prompt. Production telemetry was therefore unavailable and is explicitly not claimed as validated.

## Source validation

### Passing

| Command | Exit/result |
|---|---|
| `pnpm exec vitest run tests/keepr-solana-relay-entries.test.ts tests/keepr-solana-winner-relay.test.ts tests/solana-canonical-addresses.test.ts tests/actionLease.test.ts` in `kpr/` | exit `0`; 4 files, 32 tests passed |
| `pnpm typecheck` in `kpr/` | exit `0` |
| Full KPR suite with production key variables removed from the test process | exit `0`; 28 files, 234 tests passed |
| Targeted B2 readiness Vitest | exit `0`; 3 tests passed |
| Targeted Solana API/auth/status Vitest | exit `0`; 5 files, 50 tests passed |
| `forge test --match-path 'test/SolanaBridgeAdapterEdgeCases.t.sol' -vv` | exit `0`; 16 passed |
| `forge test --match-path 'test/Registry4626.SolanaPeerIntegrity.t.sol' -vv` | exit `0`; 2 passed |
| Targeted LM oracle, hardening, pause, and curve boost suites | exit `0`; 22 passed |
| `cargo test` in `programs/creator-share-hook/` | exit `0`; 19 passed; existing Anchor cfg/unused warnings |
| `cargo check` in `programs/creator-share-hook/` | exit `0`; existing Anchor cfg/unused warnings |
| `bash test/current-release-target-guard.sh` after guard update | exit `0`; `current split Phase-1 release target guard passed` |
| `pnpm lint` in `frontend/` | exit `0`; generated-bytecode Babel deoptimization notices only |
| `pnpm typecheck` in `frontend/` | exit `0` |
| `forge build` | exit `0` |
| `git diff --check` | exit `0` |

### Failed attempts retained for honesty

1. `cargo test -p creator-share-hook` from repository root: exit `101`, `error: could not find Cargo.toml in /home/akitav2/projects/4626 or any parent directory`.
2. `cargo check -p creator-share-hook` from repository root: exit `101`, same error. Both were rerun successfully from the program directory.
3. `pnpm test -- --run ...` in `kpr/`: exit `1`. The extra separator caused Vitest to run the full suite under the ambient developer env. `keeper-automation-keys.test.ts:50` expected `null` but received a non-null private key value (redacted). The full suite was rerun with key variables removed and passed 234/234.
4. First address-guard run after widening KPR coverage: exit `1`; it detected retired addresses in explicitly historical deployment scripts and legacy/deprecated allowlists. The guard was narrowed to exclude fail-closed historical scripts and named legacy sets, then passed.

## Post-validation safety recheck

The final read-only recheck must match the baseline:

- local KPR relay flag `0` and Vercel production value empty; Railway production remains auth-blocked;
- LM boost sources zero;
- no boost timelock call;
- no Base/Solana transaction hash produced;
- adapter still points to the superseded manager, so relay remains blocked.

No validation command in this record deployed, upgraded, registered, provisioned, created a pool, sent a transaction, or enabled relay.
