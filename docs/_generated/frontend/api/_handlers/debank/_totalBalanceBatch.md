[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/\_handlers/debank/\_totalBalanceBatch

# api/\_handlers/debank/\_totalBalanceBatch

## Type Aliases

### DebankChainBalance

> **DebankChainBalance** = `object`

Defined in: [api/\_handlers/debank/\_totalBalanceBatch.ts:35](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_totalBalanceBatch.ts#L35)

#### Properties

##### id

> **id**: `string`

Defined in: [api/\_handlers/debank/\_totalBalanceBatch.ts:36](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_totalBalanceBatch.ts#L36)

##### logoUrl?

> `optional` **logoUrl**: `string`

Defined in: [api/\_handlers/debank/\_totalBalanceBatch.ts:38](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_totalBalanceBatch.ts#L38)

##### name?

> `optional` **name**: `string`

Defined in: [api/\_handlers/debank/\_totalBalanceBatch.ts:37](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_totalBalanceBatch.ts#L37)

##### usdValue

> **usdValue**: `number`

Defined in: [api/\_handlers/debank/\_totalBalanceBatch.ts:39](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_totalBalanceBatch.ts#L39)

***

### DebankTotalBalance

> **DebankTotalBalance** = `object`

Defined in: [api/\_handlers/debank/\_totalBalanceBatch.ts:42](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_totalBalanceBatch.ts#L42)

#### Properties

##### address

> **address**: `string`

Defined in: [api/\_handlers/debank/\_totalBalanceBatch.ts:43](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_totalBalanceBatch.ts#L43)

##### chains

> **chains**: [`DebankChainBalance`](#debankchainbalance)[]

Defined in: [api/\_handlers/debank/\_totalBalanceBatch.ts:45](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_totalBalanceBatch.ts#L45)

##### totalUsdValue

> **totalUsdValue**: `number`

Defined in: [api/\_handlers/debank/\_totalBalanceBatch.ts:44](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_totalBalanceBatch.ts#L44)

***

### DebankTotalBalanceBatchResponse

> **DebankTotalBalanceBatchResponse** = `object`

Defined in: [api/\_handlers/debank/\_totalBalanceBatch.ts:48](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_totalBalanceBatch.ts#L48)

#### Properties

##### asOf

> **asOf**: `number`

Defined in: [api/\_handlers/debank/\_totalBalanceBatch.ts:49](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_totalBalanceBatch.ts#L49)

##### results

> **results**: `Record`\<`string`, [`DebankTotalBalance`](#debanktotalbalance) \| `null`\>

Defined in: [api/\_handlers/debank/\_totalBalanceBatch.ts:50](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_totalBalanceBatch.ts#L50)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`any`\>

Defined in: [api/\_handlers/debank/\_totalBalanceBatch.ts:127](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_totalBalanceBatch.ts#L127)

#### Parameters

##### req

`any`

##### res

`any`

#### Returns

`Promise`\<`any`\>
