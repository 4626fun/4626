[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/useEmbeddedOwnerOnCsw

# src/features/waitlist/useEmbeddedOwnerOnCsw

## Type Aliases

### EmbeddedOwnerOnCswStatus

> **EmbeddedOwnerOnCswStatus** = `"idle"` \| `"checking"` \| `"owner"` \| `"not-owner"` \| `"unknown"`

Defined in: [src/features/waitlist/useEmbeddedOwnerOnCsw.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useEmbeddedOwnerOnCsw.ts#L8)

## Functions

### mapEmbeddedOwnerStatusToCanonicalCheckStatus()

> **mapEmbeddedOwnerStatusToCanonicalCheckStatus**(`status`): [`CanonicalOwnerCheckStatus`](../../lib/uniswap/canonicalSignerGate.md#canonicalownercheckstatus)

Defined in: [src/features/waitlist/useEmbeddedOwnerOnCsw.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useEmbeddedOwnerOnCsw.ts#L10)

#### Parameters

##### status

[`EmbeddedOwnerOnCswStatus`](#embeddedowneroncswstatus)

#### Returns

[`CanonicalOwnerCheckStatus`](../../lib/uniswap/canonicalSignerGate.md#canonicalownercheckstatus)

***

### useEmbeddedOwnerOnCsw()

> **useEmbeddedOwnerOnCsw**(`params`): `object`

Defined in: [src/features/waitlist/useEmbeddedOwnerOnCsw.ts:51](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useEmbeddedOwnerOnCsw.ts#L51)

#### Parameters

##### params

###### cswAddress?

`string` \| `null`

###### embeddedEoaAddress

`string` \| `null` \| `undefined`

###### enabled?

`boolean`

#### Returns

`object`

##### isOwner

> **isOwner**: `boolean`

##### needsInstall

> **needsInstall**: `boolean`

##### refresh()

> **refresh**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### status

> **status**: [`EmbeddedOwnerOnCswStatus`](#embeddedowneroncswstatus) = `resolvedStatus`
