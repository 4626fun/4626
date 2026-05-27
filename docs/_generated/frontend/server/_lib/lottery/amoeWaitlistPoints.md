[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lottery/amoeWaitlistPoints

# server/\_lib/lottery/amoeWaitlistPoints

## Type Aliases

### AmoeWaitlistAwardResult

> **AmoeWaitlistAwardResult** = `object`

Defined in: [server/\_lib/lottery/amoeWaitlistPoints.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWaitlistPoints.ts#L23)

#### Properties

##### awarded

> **awarded**: `boolean`

Defined in: [server/\_lib/lottery/amoeWaitlistPoints.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWaitlistPoints.ts#L24)

##### profileId

> **profileId**: `number` \| `null`

Defined in: [server/\_lib/lottery/amoeWaitlistPoints.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWaitlistPoints.ts#L25)

## Variables

### AMOE\_CHECKIN\_POINTS

> `const` **AMOE\_CHECKIN\_POINTS**: `6` = `6`

Defined in: [server/\_lib/lottery/amoeWaitlistPoints.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWaitlistPoints.ts#L20)

***

### AMOE\_CHECKIN\_SOURCE

> `const` **AMOE\_CHECKIN\_SOURCE**: `"amoe_checkin"`

Defined in: [server/\_lib/lottery/amoeWaitlistPoints.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWaitlistPoints.ts#L21)

## Functions

### awardAmoeCheckinPoints()

> **awardAmoeCheckinPoints**(`params`): `Promise`\<[`AmoeWaitlistAwardResult`](#amoewaitlistawardresult)\>

Defined in: [server/\_lib/lottery/amoeWaitlistPoints.ts:44](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWaitlistPoints.ts#L44)

#### Parameters

##### params

###### dayKey

`string`

###### db

`Db`

###### wallet

`string`

#### Returns

`Promise`\<[`AmoeWaitlistAwardResult`](#amoewaitlistawardresult)\>

***

### ~~resolveWaitlistProfileIdForWallet()~~

> **resolveWaitlistProfileIdForWallet**(`db`, `wallet`): `Promise`\<`number` \| `null`\>

Defined in: [server/\_lib/lottery/amoeWaitlistPoints.ts:37](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWaitlistPoints.ts#L37)

#### Parameters

##### db

`Db`

##### wallet

`string`

#### Returns

`Promise`\<`number` \| `null`\>

#### Deprecated

Use `resolveAmoePointsProfile(..., 'privy_linked')` directly.
