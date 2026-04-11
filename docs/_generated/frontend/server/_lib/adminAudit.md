[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/adminAudit

# server/\_lib/adminAudit

## Type Aliases

### AdminAction

> **AdminAction** = `"waitlist_approve"` \| `"waitlist_deny"` \| `"waitlist_delete"` \| `"creator_approve"` \| `"creator_deny"` \| `"creator_revoke"` \| `"creator_restore"` \| `"note_update"`

Defined in: [server/\_lib/adminAudit.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/adminAudit.ts#L37)

## Functions

### ensureAdminAuditSchema()

> **ensureAdminAuditSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/adminAudit.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/adminAudit.ts#L9)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### logAdminAction()

> **logAdminAction**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/adminAudit.ts:62](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/adminAudit.ts#L62)

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
