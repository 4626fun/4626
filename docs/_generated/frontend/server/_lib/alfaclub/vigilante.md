[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/alfaclub/vigilante

# server/\_lib/alfaclub/vigilante

## Type Aliases

### VigilanteFlags

> **VigilanteFlags** = `object`

Defined in: [server/\_lib/alfaclub/vigilante.ts:82](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L82)

#### Properties

##### cooldownHours

> **cooldownHours**: `number`

Defined in: [server/\_lib/alfaclub/vigilante.ts:88](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L88)

##### feedbackEnabled

> **feedbackEnabled**: `boolean`

Defined in: [server/\_lib/alfaclub/vigilante.ts:86](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L86)

##### killSwitch

> **killSwitch**: `boolean`

Defined in: [server/\_lib/alfaclub/vigilante.ts:83](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L83)

##### postEnabled

> **postEnabled**: `boolean`

Defined in: [server/\_lib/alfaclub/vigilante.ts:85](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L85)

##### readEnabled

> **readEnabled**: `boolean`

Defined in: [server/\_lib/alfaclub/vigilante.ts:84](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L84)

##### topN

> **topN**: `number`

Defined in: [server/\_lib/alfaclub/vigilante.ts:87](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L87)

***

### VigilantePublicationKind

> **VigilantePublicationKind** = [`PublicationKind`](publicationLedger.md#publicationkind)

Defined in: [server/\_lib/alfaclub/vigilante.ts:663](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L663)

Narrow type helper so callers can opaque-pass a kind without importing the ledger.

***

### VigilantePublishResult

> **VigilantePublishResult** = `object`

Defined in: [server/\_lib/alfaclub/vigilante.ts:469](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L469)

#### Properties

##### creatorAddress

> **creatorAddress**: `string`

Defined in: [server/\_lib/alfaclub/vigilante.ts:470](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L470)

##### erc8004

> **erc8004**: `PublishOutcome` \| `null`

Defined in: [server/\_lib/alfaclub/vigilante.ts:473](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L473)

##### lens

> **lens**: `PublishOutcome` \| `null`

Defined in: [server/\_lib/alfaclub/vigilante.ts:472](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L472)

##### rank

> **rank**: `number`

Defined in: [server/\_lib/alfaclub/vigilante.ts:471](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L471)

***

### VigilanteRunOptions

> **VigilanteRunOptions** = `object`

Defined in: [server/\_lib/alfaclub/vigilante.ts:450](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L450)

#### Properties

##### client?

> `optional` **client**: [`AlfaClubPublicClientLike`](../wallet/alfaclub.md#alfaclubpublicclientlike)

Defined in: [server/\_lib/alfaclub/vigilante.ts:452](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L452)

##### flags?

> `optional` **flags**: [`VigilanteFlags`](#vigilanteflags)

Defined in: [server/\_lib/alfaclub/vigilante.ts:451](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L451)

##### getHyperliquid()?

> `optional` **getHyperliquid**: (`address`) => `Promise`\<[`HyperliquidSnapshot`](hyperliquid.md#hyperliquidsnapshot)\>

Defined in: [server/\_lib/alfaclub/vigilante.ts:456](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L456)

Override metrics capture (for tests).

###### Parameters

###### address

`string`

###### Returns

`Promise`\<[`HyperliquidSnapshot`](hyperliquid.md#hyperliquidsnapshot)\>

##### listCreators()?

> `optional` **listCreators**: () => `Promise`\<[`AlfaClubCreator`](creators.md#alfaclubcreator)[]\>

Defined in: [server/\_lib/alfaclub/vigilante.ts:454](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L454)

Override creator enumeration (for tests / dry-runs).

###### Returns

`Promise`\<[`AlfaClubCreator`](creators.md#alfaclubcreator)[]\>

##### now?

> `optional` **now**: `Date`

Defined in: [server/\_lib/alfaclub/vigilante.ts:462](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L462)

Override the current time (tests).

##### postToLens()?

> `optional` **postToLens**: (`body`, `scorecardUri`) => `Promise`\<`string` \| `null`\>

Defined in: [server/\_lib/alfaclub/vigilante.ts:458](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L458)

Optional Lens post publisher — if unset, Lens posts skip the post step but still record the scorecard.

###### Parameters

###### body

`string`

###### scorecardUri

`string` | `null`

###### Returns

`Promise`\<`string` \| `null`\>

##### signer?

> `optional` **signer**: `Erc8004Signer` \| `null`

Defined in: [server/\_lib/alfaclub/vigilante.ts:460](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L460)

Provide an explicit signer (tests) — otherwise derived from env private keys.

##### skipHyperliquid?

> `optional` **skipHyperliquid**: `boolean`

Defined in: [server/\_lib/alfaclub/vigilante.ts:466](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L466)

Skip Hyperliquid reads (tests or early rollouts).

##### skipIndexer?

> `optional` **skipIndexer**: `boolean`

Defined in: [server/\_lib/alfaclub/vigilante.ts:464](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L464)

Skip the indexer step (tests that seed creators directly).

***

### VigilanteRunResult

> **VigilanteRunResult** = `object`

Defined in: [server/\_lib/alfaclub/vigilante.ts:476](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L476)

#### Properties

##### durationMs

> **durationMs**: `number`

Defined in: [server/\_lib/alfaclub/vigilante.ts:487](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L487)

##### flags

> **flags**: [`VigilanteFlags`](#vigilanteflags)

Defined in: [server/\_lib/alfaclub/vigilante.ts:479](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L479)

##### indexedNewCreators

> **indexedNewCreators**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/vigilante.ts:482](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L482)

##### ok

> **ok**: `boolean`

Defined in: [server/\_lib/alfaclub/vigilante.ts:477](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L477)

##### publications

> **publications**: [`VigilantePublishResult`](#vigilantepublishresult)[]

Defined in: [server/\_lib/alfaclub/vigilante.ts:485](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L485)

##### rankedCreators

> **rankedCreators**: `number`

Defined in: [server/\_lib/alfaclub/vigilante.ts:483](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L483)

##### reason?

> `optional` **reason**: `string`

Defined in: [server/\_lib/alfaclub/vigilante.ts:478](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L478)

##### signerAddress

> **signerAddress**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/vigilante.ts:486](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L486)

##### snapshotTs

> **snapshotTs**: `string`

Defined in: [server/\_lib/alfaclub/vigilante.ts:480](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L480)

##### topN

> **topN**: `number`

Defined in: [server/\_lib/alfaclub/vigilante.ts:484](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L484)

##### windowStart

> **windowStart**: `string`

Defined in: [server/\_lib/alfaclub/vigilante.ts:481](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L481)

## Variables

### VIGILANTE\_SCORECARD\_SCHEMA

> `const` **VIGILANTE\_SCORECARD\_SCHEMA**: `"4626.alfaclub.scorecard.v1"` = `SCORECARD_SCHEMA`

Defined in: [server/\_lib/alfaclub/vigilante.ts:645](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L645)

## Functions

### buildEoaSigner()

> **buildEoaSigner**(): `Promise`\<`Erc8004Signer` \| `null`\>

Defined in: [server/\_lib/alfaclub/vigilante.ts:295](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L295)

Lazily construct a viem wallet-client EOA signer. Returns null when no
private key is configured, in which case the orchestrator queues the
prepared calldata instead of submitting. No key => no autonomous write.

#### Returns

`Promise`\<`Erc8004Signer` \| `null`\>

***

### buildRevokeFeedbackCalldata()

> **buildRevokeFeedbackCalldata**(`params`): `object`

Defined in: [server/\_lib/alfaclub/vigilante.ts:629](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L629)

Build the calldata for `revokeFeedback(agentId, feedbackIndex)`. The caller
supplies the signer — we intentionally do NOT auto-revoke. The admin
dashboard submits this through the existing manual-submit flow.

#### Parameters

##### params

###### agentId

`number`

###### feedbackIndex

`number`

#### Returns

`object`

##### data

> **data**: `` `0x${string}` ``

##### to

> **to**: `` `0x${string}` ``

***

### captureMetricsForCreators()

> **captureMetricsForCreators**(`creators`, `client`, `opts`): `Promise`\<[`CreatorMetricsInput`](leaderboard.md#creatormetricsinput)[]\>

Defined in: [server/\_lib/alfaclub/vigilante.ts:160](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L160)

#### Parameters

##### creators

readonly [`AlfaClubCreator`](creators.md#alfaclubcreator)[]

##### client

[`AlfaClubPublicClientLike`](../wallet/alfaclub.md#alfaclubpublicclientlike)

##### opts

###### getHyperliquid?

(`address`) => `Promise`\<[`HyperliquidSnapshot`](hyperliquid.md#hyperliquidsnapshot)\>

###### skipHyperliquid?

`boolean`

#### Returns

`Promise`\<[`CreatorMetricsInput`](leaderboard.md#creatormetricsinput)[]\>

***

### publishErc8004Feedback()

> **publishErc8004Feedback**(`params`): `Promise`\<`PublishOutcome`\>

Defined in: [server/\_lib/alfaclub/vigilante.ts:326](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L326)

#### Parameters

##### params

###### creator

[`RankedCreator`](leaderboard.md#rankedcreator)

###### signer

`Erc8004Signer` \| `null`

###### snapshotTs

`string`

###### totalCreatorsRanked

`number`

###### windowStart

`string`

#### Returns

`Promise`\<`PublishOutcome`\>

***

### publishLensScorecard()

> **publishLensScorecard**(`params`): `Promise`\<`PublishOutcome`\>

Defined in: [server/\_lib/alfaclub/vigilante.ts:206](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L206)

#### Parameters

##### params

###### creator

[`RankedCreator`](leaderboard.md#rankedcreator)

###### postFn?

(`body`, `scorecardUri`) => `Promise`\<`string` \| `null`\>

###### snapshotTs

`string`

###### totalCreatorsRanked

`number`

###### windowStart

`string`

#### Returns

`Promise`\<`PublishOutcome`\>

***

### readVigilanteFlags()

> **readVigilanteFlags**(): [`VigilanteFlags`](#vigilanteflags)

Defined in: [server/\_lib/alfaclub/vigilante.ts:107](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L107)

#### Returns

[`VigilanteFlags`](#vigilanteflags)

***

### resolveSignerPrivateKey()

> **resolveSignerPrivateKey**(): `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/alfaclub/vigilante.ts:282](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L282)

#### Returns

`` `0x${string}` `` \| `null`

***

### runVigilante()

> **runVigilante**(`opts`): `Promise`\<[`VigilanteRunResult`](#vigilanterunresult)\>

Defined in: [server/\_lib/alfaclub/vigilante.ts:490](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L490)

#### Parameters

##### opts

[`VigilanteRunOptions`](#vigilanterunoptions) = `{}`

#### Returns

`Promise`\<[`VigilanteRunResult`](#vigilanterunresult)\>

***

### stableDigest()

> **stableDigest**(`input`): `string`

Defined in: [server/\_lib/alfaclub/vigilante.ts:655](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/vigilante.ts#L655)

#### Parameters

##### input

`string`

#### Returns

`string`

## References

### attachErc8004TxHash

Re-exports [attachErc8004TxHash](publicationLedger.md#attacherc8004txhash)
