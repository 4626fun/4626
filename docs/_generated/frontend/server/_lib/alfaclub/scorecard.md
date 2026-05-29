[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/scorecard

# server/\_lib/alfaclub/scorecard

## Type Aliases

### PublishScorecardResult

> **PublishScorecardResult** = `object`

Defined in: [server/\_lib/alfaclub/scorecard.ts:86](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L86)

#### Properties

##### canonicalJson

> **canonicalJson**: `string`

Defined in: [server/\_lib/alfaclub/scorecard.ts:88](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L88)

##### hash

> **hash**: `` `0x${string}` ``

Defined in: [server/\_lib/alfaclub/scorecard.ts:89](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L89)

##### scorecard

> **scorecard**: [`Scorecard`](#scorecard-1)

Defined in: [server/\_lib/alfaclub/scorecard.ts:87](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L87)

##### upload

> **upload**: [`GroveUploadAttempt`](../lens/lensGrove.md#groveuploadattempt)

Defined in: [server/\_lib/alfaclub/scorecard.ts:90](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L90)

***

### Scorecard

> **Scorecard** = `object`

Defined in: [server/\_lib/alfaclub/scorecard.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L43)

#### Properties

##### citations

> **citations**: `object`

Defined in: [server/\_lib/alfaclub/scorecard.ts:72](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L72)

###### friendKeyContract

> **friendKeyContract**: `string`

###### friendPool

> **friendPool**: `string`

###### friendStakeBeacon

> **friendStakeBeacon**: `string`

###### hyperliquidInfoUrl

> **hyperliquidInfoUrl**: `string`

##### creator

> **creator**: `object`

Defined in: [server/\_lib/alfaclub/scorecard.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L53)

###### address

> **address**: `string`

###### tokenId

> **tokenId**: `string`

##### disclaimer

> **disclaimer**: `string`

Defined in: [server/\_lib/alfaclub/scorecard.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L47)

##### generatedAt

> **generatedAt**: `string`

Defined in: [server/\_lib/alfaclub/scorecard.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L45)

##### metrics

> **metrics**: `object`

Defined in: [server/\_lib/alfaclub/scorecard.ts:57](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L57)

###### hyperliquid

> **hyperliquid**: \{ `accountValueUsd`: `number` \| `null`; `pnl30dUsd`: `number` \| `null`; \} \| `null`

###### stakedSupply

> **stakedSupply**: `string`

###### totalSupply

> **totalSupply**: `string`

##### publisher

> **publisher**: `object`

Defined in: [server/\_lib/alfaclub/scorecard.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L48)

###### agentId

> **agentId**: `number`

###### agentRegistry

> **agentRegistry**: `string`

###### canonicalCsw

> **canonicalCsw**: `string`

##### schema

> **schema**: *typeof* [`SCORECARD_SCHEMA`](#scorecard_schema)

Defined in: [server/\_lib/alfaclub/scorecard.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L44)

##### scores

> **scores**: `object`

Defined in: [server/\_lib/alfaclub/scorecard.ts:65](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L65)

###### composite

> **composite**: `number`

###### performance

> **performance**: `number`

###### popularity

> **popularity**: `number`

###### rank

> **rank**: `number`

###### totalRanked

> **totalRanked**: `number`

##### snapshotTs

> **snapshotTs**: `string`

Defined in: [server/\_lib/alfaclub/scorecard.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L46)

***

### ScorecardInput

> **ScorecardInput** = `object`

Defined in: [server/\_lib/alfaclub/scorecard.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L31)

#### Properties

##### creator

> **creator**: [`RankedCreator`](leaderboard.md#rankedcreator)

Defined in: [server/\_lib/alfaclub/scorecard.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L32)

##### snapshotTs

> **snapshotTs**: `string`

Defined in: [server/\_lib/alfaclub/scorecard.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L33)

##### sources

> **sources**: `object`

Defined in: [server/\_lib/alfaclub/scorecard.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L35)

###### friendKeyContract

> **friendKeyContract**: `string`

###### friendPool

> **friendPool**: `string`

###### friendStakeBeacon

> **friendStakeBeacon**: `string`

###### hyperliquidInfoUrl

> **hyperliquidInfoUrl**: `string`

##### totalCreatorsRanked

> **totalCreatorsRanked**: `number`

Defined in: [server/\_lib/alfaclub/scorecard.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L34)

***

### ScorecardWithIntegrity

> **ScorecardWithIntegrity** = `object`

Defined in: [server/\_lib/alfaclub/scorecard.ts:80](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L80)

#### Properties

##### canonicalJson

> **canonicalJson**: `string`

Defined in: [server/\_lib/alfaclub/scorecard.ts:82](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L82)

##### hash

> **hash**: `` `0x${string}` ``

Defined in: [server/\_lib/alfaclub/scorecard.ts:83](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L83)

##### scorecard

> **scorecard**: [`Scorecard`](#scorecard-1)

Defined in: [server/\_lib/alfaclub/scorecard.ts:81](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L81)

## Variables

### SCORECARD\_DISCLAIMER

> `const` **SCORECARD\_DISCLAIMER**: `"4626 Keepr onchain-derived snapshot. Scores derive from public Base chain data (FriendKey total supply, FriendStake staked supply, Hyperliquid realized 30d PnL) and public Hyperliquid API responses. AlfaClub's in-app ranking is a separate proprietary calculation. Not financial advice."`

Defined in: [server/\_lib/alfaclub/scorecard.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L24)

***

### SCORECARD\_SCHEMA

> `const` **SCORECARD\_SCHEMA**: `"4626.alfaclub.scorecard.v1"`

Defined in: [server/\_lib/alfaclub/scorecard.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L22)

## Functions

### buildScorecard()

> **buildScorecard**(`input`): [`ScorecardWithIntegrity`](#scorecardwithintegrity)

Defined in: [server/\_lib/alfaclub/scorecard.ts:128](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L128)

Build a canonical scorecard. Pure — no network, no DB, no time lookups
beyond the `generatedAt` stamp.

#### Parameters

##### input

[`ScorecardInput`](#scorecardinput)

#### Returns

[`ScorecardWithIntegrity`](#scorecardwithintegrity)

***

### formatScorecardPostBody()

> **formatScorecardPostBody**(`scorecard`, `scorecardUri`): `string`

Defined in: [server/\_lib/alfaclub/scorecard.ts:177](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L177)

Derive the exact Lens post body text from a scorecard. Factual only.

#### Parameters

##### scorecard

[`Scorecard`](#scorecard-1)

##### scorecardUri

`string`

#### Returns

`string`

***

### publishScorecard()

> **publishScorecard**(`input`): `Promise`\<[`PublishScorecardResult`](#publishscorecardresult)\>

Defined in: [server/\_lib/alfaclub/scorecard.ts:204](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L204)

Upload a scorecard to Lens Grove. Never throws.

#### Parameters

##### input

[`ScorecardInput`](#scorecardinput)

#### Returns

`Promise`\<[`PublishScorecardResult`](#publishscorecardresult)\>
