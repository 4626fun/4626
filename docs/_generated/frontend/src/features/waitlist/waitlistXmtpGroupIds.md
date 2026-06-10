[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/waitlistXmtpGroupIds

# src/features/waitlist/waitlistXmtpGroupIds

## Functions

### collectWaitlistGroupIdCandidates()

> **collectWaitlistGroupIdCandidates**(`input`): `string`[]

Defined in: [src/features/waitlist/waitlistXmtpGroupIds.ts:1](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistXmtpGroupIds.ts#L1)

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

> **findWaitlistGroupConversation**\<`T`\>(`conversations`, `groupIds`, `options?`): `T` \| `null`

Defined in: [src/features/waitlist/waitlistXmtpGroupIds.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistXmtpGroupIds.ts#L27)

#### Type Parameters

##### T

`T` *extends* `object`

#### Parameters

##### conversations

`T`[]

##### groupIds

readonly `string`[]

##### options?

###### groupName?

`string` \| `null`

#### Returns

`T` \| `null`
