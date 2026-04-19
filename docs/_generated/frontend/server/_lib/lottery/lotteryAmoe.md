[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/lottery/lotteryAmoe

# server/\_lib/lottery/lotteryAmoe

## Variables

### AMOE\_CREDITS\_PER\_ENTRY

> `const` **AMOE\_CREDITS\_PER\_ENTRY**: `100` = `100`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L11)

***

### AMOE\_DAILY\_TWITTER\_CREDIT

> `const` **AMOE\_DAILY\_TWITTER\_CREDIT**: `1` = `1`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L12)

## Functions

### buildAmoeEntryMessage()

> **buildAmoeEntryMessage**(`fields`): `string`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:493](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L493)

#### Parameters

##### fields

`AmoeMessageFields`

#### Returns

`string`

***

### claimDailyTwitterCheckin()

> **claimDailyTwitterCheckin**(`params`): `Promise`\<\{ `awarded`: `boolean`; `awardedCredits`: `number`; `credits`: `number`; `creditsPerEntry`: `number`; `entriesAvailable`: `number`; `wallet`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:309](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L309)

#### Parameters

##### params

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `awarded`: `boolean`; `awardedCredits`: `number`; `credits`: `number`; `creditsPerEntry`: `number`; `entriesAvailable`: `number`; `wallet`: `` `0x${string}` ``; \}\>

***

### consumeAmoeCreditsForEntry()

> **consumeAmoeCreditsForEntry**(`params`): `Promise`\<\{ `consumed`: `number`; `creditsPerEntry`: `number`; `creditsRemaining`: `number`; `entriesAvailable`: `number`; `wallet`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:380](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L380)

#### Parameters

##### params

###### refId?

`string`

###### requiredCredits?

`number`

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `consumed`: `number`; `creditsPerEntry`: `number`; `creditsRemaining`: `number`; `entriesAvailable`: `number`; `wallet`: `` `0x${string}` ``; \}\>

***

### createAmoeAttestation()

> **createAmoeAttestation**(`params`): `Promise`\<\{ `buyer`: `` `0x${string}` ``; `callData`: `` `0x${string}` ``; `creatorCoin`: `` `0x${string}` ``; `deadline`: `number`; `nonce`: `` `0x${string}` ``; `signature`: `` `0x${string}` ``; `to`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:732](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L732)

#### Parameters

##### params

###### creatorCoin

`` `0x${string}` ``

###### expiresAt

`string`

###### lotteryManager

`` `0x${string}` ``

###### nonce

`` `0x${string}` ``

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `buyer`: `` `0x${string}` ``; `callData`: `` `0x${string}` ``; `creatorCoin`: `` `0x${string}` ``; `deadline`: `number`; `nonce`: `` `0x${string}` ``; `signature`: `` `0x${string}` ``; `to`: `` `0x${string}` ``; \}\>

***

### getAmoeCreditSnapshot()

> **getAmoeCreditSnapshot**(`params`): `Promise`\<\{ `credits`: `number`; `creditsPerEntry`: `number`; `entriesAvailable`: `number`; `nextEntryAtCredits`: `number`; `wallet`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:290](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L290)

#### Parameters

##### params

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `credits`: `number`; `creditsPerEntry`: `number`; `entriesAvailable`: `number`; `nextEntryAtCredits`: `number`; `wallet`: `` `0x${string}` ``; \}\>

***

### issueAmoeNonce()

> **issueAmoeNonce**(`params`): `Promise`\<\{ `expiresAt`: `string`; `issuedAt`: `string`; `nonce`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:543](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L543)

#### Parameters

##### params

###### creatorCoin

`` `0x${string}` ``

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `expiresAt`: `string`; `issuedAt`: `string`; `nonce`: `` `0x${string}` ``; \}\>

***

### verifyAmoeEntryProof()

> **verifyAmoeEntryProof**(`params`): `Promise`\<\{ `creatorCoin`: `` `0x${string}` ``; `expiresAt`: `string`; `nonce`: `` `0x${string}` ``; `wallet`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:693](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoe.ts#L693)

#### Parameters

##### params

###### creatorCoin

`` `0x${string}` ``

###### lotteryManager

`` `0x${string}` ``

###### message

`string`

###### signature

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `creatorCoin`: `` `0x${string}` ``; `expiresAt`: `string`; `nonce`: `` `0x${string}` ``; `wallet`: `` `0x${string}` ``; \}\>
