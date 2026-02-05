[**creatorvault-miniapp**](../../index.md)

***

[creatorvault-miniapp](../../index.md) / src/hooks/useFarcasterAuth

# src/hooks/useFarcasterAuth

## Type Aliases

### FarcasterVerifiedSession

> **FarcasterVerifiedSession** = `object`

Defined in: [hooks/useFarcasterAuth.ts:7](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/hooks/useFarcasterAuth.ts#L7)

#### Properties

##### fid

> **fid**: `number`

Defined in: [hooks/useFarcasterAuth.ts:8](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/hooks/useFarcasterAuth.ts#L8)

##### primaryAddress?

> `optional` **primaryAddress**: `string` \| `null`

Defined in: [hooks/useFarcasterAuth.ts:10](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/hooks/useFarcasterAuth.ts#L10)

##### tokenExp?

> `optional` **tokenExp**: `number`

Defined in: [hooks/useFarcasterAuth.ts:9](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/hooks/useFarcasterAuth.ts#L9)

## Functions

### useFarcasterAuth()

> **useFarcasterAuth**(): `object`

Defined in: [hooks/useFarcasterAuth.ts:15](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/hooks/useFarcasterAuth.ts#L15)

#### Returns

`object`

##### canQuickAuth

> **canQuickAuth**: `boolean` \| `null`

##### canSiwf

> **canSiwf**: `boolean` \| `null`

##### error

> **error**: `string` \| `null`

##### fid

> **fid**: `number` \| `null`

##### refresh()

> **refresh**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### session

> **session**: [`FarcasterVerifiedSession`](#farcasterverifiedsession) \| `null`

##### signIn()

> **signIn**: () => `Promise`\<[`FarcasterVerifiedSession`](#farcasterverifiedsession) \| `null`\>

###### Returns

`Promise`\<[`FarcasterVerifiedSession`](#farcasterverifiedsession) \| `null`\>

##### status

> **status**: `Status`
