[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/hooks/useAdminStatus

# src/hooks/useAdminStatus

## Functions

### deriveAdminStatus()

> **deriveAdminStatus**(`input`): `DeriveAdminStatusOutput`

Defined in: [src/hooks/useAdminStatus.ts:33](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/hooks/useAdminStatus.ts#L33)

#### Parameters

##### input

`DeriveAdminStatusInput`

#### Returns

`DeriveAdminStatusOutput`

***

### useAdminStatus()

> **useAdminStatus**(): `object`

Defined in: [src/hooks/useAdminStatus.ts:82](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/hooks/useAdminStatus.ts#L82)

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

Defined in: [src/hooks/useAdminStatus.ts:75](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/hooks/useAdminStatus.ts#L75)

#### Parameters

##### params

###### authAddress

`string` \| `null`

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
