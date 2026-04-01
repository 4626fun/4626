[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/lib/baseBuilderCodes

# src/lib/baseBuilderCodes

## Variables

### DATA\_SUFFIX

> `const` **DATA\_SUFFIX**: `` `0x${string}` `` \| `undefined`

Defined in: [src/lib/baseBuilderCodes.ts:184](https://github.com/wenakita/4626/blob/main/frontend/src/lib/baseBuilderCodes.ts#L184)

***

### ERC\_8021\_MARKER\_HEX

> `const` **ERC\_8021\_MARKER\_HEX**: `string` = `ERC_8021_REPEATING_MARKER_HEX`

Defined in: [src/lib/baseBuilderCodes.ts:185](https://github.com/wenakita/4626/blob/main/frontend/src/lib/baseBuilderCodes.ts#L185)

## Functions

### appendBuilderSuffixToHex()

> **appendBuilderSuffixToHex**(`data`, `options?`): `` `0x${string}` `` \| `undefined`

Defined in: [src/lib/baseBuilderCodes.ts:145](https://github.com/wenakita/4626/blob/main/frontend/src/lib/baseBuilderCodes.ts#L145)

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

Defined in: [src/lib/baseBuilderCodes.ts:136](https://github.com/wenakita/4626/blob/main/frontend/src/lib/baseBuilderCodes.ts#L136)

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

Defined in: [src/lib/baseBuilderCodes.ts:158](https://github.com/wenakita/4626/blob/main/frontend/src/lib/baseBuilderCodes.ts#L158)

#### Parameters

##### hexValue

`` `0x${string}` `` | `undefined`

#### Returns

`boolean`

***

### isBaseChain()

> **isBaseChain**(`chainId`): `boolean`

Defined in: [src/lib/baseBuilderCodes.ts:132](https://github.com/wenakita/4626/blob/main/frontend/src/lib/baseBuilderCodes.ts#L132)

#### Parameters

##### chainId

`number` | `null` | `undefined`

#### Returns

`boolean`

***

### parseBuilderCodes()

> **parseBuilderCodes**(`raw`): `string`[]

Defined in: [src/lib/baseBuilderCodes.ts:95](https://github.com/wenakita/4626/blob/main/frontend/src/lib/baseBuilderCodes.ts#L95)

#### Parameters

##### raw

`string` | `null` | `undefined`

#### Returns

`string`[]

***

### payloadEndsWithDataSuffix()

> **payloadEndsWithDataSuffix**(`payload`, `dataSuffix`): `boolean`

Defined in: [src/lib/baseBuilderCodes.ts:163](https://github.com/wenakita/4626/blob/main/frontend/src/lib/baseBuilderCodes.ts#L163)

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

Defined in: [src/lib/baseBuilderCodes.ts:102](https://github.com/wenakita/4626/blob/main/frontend/src/lib/baseBuilderCodes.ts#L102)

#### Parameters

##### envInput

`unknown` = `...`

#### Returns

`string`[]

***

### resolveDataSuffix()

> **resolveDataSuffix**(`envInput`): `` `0x${string}` `` \| `undefined`

Defined in: [src/lib/baseBuilderCodes.ts:109](https://github.com/wenakita/4626/blob/main/frontend/src/lib/baseBuilderCodes.ts#L109)

#### Parameters

##### envInput

`unknown` = `...`

#### Returns

`` `0x${string}` `` \| `undefined`

***

### warnGlobalWagmiDataSuffixBehavior()

> **warnGlobalWagmiDataSuffixBehavior**(`dataSuffix`, `envInput`): `void`

Defined in: [src/lib/baseBuilderCodes.ts:170](https://github.com/wenakita/4626/blob/main/frontend/src/lib/baseBuilderCodes.ts#L170)

#### Parameters

##### dataSuffix

`` `0x${string}` `` | `undefined`

##### envInput

`unknown` = `...`

#### Returns

`void`
