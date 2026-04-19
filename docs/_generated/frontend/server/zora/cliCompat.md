[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/zora/cliCompat

# server/zora/cliCompat

## Classes

### ZoraCliCompatError

Defined in: [server/zora/cliCompat.ts:103](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L103)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new ZoraCliCompatError**(`message`, `options?`): [`ZoraCliCompatError`](#zoraclicompaterror)

Defined in: [server/zora/cliCompat.ts:107](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L107)

###### Parameters

###### message

`string`

###### options?

###### status?

`number`

###### suggestion?

`string`

###### Returns

[`ZoraCliCompatError`](#zoraclicompaterror)

###### Overrides

`Error.constructor`

#### Properties

##### status

> **status**: `number`

Defined in: [server/zora/cliCompat.ts:104](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L104)

##### suggestion?

> `optional` **suggestion**: `string`

Defined in: [server/zora/cliCompat.ts:105](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L105)

## Type Aliases

### ZoraCliAuthStatusResult

> **ZoraCliAuthStatusResult** = `object`

Defined in: [server/zora/cliCompat.ts:94](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L94)

#### Properties

##### authenticated

> **authenticated**: `boolean`

Defined in: [server/zora/cliCompat.ts:95](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L95)

***

### ZoraCliCoin

> **ZoraCliCoin** = `object`

Defined in: [server/zora/cliCompat.ts:40](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L40)

#### Properties

##### address

> **address**: `string`

Defined in: [server/zora/cliCompat.ts:42](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L42)

##### coinType

> **coinType**: [`ZoraCliType`](#zoraclitype)

Defined in: [server/zora/cliCompat.ts:43](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L43)

##### createdAt

> **createdAt**: `string` \| `null`

Defined in: [server/zora/cliCompat.ts:48](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L48)

##### creatorHandle

> **creatorHandle**: `string` \| `null`

Defined in: [server/zora/cliCompat.ts:49](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L49)

##### marketCap

> **marketCap**: `string` \| `null`

Defined in: [server/zora/cliCompat.ts:45](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L45)

##### name

> **name**: `string`

Defined in: [server/zora/cliCompat.ts:41](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L41)

##### symbol

> **symbol**: `string` \| `null`

Defined in: [server/zora/cliCompat.ts:44](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L44)

##### uniqueHolders

> **uniqueHolders**: `number` \| `null`

Defined in: [server/zora/cliCompat.ts:47](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L47)

##### volume24h

> **volume24h**: `string` \| `null`

Defined in: [server/zora/cliCompat.ts:46](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L46)

***

### ZoraCliErrorPayload

> **ZoraCliErrorPayload** = `object`

Defined in: [server/zora/cliCompat.ts:98](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L98)

#### Properties

##### error

> **error**: `string`

Defined in: [server/zora/cliCompat.ts:99](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L99)

##### suggestion?

> `optional` **suggestion**: `string`

Defined in: [server/zora/cliCompat.ts:100](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L100)

***

### ZoraCliExploreResult

> **ZoraCliExploreResult** = `object`

Defined in: [server/zora/cliCompat.ts:52](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L52)

#### Properties

##### coins

> **coins**: [`ZoraCliCoin`](#zoraclicoin)[]

Defined in: [server/zora/cliCompat.ts:53](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L53)

##### nextCursor

> **nextCursor**: `string` \| `null`

Defined in: [server/zora/cliCompat.ts:54](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L54)

***

### ZoraCliGetResult

> **ZoraCliGetResult** = [`ZoraCliCoin`](#zoraclicoin)

Defined in: [server/zora/cliCompat.ts:57](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L57)

***

### ZoraCliInterval

> **ZoraCliInterval** = `"1h"` \| `"24h"` \| `"1w"` \| `"1m"` \| `"ALL"`

Defined in: [server/zora/cliCompat.ts:38](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L38)

***

### ZoraCliPriceHistoryResult

> **ZoraCliPriceHistoryResult** = `object`

Defined in: [server/zora/cliCompat.ts:81](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L81)

#### Properties

##### change

> **change**: `number` \| `null`

Defined in: [server/zora/cliCompat.ts:90](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L90)

##### coin

> **coin**: `object`

Defined in: [server/zora/cliCompat.ts:82](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L82)

###### address

> **address**: `string`

###### coinType

> **coinType**: [`ZoraCliType`](#zoraclitype)

###### name

> **name**: `string`

##### high

> **high**: `number` \| `null`

Defined in: [server/zora/cliCompat.ts:88](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L88)

##### interval

> **interval**: [`ZoraCliInterval`](#zoracliinterval)

Defined in: [server/zora/cliCompat.ts:87](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L87)

##### low

> **low**: `number` \| `null`

Defined in: [server/zora/cliCompat.ts:89](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L89)

##### prices

> **prices**: [`ZoraCliPricePoint`](#zoraclipricepoint)[]

Defined in: [server/zora/cliCompat.ts:91](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L91)

***

### ZoraCliPricePoint

> **ZoraCliPricePoint** = `object`

Defined in: [server/zora/cliCompat.ts:76](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L76)

#### Properties

##### price

> **price**: `number`

Defined in: [server/zora/cliCompat.ts:78](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L78)

##### timestamp

> **timestamp**: `string`

Defined in: [server/zora/cliCompat.ts:77](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L77)

***

### ZoraCliProfilePost

> **ZoraCliProfilePost** = `object`

Defined in: [server/zora/cliCompat.ts:59](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L59)

#### Properties

##### address

> **address**: `string`

Defined in: [server/zora/cliCompat.ts:61](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L61)

##### marketCap

> **marketCap**: `string` \| `null`

Defined in: [server/zora/cliCompat.ts:62](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L62)

##### name

> **name**: `string`

Defined in: [server/zora/cliCompat.ts:60](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L60)

##### volume24h

> **volume24h**: `string` \| `null`

Defined in: [server/zora/cliCompat.ts:63](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L63)

***

### ZoraCliProfileResult

> **ZoraCliProfileResult** = `object`

Defined in: [server/zora/cliCompat.ts:66](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L66)

#### Properties

##### nextCursor

> **nextCursor**: `string` \| `null`

Defined in: [server/zora/cliCompat.ts:73](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L73)

##### posts

> **posts**: [`ZoraCliProfilePost`](#zoracliprofilepost)[]

Defined in: [server/zora/cliCompat.ts:72](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L72)

##### profile

> **profile**: \{ `creatorCoinAddress`: `string` \| `null`; `handle`: `string` \| `null`; `id`: `string` \| `null`; \} \| `null`

Defined in: [server/zora/cliCompat.ts:67](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L67)

***

### ZoraCliSort

> **ZoraCliSort** = `"mcap"` \| `"volume"` \| `"new"` \| `"trending"` \| `"featured"`

Defined in: [server/zora/cliCompat.ts:36](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L36)

***

### ZoraCliType

> **ZoraCliType** = `"all"` \| `"creator-coin"` \| `"post"` \| `"trend"`

Defined in: [server/zora/cliCompat.ts:37](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L37)

## Functions

### authStatusCli()

> **authStatusCli**(): [`ZoraCliAuthStatusResult`](#zoracliauthstatusresult)

Defined in: [server/zora/cliCompat.ts:501](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L501)

#### Returns

[`ZoraCliAuthStatusResult`](#zoracliauthstatusresult)

***

### exploreCli()

> **exploreCli**(`params`): `Promise`\<[`ZoraCliExploreResult`](#zoracliexploreresult)\>

Defined in: [server/zora/cliCompat.ts:319](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L319)

#### Parameters

##### params

###### cursor?

`string` \| `null`

###### limit?

`number` \| `null`

###### serverKey

`string`

###### sort?

`string` \| `null`

###### type?

`string` \| `null`

#### Returns

`Promise`\<[`ZoraCliExploreResult`](#zoracliexploreresult)\>

***

### getCliCoin()

> **getCliCoin**(`params`): `Promise`\<[`ZoraCliCoin`](#zoraclicoin)\>

Defined in: [server/zora/cliCompat.ts:346](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L346)

#### Parameters

##### params

###### coinType?

`string` \| `null`

###### reference

`string`

###### serverKey

`string`

#### Returns

`Promise`\<[`ZoraCliCoin`](#zoraclicoin)\>

***

### priceHistoryCli()

> **priceHistoryCli**(`params`): `Promise`\<[`ZoraCliPriceHistoryResult`](#zoraclipricehistoryresult)\>

Defined in: [server/zora/cliCompat.ts:426](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L426)

#### Parameters

##### params

###### coinType?

`string` \| `null`

###### interval?

`string` \| `null`

###### reference

`string`

###### serverKey

`string`

#### Returns

`Promise`\<[`ZoraCliPriceHistoryResult`](#zoraclipricehistoryresult)\>

***

### profileCli()

> **profileCli**(`params`): `Promise`\<[`ZoraCliProfileResult`](#zoracliprofileresult)\>

Defined in: [server/zora/cliCompat.ts:371](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L371)

#### Parameters

##### params

###### cursor?

`string` \| `null`

###### identifier

`string`

###### limit?

`number` \| `null`

###### serverKey

`string`

#### Returns

`Promise`\<[`ZoraCliProfileResult`](#zoracliprofileresult)\>

***

### toCliErrorPayload()

> **toCliErrorPayload**(`error`, `fallbackSuggestion?`): `object`

Defined in: [server/zora/cliCompat.ts:299](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/zora/cliCompat.ts#L299)

#### Parameters

##### error

`unknown`

##### fallbackSuggestion?

`string`

#### Returns

`object`

##### body

> **body**: [`ZoraCliErrorPayload`](#zoraclierrorpayload)

##### status

> **status**: `number`
