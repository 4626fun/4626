[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/alfaclub/scorecard

# server/\_lib/alfaclub/scorecard

## Type Aliases

### PublishScorecardResult

> **PublishScorecardResult** = `object`

Defined in: [server/\_lib/alfaclub/scorecard.ts:85](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L85)

#### Properties

##### canonicalJson

> **canonicalJson**: `string`

Defined in: [server/\_lib/alfaclub/scorecard.ts:87](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L87)

##### hash

> **hash**: `` `0x${string}` ``

Defined in: [server/\_lib/alfaclub/scorecard.ts:88](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L88)

##### scorecard

> **scorecard**: [`Scorecard`](#scorecard-1)

Defined in: [server/\_lib/alfaclub/scorecard.ts:86](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L86)

##### upload

> **upload**: [`GroveUploadAttempt`](../lens/lensGrove.md#groveuploadattempt)

Defined in: [server/\_lib/alfaclub/scorecard.ts:89](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L89)

***

### Scorecard

> **Scorecard** = `object`

Defined in: [server/\_lib/alfaclub/scorecard.ts:42](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L42)

#### Properties

##### citations

> **citations**: `object`

Defined in: [server/\_lib/alfaclub/scorecard.ts:71](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L71)

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

Defined in: [server/\_lib/alfaclub/scorecard.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L52)

###### address

> **address**: `string`

###### tokenId

> **tokenId**: `string`

##### disclaimer

> **disclaimer**: `string`

Defined in: [server/\_lib/alfaclub/scorecard.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L46)

##### generatedAt

> **generatedAt**: `string`

Defined in: [server/\_lib/alfaclub/scorecard.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L44)

##### metrics

> **metrics**: `object`

Defined in: [server/\_lib/alfaclub/scorecard.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L56)

###### hyperliquid

> **hyperliquid**: \{ `accountValueUsd`: `number` \| `null`; `pnl30dUsd`: `number` \| `null`; \} \| `null`

###### stakedSupply

> **stakedSupply**: `string`

###### totalSupply

> **totalSupply**: `string`

##### publisher

> **publisher**: `object`

Defined in: [server/\_lib/alfaclub/scorecard.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L47)

###### agentId

> **agentId**: `number`

###### agentRegistry

> **agentRegistry**: `string`

###### canonicalCsw

> **canonicalCsw**: `string`

##### schema

> **schema**: *typeof* [`SCORECARD_SCHEMA`](#scorecard_schema)

Defined in: [server/\_lib/alfaclub/scorecard.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L43)

##### scores

> **scores**: `object`

Defined in: [server/\_lib/alfaclub/scorecard.ts:64](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L64)

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

Defined in: [server/\_lib/alfaclub/scorecard.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L45)

***

### ScorecardInput

> **ScorecardInput** = `object`

Defined in: [server/\_lib/alfaclub/scorecard.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L30)

#### Properties

##### creator

> **creator**: [`RankedCreator`](leaderboard.md#rankedcreator)

Defined in: [server/\_lib/alfaclub/scorecard.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L31)

##### snapshotTs

> **snapshotTs**: `string`

Defined in: [server/\_lib/alfaclub/scorecard.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L32)

##### sources

> **sources**: `object`

Defined in: [server/\_lib/alfaclub/scorecard.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L34)

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

Defined in: [server/\_lib/alfaclub/scorecard.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L33)

***

### ScorecardWithIntegrity

> **ScorecardWithIntegrity** = `object`

Defined in: [server/\_lib/alfaclub/scorecard.ts:79](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L79)

#### Properties

##### canonicalJson

> **canonicalJson**: `string`

Defined in: [server/\_lib/alfaclub/scorecard.ts:81](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L81)

##### hash

> **hash**: `` `0x${string}` ``

Defined in: [server/\_lib/alfaclub/scorecard.ts:82](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L82)

##### scorecard

> **scorecard**: [`Scorecard`](#scorecard-1)

Defined in: [server/\_lib/alfaclub/scorecard.ts:80](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L80)

## Variables

### SCORECARD\_DISCLAIMER

> `const` **SCORECARD\_DISCLAIMER**: `"4626 Keepr onchain-derived snapshot. Scores derive from public Base chain data (FriendKey total supply, FriendStake staked supply, Hyperliquid realized 30d PnL) and public Hyperliquid API responses. AlfaClub's in-app ranking is a separate proprietary calculation. Not financial advice."`

Defined in: [server/\_lib/alfaclub/scorecard.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L23)

***

### SCORECARD\_SCHEMA

> `const` **SCORECARD\_SCHEMA**: `"4626.alfaclub.scorecard.v1"`

Defined in: [server/\_lib/alfaclub/scorecard.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L21)

## Functions

### buildScorecard()

> **buildScorecard**(`input`): [`ScorecardWithIntegrity`](#scorecardwithintegrity)

Defined in: [server/\_lib/alfaclub/scorecard.ts:127](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L127)

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

Defined in: [server/\_lib/alfaclub/scorecard.ts:176](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L176)

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

Defined in: [server/\_lib/alfaclub/scorecard.ts:203](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/scorecard.ts#L203)

Upload a scorecard to Lens Grove. Never throws.

#### Parameters

##### input

[`ScorecardInput`](#scorecardinput)

#### Returns

`Promise`\<[`PublishScorecardResult`](#publishscorecardresult)\>
