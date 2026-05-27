[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/waitlist/waitlistXmtpChatJoinExecution

# server/\_lib/waitlist/waitlistXmtpChatJoinExecution

## Type Aliases

### WaitlistChatJoinActionSnapshot

> **WaitlistChatJoinActionSnapshot** = `object`

Defined in: [server/\_lib/waitlist/waitlistXmtpChatJoinExecution.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatJoinExecution.ts#L14)

#### Properties

##### actionId

> **actionId**: `number`

Defined in: [server/\_lib/waitlist/waitlistXmtpChatJoinExecution.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatJoinExecution.ts#L15)

##### lastError

> **lastError**: `string` \| `null`

Defined in: [server/\_lib/waitlist/waitlistXmtpChatJoinExecution.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatJoinExecution.ts#L17)

##### status

> **status**: `"pending"` \| `"executing"` \| `"executed"` \| `"failed"` \| `"retry"` \| `null`

Defined in: [server/\_lib/waitlist/waitlistXmtpChatJoinExecution.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatJoinExecution.ts#L16)

***

### WaitlistChatJoinExecutionOutcome

> **WaitlistChatJoinExecutionOutcome** = `"executed"` \| `"deferred"` \| `"failed"`

Defined in: [server/\_lib/waitlist/waitlistXmtpChatJoinExecution.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatJoinExecution.ts#L20)

## Variables

### WAITLIST\_CHAT\_STALE\_EXECUTING\_SECONDS

> `const` **WAITLIST\_CHAT\_STALE\_EXECUTING\_SECONDS**: `120` = `120`

Defined in: [server/\_lib/waitlist/waitlistXmtpChatJoinExecution.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatJoinExecution.ts#L12)

Keepr XMTP actions can stall in `executing` if the worker dies mid-flight.

## Functions

### buildWaitlistChatDedupeKey()

> **buildWaitlistChatDedupeKey**(`groupId`, `xmtpMemberAddress`): `string`

Defined in: [server/\_lib/waitlist/waitlistXmtpChatJoinExecution.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatJoinExecution.ts#L22)

#### Parameters

##### groupId

`string`

##### xmtpMemberAddress

`string`

#### Returns

`string`

***

### executeWaitlistChatJoinActionNow()

> **executeWaitlistChatJoinActionNow**(`params`): `Promise`\<\{ `error?`: `string`; `outcome`: [`WaitlistChatJoinExecutionOutcome`](#waitlistchatjoinexecutionoutcome); `retryable?`: `boolean`; \}\>

Defined in: [server/\_lib/waitlist/waitlistXmtpChatJoinExecution.ts:58](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatJoinExecution.ts#L58)

#### Parameters

##### params

###### action

`Record`\<`string`, `unknown`\>

###### actionId

`number`

###### actionType?

`string` \| `null`

###### db

`Db`

###### groupId

`string`

###### retryDelaySeconds?

`number`

#### Returns

`Promise`\<\{ `error?`: `string`; `outcome`: [`WaitlistChatJoinExecutionOutcome`](#waitlistchatjoinexecutionoutcome); `retryable?`: `boolean`; \}\>

***

### readWaitlistChatJoinAction()

> **readWaitlistChatJoinAction**(`db`, `dedupeKey`): `Promise`\<[`WaitlistChatJoinActionSnapshot`](#waitlistchatjoinactionsnapshot) \| `null`\>

Defined in: [server/\_lib/waitlist/waitlistXmtpChatJoinExecution.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatJoinExecution.ts#L26)

#### Parameters

##### db

`Db`

##### dedupeKey

`string`

#### Returns

`Promise`\<[`WaitlistChatJoinActionSnapshot`](#waitlistchatjoinactionsnapshot) \| `null`\>
