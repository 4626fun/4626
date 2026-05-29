[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/hermitAvatar

# server/\_lib/alfaclub/hermitAvatar

## Type Aliases

### HermitAvatarOptions

> **HermitAvatarOptions** = `object`

Defined in: [server/\_lib/alfaclub/hermitAvatar.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hermitAvatar.ts#L23)

#### Properties

##### signatureText?

> `optional` **signatureText**: `string`

Defined in: [server/\_lib/alfaclub/hermitAvatar.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hermitAvatar.ts#L25)

##### size?

> `optional` **size**: `number`

Defined in: [server/\_lib/alfaclub/hermitAvatar.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hermitAvatar.ts#L24)

## Variables

### HERMIT\_AVATAR\_DEFAULT\_SIGNATURE

> `const` **HERMIT\_AVATAR\_DEFAULT\_SIGNATURE**: `"Agent Hermit 4626"` = `DEFAULT_SIGNATURE`

Defined in: [server/\_lib/alfaclub/hermitAvatar.ts:116](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hermitAvatar.ts#L116)

***

### HERMIT\_AVATAR\_SIZE\_BOUNDS

> `const` **HERMIT\_AVATAR\_SIZE\_BOUNDS**: `object`

Defined in: [server/\_lib/alfaclub/hermitAvatar.ts:115](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hermitAvatar.ts#L115)

#### Type Declaration

##### default

> `readonly` **default**: `512` = `DEFAULT_SIZE`

##### max

> `readonly` **max**: `1024` = `MAX_SIZE`

##### min

> `readonly` **min**: `64` = `MIN_SIZE`

## Functions

### renderHermitAvatarBuffer()

> **renderHermitAvatarBuffer**(`opts`): `Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Defined in: [server/\_lib/alfaclub/hermitAvatar.ts:83](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hermitAvatar.ts#L83)

#### Parameters

##### opts

[`HermitAvatarOptions`](#hermitavataroptions) = `{}`

#### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

***

### renderHermitAvatarDataUrl()

> **renderHermitAvatarDataUrl**(`opts`): `Promise`\<`string`\>

Defined in: [server/\_lib/alfaclub/hermitAvatar.ts:110](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hermitAvatar.ts#L110)

#### Parameters

##### opts

[`HermitAvatarOptions`](#hermitavataroptions) = `{}`

#### Returns

`Promise`\<`string`\>
