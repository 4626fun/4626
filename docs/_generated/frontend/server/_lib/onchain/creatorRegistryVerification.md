[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/onchain/creatorRegistryVerification

# server/\_lib/onchain/creatorRegistryVerification

## Type Aliases

### CreatorRegistryBindingInput

> **CreatorRegistryBindingInput** = `object`

Defined in: [server/\_lib/onchain/creatorRegistryVerification.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/creatorRegistryVerification.ts#L53)

#### Properties

##### creatorCoinAddress

> **creatorCoinAddress**: `string`

Defined in: [server/\_lib/onchain/creatorRegistryVerification.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/creatorRegistryVerification.ts#L54)

##### shareTokenAddress?

> `optional` **shareTokenAddress**: `string` \| `null`

Defined in: [server/\_lib/onchain/creatorRegistryVerification.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/creatorRegistryVerification.ts#L56)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/\_lib/onchain/creatorRegistryVerification.ts:55](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/creatorRegistryVerification.ts#L55)

***

### CreatorRegistryValidationReason

> **CreatorRegistryValidationReason** = `"invalid_input"` \| `"creator_coin_inactive"` \| `"vault_mismatch"` \| `"share_token_mismatch"` \| `"grandfathered_vault_asset_mismatch"` \| `"grandfathered_vault_not_deployed"`

Defined in: [server/\_lib/onchain/creatorRegistryVerification.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/creatorRegistryVerification.ts#L31)

***

### CreatorRegistryValidationResult

> **CreatorRegistryValidationResult** = \{ `mode?`: `"registry"` \| `"grandfathered_onchain"`; `ok`: `true`; \} \| \{ `ok`: `false`; `reason`: [`CreatorRegistryValidationReason`](#creatorregistryvalidationreason); \}

Defined in: [server/\_lib/onchain/creatorRegistryVerification.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/creatorRegistryVerification.ts#L39)

## Functions

### shouldAttemptGrandfatheredKeeperFallback()

> **shouldAttemptGrandfatheredKeeperFallback**(`reason`): `boolean`

Defined in: [server/\_lib/onchain/creatorRegistryVerification.ts:208](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/creatorRegistryVerification.ts#L208)

Strict registry reasons that may still pass via on-chain vault.asset() binding.

#### Parameters

##### reason

[`CreatorRegistryValidationReason`](#creatorregistryvalidationreason)

#### Returns

`boolean`

***

### validateCreatorRegistryBinding()

> **validateCreatorRegistryBinding**(`input`): `Promise`\<[`CreatorRegistryValidationResult`](#creatorregistryvalidationresult)\>

Defined in: [server/\_lib/onchain/creatorRegistryVerification.ts:88](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/creatorRegistryVerification.ts#L88)

#### Parameters

##### input

[`CreatorRegistryBindingInput`](#creatorregistrybindinginput)

#### Returns

`Promise`\<[`CreatorRegistryValidationResult`](#creatorregistryvalidationresult)\>

***

### validateKeeperVaultListing()

> **validateKeeperVaultListing**(`input`): `Promise`\<[`CreatorRegistryValidationResult`](#creatorregistryvalidationresult)\>

Defined in: [server/\_lib/onchain/creatorRegistryVerification.ts:222](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/creatorRegistryVerification.ts#L222)

Keeper listing validation: strict CreatorRegistry binding first, then on-chain
grandfathered fallback for pre-registry vaults (for example AKITA).

#### Parameters

##### input

[`CreatorRegistryBindingInput`](#creatorregistrybindinginput)

#### Returns

`Promise`\<[`CreatorRegistryValidationResult`](#creatorregistryvalidationresult)\>
