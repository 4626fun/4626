[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/lottery/amoeWaitlistPoints

# server/\_lib/lottery/amoeWaitlistPoints

## Type Aliases

### AmoeWaitlistAwardResult

> **AmoeWaitlistAwardResult** = `object`

Defined in: [server/\_lib/lottery/amoeWaitlistPoints.ts:47](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/lottery/amoeWaitlistPoints.ts#L47)

#### Properties

##### awarded

> **awarded**: `boolean`

Defined in: [server/\_lib/lottery/amoeWaitlistPoints.ts:48](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/lottery/amoeWaitlistPoints.ts#L48)

##### profileId

> **profileId**: `number` \| `null`

Defined in: [server/\_lib/lottery/amoeWaitlistPoints.ts:50](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/lottery/amoeWaitlistPoints.ts#L50)

`null` when the wallet isn't linked to a Privy-backed waitlist profile.

## Variables

### AMOE\_CHECKIN\_POINTS

> `const` **AMOE\_CHECKIN\_POINTS**: `6` = `6`

Defined in: [server/\_lib/lottery/amoeWaitlistPoints.ts:44](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/lottery/amoeWaitlistPoints.ts#L44)

***

### AMOE\_CHECKIN\_SOURCE

> `const` **AMOE\_CHECKIN\_SOURCE**: `"amoe_checkin"`

Defined in: [server/\_lib/lottery/amoeWaitlistPoints.ts:45](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/lottery/amoeWaitlistPoints.ts#L45)

## Functions

### awardAmoeCheckinPoints()

> **awardAmoeCheckinPoints**(`params`): `Promise`\<[`AmoeWaitlistAwardResult`](#amoewaitlistawardresult)\>

Defined in: [server/\_lib/lottery/amoeWaitlistPoints.ts:95](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/lottery/amoeWaitlistPoints.ts#L95)

Award `amoe_checkin` points to the profile that owns `wallet`, idempotent
per (wallet, dayKey). No explicit cap: the AMOE daily check-in itself is
already 1-per-day per wallet, so the natural ceiling is
`AMOE_CHECKIN_POINTS` per profile per day.

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

### resolveWaitlistProfileIdForWallet()

> **resolveWaitlistProfileIdForWallet**(`db`, `wallet`): `Promise`\<`number` \| `null`\>

Defined in: [server/\_lib/lottery/amoeWaitlistPoints.ts:67](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/lottery/amoeWaitlistPoints.ts#L67)

Resolve a canonical waitlist profile id for a wallet address, or `null`
when the wallet hasn't been linked via onboarding. Uses `profile_wallets`
so any linked wallet (canonical CSW, embedded EOA, or secondary EOA
owner) attributes back to the correct profile.

#### Parameters

##### db

`Db`

##### wallet

`string`

#### Returns

`Promise`\<`number` \| `null`\>
