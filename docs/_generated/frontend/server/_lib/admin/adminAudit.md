[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/admin/adminAudit

# server/\_lib/admin/adminAudit

## Type Aliases

### AdminAction

> **AdminAction** = `"waitlist_approve"` \| `"waitlist_deny"` \| `"waitlist_delete"` \| `"waitlist_regenerate_points_dry_run"` \| `"waitlist_regenerate_points_execute"` \| `"profile_merge_dry_run"` \| `"profile_merge_execute"` \| `"creator_approve"` \| `"creator_deny"` \| `"creator_revoke"` \| `"creator_restore"` \| `"note_update"`

Defined in: [server/\_lib/admin/adminAudit.ts:37](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/admin/adminAudit.ts#L37)

## Functions

### ensureAdminAuditSchema()

> **ensureAdminAuditSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/admin/adminAudit.ts:9](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/admin/adminAudit.ts#L9)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### logAdminAction()

> **logAdminAction**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/admin/adminAudit.ts:66](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/admin/adminAudit.ts#L66)

#### Parameters

##### params

###### action

[`AdminAction`](#adminaction)

###### adminAddress

`string`

###### db

`Db`

###### details?

`Record`\<`string`, `any`\>

###### ipAddress?

`string`

###### targetId

`string` \| `number`

###### targetType

`"profile"` \| `"access_request"` \| `"allowlist"`

#### Returns

`Promise`\<`void`\>
