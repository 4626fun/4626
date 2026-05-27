[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/walletIntelligence

# server/\_lib/wallet/walletIntelligence

## Type Aliases

### IntelEdge

> **IntelEdge** = `object`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:51](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L51)

#### Properties

##### data?

> `optional` **data**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/wallet/walletIntelligence.ts:55](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L55)

##### source

> **source**: `string`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:52](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L52)

##### target

> **target**: `string`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:53](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L53)

##### type

> **type**: [`IntelEdgeType`](#inteledgetype-1)

Defined in: [server/\_lib/wallet/walletIntelligence.ts:54](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L54)

***

### IntelEdgeType

> **IntelEdgeType** = `"funded_by"` \| `"labeled_as"` \| `"has_portfolio"` \| `"has_ens"` \| `"has_basename"` \| `"has_lens"` \| `"has_reputation"`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L35)

***

### IntelGroup

> **IntelGroup** = `object`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:58](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L58)

#### Properties

##### id

> **id**: `string`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:59](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L59)

##### label

> **label**: `string`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:60](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L60)

##### nodeIds

> **nodeIds**: `string`[]

Defined in: [server/\_lib/wallet/walletIntelligence.ts:61](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L61)

***

### IntelNode

> **IntelNode** = `object`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:44](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L44)

#### Properties

##### data

> **data**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/wallet/walletIntelligence.ts:48](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L48)

##### id

> **id**: `string`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:45](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L45)

##### label

> **label**: `string`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:47](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L47)

##### type

> **type**: [`IntelNodeType`](#intelnodetype-1)

Defined in: [server/\_lib/wallet/walletIntelligence.ts:46](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L46)

***

### IntelNodeType

> **IntelNodeType** = `"wallet"` \| `"funder"` \| `"entity-label"` \| `"portfolio"` \| `"ens-name"` \| `"basename"` \| `"lens-account"` \| `"reputation-score"`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L25)

***

### WalletIntelligenceGraph

> **WalletIntelligenceGraph** = `object`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:64](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L64)

#### Properties

##### canonicalWallet

> **canonicalWallet**: `string`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:66](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L66)

##### edges

> **edges**: [`IntelEdge`](#inteledge)[]

Defined in: [server/\_lib/wallet/walletIntelligence.ts:68](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L68)

##### generatedAt

> **generatedAt**: `string`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:91](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L91)

##### groups

> **groups**: [`IntelGroup`](#intelgroup)[]

Defined in: [server/\_lib/wallet/walletIntelligence.ts:69](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L69)

##### nodes

> **nodes**: [`IntelNode`](#intelnode)[]

Defined in: [server/\_lib/wallet/walletIntelligence.ts:67](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L67)

##### source

> **source**: `string`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:92](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L92)

##### sources

> **sources**: `object`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:71](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L71)

Raw source data for consumers that want structured access.

###### alfaclub

> **alfaclub**: [`AlfaClubHoldingsResult`](alfaclub.md#alfaclubholdingsresult) \| `null`

AlfaClub (FriendDotSpace) on-chain holdings for the target wallet.
null when disabled via options or when the RPC read failed.

###### basename

> **basename**: `string` \| `null`

###### ens

> **ens**: [`EnsProfile`](../identity/ensResolver.md#ensprofile) \| `null`

###### funderTrace

> **funderTrace**: [`FunderTraceResult`](../lens/funderTrace.md#fundertraceresult) \| `null`

###### labels

> **labels**: `Record`\<`string`, [`WalletLabelResult`](walletLabels.md#walletlabelresult)\>

###### lens

> **lens**: \{ `accountAddress`: `string`; `avatar`: `string` \| `null`; `displayName`: `string`; `handle`: `string` \| `null`; `ownerAddress`: `string` \| `null`; `username`: `string` \| `null`; \} \| `null`

###### portfolio

> **portfolio**: [`WalletPortfolio`](../lens/debankPortfolio.md#walletportfolio) \| `null`

##### target

> **target**: `string`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:65](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L65)

***

### WalletIntelligenceOptions

> **WalletIntelligenceOptions** = `object`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:99](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L99)

#### Properties

##### chainIds?

> `optional` **chainIds**: `number`[]

Defined in: [server/\_lib/wallet/walletIntelligence.ts:103](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L103)

Chain IDs for funder tracing (default [8453, 1]).

##### hops?

> `optional` **hops**: `number`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:101](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L101)

Number of funder hops to trace (default 3, max 5).

##### includeAlfaClub?

> `optional` **includeAlfaClub**: `boolean`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:113](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L113)

Whether to include AlfaClub on-chain holdings lookup (default true).

##### includeEns?

> `optional` **includeEns**: `boolean`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:107](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L107)

Whether to include ENS resolution (default true).

##### includeLabels?

> `optional` **includeLabels**: `boolean`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:111](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L111)

Whether to include entity labels (default true).

##### includeLens?

> `optional` **includeLens**: `boolean`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:109](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L109)

Whether to include Lens resolution (default true).

##### includePortfolio?

> `optional` **includePortfolio**: `boolean`

Defined in: [server/\_lib/wallet/walletIntelligence.ts:105](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L105)

Whether to include portfolio data (default true).

## Functions

### buildWalletIntelligence()

> **buildWalletIntelligence**(`address`, `options`): `Promise`\<[`WalletIntelligenceGraph`](#walletintelligencegraph)\>

Defined in: [server/\_lib/wallet/walletIntelligence.ts:120](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletIntelligence.ts#L120)

#### Parameters

##### address

`string`

##### options

[`WalletIntelligenceOptions`](#walletintelligenceoptions) = `{}`

#### Returns

`Promise`\<[`WalletIntelligenceGraph`](#walletintelligencegraph)\>
