[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/useWaitlistGroupSync

# src/features/waitlist/useWaitlistGroupSync

## Functions

### useWaitlistGroupSync()

> **useWaitlistGroupSync**(`params`): `object`

Defined in: [src/features/waitlist/useWaitlistGroupSync.ts:39](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/useWaitlistGroupSync.ts#L39)

#### Parameters

##### params

`UseWaitlistGroupSyncParams`

#### Returns

`object`

##### groupConversation

> **groupConversation**: [`ChatConversation`](../../lib/xmtp/provider.md#chatconversation) \| `null`

##### groupIdCandidates

> **groupIdCandidates**: `string`[]

##### refreshBusy

> **refreshBusy**: `boolean`

##### refreshGroup()

> **refreshGroup**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### resyncError

> **resyncError**: `string` \| `null`

##### syncTimedOut

> **syncTimedOut**: `boolean`

##### syncWaitlistGroups()

> **syncWaitlistGroups**: (`options?`) => `Promise`\<[`ChatConversation`](../../lib/xmtp/provider.md#chatconversation) \| `null`\>

###### Parameters

###### options?

###### force?

`boolean`

###### resyncMembership?

`boolean`

###### Returns

`Promise`\<[`ChatConversation`](../../lib/xmtp/provider.md#chatconversation) \| `null`\>
