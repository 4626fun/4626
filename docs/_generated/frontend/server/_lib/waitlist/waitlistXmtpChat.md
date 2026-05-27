[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/waitlist/waitlistXmtpChat

# server/\_lib/waitlist/waitlistXmtpChat

## Type Aliases

### WaitlistChatEligibility

> **WaitlistChatEligibility** = [`WaitlistChatEligibilitySnapshot`](waitlistXmtpChatEligibility.md#waitlistchateligibilitysnapshot)

Defined in: [server/\_lib/waitlist/waitlistXmtpChat.ts:71](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChat.ts#L71)

***

### WaitlistGroupIdResolution

> **WaitlistGroupIdResolution** = `object`

Defined in: [server/\_lib/waitlist/waitlistXmtpChat.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChat.ts#L28)

#### Properties

##### envGroupId

> **envGroupId**: `string` \| `null`

Defined in: [server/\_lib/waitlist/waitlistXmtpChat.ts:31](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChat.ts#L31)

##### groupId

> **groupId**: `string` \| `null`

Defined in: [server/\_lib/waitlist/waitlistXmtpChat.ts:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChat.ts#L29)

##### mismatched

> **mismatched**: `boolean`

Defined in: [server/\_lib/waitlist/waitlistXmtpChat.ts:33](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChat.ts#L33)

##### source

> **source**: `"vault"` \| `"env"` \| `null`

Defined in: [server/\_lib/waitlist/waitlistXmtpChat.ts:30](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChat.ts#L30)

##### vaultGroupId

> **vaultGroupId**: `string` \| `null`

Defined in: [server/\_lib/waitlist/waitlistXmtpChat.ts:32](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChat.ts#L32)

## Variables

### WAITLIST\_CHAT\_VAULT\_ADDRESS

> `const` **WAITLIST\_CHAT\_VAULT\_ADDRESS**: `"0x0000000000000000000000000000000000004626"`

Defined in: [server/\_lib/waitlist/waitlistXmtpChat.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChat.ts#L11)

## Functions

### getWaitlistGroupId()

> **getWaitlistGroupId**(): `string` \| `null`

Defined in: [server/\_lib/waitlist/waitlistXmtpChat.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChat.ts#L21)

#### Returns

`string` \| `null`

***

### getWaitlistGroupName()

> **getWaitlistGroupName**(): `string`

Defined in: [server/\_lib/waitlist/waitlistXmtpChat.ts:61](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChat.ts#L61)

#### Returns

`string`

***

### isWaitlistChatVaultConfigured()

> **isWaitlistChatVaultConfigured**(): `Promise`\<`boolean`\>

Defined in: [server/\_lib/waitlist/waitlistXmtpChat.ts:66](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChat.ts#L66)

#### Returns

`Promise`\<`boolean`\>

***

### normalizeWaitlistChatAddress()

> **normalizeWaitlistChatAddress**(`value`): `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/waitlist/waitlistXmtpChat.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChat.ts#L15)

#### Parameters

##### value

`unknown`

#### Returns

`` `0x${string}` `` \| `null`

***

### resolveWaitlistChatEligibility()

> **resolveWaitlistChatEligibility**(`db`, `profileId`): `Promise`\<[`WaitlistChatEligibilitySnapshot`](waitlistXmtpChatEligibility.md#waitlistchateligibilitysnapshot)\>

Defined in: [server/\_lib/waitlist/waitlistXmtpChat.ts:73](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChat.ts#L73)

#### Parameters

##### db

`Db`

##### profileId

`number`

#### Returns

`Promise`\<[`WaitlistChatEligibilitySnapshot`](waitlistXmtpChatEligibility.md#waitlistchateligibilitysnapshot)\>

***

### resolveWaitlistGroupId()

> **resolveWaitlistGroupId**(): `Promise`\<[`WaitlistGroupIdResolution`](#waitlistgroupidresolution)\>

Defined in: [server/\_lib/waitlist/waitlistXmtpChat.ts:37](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChat.ts#L37)

Keepr executes against the vault row's group_id; prefer that over env drift.

#### Returns

`Promise`\<[`WaitlistGroupIdResolution`](#waitlistgroupidresolution)\>
