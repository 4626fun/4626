[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/lottery/proveAmoeEntryPlonk

# server/\_lib/lottery/proveAmoeEntryPlonk

## Classes

### AmoeProofGenerationError

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:91](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L91)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new AmoeProofGenerationError**(`code`, `message?`): [`AmoeProofGenerationError`](#amoeproofgenerationerror)

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:94](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L94)

###### Parameters

###### code

[`AmoeProofGenerationErrorCode`](#amoeproofgenerationerrorcode-1)

###### message?

`string`

###### Returns

[`AmoeProofGenerationError`](#amoeproofgenerationerror)

###### Overrides

`Error.constructor`

#### Properties

##### code

> `readonly` **code**: [`AmoeProofGenerationErrorCode`](#amoeproofgenerationerrorcode-1)

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:92](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L92)

## Interfaces

### AmoeEligibilityWitness

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:270](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L270)

AMOE eligibility circuit witness input. Maps 1:1 onto the 14 declared
input signals in `circuits/amoe/amoe_eligibility.circom::AmoeEligibility`.

VALUES MUST BE BN254-FIELD-VALID. snarkjs accepts BigInts, decimal-string
BigInts, and base-10 numbers; we normalize to decimal strings before
handing them to snarkjs because (a) snarkjs documentation uses that form
and (b) it sidesteps a known v0.6.x bug where numeric input occasionally
round-trips through Number() and loses precision above 2^53.

DEPTH is 20 — `pathElements` and `pathIndices` MUST be exactly that
length or snarkjs will emit an opaque "Assert Failed" message at witness
generation time.

#### Properties

##### allowlistRoot

> **allowlistRoot**: `string` \| `bigint`

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:276](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L276)

##### creatorCoinAddr

> **creatorCoinAddr**: `string` \| `bigint`

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:273](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L273)

##### epoch

> **epoch**: `string` \| `bigint`

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:275](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L275)

##### nonce

> **nonce**: `string` \| `bigint`

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:283](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L283)

##### nonceCommit

> **nonceCommit**: `string` \| `bigint`

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:274](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L274)

##### pathElements

> **pathElements**: readonly (`string` \| `bigint`)[]

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:285](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L285)

##### pathIndices

> **pathIndices**: readonly (`string` \| `bigint`)[]

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:286](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L286)

##### pointsBurnedAsUSD

> **pointsBurnedAsUSD**: `string` \| `bigint`

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:277](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L277)

##### pointsBurnNullifier

> **pointsBurnNullifier**: `string` \| `bigint`

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:279](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L279)

##### pointsLedgerPathElements

> **pointsLedgerPathElements**: readonly (`string` \| `bigint`)[]

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:291](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L291)

##### pointsLedgerPathIndices

> **pointsLedgerPathIndices**: readonly (`string` \| `bigint`)[]

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:292](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L292)

##### pointsLedgerRoot

> **pointsLedgerRoot**: `string` \| `bigint`

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:278](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L278)

##### signupIdHash

> **signupIdHash**: `string` \| `bigint`

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:289](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L289)

##### spendRefIdHash

> **spendRefIdHash**: `string` \| `bigint`

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:290](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L290)

##### twitterCreditNullifier

> **twitterCreditNullifier**: `string` \| `bigint`

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:284](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L284)

##### wallet

> **wallet**: `string` \| `bigint`

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:282](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L282)

##### walletAddrCommit

> **walletAddrCommit**: `string` \| `bigint`

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:272](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L272)

***

### AmoeProveResult

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:303](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L303)

#### Properties

##### proof

> **proof**: `bigint`[]

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:306](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L306)

24-element PLONK proof, scalars in `[0, Q)`. Suitable as input to
 `buildAmoeEntryZKCall`.

##### pubInputs

> **pubInputs**: `bigint`[]

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:309](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L309)

8-element public-input array, in the slot order pinned by
 `AMOE_PLONK_PUB_INPUT_SLOT`.

***

### ParsedPlonkCallData

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:117](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L117)

Result of parsing snarkjs's solidity-calldata string for a PLONK proof.
Both arrays carry BN254 scalars in `[0, Q)` (the parser enforces this).

`proof` is fixed-length 24 (the on-chain verifier signature).
`pubInputs` is variable-length here on purpose — callers that target
`submitAmoeEntryZK` must additionally check `length === 8`. Decoupling
lets us reuse this parser for any future verifier (e.g. a different
circuit) without changing the parse code.

#### Properties

##### proof

> **proof**: `bigint`[]

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:118](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L118)

##### pubInputs

> **pubInputs**: `bigint`[]

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:119](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L119)

***

### ProveAmoeEntryPlonkOptions

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:312](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L312)

#### Properties

##### snarkjs?

> `optional` **snarkjs**: [`SnarkjsLike`](#snarkjslike)

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:332](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L332)

Optional snarkjs override — primarily for tests that want to inject a
deterministic mock. Production callers leave this unset.

##### wasmPath

> **wasmPath**: `string`

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:319](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L319)

Filesystem path to the circuit's compiled `amoe_eligibility.wasm`. In
production this is fetched/cached from object storage on cold start
(see #403 §2 — zkey hosting workstream). In tests we point at the
checked-in fixture wasm.

##### zkeyPath

> **zkeyPath**: `string`

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:326](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L326)

Filesystem path to the PLONK final zkey (`amoe_plonk_final.zkey`). Same
sourcing as `wasmPath` — production fetches from blob storage; tests
use the small checked-in fixture zkey.

