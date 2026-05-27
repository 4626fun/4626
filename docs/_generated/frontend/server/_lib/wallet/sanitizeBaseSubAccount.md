[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/sanitizeBaseSubAccount

# server/\_lib/wallet/sanitizeBaseSubAccount

## Functions

### sanitizePersistedSubAccountAddress()

> **sanitizePersistedSubAccountAddress**(`params`): `Promise`\<`string` \| `null`\>

Defined in: [server/\_lib/wallet/sanitizeBaseSubAccount.ts:166](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/sanitizeBaseSubAccount.ts#L166)

Harden persisted `profiles.base_sub_account` before exposing it as an execution
sub-account. Rejects identity-only EOAs and stale zora_readonly candidates.

#### Parameters

##### params

###### baseSubAccountAddress

`string` \| `null` \| `undefined`

###### canonicalCswAddress

`string` \| `null` \| `undefined`

###### db

`Db`

###### privyUser

[`PrivyUserLike`](walletMapping.md#privyuserlike) \| `null`

###### profileId

`number`

#### Returns

`Promise`\<`string` \| `null`\>
