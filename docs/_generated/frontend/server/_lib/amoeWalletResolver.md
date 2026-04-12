[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/amoeWalletResolver

# server/\_lib/amoeWalletResolver

## Type Aliases

### ResolveAmoeWalletResult

> **ResolveAmoeWalletResult** = \{ `ok`: `true`; `value`: [`ResolvedAmoeWallet`](#resolvedamoewallet); \} \| \{ `error`: `"invalid_wallet"` \| `"wallet_authority_mismatch"`; `ok`: `false`; \}

Defined in: [server/\_lib/amoeWalletResolver.ts:15](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/amoeWalletResolver.ts#L15)

***

### ResolvedAmoeWallet

> **ResolvedAmoeWallet** = `object`

Defined in: [server/\_lib/amoeWalletResolver.ts:8](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/amoeWalletResolver.ts#L8)

#### Properties

##### activeOwnerWalletAddress

> **activeOwnerWalletAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/amoeWalletResolver.ts:12](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/amoeWalletResolver.ts#L12)

##### canonicalSmartWalletAddress

> **canonicalSmartWalletAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/amoeWalletResolver.ts:11](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/amoeWalletResolver.ts#L11)

##### profileId

> **profileId**: `number` \| `null`

Defined in: [server/\_lib/amoeWalletResolver.ts:10](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/amoeWalletResolver.ts#L10)

##### wallet

> **wallet**: `` `0x${string}` ``

Defined in: [server/\_lib/amoeWalletResolver.ts:9](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/amoeWalletResolver.ts#L9)

## Functions

### resolveAmoeWallet()

> **resolveAmoeWallet**(`params`): `Promise`\<[`ResolveAmoeWalletResult`](#resolveamoewalletresult)\>

Defined in: [server/\_lib/amoeWalletResolver.ts:19](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/amoeWalletResolver.ts#L19)

#### Parameters

##### params

###### authAddress?

`string` \| `null`

###### requestedWallet?

`string` \| `null`

#### Returns

`Promise`\<[`ResolveAmoeWalletResult`](#resolveamoewalletresult)\>
