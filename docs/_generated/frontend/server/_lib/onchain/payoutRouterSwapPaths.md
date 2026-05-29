[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/onchain/payoutRouterSwapPaths

# server/\_lib/onchain/payoutRouterSwapPaths

## Type Aliases

### PayoutRouterSwapPathPlan

> **PayoutRouterSwapPathPlan** = `object`

Defined in: [server/\_lib/onchain/payoutRouterSwapPaths.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterSwapPaths.ts#L24)

#### Properties

##### label

> **label**: `"WETH"` \| `"ZORA"`

Defined in: [server/\_lib/onchain/payoutRouterSwapPaths.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterSwapPaths.ts#L27)

##### path

> **path**: `Hex`

Defined in: [server/\_lib/onchain/payoutRouterSwapPaths.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterSwapPaths.ts#L26)

##### tokenIn

> **tokenIn**: `Address`

Defined in: [server/\_lib/onchain/payoutRouterSwapPaths.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterSwapPaths.ts#L25)

## Functions

### resolvePayoutRouterSwapPaths()

> **resolvePayoutRouterSwapPaths**(`params`): `Promise`\<[`PayoutRouterSwapPathPlan`](#payoutrouterswappathplan)[]\>

Defined in: [server/\_lib/onchain/payoutRouterSwapPaths.ts:87](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterSwapPaths.ts#L87)

#### Parameters

##### params

###### creatorToken

`string`

###### publicClient

`PublicClientReader`

#### Returns

`Promise`\<[`PayoutRouterSwapPathPlan`](#payoutrouterswappathplan)[]\>
