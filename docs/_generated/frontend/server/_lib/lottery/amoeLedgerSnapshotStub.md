[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lottery/amoeLedgerSnapshotStub

# server/\_lib/lottery/amoeLedgerSnapshotStub

## Interfaces

### AmoeLedgerSnapshotStubInputs

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotStub.ts:56](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotStub.ts#L56)

Inputs needed to materialize a single-leaf snapshot pair for the
requesting entry.

#### Properties

##### epoch

> **epoch**: `bigint`

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotStub.ts:60](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotStub.ts#L60)

Daily epoch counter (≤ 2^64 - 1).

##### pointsBurnedAsUSD

> **pointsBurnedAsUSD**: `bigint`

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotStub.ts:68](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotStub.ts#L68)

Points burned in USD-1e6 units.

##### signupIdHash

> **signupIdHash**: `bigint`

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotStub.ts:62](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotStub.ts#L62)

Pre-canonicalized `signupIdHash`.

##### spendRefIdHash

> **spendRefIdHash**: `bigint`

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotStub.ts:64](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotStub.ts#L64)

Pre-canonicalized `spendRefIdHash`.

##### twitterCreditNullifier

> **twitterCreditNullifier**: `bigint`

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotStub.ts:66](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotStub.ts#L66)

Pre-canonicalized `twitterCreditNullifier`.

##### walletBigint

> **walletBigint**: `bigint`

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotStub.ts:58](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotStub.ts#L58)

EVM wallet address as bigint (uint160).

## Functions

### buildAmoeLedgerSnapshotStub()

> **buildAmoeLedgerSnapshotStub**(`inputs`): [`AmoeWitnessTreeContext`](amoeWitness.md#amoewitnesstreecontext)

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotStub.ts:94](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotStub.ts#L94)

Build a single-leaf snapshot pair for the requesting entry.

Throws `AmoeServerError('amoe_ledger_snapshot_stub_not_allowed')` if
the stub flag is not explicitly enabled. That maps to a 5xx and
makes any deployment that forgets to wire up the real publisher
fail loudly.

#### Parameters

##### inputs

[`AmoeLedgerSnapshotStubInputs`](#amoeledgersnapshotstubinputs)

#### Returns

[`AmoeWitnessTreeContext`](amoeWitness.md#amoewitnesstreecontext)

A `{trees}` object suitable as `args.trees` for
         `assembleAmoeWitness`. Both `*LeafIndex` values are 0 because
         the stub puts the only real leaf at position 0.

***

### isAmoeLedgerSnapshotStubAllowed()

> **isAmoeLedgerSnapshotStubAllowed**(): `boolean`

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotStub.ts:78](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotStub.ts#L78)

Read the snapshot-stub allowlist flag.

Returns `true` iff `AMOE_ZK_SNAPSHOT_STUB_ALLOW === '1'`. Anything
else (including unset) returns `false`. Production deployments MUST
leave this unset.

#### Returns

`boolean`
