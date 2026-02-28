[**4626-miniapp**](../../index.md)

***

[4626-miniapp](../../index.md) / src/hooks/useAdminStatus

# src/hooks/useAdminStatus

## Functions

### useAdminStatus()

> **useAdminStatus**(): `object`

Defined in: [hooks/useAdminStatus.ts:21](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/hooks/useAdminStatus.ts#L21)

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
