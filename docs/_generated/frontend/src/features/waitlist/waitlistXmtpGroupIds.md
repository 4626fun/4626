[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/waitlistXmtpGroupIds

# src/features/waitlist/waitlistXmtpGroupIds

## Functions

### collectWaitlistGroupIdCandidates()

> **collectWaitlistGroupIdCandidates**(`input`): `string`[]

Defined in: [src/features/waitlist/waitlistXmtpGroupIds.ts:1](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistXmtpGroupIds.ts#L1)

#### Parameters

##### input

###### envGroupId?

`string` \| `null`

###### groupId

`string` \| `null` \| `undefined`

###### groupIdMismatch?

`boolean`

###### vaultGroupId?

`string` \| `null`

#### Returns

`string`[]

***

### findWaitlistGroupConversation()

> **findWaitlistGroupConversation**\<`T`\>(`conversations`, `groupIds`): `T` \| `null`

Defined in: [src/features/waitlist/waitlistXmtpGroupIds.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistXmtpGroupIds.ts#L27)

#### Type Parameters

##### T

`T` *extends* `object`

#### Parameters

##### conversations

`T`[]

##### groupIds

readonly `string`[]

#### Returns

`T` \| `null`
