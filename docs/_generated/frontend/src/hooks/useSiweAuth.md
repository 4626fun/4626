[**creatorvault-miniapp**](../../index.md)

***

[creatorvault-miniapp](../../index.md) / src/hooks/useSiweAuth

# src/hooks/useSiweAuth

## Functions

### useSiweAuth()

> **useSiweAuth**(): `object`

Defined in: [hooks/useSiweAuth.ts:76](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/hooks/useSiweAuth.ts#L76)

#### Returns

`object`

##### authAddress

> **authAddress**: `string` \| `null`

##### busy

> **busy**: `boolean`

##### error

> **error**: `string` \| `null`

##### isSignedIn

> **isSignedIn**: `boolean`

##### refresh()

> **refresh**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### signIn()

> **signIn**: () => `Promise`\<`string` \| `null`\>

###### Returns

`Promise`\<`string` \| `null`\>

##### signInWithPrivyToken()

> **signInWithPrivyToken**: (`privyAccessToken`) => `Promise`\<`string` \| `null`\>

###### Parameters

###### privyAccessToken

`string` | `null`

###### Returns

`Promise`\<`string` \| `null`\>

##### signOut()

> **signOut**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>
