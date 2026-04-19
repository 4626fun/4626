[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/\_handlers/debank/\_tokenList

# api/\_handlers/debank/\_tokenList

## Type Aliases

### DebankToken

> **DebankToken** = `object`

Defined in: [api/\_handlers/debank/\_tokenList.ts:38](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_tokenList.ts#L38)

#### Properties

##### amount

> **amount**: `number`

Defined in: [api/\_handlers/debank/\_tokenList.ts:45](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_tokenList.ts#L45)

##### chain?

> `optional` **chain**: `string`

Defined in: [api/\_handlers/debank/\_tokenList.ts:40](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_tokenList.ts#L40)

##### decimals?

> `optional` **decimals**: `number`

Defined in: [api/\_handlers/debank/\_tokenList.ts:43](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_tokenList.ts#L43)

##### id

> **id**: `string`

Defined in: [api/\_handlers/debank/\_tokenList.ts:39](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_tokenList.ts#L39)

##### logoUrl?

> `optional` **logoUrl**: `string`

Defined in: [api/\_handlers/debank/\_tokenList.ts:44](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_tokenList.ts#L44)

##### name?

> `optional` **name**: `string`

Defined in: [api/\_handlers/debank/\_tokenList.ts:41](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_tokenList.ts#L41)

##### price?

> `optional` **price**: `number`

Defined in: [api/\_handlers/debank/\_tokenList.ts:46](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_tokenList.ts#L46)

##### symbol?

> `optional` **symbol**: `string`

Defined in: [api/\_handlers/debank/\_tokenList.ts:42](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_tokenList.ts#L42)

##### usdValue

> **usdValue**: `number`

Defined in: [api/\_handlers/debank/\_tokenList.ts:47](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_tokenList.ts#L47)

***

### DebankTokenListResponse

> **DebankTokenListResponse** = `object`

Defined in: [api/\_handlers/debank/\_tokenList.ts:50](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_tokenList.ts#L50)

#### Properties

##### address

> **address**: `string`

Defined in: [api/\_handlers/debank/\_tokenList.ts:52](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_tokenList.ts#L52)

##### asOf

> **asOf**: `number`

Defined in: [api/\_handlers/debank/\_tokenList.ts:51](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_tokenList.ts#L51)

##### chainId

> **chainId**: `string`

Defined in: [api/\_handlers/debank/\_tokenList.ts:53](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_tokenList.ts#L53)

##### tokens

> **tokens**: [`DebankToken`](#debanktoken)[]

Defined in: [api/\_handlers/debank/\_tokenList.ts:54](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_tokenList.ts#L54)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/debank/\_tokenList.ts:88](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/debank/_tokenList.ts#L88)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
