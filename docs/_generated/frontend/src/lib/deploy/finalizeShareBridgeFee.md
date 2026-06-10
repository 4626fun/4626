[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/deploy/finalizeShareBridgeFee

# src/lib/deploy/finalizeShareBridgeFee

## Type Aliases

### DeploySessionStyleCall

> **DeploySessionStyleCall** = `object`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:862](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L862)

#### Properties

##### data

> **data**: `Hex`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:865](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L865)

##### to

> **to**: `Address` \| `string`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:863](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L863)

##### value?

> `optional` **value**: `string` \| `number` \| `bigint`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:864](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L864)

***

### FinalizePhase2Params

> **FinalizePhase2Params** = `object`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:253](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L253)

#### Properties

##### auctionSteps

> **auctionSteps**: `Hex`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:266](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L266)

##### ccaStrategy

> **ccaStrategy**: `Address`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:260](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L260)

##### creatorToken

> **creatorToken**: `Address`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:254](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L254)

##### depositAmount

> **depositAmount**: `bigint`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:263](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L263)

##### floorPriceQ96

> **floorPriceQ96**: `bigint`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:265](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L265)

##### gaugeController

> **gaugeController**: `Address`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:259](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L259)

##### meteoraAlphaVault

> **meteoraAlphaVault**: `Hex`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:267](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L267)

##### oracle

> **oracle**: `Address`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:261](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L261)

##### owner

> **owner**: `Address`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:255](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L255)

##### requiredRaise

> **requiredRaise**: `bigint`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:264](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L264)

##### shareOFT

> **shareOFT**: `Address`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:258](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L258)

##### solanaIxs

> **solanaIxs**: readonly [`FinalizePhase2SolanaIx`](#finalizephase2solanaix)[]

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:268](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L268)

##### vault

> **vault**: `Address`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:256](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L256)

##### version

> **version**: `string`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:262](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L262)

##### wrapper

> **wrapper**: `Address`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:257](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L257)

***

### FinalizePhase2SolanaIx

> **FinalizePhase2SolanaIx** = `object`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:247](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L247)

#### Properties

##### data

> **data**: `Hex`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:250](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L250)

##### programId

> **programId**: `Address`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:248](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L248)

##### serializedAccounts

> **serializedAccounts**: readonly `Address`[]

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:249](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L249)

***

### FinalizeShareBridgeQuote

> **FinalizeShareBridgeQuote** = `object`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:271](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L271)

#### Properties

##### destination

> **destination**: `Hex`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:276](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L276)

##### dstEid

> **dstEid**: `number`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:275](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L275)

##### nativeFee

> **nativeFee**: `bigint`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:273](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L273)

##### required

> **required**: `boolean`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:272](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L272)

##### solanaAmount

> **solanaAmount**: `bigint`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:274](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L274)

***

### FinalizeShareBridgeQuoteError

> **FinalizeShareBridgeQuoteError** = `object`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:279](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L279)

#### Properties

##### code

> **code**: `"finalize_decode_failed"` \| `"bridge_not_configured"` \| `"oft_peer_not_configured"` \| `"deposit_amount_invalid"` \| `"share_amount_zero"` \| `"quote_failed"`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:280](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L280)

##### message

> **message**: `string`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:287](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L287)

## Variables

### FINALIZE\_SHARE\_BRIDGE\_GAS\_LIMIT

> `const` **FINALIZE\_SHARE\_BRIDGE\_GAS\_LIMIT**: `200000n` = `200_000n`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L17)

***

### FINALIZE\_SHARE\_BRIDGE\_MAX\_SURPLUS\_WEI

> `const` **FINALIZE\_SHARE\_BRIDGE\_MAX\_SURPLUS\_WEI**: `500000000000000n` = `500_000_000_000_000n`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L19)

Paymaster allows surplus above live quoteSend fee (contract refunds to owner).

***

### FINALIZE\_SHARE\_BRIDGE\_SOLANA\_PERCENT

> `const` **FINALIZE\_SHARE\_BRIDGE\_SOLANA\_PERCENT**: `30n` = `30n`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L16)

Matches DeploymentBatcherPhase2Module.SOLANA_ALLOC_PERCENT

***

### LZ\_NO\_PEER\_SELECTOR

> `const` **LZ\_NO\_PEER\_SELECTOR**: `"0xf6ff4fb7"` = `'0xf6ff4fb7'`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L24)

LayerZero OFT `NoPeer(uint32)` — greenfield ShareOFT peer is set inside finalizePhase2.

***

### SELECTOR\_BATCHER\_FINALIZE\_PHASE2

