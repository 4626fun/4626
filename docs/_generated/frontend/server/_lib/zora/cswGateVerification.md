[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/zora/cswGateVerification

# server/\_lib/zora/cswGateVerification

## Type Aliases

### CswEntryChallengeRow

> **CswEntryChallengeRow** = `object`

Defined in: [server/\_lib/zora/cswGateVerification.ts:288](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L288)

#### Properties

##### challengeHash

> **challengeHash**: `string`

Defined in: [server/\_lib/zora/cswGateVerification.ts:289](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L289)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/zora/cswGateVerification.ts:292](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L292)

##### cswAddress

> **cswAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/zora/cswGateVerification.ts:290](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L290)

##### expiresAt

> **expiresAt**: `string`

Defined in: [server/\_lib/zora/cswGateVerification.ts:291](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L291)

***

### CswSignatureVerificationResult

> **CswSignatureVerificationResult** = `object`

Defined in: [server/\_lib/zora/cswGateVerification.ts:466](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L466)

#### Properties

##### contractValidated

> **contractValidated**: `boolean`

Defined in: [server/\_lib/zora/cswGateVerification.ts:468](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L468)

##### ok

> **ok**: `boolean`

Defined in: [server/\_lib/zora/cswGateVerification.ts:467](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L467)

##### recoveredSigner

> **recoveredSigner**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/zora/cswGateVerification.ts:469](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L469)

***

### ZoraCswGateVerifyTokenRow

> **ZoraCswGateVerifyTokenRow** = `object`

Defined in: [server/\_lib/zora/cswGateVerification.ts:55](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L55)

#### Properties

##### consumedAt

> **consumedAt**: `string` \| `null`

Defined in: [server/\_lib/zora/cswGateVerification.ts:61](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L61)

##### consumedTelegramUserId

> **consumedTelegramUserId**: `string` \| `null`

Defined in: [server/\_lib/zora/cswGateVerification.ts:62](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L62)

##### consumedTelegramUsername

> **consumedTelegramUsername**: `string` \| `null`

Defined in: [server/\_lib/zora/cswGateVerification.ts:63](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L63)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/zora/cswGateVerification.ts:64](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L64)

##### cswAddress

> **cswAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/zora/cswGateVerification.ts:57](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L57)

##### expiresAt

> **expiresAt**: `string`

Defined in: [server/\_lib/zora/cswGateVerification.ts:60](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L60)

##### requestedTelegramUsername

> **requestedTelegramUsername**: `string` \| `null`

Defined in: [server/\_lib/zora/cswGateVerification.ts:58](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L58)

##### sourceUrl

> **sourceUrl**: `string` \| `null`

Defined in: [server/\_lib/zora/cswGateVerification.ts:59](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L59)

##### tokenHash

> **tokenHash**: `string`

Defined in: [server/\_lib/zora/cswGateVerification.ts:56](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L56)

## Functions

### buildCswEntryChallengeMessage()

> **buildCswEntryChallengeMessage**(`params`): `string`

Defined in: [server/\_lib/zora/cswGateVerification.ts:360](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L360)

#### Parameters

##### params

###### cswAddress

`` `0x${string}` ``

###### expiresAt

`string`

###### nonce

`string`

#### Returns

`string`

***

### consumeCswEntryChallenge()

