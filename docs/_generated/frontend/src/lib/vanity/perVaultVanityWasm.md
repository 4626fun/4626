[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/vanity/perVaultVanityWasm

# src/lib/vanity/perVaultVanityWasm

## Type Aliases

### PerVaultVanitySearchInput

> **PerVaultVanitySearchInput** = `object`

Defined in: [src/lib/vanity/perVaultVanityWasm.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/lib/vanity/perVaultVanityWasm.ts#L3)

#### Properties

##### baseVersion

> **baseVersion**: `string`

Defined in: [src/lib/vanity/perVaultVanityWasm.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/vanity/perVaultVanityWasm.ts#L8)

##### chainId

> **chainId**: `number`

Defined in: [src/lib/vanity/perVaultVanityWasm.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/lib/vanity/perVaultVanityWasm.ts#L7)

##### create2Deployer

> **create2Deployer**: `string`

Defined in: [src/lib/vanity/perVaultVanityWasm.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/lib/vanity/perVaultVanityWasm.ts#L4)

##### creatorToken

> **creatorToken**: `string`

Defined in: [src/lib/vanity/perVaultVanityWasm.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/vanity/perVaultVanityWasm.ts#L5)

##### maxAttempts

> **maxAttempts**: `number`

Defined in: [src/lib/vanity/perVaultVanityWasm.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/lib/vanity/perVaultVanityWasm.ts#L12)

##### owner

> **owner**: `string`

Defined in: [src/lib/vanity/perVaultVanityWasm.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/vanity/perVaultVanityWasm.ts#L6)

##### shareOftInitCodeHash?

> `optional` **shareOftInitCodeHash**: `string` \| `null`

Defined in: [src/lib/vanity/perVaultVanityWasm.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/lib/vanity/perVaultVanityWasm.ts#L14)

##### shareSuffix?

> `optional` **shareSuffix**: `string` \| `null`

Defined in: [src/lib/vanity/perVaultVanityWasm.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/lib/vanity/perVaultVanityWasm.ts#L10)

##### shareSymbol?

> `optional` **shareSymbol**: `string` \| `null`

Defined in: [src/lib/vanity/perVaultVanityWasm.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/lib/vanity/perVaultVanityWasm.ts#L15)

##### startAttempt?

> `optional` **startAttempt**: `number`

Defined in: [src/lib/vanity/perVaultVanityWasm.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/vanity/perVaultVanityWasm.ts#L11)

##### vaultInitCodeHash?

> `optional` **vaultInitCodeHash**: `string` \| `null`

Defined in: [src/lib/vanity/perVaultVanityWasm.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/lib/vanity/perVaultVanityWasm.ts#L13)

##### vaultPrefix?

> `optional` **vaultPrefix**: `string` \| `null`

Defined in: [src/lib/vanity/perVaultVanityWasm.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/vanity/perVaultVanityWasm.ts#L9)

***

### PerVaultVanitySearchResult

> **PerVaultVanitySearchResult** = `object`

Defined in: [src/lib/vanity/perVaultVanityWasm.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/vanity/perVaultVanityWasm.ts#L18)

#### Properties

##### attempt

> **attempt**: `number`

Defined in: [src/lib/vanity/perVaultVanityWasm.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/lib/vanity/perVaultVanityWasm.ts#L20)

##### attempts

> **attempts**: `number`

Defined in: [src/lib/vanity/perVaultVanityWasm.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/lib/vanity/perVaultVanityWasm.ts#L21)

##### shareOftAddress

> **shareOftAddress**: `string` \| `null`

Defined in: [src/lib/vanity/perVaultVanityWasm.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/lib/vanity/perVaultVanityWasm.ts#L23)

##### shareOftSalt

> **shareOftSalt**: `string` \| `null`

Defined in: [src/lib/vanity/perVaultVanityWasm.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/lib/vanity/perVaultVanityWasm.ts#L25)

##### vaultAddress

> **vaultAddress**: `string` \| `null`

Defined in: [src/lib/vanity/perVaultVanityWasm.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/lib/vanity/perVaultVanityWasm.ts#L22)

##### vaultSalt

> **vaultSalt**: `string` \| `null`

Defined in: [src/lib/vanity/perVaultVanityWasm.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/lib/vanity/perVaultVanityWasm.ts#L24)

##### version

> **version**: `string`

Defined in: [src/lib/vanity/perVaultVanityWasm.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/vanity/perVaultVanityWasm.ts#L19)

## Functions

### findPerVaultVanityVersionWithWasm()

> **findPerVaultVanityVersionWithWasm**(`input`): `Promise`\<[`PerVaultVanitySearchResult`](#pervaultvanitysearchresult)\>

Defined in: [src/lib/vanity/perVaultVanityWasm.ts:43](https://github.com/wenakita/4626/blob/main/frontend/src/lib/vanity/perVaultVanityWasm.ts#L43)

#### Parameters

##### input

[`PerVaultVanitySearchInput`](#pervaultvanitysearchinput)

#### Returns

`Promise`\<[`PerVaultVanitySearchResult`](#pervaultvanitysearchresult)\>
