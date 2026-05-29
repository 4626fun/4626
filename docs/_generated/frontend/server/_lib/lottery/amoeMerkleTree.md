[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lottery/amoeMerkleTree

# server/\_lib/lottery/amoeMerkleTree

## Interfaces

### AmoeMerklePath

Defined in: [server/\_lib/lottery/amoeMerkleTree.ts:169](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeMerkleTree.ts#L169)

Inclusion proof in the shape the circuit consumes — `pathElements` are
the sibling values at each level, `pathIndices` are the left/right bits.
Both arrays are exactly `DEPTH` long.

#### Properties

##### pathElements

> **pathElements**: `bigint`[]

Defined in: [server/\_lib/lottery/amoeMerkleTree.ts:170](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeMerkleTree.ts#L170)

##### pathIndices

> **pathIndices**: `bigint`[]

Defined in: [server/\_lib/lottery/amoeMerkleTree.ts:171](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeMerkleTree.ts#L171)

***

### AmoeMerkleSnapshot

Defined in: [server/\_lib/lottery/amoeMerkleTree.ts:149](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeMerkleTree.ts#L149)

Sparse snapshot — only stores nodes along the paths from real leaves
to the root. Empty subtrees are implied by `AMOE_MERKLE_ZERO_HASHES`.

`nodes` keys are `(level << 21) | indexAtLevel`. The shift of 21 is
one more than DEPTH so level-0 indices (which can reach 2^20 - 1) never
collide with level-1+ indices in the same key.

#### Properties

##### leafCount

> **leafCount**: `number`

Defined in: [server/\_lib/lottery/amoeMerkleTree.ts:155](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeMerkleTree.ts#L155)

Logical leaf count BEFORE zero-padding (for diagnostics).

##### leavesByIndex

> **leavesByIndex**: `ReadonlyMap`\<`number`, `bigint`\>

Defined in: [server/\_lib/lottery/amoeMerkleTree.ts:161](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeMerkleTree.ts#L161)

Mapping from leaf index → leaf value, kept around so callers can
cheaply re-read a leaf they put in (e.g. for membership checks).
Sparse — empty positions are absent.

##### nodes

> **nodes**: `ReadonlyMap`\<`number`, `bigint`\>

Defined in: [server/\_lib/lottery/amoeMerkleTree.ts:151](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeMerkleTree.ts#L151)

Map from packed `(level, index)` key to node value.

##### root

> **root**: `bigint`

Defined in: [server/\_lib/lottery/amoeMerkleTree.ts:153](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeMerkleTree.ts#L153)

The Merkle root.

## Variables

### AMOE\_MERKLE\_TREE\_DEPTH

> `const` **AMOE\_MERKLE\_TREE\_DEPTH**: `20`

Defined in: [server/\_lib/lottery/amoeMerkleTree.ts:89](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeMerkleTree.ts#L89)

Locked Merkle tree depth (DEPTH=20) from
`amoe/circuits/amoe_eligibility.circom::component main = AmoeEligibility(20)`.
Bumping this requires regenerating the circuit + zkey.

***

### AMOE\_MERKLE\_TREE\_MAX\_LEAVES

> `const` **AMOE\_MERKLE\_TREE\_MAX\_LEAVES**: `number`

Defined in: [server/\_lib/lottery/amoeMerkleTree.ts:95](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeMerkleTree.ts#L95)

Maximum number of leaves a depth-20 tree can hold (2^20 = 1,048,576).
Snapshot construction throws if asked to insert more than this.

***

### AMOE\_MERKLE\_ZERO\_HASHES

> `const` **AMOE\_MERKLE\_ZERO\_HASHES**: `ReadonlyArray`\<`bigint`\>

Defined in: [server/\_lib/lottery/amoeMerkleTree.ts:132](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeMerkleTree.ts#L132)

`AMOE_MERKLE_ZERO_HASHES[L]` is the value used for an empty ("missing")
sibling at every level of the path. Length is DEPTH+1.

IMPORTANT — non-standard convention
-----------------------------------
In a textbook Merkle tree the empty-subtree value at level `L > 0`
would be `Poseidon(Z[L-1], Z[L-1])`. The AMOE circuit, however,
consumes `pathElements[i]` directly as the sibling — there is no
"is this an empty subtree?" flag — and the canonical fixture
(`amoe/circuits/build/input_v2.json`) encodes a single-leaf root with
`pathElements = [0, 0, ..., 0]` at every level. The circuit therefore
commits to a root computed by hashing `leaf` against literal `0` at
every level, NOT against zero-subtree hashes.

Concretely: the on-chain semantic of the daily allowlist root for a
single allowlisted wallet is
  `H(... H(H(Poseidon2(wallet, epoch), 0), 0), ..., 0)`
iterated DEPTH times. We mirror that here so the publisher we ship
produces roots that round-trip with the existing fixture.

Consequence: a wallet's leaf at index `i` is uniquely committed by the
`(leaf, [0]*DEPTH)` path regardless of how many other wallets are in
the snapshot, as long as those other wallets sit at indices that
never share an ancestor with `i`. The publisher (a separate workstream
— see #403 §2) is responsible for index assignment.

***

### AMOE\_MERKLE\_ZERO\_LEAF

> `const` **AMOE\_MERKLE\_ZERO\_LEAF**: `0n` = `0n`

Defined in: [server/\_lib/lottery/amoeMerkleTree.ts:103](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeMerkleTree.ts#L103)

Zero-leaf value used to pad a sparse snapshot up to `2^DEPTH`. The .circom
file uses raw `0` for empty path positions, so we mirror that here. This
matches the canonical fixture (`input_v2.json`) where every
`pathElements[i]` is `"0"`.

## Functions

### buildAmoeMerkleSnapshot()

> **buildAmoeMerkleSnapshot**(`leaves`): [`AmoeMerkleSnapshot`](#amoemerklesnapshot)

Defined in: [server/\_lib/lottery/amoeMerkleTree.ts:228](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeMerkleTree.ts#L228)

Build a sparse depth-20 Poseidon Merkle tree snapshot from a list of
leaves.

Behavior:
  * Leaves are inserted in the order provided. The position of each
    leaf is its array index — so callers must place each leaf at the
    index that corresponds to its slot in the snapshot (e.g. the
    allowlist publisher decides on a deterministic ordering).
  * Positions beyond `leaves.length` are implicitly
    `AMOE_MERKLE_ZERO_LEAF` — they are NOT stored in `nodes`, but
    `getAmoeMerklePath` reads them from `AMOE_MERKLE_ZERO_HASHES`.
  * `leaves.length > 2^DEPTH` throws
    `AmoeProofGenerationError('plonk_witness_input_invalid')`.

Cost: `O(n * DEPTH)` Poseidon hashes for `n` leaves. With `n=1` that's
20 hashes — about 5 ms.

#### Parameters

##### leaves

readonly `bigint`[]

#### Returns

[`AmoeMerkleSnapshot`](#amoemerklesnapshot)

#### Throws

on overflow / non-bigint elements.

***

### getAmoeMerklePath()

> **getAmoeMerklePath**(`snapshot`, `leafIndex`): [`AmoeMerklePath`](#amoemerklepath)

Defined in: [server/\_lib/lottery/amoeMerkleTree.ts:324](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeMerkleTree.ts#L324)

Compute the inclusion path for a leaf at `leafIndex` in a snapshot built
by [buildAmoeMerkleSnapshot](#buildamoemerklesnapshot). Returns sibling values + left/right
bits in exactly the shape the circuit's MerkleProof template expects.

Empty siblings are read from `AMOE_MERKLE_ZERO_HASHES`, which is
indistinguishable from a dense tree's actual zero ancestors.

#### Parameters

##### snapshot

[`AmoeMerkleSnapshot`](#amoemerklesnapshot)

##### leafIndex

`number`

#### Returns

[`AmoeMerklePath`](#amoemerklepath)

#### Throws

if `leafIndex` is out of range.

***

### readAmoeMerkleLeaf()

> **readAmoeMerkleLeaf**(`snapshot`, `leafIndex`): `bigint`

Defined in: [server/\_lib/lottery/amoeMerkleTree.ts:366](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeMerkleTree.ts#L366)

Read the leaf value at `leafIndex` from a snapshot. Returns
`AMOE_MERKLE_ZERO_LEAF` if the position was never filled. Used by
`amoeWitness.assembleAmoeWitness` to confirm a caller's claimed
leaf-index actually contains the leaf they say it does.

#### Parameters

##### snapshot

[`AmoeMerkleSnapshot`](#amoemerklesnapshot)

##### leafIndex

`number`

#### Returns

`bigint`

***

### verifyAmoeMerklePath()

> **verifyAmoeMerklePath**(`args`): `boolean`

Defined in: [server/\_lib/lottery/amoeMerkleTree.ts:394](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeMerkleTree.ts#L394)

Verify an inclusion proof against an expected root. Pure helper used in
tests and as a defensive sanity check before the witness is handed to
snarkjs (catches off-by-one path bugs locally instead of paying snarkjs's
5-30s prove time only to get an opaque assertion).

Mirrors the circuit's MerkleProof template logic exactly.

#### Parameters

##### args

###### leaf

`bigint`

###### path

[`AmoeMerklePath`](#amoemerklepath)

###### root

`bigint`

#### Returns

`boolean`
