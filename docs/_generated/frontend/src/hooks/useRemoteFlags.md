[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/hooks/useRemoteFlags

# src/hooks/useRemoteFlags

## Functions

### useRemoteFlag()

> **useRemoteFlag**\<`T`\>(`key`): `T` \| `undefined`

Defined in: [src/hooks/useRemoteFlags.ts:48](https://github.com/wenakita/4626/blob/c75a1c24d9b9350ac3d121d5a700640674fe0027/frontend/src/hooks/useRemoteFlags.ts#L48)

Get a specific remote flag value. Returns undefined until the fetch
completes or if the flag isn't Vercel-managed.

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### key

`string`

#### Returns

`T` \| `undefined`

***

### useRemoteFlags()

> **useRemoteFlags**(): `RemoteFlagValues` \| `null`

Defined in: [src/hooks/useRemoteFlags.ts:40](https://github.com/wenakita/4626/blob/c75a1c24d9b9350ac3d121d5a700640674fe0027/frontend/src/hooks/useRemoteFlags.ts#L40)

Subscribe to the remote flags cache. Returns null until the fetch completes,
then returns the resolved values.

#### Returns

`RemoteFlagValues` \| `null`

***

### useRemoteFlagsInit()

> **useRemoteFlagsInit**(): `void`

Defined in: [src/hooks/useRemoteFlags.ts:28](https://github.com/wenakita/4626/blob/c75a1c24d9b9350ac3d121d5a700640674fe0027/frontend/src/hooks/useRemoteFlags.ts#L28)

Kicks off the remote flags fetch once.
Call this near the app root so flag values are available quickly.

#### Returns

`void`
