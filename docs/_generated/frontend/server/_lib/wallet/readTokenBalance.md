[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/readTokenBalance

# server/\_lib/wallet/readTokenBalance

## Type Aliases

### TokenBalanceResult

> **TokenBalanceResult** = `object`

Defined in: [server/\_lib/wallet/readTokenBalance.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/readTokenBalance.ts#L16)

#### Properties

##### decimals

> **decimals**: `number`

Defined in: [server/\_lib/wallet/readTokenBalance.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/readTokenBalance.ts#L18)

##### formatted

> **formatted**: `string`

Defined in: [server/\_lib/wallet/readTokenBalance.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/readTokenBalance.ts#L19)

##### raw

> **raw**: `string`

Defined in: [server/\_lib/wallet/readTokenBalance.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/readTokenBalance.ts#L17)

## Variables

### NATIVE\_TOKEN\_BALANCE\_ADDRESS

> `const` **NATIVE\_TOKEN\_BALANCE\_ADDRESS**: `"0x0000000000000000000000000000000000000000"` = `'0x0000000000000000000000000000000000000000'`

Defined in: [server/\_lib/wallet/readTokenBalance.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/readTokenBalance.ts#L14)

## Functions

### readTokenBalance()

> **readTokenBalance**(`params`): `Promise`\<[`TokenBalanceResult`](#tokenbalanceresult)\>

Defined in: [server/\_lib/wallet/readTokenBalance.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/readTokenBalance.ts#L22)

#### Parameters

##### params

###### ownerAddress

`string`

###### tokenAddress

`string`

#### Returns

`Promise`\<[`TokenBalanceResult`](#tokenbalanceresult)\>
