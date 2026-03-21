[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/tokens/tokenLogo

# src/lib/tokens/tokenLogo

## Type Aliases

### TokenLogoLookup

> **TokenLogoLookup** = `object`

Defined in: [src/lib/tokens/tokenLogo.ts:19](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/tokens/tokenLogo.ts#L19)

#### Properties

##### cacheHit

> **cacheHit**: `boolean`

Defined in: [src/lib/tokens/tokenLogo.ts:22](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/tokens/tokenLogo.ts#L22)

##### cacheKey

> **cacheKey**: `string`

Defined in: [src/lib/tokens/tokenLogo.ts:23](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/tokens/tokenLogo.ts#L23)

##### fallbackUrls

> **fallbackUrls**: `string`[]

Defined in: [src/lib/tokens/tokenLogo.ts:21](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/tokens/tokenLogo.ts#L21)

##### preferred

> **preferred**: `string` \| `null`

Defined in: [src/lib/tokens/tokenLogo.ts:20](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/tokens/tokenLogo.ts#L20)

***

### TokenLogoSeed

> **TokenLogoSeed** = `Pick`\<[`TokenOption`](../uniswap/swapUtils.md#tokenoption), `"address"` \| `"logoUrl"` \| `"logoUrls"`\> & `object`

Defined in: [src/lib/tokens/tokenLogo.ts:13](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/tokens/tokenLogo.ts#L13)

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

Defined in: [src/lib/tokens/tokenLogo.ts:115](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/tokens/tokenLogo.ts#L115)

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

Defined in: [src/lib/tokens/tokenLogo.ts:159](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/tokens/tokenLogo.ts#L159)

#### Parameters

##### cacheKey

`string`

##### url

`string`

#### Returns

`void`
