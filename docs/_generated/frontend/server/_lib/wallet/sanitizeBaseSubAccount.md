[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/wallet/sanitizeBaseSubAccount

# server/\_lib/wallet/sanitizeBaseSubAccount

## Functions

### sanitizePersistedSubAccountAddress()

> **sanitizePersistedSubAccountAddress**(`params`): `Promise`\<`string` \| `null`\>

Defined in: [server/\_lib/wallet/sanitizeBaseSubAccount.ts:117](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/sanitizeBaseSubAccount.ts#L117)

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
