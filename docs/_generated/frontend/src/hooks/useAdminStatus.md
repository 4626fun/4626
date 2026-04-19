[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/hooks/useAdminStatus

# src/hooks/useAdminStatus

## Functions

### deriveAdminStatus()

> **deriveAdminStatus**(`input`): `DeriveAdminStatusOutput`

Defined in: [src/hooks/useAdminStatus.ts:33](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useAdminStatus.ts#L33)

#### Parameters

##### input

`DeriveAdminStatusInput`

#### Returns

`DeriveAdminStatusOutput`

***

### useAdminStatus()

> **useAdminStatus**(`params?`): `object`

Defined in: [src/hooks/useAdminStatus.ts:87](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useAdminStatus.ts#L87)

#### Parameters

##### params?

###### enabled?

`boolean`

#### Returns

`object`

##### error

> **error**: `Error` \| `null` = `query.error`

##### isAdmin

> **isAdmin**: `boolean` = `derived.isAdmin`

##### isLoading

> **isLoading**: `boolean` = `derived.isLoading`

##### refetch()

> **refetch**: (`options?`) => `Promise`\<`QueryObserverResult`\<`AdminResponse`, `Error`\>\> = `query.refetch`

###### Parameters

###### options?

`RefetchOptions`

###### Returns

`Promise`\<`QueryObserverResult`\<`AdminResponse`, `Error`\>\>

***

### useAdminStatusFromSession()

> **useAdminStatusFromSession**(`params`): `object`

Defined in: [src/hooks/useAdminStatus.ts:79](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useAdminStatus.ts#L79)

#### Parameters

##### params

###### authAddress

`string` \| `null`

###### enabled?

`boolean`

###### sessionHydrated

`boolean`

#### Returns

`object`

##### error

> **error**: `Error` \| `null` = `query.error`

##### isAdmin

> **isAdmin**: `boolean` = `derived.isAdmin`

##### isLoading

> **isLoading**: `boolean` = `derived.isLoading`

##### refetch()

> **refetch**: (`options?`) => `Promise`\<`QueryObserverResult`\<`AdminResponse`, `Error`\>\> = `query.refetch`

###### Parameters

###### options?

`RefetchOptions`

###### Returns

`Promise`\<`QueryObserverResult`\<`AdminResponse`, `Error`\>\>