> `const` **SELECTOR\_BATCHER\_FINALIZE\_PHASE2**: `"0xbd4583fb"` = `'0xbd4583fb'`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L21)

***

### SELECTOR\_BATCHER\_FINALIZE\_PHASE2\_WITH\_PERMIT2

> `const` **SELECTOR\_BATCHER\_FINALIZE\_PHASE2\_WITH\_PERMIT2**: `"0xab56c176"` = `'0xab56c176'`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L22)

## Functions

### assertFinalizeShareBridgeCallValue()

> **assertFinalizeShareBridgeCallValue**(`params`): `Promise`\<`void`\>

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:920](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L920)

#### Parameters

##### params

###### batcherAddress

`string`

###### callData

`` `0x${string}` ``

###### publicClient

[`ShareBridgeReadClient`](shareBridgeReadClient.md#sharebridgereadclient)

###### value

`bigint`

#### Returns

`Promise`\<`void`\>

***

### attachFinalizeShareBridgeValueToCalls()

> **attachFinalizeShareBridgeValueToCalls**\<`T`\>(`params`): `Promise`\<`T`[]\>

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:868](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L868)

#### Type Parameters

##### T

`T` *extends* [`DeploySessionStyleCall`](#deploysessionstylecall)

#### Parameters

##### params

###### calls

`T`[]

###### publicClient

[`ShareBridgeReadClient`](shareBridgeReadClient.md#sharebridgereadclient)

#### Returns

`Promise`\<`T`[]\>

***

### buildFinalizePhase2CallData()

> **buildFinalizePhase2CallData**(`params`): `` `0x${string}` ``

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:614](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L614)

#### Parameters

##### params

[`FinalizePhase2Params`](#finalizephase2params)

#### Returns

`` `0x${string}` ``

***

### buildShareBridgeExecutorLzReceiveOptions()

> **buildShareBridgeExecutorLzReceiveOptions**(`gasLimit`): `` `0x${string}` ``

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:515](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L515)

#### Parameters

##### gasLimit

`bigint` = `FINALIZE_SHARE_BRIDGE_GAS_LIMIT`

#### Returns

`` `0x${string}` ``

***

### decodeFinalizePhase2Call()

> **decodeFinalizePhase2Call**(`data`): \{ `functionName`: `"finalizePhase2"` \| `"finalizePhase2WithPermit2"`; `params`: [`FinalizePhase2Params`](#finalizephase2params); \} \| `null`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:526](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L526)

#### Parameters

##### data

`` `0x${string}` ``

#### Returns

\{ `functionName`: `"finalizePhase2"` \| `"finalizePhase2WithPermit2"`; `params`: [`FinalizePhase2Params`](#finalizephase2params); \} \| `null`

***

### isLayerZeroNoPeerQuoteError()

> **isLayerZeroNoPeerQuoteError**(`error`): `boolean`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:304](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L304)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### parseCallValue()

> **parseCallValue**(`value`): `bigint`

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:849](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L849)

#### Parameters

##### value

`unknown`

#### Returns

`bigint`

***

### quoteFinalizeShareBridgeNativeFee()

> **quoteFinalizeShareBridgeNativeFee**(`params`): `Promise`\<[`FinalizeShareBridgeQuote`](#finalizesharebridgequote) \| [`FinalizeShareBridgeQuoteError`](#finalizesharebridgequoteerror)\>

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:660](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L660)

#### Parameters

##### params

###### batcherAddress

`string`

###### finalizeCallData

`` `0x${string}` ``

###### publicClient

[`ShareBridgeReadClient`](shareBridgeReadClient.md#sharebridgereadclient)

###### registryAddress?

`string`

#### Returns

`Promise`\<[`FinalizeShareBridgeQuote`](#finalizesharebridgequote) \| [`FinalizeShareBridgeQuoteError`](#finalizesharebridgequoteerror)\>

***

### readFinalizePhase2WrapperHasBytecode()

> **readFinalizePhase2WrapperHasBytecode**(`params`): `Promise`\<`boolean` \| `null`\>

Defined in: [src/lib/deploy/finalizeShareBridgeFee.ts:645](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/finalizeShareBridgeFee.ts#L645)

Returns false when wrapper address is known but has no Base bytecode yet (Phase 1 pending).

#### Parameters

##### params

###### finalizeCallData

`` `0x${string}` ``

###### publicClient

[`ShareBridgeReadClient`](shareBridgeReadClient.md#sharebridgereadclient)

#### Returns

`Promise`\<`boolean` \| `null`\>
