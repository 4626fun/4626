[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/deploy/shareBridgeOftWiring

# src/lib/deploy/shareBridgeOftWiring

## Classes

### ShareBridgeOftWiringError

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:51](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L51)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new ShareBridgeOftWiringError**(`code`, `message`): [`ShareBridgeOftWiringError`](#sharebridgeoftwiringerror)

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:59](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L59)

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

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L52)

## Type Aliases

### ShareBridgeOftWiringStatus

> **ShareBridgeOftWiringStatus** = `object`

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:39](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L39)

#### Properties

##### batcherDefaultPeer

> **batcherDefaultPeer**: `Hex` \| `null`

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:44](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L44)

##### bridgeRequired

> **bridgeRequired**: `boolean`

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:40](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L40)

##### destination

> **destination**: `Hex`

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L42)

##### effectivePeer

> **effectivePeer**: `Hex` \| `null`

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:45](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L45)

##### registryPeer

> **registryPeer**: `Hex` \| `null`

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:43](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L43)

##### registryPeerConfigured

> **registryPeerConfigured**: `boolean`

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:47](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L47)

##### shareOftPeer

> **shareOftPeer**: `Hex` \| `null`

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L46)

##### shareOftPeerConfigured

> **shareOftPeerConfigured**: `boolean`

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:48](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L48)

##### solanaEid

> **solanaEid**: `number`

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:41](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L41)

## Functions

### assertShareBridgeOftWiringForFinalize()

> **assertShareBridgeOftWiringForFinalize**(`params`): `Promise`\<`void`\>

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:152](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L152)

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

`Promise`\<`void`\>

***

### readShareBridgeOftWiringStatus()

> **readShareBridgeOftWiringStatus**(`params`): `Promise`\<[`FinalizeShareBridgeQuoteError`](finalizeShareBridgeFee.md#finalizesharebridgequoteerror) \| [`ShareBridgeOftWiringStatus`](#sharebridgeoftwiringstatus)\>

Defined in: [src/lib/deploy/shareBridgeOftWiring.ts:74](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/shareBridgeOftWiring.ts#L74)

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

`Promise`\<[`FinalizeShareBridgeQuoteError`](finalizeShareBridgeFee.md#finalizesharebridgequoteerror) \| [`ShareBridgeOftWiringStatus`](#sharebridgeoftwiringstatus)\>
