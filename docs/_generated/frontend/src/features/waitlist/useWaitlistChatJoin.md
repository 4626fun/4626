[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/useWaitlistChatJoin

# src/features/waitlist/useWaitlistChatJoin

## Functions

### useWaitlistChatJoin()

> **useWaitlistChatJoin**(`params`): `object`

Defined in: [src/features/waitlist/useWaitlistChatJoin.ts:41](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/useWaitlistChatJoin.ts#L41)

#### Parameters

##### params

###### chatReady

`boolean`

###### enabled

`boolean`

###### messagingReady

`boolean`

###### serverJoinActionStatus?

[`WaitlistJoinActionStatus`](waitlistChatCopy.md#waitlistjoinactionstatus)

###### xmtpMemberAddress

`string` \| `null` \| `undefined`

#### Returns

`object`

##### retryJoin()

> **retryJoin**: () => `void`

###### Returns

`void`

##### status

> **status**: [`WaitlistChatStatus`](waitlistChatCopy.md#waitlistchatstatus)

## References

### mapJoinActionStatus

Re-exports [mapJoinActionStatus](waitlistChatCopy.md#mapjoinactionstatus)

***

### waitlistChatBlockedMessage

Re-exports [waitlistChatBlockedMessage](waitlistChatCopy.md#waitlistchatblockedmessage)

***

### WaitlistChatStatus

Re-exports [WaitlistChatStatus](waitlistChatCopy.md#waitlistchatstatus)

***

### waitlistChatStatusMessage

Re-exports [waitlistChatStatusMessage](waitlistChatCopy.md#waitlistchatstatusmessage)

***

### WaitlistJoinActionStatus

Re-exports [WaitlistJoinActionStatus](waitlistChatCopy.md#waitlistjoinactionstatus)
