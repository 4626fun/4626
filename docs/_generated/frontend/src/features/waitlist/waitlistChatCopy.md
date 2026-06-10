[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/waitlistChatCopy

# src/features/waitlist/waitlistChatCopy

## Type Aliases

### WaitlistChatStatus

> **WaitlistChatStatus** = `"idle"` \| `"awaiting_messaging"` \| `"joining"` \| `"pending"` \| `"executing"` \| `"executed"` \| `"failed"` \| `"blocked"` \| `"config"` \| `"error"`

Defined in: [src/features/waitlist/waitlistChatCopy.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistChatCopy.ts#L3)

***

### WaitlistJoinActionStatus

> **WaitlistJoinActionStatus** = `"pending"` \| `"executing"` \| `"executed"` \| `"failed"` \| `"retry"` \| `null`

Defined in: [src/features/waitlist/waitlistChatCopy.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistChatCopy.ts#L15)

## Functions

### isTerminalWaitlistJoinStatus()

> **isTerminalWaitlistJoinStatus**(`status`): `boolean`

Defined in: [src/features/waitlist/waitlistChatCopy.ts:74](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistChatCopy.ts#L74)

#### Parameters

##### status

[`WaitlistChatStatus`](#waitlistchatstatus)

#### Returns

`boolean`

***

### mapJoinActionStatus()

> **mapJoinActionStatus**(`status`): [`WaitlistChatStatus`](#waitlistchatstatus) \| `null`

Defined in: [src/features/waitlist/waitlistChatCopy.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistChatCopy.ts#L17)

#### Parameters

##### status

[`WaitlistJoinActionStatus`](#waitlistjoinactionstatus)

#### Returns

[`WaitlistChatStatus`](#waitlistchatstatus) \| `null`

***

### shouldRetryWaitlistJoin()

> **shouldRetryWaitlistJoin**(`status`): `boolean`

Defined in: [src/features/waitlist/waitlistChatCopy.ts:84](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistChatCopy.ts#L84)

#### Parameters

##### status

[`WaitlistChatStatus`](#waitlistchatstatus)

#### Returns

`boolean`

***

### waitlistChatBlockedMessage()

> **waitlistChatBlockedMessage**(`params`): `string`

Defined in: [src/features/waitlist/waitlistChatCopy.ts:33](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistChatCopy.ts#L33)

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

Defined in: [src/features/waitlist/waitlistChatCopy.ts:49](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistChatCopy.ts#L49)

#### Parameters

##### status

[`WaitlistChatStatus`](#waitlistchatstatus)

#### Returns

`string`
