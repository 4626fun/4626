[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/account/useAccountTrayPortfolio

# src/components/account/useAccountTrayPortfolio

## Functions

### useAccountTrayPortfolio()

> **useAccountTrayPortfolio**(`options`): `object`

Defined in: [src/components/account/useAccountTrayPortfolio.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/useAccountTrayPortfolio.ts#L18)

#### Parameters

##### options

`UseAccountTrayPortfolioOptions` = `{}`

#### Returns

`object`

##### isLoading

> **isLoading**: `boolean` = `trayPortfolioQuery.isLoading`

##### trayHoldings

> **trayHoldings**: `object`

###### trayHoldings.activeNetworkLabel

> **activeNetworkLabel**: `string`

###### trayHoldings.activeNetworkUsd

> **activeNetworkUsd**: `number` \| `null`

###### trayHoldings.aggregateUsd

> **aggregateUsd**: `number`

###### trayHoldings.rows

> **rows**: [`TrayNetworkHolding`](trayPortfolioHelpers.md#traynetworkholding)[]

##### trayPortfolioQuery

> **trayPortfolioQuery**: `UseQueryResult`\<[`AccountTrayPortfolioBatch`](../../lib/debank/client.md#accounttrayportfoliobatch) \| `null`, `Error`\>

##### trayTokenRows

> **trayTokenRows**: [`TrayWalletTokenRow`](trayPortfolioHelpers.md#traywallettokenrow)[]

##### trayWalletSources

> **trayWalletSources**: [`TrayWalletSource`](trayPortfolioHelpers.md#traywalletsource)[]
