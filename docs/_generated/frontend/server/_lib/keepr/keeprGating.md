[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/keepr/keeprGating

# server/\_lib/keepr/keeprGating

## Type Aliases

### SharesEligibilityEvidence

> **SharesEligibilityEvidence** = `object`

Defined in: [server/\_lib/keepr/keeprGating.ts:34](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/keepr/keeprGating.ts#L34)

#### Properties

##### blockNumber

> **blockNumber**: `number` \| `null`

Defined in: [server/\_lib/keepr/keeprGating.ts:37](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/keepr/keeprGating.ts#L37)

##### rpcUrl

> **rpcUrl**: `string` \| `null`

Defined in: [server/\_lib/keepr/keeprGating.ts:38](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/keepr/keeprGating.ts#L38)

##### shareBalance

> **shareBalance**: `string`

Defined in: [server/\_lib/keepr/keeprGating.ts:35](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/keepr/keeprGating.ts#L35)

##### threshold

> **threshold**: `string`

Defined in: [server/\_lib/keepr/keeprGating.ts:36](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/keepr/keeprGating.ts#L36)

***

### SharesEligibilityResult

> **SharesEligibilityResult** = `object`

Defined in: [server/\_lib/keepr/keeprGating.ts:41](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/keepr/keeprGating.ts#L41)

#### Properties

##### eligible

> **eligible**: `boolean`

Defined in: [server/\_lib/keepr/keeprGating.ts:42](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/keepr/keeprGating.ts#L42)

##### evidence

> **evidence**: [`SharesEligibilityEvidence`](#shareseligibilityevidence)

Defined in: [server/\_lib/keepr/keeprGating.ts:44](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/keepr/keeprGating.ts#L44)

##### reason

> **reason**: `"share_balance>=threshold"` \| `"share_balance<threshold"` \| `"onchain_read_failed"`

Defined in: [server/\_lib/keepr/keeprGating.ts:43](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/keepr/keeprGating.ts#L43)

## Functions

### checkSharesEligibility()

> **checkSharesEligibility**(`params`): `Promise`\<[`SharesEligibilityResult`](#shareseligibilityresult)\>

Defined in: [server/\_lib/keepr/keeprGating.ts:47](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/keepr/keeprGating.ts#L47)

#### Parameters

##### params

###### minShares

`bigint`

###### rpcUrls?

`string`[]

###### shareToken

`` `0x${string}` ``

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<[`SharesEligibilityResult`](#shareseligibilityresult)\>

***

### getKeeprBaseRpcUrls()

> **getKeeprBaseRpcUrls**(): `string`[]

Defined in: [server/\_lib/keepr/keeprGating.ts:30](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/keepr/keeprGating.ts#L30)

#### Returns

`string`[]
