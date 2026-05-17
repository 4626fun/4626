[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/lottery/amoeSubmitZk

# server/\_lib/lottery/amoeSubmitZk

## Interfaces

### AmoeSubmitZkOrchestrationInputs

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:115](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L115)

Inputs the orchestration helper needs from the handler. All
validation is the handler's responsibility — by the time we get
here, every value is well-formed.

#### Properties

##### creatorCoin

> **creatorCoin**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:119](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L119)

Creator coin the entry is for.

##### lotteryAmoeRouter

> **lotteryAmoeRouter**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:143](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L143)

Address of the deployed `LotteryAmoeRouter` (env-driven; passed in
to keep this module pure).

##### nonce

> **nonce**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:123](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L123)

The bytes32 nonce previously issued by `/api/v1/lottery/amoe/nonce`.

##### pointsBurned

> **pointsBurned**: `number`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:121](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L121)

Points being burned (already validated to be in [MIN, MAX]).

##### profileId

> **profileId**: `number` \| `bigint`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:138](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L138)

`profiles.id` (Postgres bigint). Resolved upstream by
`resolveAmoeWallet`. Required — handlers MUST refuse to proceed
without a profile because the LOCKED binding is profile-id, not
wallet.

##### spendRefId

> **spendRefId**: `string`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:131](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L131)

Opaque external reference for the points-burn row (the
idempotency key used by the points ledger). Hash-bound into
`spendRefIdHash`.

##### twitterHandle

> **twitterHandle**: `string`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:125](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L125)

Twitter handle (raw user-supplied; we normalise inside).

##### wallet

> **wallet**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:117](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L117)

Wallet entering the lottery.

***

### AmoeSubmitZkOrchestrationResult

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:175](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L175)

#### Properties

##### call

> **call**: [`AmoeZKBuildResult`](lotteryAmoe.md#amoezkbuildresult)

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:177](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L177)

Built calldata + meta for relay.

##### epoch

> **epoch**: `bigint`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:181](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L181)

The epoch the entry was bound to (for response payload + PR 4 replay store).

##### pointsBurnedAsUSD

> **pointsBurnedAsUSD**: `bigint`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:183](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L183)

USD-1e6 value the entry will burn (echo of pubInputs[5] for response payload).

##### proof

> **proof**: [`AmoeProveResult`](proveAmoeEntryPlonk.md#amoeproveresult)

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:179](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L179)

The PLONK proof + 8-element pubInputs (for downstream logging / replay store).

##### twitterCreditNullifier

> **twitterCreditNullifier**: `bigint`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:192](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L192)

The twitter-credit nullifier (private input the orchestrator
derived from the user's twitter handle), exported so the handler
can persist it on the replay row at `markProven` time. The PR 5b
publisher reads this column when projecting the burn into the
points-burn ledger — without it, the L1 row cannot be bound to
the same wallet-addr commitment that the proof committed to.

***

### AmoeSubmitZkProveOptions

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:150](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L150)

Snarkjs + zkey/wasm wiring the helper expects. Tests inject mocks;
production reads from disk via `defaultProveOptions()`.

#### Properties

##### ledgerSnapshotReader?

> `optional` **ledgerSnapshotReader**: [`AmoeLedgerSnapshotReader`](amoeLedgerSnapshotReader.md#amoeledgersnapshotreader)

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:172](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L172)

PR 5b: production injects an `AmoeLedgerSnapshotPgReader` here so
the orchestrator pulls the CONFIRMED L2 snapshot from
`amoe_points_burn_ledger_snapshots` instead of the single-leaf
stub. When omitted, falls back to the stub (gated by
AMOE_ZK_SNAPSHOT_STUB_ALLOW=1; production deployments must NOT
leave the reader unset).

Note: the stub still owns the *allowlist* half until the allowlist
publisher PR ships. The reader injected here only replaces the
points-burn half; the allowlist single-leaf snapshot is built
inline from the requesting wallet.

##### nowSec?

> `optional` **nowSec**: `bigint`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:158](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L158)

Optional override of `Date.now()` source — tests use this to pin
the epoch deterministically.

##### snarkjs?

> `optional` **snarkjs**: [`SnarkjsLike`](proveAmoeEntryPlonk.md#snarkjslike)

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:153](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L153)

##### wasmPath

> **wasmPath**: `string`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:151](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L151)

##### zkeyPath

> **zkeyPath**: `string`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:152](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L152)

## Variables

### AMOE\_EPOCH\_GENESIS\_UNIX\_SEC

> `const` **AMOE\_EPOCH\_GENESIS\_UNIX\_SEC**: `1777507200n` = `AMOE_EPOCH_GENESIS_SECONDS`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:94](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L94)

Genesis anchor for the AMOE epoch counter — first UTC midnight after
PR #426 (witness construction) merged.

