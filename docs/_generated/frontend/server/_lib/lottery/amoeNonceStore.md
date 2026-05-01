[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/lottery/amoeNonceStore

# server/\_lib/lottery/amoeNonceStore

## Functions

### consumeAmoeNonceForSubmit()

> **consumeAmoeNonceForSubmit**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/lottery/amoeNonceStore.ts:62](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeNonceStore.ts#L62)

Consume a previously-issued AMOE nonce and atomically mark it used.

#### Parameters

##### params

###### creatorCoin

`` `0x${string}` ``

###### nonce

`` `0x${string}` ``

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<`void`\>

#### Throws

`'invalid_nonce'`           — nonce is not a
                                                             bytes32 hex

#### Throws

`'nonce_already_used'`      — already consumed,
                                                             expired, or never issued
                                                             for this (wallet, creator) pair

#### Throws

`'amoe_db_unavailable'`     — Postgres handle missing
                                                             (we deliberately do NOT fall
                                                             back to in-memory storage in
                                                             the ZK path; production must
                                                             have the DB)
