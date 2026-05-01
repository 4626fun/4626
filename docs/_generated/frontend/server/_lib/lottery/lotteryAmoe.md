[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/lottery/lotteryAmoe

# server/\_lib/lottery/lotteryAmoe

## Interfaces

### AmoeZKBuildInputs

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1237](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1237)

#### Properties

##### creatorCoin

> **creatorCoin**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1241](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1241)

The creator coin the entry is for. MUST equal pubInputs[1] when masked to uint160.

##### epoch

> **epoch**: `number` \| `bigint`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1243](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1243)

Lottery epoch. MUST equal pubInputs[3].

##### lotteryAmoeRouter

> **lotteryAmoeRouter**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1257](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1257)

Address of the deployed `LotteryAmoeRouter`.

##### proof

> **proof**: readonly (`string` \| `number` \| `bigint`)[]

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1249](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1249)

The 24-element PLONK proof emitted by
`snarkjs zkey export solidityverifier`. Each element is a BN254 field
scalar in [0, Q).

##### pubInputs

> **pubInputs**: readonly (`string` \| `number` \| `bigint`)[]

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1255](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1255)

The 8 PLONK public inputs in the slot layout pinned by
`AMOE_PLONK_PUB_INPUT_SLOT`. Each element is a BN254 field scalar
in [0, Q).

##### wallet

> **wallet**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1239](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1239)

The buyer (already verified via signed message off-chain).

***

### AmoeZKBuildResult

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1260](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1260)

#### Properties

##### callData

> **callData**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1264](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1264)

ABI-encoded calldata for `submitAmoeEntryZK`.

##### estimatedWinChancePPM

> **estimatedWinChancePPM**: `number`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1268](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1268)

UI win-chance preview, derived from pubInputs[5] (PPM).

##### pointsBurnedAsUSD

> **pointsBurnedAsUSD**: `string`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1266](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1266)

USD-1e6 value the proof binds. Pulled from pubInputs[5] for convenience.

##### to

> **to**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1262](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1262)

Target address — the LotteryAmoeRouter.

## Type Aliases

### AmoeMessageFields

> **AmoeMessageFields** = `object`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:761](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L761)

#### Properties

##### chainId

> **chainId**: `number`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:767](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L767)

##### creatorCoin

> **creatorCoin**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:763](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L763)

##### expiresAt

> **expiresAt**: `string`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:766](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L766)

##### issuedAt

> **issuedAt**: `string`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:765](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L765)

##### lotteryManager

> **lotteryManager**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:768](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L768)

##### nonce

> **nonce**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:764](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L764)

##### wallet

> **wallet**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:762](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L762)

## Variables

### AMOE\_BN254\_SCALAR\_FIELD\_Q

> `const` **AMOE\_BN254\_SCALAR\_FIELD\_Q**: `21888242871839275222246405745257275088548364400416034343698204186575808495617n` = `21888242871839275222246405745257275088548364400416034343698204186575808495617n`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:76](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L76)

***

### AMOE\_CREDITS\_PER\_ENTRY

> `const` **AMOE\_CREDITS\_PER\_ENTRY**: `100` = `100`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L34)

***

### AMOE\_DAILY\_TWITTER\_CREDIT

> `const` **AMOE\_DAILY\_TWITTER\_CREDIT**: `1` = `1`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L35)

***

### AMOE\_MAX\_POINTS\_AS\_USD

> `const` **AMOE\_MAX\_POINTS\_AS\_USD**: `bigint`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:85](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L85)

***

### AMOE\_MAX\_POINTS\_PER\_SUBMISSION

> `const` **AMOE\_MAX\_POINTS\_PER\_SUBMISSION**: `1000000` = `1_000_000`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L47)

***

### AMOE\_MIN\_POINTS\_PER\_SUBMISSION

> `const` **AMOE\_MIN\_POINTS\_PER\_SUBMISSION**: `100` = `100`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L46)

***

### AMOE\_PLONK\_PROOF\_LEN

> `const` **AMOE\_PLONK\_PROOF\_LEN**: `24`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:59](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L59)

***

### AMOE\_PLONK\_PUB\_INPUT\_SLOT

> `const` **AMOE\_PLONK\_PUB\_INPUT\_SLOT**: `object`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:61](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L61)

#### Type Declaration

##### allowlistRoot

> `readonly` **allowlistRoot**: `4` = `4`

##### creatorCoinAddr

> `readonly` **creatorCoinAddr**: `1` = `1`

##### epoch

> `readonly` **epoch**: `3` = `3`

##### nonceCommit

> `readonly` **nonceCommit**: `2` = `2`

##### pointsBurnedAsUSD

> `readonly` **pointsBurnedAsUSD**: `5` = `5`

##### pointsBurnNullifier

> `readonly` **pointsBurnNullifier**: `7` = `7`

##### pointsLedgerRoot

> `readonly` **pointsLedgerRoot**: `6` = `6`

##### walletAddrCommit