> **consumeCswEntryChallenge**(`params`): `Promise`\<\{ `ok`: `true`; `row`: [`CswEntryChallengeRow`](#cswentrychallengerow); \} \| \{ `ok`: `false`; `reason`: `"expired"` \| `"mismatch"` \| `"invalid"`; \}\>

Defined in: [server/\_lib/zora/cswGateVerification.ts:423](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L423)

FIX: M-01 — Atomically consume a CSW entry challenge.
Returns ok:true with the mapped row if the challenge was live and is now
deleted; ok:false with a typed reason otherwise. The DELETE RETURNING
pattern is atomic against concurrent requests.

#### Parameters

##### params

###### cswAddress

`` `0x${string}` ``

###### db

`Db`

###### nonce

`string`

#### Returns

`Promise`\<\{ `ok`: `true`; `row`: [`CswEntryChallengeRow`](#cswentrychallengerow); \} \| \{ `ok`: `false`; `reason`: `"expired"` \| `"mismatch"` \| `"invalid"`; \}\>

***

### consumeZoraCswGateVerificationToken()

> **consumeZoraCswGateVerificationToken**(`params`): `Promise`\<\{ `ok`: `true`; `row`: [`ZoraCswGateVerifyTokenRow`](#zoracswgateverifytokenrow); \} \| \{ `ok`: `false`; `reason`: `"expired"` \| `"consumed"` \| `"invalid"`; `row?`: [`ZoraCswGateVerifyTokenRow`](#zoracswgateverifytokenrow); \}\>

Defined in: [server/\_lib/zora/cswGateVerification.ts:213](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L213)

#### Parameters

##### params

###### db

`Db`

###### telegramUserId

`string`

###### telegramUsername

`string` \| `null`

###### token

`string`

#### Returns

`Promise`\<\{ `ok`: `true`; `row`: [`ZoraCswGateVerifyTokenRow`](#zoracswgateverifytokenrow); \} \| \{ `ok`: `false`; `reason`: `"expired"` \| `"consumed"` \| `"invalid"`; `row?`: [`ZoraCswGateVerifyTokenRow`](#zoracswgateverifytokenrow); \}\>

***

### ensureCswEntryChallengeSchema()

> **ensureCswEntryChallengeSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/zora/cswGateVerification.ts:308](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L308)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### ensureZoraCswGateVerificationSchema()

> **ensureZoraCswGateVerificationSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/zora/cswGateVerification.ts:95](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L95)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### issueCswEntryChallenge()

> **issueCswEntryChallenge**(`params`): `Promise`\<\{ `expiresAt`: `string`; `message`: `string`; `nonce`: `string`; \}\>

Defined in: [server/\_lib/zora/cswGateVerification.ts:379](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L379)

#### Parameters

##### params

###### cswAddress

`` `0x${string}` ``

###### db

`Db`

###### ttlSeconds?

`number`

#### Returns

`Promise`\<\{ `expiresAt`: `string`; `message`: `string`; `nonce`: `string`; \}\>

***

### issueZoraCswGateVerificationToken()

> **issueZoraCswGateVerificationToken**(`params`): `Promise`\<\{ `expiresAt`: `string`; `token`: `string`; `tokenHash`: `string`; \}\>

Defined in: [server/\_lib/zora/cswGateVerification.ts:152](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L152)

#### Parameters

##### params

###### cswAddress

`` `0x${string}` ``

###### db

`Db`

###### requestedTelegramUsername?

`string` \| `null`

###### sourceUrl?

`string` \| `null`

###### ttlSeconds?

`number`

#### Returns

`Promise`\<\{ `expiresAt`: `string`; `token`: `string`; `tokenHash`: `string`; \}\>

***

### readZoraCswGateVerificationToken()

> **readZoraCswGateVerificationToken**(`params`): `Promise`\<[`ZoraCswGateVerifyTokenRow`](#zoracswgateverifytokenrow) \| `null`\>

Defined in: [server/\_lib/zora/cswGateVerification.ts:194](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L194)

#### Parameters

##### params

###### db

`Db`

###### token

`string`

#### Returns

`Promise`\<[`ZoraCswGateVerifyTokenRow`](#zoracswgateverifytokenrow) \| `null`\>

***

### verifyCswWalletSignature()

> **verifyCswWalletSignature**(`params`): `Promise`\<[`CswSignatureVerificationResult`](#cswsignatureverificationresult)\>

Defined in: [server/\_lib/zora/cswGateVerification.ts:487](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/cswGateVerification.ts#L487)

FIX: M-01 — Verify a signature from a CSW (EOA or ERC-4337 / smart wallet).

Strategy:
  1. viem.verifyMessage — handles EOA signatures (ecrecover) and, for some
     smart-wallet implementations, ERC-1271 as a fallback.
  2. If that returns false or throws, explicitly query the contract's
     isValidSignature(digest, signature) against multiple Base RPC endpoints
     and accept if any returns the EIP-1271 magic value.
  3. Separately recover the signer address for telemetry (not for auth).

Note: this helper is scoped to Base chain ID 8453. CSWs are Zora canonical
smart wallets deployed on Base; cross-chain proofs are out of scope and
would require an explicit chainId parameter.

#### Parameters

##### params

###### cswAddress

`` `0x${string}` ``

###### message

`string`

###### signature

`` `0x${string}` ``

#### Returns

`Promise`\<[`CswSignatureVerificationResult`](#cswsignatureverificationresult)\>
