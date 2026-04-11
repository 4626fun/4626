[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/agent/core/resolveVaultRole

# server/agent/core/resolveVaultRole

## Type Aliases

### VaultAccessRole

> **VaultAccessRole** = `"OWNER"` \| `"ADMIN"` \| `"MEMBER"`

Defined in: [server/agent/core/resolveVaultRole.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/resolveVaultRole.ts#L6)

## Functions

### normalizeRoleAddress()

> **normalizeRoleAddress**(`value`): `` `0x${string}` `` \| `null`

Defined in: [server/agent/core/resolveVaultRole.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/resolveVaultRole.ts#L8)

#### Parameters

##### value

`unknown`

#### Returns

`` `0x${string}` `` \| `null`

***

### resolveVaultAccessRoleByGroupId()

> **resolveVaultAccessRoleByGroupId**(`params`): `Promise`\<[`VaultAccessRole`](#vaultaccessrole)\>

Defined in: [server/agent/core/resolveVaultRole.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/resolveVaultRole.ts#L40)

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

Defined in: [server/agent/core/resolveVaultRole.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/resolveVaultRole.ts#L14)

#### Parameters

##### params

###### fallbackAdmin?

`boolean`

###### vault

`Pick`\<[`KeeprVaultRow`](../../_lib/keeprRegistry.md#keeprvaultrow), `"config"` \| `"canonicalOwnerAddress"`\> \| `null` \| `undefined`

###### wallet

`string` \| `null` \| `undefined`

#### Returns

[`VaultAccessRole`](#vaultaccessrole)
