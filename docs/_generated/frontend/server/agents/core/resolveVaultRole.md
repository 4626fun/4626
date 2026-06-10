[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/agents/core/resolveVaultRole

# server/agents/core/resolveVaultRole

## Type Aliases

### VaultAccessRole

> **VaultAccessRole** = `"OWNER"` \| `"ADMIN"` \| `"MEMBER"`

Defined in: [server/agents/core/resolveVaultRole.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/resolveVaultRole.ts#L6)

## Functions

### normalizeRoleAddress()

> **normalizeRoleAddress**(`value`): `string` \| `null`

Defined in: [server/agents/core/resolveVaultRole.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/resolveVaultRole.ts#L8)

#### Parameters

##### value

`unknown`

#### Returns

`string` \| `null`

***

### resolveVaultAccessRoleByGroupId()

> **resolveVaultAccessRoleByGroupId**(`params`): `Promise`\<[`VaultAccessRole`](#vaultaccessrole)\>

Defined in: [server/agents/core/resolveVaultRole.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/resolveVaultRole.ts#L40)

#### Parameters

##### params

###### fallbackAdmin?

`boolean`

###### groupId

`string`

###### wallet

`string` \| `null` \| `undefined`

#### Returns

`Promise`\<[`VaultAccessRole`](#vaultaccessrole)\>

***

### resolveVaultAccessRoleFromVault()

> **resolveVaultAccessRoleFromVault**(`params`): [`VaultAccessRole`](#vaultaccessrole)

Defined in: [server/agents/core/resolveVaultRole.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/resolveVaultRole.ts#L14)

#### Parameters

##### params

###### fallbackAdmin?

`boolean`

###### vault

`Pick`\<[`KeeprVaultRow`](../../_lib/keepr/keeprRegistry.md#keeprvaultrow), `"config"` \| `"canonicalOwnerAddress"`\> \| `null` \| `undefined`

###### wallet

`string` \| `null` \| `undefined`

#### Returns

[`VaultAccessRole`](#vaultaccessrole)
