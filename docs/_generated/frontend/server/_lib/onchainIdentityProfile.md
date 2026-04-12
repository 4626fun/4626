[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/onchainIdentityProfile

# server/\_lib/onchainIdentityProfile

## Type Aliases

### OnchainIdentityProfile

> **OnchainIdentityProfile** = `object`

Defined in: [server/\_lib/onchainIdentityProfile.ts:16](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/onchainIdentityProfile.ts#L16)

#### Properties

##### address

> **address**: `string`

Defined in: [server/\_lib/onchainIdentityProfile.ts:18](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/onchainIdentityProfile.ts#L18)

##### avatarUrl

> **avatarUrl**: `string` \| `null`

Defined in: [server/\_lib/onchainIdentityProfile.ts:23](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/onchainIdentityProfile.ts#L23)

##### basename

> **basename**: `string` \| `null`

Defined in: [server/\_lib/onchainIdentityProfile.ts:20](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/onchainIdentityProfile.ts#L20)

##### bio

> **bio**: `string` \| `null`

Defined in: [server/\_lib/onchainIdentityProfile.ts:22](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/onchainIdentityProfile.ts#L22)

##### discord

> **discord**: `string` \| `null`

Defined in: [server/\_lib/onchainIdentityProfile.ts:27](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/onchainIdentityProfile.ts#L27)

##### displayName

> **displayName**: `string` \| `null`

Defined in: [server/\_lib/onchainIdentityProfile.ts:21](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/onchainIdentityProfile.ts#L21)

##### ensName

> **ensName**: `string` \| `null`

Defined in: [server/\_lib/onchainIdentityProfile.ts:19](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/onchainIdentityProfile.ts#L19)

##### github

> **github**: `string` \| `null`

Defined in: [server/\_lib/onchainIdentityProfile.ts:26](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/onchainIdentityProfile.ts#L26)

##### source

> **source**: `"ens"` \| `"basename"`

Defined in: [server/\_lib/onchainIdentityProfile.ts:17](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/onchainIdentityProfile.ts#L17)

##### twitter

> **twitter**: `string` \| `null`

Defined in: [server/\_lib/onchainIdentityProfile.ts:25](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/onchainIdentityProfile.ts#L25)

##### website

> **website**: `string` \| `null`

Defined in: [server/\_lib/onchainIdentityProfile.ts:24](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/onchainIdentityProfile.ts#L24)

## Functions

### resolveOnchainIdentityProfile()

> **resolveOnchainIdentityProfile**(`address`): `Promise`\<[`OnchainIdentityProfile`](#onchainidentityprofile) \| `null`\>

Defined in: [server/\_lib/onchainIdentityProfile.ts:110](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/onchainIdentityProfile.ts#L110)

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`OnchainIdentityProfile`](#onchainidentityprofile) \| `null`\>
