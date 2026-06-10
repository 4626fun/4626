[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/account/trayPortfolioHelpers

# src/components/account/trayPortfolioHelpers

## Type Aliases

### TrayAssetHolding

> **TrayAssetHolding** = `object`

Defined in: [src/components/account/trayPortfolioHelpers.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L26)

#### Properties

##### amount

> **amount**: `number`

Defined in: [src/components/account/trayPortfolioHelpers.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L32)

##### logoUrl

> **logoUrl**: `string` \| `null`

Defined in: [src/components/account/trayPortfolioHelpers.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L31)

##### name

> **name**: `string`

Defined in: [src/components/account/trayPortfolioHelpers.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L30)

##### symbol

> **symbol**: `string`

Defined in: [src/components/account/trayPortfolioHelpers.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L29)

##### tokenAddress

> **tokenAddress**: `string` \| `null`

Defined in: [src/components/account/trayPortfolioHelpers.ts:28](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L28)

##### tokenKey

> **tokenKey**: `string`

Defined in: [src/components/account/trayPortfolioHelpers.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L27)

##### usdValue

> **usdValue**: `number`

Defined in: [src/components/account/trayPortfolioHelpers.ts:33](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L33)

***

### TrayNetworkHolding

> **TrayNetworkHolding** = `object`

Defined in: [src/components/account/trayPortfolioHelpers.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L18)

#### Properties

##### networkId

> **networkId**: `string`

Defined in: [src/components/account/trayPortfolioHelpers.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L19)

##### networkLabel

> **networkLabel**: `string`

Defined in: [src/components/account/trayPortfolioHelpers.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L20)

##### networkLogoUrl

> **networkLogoUrl**: `string` \| `null`

Defined in: [src/components/account/trayPortfolioHelpers.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L21)

##### usdTotal

> **usdTotal**: `number`

Defined in: [src/components/account/trayPortfolioHelpers.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L22)

##### wallets

> **wallets**: [`TrayNetworkWalletBreakdown`](#traynetworkwalletbreakdown)[]

Defined in: [src/components/account/trayPortfolioHelpers.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L23)

***

### TrayNetworkWalletBreakdown

> **TrayNetworkWalletBreakdown** = `object`

Defined in: [src/components/account/trayPortfolioHelpers.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L11)

#### Properties

##### address

> **address**: `string`

Defined in: [src/components/account/trayPortfolioHelpers.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L14)

##### kind

> **kind**: [`TrayWalletKind`](#traywalletkind)

Defined in: [src/components/account/trayPortfolioHelpers.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L12)

##### label

> **label**: `string`

Defined in: [src/components/account/trayPortfolioHelpers.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L13)

##### usdValue

> **usdValue**: `number`

Defined in: [src/components/account/trayPortfolioHelpers.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L15)

***

### TrayTokenHolding

> **TrayTokenHolding** = [`TrayAssetHolding`](#trayassetholding) & `object`

Defined in: [src/components/account/trayPortfolioHelpers.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L36)

#### Type Declaration

##### walletCount

> **walletCount**: `number`

***

### TrayWalletKind

> **TrayWalletKind** = `"canonical"` \| `"external"`

Defined in: [src/components/account/trayPortfolioHelpers.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L3)

***

### TrayWalletSource

> **TrayWalletSource** = `object`

Defined in: [src/components/account/trayPortfolioHelpers.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L5)

#### Properties

##### address

> **address**: `string`

Defined in: [src/components/account/trayPortfolioHelpers.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L7)

##### kind

> **kind**: [`TrayWalletKind`](#traywalletkind)

Defined in: [src/components/account/trayPortfolioHelpers.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L6)

##### label

> **label**: `string`

Defined in: [src/components/account/trayPortfolioHelpers.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L8)

***

### TrayWalletTokenRow

> **TrayWalletTokenRow** = `object`

Defined in: [src/components/account/trayPortfolioHelpers.ts:40](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L40)

#### Properties

##### token

> **token**: [`DebankToken`](../../lib/debank/client.md#debanktoken)

Defined in: [src/components/account/trayPortfolioHelpers.ts:41](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L41)

##### wallet

> **wallet**: [`TrayWalletSource`](#traywalletsource)

Defined in: [src/components/account/trayPortfolioHelpers.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L42)

## Functions

### buildTrayAssetHoldings()

> **buildTrayAssetHoldings**(`rows`, `options?`): [`TrayAssetHolding`](#trayassetholding)[]

Defined in: [src/components/account/trayPortfolioHelpers.ts:284](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L284)

#### Parameters

##### rows

[`TrayWalletTokenRow`](#traywallettokenrow)[]

##### options?

###### excludeTokenKeys?

`ReadonlySet`\<`string`\>

#### Returns

[`TrayAssetHolding`](#trayassetholding)[]

***

### buildTrayHoldings()

> **buildTrayHoldings**(`params`): `object`

Defined in: [src/components/account/trayPortfolioHelpers.ts:193](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L193)

#### Parameters

##### params

###### debankResults

`Record`\<`string`, \{ `chains`: `object`[]; `totalUsdValue`: `number`; \} \| `null`\> \| `null`

###### wallets

[`TrayWalletSource`](#traywalletsource)[]

#### Returns

`object`

##### activeNetworkLabel

> **activeNetworkLabel**: `string`

##### activeNetworkUsd

> **activeNetworkUsd**: `number` \| `null`

##### aggregateUsd

> **aggregateUsd**: `number`

##### rows

> **rows**: [`TrayNetworkHolding`](#traynetworkholding)[]

***

### buildTrayHoldingsFromPortfolios()

> **buildTrayHoldingsFromPortfolios**(`params`): `object`

Defined in: [src/components/account/trayPortfolioHelpers.ts:165](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L165)

Build network totals from unified tray portfolio snapshots (DeBank or Base/etherscan).

#### Parameters

##### params

###### portfolios

`Record`\<`string`, [`DebankWalletPortfolio`](../../lib/debank/client.md#debankwalletportfolio) \| `null`\> \| `null`

###### wallets

[`TrayWalletSource`](#traywalletsource)[]

#### Returns

`object`

##### activeNetworkLabel

> **activeNetworkLabel**: `string`

##### activeNetworkUsd

> **activeNetworkUsd**: `number` \| `null`

##### aggregateUsd

> **aggregateUsd**: `number`

##### rows

> **rows**: [`TrayNetworkHolding`](#traynetworkholding)[]

***

### buildTrayTokenRowsFromPortfolios()

> **buildTrayTokenRowsFromPortfolios**(`params`): [`TrayWalletTokenRow`](#traywallettokenrow)[]

Defined in: [src/components/account/trayPortfolioHelpers.ts:395](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L395)

Flatten server wallet portfolios into tray token rows (DeBank all_token_list).

#### Parameters

##### params

###### portfolios

`Record`\<`string`, [`DebankWalletPortfolio`](../../lib/debank/client.md#debankwalletportfolio) \| `null`\> \| `null`

###### wallets

[`TrayWalletSource`](#traywalletsource)[]

#### Returns

[`TrayWalletTokenRow`](#traywallettokenrow)[]

***

### buildTrayWalletSources()

> **buildTrayWalletSources**(`params`): [`TrayWalletSource`](#traywalletsource)[]

Defined in: [src/components/account/trayPortfolioHelpers.ts:56](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L56)

One DeBank row per address — skip external EOA when it is the same as canonical CSW.

#### Parameters

##### params

###### cswAddress

`string` \| `null`

###### externalEoaAddress

`string` \| `null`

#### Returns

[`TrayWalletSource`](#traywalletsource)[]

***

### buildTrayZoraHoldings()

> **buildTrayZoraHoldings**(`rows`, `zoraMap`): [`TrayTokenHolding`](#traytokenholding)[]

Defined in: [src/components/account/trayPortfolioHelpers.ts:324](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L324)

#### Parameters

##### rows

[`TrayWalletTokenRow`](#traywallettokenrow)[]

##### zoraMap

`Record`\<`string`, `unknown` \| `null`\>

#### Returns

[`TrayTokenHolding`](#traytokenholding)[]

***

### collectTrayZoraTokenKeys()

> **collectTrayZoraTokenKeys**(...`groups`): `Set`\<`string`\>

Defined in: [src/components/account/trayPortfolioHelpers.ts:269](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L269)

#### Parameters

##### groups

...readonly readonly `object`[][]

#### Returns

`Set`\<`string`\>

***

### collectZoraLookupAddresses()

> **collectZoraLookupAddresses**(`rows`): `string`[]

Defined in: [src/components/account/trayPortfolioHelpers.ts:372](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L372)

#### Parameters

##### rows

[`TrayWalletTokenRow`](#traywallettokenrow)[]

#### Returns

`string`[]

***

### isEvmAddress()

> **isEvmAddress**(`value`): `boolean`

Defined in: [src/components/account/trayPortfolioHelpers.ts:47](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L47)

#### Parameters

##### value

`string`

#### Returns

`boolean`

***

### normalizeAddressKey()

> **normalizeAddressKey**(`value`): `string`

Defined in: [src/components/account/trayPortfolioHelpers.ts:51](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L51)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`string`

***

### parseDebankToken()

> **parseDebankToken**(`token`): \{ `amount`: `number`; `logoUrl`: `string` \| `null`; `name`: `string`; `symbol`: `string`; `tokenAddress`: `string` \| `null`; `tokenKey`: `string`; `usdValue`: `number`; \} \| `null`

Defined in: [src/components/account/trayPortfolioHelpers.ts:96](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L96)

#### Parameters

##### token

[`DebankToken`](../../lib/debank/client.md#debanktoken)

#### Returns

\{ `amount`: `number`; `logoUrl`: `string` \| `null`; `name`: `string`; `symbol`: `string`; `tokenAddress`: `string` \| `null`; `tokenKey`: `string`; `usdValue`: `number`; \} \| `null`

***

### portfolioTokenToDebankToken()

> **portfolioTokenToDebankToken**(`token`): [`DebankToken`](../../lib/debank/client.md#debanktoken)

Defined in: [src/components/account/trayPortfolioHelpers.ts:381](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L381)

#### Parameters

##### token

[`DebankPortfolioToken`](../../lib/debank/client.md#debankportfoliotoken)

#### Returns

[`DebankToken`](../../lib/debank/client.md#debanktoken)

***

### sumTrayAssetUsd()

> **sumTrayAssetUsd**(`holdings`): `number`

Defined in: [src/components/account/trayPortfolioHelpers.ts:280](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayPortfolioHelpers.ts#L280)

#### Parameters

##### holdings

readonly `object`[]

#### Returns

`number`
