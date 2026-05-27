[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/canonicalCswPersistence

# server/\_lib/wallet/canonicalCswPersistence

## Functions

### applyCanonicalCswPolicyToClassification()

> **applyCanonicalCswPolicyToClassification**(`classification`): [`ClassifiedLinkedAccounts`](walletMapping.md#classifiedlinkedaccounts)

Defined in: [server/\_lib/wallet/canonicalCswPersistence.ts:41](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/canonicalCswPersistence.ts#L41)

#### Parameters

##### classification

[`ClassifiedLinkedAccounts`](walletMapping.md#classifiedlinkedaccounts)

#### Returns

[`ClassifiedLinkedAccounts`](walletMapping.md#classifiedlinkedaccounts)

***

### resolveStoredCanonicalCswAddress()

> **resolveStoredCanonicalCswAddress**(`params`): `string` \| `null`

Defined in: [server/\_lib/wallet/canonicalCswPersistence.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/canonicalCswPersistence.ts#L21)

Normalize what we persist in `profiles.csw_address`.

Allowed-owner EOAs (for example `0x6c0ea…`, slot 0 of the project CSW) must
never be stored as the CSW itself. When the profile signer is an allowed
owner, map to `TARGET_CANONICAL_CSW_ADDRESS` instead.

#### Parameters

##### params

###### activeOwnerEoa?

`string` \| `null`

###### candidate

`string` \| `null` \| `undefined`

###### embeddedEoa?

`string` \| `null`

#### Returns

`string` \| `null`
