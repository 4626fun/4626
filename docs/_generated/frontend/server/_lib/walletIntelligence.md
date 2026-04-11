[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/walletIntelligence

# server/\_lib/walletIntelligence

## Type Aliases

### IntelEdge

> **IntelEdge** = `object`

Defined in: [server/\_lib/walletIntelligence.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L46)

#### Properties

##### data?

> `optional` **data**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/walletIntelligence.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L50)

##### source

> **source**: `string`

Defined in: [server/\_lib/walletIntelligence.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L47)

##### target

> **target**: `string`

Defined in: [server/\_lib/walletIntelligence.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L48)

##### type

> **type**: [`IntelEdgeType`](#inteledgetype-1)

Defined in: [server/\_lib/walletIntelligence.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L49)

***

### IntelEdgeType

> **IntelEdgeType** = `"funded_by"` \| `"labeled_as"` \| `"has_portfolio"` \| `"has_ens"` \| `"has_basename"` \| `"has_lens"` \| `"has_reputation"`

Defined in: [server/\_lib/walletIntelligence.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L30)

***

### IntelGroup

> **IntelGroup** = `object`

Defined in: [server/\_lib/walletIntelligence.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L53)

#### Properties

##### id

> **id**: `string`

Defined in: [server/\_lib/walletIntelligence.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L54)

##### label

> **label**: `string`

Defined in: [server/\_lib/walletIntelligence.ts:55](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L55)

##### nodeIds

> **nodeIds**: `string`[]

Defined in: [server/\_lib/walletIntelligence.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L56)

***

### IntelNode

> **IntelNode** = `object`

Defined in: [server/\_lib/walletIntelligence.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L39)

#### Properties

##### data

> **data**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/walletIntelligence.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L43)

##### id

> **id**: `string`

Defined in: [server/\_lib/walletIntelligence.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L40)

##### label

> **label**: `string`

Defined in: [server/\_lib/walletIntelligence.ts:42](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L42)

##### type

> **type**: [`IntelNodeType`](#intelnodetype-1)

Defined in: [server/\_lib/walletIntelligence.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L41)

***

### IntelNodeType

> **IntelNodeType** = `"wallet"` \| `"funder"` \| `"entity-label"` \| `"portfolio"` \| `"ens-name"` \| `"basename"` \| `"lens-account"` \| `"reputation-score"`

Defined in: [server/\_lib/walletIntelligence.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L20)

***

### WalletIntelligenceGraph

> **WalletIntelligenceGraph** = `object`

Defined in: [server/\_lib/walletIntelligence.ts:59](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L59)

#### Properties

##### canonicalWallet

> **canonicalWallet**: `string`

Defined in: [server/\_lib/walletIntelligence.ts:61](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L61)

##### edges

> **edges**: [`IntelEdge`](#inteledge)[]

Defined in: [server/\_lib/walletIntelligence.ts:63](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L63)

##### generatedAt

> **generatedAt**: `string`

Defined in: [server/\_lib/walletIntelligence.ts:81](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L81)

##### groups

> **groups**: [`IntelGroup`](#intelgroup)[]

Defined in: [server/\_lib/walletIntelligence.ts:64](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L64)

##### nodes

> **nodes**: [`IntelNode`](#intelnode)[]

Defined in: [server/\_lib/walletIntelligence.ts:62](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L62)

##### source

> **source**: `string`

Defined in: [server/\_lib/walletIntelligence.ts:82](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L82)

##### sources

> **sources**: `object`

Defined in: [server/\_lib/walletIntelligence.ts:66](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L66)

Raw source data for consumers that want structured access.

###### basename

> **basename**: `string` \| `null`

###### ens

> **ens**: [`EnsProfile`](ensResolver.md#ensprofile) \| `null`

###### funderTrace

> **funderTrace**: [`FunderTraceResult`](funderTrace.md#fundertraceresult) \| `null`

###### labels

> **labels**: `Record`\<`string`, [`WalletLabelResult`](walletLabels.md#walletlabelresult)\>

###### lens

> **lens**: \{ `accountAddress`: `string`; `avatar`: `string` \| `null`; `displayName`: `string`; `handle`: `string` \| `null`; `ownerAddress`: `string` \| `null`; `username`: `string` \| `null`; \} \| `null`

###### portfolio

> **portfolio**: [`WalletPortfolio`](debankPortfolio.md#walletportfolio) \| `null`

##### target

> **target**: `string`

Defined in: [server/\_lib/walletIntelligence.ts:60](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L60)

***

### WalletIntelligenceOptions

> **WalletIntelligenceOptions** = `object`

Defined in: [server/\_lib/walletIntelligence.ts:89](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L89)

#### Properties

##### chainIds?

> `optional` **chainIds**: `number`[]

Defined in: [server/\_lib/walletIntelligence.ts:93](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L93)

Chain IDs for funder tracing (default [8453, 1]).

##### hops?

> `optional` **hops**: `number`

Defined in: [server/\_lib/walletIntelligence.ts:91](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L91)

Number of funder hops to trace (default 3, max 5).

##### includeEns?

> `optional` **includeEns**: `boolean`

Defined in: [server/\_lib/walletIntelligence.ts:97](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L97)

Whether to include ENS resolution (default true).

##### includeLabels?

> `optional` **includeLabels**: `boolean`

Defined in: [server/\_lib/walletIntelligence.ts:101](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L101)

Whether to include entity labels (default true).

##### includeLens?

> `optional` **includeLens**: `boolean`

Defined in: [server/\_lib/walletIntelligence.ts:99](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L99)

Whether to include Lens resolution (default true).

##### includePortfolio?

> `optional` **includePortfolio**: `boolean`

Defined in: [server/\_lib/walletIntelligence.ts:95](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L95)

Whether to include portfolio data (default true).

## Functions

### buildWalletIntelligence()

> **buildWalletIntelligence**(`address`, `options`): `Promise`\<[`WalletIntelligenceGraph`](#walletintelligencegraph)\>

Defined in: [server/\_lib/walletIntelligence.ts:108](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletIntelligence.ts#L108)

#### Parameters

##### address

`string`

##### options

[`WalletIntelligenceOptions`](#walletintelligenceoptions) = `{}`

#### Returns

`Promise`\<[`WalletIntelligenceGraph`](#walletintelligencegraph)\>
