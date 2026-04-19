[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/onchain/creatorRegistryVerification

# server/\_lib/onchain/creatorRegistryVerification

## Type Aliases

### CreatorRegistryBindingInput

> **CreatorRegistryBindingInput** = `object`

Defined in: [server/\_lib/onchain/creatorRegistryVerification.ts:41](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/creatorRegistryVerification.ts#L41)

#### Properties

##### creatorCoinAddress

> **creatorCoinAddress**: `string`

Defined in: [server/\_lib/onchain/creatorRegistryVerification.ts:42](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/creatorRegistryVerification.ts#L42)

##### shareTokenAddress?

> `optional` **shareTokenAddress**: `string` \| `null`

Defined in: [server/\_lib/onchain/creatorRegistryVerification.ts:44](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/creatorRegistryVerification.ts#L44)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/\_lib/onchain/creatorRegistryVerification.ts:43](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/creatorRegistryVerification.ts#L43)

***

### CreatorRegistryValidationResult

> **CreatorRegistryValidationResult** = \{ `ok`: `true`; \} \| \{ `ok`: `false`; `reason`: `CreatorRegistryValidationReason`; \}

Defined in: [server/\_lib/onchain/creatorRegistryVerification.ts:37](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/creatorRegistryVerification.ts#L37)

## Functions

### validateCreatorRegistryBinding()

> **validateCreatorRegistryBinding**(`input`): `Promise`\<[`CreatorRegistryValidationResult`](#creatorregistryvalidationresult)\>

Defined in: [server/\_lib/onchain/creatorRegistryVerification.ts:76](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/creatorRegistryVerification.ts#L76)

#### Parameters

##### input

[`CreatorRegistryBindingInput`](#creatorregistrybindinginput)

#### Returns

`Promise`\<[`CreatorRegistryValidationResult`](#creatorregistryvalidationresult)\>
