[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/debank/client

# src/lib/debank/client

## Type Aliases

### DebankChainBalance

> **DebankChainBalance** = `object`

Defined in: [src/lib/debank/client.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L3)

#### Properties

##### id

> **id**: `string`

Defined in: [src/lib/debank/client.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L4)

##### logoUrl?

> `optional` **logoUrl**: `string`

Defined in: [src/lib/debank/client.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L6)

##### name?

> `optional` **name**: `string`

Defined in: [src/lib/debank/client.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L5)

##### usdValue

> **usdValue**: `number`

Defined in: [src/lib/debank/client.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L7)

***

### DebankToken

> **DebankToken** = `object`

Defined in: [src/lib/debank/client.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L21)

#### Properties

##### amount

> **amount**: `number`

Defined in: [src/lib/debank/client.ts:28](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L28)

##### chain?

> `optional` **chain**: `string`

Defined in: [src/lib/debank/client.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L23)

##### decimals?

> `optional` **decimals**: `number`

Defined in: [src/lib/debank/client.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L26)

##### id

> **id**: `string`

Defined in: [src/lib/debank/client.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L22)

##### logoUrl?

> `optional` **logoUrl**: `string`

Defined in: [src/lib/debank/client.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L27)

##### name?

> `optional` **name**: `string`

Defined in: [src/lib/debank/client.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L24)

##### price?

> `optional` **price**: `number`

Defined in: [src/lib/debank/client.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L29)

##### symbol?

> `optional` **symbol**: `string`

Defined in: [src/lib/debank/client.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L25)

##### usdValue

> **usdValue**: `number`

Defined in: [src/lib/debank/client.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L30)

***

### DebankTokenList

> **DebankTokenList** = `object`

Defined in: [src/lib/debank/client.ts:33](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L33)

#### Properties

##### address

> **address**: `string`

Defined in: [src/lib/debank/client.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L35)

##### asOf

> **asOf**: `number`

Defined in: [src/lib/debank/client.ts:34](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L34)

##### chainId

> **chainId**: `string`

Defined in: [src/lib/debank/client.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L36)

##### tokens

> **tokens**: [`DebankToken`](#debanktoken)[]

Defined in: [src/lib/debank/client.ts:37](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L37)

***

### DebankTotalBalance

> **DebankTotalBalance** = `object`

Defined in: [src/lib/debank/client.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L10)

#### Properties

##### address

> **address**: `string`

Defined in: [src/lib/debank/client.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L11)

##### chains

> **chains**: [`DebankChainBalance`](#debankchainbalance)[]

Defined in: [src/lib/debank/client.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L13)

##### totalUsdValue

> **totalUsdValue**: `number`

Defined in: [src/lib/debank/client.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L12)

***

### DebankTotalBalanceBatch

> **DebankTotalBalanceBatch** = `object`

Defined in: [src/lib/debank/client.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L16)

#### Properties

##### asOf

> **asOf**: `number`

Defined in: [src/lib/debank/client.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L17)

##### results

> **results**: `Record`\<`string`, [`DebankTotalBalance`](#debanktotalbalance) \| `null`\>

Defined in: [src/lib/debank/client.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L18)

## Functions

### fetchDebankTokenList()

> **fetchDebankTokenList**(`params`): `Promise`\<[`DebankTokenList`](#debanktokenlist) \| `null`\>

Defined in: [src/lib/debank/client.ts:103](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L103)

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

Defined in: [src/lib/debank/client.ts:70](https://github.com/wenakita/4626/blob/main/frontend/src/lib/debank/client.ts#L70)

#### Parameters

##### params

###### addresses

`string`[]

#### Returns

`Promise`\<[`DebankTotalBalanceBatch`](#debanktotalbalancebatch) \| `null`\>
