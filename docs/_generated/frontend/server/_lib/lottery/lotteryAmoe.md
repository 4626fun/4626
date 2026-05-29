[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lottery/lotteryAmoe

# server/\_lib/lottery/lotteryAmoe

## Interfaces

### AmoeZKBuildInputs

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1457](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1457)

#### Properties

##### creatorCoin

> **creatorCoin**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1461](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1461)

The creator coin the entry is for. MUST equal pubInputs[1] when masked to uint160.

##### epoch

> **epoch**: `number` \| `bigint`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1463](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1463)

Lottery epoch. MUST equal pubInputs[3].

##### lotteryAmoeRouter

> **lotteryAmoeRouter**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1477](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1477)

Address of the deployed `LotteryAmoeRouter`.

##### proof

> **proof**: readonly (`string` \| `number` \| `bigint`)[]

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1469](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1469)

The 24-element PLONK proof emitted by
`snarkjs zkey export solidityverifier`. Each element is a BN254 field
scalar in [0, Q).

##### pubInputs

> **pubInputs**: readonly (`string` \| `number` \| `bigint`)[]

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1475](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1475)

The 8 PLONK public inputs in the slot layout pinned by
`AMOE_PLONK_PUB_INPUT_SLOT`. Each element is a BN254 field scalar
in [0, Q).

##### wallet

> **wallet**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1459](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1459)

The buyer (already verified via signed message off-chain).

***

### AmoeZKBuildResult

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1480](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1480)

#### Properties

##### callData

> **callData**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1484](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1484)

ABI-encoded calldata for `submitAmoeEntryZK`.

##### estimatedWinChancePPM

> **estimatedWinChancePPM**: `number`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1488](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1488)

UI win-chance preview, derived from pubInputs[5] (PPM).

##### pointsBurnedAsUSD

> **pointsBurnedAsUSD**: `string`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1486](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1486)

USD-1e6 value the proof binds. Pulled from pubInputs[5] for convenience.

##### to

> **to**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1482](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1482)

Target address — the LotteryAmoeRouter.

## Type Aliases

### AmoeMessageFields

> **AmoeMessageFields** = `object`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:981](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L981)

#### Properties

##### chainId

> **chainId**: `number`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:987](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L987)

##### creatorCoin

> **creatorCoin**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:983](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L983)

##### expiresAt

> **expiresAt**: `string`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:986](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L986)

##### issuedAt

> **issuedAt**: `string`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:985](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L985)

##### lotteryManager

> **lotteryManager**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:988](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L988)

##### nonce

> **nonce**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:984](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L984)

##### wallet

> **wallet**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:982](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L982)

## Variables

### AMOE\_BN254\_SCALAR\_FIELD\_Q

> `const` **AMOE\_BN254\_SCALAR\_FIELD\_Q**: `21888242871839275222246405745257275088548364400416034343698204186575808495617n` = `21888242871839275222246405745257275088548364400416034343698204186575808495617n`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:79](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L79)

***

### AMOE\_CREDITS\_PER\_ENTRY

> `const` **AMOE\_CREDITS\_PER\_ENTRY**: `100` = `100`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L36)

***

### AMOE\_DAILY\_TWITTER\_CREDIT

> `const` **AMOE\_DAILY\_TWITTER\_CREDIT**: `1` = `1`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L37)

***

### AMOE\_DAILY\_XMTP\_CREDIT

> `const` **AMOE\_DAILY\_XMTP\_CREDIT**: `1` = `1`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L38)

***

### AMOE\_MAX\_POINTS\_AS\_USD

> `const` **AMOE\_MAX\_POINTS\_AS\_USD**: `bigint`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:88](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L88)

***

### AMOE\_MAX\_POINTS\_PER\_SUBMISSION

> `const` **AMOE\_MAX\_POINTS\_PER\_SUBMISSION**: `1000000` = `1_000_000`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L50)

***

### AMOE\_MIN\_POINTS\_PER\_SUBMISSION

> `const` **AMOE\_MIN\_POINTS\_PER\_SUBMISSION**: `100` = `100`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L49)

***

### AMOE\_PLONK\_PROOF\_LEN

> `const` **AMOE\_PLONK\_PROOF\_LEN**: `24`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:62](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L62)

***

### AMOE\_PLONK\_PUB\_INPUT\_SLOT

