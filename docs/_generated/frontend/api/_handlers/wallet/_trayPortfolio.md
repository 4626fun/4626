[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / api/\_handlers/wallet/\_trayPortfolio

# api/\_handlers/wallet/\_trayPortfolio

## Type Aliases

### AccountTrayPortfolioBatchResponse

> **AccountTrayPortfolioBatchResponse** = `object`

Defined in: [api/\_handlers/wallet/\_trayPortfolio.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/wallet/_trayPortfolio.ts#L21)

#### Properties

##### asOf

> **asOf**: `number`

Defined in: [api/\_handlers/wallet/\_trayPortfolio.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/wallet/_trayPortfolio.ts#L22)

##### results

> **results**: `Record`\<`string`, [`WalletPortfolio`](../../../server/_lib/lens/debankPortfolio.md#walletportfolio) \| `null`\>

Defined in: [api/\_handlers/wallet/\_trayPortfolio.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/wallet/_trayPortfolio.ts#L23)

##### sources

> **sources**: `Record`\<`string`, [`TrayPortfolioSource`](../../../server/_lib/lens/trayPortfolioResolve.md#trayportfoliosource) \| `null`\>

Defined in: [api/\_handlers/wallet/\_trayPortfolio.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/wallet/_trayPortfolio.ts#L24)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/wallet/\_trayPortfolio.ts:88](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/wallet/_trayPortfolio.ts#L88)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
