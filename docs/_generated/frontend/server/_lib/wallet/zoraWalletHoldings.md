[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/zoraWalletHoldings

# server/\_lib/wallet/zoraWalletHoldings

## Type Aliases

### ZoraWalletHoldingDto

> **ZoraWalletHoldingDto** = `object`

Defined in: [server/\_lib/wallet/zoraWalletHoldings.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/zoraWalletHoldings.ts#L27)

#### Properties

##### address

> **address**: `string`

Defined in: [server/\_lib/wallet/zoraWalletHoldings.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/zoraWalletHoldings.ts#L28)

##### amount

> **amount**: `number`

Defined in: [server/\_lib/wallet/zoraWalletHoldings.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/zoraWalletHoldings.ts#L32)

##### amountFormatted

> **amountFormatted**: `string`

Defined in: [server/\_lib/wallet/zoraWalletHoldings.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/zoraWalletHoldings.ts#L33)

##### chainId

> **chainId**: `number`

Defined in: [server/\_lib/wallet/zoraWalletHoldings.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/zoraWalletHoldings.ts#L36)

##### coinType

> **coinType**: [`ZoraCoinType`](../../../src/lib/zora/coinType.md#zoracointype)

Defined in: [server/\_lib/wallet/zoraWalletHoldings.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/zoraWalletHoldings.ts#L31)

##### logoUrl

> **logoUrl**: `string` \| `null`

Defined in: [server/\_lib/wallet/zoraWalletHoldings.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/zoraWalletHoldings.ts#L35)

##### name

> **name**: `string`

Defined in: [server/\_lib/wallet/zoraWalletHoldings.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/zoraWalletHoldings.ts#L30)

##### symbol

> **symbol**: `string`

Defined in: [server/\_lib/wallet/zoraWalletHoldings.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/zoraWalletHoldings.ts#L29)

##### usdValue

> **usdValue**: `number`

Defined in: [server/\_lib/wallet/zoraWalletHoldings.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/zoraWalletHoldings.ts#L34)

***

### ZoraWalletHoldingsResult

> **ZoraWalletHoldingsResult** = `object`

Defined in: [server/\_lib/wallet/zoraWalletHoldings.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/zoraWalletHoldings.ts#L39)

#### Properties

##### asOf

> **asOf**: `number`

Defined in: [server/\_lib/wallet/zoraWalletHoldings.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/zoraWalletHoldings.ts#L41)

##### content

> **content**: [`ZoraWalletHoldingDto`](#zorawalletholdingdto)[]

Defined in: [server/\_lib/wallet/zoraWalletHoldings.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/zoraWalletHoldings.ts#L44)

##### creator

> **creator**: [`ZoraWalletHoldingDto`](#zorawalletholdingdto)[]

Defined in: [server/\_lib/wallet/zoraWalletHoldings.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/zoraWalletHoldings.ts#L43)

##### portfolioSource

> **portfolioSource**: [`TrayPortfolioSource`](../lens/trayPortfolioResolve.md#trayportfoliosource) \| `null`

Defined in: [server/\_lib/wallet/zoraWalletHoldings.ts:42](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/zoraWalletHoldings.ts#L42)

##### trend

> **trend**: [`ZoraWalletHoldingDto`](#zorawalletholdingdto)[]

Defined in: [server/\_lib/wallet/zoraWalletHoldings.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/zoraWalletHoldings.ts#L45)

##### wallet

> **wallet**: `string`

Defined in: [server/\_lib/wallet/zoraWalletHoldings.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/zoraWalletHoldings.ts#L40)

## Functions

### clampTopTokenCount()

> **clampTopTokenCount**(`raw`): `number`

Defined in: [server/\_lib/wallet/zoraWalletHoldings.ts:120](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/zoraWalletHoldings.ts#L120)

#### Parameters

##### raw

`number` | `undefined`

#### Returns

`number`

***

### resolveZoraWalletHoldings()

> **resolveZoraWalletHoldings**(`params`): `Promise`\<[`ZoraWalletHoldingsResult`](#zorawalletholdingsresult) \| `null`\>

Defined in: [server/\_lib/wallet/zoraWalletHoldings.ts:125](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/zoraWalletHoldings.ts#L125)

#### Parameters

##### params

###### chainId?

`number`

###### topTokenCount?

`number`

###### wallet

`string`

#### Returns

`Promise`\<[`ZoraWalletHoldingsResult`](#zorawalletholdingsresult) \| `null`\>
