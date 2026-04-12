[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/uniswap/trading

# server/uniswap/trading

## Functions

### getUniswapApiKey()

> **getUniswapApiKey**(): `string`

Defined in: [server/uniswap/trading.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/uniswap/trading.ts#L17)

#### Returns

`string`

***

### isObject()

> **isObject**(`value`): `value is JsonObject`

Defined in: [server/uniswap/trading.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/uniswap/trading.ts#L21)

#### Parameters

##### value

`unknown`

#### Returns

`value is JsonObject`

***

### readJsonObjectBody()

> **readJsonObjectBody**(`req`): `Promise`\<`JsonObject` \| `null`\>

Defined in: [server/uniswap/trading.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/uniswap/trading.ts#L27)

#### Parameters

##### req

`VercelRequest`

#### Returns

`Promise`\<`JsonObject` \| `null`\>

***

### toCleanErrorMessage()

> **toCleanErrorMessage**(`value`, `fallback`): `string`

Defined in: [server/uniswap/trading.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/uniswap/trading.ts#L33)

#### Parameters

##### value

`unknown`

##### fallback

`string` = `'Uniswap request failed'`

#### Returns

`string`

***

### uniswapTradeFetch()

> **uniswapTradeFetch**(`params`): `Promise`\<\{ `payload`: `unknown`; `status`: `number`; \}\>

Defined in: [server/uniswap/trading.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/uniswap/trading.ts#L56)

#### Parameters

##### params

###### body?

`JsonObject`

###### headers?

`Record`\<`string`, `string`\>

###### method

`"POST"` \| `"GET"` \| `"PATCH"`

###### path

`string`

###### query?

`Record`\<`string`, `string` \| `number` \| `boolean` \| `undefined`\>

###### timeoutMs?

`number`

#### Returns

`Promise`\<\{ `payload`: `unknown`; `status`: `number`; \}\>
