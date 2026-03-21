[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/uniswap/types

# src/lib/uniswap/types

## Type Aliases

### HistoricalVolumeData

> **HistoricalVolumeData** = `object`

Defined in: [src/lib/uniswap/types.ts:112](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L112)

#### Properties

##### close?

> `optional` **close**: `number`

Defined in: [src/lib/uniswap/types.ts:121](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L121)

##### feesUSD

> **feesUSD**: `number`

Defined in: [src/lib/uniswap/types.ts:115](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L115)

##### high?

> `optional` **high**: `number`

Defined in: [src/lib/uniswap/types.ts:119](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L119)

##### low?

> `optional` **low**: `number`

Defined in: [src/lib/uniswap/types.ts:120](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L120)

##### open?

> `optional` **open**: `number`

Defined in: [src/lib/uniswap/types.ts:118](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L118)

##### priceUSD?

> `optional` **priceUSD**: `number`

Defined in: [src/lib/uniswap/types.ts:117](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L117)

##### timestamp

> **timestamp**: `number`

Defined in: [src/lib/uniswap/types.ts:113](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L113)

##### tvlUSD

> **tvlUSD**: `number`

Defined in: [src/lib/uniswap/types.ts:116](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L116)

##### volumeUSD

> **volumeUSD**: `number`

Defined in: [src/lib/uniswap/types.ts:114](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L114)

***

### TimeframeData

> **TimeframeData** = `object`

Defined in: [src/lib/uniswap/types.ts:124](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L124)

#### Properties

##### dataPoints

> **dataPoints**: [`HistoricalVolumeData`](#historicalvolumedata)[]

Defined in: [src/lib/uniswap/types.ts:130](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L130)

##### feesUSD

> **feesUSD**: `number`

Defined in: [src/lib/uniswap/types.ts:127](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L127)

##### priceChangePercent

> **priceChangePercent**: `number`

Defined in: [src/lib/uniswap/types.ts:129](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L129)

##### timeframe

> **timeframe**: `"1h"` \| `"1d"` \| `"1w"` \| `"1m"` \| `"1y"`

Defined in: [src/lib/uniswap/types.ts:125](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L125)

##### tvlUSD

> **tvlUSD**: `number`

Defined in: [src/lib/uniswap/types.ts:128](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L128)

##### volumeUSD

> **volumeUSD**: `number`

Defined in: [src/lib/uniswap/types.ts:126](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L126)

***

### UniswapPool

> **UniswapPool** = `object`

Defined in: [src/lib/uniswap/types.ts:65](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L65)

#### Properties

##### createdAtTimestamp

> **createdAtTimestamp**: `string`

Defined in: [src/lib/uniswap/types.ts:79](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L79)

##### feesUSD

> **feesUSD**: `string`

Defined in: [src/lib/uniswap/types.ts:75](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L75)

##### feeTier

> **feeTier**: `string`

Defined in: [src/lib/uniswap/types.ts:69](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L69)

##### hooks

> **hooks**: `string`

Defined in: [src/lib/uniswap/types.ts:78](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L78)

##### id

> **id**: `string`

Defined in: [src/lib/uniswap/types.ts:66](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L66)

##### liquidity

> **liquidity**: `string`

Defined in: [src/lib/uniswap/types.ts:70](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L70)

##### sqrtPrice

> **sqrtPrice**: `string`

Defined in: [src/lib/uniswap/types.ts:71](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L71)

##### token0

> **token0**: `object`

Defined in: [src/lib/uniswap/types.ts:67](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L67)

###### decimals

> **decimals**: `string`

###### id

> **id**: `string`

###### name

> **name**: `string`

###### symbol

> **symbol**: `string`

##### token0Price

> **token0Price**: `string`

Defined in: [src/lib/uniswap/types.ts:72](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L72)

##### token1

> **token1**: `object`

Defined in: [src/lib/uniswap/types.ts:68](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L68)

###### decimals

> **decimals**: `string`

###### id

> **id**: `string`

###### name

> **name**: `string`

###### symbol

> **symbol**: `string`

##### token1Price

> **token1Price**: `string`

Defined in: [src/lib/uniswap/types.ts:73](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L73)

##### totalValueLockedUSD

> **totalValueLockedUSD**: `string`

Defined in: [src/lib/uniswap/types.ts:77](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L77)

##### txCount

> **txCount**: `string`

Defined in: [src/lib/uniswap/types.ts:76](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L76)

##### volumeUSD

> **volumeUSD**: `string`

Defined in: [src/lib/uniswap/types.ts:74](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L74)

***

### UniswapPoolDayData

> **UniswapPoolDayData** = `object`

Defined in: [src/lib/uniswap/types.ts:6](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L6)

Uniswap V4 Subgraph Types
https://github.com/Uniswap/v4-subgraph

#### Properties

##### close

> **close**: `string`

Defined in: [src/lib/uniswap/types.ts:24](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L24)

##### date

> **date**: `number`

Defined in: [src/lib/uniswap/types.ts:8](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L8)

##### feesUSD

> **feesUSD**: `string`

Defined in: [src/lib/uniswap/types.ts:19](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L19)

##### high

> **high**: `string`

Defined in: [src/lib/uniswap/types.ts:22](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L22)

##### id

> **id**: `string`

Defined in: [src/lib/uniswap/types.ts:7](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L7)

##### liquidity

> **liquidity**: `string`

Defined in: [src/lib/uniswap/types.ts:10](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L10)

##### low

> **low**: `string`

Defined in: [src/lib/uniswap/types.ts:23](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L23)

##### open

> **open**: `string`

Defined in: [src/lib/uniswap/types.ts:21](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L21)

##### pool

> **pool**: `object`

Defined in: [src/lib/uniswap/types.ts:9](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L9)

###### id

> **id**: `string`

##### sqrtPrice

> **sqrtPrice**: `string`

Defined in: [src/lib/uniswap/types.ts:11](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L11)

##### tick

> **tick**: `number` \| `null`

Defined in: [src/lib/uniswap/types.ts:14](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L14)

##### token0Price

> **token0Price**: `string`

Defined in: [src/lib/uniswap/types.ts:12](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L12)

##### token1Price

> **token1Price**: `string`

Defined in: [src/lib/uniswap/types.ts:13](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L13)

##### tvlUSD

> **tvlUSD**: `string`

Defined in: [src/lib/uniswap/types.ts:15](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L15)

##### txCount

> **txCount**: `string`

Defined in: [src/lib/uniswap/types.ts:20](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L20)

##### volumeToken0

> **volumeToken0**: `string`

Defined in: [src/lib/uniswap/types.ts:16](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L16)

##### volumeToken1

> **volumeToken1**: `string`

Defined in: [src/lib/uniswap/types.ts:17](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L17)

##### volumeUSD

> **volumeUSD**: `string`

Defined in: [src/lib/uniswap/types.ts:18](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L18)

***

### UniswapPoolHourData

> **UniswapPoolHourData** = `object`

Defined in: [src/lib/uniswap/types.ts:27](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L27)

#### Properties

##### close

> **close**: `string`

Defined in: [src/lib/uniswap/types.ts:45](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L45)

##### feesUSD

> **feesUSD**: `string`

Defined in: [src/lib/uniswap/types.ts:40](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L40)

##### high

> **high**: `string`

Defined in: [src/lib/uniswap/types.ts:43](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L43)

##### id

> **id**: `string`

Defined in: [src/lib/uniswap/types.ts:28](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L28)

##### liquidity

> **liquidity**: `string`

Defined in: [src/lib/uniswap/types.ts:31](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L31)

##### low

> **low**: `string`

Defined in: [src/lib/uniswap/types.ts:44](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L44)

##### open

> **open**: `string`

Defined in: [src/lib/uniswap/types.ts:42](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L42)

##### periodStartUnix

> **periodStartUnix**: `number`

Defined in: [src/lib/uniswap/types.ts:29](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L29)

##### pool

> **pool**: `object`

Defined in: [src/lib/uniswap/types.ts:30](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L30)

###### id

> **id**: `string`

##### sqrtPrice

> **sqrtPrice**: `string`

Defined in: [src/lib/uniswap/types.ts:32](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L32)

##### tick

> **tick**: `number` \| `null`

Defined in: [src/lib/uniswap/types.ts:35](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L35)

##### token0Price

> **token0Price**: `string`

Defined in: [src/lib/uniswap/types.ts:33](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L33)

##### token1Price

> **token1Price**: `string`

Defined in: [src/lib/uniswap/types.ts:34](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L34)

##### tvlUSD

> **tvlUSD**: `string`

Defined in: [src/lib/uniswap/types.ts:36](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L36)

##### txCount

> **txCount**: `string`

Defined in: [src/lib/uniswap/types.ts:41](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L41)

##### volumeToken0

> **volumeToken0**: `string`

Defined in: [src/lib/uniswap/types.ts:37](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L37)

##### volumeToken1

> **volumeToken1**: `string`

Defined in: [src/lib/uniswap/types.ts:38](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L38)

##### volumeUSD

> **volumeUSD**: `string`

Defined in: [src/lib/uniswap/types.ts:39](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L39)

***

### UniswapSwap

> **UniswapSwap** = `object`

Defined in: [src/lib/uniswap/types.ts:82](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L82)

#### Properties

##### amount0

> **amount0**: `string`

Defined in: [src/lib/uniswap/types.ts:93](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L93)

##### amount1

> **amount1**: `string`

Defined in: [src/lib/uniswap/types.ts:94](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L94)

##### amountUSD

> **amountUSD**: `string`

Defined in: [src/lib/uniswap/types.ts:95](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L95)

##### id

> **id**: `string`

Defined in: [src/lib/uniswap/types.ts:83](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L83)

##### origin

> **origin**: `string`

Defined in: [src/lib/uniswap/types.ts:92](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L92)

##### sender

> **sender**: `string`

Defined in: [src/lib/uniswap/types.ts:91](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L91)

##### timestamp

> **timestamp**: `string`

Defined in: [src/lib/uniswap/types.ts:84](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L84)

##### token0

> **token0**: `object`

Defined in: [src/lib/uniswap/types.ts:89](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L89)

###### decimals

> **decimals**: `string`

###### id

> **id**: `string`

###### symbol

> **symbol**: `string`

##### token1

> **token1**: `object`

Defined in: [src/lib/uniswap/types.ts:90](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L90)

###### decimals

> **decimals**: `string`

###### id

> **id**: `string`

###### symbol

> **symbol**: `string`

##### transaction

> **transaction**: `object`

Defined in: [src/lib/uniswap/types.ts:85](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L85)

###### id

> **id**: `string`

###### timestamp

> **timestamp**: `string`

***

### UniswapToken

> **UniswapToken** = `object`

Defined in: [src/lib/uniswap/types.ts:98](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L98)

#### Properties

##### decimals

> **decimals**: `string`

Defined in: [src/lib/uniswap/types.ts:102](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L102)

##### derivedETH

> **derivedETH**: `string`

Defined in: [src/lib/uniswap/types.ts:109](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L109)

##### feesUSD

> **feesUSD**: `string`

Defined in: [src/lib/uniswap/types.ts:105](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L105)

##### id

> **id**: `string`

Defined in: [src/lib/uniswap/types.ts:99](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L99)

##### name

> **name**: `string`

Defined in: [src/lib/uniswap/types.ts:101](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L101)

##### symbol

> **symbol**: `string`

Defined in: [src/lib/uniswap/types.ts:100](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L100)

##### totalValueLocked

> **totalValueLocked**: `string`

Defined in: [src/lib/uniswap/types.ts:107](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L107)

##### totalValueLockedUSD

> **totalValueLockedUSD**: `string`

Defined in: [src/lib/uniswap/types.ts:108](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L108)

##### txCount

> **txCount**: `string`

Defined in: [src/lib/uniswap/types.ts:106](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L106)

##### volume

> **volume**: `string`

Defined in: [src/lib/uniswap/types.ts:103](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L103)

##### volumeUSD

> **volumeUSD**: `string`

Defined in: [src/lib/uniswap/types.ts:104](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L104)

***

### UniswapTokenDayData

> **UniswapTokenDayData** = `object`

Defined in: [src/lib/uniswap/types.ts:48](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L48)

#### Properties

##### close

> **close**: `string`

Defined in: [src/lib/uniswap/types.ts:62](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L62)

##### date

> **date**: `number`

Defined in: [src/lib/uniswap/types.ts:50](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L50)

##### feesUSD

> **feesUSD**: `string`

Defined in: [src/lib/uniswap/types.ts:58](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L58)

##### high

> **high**: `string`

Defined in: [src/lib/uniswap/types.ts:60](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L60)

##### id

> **id**: `string`

Defined in: [src/lib/uniswap/types.ts:49](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L49)

##### low

> **low**: `string`

Defined in: [src/lib/uniswap/types.ts:61](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L61)

##### open

> **open**: `string`

Defined in: [src/lib/uniswap/types.ts:59](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L59)

##### priceUSD

> **priceUSD**: `string`

Defined in: [src/lib/uniswap/types.ts:57](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L57)

##### token

> **token**: `object`

Defined in: [src/lib/uniswap/types.ts:51](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L51)

###### id

> **id**: `string`

###### name

> **name**: `string`

###### symbol

> **symbol**: `string`

##### totalValueLocked

> **totalValueLocked**: `string`

Defined in: [src/lib/uniswap/types.ts:55](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L55)

##### totalValueLockedUSD

> **totalValueLockedUSD**: `string`

Defined in: [src/lib/uniswap/types.ts:56](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L56)

##### untrackedVolumeUSD

> **untrackedVolumeUSD**: `string`

Defined in: [src/lib/uniswap/types.ts:54](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L54)

##### volume

> **volume**: `string`

Defined in: [src/lib/uniswap/types.ts:52](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L52)

##### volumeUSD

> **volumeUSD**: `string`

Defined in: [src/lib/uniswap/types.ts:53](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/uniswap/types.ts#L53)
