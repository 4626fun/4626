[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/lib/baseBuilderCodes

# src/lib/baseBuilderCodes

## Variables

### DATA\_SUFFIX

> `const` **DATA\_SUFFIX**: `` `0x${string}` `` \| `undefined`

Defined in: [src/lib/baseBuilderCodes.ts:192](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/baseBuilderCodes.ts#L192)

***

### ERC\_8021\_MARKER\_HEX

> `const` **ERC\_8021\_MARKER\_HEX**: `string` = `ERC_8021_REPEATING_MARKER_HEX`

Defined in: [src/lib/baseBuilderCodes.ts:193](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/baseBuilderCodes.ts#L193)

## Functions

### appendBuilderSuffixToHex()

> **appendBuilderSuffixToHex**(`data`, `options?`): `` `0x${string}` `` \| `undefined`

Defined in: [src/lib/baseBuilderCodes.ts:152](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/baseBuilderCodes.ts#L152)

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

Defined in: [src/lib/baseBuilderCodes.ts:143](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/baseBuilderCodes.ts#L143)

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

Defined in: [src/lib/baseBuilderCodes.ts:165](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/baseBuilderCodes.ts#L165)

#### Parameters

##### hexValue

`` `0x${string}` `` | `undefined`

#### Returns

`boolean`

***

### isBaseChain()

> **isBaseChain**(`chainId`): `boolean`

Defined in: [src/lib/baseBuilderCodes.ts:139](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/baseBuilderCodes.ts#L139)

#### Parameters

##### chainId

`number` | `null` | `undefined`

#### Returns

`boolean`

***

### parseBuilderCodes()

> **parseBuilderCodes**(`raw`): `string`[]

Defined in: [src/lib/baseBuilderCodes.ts:102](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/baseBuilderCodes.ts#L102)

#### Parameters

##### raw

`string` | `null` | `undefined`

#### Returns

`string`[]

***

### payloadEndsWithDataSuffix()

> **payloadEndsWithDataSuffix**(`payload`, `dataSuffix`): `boolean`

Defined in: [src/lib/baseBuilderCodes.ts:170](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/baseBuilderCodes.ts#L170)

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

Defined in: [src/lib/baseBuilderCodes.ts:109](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/baseBuilderCodes.ts#L109)

#### Parameters

##### envInput

`unknown` = `...`

#### Returns

`string`[]

***

### resolveDataSuffix()

> **resolveDataSuffix**(`envInput`): `` `0x${string}` `` \| `undefined`

Defined in: [src/lib/baseBuilderCodes.ts:116](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/baseBuilderCodes.ts#L116)

#### Parameters

##### envInput

`unknown` = `...`

#### Returns

`` `0x${string}` `` \| `undefined`

***

### warnGlobalWagmiDataSuffixBehavior()

> **warnGlobalWagmiDataSuffixBehavior**(`dataSuffix`, `envInput`): `void`

Defined in: [src/lib/baseBuilderCodes.ts:177](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/baseBuilderCodes.ts#L177)

#### Parameters

##### dataSuffix

`` `0x${string}` `` | `undefined`

##### envInput

`unknown` = `...`

#### Returns

`void`
