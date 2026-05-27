[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lens/baseTrayPortfolioEtherscan

# server/\_lib/lens/baseTrayPortfolioEtherscan

## Functions

### getTrayWalletPortfolioBaseEtherscan()

> **getTrayWalletPortfolioBaseEtherscan**(`address`, `options`): `Promise`\<[`WalletPortfolio`](debankPortfolio.md#walletportfolio) \| `null`\>

Defined in: [server/\_lib/lens/baseTrayPortfolioEtherscan.ts:123](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lens/baseTrayPortfolioEtherscan.ts#L123)

Base mainnet holdings for the account tray (ERC-20 + native ETH).
Does not include DeFi positions or non-Base chains.

#### Parameters

##### address

`string`

##### options

###### topTokenCount?

`number`

#### Returns

`Promise`\<[`WalletPortfolio`](debankPortfolio.md#walletportfolio) \| `null`\>
