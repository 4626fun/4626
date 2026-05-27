[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/waitlist/waitlistXmtpChatEligibility

# server/\_lib/waitlist/waitlistXmtpChatEligibility

## Type Aliases

### ResolveWaitlistChatEligibilityInput

> **ResolveWaitlistChatEligibilityInput** = `object`

Defined in: [server/\_lib/waitlist/waitlistXmtpChatEligibility.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatEligibility.ts#L25)

#### Properties

##### baseSubAccountAddress

> **baseSubAccountAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/waitlist/waitlistXmtpChatEligibility.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatEligibility.ts#L28)

##### canonicalCswAddress

> **canonicalCswAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/waitlist/waitlistXmtpChatEligibility.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatEligibility.ts#L26)

##### embeddedEoaAddress

> **embeddedEoaAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/waitlist/waitlistXmtpChatEligibility.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatEligibility.ts#L27)

##### embeddedIsOwnerOfParent

> **embeddedIsOwnerOfParent**: `boolean`

Defined in: [server/\_lib/waitlist/waitlistXmtpChatEligibility.ts:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatEligibility.ts#L29)

##### ownerCheckFailed?

> `optional` **ownerCheckFailed**: `boolean`

Defined in: [server/\_lib/waitlist/waitlistXmtpChatEligibility.ts:31](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatEligibility.ts#L31)

##### subAccountFlowEnabled?

> `optional` **subAccountFlowEnabled**: `boolean`

Defined in: [server/\_lib/waitlist/waitlistXmtpChatEligibility.ts:30](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatEligibility.ts#L30)

***

### WaitlistChatEligibilitySnapshot

> **WaitlistChatEligibilitySnapshot** = `object`

Defined in: [server/\_lib/waitlist/waitlistXmtpChatEligibility.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatEligibility.ts#L13)

#### Properties

##### baseSubAccountAddress

> **baseSubAccountAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/waitlist/waitlistXmtpChatEligibility.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatEligibility.ts#L16)

##### canonicalCswAddress

> **canonicalCswAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/waitlist/waitlistXmtpChatEligibility.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatEligibility.ts#L14)

##### chatReady

> **chatReady**: `boolean`

Defined in: [server/\_lib/waitlist/waitlistXmtpChatEligibility.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatEligibility.ts#L19)

##### embeddedEoaAddress

> **embeddedEoaAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/waitlist/waitlistXmtpChatEligibility.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatEligibility.ts#L15)

##### embeddedIsOwnerOfParent

> **embeddedIsOwnerOfParent**: `boolean`

Defined in: [server/\_lib/waitlist/waitlistXmtpChatEligibility.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatEligibility.ts#L21)

True when the embedded EOA is a direct on-chain owner of the parent CSW.

##### executionTrack

> **executionTrack**: [`WaitlistChatExecutionTrack`](#waitlistchatexecutiontrack)

Defined in: [server/\_lib/waitlist/waitlistXmtpChatEligibility.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatEligibility.ts#L17)

##### joinBlockedReason

> **joinBlockedReason**: `string` \| `null`

Defined in: [server/\_lib/waitlist/waitlistXmtpChatEligibility.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatEligibility.ts#L22)

##### xmtpMemberAddress

> **xmtpMemberAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/waitlist/waitlistXmtpChatEligibility.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatEligibility.ts#L18)

***

### WaitlistChatExecutionTrack

> **WaitlistChatExecutionTrack** = `"legacy-owner-install"` \| `"sub-account"` \| `"none-yet"`

Defined in: [server/\_lib/waitlist/waitlistXmtpChatEligibility.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatEligibility.ts#L11)

## Functions

### resolveWaitlistChatEligibilitySnapshot()

> **resolveWaitlistChatEligibilitySnapshot**(`input`): [`WaitlistChatEligibilitySnapshot`](#waitlistchateligibilitysnapshot)

Defined in: [server/\_lib/waitlist/waitlistXmtpChatEligibility.ts:51](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/waitlist/waitlistXmtpChatEligibility.ts#L51)

#### Parameters

##### input

[`ResolveWaitlistChatEligibilityInput`](#resolvewaitlistchateligibilityinput)

#### Returns

[`WaitlistChatEligibilitySnapshot`](#waitlistchateligibilitysnapshot)
