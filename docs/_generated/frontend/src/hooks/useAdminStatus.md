[**creatorvault-miniapp**](../../index.md)

***

[creatorvault-miniapp](../../index.md) / src/hooks/useAdminStatus

# src/hooks/useAdminStatus

## Functions

### useAdminStatus()

> **useAdminStatus**(): `object`

Defined in: [hooks/useAdminStatus.ts:21](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/hooks/useAdminStatus.ts#L21)

#### Returns

`object`

##### error

> **error**: `Error` \| `null` = `query.error`

##### isAdmin

> **isAdmin**: `boolean`

##### isLoading

> **isLoading**: `boolean` = `query.isLoading`

##### refetch()

> **refetch**: (`options?`) => `Promise`\<`QueryObserverResult`\<`AdminResponse`, `Error`\>\> = `query.refetch`

###### Parameters

###### options?

`RefetchOptions`

###### Returns

`Promise`\<`QueryObserverResult`\<`AdminResponse`, `Error`\>\>
