[**4626-miniapp**](../../../index.md)

***

[4626-miniapp](../../../index.md) / src/lib/onchain/protocolRewards

# src/lib/onchain/protocolRewards

## Functions

### fetchProtocolRewardsBalance()

> **fetchProtocolRewardsBalance**(`account`): `Promise`\<`bigint`\>

Defined in: [lib/onchain/protocolRewards.ts:45](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/protocolRewards.ts#L45)

#### Parameters

##### account

`` `0x${string}` ``

#### Returns

`Promise`\<`bigint`\>

***

### fetchProtocolRewardsBalances()

> **fetchProtocolRewardsBalances**(`accounts`): `Promise`\<`Record`\<`string`, `bigint`\>\>

Defined in: [lib/onchain/protocolRewards.ts:55](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/protocolRewards.ts#L55)

#### Parameters

##### accounts

`` `0x${string}` ``[]

#### Returns

`Promise`\<`Record`\<`string`, `bigint`\>\>

***

### fetchProtocolRewardsBalancesFromApi()

> **fetchProtocolRewardsBalancesFromApi**(`accounts`): `Promise`\<`Record`\<`string`, `bigint`\>\>

Defined in: [lib/onchain/protocolRewards.ts:78](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/protocolRewards.ts#L78)

#### Parameters

##### accounts

`` `0x${string}` ``[]

#### Returns

`Promise`\<`Record`\<`string`, `bigint`\>\>

***

### fetchProtocolRewardsWithdrawnFromApi()

> **fetchProtocolRewardsWithdrawnFromApi**(`accounts`): `Promise`\<`Record`\<`string`, `bigint`\>\>

Defined in: [lib/onchain/protocolRewards.ts:113](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/protocolRewards.ts#L113)

#### Parameters

##### accounts

`` `0x${string}` ``[]

#### Returns

`Promise`\<`Record`\<`string`, `bigint`\>\>
