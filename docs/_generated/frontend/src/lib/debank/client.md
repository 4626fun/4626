[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/debank/client

# src/lib/debank/client

## Type Aliases

### AccountTrayPortfolio

> **AccountTrayPortfolio** = [`DebankWalletPortfolio`](#debankwalletportfolio)

Defined in: [src/lib/debank/client.ts:69](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L69)

Unified tray snapshot (DeBank or Base/etherscan fallback).

***

### AccountTrayPortfolioBatch

> **AccountTrayPortfolioBatch** = `object`

Defined in: [src/lib/debank/client.ts:71](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L71)

#### Properties

##### asOf

> **asOf**: `number`

Defined in: [src/lib/debank/client.ts:72](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L72)

##### results

> **results**: `Record`\<`string`, [`AccountTrayPortfolio`](#accounttrayportfolio) \| `null`\>

Defined in: [src/lib/debank/client.ts:73](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L73)

##### sources

> **sources**: `Record`\<`string`, [`TrayPortfolioSource`](#trayportfoliosource) \| `null`\>

Defined in: [src/lib/debank/client.ts:74](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L74)

***

### DebankChainBalance

> **DebankChainBalance** = `object`

Defined in: [src/lib/debank/client.ts:4](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L4)

#### Properties

##### id

> **id**: `string`

Defined in: [src/lib/debank/client.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L5)

##### logoUrl?

> `optional` **logoUrl**: `string`

Defined in: [src/lib/debank/client.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L7)

##### name?

> `optional` **name**: `string`

Defined in: [src/lib/debank/client.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L6)

##### usdValue

> **usdValue**: `number`

Defined in: [src/lib/debank/client.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L8)

***

### DebankPortfolioToken

> **DebankPortfolioToken** = `object`

Defined in: [src/lib/debank/client.ts:41](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L41)

#### Properties

##### amount

> **amount**: `number`

Defined in: [src/lib/debank/client.ts:47](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L47)

##### chain

> **chain**: `string`

Defined in: [src/lib/debank/client.ts:43](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L43)

##### id

> **id**: `string`

Defined in: [src/lib/debank/client.ts:42](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L42)

##### logoUrl?

> `optional` **logoUrl**: `string`

Defined in: [src/lib/debank/client.ts:46](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L46)

##### name

> **name**: `string`

Defined in: [src/lib/debank/client.ts:44](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L44)

##### price

> **price**: `number`

Defined in: [src/lib/debank/client.ts:48](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L48)

##### symbol

> **symbol**: `string`

Defined in: [src/lib/debank/client.ts:45](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L45)

##### usdValue

> **usdValue**: `number`

Defined in: [src/lib/debank/client.ts:49](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L49)

***

### DebankToken

> **DebankToken** = `object`

Defined in: [src/lib/debank/client.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L22)

#### Properties

##### amount

> **amount**: `number`

Defined in: [src/lib/debank/client.ts:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L29)

##### chain?

> `optional` **chain**: `string`

Defined in: [src/lib/debank/client.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L24)

##### decimals?

> `optional` **decimals**: `number`

Defined in: [src/lib/debank/client.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L27)

##### id

> **id**: `string`

Defined in: [src/lib/debank/client.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L23)

##### logoUrl?

> `optional` **logoUrl**: `string`

Defined in: [src/lib/debank/client.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L28)

##### name?

> `optional` **name**: `string`

Defined in: [src/lib/debank/client.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L25)

##### price?

> `optional` **price**: `number`

Defined in: [src/lib/debank/client.ts:30](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L30)

##### symbol?

> `optional` **symbol**: `string`

Defined in: [src/lib/debank/client.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L26)

##### usdValue

> **usdValue**: `number`

Defined in: [src/lib/debank/client.ts:31](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L31)

***

### DebankTokenList

> **DebankTokenList** = `object`

Defined in: [src/lib/debank/client.ts:34](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L34)

#### Properties

##### address

> **address**: `string`

Defined in: [src/lib/debank/client.ts:36](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L36)

##### asOf

> **asOf**: `number`

Defined in: [src/lib/debank/client.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L35)

##### chainId

> **chainId**: `string`

Defined in: [src/lib/debank/client.ts:37](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L37)

##### tokens

> **tokens**: [`DebankToken`](#debanktoken)[]

Defined in: [src/lib/debank/client.ts:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L38)

***

### DebankTotalBalance

> **DebankTotalBalance** = `object`

Defined in: [src/lib/debank/client.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L11)

#### Properties

##### address

> **address**: `string`

Defined in: [src/lib/debank/client.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L12)

##### chains

> **chains**: [`DebankChainBalance`](#debankchainbalance)[]

Defined in: [src/lib/debank/client.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L14)

##### totalUsdValue

> **totalUsdValue**: `number`

Defined in: [src/lib/debank/client.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L13)

***

### DebankTotalBalanceBatch

> **DebankTotalBalanceBatch** = `object`

Defined in: [src/lib/debank/client.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L17)

#### Properties

##### asOf

> **asOf**: `number`

Defined in: [src/lib/debank/client.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L18)

##### results

> **results**: `Record`\<`string`, [`DebankTotalBalance`](#debanktotalbalance) \| `null`\>

Defined in: [src/lib/debank/client.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L19)

***

### DebankWalletPortfolio

> **DebankWalletPortfolio** = `object`

Defined in: [src/lib/debank/client.ts:52](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L52)

#### Properties

##### activeChains

> **activeChains**: `object`[]

Defined in: [src/lib/debank/client.ts:56](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L56)

###### id

> **id**: `string`

###### logoUrl?

> `optional` **logoUrl**: `string`

###### name

> **name**: `string`

###### usdValue

> **usdValue**: `number`

##### address

> **address**: `string`

Defined in: [src/lib/debank/client.ts:53](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L53)

##### asOf

> **asOf**: `number`

Defined in: [src/lib/debank/client.ts:58](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L58)

##### protocols

> **protocols**: `object`[]

Defined in: [src/lib/debank/client.ts:57](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L57)

###### chain

> **chain**: `string`

###### id

> **id**: `string`

###### logoUrl?

> `optional` **logoUrl**: `string`

###### name

> **name**: `string`

###### netUsdValue

> **netUsdValue**: `number`

###### siteUrl?

> `optional` **siteUrl**: `string`

##### topTokens

> **topTokens**: [`DebankPortfolioToken`](#debankportfoliotoken)[]

Defined in: [src/lib/debank/client.ts:55](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L55)

##### totalUsdValue

> **totalUsdValue**: `number`

Defined in: [src/lib/debank/client.ts:54](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L54)

***

### DebankWalletPortfolioBatch

> **DebankWalletPortfolioBatch** = `object`

Defined in: [src/lib/debank/client.ts:61](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L61)

#### Properties

##### asOf

> **asOf**: `number`

Defined in: [src/lib/debank/client.ts:62](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L62)

##### results

> **results**: `Record`\<`string`, [`DebankWalletPortfolio`](#debankwalletportfolio) \| `null`\>

Defined in: [src/lib/debank/client.ts:63](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L63)

***

### TrayPortfolioSource

> **TrayPortfolioSource** = `"debank"` \| `"base-etherscan"`

Defined in: [src/lib/debank/client.ts:66](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L66)

## Functions

### fetchAccountTrayPortfolioBatch()

> **fetchAccountTrayPortfolioBatch**(`params`): `Promise`\<[`AccountTrayPortfolioBatch`](#accounttrayportfoliobatch) \| `null`\>

Defined in: [src/lib/debank/client.ts:191](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L191)

Account tray: DeBank lite first, Base Etherscan fallback — single request.

#### Parameters

##### params

###### addresses

`string`[]

###### topTokenCount?

`number`

#### Returns

`Promise`\<[`AccountTrayPortfolioBatch`](#accounttrayportfoliobatch) \| `null`\>

***

### fetchDebankTokenList()

> **fetchDebankTokenList**(`params`): `Promise`\<[`DebankTokenList`](#debanktokenlist) \| `null`\>

Defined in: [src/lib/debank/client.ts:140](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L140)

#### Parameters

##### params

###### address

`string`

###### chainId?

`string`

#### Returns

`Promise`\<[`DebankTokenList`](#debanktokenlist) \| `null`\>

***

### fetchDebankTotalBalanceBatch()

> **fetchDebankTotalBalanceBatch**(`params`): `Promise`\<[`DebankTotalBalanceBatch`](#debanktotalbalancebatch) \| `null`\>

Defined in: [src/lib/debank/client.ts:107](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L107)

#### Parameters

##### params

###### addresses

`string`[]

#### Returns

`Promise`\<[`DebankTotalBalanceBatch`](#debanktotalbalancebatch) \| `null`\>

***

### fetchDebankWalletPortfolioBatch()

> **fetchDebankWalletPortfolioBatch**(`params`): `Promise`\<[`DebankWalletPortfolioBatch`](#debankwalletportfoliobatch) \| `null`\>

Defined in: [src/lib/debank/client.ts:154](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/debank/client.ts#L154)

#### Parameters

##### params

###### addresses

`string`[]

###### topTokenCount?

`number`

#### Returns

`Promise`\<[`DebankWalletPortfolioBatch`](#debankwalletportfoliobatch) \| `null`\>
