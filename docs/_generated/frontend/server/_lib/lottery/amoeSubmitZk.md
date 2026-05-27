[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lottery/amoeSubmitZk

# server/\_lib/lottery/amoeSubmitZk

## Interfaces

### AmoeSubmitZkOrchestrationInputs

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:116](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L116)

Inputs the orchestration helper needs from the handler. All
validation is the handler's responsibility — by the time we get
here, every value is well-formed.

#### Properties

##### creatorCoin

> **creatorCoin**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:120](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L120)

Creator coin the entry is for.

##### lotteryAmoeRouter

> **lotteryAmoeRouter**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:144](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L144)

Address of the deployed `LotteryAmoeRouter` (env-driven; passed in
to keep this module pure).

##### nonce

> **nonce**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:124](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L124)

The bytes32 nonce previously issued by `/api/v1/lottery/amoe/nonce`.

##### pointsBurned

> **pointsBurned**: `number`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:122](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L122)

Points being burned (already validated to be in [MIN, MAX]).

##### profileId

> **profileId**: `number` \| `bigint`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:139](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L139)

`profiles.id` (Postgres bigint). Resolved upstream by
`resolveAmoeWallet`. Required — handlers MUST refuse to proceed
without a profile because the LOCKED binding is profile-id, not
wallet.

##### spendRefId

> **spendRefId**: `string`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:132](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L132)

Opaque external reference for the points-burn row (the
idempotency key used by the points ledger). Hash-bound into
`spendRefIdHash`.

##### twitterHandle

> **twitterHandle**: `string`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:126](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L126)

Twitter handle (raw user-supplied; we normalise inside).

##### wallet

> **wallet**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:118](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L118)

Wallet entering the lottery.

***

### AmoeSubmitZkOrchestrationResult

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:176](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L176)

#### Properties

##### call

> **call**: [`AmoeZKBuildResult`](lotteryAmoe.md#amoezkbuildresult)

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:178](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L178)

Built calldata + meta for relay.

##### epoch

> **epoch**: `bigint`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:182](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L182)

The epoch the entry was bound to (for response payload + PR 4 replay store).

##### pointsBurnedAsUSD

> **pointsBurnedAsUSD**: `bigint`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:184](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L184)

USD-1e6 value the entry will burn (echo of pubInputs[5] for response payload).

##### proof

> **proof**: [`AmoeProveResult`](proveAmoeEntryPlonk.md#amoeproveresult)

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:180](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L180)

The PLONK proof + 8-element pubInputs (for downstream logging / replay store).

##### twitterCreditNullifier

> **twitterCreditNullifier**: `bigint`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:193](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L193)

The twitter-credit nullifier (private input the orchestrator
derived from the user's twitter handle), exported so the handler
can persist it on the replay row at `markProven` time. The PR 5b
publisher reads this column when projecting the burn into the
points-burn ledger — without it, the L1 row cannot be bound to
the same wallet-addr commitment that the proof committed to.

***

### AmoeSubmitZkProveOptions

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:151](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L151)

Snarkjs + zkey/wasm wiring the helper expects. Tests inject mocks;
production reads from disk via `defaultProveOptions()`.

#### Properties

##### ledgerSnapshotReader?

> `optional` **ledgerSnapshotReader**: [`AmoeLedgerSnapshotReader`](amoeLedgerSnapshotReader.md#amoeledgersnapshotreader)

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:173](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L173)

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

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:159](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L159)

Optional override of `Date.now()` source — tests use this to pin
the epoch deterministically.

##### snarkjs?

> `optional` **snarkjs**: [`SnarkjsLike`](proveAmoeEntryPlonk.md#snarkjslike)

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:154](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L154)

##### wasmPath

> **wasmPath**: `string`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:152](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L152)

##### zkeyPath

> **zkeyPath**: `string`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:153](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L153)

## Variables

### AMOE\_EPOCH\_GENESIS\_UNIX\_SEC

> `const` **AMOE\_EPOCH\_GENESIS\_UNIX\_SEC**: `1777507200n` = `AMOE_EPOCH_GENESIS_SECONDS`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:95](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L95)

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

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:80](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L80)

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

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:448](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L448)

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

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:106](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L106)

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

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:213](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L213)

#### Returns

`object`

##### wasmPath

> **wasmPath**: `string`

##### zkeyPath

> **zkeyPath**: `string`

***

### isAmoeZkSubmitEnabled()

> **isAmoeZkSubmitEnabled**(): `boolean`

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:438](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L438)

Read the `AMOE_ZK_SUBMIT_ENABLED` feature flag. Defaults to `false`.

#### Returns

`boolean`

***

### orchestrateAmoeSubmitZk()

> **orchestrateAmoeSubmitZk**(`inputs`, `proveOpts`): `Promise`\<[`AmoeSubmitZkOrchestrationResult`](#amoesubmitzkorchestrationresult)\>

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:296](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L296)

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

Defined in: [server/\_lib/lottery/amoeSubmitZk.ts:429](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeSubmitZk.ts#L429)

Read + validate the deployed `LotteryAmoeRouter` address from env.
Separate from `getApiContracts` so we don't have to widen the typed
contracts surface in PR 3 — PR 5 (publisher) will fold this into
`ApiContracts` properly.

#### Returns

`` `0x${string}` `` \| `null`
