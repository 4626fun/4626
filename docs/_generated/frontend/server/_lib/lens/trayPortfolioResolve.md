[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lens/trayPortfolioResolve

# server/\_lib/lens/trayPortfolioResolve

## Type Aliases

### ResolvedTrayPortfolio

> **ResolvedTrayPortfolio** = `object`

Defined in: [server/\_lib/lens/trayPortfolioResolve.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lens/trayPortfolioResolve.ts#L13)

#### Properties

##### portfolio

> **portfolio**: [`WalletPortfolio`](debankPortfolio.md#walletportfolio) \| `null`

Defined in: [server/\_lib/lens/trayPortfolioResolve.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lens/trayPortfolioResolve.ts#L14)

##### source

> **source**: [`TrayPortfolioSource`](#trayportfoliosource) \| `null`

Defined in: [server/\_lib/lens/trayPortfolioResolve.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lens/trayPortfolioResolve.ts#L15)

***

### TrayPortfolioBatchResult

> **TrayPortfolioBatchResult** = `object`

Defined in: [server/\_lib/lens/trayPortfolioResolve.ts:40](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lens/trayPortfolioResolve.ts#L40)

#### Properties

##### asOf

> **asOf**: `number`

Defined in: [server/\_lib/lens/trayPortfolioResolve.ts:41](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lens/trayPortfolioResolve.ts#L41)

##### results

> **results**: `Record`\<`string`, [`WalletPortfolio`](debankPortfolio.md#walletportfolio) \| `null`\>

Defined in: [server/\_lib/lens/trayPortfolioResolve.ts:42](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lens/trayPortfolioResolve.ts#L42)

##### sources

> **sources**: `Record`\<`string`, [`TrayPortfolioSource`](#trayportfoliosource) \| `null`\>

Defined in: [server/\_lib/lens/trayPortfolioResolve.ts:43](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lens/trayPortfolioResolve.ts#L43)

***

### TrayPortfolioSource

> **TrayPortfolioSource** = `"debank"` \| `"base-etherscan"`

Defined in: [server/\_lib/lens/trayPortfolioResolve.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lens/trayPortfolioResolve.ts#L11)

## Functions

### resolveTrayWalletPortfolio()

> **resolveTrayWalletPortfolio**(`address`, `options`): `Promise`\<[`ResolvedTrayPortfolio`](#resolvedtrayportfolio)\>

Defined in: [server/\_lib/lens/trayPortfolioResolve.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lens/trayPortfolioResolve.ts#L18)

#### Parameters

##### address

`string`

##### options

###### topTokenCount?

`number`

#### Returns

`Promise`\<[`ResolvedTrayPortfolio`](#resolvedtrayportfolio)\>

***

### resolveTrayWalletPortfolioBatch()

> **resolveTrayWalletPortfolioBatch**(`addresses`, `options`): `Promise`\<[`TrayPortfolioBatchResult`](#trayportfoliobatchresult)\>

Defined in: [server/\_lib/lens/trayPortfolioResolve.ts:59](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lens/trayPortfolioResolve.ts#L59)

#### Parameters

##### addresses

`string`[]

##### options

###### topTokenCount?

`number`

#### Returns

`Promise`\<[`TrayPortfolioBatchResult`](#trayportfoliobatchresult)\>
