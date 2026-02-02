[**creatorvault-miniapp**](../../index.md)

***

[creatorvault-miniapp](../../index.md) / src/lib/neynar-api

# src/lib/neynar-api

## Interfaces

### FarcasterProfile

Defined in: [lib/neynar-api.ts:20](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/neynar-api.ts#L20)

#### Properties

##### avatar

> **avatar**: `string`

Defined in: [lib/neynar-api.ts:23](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/neynar-api.ts#L23)

##### bio?

> `optional` **bio**: `string`

Defined in: [lib/neynar-api.ts:26](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/neynar-api.ts#L26)

##### custodyAddress?

> `optional` **custodyAddress**: `string` \| `null`

Defined in: [lib/neynar-api.ts:29](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/neynar-api.ts#L29)

##### displayName

> **displayName**: `string`

Defined in: [lib/neynar-api.ts:22](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/neynar-api.ts#L22)

##### fetchedAt?

> `optional` **fetchedAt**: `number`

Defined in: [lib/neynar-api.ts:31](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/neynar-api.ts#L31)

##### fid

> **fid**: `number`

Defined in: [lib/neynar-api.ts:27](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/neynar-api.ts#L27)

##### followers

> **followers**: `number`

Defined in: [lib/neynar-api.ts:24](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/neynar-api.ts#L24)

##### following

> **following**: `number`

Defined in: [lib/neynar-api.ts:25](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/neynar-api.ts#L25)

##### username

> **username**: `string`

Defined in: [lib/neynar-api.ts:21](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/neynar-api.ts#L21)

##### verifiedAddresses?

> `optional` **verifiedAddresses**: `string`[]

Defined in: [lib/neynar-api.ts:28](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/neynar-api.ts#L28)

##### verifiedEthAddresses?

> `optional` **verifiedEthAddresses**: `string`[]

Defined in: [lib/neynar-api.ts:30](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/neynar-api.ts#L30)

***

### FarcasterUser

Defined in: [lib/neynar-api.ts:7](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/neynar-api.ts#L7)

#### Properties

##### display\_name

> **display\_name**: `string`

Defined in: [lib/neynar-api.ts:10](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/neynar-api.ts#L10)

##### fid

> **fid**: `number`

Defined in: [lib/neynar-api.ts:8](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/neynar-api.ts#L8)

##### follower\_count

> **follower\_count**: `number`

Defined in: [lib/neynar-api.ts:12](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/neynar-api.ts#L12)

##### following\_count

> **following\_count**: `number`

Defined in: [lib/neynar-api.ts:13](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/neynar-api.ts#L13)

##### pfp\_url

> **pfp\_url**: `string`

Defined in: [lib/neynar-api.ts:11](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/neynar-api.ts#L11)

##### username

> **username**: `string`

Defined in: [lib/neynar-api.ts:9](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/neynar-api.ts#L9)

##### verified\_addresses

> **verified\_addresses**: `object`

Defined in: [lib/neynar-api.ts:14](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/neynar-api.ts#L14)

###### eth\_addresses

> **eth\_addresses**: `string`[]

###### sol\_addresses

> **sol\_addresses**: `string`[]

## Functions

### getFarcasterUserByAddress()

> **getFarcasterUserByAddress**(`address`): `Promise`\<[`FarcasterProfile`](#farcasterprofile) \| `null`\>

Defined in: [lib/neynar-api.ts:80](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/neynar-api.ts#L80)

Fetch Farcaster user by verified wallet address via backend proxy
Backend handles API authentication and CORS

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`FarcasterProfile`](#farcasterprofile) \| `null`\>

***

### getFarcasterUserByFid()

> **getFarcasterUserByFid**(`fid`): `Promise`\<[`FarcasterProfile`](#farcasterprofile) \| `null`\>

Defined in: [lib/neynar-api.ts:39](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/neynar-api.ts#L39)

Fetch Farcaster user by FID (Farcaster ID)
Note: Currently not implemented in backend proxy
Use getFarcasterUserByAddress instead

#### Parameters

##### fid

`number`

#### Returns

`Promise`\<[`FarcasterProfile`](#farcasterprofile) \| `null`\>

***

### getFarcasterUserByUsername()

> **getFarcasterUserByUsername**(`username`): `Promise`\<[`FarcasterProfile`](#farcasterprofile) \| `null`\>

Defined in: [lib/neynar-api.ts:71](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/neynar-api.ts#L71)

Fetch Farcaster user by username
Note: Currently not implemented in backend proxy
Use getFarcasterUserByAddress instead

#### Parameters

##### username

`string`

#### Returns

`Promise`\<[`FarcasterProfile`](#farcasterprofile) \| `null`\>
