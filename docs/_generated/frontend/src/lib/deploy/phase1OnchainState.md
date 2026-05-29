[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/deploy/phase1OnchainState

# src/lib/deploy/phase1OnchainState

## Type Aliases

### Phase1SplitState

> **Phase1SplitState** = `object`

Defined in: [src/lib/deploy/phase1OnchainState.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/phase1OnchainState.ts#L27)

#### Properties

##### coreDone

> **coreDone**: `boolean`

Defined in: [src/lib/deploy/phase1OnchainState.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/phase1OnchainState.ts#L31)

##### finalized

> **finalized**: `boolean`

Defined in: [src/lib/deploy/phase1OnchainState.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/phase1OnchainState.ts#L32)

##### shareOFT

> **shareOFT**: `Address` \| `null`

Defined in: [src/lib/deploy/phase1OnchainState.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/phase1OnchainState.ts#L30)

##### vault

> **vault**: `Address` \| `null`

Defined in: [src/lib/deploy/phase1OnchainState.ts:28](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/phase1OnchainState.ts#L28)

##### wrapper

> **wrapper**: `Address` \| `null`

Defined in: [src/lib/deploy/phase1OnchainState.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/phase1OnchainState.ts#L29)

## Variables

### BATCHER\_PHASE1\_SPLIT\_STATE\_ABI

> `const` **BATCHER\_PHASE1\_SPLIT\_STATE\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `name`: `"baseSalt"`; `type`: `"bytes32"`; \}\]; `name`: `"phase1SplitStates"`; `outputs`: readonly \[\{ `name`: `"oftBootstrapRegistry"`; `type`: `"address"`; \}, \{ `name`: `"vault"`; `type`: `"address"`; \}, \{ `name`: `"wrapper"`; `type`: `"address"`; \}, \{ `name`: `"shareOFT"`; `type`: `"address"`; \}, \{ `name`: `"shareOftSalt"`; `type`: `"bytes32"`; \}, \{ `name`: `"paramsHash"`; `type`: `"bytes32"`; \}, \{ `name`: `"codeIdsHash"`; `type`: `"bytes32"`; \}, \{ `name`: `"coreDone"`; `type`: `"bool"`; \}, \{ `name`: `"finalized"`; `type`: `"bool"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [src/lib/deploy/phase1OnchainState.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/phase1OnchainState.ts#L7)

## Functions

### mergePipeAFinalizeParams()

> **mergePipeAFinalizeParams**(`predicted`, `onChain`): [`FinalizePhase2Params`](finalizeShareBridgeFee.md#finalizephase2params)

Defined in: [src/lib/deploy/phase1OnchainState.ts:118](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/phase1OnchainState.ts#L118)

#### Parameters

##### predicted

[`FinalizePhase2Params`](finalizeShareBridgeFee.md#finalizephase2params)

##### onChain

\{ `shareOFT?`: `string` \| `null`; `vault?`: `string` \| `null`; `wrapper?`: `string` \| `null`; \} | `null` | `undefined`

#### Returns

[`FinalizePhase2Params`](finalizeShareBridgeFee.md#finalizephase2params)

***

### parsePhase1SplitState()

> **parsePhase1SplitState**(`raw`): [`Phase1SplitState`](#phase1splitstate)

Defined in: [src/lib/deploy/phase1OnchainState.ts:58](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/phase1OnchainState.ts#L58)

#### Parameters

##### raw

`unknown`

#### Returns

[`Phase1SplitState`](#phase1splitstate)

***

### readDeployedPhase1CoreAddresses()

> **readDeployedPhase1CoreAddresses**(`params`): `Promise`\<\{ `shareOFT`: `string` \| `null`; `state`: [`Phase1SplitState`](#phase1splitstate); `vault`: `string` \| `null`; `wrapper`: `string` \| `null`; \}\>

Defined in: [src/lib/deploy/phase1OnchainState.ts:89](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/phase1OnchainState.ts#L89)

Vault/wrapper/shareOFT only when batcher marks core done and bytecode exists.

#### Parameters

##### params

###### baseSalt

`` `0x${string}` ``

###### batcherAddress

`string`

###### publicClient

`Phase1ReadClient`

#### Returns

`Promise`\<\{ `shareOFT`: `string` \| `null`; `state`: [`Phase1SplitState`](#phase1splitstate); `vault`: `string` \| `null`; `wrapper`: `string` \| `null`; \}\>

***

### readPhase1SplitState()

> **readPhase1SplitState**(`params`): `Promise`\<[`Phase1SplitState`](#phase1splitstate)\>

Defined in: [src/lib/deploy/phase1OnchainState.ts:74](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/phase1OnchainState.ts#L74)

#### Parameters

##### params

###### baseSalt

`` `0x${string}` ``

###### batcherAddress

`string`

###### publicClient

`Phase1ReadClient`

#### Returns

`Promise`\<[`Phase1SplitState`](#phase1splitstate)\>
