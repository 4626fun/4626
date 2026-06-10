[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/wallet/addOwnerCallShape

# src/lib/wallet/addOwnerCallShape

## Type Aliases

### AddOwnerTxRequestShape

> **AddOwnerTxRequestShape** = `object`

Defined in: [src/lib/wallet/addOwnerCallShape.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/addOwnerCallShape.ts#L12)

#### Properties

##### data

> **data**: `` `0x${string}` ``

Defined in: [src/lib/wallet/addOwnerCallShape.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/addOwnerCallShape.ts#L14)

##### to

> **to**: `` `0x${string}` ``

Defined in: [src/lib/wallet/addOwnerCallShape.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/addOwnerCallShape.ts#L13)

##### value?

> `optional` **value**: `string`

Defined in: [src/lib/wallet/addOwnerCallShape.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/addOwnerCallShape.ts#L15)

***

### SendCallsCallShape

> **SendCallsCallShape** = `object`

Defined in: [src/lib/wallet/addOwnerCallShape.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/addOwnerCallShape.ts#L18)

#### Properties

##### data

> **data**: `` `0x${string}` ``

Defined in: [src/lib/wallet/addOwnerCallShape.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/addOwnerCallShape.ts#L20)

##### to

> **to**: `` `0x${string}` ``

Defined in: [src/lib/wallet/addOwnerCallShape.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/addOwnerCallShape.ts#L19)

##### value?

> `optional` **value**: `bigint` \| `` `0x${string}` ``

Defined in: [src/lib/wallet/addOwnerCallShape.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/addOwnerCallShape.ts#L21)

## Variables

### RELAY\_ROUTER\_BASE

> `const` **RELAY\_ROUTER\_BASE**: `"0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f"`

Defined in: [src/lib/wallet/addOwnerCallShape.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/addOwnerCallShape.ts#L10)

Relay Settlement router on Base mainnet — must not be the addOwner call target.

## Functions

### assertAddOwnerSelfCallShape()

> **assertAddOwnerSelfCallShape**(`params`): `void`

Defined in: [src/lib/wallet/addOwnerCallShape.ts:41](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/addOwnerCallShape.ts#L41)

#### Parameters

##### params

###### csw

`string`

###### txRequest

[`AddOwnerTxRequestShape`](#addownertxrequestshape)

#### Returns

`void`

***

### assertSendCallsEntryPointAddOwnerBundle()

> **assertSendCallsEntryPointAddOwnerBundle**(`params`): `void`

Defined in: [src/lib/wallet/addOwnerCallShape.ts:74](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/addOwnerCallShape.ts#L74)

EntryPoint UserOp lane for /add: exactly one zero-value CSW → CSW addOwnerAddress call.
Rejects Relay Part 1 deposit bundles and any router/depository targets.

#### Parameters

##### params

###### calls

[`SendCallsCallShape`](#sendcallscallshape)[]

###### csw

`string`

#### Returns

`void`

***

### verifyEntryPointHandleOpsTransaction()

> **verifyEntryPointHandleOpsTransaction**(`params`): `Promise`\<`void`\>

Defined in: [src/lib/wallet/addOwnerCallShape.ts:101](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/addOwnerCallShape.ts#L101)

Successful owner installs land in an outer transaction to EntryPoint v0.6 (handleOps).
Router multicall attempts use a different `to` and will fail this check.

#### Parameters

##### params

###### publicClient

`Pick`\<`PublicClient`, `"getTransaction"`\>

###### txHash

`` `0x${string}` ``

#### Returns

`Promise`\<`void`\>
