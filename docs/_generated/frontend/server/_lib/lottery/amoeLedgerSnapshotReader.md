[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lottery/amoeLedgerSnapshotReader

# server/\_lib/lottery/amoeLedgerSnapshotReader

## Classes

### AmoeBurnRowMissingError

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotReader.ts:66](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerSnapshotReader.ts#L66)

Server-side / config / upstream class. Maps to HTTP 500 or 503.
Used for missing relay key, RPC failures, downstream contract reads.

#### Extends

- [`AmoeServerError`](lotteryAmoeErrors.md#amoeservererror)

#### Constructors

##### Constructor

> **new AmoeBurnRowMissingError**(): [`AmoeBurnRowMissingError`](#amoeburnrowmissingerror)

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotReader.ts:68](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerSnapshotReader.ts#L68)

###### Returns

[`AmoeBurnRowMissingError`](#amoeburnrowmissingerror)

###### Overrides

[`AmoeServerError`](lotteryAmoeErrors.md#amoeservererror).[`constructor`](lotteryAmoeErrors.md#constructor-3)

#### Properties

##### kind

> `readonly` **kind**: `"amoe_server"`

Defined in: [server/\_lib/lottery/lotteryAmoeErrors.ts:68](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoeErrors.ts#L68)

###### Inherited from

[`AmoeSnapshotNotYetConfirmedError`](#amoesnapshotnotyetconfirmederror).[`kind`](#kind-1)

##### name

> `readonly` **name**: `"AmoeBurnRowMissingError"` = `'AmoeBurnRowMissingError'`

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotReader.ts:67](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerSnapshotReader.ts#L67)

###### Overrides

`AmoeServerError.name`

***

### AmoeLedgerSnapshotPgReader

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotReader.ts:137](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerSnapshotReader.ts#L137)

Postgres-backed reader. Holds a reference to the db pool; one instance
per process is sufficient.

#### Implements

- [`AmoeLedgerSnapshotReader`](#amoeledgersnapshotreader)

#### Constructors

##### Constructor

> **new AmoeLedgerSnapshotPgReader**(`db`): [`AmoeLedgerSnapshotPgReader`](#amoeledgersnapshotpgreader)

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotReader.ts:138](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerSnapshotReader.ts#L138)

###### Parameters

###### db

[`AmoeSnapshotReaderDb`](#amoesnapshotreaderdb)

###### Returns

[`AmoeLedgerSnapshotPgReader`](#amoeledgersnapshotpgreader)

#### Methods

##### readSnapshotForBurn()

> **readSnapshotForBurn**(`args`): `Promise`\<[`AmoeLedgerSnapshotReadResult`](#amoeledgersnapshotreadresult)\>

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotReader.ts:140](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerSnapshotReader.ts#L140)

Return the confirmed snapshot for the given burn.

###### Parameters

###### args

###### signupId

`bigint`

###### spendRefId

`string`

###### Returns

`Promise`\<[`AmoeLedgerSnapshotReadResult`](#amoeledgersnapshotreadresult)\>

###### Throws

AmoeServerError('amoe_ledger_snapshot_unavailable')
        when the burn has not yet been projected, OR when the burn's
        epoch snapshot has not yet been built / confirmed on-chain.
        (The handler maps this to a retryable 503 — the user should
        retry once the publisher catches up.)

###### Implementation of

[`AmoeLedgerSnapshotReader`](#amoeledgersnapshotreader).[`readSnapshotForBurn`](#readsnapshotforburn-2)

***

### AmoeSnapshotNotYetConfirmedError

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotReader.ts:73](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerSnapshotReader.ts#L73)

Server-side / config / upstream class. Maps to HTTP 500 or 503.
Used for missing relay key, RPC failures, downstream contract reads.

#### Extends

- [`AmoeServerError`](lotteryAmoeErrors.md#amoeservererror)

#### Constructors

##### Constructor

> **new AmoeSnapshotNotYetConfirmedError**(): [`AmoeSnapshotNotYetConfirmedError`](#amoesnapshotnotyetconfirmederror)

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotReader.ts:75](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerSnapshotReader.ts#L75)

###### Returns

[`AmoeSnapshotNotYetConfirmedError`](#amoesnapshotnotyetconfirmederror)

###### Overrides

[`AmoeServerError`](lotteryAmoeErrors.md#amoeservererror).[`constructor`](lotteryAmoeErrors.md#constructor-3)

#### Properties

##### kind

> `readonly` **kind**: `"amoe_server"`

Defined in: [server/\_lib/lottery/lotteryAmoeErrors.ts:68](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoeErrors.ts#L68)

###### Inherited from

[`AmoeServerError`](lotteryAmoeErrors.md#amoeservererror).[`kind`](lotteryAmoeErrors.md#kind-3)

##### name

> `readonly` **name**: `"AmoeSnapshotNotYetConfirmedError"` = `'AmoeSnapshotNotYetConfirmedError'`

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotReader.ts:74](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerSnapshotReader.ts#L74)

###### Overrides

`AmoeServerError.name`

## Interfaces

### AmoeLedgerSnapshotReader

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotReader.ts:106](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerSnapshotReader.ts#L106)

Read confirmed snapshots from the AMOE ledger source-of-truth. The PR 3
handler dependency-injects an implementation; tests pass an in-memory
stub, the publisher cron + handler use [AmoeLedgerSnapshotPgReader](#amoeledgersnapshotpgreader).

#### Methods

##### readSnapshotForBurn()

> **readSnapshotForBurn**(`args`): `Promise`\<[`AmoeLedgerSnapshotReadResult`](#amoeledgersnapshotreadresult)\>

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotReader.ts:116](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerSnapshotReader.ts#L116)

Return the confirmed snapshot for the given burn.

###### Parameters

###### args

###### signupId

`bigint`

###### spendRefId

`string`

###### Returns

`Promise`\<[`AmoeLedgerSnapshotReadResult`](#amoeledgersnapshotreadresult)\>

###### Throws

AmoeServerError('amoe_ledger_snapshot_unavailable')
        when the burn has not yet been projected, OR when the burn's
        epoch snapshot has not yet been built / confirmed on-chain.
        (The handler maps this to a retryable 503 — the user should
        retry once the publisher catches up.)

***

### AmoeLedgerSnapshotReadResult

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotReader.ts:90](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerSnapshotReader.ts#L90)

Result returned to the handler / prover for a single burn lookup.

Mirrors the relevant fields of `AmoeWitnessTreeContext`'s points-burn
half so callers can drop this directly into the witness assembler.

#### Properties

##### epoch

> **epoch**: `bigint`

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotReader.ts:92](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerSnapshotReader.ts#L92)

Epoch the burn was projected into — same as the snapshot's epoch.

##### pointsLedgerLeafIndex

> **pointsLedgerLeafIndex**: `number`

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotReader.ts:96](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerSnapshotReader.ts#L96)

Leaf index of the burn within `pointsLedgerSnapshot`.

##### pointsLedgerSnapshot

> **pointsLedgerSnapshot**: [`AmoeMerkleSnapshot`](amoeMerkleTree.md#amoemerklesnapshot)

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotReader.ts:94](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerSnapshotReader.ts#L94)

The deserialized Merkle snapshot for this epoch.

##### rootHex

> **rootHex**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotReader.ts:98](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerSnapshotReader.ts#L98)

The Merkle root, as 0x-hex bytes32. Convenience — equals snapshot.root.

## Type Aliases

### AmoeSnapshotReaderDb

> **AmoeSnapshotReaderDb** = `object`

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotReader.ts:126](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerSnapshotReader.ts#L126)

#### Properties

##### sql()

> **sql**: (`strings`, ...`values`) => `Promise`\<\{ `rows`: `unknown`[]; \}\>

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotReader.ts:127](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerSnapshotReader.ts#L127)

###### Parameters

###### strings

`TemplateStringsArray`

###### values

...`unknown`[]

###### Returns

`Promise`\<\{ `rows`: `unknown`[]; \}\>
