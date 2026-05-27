[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/deploy/shareBridgeOftWiring

# src/lib/deploy/shareBridgeOftWiring

## Classes

### ShareBridgeOftWiringError

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:48](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L48)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new ShareBridgeOftWiringError**(`code`, `message`): [`ShareBridgeOftWiringError`](#sharebridgeoftwiringerror)

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:56](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L56)

###### Parameters

###### code

`"finalize_decode_failed"` | `"bridge_not_configured"` | `"oft_peer_not_configured"` | `"quote_failed"` | `"share_oft_peer_mismatch"`

###### message

`string`

###### Returns

[`ShareBridgeOftWiringError`](#sharebridgeoftwiringerror)

###### Overrides

`Error.constructor`

#### Properties

##### code

> `readonly` **code**: `"finalize_decode_failed"` \| `"bridge_not_configured"` \| `"oft_peer_not_configured"` \| `"quote_failed"` \| `"share_oft_peer_mismatch"`

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:49](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L49)

## Type Aliases

### ShareBridgeOftWiringStatus

> **ShareBridgeOftWiringStatus** = `object`

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:36](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L36)

#### Properties

##### batcherDefaultPeer

> **batcherDefaultPeer**: `Hex` \| `null`

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:41](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L41)

##### bridgeRequired

> **bridgeRequired**: `boolean`

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:37](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L37)

##### destination

> **destination**: `Hex`

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:39](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L39)

##### effectivePeer

> **effectivePeer**: `Hex` \| `null`

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:42](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L42)

##### registryPeer

> **registryPeer**: `Hex` \| `null`

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:40](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L40)

##### registryPeerConfigured

> **registryPeerConfigured**: `boolean`

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:44](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L44)

##### shareOftPeer

> **shareOftPeer**: `Hex` \| `null`

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:43](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L43)

##### shareOftPeerConfigured

> **shareOftPeerConfigured**: `boolean`

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:45](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L45)

##### solanaEid

> **solanaEid**: `number`

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L38)

## Functions

### assertShareBridgeOftWiringForFinalize()

> **assertShareBridgeOftWiringForFinalize**(`params`): `Promise`\<`void`\>

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:149](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L149)

#### Parameters

##### params

###### batcherAddress

`string`

###### finalizeCallData

`` `0x${string}` ``

###### publicClient

`Pick`\<`PublicClient`, `"readContract"`\>

###### registryAddress?

`string`

#### Returns

`Promise`\<`void`\>

***

### readShareBridgeOftWiringStatus()

> **readShareBridgeOftWiringStatus**(`params`): `Promise`\<[`FinalizeShareBridgeQuoteError`](finalizeShareBridgeFee.md#finalizesharebridgequoteerror) \| [`ShareBridgeOftWiringStatus`](#sharebridgeoftwiringstatus)\>

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:71](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L71)

#### Parameters

##### params

###### batcherAddress

`string`

###### finalizeCallData

`` `0x${string}` ``

###### publicClient

`Pick`\<`PublicClient`, `"readContract"`\>

###### registryAddress?

`string`

#### Returns

`Promise`\<[`FinalizeShareBridgeQuoteError`](finalizeShareBridgeFee.md#finalizesharebridgequoteerror) \| [`ShareBridgeOftWiringStatus`](#sharebridgeoftwiringstatus)\>
