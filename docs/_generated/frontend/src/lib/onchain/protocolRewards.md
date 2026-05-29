[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/onchain/protocolRewards

# src/lib/onchain/protocolRewards

## Functions

### fetchProtocolRewardsBalance()

> **fetchProtocolRewardsBalance**(`account`): `Promise`\<`bigint`\>

Defined in: [src/lib/onchain/protocolRewards.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/lib/onchain/protocolRewards.ts#L46)

#### Parameters

##### account

`string`

#### Returns

`Promise`\<`bigint`\>

***

### fetchProtocolRewardsBalances()

> **fetchProtocolRewardsBalances**(`accounts`): `Promise`\<`Record`\<`string`, `bigint`\>\>

Defined in: [src/lib/onchain/protocolRewards.ts:56](https://github.com/wenakita/4626/blob/main/frontend/src/lib/onchain/protocolRewards.ts#L56)

#### Parameters

##### accounts

`string`[]

#### Returns

`Promise`\<`Record`\<`string`, `bigint`\>\>

***

### fetchProtocolRewardsBalancesFromApi()

> **fetchProtocolRewardsBalancesFromApi**(`accounts`): `Promise`\<`Record`\<`string`, `bigint`\>\>

Defined in: [src/lib/onchain/protocolRewards.ts:73](https://github.com/wenakita/4626/blob/main/frontend/src/lib/onchain/protocolRewards.ts#L73)

#### Parameters

##### accounts

`string`[]

#### Returns

`Promise`\<`Record`\<`string`, `bigint`\>\>

***

### fetchProtocolRewardsWithdrawnFromApi()

> **fetchProtocolRewardsWithdrawnFromApi**(`accounts`): `Promise`\<`Record`\<`string`, `bigint`\>\>

Defined in: [src/lib/onchain/protocolRewards.ts:108](https://github.com/wenakita/4626/blob/main/frontend/src/lib/onchain/protocolRewards.ts#L108)

#### Parameters

##### accounts

`string`[]

#### Returns

`Promise`\<`Record`\<`string`, `bigint`\>\>
