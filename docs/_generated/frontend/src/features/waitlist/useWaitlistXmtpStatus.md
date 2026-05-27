[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/useWaitlistXmtpStatus

# src/features/waitlist/useWaitlistXmtpStatus

## Type Aliases

### WaitlistChatExecutionTrack

> **WaitlistChatExecutionTrack** = `"legacy-owner-install"` \| `"sub-account"` \| `"none-yet"`

Defined in: [src/features/waitlist/useWaitlistXmtpStatus.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useWaitlistXmtpStatus.ts#L5)

***

### WaitlistXmtpStatus

> **WaitlistXmtpStatus** = `object`

Defined in: [src/features/waitlist/useWaitlistXmtpStatus.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useWaitlistXmtpStatus.ts#L7)

#### Properties

##### canJoin

> **canJoin**: `boolean`

Defined in: [src/features/waitlist/useWaitlistXmtpStatus.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useWaitlistXmtpStatus.ts#L17)

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null`

Defined in: [src/features/waitlist/useWaitlistXmtpStatus.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useWaitlistXmtpStatus.ts#L19)

##### chatReady

> **chatReady**: `boolean`

Defined in: [src/features/waitlist/useWaitlistXmtpStatus.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useWaitlistXmtpStatus.ts#L16)

##### configured

> **configured**: `boolean`

Defined in: [src/features/waitlist/useWaitlistXmtpStatus.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useWaitlistXmtpStatus.ts#L8)

##### envGroupId

> **envGroupId**: `string` \| `null`

Defined in: [src/features/waitlist/useWaitlistXmtpStatus.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useWaitlistXmtpStatus.ts#L11)

##### executionTrack

> **executionTrack**: [`WaitlistChatExecutionTrack`](#waitlistchatexecutiontrack)

Defined in: [src/features/waitlist/useWaitlistXmtpStatus.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useWaitlistXmtpStatus.ts#L18)

##### groupId

> **groupId**: `string` \| `null`

Defined in: [src/features/waitlist/useWaitlistXmtpStatus.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useWaitlistXmtpStatus.ts#L10)

##### groupIdMismatch

> **groupIdMismatch**: `boolean`

Defined in: [src/features/waitlist/useWaitlistXmtpStatus.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useWaitlistXmtpStatus.ts#L14)

##### groupIdSource

> **groupIdSource**: `"vault"` \| `"env"` \| `null`

Defined in: [src/features/waitlist/useWaitlistXmtpStatus.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useWaitlistXmtpStatus.ts#L13)

##### groupName

> **groupName**: `string`

Defined in: [src/features/waitlist/useWaitlistXmtpStatus.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useWaitlistXmtpStatus.ts#L15)

##### joinAction

> **joinAction**: \{ `actionId`: `number`; `lastError`: `string` \| `null`; `status`: `"pending"` \| `"executing"` \| `"executed"` \| `"failed"` \| `"retry"` \| `null`; \} \| `null`

Defined in: [src/features/waitlist/useWaitlistXmtpStatus.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useWaitlistXmtpStatus.ts#L22)

##### joinBlockedReason

> **joinBlockedReason**: `string` \| `null`

Defined in: [src/features/waitlist/useWaitlistXmtpStatus.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useWaitlistXmtpStatus.ts#L21)

##### vaultConfigured

> **vaultConfigured**: `boolean`

Defined in: [src/features/waitlist/useWaitlistXmtpStatus.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useWaitlistXmtpStatus.ts#L9)

##### vaultGroupId

> **vaultGroupId**: `string` \| `null`

Defined in: [src/features/waitlist/useWaitlistXmtpStatus.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useWaitlistXmtpStatus.ts#L12)

##### xmtpMemberAddress

> **xmtpMemberAddress**: `string` \| `null`

Defined in: [src/features/waitlist/useWaitlistXmtpStatus.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useWaitlistXmtpStatus.ts#L20)

## Functions

### useWaitlistXmtpStatus()

> **useWaitlistXmtpStatus**(`enabled`): `UseQueryResult`\<[`WaitlistXmtpStatus`](#waitlistxmtpstatus), `Error`\>

Defined in: [src/features/waitlist/useWaitlistXmtpStatus.ts:43](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useWaitlistXmtpStatus.ts#L43)

#### Parameters

##### enabled

`boolean`

#### Returns

`UseQueryResult`\<[`WaitlistXmtpStatus`](#waitlistxmtpstatus), `Error`\>
