[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/solanaBridgeTokenMetadata

# server/\_lib/solanaBridgeTokenMetadata

## Variables

### ERC20\_METADATA\_ABI

> `const` **ERC20\_METADATA\_ABI**: readonly \[\{ `inputs`: readonly \[\]; `name`: `"name"`; `outputs`: readonly \[\{ `type`: `"string"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"symbol"`; `outputs`: readonly \[\{ `type`: `"string"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"decimals"`; `outputs`: readonly \[\{ `type`: `"uint8"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [server/\_lib/solanaBridgeTokenMetadata.ts:7](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/solanaBridgeTokenMetadata.ts#L7)

***

### WRAP\_TOKEN\_METADATA\_URI\_MAX\_LENGTH

> `const` **WRAP\_TOKEN\_METADATA\_URI\_MAX\_LENGTH**: `512` = `512`

Defined in: [server/\_lib/solanaBridgeTokenMetadata.ts:5](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/solanaBridgeTokenMetadata.ts#L5)

***

### WRAP\_TOKEN\_NAME\_MAX\_LENGTH

> `const` **WRAP\_TOKEN\_NAME\_MAX\_LENGTH**: `32` = `32`

Defined in: [server/\_lib/solanaBridgeTokenMetadata.ts:3](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/solanaBridgeTokenMetadata.ts#L3)

***

### WRAP\_TOKEN\_SYMBOL\_MAX\_LENGTH

> `const` **WRAP\_TOKEN\_SYMBOL\_MAX\_LENGTH**: `12` = `12`

Defined in: [server/\_lib/solanaBridgeTokenMetadata.ts:4](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/solanaBridgeTokenMetadata.ts#L4)

## Functions

### isLikelyUnsupportedMetadataUriFlagError()

> **isLikelyUnsupportedMetadataUriFlagError**(`message`): `boolean`

Defined in: [server/\_lib/solanaBridgeTokenMetadata.ts:100](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/solanaBridgeTokenMetadata.ts#L100)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### normalizeExactWrapTokenName()

> **normalizeExactWrapTokenName**(`raw`): `string` \| `null`

Defined in: [server/\_lib/solanaBridgeTokenMetadata.ts:65](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/solanaBridgeTokenMetadata.ts#L65)

#### Parameters

##### raw

`string`

#### Returns

`string` \| `null`

***

### normalizeExactWrapTokenSymbol()

> **normalizeExactWrapTokenSymbol**(`raw`): `string` \| `null`

Defined in: [server/\_lib/solanaBridgeTokenMetadata.ts:74](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/solanaBridgeTokenMetadata.ts#L74)

#### Parameters

##### raw

`string`

#### Returns

`string` \| `null`

***

### normalizeWrapTokenMetadataUri()

> **normalizeWrapTokenMetadataUri**(`raw`): `string` \| `null`

Defined in: [server/\_lib/solanaBridgeTokenMetadata.ts:83](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/solanaBridgeTokenMetadata.ts#L83)

#### Parameters

##### raw

`unknown`

#### Returns

`string` \| `null`

***

### readBridgeTokenMetadata()

> **readBridgeTokenMetadata**(`params`): `Promise`\<\{ `name`: `string`; `symbol`: `string`; \} \| `null`\>

Defined in: [server/\_lib/solanaBridgeTokenMetadata.ts:39](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/solanaBridgeTokenMetadata.ts#L39)

#### Parameters

##### params

###### bridgeToken

`` `0x${string}` ``

###### publicClient

`ReadContractClient`

#### Returns

`Promise`\<\{ `name`: `string`; `symbol`: `string`; \} \| `null`\>
