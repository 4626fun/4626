[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/onchain/payoutRouterTreasurySetup

# server/\_lib/onchain/payoutRouterTreasurySetup

## Type Aliases

### PayoutRouterTreasurySetupCall

> **PayoutRouterTreasurySetupCall** = `object`

Defined in: [server/\_lib/onchain/payoutRouterTreasurySetup.ts:92](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterTreasurySetup.ts#L92)

#### Properties

##### data

> **data**: `Hex`

Defined in: [server/\_lib/onchain/payoutRouterTreasurySetup.ts:94](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterTreasurySetup.ts#L94)

##### label

> **label**: `string`

Defined in: [server/\_lib/onchain/payoutRouterTreasurySetup.ts:95](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterTreasurySetup.ts#L95)

##### to

> **to**: `Address`

Defined in: [server/\_lib/onchain/payoutRouterTreasurySetup.ts:93](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterTreasurySetup.ts#L93)

***

### PayoutRouterTreasurySetupPlan

> **PayoutRouterTreasurySetupPlan** = `object`

Defined in: [server/\_lib/onchain/payoutRouterTreasurySetup.ts:98](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterTreasurySetup.ts#L98)

#### Properties

##### calls

> **calls**: [`PayoutRouterTreasurySetupCall`](#payoutroutertreasurysetupcall)[]

Defined in: [server/\_lib/onchain/payoutRouterTreasurySetup.ts:108](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterTreasurySetup.ts#L108)

##### creatorToken

> **creatorToken**: `Address`

Defined in: [server/\_lib/onchain/payoutRouterTreasurySetup.ts:100](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterTreasurySetup.ts#L100)

##### currentKeeper

> **currentKeeper**: `Address`

Defined in: [server/\_lib/onchain/payoutRouterTreasurySetup.ts:104](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterTreasurySetup.ts#L104)

##### desiredKeeper

> **desiredKeeper**: `Address` \| `null`

Defined in: [server/\_lib/onchain/payoutRouterTreasurySetup.ts:103](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterTreasurySetup.ts#L103)

##### externalSpenders

> **externalSpenders**: `Address`[]

Defined in: [server/\_lib/onchain/payoutRouterTreasurySetup.ts:107](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterTreasurySetup.ts#L107)

##### externalTargets

> **externalTargets**: `Address`[]

Defined in: [server/\_lib/onchain/payoutRouterTreasurySetup.ts:106](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterTreasurySetup.ts#L106)

##### owner

> **owner**: `Address` \| `null`

Defined in: [server/\_lib/onchain/payoutRouterTreasurySetup.ts:101](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterTreasurySetup.ts#L101)

##### ownerMatchesTreasury

> **ownerMatchesTreasury**: `boolean`

Defined in: [server/\_lib/onchain/payoutRouterTreasurySetup.ts:102](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterTreasurySetup.ts#L102)

##### payoutRouter

> **payoutRouter**: `Address`

Defined in: [server/\_lib/onchain/payoutRouterTreasurySetup.ts:99](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterTreasurySetup.ts#L99)

##### skipReason?

> `optional` **skipReason**: `string`

Defined in: [server/\_lib/onchain/payoutRouterTreasurySetup.ts:109](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterTreasurySetup.ts#L109)

##### swapPaths

> **swapPaths**: `object`[]

Defined in: [server/\_lib/onchain/payoutRouterTreasurySetup.ts:105](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterTreasurySetup.ts#L105)

###### currentPath

> **currentPath**: `Hex`

###### label

> **label**: `"WETH"` \| `"ZORA"`

###### path

> **path**: `Hex`

###### tokenIn

> **tokenIn**: `Address`

## Functions

### buildPayoutRouterTreasurySetupPlan()

> **buildPayoutRouterTreasurySetupPlan**(`params`): `Promise`\<[`PayoutRouterTreasurySetupPlan`](#payoutroutertreasurysetupplan)\>

Defined in: [server/\_lib/onchain/payoutRouterTreasurySetup.ts:180](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterTreasurySetup.ts#L180)

#### Parameters

##### params

###### creatorToken

`string`

###### payoutRouter

`string`

###### publicClient

`ReaderClient`

#### Returns

`Promise`\<[`PayoutRouterTreasurySetupPlan`](#payoutroutertreasurysetupplan)\>

***

### executePayoutRouterTreasurySetup()

> **executePayoutRouterTreasurySetup**(`params`): `Promise`\<\{ `executed`: `boolean`; `plan`: [`PayoutRouterTreasurySetupPlan`](#payoutroutertreasurysetupplan); `safeAddress?`: `string`; `signerAddress?`: `string`; `txHash?`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/onchain/payoutRouterTreasurySetup.ts:290](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterTreasurySetup.ts#L290)

#### Parameters

##### params

###### creatorToken

`string`

###### env?

`Record`\<`string`, `string` \| `undefined`\>

###### payoutRouter

`string`

###### publicClient

\{ `readContract`: (`args`) => `Promise`\<`unknown`\>; `waitForTransactionReceipt`: (`args`) => `Promise`\<\{ `status`: `string`; \}\>; \}

###### publicClient.readContract

(`args`) => `Promise`\<`unknown`\>

###### publicClient.waitForTransactionReceipt

(`args`) => `Promise`\<\{ `status`: `string`; \}\>

###### rpcUrl

`string`

#### Returns

`Promise`\<\{ `executed`: `boolean`; `plan`: [`PayoutRouterTreasurySetupPlan`](#payoutroutertreasurysetupplan); `safeAddress?`: `string`; `signerAddress?`: `string`; `txHash?`: `` `0x${string}` ``; \}\>

***

### maybeAutoSetupPayoutRouterTreasury()

> **maybeAutoSetupPayoutRouterTreasury**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/onchain/payoutRouterTreasurySetup.ts:344](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterTreasurySetup.ts#L344)

#### Parameters

##### params

###### creatorToken

`string`

###### env?

`Record`\<`string`, `string` \| `undefined`\>

###### payoutRouter

`string`

###### publicClient

\{ `readContract`: (`args`) => `Promise`\<`unknown`\>; `waitForTransactionReceipt`: (`args`) => `Promise`\<\{ `status`: `string`; \}\>; \}

###### publicClient.readContract

(`args`) => `Promise`\<`unknown`\>

###### publicClient.waitForTransactionReceipt

(`args`) => `Promise`\<\{ `status`: `string`; \}\>

###### rpcUrl

`string`

#### Returns

`Promise`\<`void`\>

***

### payoutRouterTreasuryAutoSetupEnabled()

> **payoutRouterTreasuryAutoSetupEnabled**(`env`): `boolean`

Defined in: [server/\_lib/onchain/payoutRouterTreasurySetup.ts:335](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterTreasurySetup.ts#L335)

#### Parameters

##### env

`Record`\<`string`, `string` \| `undefined`\> = `process.env`

#### Returns

`boolean`
