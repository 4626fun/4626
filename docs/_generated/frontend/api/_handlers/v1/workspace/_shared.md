[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / api/\_handlers/v1/workspace/\_shared

# api/\_handlers/v1/workspace/\_shared

## Type Aliases

### WorkspaceAccessContext

> **WorkspaceAccessContext** = `Awaited`\<`ReturnType`\<*typeof* [`requireWorkspacePermission`](../../../../server/_lib/workspace/auth.md#requireworkspacepermission)\>\> *extends* infer TResult ? `TResult` *extends* `object` ? `TResult` : `never` : `never`

Defined in: [api/\_handlers/v1/workspace/\_shared.ts:6](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/workspace/_shared.ts#L6)

## Functions

### isAddressLike()

> **isAddressLike**(`value`): `` value is `0x${string}` ``

Defined in: [api/\_handlers/v1/workspace/\_shared.ts:14](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/workspace/_shared.ts#L14)

#### Parameters

##### value

`string`

#### Returns

`` value is `0x${string}` ``

***

### normalizeVaultAddressFromQuery()

> **normalizeVaultAddressFromQuery**(`req`): `` `0x${string}` `` \| `null`

Defined in: [api/\_handlers/v1/workspace/\_shared.ts:18](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/workspace/_shared.ts#L18)

#### Parameters

##### req

`VercelRequest`

#### Returns

`` `0x${string}` `` \| `null`

***

### readNumberQuery()

> **readNumberQuery**(`req`, `key`): `number` \| `null`

Defined in: [api/\_handlers/v1/workspace/\_shared.ts:34](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/workspace/_shared.ts#L34)

#### Parameters

##### req

`VercelRequest`

##### key

`string`

#### Returns

`number` \| `null`

***

### readStringQuery()

> **readStringQuery**(`req`, `key`): `string` \| `null`

Defined in: [api/\_handlers/v1/workspace/\_shared.ts:25](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/workspace/_shared.ts#L25)

#### Parameters

##### req

`VercelRequest`

##### key

`string`

#### Returns

`string` \| `null`

***

### requireWorkspaceAccess()

> **requireWorkspaceAccess**(`params`): `Promise`\<\{ `context`: \{ `activeOwnerWalletAddress`: `` `0x${string}` `` \| `null`; `canonicalSmartWalletAddress`: `` `0x${string}` `` \| `null`; `ok`: `true`; `principalAddress`: `` `0x${string}` ``; `profileId`: `number` \| `null`; `role`: [`WorkspaceRole`](../../../../server/_lib/workspace/auth.md#workspacerole); `signerRole`: `"canonical_smart_wallet"` \| `"active_owner_wallet"` \| `null`; `vault`: [`KeeprVaultRow`](../../../../server/_lib/keepr/keeprRegistry.md#keeprvaultrow); \}; `ok`: `true`; \} \| \{ `error`: `string`; `ok`: `false`; `status`: `number`; \}\>

Defined in: [api/\_handlers/v1/workspace/\_shared.ts:41](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/workspace/_shared.ts#L41)

#### Parameters

##### params

###### permission

[`WorkspacePermission`](../../../../server/_lib/workspace/auth.md#workspacepermission)

###### req

`VercelRequest`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `context`: \{ `activeOwnerWalletAddress`: `` `0x${string}` `` \| `null`; `canonicalSmartWalletAddress`: `` `0x${string}` `` \| `null`; `ok`: `true`; `principalAddress`: `` `0x${string}` ``; `profileId`: `number` \| `null`; `role`: [`WorkspaceRole`](../../../../server/_lib/workspace/auth.md#workspacerole); `signerRole`: `"canonical_smart_wallet"` \| `"active_owner_wallet"` \| `null`; `vault`: [`KeeprVaultRow`](../../../../server/_lib/keepr/keeprRegistry.md#keeprvaultrow); \}; `ok`: `true`; \} \| \{ `error`: `string`; `ok`: `false`; `status`: `number`; \}\>