**Single source of truth:** this is now a re-export of
[AMOE\_EPOCH\_GENESIS\_SECONDS](amoeWitness.md#amoe_epoch_genesis_seconds) from `amoeWitness.ts`. The two
names exist for historical reasons; a regression test in
`amoeSubmitZk.test.ts` pins `AMOE_EPOCH_GENESIS_UNIX_SEC ===
AMOE_EPOCH_GENESIS_SECONDS` so they cannot silently drift apart.

Value: `2026-04-30T00:00:00Z` → `Date.UTC(2026, 3, 30) / 1000` =
1_777_507_200.

***

### AMOE\_EPOCH\_SECONDS

> `const` **AMOE\_EPOCH\_SECONDS**: `86400n` = `AMOE_EPOCH_LENGTH_SECONDS`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:79](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L79)

Daily AMOE epoch length, in seconds. Pinned at 86400 — must match
`EPOCH_SECONDS` in `amoe/circuits/amoe_eligibility.circom:157`.

**Single source of truth:** this is now a re-export of
[AMOE\_EPOCH\_LENGTH\_SECONDS](amoeWitness.md#amoe_epoch_length_seconds) from `amoeWitness.ts`. The two
names exist for historical reasons (this module predates the witness
module's promotion to canonical-constant owner in PR 5a) but they
MUST always equal the same bigint — a desync would mean the submit
handler computes a different epoch than the points-burn-ledger
publisher, leaving entries unprovable.

Changing this is a breaking change to the circuit and requires
regenerating the zkey, the verifier, and every fixture. Do not
touch without an explicit zk-circuit change ticket.

## Functions

### assertOrchestrationInputsShape()

> **assertOrchestrationInputsShape**(`inputs`): `void`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:451](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L451)

Defense-in-depth: re-validate that the orchestration inputs the
handler is about to pass us are well-formed. The handler already
validates these, but the cost is one regex per field so we accept
the duplication for the layered-checks property.

#### Parameters

##### inputs

[`AmoeSubmitZkOrchestrationInputs`](#amoesubmitzkorchestrationinputs)

#### Returns

`void`

***

### computeAmoeEpoch()

> **computeAmoeEpoch**(`nowSec`): `bigint`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:105](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L105)

Compute the current AMOE epoch number for a given Unix-second
timestamp. Exposed as a named function so tests can pin specific
epochs without monkey-patching `Date.now`.

#### Parameters

##### nowSec

`bigint`

#### Returns

`bigint`

Non-negative bigint epoch counter. Returns 0 for any time
         before AMOE_EPOCH_GENESIS_UNIX_SEC (which would only occur
         in a misconfigured clock-skewed test environment).

***

### defaultAmoeZkAssetPaths()

> **defaultAmoeZkAssetPaths**(): `object`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:207](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L207)

Best-effort default for the prover wasm + zkey paths.

Resolution order:
  1. `AMOE_ZK_WASM_PATH` / `AMOE_ZK_ZKEY_PATH` env vars (preferred for
     Vercel — set them at deploy time).
  2. Repo-relative fallback under `amoe/circuits/build/...` so local
     `pnpm dev` and the test harness work without env wiring.

PR 6 will swap the env-or-fallback strategy for an
`S3-presigned-URL` strategy at module-load. Until then, disk paths.

#### Returns

`object`

##### wasmPath

> **wasmPath**: `string`

##### zkeyPath

> **zkeyPath**: `string`

***

### isAmoeZkSubmitEnabled()

> **isAmoeZkSubmitEnabled**(): `boolean`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:441](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L441)

Read the `AMOE_ZK_SUBMIT_ENABLED` feature flag. Defaults to `false`.

#### Returns

`boolean`

***

### orchestrateAmoeSubmitZk()

> **orchestrateAmoeSubmitZk**(`inputs`, `proveOpts`): `Promise`\<[`AmoeSubmitZkOrchestrationResult`](#amoesubmitzkorchestrationresult)\>

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:299](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L299)

#### Parameters

##### inputs

[`AmoeSubmitZkOrchestrationInputs`](#amoesubmitzkorchestrationinputs)

##### proveOpts

[`AmoeSubmitZkProveOptions`](#amoesubmitzkproveoptions)

#### Returns

`Promise`\<[`AmoeSubmitZkOrchestrationResult`](#amoesubmitzkorchestrationresult)\>

***

### readLotteryAmoeRouterAddress()

> **readLotteryAmoeRouterAddress**(): `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:432](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeSubmitZk.ts#L432)

Read + validate the deployed `LotteryAmoeRouter` address from env.
Separate from `getApiContracts` so we don't have to widen the typed
contracts surface in PR 3 — PR 5 (publisher) will fold this into
`ApiContracts` properly.

#### Returns

`` `0x${string}` `` \| `null`
