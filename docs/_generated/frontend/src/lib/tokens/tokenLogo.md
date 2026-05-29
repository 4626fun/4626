[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/tokens/tokenLogo

# src/lib/tokens/tokenLogo

## Type Aliases

### TokenLogoLookup

> **TokenLogoLookup** = `object`

Defined in: [src/lib/tokens/tokenLogo.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tokens/tokenLogo.ts#L15)

#### Properties

##### cacheHit

> **cacheHit**: `boolean`

Defined in: [src/lib/tokens/tokenLogo.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tokens/tokenLogo.ts#L18)

##### cacheKey

> **cacheKey**: `string`

Defined in: [src/lib/tokens/tokenLogo.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tokens/tokenLogo.ts#L19)

##### fallbackUrls

> **fallbackUrls**: `string`[]

Defined in: [src/lib/tokens/tokenLogo.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tokens/tokenLogo.ts#L17)

##### preferred

> **preferred**: `string` \| `null`

Defined in: [src/lib/tokens/tokenLogo.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tokens/tokenLogo.ts#L16)

***

### TokenLogoSeed

> **TokenLogoSeed** = `Pick`\<[`TokenOption`](../uniswap/swapUtils.md#tokenoption), `"address"` \| `"logoUrl"` \| `"logoUrls"`\> & `object`

Defined in: [src/lib/tokens/tokenLogo.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tokens/tokenLogo.ts#L9)

#### Type Declaration

##### chainId?

> `optional` **chainId**: `number`

##### group?

> `optional` **group**: [`TokenOption`](../uniswap/swapUtils.md#tokenoption)\[`"group"`\]

##### symbol?

> `optional` **symbol**: `string`

## Functions

### getTokenLogo()

> **getTokenLogo**(`token`): [`TokenLogoLookup`](#tokenlogolookup)

Defined in: [src/lib/tokens/tokenLogo.ts:121](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tokens/tokenLogo.ts#L121)

Build a deterministic logo list in priority order.
It includes curated metadata first, then curated fallbacks by chain.
Returns the cached successful URL separately to avoid stale broken chains.

#### Parameters

##### token

[`TokenLogoSeed`](#tokenlogoseed)

#### Returns

[`TokenLogoLookup`](#tokenlogolookup)

***

### markTokenLogoSuccess()

> **markTokenLogoSuccess**(`cacheKey`, `url`): `void`

Defined in: [src/lib/tokens/tokenLogo.ts:165](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tokens/tokenLogo.ts#L165)

#### Parameters

##### cacheKey

`string`

##### url

`string`

#### Returns

`void`