***

### SnarkjsLike

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:340](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L340)

Minimal snarkjs surface this module depends on. Defining it as a named
interface (a) lets us tree-shake the rest of the snarkjs API and (b)
makes mocking in tests trivial without `vi.mock(...)` ESM gymnastics.

#### Properties

##### plonk

> **plonk**: `object`

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:341](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L341)

###### exportSolidityCallData()

> **exportSolidityCallData**: (`proof`, `publicSignals`) => `Promise`\<`string`\>

###### Parameters

###### proof

`unknown`

###### publicSignals

`unknown`

###### Returns

`Promise`\<`string`\>

###### fullProve()

> **fullProve**: (`input`, `wasmPath`, `zkeyPath`) => `Promise`\<\{ `proof`: `unknown`; `publicSignals`: `unknown`; \}\>

###### Parameters

###### input

`Record`\<`string`, `unknown`\>

###### wasmPath

`string`

###### zkeyPath

`string`

###### Returns

`Promise`\<\{ `proof`: `unknown`; `publicSignals`: `unknown`; \}\>

## Type Aliases

### AmoeProofGenerationErrorCode

> **AmoeProofGenerationErrorCode** = `"plonk_calldata_parse_failed"` \| `"plonk_calldata_proof_length_mismatch"` \| `"plonk_calldata_pubinputs_length_mismatch"` \| `"plonk_calldata_scalar_not_hex"` \| `"plonk_calldata_scalar_out_of_field"` \| `"plonk_witness_input_missing"` \| `"plonk_witness_input_invalid"` \| `"plonk_snarkjs_failed"`

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:81](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L81)

Stable error codes thrown by this module. Keep this in sync with the
documented contract in [proveAmoeEntryPlonk](#proveamoeentryplonk) — relayer retry logic
branches on these codes, so removing or renaming one is a breaking change.

## Variables

### AMOE\_MERKLE\_DEPTH

> `const` **AMOE\_MERKLE\_DEPTH**: `20`

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:301](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L301)

Locked Merkle-tree depth of both the allowlist and the points-burn
ledger. Mirrors `DEPTH` in the .circom file. Bumping this without
regenerating the circuit will cause snarkjs to emit an "Assert Failed"
error when it walks the path arrays.

## Functions

### parsePlonkSolidityCallData()

> **parsePlonkSolidityCallData**(`raw`): [`ParsedPlonkCallData`](#parsedplonkcalldata)

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:155](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L155)

Parse a snarkjs PLONK solidity-calldata string into typed scalar arrays.

INPUT FORMAT (snarkjs ≥ 0.7.x, PLONK):
  `["0x..","0x..", ... 24 entries ...]["0x..","0x..", ... N entries ...]`

  Two top-level JSON arrays concatenated with no separator. The first is
  the 24-element proof; the second is the public-signals array (length =
  circuit's `nPublic`, which is 8 for AMOE eligibility v2).

What this function VALIDATES:
  1. The string contains exactly 24 hex scalars in the proof position
     (anything else throws `plonk_calldata_proof_length_mismatch`).
  2. Every hex scalar parses as a valid BN254 scalar (i.e. is in
     `[0, Q)`). Anything ≥ Q throws `plonk_calldata_scalar_out_of_field`.
  3. The string contains at least one trailing public-signal scalar
     (caller decides on exact count for their verifier).

What this function does NOT do:
  * Verify the proof is valid (that's the on-chain verifier's job).
  * Constrain `pubInputs.length` to 8 (caller's job — see the
    `_assertPubInputsLength` helper used by [proveAmoeEntryPlonk](#proveamoeentryplonk)).

#### Parameters

##### raw

`string`

#### Returns

[`ParsedPlonkCallData`](#parsedplonkcalldata)

#### Throws

on any structural / field-bounds violation

***

### proveAmoeEntryPlonk()

> **proveAmoeEntryPlonk**(`witness`, `opts`): `Promise`\<[`AmoeProveResult`](#amoeproveresult)\>

Defined in: [server/\_lib/lottery/proveAmoeEntryPlonk.ts:376](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/proveAmoeEntryPlonk.ts#L376)

Generate a PLONK proof for the AMOE eligibility circuit and return it in
the (proof[24], pubInputs[8]) shape the on-chain `submitAmoeEntryZK`
verifier consumes.

This function is a *thin* wrapper. It does not:
  * Build the witness — caller is responsible for computing every input
    signal listed on [AmoeEligibilityWitness](#amoeeligibilitywitness). Witness construction
    (Poseidon hashes, Merkle paths) is the next workstream in #403 §2.
  * Submit the proof on-chain — caller hands the result to
    buildAmoeEntryZKCall and broadcasts the resulting calldata.

It DOES:
  * Normalize witness values to snarkjs-friendly decimal strings.
  * Length-check the Merkle-path arrays (DEPTH=20).
  * Run snarkjs PLONK fullProve.
  * Parse `exportSolidityCallData` back into typed scalar arrays.
  * Verify both arrays come back in the expected lengths and field bounds.

Errors are typed via [AmoeProofGenerationError](#amoeproofgenerationerror) with stable codes —
relayer retry logic should branch on `error.code`, not `error.message`.

#### Parameters

##### witness

[`AmoeEligibilityWitness`](#amoeeligibilitywitness)

##### opts

[`ProveAmoeEntryPlonkOptions`](#proveamoeentryplonkoptions)

#### Returns

`Promise`\<[`AmoeProveResult`](#amoeproveresult)\>
