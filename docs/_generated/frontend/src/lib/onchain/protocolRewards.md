[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/onchain/protocolRewards

# src/lib/onchain/protocolRewards

## Functions

### fetchProtocolRewardsBalance()

> **fetchProtocolRewardsBalance**(`account`): `Promise`\<`bigint`\>

Defined in: [src/lib/onchain/protocolRewards.ts:46](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/protocolRewards.ts#L46)

#### Parameters

##### account

`` `0x${string}` ``

#### Returns

`Promise`\<`bigint`\>

***

### fetchProtocolRewardsBalances()

> **fetchProtocolRewardsBalances**(`accounts`): `Promise`\<`Record`\<`string`, `bigint`\>\>

Defined in: [src/lib/onchain/protocolRewards.ts:56](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/protocolRewards.ts#L56)

#### Parameters

##### accounts

`` `0x${string}` ``[]

#### Returns

`Promise`\<`Record`\<`string`, `bigint`\>\>

***

### fetchProtocolRewardsBalancesFromApi()

> **fetchProtocolRewardsBalancesFromApi**(`accounts`): `Promise`\<`Record`\<`string`, `bigint`\>\>

Defined in: [src/lib/onchain/protocolRewards.ts:73](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/protocolRewards.ts#L73)

#### Parameters

##### accounts

`` `0x${string}` ``[]

#### Returns

`Promise`\<`Record`\<`string`, `bigint`\>\>

***

### fetchProtocolRewardsWithdrawnFromApi()

> **fetchProtocolRewardsWithdrawnFromApi**(`accounts`): `Promise`\<`Record`\<`string`, `bigint`\>\>

Defined in: [src/lib/onchain/protocolRewards.ts:108](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/protocolRewards.ts#L108)

#### Parameters

##### accounts

`` `0x${string}` ``[]

#### Returns

`Promise`\<`Record`\<`string`, `bigint`\>\>
