[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / api/\_handlers/debank/\_walletPortfolioBatch

# api/\_handlers/debank/\_walletPortfolioBatch

## Type Aliases

### DebankWalletPortfolioBatchResponse

> **DebankWalletPortfolioBatchResponse** = `object`

Defined in: [api/\_handlers/debank/\_walletPortfolioBatch.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/debank/_walletPortfolioBatch.ts#L18)

#### Properties

##### asOf

> **asOf**: `number`

Defined in: [api/\_handlers/debank/\_walletPortfolioBatch.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/debank/_walletPortfolioBatch.ts#L19)

##### results

> **results**: `Record`\<`string`, [`WalletPortfolio`](../../../server/_lib/lens/debankPortfolio.md#walletportfolio) \| `null`\>

Defined in: [api/\_handlers/debank/\_walletPortfolioBatch.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/debank/_walletPortfolioBatch.ts#L20)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/debank/\_walletPortfolioBatch.ts:93](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/debank/_walletPortfolioBatch.ts#L93)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
