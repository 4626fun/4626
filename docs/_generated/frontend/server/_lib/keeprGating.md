[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/keeprGating

# server/\_lib/keeprGating

## Type Aliases

### SharesEligibilityEvidence

> **SharesEligibilityEvidence** = `object`

Defined in: [server/\_lib/keeprGating.ts:34](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/keeprGating.ts#L34)

#### Properties

##### blockNumber

> **blockNumber**: `number` \| `null`

Defined in: [server/\_lib/keeprGating.ts:37](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/keeprGating.ts#L37)

##### rpcUrl

> **rpcUrl**: `string` \| `null`

Defined in: [server/\_lib/keeprGating.ts:38](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/keeprGating.ts#L38)

##### shareBalance

> **shareBalance**: `string`

Defined in: [server/\_lib/keeprGating.ts:35](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/keeprGating.ts#L35)

##### threshold

> **threshold**: `string`

Defined in: [server/\_lib/keeprGating.ts:36](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/keeprGating.ts#L36)

***

### SharesEligibilityResult

> **SharesEligibilityResult** = `object`

Defined in: [server/\_lib/keeprGating.ts:41](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/keeprGating.ts#L41)

#### Properties

##### eligible

> **eligible**: `boolean`

Defined in: [server/\_lib/keeprGating.ts:42](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/keeprGating.ts#L42)

##### evidence

> **evidence**: [`SharesEligibilityEvidence`](#shareseligibilityevidence)

Defined in: [server/\_lib/keeprGating.ts:44](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/keeprGating.ts#L44)

##### reason

> **reason**: `"share_balance>=threshold"` \| `"share_balance<threshold"` \| `"onchain_read_failed"`

Defined in: [server/\_lib/keeprGating.ts:43](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/keeprGating.ts#L43)

## Functions

### checkSharesEligibility()

> **checkSharesEligibility**(`params`): `Promise`\<[`SharesEligibilityResult`](#shareseligibilityresult)\>

Defined in: [server/\_lib/keeprGating.ts:47](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/keeprGating.ts#L47)

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

Defined in: [server/\_lib/keeprGating.ts:30](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/keeprGating.ts#L30)

#### Returns

`string`[]
