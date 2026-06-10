[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/waitlistGroupChatBadge

# src/features/waitlist/waitlistGroupChatBadge

## Type Aliases

### WaitlistChatBadge

> **WaitlistChatBadge** = `object`

Defined in: [src/features/waitlist/waitlistGroupChatBadge.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistGroupChatBadge.ts#L3)

#### Properties

##### label

> **label**: `string`

Defined in: [src/features/waitlist/waitlistGroupChatBadge.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistGroupChatBadge.ts#L4)

##### tone

> **tone**: `"ready"` \| `"progress"` \| `"error"`

Defined in: [src/features/waitlist/waitlistGroupChatBadge.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistGroupChatBadge.ts#L5)

## Functions

### deriveWaitlistChatBadge()

> **deriveWaitlistChatBadge**(`input`): [`WaitlistChatBadge`](#waitlistchatbadge) \| `null`

Defined in: [src/features/waitlist/waitlistGroupChatBadge.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistGroupChatBadge.ts#L9)

Badge reflects local chat readiness first — never "Added" while the group is still missing locally.

#### Parameters

##### input

###### chatReady

`boolean`

###### hasGroupConversation

`boolean`

###### joinStatus

[`WaitlistChatStatus`](waitlistChatCopy.md#waitlistchatstatus)

#### Returns

[`WaitlistChatBadge`](#waitlistchatbadge) \| `null`

***

### waitlistChatBadgeClassName()

> **waitlistChatBadgeClassName**(`tone`): `string`

Defined in: [src/features/waitlist/waitlistGroupChatBadge.ts:44](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistGroupChatBadge.ts#L44)

#### Parameters

##### tone

`"ready"` | `"error"` | `"progress"`

#### Returns

`string`
