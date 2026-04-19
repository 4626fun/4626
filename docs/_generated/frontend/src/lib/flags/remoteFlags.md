[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/flags/remoteFlags

# src/lib/flags/remoteFlags

## Functions

### fetchRemoteFlags()

> **fetchRemoteFlags**(): `Promise`\<`RemoteFlagValues`\>

Defined in: [src/lib/flags/remoteFlags.ts:35](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/remoteFlags.ts#L35)

Fetch remote flag values from the server.
Deduplicates concurrent calls and caches the result for the session.

#### Returns

`Promise`\<`RemoteFlagValues`\>

***

### getRemoteFlag()

> **getRemoteFlag**\<`T`\>(`key`): `T` \| `undefined`

Defined in: [src/lib/flags/remoteFlags.ts:57](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/remoteFlags.ts#L57)

Get a specific remote flag value, or undefined if not available.

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### key

`string`

#### Returns

`T` \| `undefined`

***

### getRemoteFlagValues()

> **getRemoteFlagValues**(): `RemoteFlagValues` \| `null`

Defined in: [src/lib/flags/remoteFlags.ts:50](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/remoteFlags.ts#L50)

Synchronous access to the cached remote flag values.
Returns null if the fetch hasn't completed yet.

#### Returns

`RemoteFlagValues` \| `null`

***

### refreshRemoteFlags()

> **refreshRemoteFlags**(): `Promise`\<`RemoteFlagValues`\>

Defined in: [src/lib/flags/remoteFlags.ts:65](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/remoteFlags.ts#L65)

Force a refresh of remote flags (ignores cache).

#### Returns

`Promise`\<`RemoteFlagValues`\>
