[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/workspace/auth

# server/\_lib/workspace/auth

## Type Aliases

### WorkspacePermission

> **WorkspacePermission** = `"read"` \| `"strategy_manage"` \| `"tasks_manage"` \| `"settings_manage"` \| `"rooms_manage"` \| `"action_execute_low_risk"` \| `"action_execute_high_risk"`

Defined in: [server/\_lib/workspace/auth.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/auth.ts#L8)

***

### WorkspaceRole

> **WorkspaceRole** = `"OWNER"` \| `"ADMIN"` \| `"OPERATOR"` \| `"VIEWER"`

Defined in: [server/\_lib/workspace/auth.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/auth.ts#L7)

## Functions

### requireWorkspacePermission()

> **requireWorkspacePermission**(`params`): `Promise`\<`PermissionResult`\>

Defined in: [server/\_lib/workspace/auth.ts:94](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/auth.ts#L94)

#### Parameters

##### params

###### permission

[`WorkspacePermission`](#workspacepermission)

###### req

`VercelRequest`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<`PermissionResult`\>

***

### roleCan()

> **roleCan**(`params`): `boolean`

Defined in: [server/\_lib/workspace/auth.ts:75](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/auth.ts#L75)

#### Parameters

##### params

###### permission

[`WorkspacePermission`](#workspacepermission)

###### role

[`WorkspaceRole`](#workspacerole)

#### Returns

`boolean`
