[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/deploy/shareBridgeReadClient

# src/lib/deploy/shareBridgeReadClient

## Type Aliases

### ShareBridgeReadClient

> **ShareBridgeReadClient** = `object`

Defined in: [src/lib/deploy/shareBridgeReadClient.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/shareBridgeReadClient.ts#L4)

Narrow read surface for ShareOFT bridge fee helpers (mock-friendly in tests).

#### Properties

##### getBytecode()?

> `optional` **getBytecode**: (`args`) => `Promise`\<`Hex` \| `undefined`\>

Defined in: [src/lib/deploy/shareBridgeReadClient.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/shareBridgeReadClient.ts#L11)

###### Parameters

###### args

###### address

`Address`

###### Returns

`Promise`\<`Hex` \| `undefined`\>

#### Methods

##### readContract()

> **readContract**(`args`): `Promise`\<`unknown`\>

Defined in: [src/lib/deploy/shareBridgeReadClient.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/shareBridgeReadClient.ts#L5)

###### Parameters

###### args

###### abi

readonly `unknown`[]

###### address

`Address`

###### args?

readonly `unknown`[]

###### functionName

`string`

###### Returns

`Promise`\<`unknown`\>
