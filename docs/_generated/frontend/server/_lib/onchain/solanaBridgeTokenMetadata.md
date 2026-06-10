[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/onchain/solanaBridgeTokenMetadata

# server/\_lib/onchain/solanaBridgeTokenMetadata

## Variables

### ERC20\_METADATA\_ABI

> `const` **ERC20\_METADATA\_ABI**: readonly \[\{ `inputs`: readonly \[\]; `name`: `"name"`; `outputs`: readonly \[\{ `type`: `"string"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"symbol"`; `outputs`: readonly \[\{ `type`: `"string"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"decimals"`; `outputs`: readonly \[\{ `type`: `"uint8"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [server/\_lib/onchain/solanaBridgeTokenMetadata.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgeTokenMetadata.ts#L7)

***

### ~~normalizeExactWrapTokenName()~~

> `const` **normalizeExactWrapTokenName**: (`raw`) => `string` \| `null` = `normalizeWrapTokenName`

Defined in: [server/\_lib/onchain/solanaBridgeTokenMetadata.ts:107](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgeTokenMetadata.ts#L107)

Normalize a Base ERC-20 `name()` for use as a Solana bridge-wrapped mint
name. Coerces to lowercase so every creator's Solana display is uniform
regardless of how the Base token cased its name. Rejects empty, null-byte,
and oversized inputs (fail-closed). The lowercase output is what flows
into the bridge program's wrapped-token PDA seed, so the Solana mint's
on-chain identity is bound to the lowercase form.

#### Parameters

##### raw

`string`

#### Returns

`string` \| `null`

#### Deprecated

Renamed — use `normalizeWrapTokenName`. Kept as an alias so
consumers that import the old name don't break at the import layer; the
behavior changed at the same time (now lowercase-coerced, not exact-case).

***

### ~~normalizeExactWrapTokenSymbol()~~

> `const` **normalizeExactWrapTokenSymbol**: (`raw`) => `string` \| `null` = `normalizeWrapTokenSymbol`

Defined in: [server/\_lib/onchain/solanaBridgeTokenMetadata.ts:113](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgeTokenMetadata.ts#L113)

Normalize a Base ERC-20 `symbol()` for use as a Solana bridge-wrapped mint
symbol. Same lowercase policy as the name normalizer: uniform lowercase
display, fail-closed on empty/null-byte/oversized inputs.

#### Parameters

##### raw

`string`

#### Returns

`string` \| `null`

#### Deprecated

Renamed — use `normalizeWrapTokenSymbol`. Same aliasing
rationale as `normalizeExactWrapTokenName`.

***

### WRAP\_TOKEN\_METADATA\_URI\_MAX\_LENGTH

> `const` **WRAP\_TOKEN\_METADATA\_URI\_MAX\_LENGTH**: `512` = `512`

Defined in: [server/\_lib/onchain/solanaBridgeTokenMetadata.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgeTokenMetadata.ts#L5)

***

### WRAP\_TOKEN\_NAME\_MAX\_LENGTH

> `const` **WRAP\_TOKEN\_NAME\_MAX\_LENGTH**: `32` = `32`

Defined in: [server/\_lib/onchain/solanaBridgeTokenMetadata.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgeTokenMetadata.ts#L3)

***

### WRAP\_TOKEN\_SYMBOL\_MAX\_LENGTH

> `const` **WRAP\_TOKEN\_SYMBOL\_MAX\_LENGTH**: `12` = `12`

Defined in: [server/\_lib/onchain/solanaBridgeTokenMetadata.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgeTokenMetadata.ts#L4)

## Functions

### isLikelyUnsupportedMetadataUriFlagError()

> **isLikelyUnsupportedMetadataUriFlagError**(`message`): `boolean`

Defined in: [server/\_lib/onchain/solanaBridgeTokenMetadata.ts:132](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgeTokenMetadata.ts#L132)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### normalizeWrapTokenMetadataUri()

> **normalizeWrapTokenMetadataUri**(`raw`): `string` \| `null`

Defined in: [server/\_lib/onchain/solanaBridgeTokenMetadata.ts:115](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgeTokenMetadata.ts#L115)

#### Parameters

##### raw

`unknown`

#### Returns

`string` \| `null`

***

### normalizeWrapTokenName()

> **normalizeWrapTokenName**(`raw`): `string` \| `null`

Defined in: [server/\_lib/onchain/solanaBridgeTokenMetadata.ts:73](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgeTokenMetadata.ts#L73)

Normalize a Base ERC-20 `name()` for use as a Solana bridge-wrapped mint
name. Coerces to lowercase so every creator's Solana display is uniform
regardless of how the Base token cased its name. Rejects empty, null-byte,
and oversized inputs (fail-closed). The lowercase output is what flows
into the bridge program's wrapped-token PDA seed, so the Solana mint's
on-chain identity is bound to the lowercase form.

#### Parameters

##### raw

`string`

#### Returns

`string` \| `null`

***

### normalizeWrapTokenSymbol()

> **normalizeWrapTokenSymbol**(`raw`): `string` \| `null`

Defined in: [server/\_lib/onchain/solanaBridgeTokenMetadata.ts:91](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgeTokenMetadata.ts#L91)

Normalize a Base ERC-20 `symbol()` for use as a Solana bridge-wrapped mint
symbol. Same lowercase policy as the name normalizer: uniform lowercase
display, fail-closed on empty/null-byte/oversized inputs.

#### Parameters

##### raw

`string`

#### Returns

`string` \| `null`

***

### readBridgeTokenMetadata()

> **readBridgeTokenMetadata**(`params`): `Promise`\<\{ `name`: `string`; `symbol`: `string`; \} \| `null`\>

Defined in: [server/\_lib/onchain/solanaBridgeTokenMetadata.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgeTokenMetadata.ts#L39)

#### Parameters

##### params

###### bridgeToken

`string`

###### publicClient

`ReadContractClient`

#### Returns

`Promise`\<\{ `name`: `string`; `symbol`: `string`; \} \| `null`\>
