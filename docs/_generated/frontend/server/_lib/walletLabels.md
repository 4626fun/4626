[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/walletLabels

# server/\_lib/walletLabels

## Type Aliases

### WalletLabel

> **WalletLabel** = `object`

Defined in: [server/\_lib/walletLabels.ts:16](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletLabels.ts#L16)

Wallet entity labeling — multi-source resolution.

Priority order:
  1. Etherscan v2 Nametag API (works if your key has Pro Plus tier)
  2. Built-in known-address map (~200 well-known addresses)
  3. WalletLabels API (optional, if WALLET_LABELS_API_KEY is set)

All sources degrade gracefully — if one fails, the next is tried.

#### Properties

##### category

> **category**: `string`

Defined in: [server/\_lib/walletLabels.ts:20](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletLabels.ts#L20)

Category (e.g. "exchange", "defi", "mixer", "bridge").

##### name

> **name**: `string`

Defined in: [server/\_lib/walletLabels.ts:18](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletLabels.ts#L18)

Display name of the entity (e.g. "Coinbase").

##### source

> **source**: `"etherscan"` \| `"known-address"` \| `"walletlabels"`

Defined in: [server/\_lib/walletLabels.ts:24](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletLabels.ts#L24)

Source of the label.

##### subcategory?

> `optional` **subcategory**: `string`

Defined in: [server/\_lib/walletLabels.ts:22](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletLabels.ts#L22)

Subcategory for finer granularity.

***

### WalletLabelResult

> **WalletLabelResult** = `object`

Defined in: [server/\_lib/walletLabels.ts:27](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletLabels.ts#L27)

#### Properties

##### address

> **address**: `string`

Defined in: [server/\_lib/walletLabels.ts:28](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletLabels.ts#L28)

##### isKnownEntity

> **isKnownEntity**: `boolean`

Defined in: [server/\_lib/walletLabels.ts:31](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletLabels.ts#L31)

Whether the address is associated with a known entity.

##### labels

> **labels**: [`WalletLabel`](#walletlabel)[]

Defined in: [server/\_lib/walletLabels.ts:29](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletLabels.ts#L29)

## Functions

### getWalletLabelsBatch()

> **getWalletLabelsBatch**(`addresses`, `chainId`): `Promise`\<`Record`\<`string`, [`WalletLabelResult`](#walletlabelresult)\>\>

Defined in: [server/\_lib/walletLabels.ts:397](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletLabels.ts#L397)

Resolve labels for multiple addresses in parallel.

#### Parameters

##### addresses

`string`[]

##### chainId

`number` = `8453`

#### Returns

`Promise`\<`Record`\<`string`, [`WalletLabelResult`](#walletlabelresult)\>\>

***

### getWalletLabelsForAddress()

> **getWalletLabelsForAddress**(`address`, `chainId`): `Promise`\<[`WalletLabelResult`](#walletlabelresult)\>

Defined in: [server/\_lib/walletLabels.ts:345](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletLabels.ts#L345)

Resolve labels for a single address using all available sources.

Priority: Supabase cache > Etherscan nametag > built-in known map > WalletLabels API.
Returns as soon as any source produces results. Writes results to Supabase cache.

#### Parameters

##### address

`string`

##### chainId

`number` = `8453`

#### Returns

`Promise`\<[`WalletLabelResult`](#walletlabelresult)\>
