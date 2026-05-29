[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/waitlistXmtpPhase

# src/features/waitlist/waitlistXmtpPhase

## Type Aliases

### WaitlistXmtpPhase

> **WaitlistXmtpPhase** = `"blocked_signing"` \| `"loading_status"` \| `"status_error"` \| `"not_configured"` \| `"service_unavailable"` \| `"local_reset_required"` \| `"connect_prompt"` \| `"connecting"` \| `"join_in_progress"` \| `"group_syncing"` \| `"chat_ready"` \| `"connect_error"`

Defined in: [src/features/waitlist/waitlistXmtpPhase.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistXmtpPhase.ts#L6)

## Variables

### WAITLIST\_CHAT\_SHELL\_MIN\_HEIGHT\_PX

> `const` **WAITLIST\_CHAT\_SHELL\_MIN\_HEIGHT\_PX**: `320` = `320`

Defined in: [src/features/waitlist/waitlistXmtpPhase.ts:112](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistXmtpPhase.ts#L112)

## Functions

### deriveWaitlistXmtpPhase()

> **deriveWaitlistXmtpPhase**(`input`): [`WaitlistXmtpPhase`](#waitlistxmtpphase)

Defined in: [src/features/waitlist/waitlistXmtpPhase.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistXmtpPhase.ts#L20)

#### Parameters

##### input

###### chatReady

`boolean`

###### configured

`boolean`

###### hasGroupConversation

`boolean`

###### joinStatus

[`WaitlistChatStatus`](waitlistChatCopy.md#waitlistchatstatus)

###### localStateResetRequired

`boolean`

###### needsConnectMessaging

`boolean`

###### prepareError

`string` \| `null`

###### serviceUnavailable

`boolean`

###### signingReady

`boolean`

###### statusError

`boolean`

###### statusLoading

`boolean`

###### syncTimedOut

`boolean`

###### xmtpError

`string` \| `null`

###### xmtpStatus

[`XmtpStatus`](../../lib/xmtp/provider.md#xmtpstatus)

#### Returns

[`WaitlistXmtpPhase`](#waitlistxmtpphase)

***

### waitlistXmtpPhaseMessage()

> **waitlistXmtpPhaseMessage**(`phase`, `context`): `string`

Defined in: [src/features/waitlist/waitlistXmtpPhase.ts:69](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistXmtpPhase.ts#L69)

#### Parameters

##### phase

[`WaitlistXmtpPhase`](#waitlistxmtpphase)

##### context

###### error

`string` \| `null`

###### joinStatus

[`WaitlistChatStatus`](waitlistChatCopy.md#waitlistchatstatus)

###### syncTimedOut

`boolean`

###### walletReady

`boolean`

#### Returns

`string`
