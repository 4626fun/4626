[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/useWaitlistChatJoin

# src/features/waitlist/useWaitlistChatJoin

## Type Aliases

### WaitlistChatStatus

> **WaitlistChatStatus** = `"idle"` \| `"awaiting_messaging"` \| `"joining"` \| `"pending"` \| `"executing"` \| `"executed"` \| `"failed"` \| `"blocked"` \| `"config"` \| `"error"`

Defined in: [src/features/waitlist/useWaitlistChatJoin.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useWaitlistChatJoin.ts#L7)

## Functions

### useWaitlistChatJoin()

> **useWaitlistChatJoin**(`params`): `object`

Defined in: [src/features/waitlist/useWaitlistChatJoin.ts:109](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useWaitlistChatJoin.ts#L109)

#### Parameters

##### params

###### chatReady

`boolean`

###### enabled

`boolean`

###### messagingReady

`boolean`

###### serverJoinActionStatus?

`WaitlistJoinActionStatus`

###### xmtpMemberAddress

`string` \| `null` \| `undefined`

#### Returns

`object`

##### retryJoin()

> **retryJoin**: () => `void`

###### Returns

`void`

##### status

> **status**: [`WaitlistChatStatus`](#waitlistchatstatus)

***

### waitlistChatBlockedMessage()

> **waitlistChatBlockedMessage**(`params`): `string`

Defined in: [src/features/waitlist/useWaitlistChatJoin.ts:47](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useWaitlistChatJoin.ts#L47)

#### Parameters

##### params

###### executionTrack?

[`WaitlistChatExecutionTrack`](useWaitlistXmtpStatus.md#waitlistchatexecutiontrack) \| `null`

###### joinBlockedReason?

`string` \| `null`

#### Returns

`string`

***

### waitlistChatStatusMessage()

> **waitlistChatStatusMessage**(`status`): `string`

Defined in: [src/features/waitlist/useWaitlistChatJoin.ts:63](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useWaitlistChatJoin.ts#L63)

#### Parameters

##### status

[`WaitlistChatStatus`](#waitlistchatstatus)

#### Returns

`string`
