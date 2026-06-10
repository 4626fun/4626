[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/onchain/baseNativeBalance

# server/\_lib/onchain/baseNativeBalance

## Functions

### readMaxNativeBalanceWei()

> **readMaxNativeBalanceWei**(`address`): `Promise`\<`bigint`\>

Defined in: [server/\_lib/onchain/baseNativeBalance.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/baseNativeBalance.ts#L11)

Read native balance from every configured Base RPC and return the highest value.

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`bigint`\>

***

### resolveBaseRpcUrls()

> **resolveBaseRpcUrls**(): `string`[]

Defined in: [server/\_lib/onchain/baseNativeBalance.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/baseNativeBalance.ts#L6)

#### Returns

`string`[]
