[**creatorvault-miniapp**](../../../index.md)

***

[creatorvault-miniapp](../../../index.md) / src/lib/onchain/protocolRewards

# src/lib/onchain/protocolRewards

## Functions

### fetchProtocolRewardsBalance()

> **fetchProtocolRewardsBalance**(`account`): `Promise`\<`bigint`\>

Defined in: [lib/onchain/protocolRewards.ts:30](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/onchain/protocolRewards.ts#L30)

#### Parameters

##### account

`` `0x${string}` ``

#### Returns

`Promise`\<`bigint`\>

***

### fetchProtocolRewardsBalances()

> **fetchProtocolRewardsBalances**(`accounts`): `Promise`\<`Record`\<`string`, `bigint`\>\>

Defined in: [lib/onchain/protocolRewards.ts:40](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/onchain/protocolRewards.ts#L40)

#### Parameters

##### accounts

`` `0x${string}` ``[]

#### Returns

`Promise`\<`Record`\<`string`, `bigint`\>\>

***

### fetchProtocolRewardsBalancesFromApi()

> **fetchProtocolRewardsBalancesFromApi**(`accounts`): `Promise`\<`Record`\<`string`, `bigint`\>\>

Defined in: [lib/onchain/protocolRewards.ts:63](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/onchain/protocolRewards.ts#L63)

#### Parameters

##### accounts

`` `0x${string}` ``[]

#### Returns

`Promise`\<`Record`\<`string`, `bigint`\>\>

***

### fetchProtocolRewardsWithdrawnFromApi()

> **fetchProtocolRewardsWithdrawnFromApi**(`accounts`): `Promise`\<`Record`\<`string`, `bigint`\>\>

Defined in: [lib/onchain/protocolRewards.ts:98](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/onchain/protocolRewards.ts#L98)

#### Parameters

##### accounts

`` `0x${string}` ``[]

#### Returns

`Promise`\<`Record`\<`string`, `bigint`\>\>
