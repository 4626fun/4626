[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/admin/adminAudit

# server/\_lib/admin/adminAudit

## Type Aliases

### AdminAction

> **AdminAction** = `"waitlist_approve"` \| `"waitlist_deny"` \| `"waitlist_delete"` \| `"waitlist_regenerate_points_dry_run"` \| `"waitlist_regenerate_points_execute"` \| `"profile_merge_dry_run"` \| `"profile_merge_execute"` \| `"creator_approve"` \| `"creator_deny"` \| `"creator_revoke"` \| `"creator_restore"` \| `"note_update"`

Defined in: [server/\_lib/admin/adminAudit.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/admin/adminAudit.ts#L39)

## Functions

### ensureAdminAuditSchema()

> **ensureAdminAuditSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/admin/adminAudit.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/admin/adminAudit.ts#L11)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### logAdminAction()

> **logAdminAction**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/admin/adminAudit.ts:100](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/admin/adminAudit.ts#L100)

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
