[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/auth/requestPrincipal

# server/\_lib/auth/requestPrincipal

## Type Aliases

### AuthorizedRequestPrincipal

> **AuthorizedRequestPrincipal** = [`RequestPrincipal`](#requestprincipal) & `object`

Defined in: [server/\_lib/auth/requestPrincipal.ts:12](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/auth/requestPrincipal.ts#L12)

#### Type Declaration

##### activeOwnerWalletAddress

> **activeOwnerWalletAddress**: `string` \| `null`

##### authSource

> **authSource**: `"session"` \| `"siwa"`

##### canonicalSmartWalletAddress

> **canonicalSmartWalletAddress**: `string` \| `null`

##### profileId

> **profileId**: `number`

##### signerRole

> **signerRole**: `"canonical_smart_wallet"` \| `"active_owner_wallet"`

***

### RequestPrincipal

> **RequestPrincipal** = `object`

Defined in: [server/\_lib/auth/requestPrincipal.ts:7](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/auth/requestPrincipal.ts#L7)

#### Properties

##### address

> **address**: `string`

Defined in: [server/\_lib/auth/requestPrincipal.ts:9](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/auth/requestPrincipal.ts#L9)

##### source

> **source**: `"session"` \| `"siwa"`

Defined in: [server/\_lib/auth/requestPrincipal.ts:8](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/auth/requestPrincipal.ts#L8)

## Functions

### readRequestPrincipal()

> **readRequestPrincipal**(`req`, `opts`): [`RequestPrincipal`](#requestprincipal) \| `null`

Defined in: [server/\_lib/auth/requestPrincipal.ts:24](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/auth/requestPrincipal.ts#L24)

#### Parameters

##### req

`VercelRequest`

##### opts

`ReadPrincipalOptions` = `{}`

#### Returns

[`RequestPrincipal`](#requestprincipal) \| `null`

***

### readRequestPrincipalAddress()

> **readRequestPrincipalAddress**(`req`, `opts`): `string`

Defined in: [server/\_lib/auth/requestPrincipal.ts:46](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/auth/requestPrincipal.ts#L46)

#### Parameters

##### req

`VercelRequest`

##### opts

`ReadPrincipalOptions` = `{}`

#### Returns

`string`

***

### resolveAuthorizedRequestPrincipal()

> **resolveAuthorizedRequestPrincipal**(`req`, `opts`): `Promise`\<[`AuthorizedRequestPrincipal`](#authorizedrequestprincipal) \| `null`\>

Defined in: [server/\_lib/auth/requestPrincipal.ts:50](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/auth/requestPrincipal.ts#L50)

#### Parameters

##### req

`VercelRequest`

##### opts

`ReadPrincipalOptions` = `{}`

#### Returns

`Promise`\<[`AuthorizedRequestPrincipal`](#authorizedrequestprincipal) \| `null`\>
