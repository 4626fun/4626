[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/zora-profiles/enrichProfileWallets

# server/\_lib/zora-profiles/enrichProfileWallets

## Type Aliases

### ProfileWalletEnrichResult

> **ProfileWalletEnrichResult** = `object`

Defined in: [server/\_lib/zora-profiles/enrichProfileWallets.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-profiles/enrichProfileWallets.ts#L11)

#### Properties

##### failed

> **failed**: `number`

Defined in: [server/\_lib/zora-profiles/enrichProfileWallets.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-profiles/enrichProfileWallets.ts#L15)

##### selected

> **selected**: `number`

Defined in: [server/\_lib/zora-profiles/enrichProfileWallets.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-profiles/enrichProfileWallets.ts#L12)

##### updated

> **updated**: `number`

Defined in: [server/\_lib/zora-profiles/enrichProfileWallets.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-profiles/enrichProfileWallets.ts#L13)

##### withSmartWallet

> **withSmartWallet**: `number`

Defined in: [server/\_lib/zora-profiles/enrichProfileWallets.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-profiles/enrichProfileWallets.ts#L14)

## Functions

### enrichProfileWallets()

> **enrichProfileWallets**(`db`, `apiKey`): `Promise`\<[`ProfileWalletEnrichResult`](#profilewalletenrichresult)\>

Defined in: [server/\_lib/zora-profiles/enrichProfileWallets.ts:75](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-profiles/enrichProfileWallets.ts#L75)

#### Parameters

##### db

`SupabaseProfileClient`

##### apiKey

`string`

#### Returns

`Promise`\<[`ProfileWalletEnrichResult`](#profilewalletenrichresult)\>
