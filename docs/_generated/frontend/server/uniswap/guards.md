[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/uniswap/guards

# server/uniswap/guards

## Functions

### getAllowedUniswapChainIds()

> **getAllowedUniswapChainIds**(): `Set`\<`number`\>

Defined in: [server/uniswap/guards.ts:72](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/uniswap/guards.ts#L72)

#### Returns

`Set`\<`number`\>

***

### validateAddressField()

> **validateAddressField**(`payload`, `field`): `string` \| `null`

Defined in: [server/uniswap/guards.ts:80](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/uniswap/guards.ts#L80)

#### Parameters

##### payload

`Record`\<`string`, `unknown`\>

##### field

`string`

#### Returns

`string` \| `null`

***

### validateChainIdField()

> **validateChainIdField**(`payload`, `field`): `string` \| `null`

Defined in: [server/uniswap/guards.ts:87](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/uniswap/guards.ts#L87)

#### Parameters

##### payload

`Record`\<`string`, `unknown`\>

##### field

`string`

#### Returns

`string` \| `null`

***

### validateIntegerAmountField()

> **validateIntegerAmountField**(`payload`, `field`): `string` \| `null`

Defined in: [server/uniswap/guards.ts:94](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/uniswap/guards.ts#L94)

#### Parameters

##### payload

`Record`\<`string`, `unknown`\>

##### field

`string`

#### Returns

`string` \| `null`

***

### validateQuoteTokenPolicy()

> **validateQuoteTokenPolicy**(`quote`): `string` \| `null`

Defined in: [server/uniswap/guards.ts:145](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/uniswap/guards.ts#L145)

#### Parameters

##### quote

`Record`\<`string`, `unknown`\>

#### Returns

`string` \| `null`

***

### validateRoutePolicy()

> **validateRoutePolicy**(`routing`): `string` \| `null`

Defined in: [server/uniswap/guards.ts:149](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/uniswap/guards.ts#L149)

#### Parameters

##### routing

`unknown`

#### Returns

`string` \| `null`

***

### validateTokenPolicy()

> **validateTokenPolicy**(`payload`, `fields`): `string` \| `null`

Defined in: [server/uniswap/guards.ts:113](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/uniswap/guards.ts#L113)

#### Parameters

##### payload

`Record`\<`string`, `unknown`\>

##### fields

`string`[]

#### Returns

`string` \| `null`
