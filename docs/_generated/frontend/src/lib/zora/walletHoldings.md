[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/zora/walletHoldings

# src/lib/zora/walletHoldings

## Type Aliases

### SwapZoraHoldingRow

> **SwapZoraHoldingRow** = `object`

Defined in: [src/lib/zora/walletHoldings.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L9)

#### Properties

##### balanceFormatted

> **balanceFormatted**: `string`

Defined in: [src/lib/zora/walletHoldings.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L11)

##### option

> **option**: [`SwapTokenOption`](../../components/swap/TokenSelectorModal.md#swaptokenoption)

Defined in: [src/lib/zora/walletHoldings.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L10)

***

### ZoraWalletHoldingDto

> **ZoraWalletHoldingDto** = `object`

Defined in: [src/lib/zora/walletHoldings.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L14)

#### Properties

##### address

> **address**: `string`

Defined in: [src/lib/zora/walletHoldings.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L15)

##### amount

> **amount**: `number`

Defined in: [src/lib/zora/walletHoldings.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L19)

##### amountFormatted

> **amountFormatted**: `string`

Defined in: [src/lib/zora/walletHoldings.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L20)

##### chainId

> **chainId**: `number`

Defined in: [src/lib/zora/walletHoldings.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L23)

##### coinType

> **coinType**: [`ZoraCoinType`](coinType.md#zoracointype)

Defined in: [src/lib/zora/walletHoldings.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L18)

##### logoUrl

> **logoUrl**: `string` \| `null`

Defined in: [src/lib/zora/walletHoldings.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L22)

##### name

> **name**: `string`

Defined in: [src/lib/zora/walletHoldings.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L17)

##### symbol

> **symbol**: `string`

Defined in: [src/lib/zora/walletHoldings.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L16)

##### usdValue

> **usdValue**: `number`

Defined in: [src/lib/zora/walletHoldings.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L21)

***

### ZoraWalletHoldingsBundle

> **ZoraWalletHoldingsBundle** = `object`

Defined in: [src/lib/zora/walletHoldings.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L35)

#### Properties

##### balances

> **balances**: `Record`\<`string`, `string`\>

Defined in: [src/lib/zora/walletHoldings.ts:40](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L40)

##### content

> **content**: [`SwapTokenOption`](../../components/swap/TokenSelectorModal.md#swaptokenoption)[]

Defined in: [src/lib/zora/walletHoldings.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L38)

##### creator

> **creator**: [`SwapTokenOption`](../../components/swap/TokenSelectorModal.md#swaptokenoption)[]

Defined in: [src/lib/zora/walletHoldings.ts:37](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L37)

##### trayContent

> **trayContent**: [`TrayTokenHolding`](../../components/account/trayPortfolioHelpers.md#traytokenholding)[]

Defined in: [src/lib/zora/walletHoldings.ts:43](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L43)

##### trayCreator

> **trayCreator**: [`TrayTokenHolding`](../../components/account/trayPortfolioHelpers.md#traytokenholding)[]

Defined in: [src/lib/zora/walletHoldings.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L42)

##### trayTrend

> **trayTrend**: [`TrayTokenHolding`](../../components/account/trayPortfolioHelpers.md#traytokenholding)[]

Defined in: [src/lib/zora/walletHoldings.ts:44](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L44)

##### trend

> **trend**: [`SwapTokenOption`](../../components/swap/TokenSelectorModal.md#swaptokenoption)[]

Defined in: [src/lib/zora/walletHoldings.ts:39](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L39)

##### usdValues

> **usdValues**: `Record`\<`string`, `number`\>

Defined in: [src/lib/zora/walletHoldings.ts:41](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L41)

##### wallet

> **wallet**: `string`

Defined in: [src/lib/zora/walletHoldings.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L36)

***

### ZoraWalletHoldingsResult

> **ZoraWalletHoldingsResult** = `object`

Defined in: [src/lib/zora/walletHoldings.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L26)

#### Properties

##### asOf

> **asOf**: `number`

Defined in: [src/lib/zora/walletHoldings.ts:28](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L28)

##### content

> **content**: [`ZoraWalletHoldingDto`](#zorawalletholdingdto)[]

Defined in: [src/lib/zora/walletHoldings.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L31)

##### creator

> **creator**: [`ZoraWalletHoldingDto`](#zorawalletholdingdto)[]

Defined in: [src/lib/zora/walletHoldings.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L30)

##### portfolioSource

> **portfolioSource**: `"debank"` \| `"base-etherscan"` \| `null`

Defined in: [src/lib/zora/walletHoldings.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L29)

##### trend

> **trend**: [`ZoraWalletHoldingDto`](#zorawalletholdingdto)[]

Defined in: [src/lib/zora/walletHoldings.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L32)

##### wallet

> **wallet**: `string`

Defined in: [src/lib/zora/walletHoldings.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L27)

## Functions

### fetchTrayZoraHoldingsForWallets()

> **fetchTrayZoraHoldingsForWallets**(`wallets`, `options?`): `Promise`\<\{ `content`: [`TrayTokenHolding`](../../components/account/trayPortfolioHelpers.md#traytokenholding)[]; `creator`: [`TrayTokenHolding`](../../components/account/trayPortfolioHelpers.md#traytokenholding)[]; `trend`: [`TrayTokenHolding`](../../components/account/trayPortfolioHelpers.md#traytokenholding)[]; \}\>

Defined in: [src/lib/zora/walletHoldings.ts:218](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L218)

#### Parameters

##### wallets

`string`[]

##### options?

###### topTokenCount?

`number`

#### Returns

`Promise`\<\{ `content`: [`TrayTokenHolding`](../../components/account/trayPortfolioHelpers.md#traytokenholding)[]; `creator`: [`TrayTokenHolding`](../../components/account/trayPortfolioHelpers.md#traytokenholding)[]; `trend`: [`TrayTokenHolding`](../../components/account/trayPortfolioHelpers.md#traytokenholding)[]; \}\>

***

### fetchWalletZoraHoldings()

> **fetchWalletZoraHoldings**(`params`): `Promise`\<[`ZoraWalletHoldingsResult`](#zorawalletholdingsresult) \| `null`\>

Defined in: [src/lib/zora/walletHoldings.ts:147](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L147)

#### Parameters

##### params

###### topTokenCount?

`number`

###### wallet

`string`

#### Returns

`Promise`\<[`ZoraWalletHoldingsResult`](#zorawalletholdingsresult) \| `null`\>

***

### fetchWalletZoraHoldingsBundle()

> **fetchWalletZoraHoldingsBundle**(`wallet`, `options?`): `Promise`\<[`ZoraWalletHoldingsBundle`](#zorawalletholdingsbundle) \| `null`\>

Defined in: [src/lib/zora/walletHoldings.ts:166](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L166)

#### Parameters

##### wallet

`string`

##### options?

###### topTokenCount?

`number`

#### Returns

`Promise`\<[`ZoraWalletHoldingsBundle`](#zorawalletholdingsbundle) \| `null`\>

***

### mergeZoraHoldingsBundles()

> **mergeZoraHoldingsBundles**(`bundles`): `object`

Defined in: [src/lib/zora/walletHoldings.ts:199](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L199)

Merge Zora holdings across multiple wallets (canonical CSW + external EOA).

#### Parameters

##### bundles

([`ZoraWalletHoldingsBundle`](#zorawalletholdingsbundle) \| `null` \| `undefined`)[]

#### Returns

`object`

##### content

> **content**: [`TrayTokenHolding`](../../components/account/trayPortfolioHelpers.md#traytokenholding)[]

##### creator

> **creator**: [`TrayTokenHolding`](../../components/account/trayPortfolioHelpers.md#traytokenholding)[]

##### trend

> **trend**: [`TrayTokenHolding`](../../components/account/trayPortfolioHelpers.md#traytokenholding)[]

***

### normalizeZoraHoldingsWalletAddress()

> **normalizeZoraHoldingsWalletAddress**(`value`): `string` \| `null`

Defined in: [src/lib/zora/walletHoldings.ts:175](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L175)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`string` \| `null`

***

### zoraHoldingsDtoToBundle()

> **zoraHoldingsDtoToBundle**(`data`): [`ZoraWalletHoldingsBundle`](#zorawalletholdingsbundle)

Defined in: [src/lib/zora/walletHoldings.ts:113](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L113)

#### Parameters

##### data

[`ZoraWalletHoldingsResult`](#zorawalletholdingsresult)

#### Returns

[`ZoraWalletHoldingsBundle`](#zorawalletholdingsbundle)

***

### zoraHoldingsDtoToSwapRows()

> **zoraHoldingsDtoToSwapRows**(`data`): [`SwapZoraHoldingRow`](#swapzoraholdingrow)[]

Defined in: [src/lib/zora/walletHoldings.ts:101](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/walletHoldings.ts#L101)

#### Parameters

##### data

[`ZoraWalletHoldingsResult`](#zorawalletholdingsresult)

#### Returns

[`SwapZoraHoldingRow`](#swapzoraholdingrow)[]
