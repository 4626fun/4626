[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/wallet/walletLabels

# server/\_lib/wallet/walletLabels

## Type Aliases

### WalletLabel

> **WalletLabel** = `object`

Defined in: [server/\_lib/wallet/walletLabels.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletLabels.ts#L23)

#### Properties

##### category

> **category**: `string`

Defined in: [server/\_lib/wallet/walletLabels.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletLabels.ts#L27)

Category (e.g. "exchange", "defi", "mixer", "bridge").

##### name

> **name**: `string`

Defined in: [server/\_lib/wallet/walletLabels.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletLabels.ts#L25)

Display name of the entity (e.g. "Coinbase").

##### source

> **source**: `"etherscan"` \| `"known-address"` \| `"walletlabels"` \| `"alfaclub"`

Defined in: [server/\_lib/wallet/walletLabels.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletLabels.ts#L31)

Source of the label.

##### subcategory?

> `optional` **subcategory**: `string`

Defined in: [server/\_lib/wallet/walletLabels.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletLabels.ts#L29)

Subcategory for finer granularity.

***

### WalletLabelResult

> **WalletLabelResult** = `object`

Defined in: [server/\_lib/wallet/walletLabels.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletLabels.ts#L34)

#### Properties

##### address

> **address**: `string`

Defined in: [server/\_lib/wallet/walletLabels.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletLabels.ts#L35)

##### isKnownEntity

> **isKnownEntity**: `boolean`

Defined in: [server/\_lib/wallet/walletLabels.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletLabels.ts#L38)

Whether the address is associated with a known entity.

##### labels

> **labels**: [`WalletLabel`](#walletlabel)[]

Defined in: [server/\_lib/wallet/walletLabels.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletLabels.ts#L36)

## Functions

### getWalletLabelsBatch()

> **getWalletLabelsBatch**(`addresses`, `chainId`): `Promise`\<`Record`\<`string`, [`WalletLabelResult`](#walletlabelresult)\>\>

Defined in: [server/\_lib/wallet/walletLabels.ts:475](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletLabels.ts#L475)

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

Defined in: [server/\_lib/wallet/walletLabels.ts:416](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletLabels.ts#L416)

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
