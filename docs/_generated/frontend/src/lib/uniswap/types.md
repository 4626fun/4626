[**creatorvault-miniapp**](../../../index.md)

***

[creatorvault-miniapp](../../../index.md) / src/lib/uniswap/types

# src/lib/uniswap/types

## Type Aliases

### HistoricalVolumeData

> **HistoricalVolumeData** = `object`

Defined in: [lib/uniswap/types.ts:96](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L96)

#### Properties

##### close?

> `optional` **close**: `number`

Defined in: [lib/uniswap/types.ts:105](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L105)

##### feesUSD

> **feesUSD**: `number`

Defined in: [lib/uniswap/types.ts:99](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L99)

##### high?

> `optional` **high**: `number`

Defined in: [lib/uniswap/types.ts:103](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L103)

##### low?

> `optional` **low**: `number`

Defined in: [lib/uniswap/types.ts:104](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L104)

##### open?

> `optional` **open**: `number`

Defined in: [lib/uniswap/types.ts:102](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L102)

##### priceUSD?

> `optional` **priceUSD**: `number`

Defined in: [lib/uniswap/types.ts:101](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L101)

##### timestamp

> **timestamp**: `number`

Defined in: [lib/uniswap/types.ts:97](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L97)

##### tvlUSD

> **tvlUSD**: `number`

Defined in: [lib/uniswap/types.ts:100](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L100)

##### volumeUSD

> **volumeUSD**: `number`

Defined in: [lib/uniswap/types.ts:98](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L98)

***

### TimeframeData

> **TimeframeData** = `object`

Defined in: [lib/uniswap/types.ts:108](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L108)

#### Properties

##### dataPoints