> `const` **AMOE\_PLONK\_PUB\_INPUT\_SLOT**: `object`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:64](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L64)

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

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:63](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L63)

***

### AMOE\_POINTS\_TO\_USD1E6\_FACTOR

> `const` **AMOE\_POINTS\_TO\_USD1E6\_FACTOR**: `10000` = `10_000`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L51)

## Functions

### buildAmoeEntryMessage()

> **buildAmoeEntryMessage**(`fields`): `string`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:991](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L991)

#### Parameters

##### fields

[`AmoeMessageFields`](#amoemessagefields)

#### Returns

`string`

***

### buildAmoeEntryZKCall()

> **buildAmoeEntryZKCall**(`inputs`): `Promise`\<[`AmoeZKBuildResult`](#amoezkbuildresult)\>

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1521](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1521)

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

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1373](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1373)

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

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:546](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L546)

#### Parameters

##### params

###### verifiedTweet

\{ `authorId`: `string` \| `null`; `authorUsername`: `string` \| `null`; `tweetId`: `string`; `tweetUrl`: `string`; \}

###### verifiedTweet.authorId

`string` \| `null`

###### verifiedTweet.authorUsername

`string` \| `null`

###### verifiedTweet.tweetId

`string`

###### verifiedTweet.tweetUrl

`string`

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `awarded`: `boolean`; `awardedCredits`: `number`; `credits`: `number`; `creditsPerEntry`: `number`; `entriesAvailable`: `number`; `wallet`: `` `0x${string}` ``; \}\>

***

### claimDailyXmtpCheckin()

> **claimDailyXmtpCheckin**(`params`): `Promise`\<\{ `awarded`: `boolean`; `awardedCredits`: `number`; `credits`: `number`; `creditsPerEntry`: `number`; `entriesAvailable`: `number`; `wallet`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:658](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L658)

#### Parameters

##### params

###### evidence

\{ `messageId`: `string`; `recipientAddress`: `` `0x${string}` ``; \}

###### evidence.messageId

`string`

###### evidence.recipientAddress

`` `0x${string}` ``

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `awarded`: `boolean`; `awardedCredits`: `number`; `credits`: `number`; `creditsPerEntry`: `number`; `entriesAvailable`: `number`; `wallet`: `` `0x${string}` ``; \}\>

***

### consumeAmoeCreditsForEntry()

> **consumeAmoeCreditsForEntry**(`params`): `Promise`\<\{ `burnedAt`: `string`; `burnEpoch`: `string`; `consumed`: `number`; `creditsPerEntry`: `number`; `creditsRemaining`: `number`; `entriesAvailable`: `number`; `signupId`: `number` \| `null`; `spendRefId`: `string`; `wallet`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:758](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L758)

#### Parameters

##### params

###### refId?

`string`

###### requiredCredits?

`number`

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `burnedAt`: `string`; `burnEpoch`: `string`; `consumed`: `number`; `creditsPerEntry`: `number`; `creditsRemaining`: `number`; `entriesAvailable`: `number`; `signupId`: `number` \| `null`; `spendRefId`: `string`; `wallet`: `` `0x${string}` ``; \}\>

***

### createAmoeAttestation()

> **createAmoeAttestation**(`params`): `Promise`\<\{ `buyer`: `` `0x${string}` ``; `callData`: `` `0x${string}` ``; `creatorCoin`: `` `0x${string}` ``; `deadline`: `number`; `nonce`: `` `0x${string}` ``; `signature`: `` `0x${string}` ``; `to`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1248](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1248)

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

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:118](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L118)

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

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:524](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L524)

#### Parameters

##### params

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `credits`: `number`; `creditsPerEntry`: `number`; `entriesAvailable`: `number`; `nextEntryAtCredits`: `number`; `wallet`: `` `0x${string}` ``; \}\>

***

### issueAmoeNonce()

> **issueAmoeNonce**(`params`): `Promise`\<\{ `expiresAt`: `string`; `issuedAt`: `string`; `nonce`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1041](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1041)

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

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1005](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1005)

#### Parameters

##### message

`string`

#### Returns

[`AmoeMessageFields`](#amoemessagefields) \| `null`

***

### pointsToUsd1e6()

> **pointsToUsd1e6**(`points`): `bigint`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:96](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L96)

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

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1209](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1209)

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

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:1091](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L1091)

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
