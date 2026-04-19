[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/hooks/useIdentity

# src/hooks/useIdentity

## Type Aliases

### IdentityResult

> **IdentityResult** = `object`

Defined in: [src/hooks/useIdentity.ts:15](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useIdentity.ts#L15)

#### Properties

##### avatar

> **avatar**: `string` \| `null`

Defined in: [src/hooks/useIdentity.ts:17](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useIdentity.ts#L17)

##### basename

> **basename**: `string` \| `null`

Defined in: [src/hooks/useIdentity.ts:26](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useIdentity.ts#L26)

##### basenameAvatar

> **basenameAvatar**: `string` \| `null`

Defined in: [src/hooks/useIdentity.ts:28](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useIdentity.ts#L28)

##### basenameDisplayName

> **basenameDisplayName**: `string` \| `null`

Defined in: [src/hooks/useIdentity.ts:27](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useIdentity.ts#L27)

##### displayName

> **displayName**: `string`

Defined in: [src/hooks/useIdentity.ts:16](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useIdentity.ts#L16)

##### ensName

> **ensName**: `string` \| `null`

Defined in: [src/hooks/useIdentity.ts:25](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useIdentity.ts#L25)

##### lensAccountAddress

> **lensAccountAddress**: `string` \| `null`

Defined in: [src/hooks/useIdentity.ts:23](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useIdentity.ts#L23)

##### lensHandle

> **lensHandle**: `string` \| `null`

Defined in: [src/hooks/useIdentity.ts:21](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useIdentity.ts#L21)

##### lensOwnerAddress

> **lensOwnerAddress**: `string` \| `null`

Defined in: [src/hooks/useIdentity.ts:24](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useIdentity.ts#L24)

##### lensUsername

> **lensUsername**: `string` \| `null`

Defined in: [src/hooks/useIdentity.ts:22](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useIdentity.ts#L22)

##### loading

> **loading**: `boolean`

Defined in: [src/hooks/useIdentity.ts:18](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useIdentity.ts#L18)

##### secondary

> **secondary**: `string` \| `null`

Defined in: [src/hooks/useIdentity.ts:20](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useIdentity.ts#L20)

##### source

> **source**: [`IdentitySource`](#identitysource)

Defined in: [src/hooks/useIdentity.ts:19](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useIdentity.ts#L19)

***

### IdentitySource

> **IdentitySource** = `"lens"` \| `"ens"` \| `"basename"` \| `"address"`

Defined in: [src/hooks/useIdentity.ts:13](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useIdentity.ts#L13)

## Functions

### pickIdentityAvatar()

> **pickIdentityAvatar**(`params`): `string` \| `null`

Defined in: [src/hooks/useIdentity.ts:115](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useIdentity.ts#L115)

#### Parameters

##### params

###### basenameAvatar

`string` \| `null`

###### lensAvatar?

`string` \| `null`

#### Returns

`string` \| `null`

***

### prefetchIdentities()

> **prefetchIdentities**(`addresses`): `void`

Defined in: [src/hooks/useIdentity.ts:429](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useIdentity.ts#L429)

Batch resolve — useful for pre-warming the cache

#### Parameters

##### addresses

`string`[]

#### Returns

`void`

***

### useIdentity()

> **useIdentity**(`address`): `object`

Defined in: [src/hooks/useIdentity.ts:356](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useIdentity.ts#L356)

#### Parameters

##### address

`string` | `null` | `undefined`

#### Returns

`object`

##### avatar

> **avatar**: `string` \| `null`

##### basename

> **basename**: `string` \| `null`

##### basenameAvatar

> **basenameAvatar**: `string` \| `null`

##### basenameDisplayName

> **basenameDisplayName**: `string` \| `null`

##### displayName

> **displayName**: `string`

##### ensName

> **ensName**: `string` \| `null`

##### lensAccountAddress

> **lensAccountAddress**: `string` \| `null`

##### lensHandle

> **lensHandle**: `string` \| `null`

##### lensOwnerAddress

> **lensOwnerAddress**: `string` \| `null`

##### lensUsername

> **lensUsername**: `string` \| `null`

##### loading

> **loading**: `boolean`

##### secondary

> **secondary**: `string` \| `null`

##### source

> **source**: [`IdentitySource`](#identitysource)
