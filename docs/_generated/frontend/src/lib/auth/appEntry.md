[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/auth/appEntry

# src/lib/auth/appEntry

## Variables

### APP\_ENTRY\_DEFAULT\_NEXT

> `const` **APP\_ENTRY\_DEFAULT\_NEXT**: `"/swap"` = `CANONICAL_SWAP_ROUTE`

Defined in: [src/lib/auth/appEntry.ts:3](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/auth/appEntry.ts#L3)

## Functions

### buildAppEntryPath()

> **buildAppEntryPath**(`next`): `string`

Defined in: [src/lib/auth/appEntry.ts:12](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/auth/appEntry.ts#L12)

#### Parameters

##### next

`string` = `APP_ENTRY_DEFAULT_NEXT`

#### Returns

`string`

***

### buildAppEntryUrl()

> **buildAppEntryUrl**(`baseUrl`, `next`): `string`

Defined in: [src/lib/auth/appEntry.ts:16](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/auth/appEntry.ts#L16)

#### Parameters

##### baseUrl

`string`

##### next

`string` = `APP_ENTRY_DEFAULT_NEXT`

#### Returns

`string`

***

### readSafeNextPath()

> **readSafeNextPath**(`value`): `string`

Defined in: [src/lib/auth/appEntry.ts:5](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/auth/appEntry.ts#L5)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`string`
