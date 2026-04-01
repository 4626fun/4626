[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/auth/appEntry

# src/lib/auth/appEntry

## Variables

### APP\_ENTRY\_CANONICAL\_PATH

> `const` **APP\_ENTRY\_CANONICAL\_PATH**: `"/continue"` = `'/continue'`

Defined in: [src/lib/auth/appEntry.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/appEntry.ts#L4)

***

### APP\_ENTRY\_DEFAULT\_NEXT

> `const` **APP\_ENTRY\_DEFAULT\_NEXT**: `"/swap"` = `CANONICAL_SWAP_ROUTE`

Defined in: [src/lib/auth/appEntry.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/appEntry.ts#L3)

## Functions

### buildAppEntryPath()

> **buildAppEntryPath**(`next`): `string`

Defined in: [src/lib/auth/appEntry.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/appEntry.ts#L13)

#### Parameters

##### next

`string` = `APP_ENTRY_DEFAULT_NEXT`

#### Returns

`string`

***

### buildAppEntryUrl()

> **buildAppEntryUrl**(`baseUrl`, `next`): `string`

Defined in: [src/lib/auth/appEntry.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/appEntry.ts#L20)

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

Defined in: [src/lib/auth/appEntry.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/appEntry.ts#L6)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`string`