> `readonly` **walletAddrCommit**: `0` = `0`

***

### AMOE\_PLONK\_PUB\_INPUTS\_LEN

> `const` **AMOE\_PLONK\_PUB\_INPUTS\_LEN**: `8`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:60](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L60)

***

### AMOE\_POINTS\_TO\_USD1E6\_FACTOR

> `const` **AMOE\_POINTS\_TO\_USD1E6\_FACTOR**: `10000` = `10_000`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L48)

## Functions

### buildAmoeEntryMessage()

> **buildAmoeEntryMessage**(`fields`): `string`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:771](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L771)

#### Parameters

##### fields

[`AmoeMessageFields`](#amoemessagefields)

#### Returns

`string`

***

### buildAmoeEntryZKCall()

> **buildAmoeEntryZKCall**(`inputs`): `Promise`\<[`AmoeZKBuildResult`](#amoezkbuildresult)\>

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1301](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1301)

Build calldata for the PLONK ZK entry path
(`LotteryAmoeRouter.submitAmoeEntryZK`).

What this function IS:
  * A pure ABI encoder + field-bounds validator. Takes a pre-computed
    proof + public-input array and returns the on-chain calldata.
  * The narrow contract surface that the eventual proof-generation
    server will hand its output to. Decouples "have a proof" from
    "submit a proof."

What this function ISN'T:
  * A proof generator. Witness construction (Merkle paths over the
    allowlist tree and points-ledger tree, Poseidon commits, snarkjs
    PLONK prove) is downstream and lives outside this module — see
    issue #403 §2 ("Server relayer flip to ZK path") for the open
    scope.
  * A replay guard. The on-chain router maintains the global nullifier
    map (`usedPointsBurnNullifier`); the relayer is expected to also
    skip submission when it sees a previously-used nullifier (also
    tracked in the same issue).

Trust model: the on-chain `LotteryAmoeRouter` re-checks every input
against `AmoePlonkVerifier` and the per-epoch root maps; this builder
is purely client-side. A malformed proof produced here will be
rejected on-chain.

#### Parameters

##### inputs

[`AmoeZKBuildInputs`](#amoezkbuildinputs)

#### Returns

`Promise`\<[`AmoeZKBuildResult`](#amoezkbuildresult)\>

#### Throws

AmoeBadRequestError if the proof or pubInputs arrays have the
        wrong length or contain non-canonical encodings.

***

### buildProcessAmoeEntryCall()

> **buildProcessAmoeEntryCall**(`params`): `Promise`\<\{ `callData`: `` `0x${string}` ``; `estimatedWinChancePPM`: `number`; `pointsBurned`: `number`; `pointsBurnedAsUSD`: `string`; `to`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1153](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1153)

Build the calldata for a relayer-mode AMOE entry that targets PR 1's
`CreatorLotteryManager.processAmoeEntry(buyer, creatorCoin, pointsBurnedAsUSD)`.

Unlike `createAmoeAttestation` (which produced an ECDSA-signed payload
for `LotteryAmoeRouter.submitAmoeEntry`), this path has no on-chain
signature verification — the on-chain function is gated to a single
relayer-key allowlist. The user-signed message remains the off-chain
authorization + anti-replay artifact (verified via `verifyAmoeEntryProof`)
but is NOT included in the on-chain call.

Trust assumption (PR 2): the relayer key is fully trusted to bind
`pointsBurned` honestly. PR 4 will move that binding into a zkMetal
Groth16 public input. See docs/security/amoe-pr1-handoff.md and the
companion PR 2 handoff for the full model.

#### Parameters

##### params

###### creatorCoin

`` `0x${string}` ``

The creator coin the entry is for.

###### lotteryManager

`` `0x${string}` ``

Address of the deployed CreatorLotteryManager.

###### pointsBurned

`number`

Points being burned (must be in [MIN, MAX]).

###### wallet

`` `0x${string}` ``

The buyer (already verified via signed message).

#### Returns

`Promise`\<\{ `callData`: `` `0x${string}` ``; `estimatedWinChancePPM`: `number`; `pointsBurned`: `number`; `pointsBurnedAsUSD`: `string`; `to`: `` `0x${string}` ``; \}\>

The transaction calldata + target address for the relayer to send.

***

### claimDailyTwitterCheckin()

> **claimDailyTwitterCheckin**(`params`): `Promise`\<\{ `awarded`: `boolean`; `awardedCredits`: `number`; `credits`: `number`; `creditsPerEntry`: `number`; `entriesAvailable`: `number`; `wallet`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:553](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L553)

#### Parameters

##### params

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `awarded`: `boolean`; `awardedCredits`: `number`; `credits`: `number`; `creditsPerEntry`: `number`; `entriesAvailable`: `number`; `wallet`: `` `0x${string}` ``; \}\>

***

### consumeAmoeCreditsForEntry()

> **consumeAmoeCreditsForEntry**(`params`): `Promise`\<\{ `burnedAt`: `string`; `burnEpoch`: `string`; `consumed`: `number`; `creditsPerEntry`: `number`; `creditsRemaining`: `number`; `entriesAvailable`: `number`; `wallet`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:624](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L624)

#### Parameters

##### params

###### refId?

`string`

###### requiredCredits?

`number`

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `burnedAt`: `string`; `burnEpoch`: `string`; `consumed`: `number`; `creditsPerEntry`: `number`; `creditsRemaining`: `number`; `entriesAvailable`: `number`; `wallet`: `` `0x${string}` ``; \}\>

***

### createAmoeAttestation()

> **createAmoeAttestation**(`params`): `Promise`\<\{ `buyer`: `` `0x${string}` ``; `callData`: `` `0x${string}` ``; `creatorCoin`: `` `0x${string}` ``; `deadline`: `number`; `nonce`: `` `0x${string}` ``; `signature`: `` `0x${string}` ``; `to`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1028](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1028)

#### Parameters

##### params

###### creatorCoin

`` `0x${string}` ``

###### expiresAt

`string`

###### lotteryManager

`` `0x${string}` ``

###### nonce

`` `0x${string}` ``

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `buyer`: `` `0x${string}` ``; `callData`: `` `0x${string}` ``; `creatorCoin`: `` `0x${string}` ``; `deadline`: `number`; `nonce`: `` `0x${string}` ``; `signature`: `` `0x${string}` ``; `to`: `` `0x${string}` ``; \}\>

