[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/uniswap/swapUtils

# src/lib/uniswap/swapUtils

## Type Aliases

### ChainTokenConfig

> **ChainTokenConfig** = `object`

Defined in: [src/lib/uniswap/swapUtils.ts:69](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L69)

#### Properties

##### chainId

> **chainId**: `number`

Defined in: [src/lib/uniswap/swapUtils.ts:70](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L70)

##### nativeName

> **nativeName**: `string`

Defined in: [src/lib/uniswap/swapUtils.ts:72](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L72)

##### nativeSymbol

> **nativeSymbol**: `string`

Defined in: [src/lib/uniswap/swapUtils.ts:71](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L71)

##### usdc

> **usdc**: `string`

Defined in: [src/lib/uniswap/swapUtils.ts:74](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L74)

##### weth

> **weth**: `string`

Defined in: [src/lib/uniswap/swapUtils.ts:73](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L73)

***

### TokenDisplay

> **TokenDisplay** = `object`

Defined in: [src/lib/uniswap/swapUtils.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L19)

#### Properties

##### logoUrl

> **logoUrl**: `string` \| `null`

Defined in: [src/lib/uniswap/swapUtils.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L22)

##### logoUrls?

> `optional` **logoUrls**: `string`[]

Defined in: [src/lib/uniswap/swapUtils.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L23)

##### name

> **name**: `string`

Defined in: [src/lib/uniswap/swapUtils.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L21)

##### symbol

> **symbol**: `string`

Defined in: [src/lib/uniswap/swapUtils.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L20)

***

### TokenGroup

> **TokenGroup** = `"core"` \| `"creator"` \| `"share"`

Defined in: [src/lib/uniswap/swapUtils.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L6)

***

### TokenOption

> **TokenOption** = `object`

Defined in: [src/lib/uniswap/swapUtils.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L8)

#### Properties

##### address

> **address**: `string`

Defined in: [src/lib/uniswap/swapUtils.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L11)

##### chainId?

> `optional` **chainId**: `number`

Defined in: [src/lib/uniswap/swapUtils.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L13)

##### decimals?

> `optional` **decimals**: `number`

Defined in: [src/lib/uniswap/swapUtils.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L14)

##### group

> **group**: [`TokenGroup`](#tokengroup)

Defined in: [src/lib/uniswap/swapUtils.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L12)

##### logoUrl?

> `optional` **logoUrl**: `string`

Defined in: [src/lib/uniswap/swapUtils.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L15)

##### logoUrls?

> `optional` **logoUrls**: `string`[]

Defined in: [src/lib/uniswap/swapUtils.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L16)

##### name

> **name**: `string`

Defined in: [src/lib/uniswap/swapUtils.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L10)

##### symbol

> **symbol**: `string`

Defined in: [src/lib/uniswap/swapUtils.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L9)

## Variables

### BASE\_CHAIN\_ID

> `const` **BASE\_CHAIN\_ID**: `8453` = `8453`

Defined in: [src/lib/uniswap/swapUtils.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L3)

***

### NATIVE\_TOKEN\_ADDRESS

> `const` **NATIVE\_TOKEN\_ADDRESS**: `"0x0000000000000000000000000000000000000000"` = `'0x0000000000000000000000000000000000000000'`

Defined in: [src/lib/uniswap/swapUtils.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L4)

## Functions

### areEquivalentSwapTokens()

> **areEquivalentSwapTokens**(`tokenA`, `tokenB`, `wrappedNativeAddress?`): `boolean`

Defined in: [src/lib/uniswap/swapUtils.ts:184](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L184)

#### Parameters

##### tokenA

`string` | `null` | `undefined`

##### tokenB

`string` | `null` | `undefined`

##### wrappedNativeAddress?

`string` | `null`

#### Returns

`boolean`

***

### buildTokenOptions()

> **buildTokenOptions**(`params`): [`TokenOption`](#tokenoption)[]

Defined in: [src/lib/uniswap/swapUtils.ts:216](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L216)

#### Parameters

##### params

###### chainId?

`number`

###### coreTokens

[`TokenOption`](#tokenoption)[]

###### creatorCoin?

`string` \| `null`

###### creatorCoinVerified?

`boolean`

###### shareCoin?

`string` \| `null`

###### shareLabelVerified?

`boolean`

###### shareName?

`string` \| `null`

###### shareSymbol?

`string` \| `null`

#### Returns

[`TokenOption`](#tokenoption)[]

***

### creatorCoinRawLogo()

> **creatorCoinRawLogo**(`address`, `chainId`): `string`

Defined in: [src/lib/uniswap/swapUtils.ts:115](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L115)

#### Parameters

##### address

`string`

##### chainId

`number` = `BASE_CHAIN_ID`

#### Returns

`string`

***

### getCoreTokensForChain()

> **getCoreTokensForChain**(`config`): [`TokenOption`](#tokenoption)[]

Defined in: [src/lib/uniswap/swapUtils.ts:77](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L77)

#### Parameters

##### config

[`ChainTokenConfig`](#chaintokenconfig)

#### Returns

[`TokenOption`](#tokenoption)[]

***

### getNestedAmountOut()

> **getNestedAmountOut**(`input`): `string` \| `null`

Defined in: [src/lib/uniswap/swapUtils.ts:157](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L157)

#### Parameters

##### input

`unknown`

#### Returns

`string` \| `null`

***

### normalizeTokenAddress()

> **normalizeTokenAddress**(`value`): `string` \| `null`

Defined in: [src/lib/uniswap/swapUtils.ts:178](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L178)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`string` \| `null`

***

### resolveTokenDisplay()

> **resolveTokenDisplay**(`params`): [`TokenDisplay`](#tokendisplay)

Defined in: [src/lib/uniswap/swapUtils.ts:257](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L257)

#### Parameters

##### params

###### address

`string`

###### imageUrl

`string` \| `null` \| `undefined`

###### onchain

\{ `name?`: `string`; `symbol?`: `string`; \} \| `null` \| `undefined`

###### option

[`TokenOption`](#tokenoption) \| `null`

#### Returns

[`TokenDisplay`](#tokendisplay)

***

### sanitizeDecimalInput()

> **sanitizeDecimalInput**(`value`, `maxFractionDigits`): `string`

Defined in: [src/lib/uniswap/swapUtils.ts:134](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L134)

#### Parameters

##### value

`string`

##### maxFractionDigits

`number` = `18`

#### Returns

`string`

***

### sanitizeIntegerInput()

> **sanitizeIntegerInput**(`value`, `maxDigits`): `string`

Defined in: [src/lib/uniswap/swapUtils.ts:151](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L151)

#### Parameters

##### value

`string`

##### maxDigits

`number` = `4`

#### Returns

`string`

***

### shareTokenLogo()

> **shareTokenLogo**(`address`, `chainId`, `size`): `string`

Defined in: [src/lib/uniswap/swapUtils.ts:110](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L110)

#### Parameters

##### address

`string`

##### chainId

`number` = `BASE_CHAIN_ID`

##### size

`number` = `128`

#### Returns

`string`

***

### shortAddress()

> **shortAddress**(`value`): `string`

Defined in: [src/lib/uniswap/swapUtils.ts:129](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L129)

#### Parameters

##### value

`string`

#### Returns

`string`

***

### tokenLogoFallbacks()

> **tokenLogoFallbacks**(`address`): `string`[]

Defined in: [src/lib/uniswap/swapUtils.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L38)

#### Parameters

##### address

`string`

#### Returns

`string`[]

***

### tokenLogoFallbacksForChain()

> **tokenLogoFallbacksForChain**(`address`, `chainId`): `string`[]

Defined in: [src/lib/uniswap/swapUtils.ts:60](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L60)

#### Parameters

##### address

`string`

##### chainId

`number`

#### Returns

`string`[]

***

### trustWalletBaseLogo()

> **trustWalletBaseLogo**(`address`): `string`

Defined in: [src/lib/uniswap/swapUtils.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L30)

#### Parameters

##### address

`string`

#### Returns

`string`

***

### uniqueTokenOptions()

> **uniqueTokenOptions**(`options`): [`TokenOption`](#tokenoption)[]

Defined in: [src/lib/uniswap/swapUtils.ts:204](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L204)

#### Parameters

##### options

[`TokenOption`](#tokenoption)[]

#### Returns

[`TokenOption`](#tokenoption)[]

***

### uniswapBaseLogo()

> **uniswapBaseLogo**(`address`): `string`

Defined in: [src/lib/uniswap/swapUtils.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L26)

#### Parameters

##### address

`string`

#### Returns

`string`

***

### uniswapChainLogo()

> **uniswapChainLogo**(`address`, `chainId`): `string`

Defined in: [src/lib/uniswap/swapUtils.ts:55](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L55)

#### Parameters

##### address

`string`

##### chainId

`number`

#### Returns

`string`

***

### z0r0zBaseLogo()

> **z0r0zBaseLogo**(`address`): `string`

Defined in: [src/lib/uniswap/swapUtils.ts:34](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapUtils.ts#L34)

#### Parameters

##### address

`string`

#### Returns

`string`
