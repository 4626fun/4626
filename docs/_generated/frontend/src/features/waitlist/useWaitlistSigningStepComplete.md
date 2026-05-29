[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/useWaitlistSigningStepComplete

# src/features/waitlist/useWaitlistSigningStepComplete

## Functions

### useWaitlistSigningStepComplete()

> **useWaitlistSigningStepComplete**(`params`): `object`

Defined in: [src/features/waitlist/useWaitlistSigningStepComplete.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/useWaitlistSigningStepComplete.ts#L16)

#### Parameters

##### params

###### accountSignals?

`WaitlistAccountSignals`

###### canonicalCswAddress

`string` \| `null`

###### ownerInstallRequested

`boolean`

#### Returns

`object`

##### embeddedEoaAddress

> **embeddedEoaAddress**: `string` \| `null`

##### parentEmbeddedOwnerOnChain

> **parentEmbeddedOwnerOnChain**: `boolean`

##### refreshParentEmbeddedOwner()

> **refreshParentEmbeddedOwner**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### signingProbePending

> **signingProbePending**: `boolean`

##### signingStepComplete

> **signingStepComplete**: `boolean`