***

### estimateWinChancePPM()

> **estimateWinChancePPM**(`usd1e6`): `number`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:115](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L115)

Estimate the pre-boost win chance (PPM) for a given USD value. Mirrors
`CreatorLotteryManager.calculateWinChance` exactly so the UI can preview
what the user is buying. The actual on-chain value is authoritative — this
is for display only.

Formula (PR 1):  winChancePPM = swapValueUSD / 250_000, capped at
`baseCeilingPPM` (40_000 PPM = 4%). Sub-floor returns 0.

#### Parameters

##### usd1e6

`bigint`

#### Returns

`number`

***

### getAmoeCreditSnapshot()

> **getAmoeCreditSnapshot**(`params`): `Promise`\<\{ `credits`: `number`; `creditsPerEntry`: `number`; `entriesAvailable`: `number`; `nextEntryAtCredits`: `number`; `wallet`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:534](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L534)

#### Parameters

##### params

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `credits`: `number`; `creditsPerEntry`: `number`; `entriesAvailable`: `number`; `nextEntryAtCredits`: `number`; `wallet`: `` `0x${string}` ``; \}\>

***

### issueAmoeNonce()

> **issueAmoeNonce**(`params`): `Promise`\<\{ `expiresAt`: `string`; `issuedAt`: `string`; `nonce`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:821](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L821)

#### Parameters

##### params

###### creatorCoin

`` `0x${string}` ``

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `expiresAt`: `string`; `issuedAt`: `string`; `nonce`: `` `0x${string}` ``; \}\>

***

### parseAmoeEntryMessage()

> **parseAmoeEntryMessage**(`message`): [`AmoeMessageFields`](#amoemessagefields) \| `null`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:785](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L785)

#### Parameters

##### message

`string`

#### Returns

[`AmoeMessageFields`](#amoemessagefields) \| `null`

***

### pointsToUsd1e6()

> **pointsToUsd1e6**(`points`): `bigint`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:93](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L93)

Convert a points-burned count to the 1e6 (USDC) USD value expected by
`CreatorLotteryManager.processAmoeEntry`. Throws if `points` is not a
positive integer in the [MIN, MAX] range — callers MUST validate before
consuming credits.

#### Parameters

##### points

`number`

#### Returns

`bigint`

***

### verifyAmoeEntryProof()

> **verifyAmoeEntryProof**(`params`): `Promise`\<\{ `creatorCoin`: `` `0x${string}` ``; `expiresAt`: `string`; `nonce`: `` `0x${string}` ``; `wallet`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:989](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L989)

#### Parameters

##### params

###### creatorCoin

`` `0x${string}` ``

###### lotteryManager

`` `0x${string}` ``

###### message

`string`

###### signature

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `creatorCoin`: `` `0x${string}` ``; `expiresAt`: `string`; `nonce`: `` `0x${string}` ``; `wallet`: `` `0x${string}` ``; \}\>

***

### verifyAmoeWalletSignature()

> **verifyAmoeWalletSignature**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:871](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L871)

Verify a personal_sign / EIP-191 signature against a wallet, with
EIP-1271 fallback for smart wallets (Coinbase Smart Wallet owner-index
scan included).

Exported under `verifyAmoeWalletSignature` for the ZK submit path
(PR 3) which needs the same wallet-sig check but NOT the EIP-191
message parsing inside `verifyAmoeEntryProof`. Local callers continue
to use the unprefixed name.

#### Parameters

##### params

###### message

`string`

###### signature

`` `0x${string}` ``

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<`boolean`\>
