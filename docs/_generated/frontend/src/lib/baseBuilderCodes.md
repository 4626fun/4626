[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/lib/baseBuilderCodes

# src/lib/baseBuilderCodes

## Variables

### DATA\_SUFFIX

> `const` **DATA\_SUFFIX**: `` `0x${string}` `` \| `undefined`

Defined in: [src/lib/baseBuilderCodes.ts:159](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/baseBuilderCodes.ts#L159)

***

### ERC\_8021\_MARKER\_HEX

> `const` **ERC\_8021\_MARKER\_HEX**: `string` = `ERC_8021_REPEATING_MARKER_HEX`

Defined in: [src/lib/baseBuilderCodes.ts:160](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/baseBuilderCodes.ts#L160)

## Functions

### appendBuilderSuffixToHex()

> **appendBuilderSuffixToHex**(`data`, `options?`): `` `0x${string}` `` \| `undefined`

Defined in: [src/lib/baseBuilderCodes.ts:120](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/baseBuilderCodes.ts#L120)

#### Parameters

##### data

`` `0x${string}` `` | `undefined`

##### options?

###### chainId?

`number` \| `null`

###### dataSuffix?

`` `0x${string}` ``

#### Returns

`` `0x${string}` `` \| `undefined`

***

### appendDataSuffixToHex()

> **appendDataSuffixToHex**(`data`, `dataSuffix`): `` `0x${string}` ``

Defined in: [src/lib/baseBuilderCodes.ts:111](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/baseBuilderCodes.ts#L111)

#### Parameters

##### data

`` `0x${string}` `` | `undefined`

##### dataSuffix

`` `0x${string}` ``

#### Returns

`` `0x${string}` ``

***

### hasErc8021RepeatingMarker()

> **hasErc8021RepeatingMarker**(`hexValue`): `boolean`

Defined in: [src/lib/baseBuilderCodes.ts:133](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/baseBuilderCodes.ts#L133)

#### Parameters

##### hexValue

`` `0x${string}` `` | `undefined`

#### Returns

`boolean`

***

### isBaseChain()

> **isBaseChain**(`chainId`): `boolean`

Defined in: [src/lib/baseBuilderCodes.ts:107](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/baseBuilderCodes.ts#L107)

#### Parameters

##### chainId

`number` | `null` | `undefined`

#### Returns

`boolean`

***

### parseBuilderCodes()

> **parseBuilderCodes**(`raw`): `string`[]

Defined in: [src/lib/baseBuilderCodes.ts:70](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/baseBuilderCodes.ts#L70)

#### Parameters

##### raw

`string` | `null` | `undefined`

#### Returns

`string`[]

***

### payloadEndsWithDataSuffix()

> **payloadEndsWithDataSuffix**(`payload`, `dataSuffix`): `boolean`

Defined in: [src/lib/baseBuilderCodes.ts:138](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/baseBuilderCodes.ts#L138)

#### Parameters

##### payload

`` `0x${string}` `` | `undefined`

##### dataSuffix

`` `0x${string}` ``

#### Returns

`boolean`

***

### resolveBuilderCodes()

> **resolveBuilderCodes**(`envInput`): `string`[]

Defined in: [src/lib/baseBuilderCodes.ts:77](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/baseBuilderCodes.ts#L77)

#### Parameters

##### envInput

`unknown` = `...`

#### Returns

`string`[]

***

### resolveDataSuffix()

> **resolveDataSuffix**(`envInput`): `` `0x${string}` `` \| `undefined`

Defined in: [src/lib/baseBuilderCodes.ts:84](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/baseBuilderCodes.ts#L84)

#### Parameters

##### envInput

`unknown` = `...`

#### Returns

`` `0x${string}` `` \| `undefined`

***

### warnGlobalWagmiDataSuffixBehavior()

> **warnGlobalWagmiDataSuffixBehavior**(`dataSuffix`, `envInput`): `void`

Defined in: [src/lib/baseBuilderCodes.ts:145](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/baseBuilderCodes.ts#L145)

#### Parameters

##### dataSuffix

`` `0x${string}` `` | `undefined`

##### envInput

`unknown` = `...`

#### Returns

`void`
