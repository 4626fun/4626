[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lens/trayPortfolioResolve

# server/\_lib/lens/trayPortfolioResolve

## Type Aliases

### ResolvedTrayPortfolio

> **ResolvedTrayPortfolio** = `object`

Defined in: [server/\_lib/lens/trayPortfolioResolve.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/trayPortfolioResolve.ts#L21)

#### Properties

##### portfolio

> **portfolio**: [`WalletPortfolio`](debankPortfolio.md#walletportfolio) \| `null`

Defined in: [server/\_lib/lens/trayPortfolioResolve.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/trayPortfolioResolve.ts#L22)

##### source

> **source**: [`TrayPortfolioSource`](#trayportfoliosource) \| `null`

Defined in: [server/\_lib/lens/trayPortfolioResolve.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/trayPortfolioResolve.ts#L23)

***

### TrayPortfolioBatchResult

> **TrayPortfolioBatchResult** = `object`

Defined in: [server/\_lib/lens/trayPortfolioResolve.ts:93](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/trayPortfolioResolve.ts#L93)

#### Properties

##### asOf

> **asOf**: `number`

Defined in: [server/\_lib/lens/trayPortfolioResolve.ts:94](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/trayPortfolioResolve.ts#L94)

##### results

> **results**: `Record`\<`string`, [`WalletPortfolio`](debankPortfolio.md#walletportfolio) \| `null`\>

Defined in: [server/\_lib/lens/trayPortfolioResolve.ts:95](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/trayPortfolioResolve.ts#L95)

##### sources

> **sources**: `Record`\<`string`, [`TrayPortfolioSource`](#trayportfoliosource) \| `null`\>

Defined in: [server/\_lib/lens/trayPortfolioResolve.ts:96](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/trayPortfolioResolve.ts#L96)

***

### TrayPortfolioSource

> **TrayPortfolioSource** = `"debank"` \| `"base-etherscan"`

Defined in: [server/\_lib/lens/trayPortfolioResolve.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/trayPortfolioResolve.ts#L19)

## Functions

### resolveTrayWalletPortfolio()

> **resolveTrayWalletPortfolio**(`address`, `options`): `Promise`\<[`ResolvedTrayPortfolio`](#resolvedtrayportfolio)\>

Defined in: [server/\_lib/lens/trayPortfolioResolve.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/trayPortfolioResolve.ts#L34)

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

Defined in: [server/\_lib/lens/trayPortfolioResolve.ts:112](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/trayPortfolioResolve.ts#L112)

#### Parameters

##### addresses

`string`[]

##### options

###### topTokenCount?

`number`

#### Returns

`Promise`\<[`TrayPortfolioBatchResult`](#trayportfoliobatchresult)\>
