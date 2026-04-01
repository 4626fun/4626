[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/onchain/protocolRewards

# src/lib/onchain/protocolRewards

## Functions

### fetchProtocolRewardsBalance()

> **fetchProtocolRewardsBalance**(`account`): `Promise`\<`bigint`\>

Defined in: [src/lib/onchain/protocolRewards.ts:53](https://github.com/wenakita/4626/blob/main/frontend/src/lib/onchain/protocolRewards.ts#L53)

#### Parameters

##### account

`` `0x${string}` ``

#### Returns

`Promise`\<`bigint`\>

***

### fetchProtocolRewardsBalances()

> **fetchProtocolRewardsBalances**(`accounts`): `Promise`\<`Record`\<`string`, `bigint`\>\>

Defined in: [src/lib/onchain/protocolRewards.ts:63](https://github.com/wenakita/4626/blob/main/frontend/src/lib/onchain/protocolRewards.ts#L63)

#### Parameters

##### accounts

`` `0x${string}` ``[]

#### Returns

`Promise`\<`Record`\<`string`, `bigint`\>\>

***

### fetchProtocolRewardsBalancesFromApi()

> **fetchProtocolRewardsBalancesFromApi**(`accounts`): `Promise`\<`Record`\<`string`, `bigint`\>\>

Defined in: [src/lib/onchain/protocolRewards.ts:80](https://github.com/wenakita/4626/blob/main/frontend/src/lib/onchain/protocolRewards.ts#L80)

#### Parameters

##### accounts

`` `0x${string}` ``[]

#### Returns

`Promise`\<`Record`\<`string`, `bigint`\>\>

***

### fetchProtocolRewardsWithdrawnFromApi()

> **fetchProtocolRewardsWithdrawnFromApi**(`accounts`): `Promise`\<`Record`\<`string`, `bigint`\>\>

Defined in: [src/lib/onchain/protocolRewards.ts:115](https://github.com/wenakita/4626/blob/main/frontend/src/lib/onchain/protocolRewards.ts#L115)

#### Parameters

##### accounts

`` `0x${string}` ``[]

#### Returns

`Promise`\<`Record`\<`string`, `bigint`\>\>