> **dataPoints**: [`HistoricalVolumeData`](#historicalvolumedata)[]

Defined in: [lib/uniswap/types.ts:114](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L114)

##### feesUSD

> **feesUSD**: `number`

Defined in: [lib/uniswap/types.ts:111](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L111)

##### priceChangePercent

> **priceChangePercent**: `number`

Defined in: [lib/uniswap/types.ts:113](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L113)

##### timeframe

> **timeframe**: `"1h"` \| `"1d"` \| `"1w"` \| `"1m"` \| `"1y"`

Defined in: [lib/uniswap/types.ts:109](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L109)

##### tvlUSD

> **tvlUSD**: `number`

Defined in: [lib/uniswap/types.ts:112](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L112)

##### volumeUSD

> **volumeUSD**: `number`

Defined in: [lib/uniswap/types.ts:110](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L110)

***

### UniswapPool

> **UniswapPool** = `object`

Defined in: [lib/uniswap/types.ts:65](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L65)

#### Properties

##### createdAtTimestamp

> **createdAtTimestamp**: `string`

Defined in: [lib/uniswap/types.ts:79](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L79)

##### feesUSD

> **feesUSD**: `string`

Defined in: [lib/uniswap/types.ts:75](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L75)

##### feeTier

> **feeTier**: `string`

Defined in: [lib/uniswap/types.ts:69](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L69)

##### hooks

> **hooks**: `string`

Defined in: [lib/uniswap/types.ts:78](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L78)

##### id

> **id**: `string`

Defined in: [lib/uniswap/types.ts:66](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L66)

##### liquidity

> **liquidity**: `string`

Defined in: [lib/uniswap/types.ts:70](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L70)

##### sqrtPrice

> **sqrtPrice**: `string`

Defined in: [lib/uniswap/types.ts:71](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L71)

##### token0

> **token0**: `object`

Defined in: [lib/uniswap/types.ts:67](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L67)

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

Defined in: [lib/uniswap/types.ts:72](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L72)

##### token1

> **token1**: `object`

Defined in: [lib/uniswap/types.ts:68](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L68)

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

Defined in: [lib/uniswap/types.ts:73](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L73)

##### totalValueLockedUSD

> **totalValueLockedUSD**: `string`

Defined in: [lib/uniswap/types.ts:77](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L77)

##### txCount

> **txCount**: `string`

Defined in: [lib/uniswap/types.ts:76](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L76)

##### volumeUSD

> **volumeUSD**: `string`

Defined in: [lib/uniswap/types.ts:74](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L74)

***

### UniswapPoolDayData

> **UniswapPoolDayData** = `object`

Defined in: [lib/uniswap/types.ts:6](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L6)

Uniswap V4 Subgraph Types
https://github.com/Uniswap/v4-subgraph

#### Properties

##### close

> **close**: `string`

Defined in: [lib/uniswap/types.ts:24](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L24)

##### date

> **date**: `number`

Defined in: [lib/uniswap/types.ts:8](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L8)

##### feesUSD

> **feesUSD**: `string`

Defined in: [lib/uniswap/types.ts:19](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L19)

##### high

> **high**: `string`

Defined in: [lib/uniswap/types.ts:22](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L22)

##### id

> **id**: `string`

Defined in: [lib/uniswap/types.ts:7](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L7)

##### liquidity

> **liquidity**: `string`

Defined in: [lib/uniswap/types.ts:10](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L10)

##### low

> **low**: `string`

Defined in: [lib/uniswap/types.ts:23](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L23)

##### open

> **open**: `string`

Defined in: [lib/uniswap/types.ts:21](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L21)

##### pool

> **pool**: `object`

Defined in: [lib/uniswap/types.ts:9](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L9)

###### id

> **id**: `string`

##### sqrtPrice

> **sqrtPrice**: `string`

Defined in: [lib/uniswap/types.ts:11](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L11)

##### tick

> **tick**: `number` \| `null`

Defined in: [lib/uniswap/types.ts:14](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L14)

##### token0Price

> **token0Price**: `string`

Defined in: [lib/uniswap/types.ts:12](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L12)

##### token1Price

> **token1Price**: `string`

Defined in: [lib/uniswap/types.ts:13](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L13)

##### tvlUSD

> **tvlUSD**: `string`

Defined in: [lib/uniswap/types.ts:15](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L15)

##### txCount

> **txCount**: `string`

Defined in: [lib/uniswap/types.ts:20](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L20)

##### volumeToken0

> **volumeToken0**: `string`

Defined in: [lib/uniswap/types.ts:16](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L16)

##### volumeToken1

> **volumeToken1**: `string`

Defined in: [lib/uniswap/types.ts:17](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L17)

##### volumeUSD

> **volumeUSD**: `string`

Defined in: [lib/uniswap/types.ts:18](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L18)

***

### UniswapPoolHourData

> **UniswapPoolHourData** = `object`

Defined in: [lib/uniswap/types.ts:27](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L27)

#### Properties

##### close

> **close**: `string`

Defined in: [lib/uniswap/types.ts:45](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L45)

##### feesUSD

> **feesUSD**: `string`

Defined in: [lib/uniswap/types.ts:40](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L40)

##### high

> **high**: `string`

Defined in: [lib/uniswap/types.ts:43](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L43)

##### id

> **id**: `string`

Defined in: [lib/uniswap/types.ts:28](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L28)

##### liquidity

> **liquidity**: `string`

Defined in: [lib/uniswap/types.ts:31](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L31)

##### low

> **low**: `string`

Defined in: [lib/uniswap/types.ts:44](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L44)

##### open

> **open**: `string`

Defined in: [lib/uniswap/types.ts:42](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L42)

##### periodStartUnix

> **periodStartUnix**: `number`

Defined in: [lib/uniswap/types.ts:29](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L29)

##### pool

> **pool**: `object`

Defined in: [lib/uniswap/types.ts:30](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L30)

###### id

> **id**: `string`

##### sqrtPrice

> **sqrtPrice**: `string`

Defined in: [lib/uniswap/types.ts:32](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L32)

##### tick

> **tick**: `number` \| `null`

Defined in: [lib/uniswap/types.ts:35](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L35)

##### token0Price

> **token0Price**: `string`

Defined in: [lib/uniswap/types.ts:33](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L33)

##### token1Price

> **token1Price**: `string`

Defined in: [lib/uniswap/types.ts:34](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L34)

##### tvlUSD

> **tvlUSD**: `string`

Defined in: [lib/uniswap/types.ts:36](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L36)

##### txCount

> **txCount**: `string`

Defined in: [lib/uniswap/types.ts:41](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L41)

##### volumeToken0

> **volumeToken0**: `string`

Defined in: [lib/uniswap/types.ts:37](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L37)

##### volumeToken1

> **volumeToken1**: `string`

Defined in: [lib/uniswap/types.ts:38](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L38)

##### volumeUSD

> **volumeUSD**: `string`

Defined in: [lib/uniswap/types.ts:39](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L39)

***

### UniswapToken

> **UniswapToken** = `object`

Defined in: [lib/uniswap/types.ts:82](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L82)

#### Properties

##### decimals

> **decimals**: `string`

Defined in: [lib/uniswap/types.ts:86](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L86)

##### derivedETH

> **derivedETH**: `string`

Defined in: [lib/uniswap/types.ts:93](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L93)

##### feesUSD

> **feesUSD**: `string`

Defined in: [lib/uniswap/types.ts:89](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L89)

##### id

> **id**: `string`

Defined in: [lib/uniswap/types.ts:83](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L83)

##### name

> **name**: `string`

Defined in: [lib/uniswap/types.ts:85](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L85)

##### symbol

> **symbol**: `string`

Defined in: [lib/uniswap/types.ts:84](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L84)

##### totalValueLocked

> **totalValueLocked**: `string`

Defined in: [lib/uniswap/types.ts:91](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L91)

##### totalValueLockedUSD

> **totalValueLockedUSD**: `string`

Defined in: [lib/uniswap/types.ts:92](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L92)

##### txCount

> **txCount**: `string`

Defined in: [lib/uniswap/types.ts:90](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L90)

##### volume

> **volume**: `string`

Defined in: [lib/uniswap/types.ts:87](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L87)

##### volumeUSD

> **volumeUSD**: `string`

Defined in: [lib/uniswap/types.ts:88](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L88)

***

### UniswapTokenDayData

> **UniswapTokenDayData** = `object`

Defined in: [lib/uniswap/types.ts:48](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L48)

#### Properties

##### close

> **close**: `string`

Defined in: [lib/uniswap/types.ts:62](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L62)

##### date

> **date**: `number`

Defined in: [lib/uniswap/types.ts:50](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L50)

##### feesUSD

> **feesUSD**: `string`

Defined in: [lib/uniswap/types.ts:58](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L58)

##### high

> **high**: `string`

Defined in: [lib/uniswap/types.ts:60](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L60)

##### id

> **id**: `string`

Defined in: [lib/uniswap/types.ts:49](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L49)

##### low

> **low**: `string`

Defined in: [lib/uniswap/types.ts:61](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L61)

##### open

> **open**: `string`

Defined in: [lib/uniswap/types.ts:59](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L59)

##### priceUSD

> **priceUSD**: `string`

Defined in: [lib/uniswap/types.ts:57](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L57)

##### token

> **token**: `object`

Defined in: [lib/uniswap/types.ts:51](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L51)

###### id

> **id**: `string`

###### name

> **name**: `string`

###### symbol

> **symbol**: `string`

##### totalValueLocked

> **totalValueLocked**: `string`

Defined in: [lib/uniswap/types.ts:55](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L55)

##### totalValueLockedUSD

> **totalValueLockedUSD**: `string`

Defined in: [lib/uniswap/types.ts:56](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L56)

##### untrackedVolumeUSD

> **untrackedVolumeUSD**: `string`

Defined in: [lib/uniswap/types.ts:54](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L54)

##### volume

> **volume**: `string`

Defined in: [lib/uniswap/types.ts:52](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L52)

##### volumeUSD

> **volumeUSD**: `string`

Defined in: [lib/uniswap/types.ts:53](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/uniswap/types.ts#L53)
