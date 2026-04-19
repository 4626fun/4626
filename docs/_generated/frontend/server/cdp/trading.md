[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/cdp/trading

# server/cdp/trading

## Functions

### cdpTradeFetch()

> **cdpTradeFetch**(`params`): `Promise`\<\{ `payload`: `unknown`; `status`: `number`; \}\>

Defined in: [server/cdp/trading.ts:112](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/cdp/trading.ts#L112)

#### Parameters

##### params

###### body?

`JsonObject`

###### method

`"POST"`

###### path

`string`

###### timeoutMs?

`number`

#### Returns

`Promise`\<\{ `payload`: `unknown`; `status`: `number`; \}\>

***

### normalizeCdpSwapPayload()

> **normalizeCdpSwapPayload**(`raw`): `Record`\<`string`, `unknown`\> \| `null`

Defined in: [server/cdp/trading.ts:184](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/cdp/trading.ts#L184)

#### Parameters

##### raw

`unknown`

#### Returns

`Record`\<`string`, `unknown`\> \| `null`
