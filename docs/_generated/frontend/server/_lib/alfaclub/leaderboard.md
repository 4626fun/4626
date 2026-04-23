[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/alfaclub/leaderboard

# server/\_lib/alfaclub/leaderboard

## Type Aliases

### CreatorMetricsInput

> **CreatorMetricsInput** = `object`

Defined in: [server/\_lib/alfaclub/leaderboard.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/leaderboard.ts#L41)

#### Properties

##### creatorAddress

> **creatorAddress**: `Address`

Defined in: [server/\_lib/alfaclub/leaderboard.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/leaderboard.ts#L43)

##### hyperliquid

> **hyperliquid**: \{ `accountValueUsd`: `number` \| `null`; `pnl30dUsd`: `number` \| `null`; \} \| `null`

Defined in: [server/\_lib/alfaclub/leaderboard.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/leaderboard.ts#L46)

##### stakedSupply

> **stakedSupply**: `bigint`

Defined in: [server/\_lib/alfaclub/leaderboard.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/leaderboard.ts#L45)

##### tokenId

> **tokenId**: `bigint`

Defined in: [server/\_lib/alfaclub/leaderboard.ts:42](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/leaderboard.ts#L42)

##### totalSupply

> **totalSupply**: `bigint`

Defined in: [server/\_lib/alfaclub/leaderboard.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/leaderboard.ts#L44)

***

### RankedCreator

> **RankedCreator** = `object`

Defined in: [server/\_lib/alfaclub/leaderboard.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/leaderboard.ts#L52)

#### Properties

##### compositeScore

> **compositeScore**: `number`

Defined in: [server/\_lib/alfaclub/leaderboard.ts:64](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/leaderboard.ts#L64)

##### creatorAddress

> **creatorAddress**: `Address`

Defined in: [server/\_lib/alfaclub/leaderboard.ts:55](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/leaderboard.ts#L55)

##### hyperliquid

> **hyperliquid**: \{ `accountValueUsd`: `number` \| `null`; `pnl30dUsd`: `number` \| `null`; \} \| `null`

Defined in: [server/\_lib/alfaclub/leaderboard.ts:58](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/leaderboard.ts#L58)

##### performanceScore

> **performanceScore**: `number`

Defined in: [server/\_lib/alfaclub/leaderboard.ts:63](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/leaderboard.ts#L63)

##### popularityScore

> **popularityScore**: `number`

Defined in: [server/\_lib/alfaclub/leaderboard.ts:62](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/leaderboard.ts#L62)

##### rank

> **rank**: `number`

Defined in: [server/\_lib/alfaclub/leaderboard.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/leaderboard.ts#L53)

##### stakedSupply

> **stakedSupply**: `bigint`

Defined in: [server/\_lib/alfaclub/leaderboard.ts:57](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/leaderboard.ts#L57)

##### tokenId

> **tokenId**: `bigint`

Defined in: [server/\_lib/alfaclub/leaderboard.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/leaderboard.ts#L54)

##### totalSupply

> **totalSupply**: `bigint`

Defined in: [server/\_lib/alfaclub/leaderboard.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/leaderboard.ts#L56)

## Variables

### LEADERBOARD\_CAPS

> `const` **LEADERBOARD\_CAPS**: `object`

Defined in: [server/\_lib/alfaclub/leaderboard.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/leaderboard.ts#L31)

Soft caps for normalization. These are log-scale caps — they control
how much a single huge room or a single huge PnL entry can dominate.
Chosen generously so the median room lands in the 0.2-0.5 range.

#### Type Declaration

##### pnlAbsCapUsd

> `readonly` **pnlAbsCapUsd**: `1000000` = `1_000_000`

##### stakeLog10Cap

> `readonly` **stakeLog10Cap**: `5` = `5`

##### supplyLog10Cap

> `readonly` **supplyLog10Cap**: `5` = `5`

***

### LEADERBOARD\_WEIGHTS

> `const` **LEADERBOARD\_WEIGHTS**: `object`

Defined in: [server/\_lib/alfaclub/leaderboard.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/leaderboard.ts#L21)

#### Type Declaration

##### performance

> `readonly` **performance**: `0.6` = `0.6`

##### popularity

> `readonly` **popularity**: `0.4` = `0.4`

## Functions

### compositeScore()

> **compositeScore**(`pop`, `perf`, `weights`): `number`

Defined in: [server/\_lib/alfaclub/leaderboard.ts:120](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/leaderboard.ts#L120)

Composite score in [-1, 1] (mostly 0..1 for most creators).
Exposed so the scorecard builder and tests stay in lockstep.

#### Parameters

##### pop

`number`

##### perf

`number`

##### weights

###### performance

`0.6` = `0.6`

###### popularity

`0.4` = `0.4`

#### Returns

`number`

***

### performanceScore()

> **performanceScore**(`pnl30dUsd`): `number`

Defined in: [server/\_lib/alfaclub/leaderboard.ts:110](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/leaderboard.ts#L110)

Performance score in [-1, 1] normalized against `pnlAbsCapUsd`.
Creators with `null` PnL (no Hyperliquid activity, or the endpoint
failed) receive 0 — neither rewarded nor punished.

#### Parameters

##### pnl30dUsd

`number` | `null`

#### Returns

`number`

***

### popularityScore()

> **popularityScore**(`totalSupply`, `stakedSupply`): `number`

Defined in: [server/\_lib/alfaclub/leaderboard.ts:94](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/leaderboard.ts#L94)

Popularity score in [0, 1]. Log-scales supply + stake so a room with
100 keys and a room with 10 keys don't get the same score, but a 100k
key room doesn't utterly dominate either.

supplyComponent = log10(1 + totalSupply)  / supplyLog10Cap
stakeComponent  = log10(1 + stakedSupply) / stakeLog10Cap
popularity      = 0.5 * supplyComponent + 0.5 * stakeComponent (clamped to [0,1])

#### Parameters

##### totalSupply

`bigint`

##### stakedSupply

`bigint`

#### Returns

`number`

***

### rankCreators()

> **rankCreators**(`metrics`): [`RankedCreator`](#rankedcreator)[]

Defined in: [server/\_lib/alfaclub/leaderboard.ts:140](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/leaderboard.ts#L140)

Rank a list of creators by compositeScore (desc). Ties broken by:
  1. higher totalSupply
  2. lower tokenId (earlier room)
  3. lexicographic creatorAddress

Deterministic — same input always produces same output.

#### Parameters

##### metrics

readonly [`CreatorMetricsInput`](#creatormetricsinput)[]

#### Returns

[`RankedCreator`](#rankedcreator)[]
