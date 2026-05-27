[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lottery/amoeLedgerSnapshotBuilder

# server/\_lib/lottery/amoeLedgerSnapshotBuilder

## Interfaces

### AmoeLedgerTreeBlob

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotBuilder.ts:99](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotBuilder.ts#L99)

Wire-format of the JSONB `tree_blob` column. Encoded as a tagged shape
(`v: 1`) so future tree-format changes can be detected without a schema
migration. The reader (`amoeLedgerSnapshotPg.ts`) refuses any other `v`.

#### Properties

##### depth

> **depth**: `number`

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotBuilder.ts:101](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotBuilder.ts#L101)

##### leafCount

> **leafCount**: `number`

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotBuilder.ts:102](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotBuilder.ts#L102)

##### leaves

> **leaves**: \[`number`, `string`\][]

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotBuilder.ts:112](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotBuilder.ts#L112)

Leaves indexed by tree position, `[leafIndex, value_hex]`.

##### nodes

> **nodes**: \[`number`, `number`, `string`\][]

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotBuilder.ts:110](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotBuilder.ts#L110)

Materialized non-zero internal nodes, as `[level, indexAtLevel,
value_hex]`. Only nodes on the path from a real leaf to the root.
Empty subtrees are reconstructed by the reader from
AMOE_MERKLE_ZERO_HASHES.

##### rootHex

> **rootHex**: `string`

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotBuilder.ts:103](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotBuilder.ts#L103)

##### v

> **v**: `1`

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotBuilder.ts:100](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotBuilder.ts#L100)

***

### BuildAmoeLedgerSnapshotArgs

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotBuilder.ts:64](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotBuilder.ts#L64)

#### Properties

##### db

> **db**: [`AmoeSnapshotBuilderDb`](#amoesnapshotbuilderdb)

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotBuilder.ts:65](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotBuilder.ts#L65)

##### epoch

> **epoch**: `bigint`

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotBuilder.ts:66](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotBuilder.ts#L66)

##### publisherRunId

> **publisherRunId**: `string`

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotBuilder.ts:67](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotBuilder.ts#L67)

##### publisherVersion

> **publisherVersion**: `string`

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotBuilder.ts:74](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotBuilder.ts#L74)

Git SHA (or other version tag) of the publisher binary writing this
snapshot. Pinned in the L2 row for forensics — if a circuit
regression turns up, we can identify which publisher revision produced
each affected snapshot.

***

### BuildAmoeLedgerSnapshotResult

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotBuilder.ts:77](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotBuilder.ts#L77)

#### Properties

##### epoch

> **epoch**: `bigint`

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotBuilder.ts:78](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotBuilder.ts#L78)

##### leafCount

> **leafCount**: `number`

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotBuilder.ts:79](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotBuilder.ts#L79)

##### rootHex

> **rootHex**: `string`

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotBuilder.ts:80](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotBuilder.ts#L80)

##### snapshot

> **snapshot**: [`AmoeMerkleSnapshot`](amoeMerkleTree.md#amoemerklesnapshot)

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotBuilder.ts:91](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotBuilder.ts#L91)

The in-memory `AmoeMerkleSnapshot` produced. Returned for unit tests
that want to verify a path against the live tree. Not used by the
cron path.

##### treeBlob

> **treeBlob**: [`AmoeLedgerTreeBlob`](#amoeledgertreeblob)

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotBuilder.ts:85](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotBuilder.ts#L85)

The serialized JSONB blob that was stored. Useful for tests + for the
cron to log a content hash without re-querying.

## Type Aliases

### AmoeSnapshotBuilderDb

> **AmoeSnapshotBuilderDb** = `object`

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotBuilder.ts:57](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotBuilder.ts#L57)

Db pool shape this module needs (matches `amoeLedgerProjector.ts`).

#### Properties

##### sql()

> **sql**: (`strings`, ...`values`) => `Promise`\<\{ `rows`: `unknown`[]; \}\>

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotBuilder.ts:58](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotBuilder.ts#L58)

###### Parameters

###### strings

`TemplateStringsArray`

###### values

...`unknown`[]

###### Returns

`Promise`\<\{ `rows`: `unknown`[]; \}\>

## Functions

### buildAmoeLedgerSnapshot()

> **buildAmoeLedgerSnapshot**(`args`): `Promise`\<[`BuildAmoeLedgerSnapshotResult`](#buildamoeledgersnapshotresult)\>

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotBuilder.ts:165](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotBuilder.ts#L165)

Build the Merkle snapshot for a single epoch. Reads every L1 row in the
locked deterministic order, hashes the depth-20 sparse tree, and writes
the L2 row in state 1. Returns the snapshot for caller verification.

#### Parameters

##### args

[`BuildAmoeLedgerSnapshotArgs`](#buildamoeledgersnapshotargs)

#### Returns

`Promise`\<[`BuildAmoeLedgerSnapshotResult`](#buildamoeledgersnapshotresult)\>

#### Throws

AmoeServerError('amoe_ledger_snapshot_already_built') if a
        snapshot already exists for this epoch.

#### Throws

AmoeServerError('amoe_ledger_snapshot_too_many_leaves') if the
        epoch holds more than 2^20 burns (publisher cap).

#### Throws

Error on malformed leaf hex in L1 (defensive — the projector
        already validates).

***

### deserializeLedgerTreeBlob()

> **deserializeLedgerTreeBlob**(`blob`): [`AmoeMerkleSnapshot`](amoeMerkleTree.md#amoemerklesnapshot)

Defined in: [server/\_lib/lottery/amoeLedgerSnapshotBuilder.ts:298](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeLedgerSnapshotBuilder.ts#L298)

Reconstruct an `AmoeMerkleSnapshot` from a stored `AmoeLedgerTreeBlob`.
Used by the snapshot reader to reissue paths to the prover without
recomputing the entire tree on every read.

#### Parameters

##### blob

[`AmoeLedgerTreeBlob`](#amoeledgertreeblob)

#### Returns

[`AmoeMerkleSnapshot`](amoeMerkleTree.md#amoemerklesnapshot)

#### Throws

Error on unrecognized blob version or malformed entries.
