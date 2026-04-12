[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/vault/vaultWorkspaceQuery

# src/features/vault/vaultWorkspaceQuery

## Functions

### isWorkspaceTab()

> **isWorkspaceTab**(`value`): `value is WorkspaceTabId`

Defined in: [src/features/vault/vaultWorkspaceQuery.ts:13](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/vault/vaultWorkspaceQuery.ts#L13)

#### Parameters

##### value

`string` | `null`

#### Returns

`value is WorkspaceTabId`

***

### parseVaultWorkspaceQuery()

> **parseVaultWorkspaceQuery**(`searchParams`): `object`

Defined in: [src/features/vault/vaultWorkspaceQuery.ts:17](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/vault/vaultWorkspaceQuery.ts#L17)

#### Parameters

##### searchParams

`URLSearchParams`

#### Returns

`object`

##### panel

> **panel**: `"workspace"` \| `"manage"`

##### tab

> **tab**: [`WorkspaceTabId`](../../lib/workspace/types.md#workspacetabid)

##### taskId

> **taskId**: `number` \| `null`

***

### updateVaultWorkspaceQuery()

> **updateVaultWorkspaceQuery**(`params`): `URLSearchParams`

Defined in: [src/features/vault/vaultWorkspaceQuery.ts:34](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/vault/vaultWorkspaceQuery.ts#L34)

#### Parameters

##### params

###### current

`URLSearchParams`

###### panel

`"workspace"` \| `"manage"`

###### tab?

[`WorkspaceTabId`](../../lib/workspace/types.md#workspacetabid)

###### taskId?

`number` \| `null`

#### Returns

`URLSearchParams`
