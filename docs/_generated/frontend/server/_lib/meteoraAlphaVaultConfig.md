[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/meteoraAlphaVaultConfig

# server/\_lib/meteoraAlphaVaultConfig

## Type Aliases

### MeteoraAccountMeta

> **MeteoraAccountMeta** = `object`

Defined in: [server/\_lib/meteoraAlphaVaultConfig.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/meteoraAlphaVaultConfig.ts#L9)

#### Properties

##### isSigner

> **isSigner**: `boolean`

Defined in: [server/\_lib/meteoraAlphaVaultConfig.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/meteoraAlphaVaultConfig.ts#L11)

##### isWritable

> **isWritable**: `boolean`

Defined in: [server/\_lib/meteoraAlphaVaultConfig.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/meteoraAlphaVaultConfig.ts#L12)

##### pubkey

> **pubkey**: `string`

Defined in: [server/\_lib/meteoraAlphaVaultConfig.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/meteoraAlphaVaultConfig.ts#L10)

***

### MeteoraAlphaVaultConfig

> **MeteoraAlphaVaultConfig** = `object`

Defined in: [server/\_lib/meteoraAlphaVaultConfig.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/meteoraAlphaVaultConfig.ts#L15)

#### Properties

##### alphaVaultProgramId

> **alphaVaultProgramId**: `string`

Defined in: [server/\_lib/meteoraAlphaVaultConfig.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/meteoraAlphaVaultConfig.ts#L18)

##### creatorToken

> **creatorToken**: `Address`

Defined in: [server/\_lib/meteoraAlphaVaultConfig.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/meteoraAlphaVaultConfig.ts#L16)

##### depositAccounts

> **depositAccounts**: [`MeteoraAccountMeta`](#meteoraaccountmeta)[]

Defined in: [server/\_lib/meteoraAlphaVaultConfig.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/meteoraAlphaVaultConfig.ts#L19)

##### meteoraAlphaVault

> **meteoraAlphaVault**: `string`

Defined in: [server/\_lib/meteoraAlphaVaultConfig.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/meteoraAlphaVaultConfig.ts#L17)

##### quoteMint

> **quoteMint**: `string` \| `null`

Defined in: [server/\_lib/meteoraAlphaVaultConfig.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/meteoraAlphaVaultConfig.ts#L20)

##### source

> **source**: `"db"` \| `"env"`

Defined in: [server/\_lib/meteoraAlphaVaultConfig.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/meteoraAlphaVaultConfig.ts#L21)

## Variables

### SOLANA\_NATIVE\_MINT

> `const` **SOLANA\_NATIVE\_MINT**: `"So11111111111111111111111111111111111111112"` = `'So11111111111111111111111111111111111111112'`

Defined in: [server/\_lib/meteoraAlphaVaultConfig.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/meteoraAlphaVaultConfig.ts#L7)

## Functions

### resolveMeteoraAlphaVaultConfig()

> **resolveMeteoraAlphaVaultConfig**(`params`): `Promise`\<[`MeteoraAlphaVaultConfig`](#meteoraalphavaultconfig) \| `null`\>

Defined in: [server/\_lib/meteoraAlphaVaultConfig.ts:216](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/meteoraAlphaVaultConfig.ts#L216)

#### Parameters

##### params

###### creatorToken

`string`

#### Returns

`Promise`\<[`MeteoraAlphaVaultConfig`](#meteoraalphavaultconfig) \| `null`\>
