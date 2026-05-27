[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/wallet/baseAppOwnerCalls

# src/lib/wallet/baseAppOwnerCalls

## Type Aliases

### BaseAppOwnerCallResult

> **BaseAppOwnerCallResult** = `object`

Defined in: [src/lib/wallet/baseAppOwnerCalls.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/baseAppOwnerCalls.ts#L8)

#### Properties

##### callBundleId

> **callBundleId**: `string`

Defined in: [src/lib/wallet/baseAppOwnerCalls.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/baseAppOwnerCalls.ts#L9)

##### transactionHash

> **transactionHash**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/wallet/baseAppOwnerCalls.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/baseAppOwnerCalls.ts#L10)

***

### RemoveOwnerFunctionName

> **RemoveOwnerFunctionName** = `"removeOwnerAtIndex"` \| `"removeLastOwner"`

Defined in: [src/lib/wallet/baseAppOwnerCalls.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/baseAppOwnerCalls.ts#L13)

***

### RemoveOwnerPlan

> **RemoveOwnerPlan** = `object`

Defined in: [src/lib/wallet/baseAppOwnerCalls.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/baseAppOwnerCalls.ts#L15)

#### Properties

##### highestPopulatedOwnerIndex

> **highestPopulatedOwnerIndex**: `number`

Defined in: [src/lib/wallet/baseAppOwnerCalls.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/baseAppOwnerCalls.ts#L21)

##### nextOwnerIndex

> **nextOwnerIndex**: `number`

Defined in: [src/lib/wallet/baseAppOwnerCalls.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/baseAppOwnerCalls.ts#L20)

##### ownerBytes

> **ownerBytes**: `` `0x${string}` ``

Defined in: [src/lib/wallet/baseAppOwnerCalls.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/baseAppOwnerCalls.ts#L17)

##### ownerCount

> **ownerCount**: `number`

Defined in: [src/lib/wallet/baseAppOwnerCalls.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/baseAppOwnerCalls.ts#L19)

##### ownerIndex

> **ownerIndex**: `number`

Defined in: [src/lib/wallet/baseAppOwnerCalls.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/baseAppOwnerCalls.ts#L16)

##### selectedFunction

> **selectedFunction**: [`RemoveOwnerFunctionName`](#removeownerfunctionname)

Defined in: [src/lib/wallet/baseAppOwnerCalls.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/baseAppOwnerCalls.ts#L18)

## Functions

### addOwnerViaBaseAppSendCalls()

> **addOwnerViaBaseAppSendCalls**(`params`): `Promise`\<[`BaseAppOwnerCallResult`](#baseappownercallresult)\>

Defined in: [src/lib/wallet/baseAppOwnerCalls.ts:128](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/baseAppOwnerCalls.ts#L128)

#### Parameters

##### params

###### chainId

`number`

###### csw

`` `0x${string}` ``

###### intervalMs?

`number`

###### onTelemetry?

(`event`) => `void`

###### ownerToAdd

`` `0x${string}` ``

###### timeoutMs?

`number`

###### walletRequest

`WalletRequest`

#### Returns

`Promise`\<[`BaseAppOwnerCallResult`](#baseappownercallresult)\>

***

### encodeAddOwnerCall()

> **encodeAddOwnerCall**(`params`): `object`

Defined in: [src/lib/wallet/baseAppOwnerCalls.ts:90](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/baseAppOwnerCalls.ts#L90)

#### Parameters

##### params

###### csw

`` `0x${string}` ``

###### ownerToAdd

`` `0x${string}` ``

#### Returns

`object`

##### data

> **data**: `` `0x${string}` ``

##### to

> **to**: `` `0x${string}` ``

##### value

> **value**: `"0x0"`

***

### encodeRemoveOwnerCall()

> **encodeRemoveOwnerCall**(`params`): `object`

Defined in: [src/lib/wallet/baseAppOwnerCalls.ts:104](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/baseAppOwnerCalls.ts#L104)

#### Parameters

##### params

###### csw

`` `0x${string}` ``

###### ownerBytes

`` `0x${string}` ``

###### ownerIndex

`number`

###### selectedFunction?

[`RemoveOwnerFunctionName`](#removeownerfunctionname)

#### Returns

`object`

##### data

> **data**: `` `0x${string}` ``

##### selectedFunction

> **selectedFunction**: [`RemoveOwnerFunctionName`](#removeownerfunctionname)

##### to

> **to**: `` `0x${string}` ``

##### value

> **value**: `"0x0"`

***

### planRemoveOwnerFromChain()

> **planRemoveOwnerFromChain**(`params`): `Promise`\<[`RemoveOwnerPlan`](#removeownerplan)\>

Defined in: [src/lib/wallet/baseAppOwnerCalls.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/baseAppOwnerCalls.ts#L24)

#### Parameters

##### params

###### csw

`` `0x${string}` ``

###### ownerIndex

`number`

###### publicClient

\{ \}

###### scanLimitCap?

`number`

#### Returns

`Promise`\<[`RemoveOwnerPlan`](#removeownerplan)\>

***

### removeOwnerViaBaseAppSendCalls()

> **removeOwnerViaBaseAppSendCalls**(`params`): `Promise`\<[`BaseAppOwnerCallResult`](#baseappownercallresult)\>

Defined in: [src/lib/wallet/baseAppOwnerCalls.ts:155](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/baseAppOwnerCalls.ts#L155)

#### Parameters

##### params

###### chainId

`number`

###### csw

`` `0x${string}` ``

###### intervalMs?

`number`

###### onTelemetry?

(`event`) => `void`

###### ownerBytes

`` `0x${string}` ``

###### ownerIndex

`number`

###### selectedFunction?

[`RemoveOwnerFunctionName`](#removeownerfunctionname)

###### timeoutMs?

`number`

###### walletRequest

`WalletRequest`

#### Returns

`Promise`\<[`BaseAppOwnerCallResult`](#baseappownercallresult)\>
