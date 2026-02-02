[**creatorvault-miniapp**](../../index.md)

***

[creatorvault-miniapp](../../index.md) / src/lib/reputation-aggregator

# src/lib/reputation-aggregator

## Interfaces

### OnchainReputation

Defined in: [lib/reputation-aggregator.ts:13](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/reputation-aggregator.ts#L13)

#### Properties

##### address

> **address**: `string`

Defined in: [lib/reputation-aggregator.ts:15](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/reputation-aggregator.ts#L15)

##### aggregated

> **aggregated**: `object`

Defined in: [lib/reputation-aggregator.ts:43](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/reputation-aggregator.ts#L43)

###### badges

> **badges**: `string`[]

###### reputationLevel

> **reputationLevel**: `"Legendary"` \| `"Elite"` \| `"Established"` \| `"Rising"` \| `"New"`

###### socialReach

> **socialReach**: `number`

###### totalScore

> **totalScore**: `number`

###### trustScore

> **trustScore**: `number`

##### basename

> **basename**: [`BasenameInfo`](basename-api.md#basenameinfo)

Defined in: [lib/reputation-aggregator.ts:16](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/reputation-aggregator.ts#L16)

##### debank

> **debank**: `object`

Defined in: [lib/reputation-aggregator.ts:17](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/reputation-aggregator.ts#L17)

###### asOf?

> `optional` **asOf**: `number`

###### totalBalance

> **totalBalance**: [`DebankTotalBalance`](debank/client.md#debanktotalbalance) \| `null`

##### guild

> **guild**: [`BaseGuildStats`](guild-api.md#baseguildstats)

Defined in: [lib/reputation-aggregator.ts:30](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/reputation-aggregator.ts#L30)

##### profiles

> **profiles**: `object`

Defined in: [lib/reputation-aggregator.ts:33](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/reputation-aggregator.ts#L33)

###### farcaster?

> `optional` **farcaster**: `string`

###### github?

> `optional` **github**: `string`

###### lens?

> `optional` **lens**: `string`

###### twitter?

> `optional` **twitter**: `string`

###### website?

> `optional` **website**: `string`

###### zora

> **zora**: [`ZoraCreator`](zora-api.md#zoracreator) \| `null`

##### talent

> **talent**: `object`

Defined in: [lib/reputation-aggregator.ts:23](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/reputation-aggregator.ts#L23)

###### builderRank?

> `optional` **builderRank**: `number`

###### passport

> **passport**: [`TalentPassport`](talent-api.md#talentpassport) \| `null`

###### score

> **score**: `number`

###### verified

> **verified**: `boolean`

## Functions

### formatReputation()

> **formatReputation**(`reputation`): `object`

Defined in: [lib/reputation-aggregator.ts:336](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/reputation-aggregator.ts#L336)

Format reputation for display

#### Parameters

##### reputation

[`OnchainReputation`](#onchainreputation)

#### Returns

`object`

##### badges

> **badges**: `string`

##### level

> **level**: `"Legendary"` \| `"Elite"` \| `"Established"` \| `"Rising"` \| `"New"` = `reputation.aggregated.reputationLevel`

##### reach

> **reach**: `string`

##### score

> **score**: `string`

##### trust

> **trust**: `string`

***

### getOnchainReputation()

> **getOnchainReputation**(`address`): `Promise`\<[`OnchainReputation`](#onchainreputation)\>

Defined in: [lib/reputation-aggregator.ts:245](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/reputation-aggregator.ts#L245)

Fetch comprehensive on-chain reputation for an address

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`OnchainReputation`](#onchainreputation)\>
