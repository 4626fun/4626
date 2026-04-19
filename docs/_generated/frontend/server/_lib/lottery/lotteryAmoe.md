[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/lottery/lotteryAmoe

# server/\_lib/lottery/lotteryAmoe

## Variables

### AMOE\_CREDITS\_PER\_ENTRY

> `const` **AMOE\_CREDITS\_PER\_ENTRY**: `100` = `100`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:11](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/lottery/lotteryAmoe.ts#L11)

***

### AMOE\_DAILY\_TWITTER\_CREDIT

> `const` **AMOE\_DAILY\_TWITTER\_CREDIT**: `1` = `1`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:12](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/lottery/lotteryAmoe.ts#L12)

## Functions

### buildAmoeEntryMessage()

> **buildAmoeEntryMessage**(`fields`): `string`

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:469](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/lottery/lotteryAmoe.ts#L469)

#### Parameters

##### fields

`AmoeMessageFields`

#### Returns

`string`

***

### claimDailyTwitterCheckin()

> **claimDailyTwitterCheckin**(`params`): `Promise`\<\{ `awarded`: `boolean`; `awardedCredits`: `number`; `credits`: `number`; `creditsPerEntry`: `number`; `entriesAvailable`: `number`; `wallet`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:285](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/lottery/lotteryAmoe.ts#L285)

#### Parameters

##### params

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `awarded`: `boolean`; `awardedCredits`: `number`; `credits`: `number`; `creditsPerEntry`: `number`; `entriesAvailable`: `number`; `wallet`: `` `0x${string}` ``; \}\>

***

### consumeAmoeCreditsForEntry()

> **consumeAmoeCreditsForEntry**(`params`): `Promise`\<\{ `consumed`: `number`; `creditsPerEntry`: `number`; `creditsRemaining`: `number`; `entriesAvailable`: `number`; `wallet`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:356](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/lottery/lotteryAmoe.ts#L356)

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

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:708](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/lottery/lotteryAmoe.ts#L708)

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

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:266](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/lottery/lotteryAmoe.ts#L266)

#### Parameters

##### params

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `credits`: `number`; `creditsPerEntry`: `number`; `entriesAvailable`: `number`; `nextEntryAtCredits`: `number`; `wallet`: `` `0x${string}` ``; \}\>

***

### issueAmoeNonce()

> **issueAmoeNonce**(`params`): `Promise`\<\{ `expiresAt`: `string`; `issuedAt`: `string`; `nonce`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:519](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/lottery/lotteryAmoe.ts#L519)

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

Defined in: [server/\_lib/lottery/lotteryAmoe.ts:669](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/lottery/lotteryAmoe.ts#L669)

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
