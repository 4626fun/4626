[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/publicationLedger

# server/\_lib/alfaclub/publicationLedger

## Type Aliases

### MetricsSnapshotRow

> **MetricsSnapshotRow** = `object`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:385](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L385)

#### Properties

##### creatorAddress

> **creatorAddress**: `Address`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:387](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L387)

##### hlAccountValueUsd

> **hlAccountValueUsd**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:392](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L392)

##### pnl30dUsd

> **pnl30dUsd**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:391](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L391)

##### rank

> **rank**: `number`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:394](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L394)

##### score

> **score**: `number`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:393](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L393)

##### snapshotTs

> **snapshotTs**: `string`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:386](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L386)

##### stakedSupply

> **stakedSupply**: `bigint`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:390](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L390)

##### tokenId

> **tokenId**: `bigint`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:388](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L388)

##### totalSupply

> **totalSupply**: `bigint`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:389](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L389)

***

### NewPublicationInput

> **NewPublicationInput** = `Omit`\<[`PublicationRecord`](#publicationrecord), `"createdAt"` \| `"submissionAttempts"` \| `"lastSubmissionError"` \| `"lastSubmissionAt"`\> & `object`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L47)

#### Type Declaration

##### lastSubmissionAt?

> `optional` **lastSubmissionAt**: `string` \| `null`

##### lastSubmissionError?

> `optional` **lastSubmissionError**: `string` \| `null`

##### submissionAttempts?

> `optional` **submissionAttempts**: `number`

***

### PublicationKind

> **PublicationKind** = `"lens"` \| `"erc8004-submitted"` \| `"erc8004-queued"` \| `"erc8004-failed"`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L22)

***

### PublicationRecord

> **PublicationRecord** = `object`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L28)

#### Properties

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L41)

##### creatorAddress

> **creatorAddress**: `Address`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L31)

##### erc8004Calldata

> **erc8004Calldata**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L38)

##### erc8004TxHash

> **erc8004TxHash**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L37)

##### kind

> **kind**: [`PublicationKind`](#publicationkind)

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L30)

##### lastSubmissionAt

> **lastSubmissionAt**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L44)

##### lastSubmissionError

> **lastSubmissionError**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L43)

##### lensPostId

> **lensPostId**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L36)

##### publicationKey

> **publicationKey**: `string`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L29)

##### rank

> **rank**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L40)

##### score

> **score**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L39)

##### scorecardCid

> **scorecardCid**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L33)

##### scorecardHash

> **scorecardHash**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L35)

##### scorecardUri

> **scorecardUri**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L34)

##### submissionAttempts

> **submissionAttempts**: `number`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:42](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L42)

##### tokenId

> **tokenId**: `bigint` \| `null`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L32)

## Functions

### abandonQueuedFeedback()

> **abandonQueuedFeedback**(`publicationKey`, `finalError`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:359](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L359)

Permanently abandon a queued row. Flips `kind` to `'erc8004-failed'` so
subsequent drain ticks skip it.

#### Parameters

##### publicationKey

`string`

##### finalError

`string`

#### Returns

`Promise`\<`boolean`\>

***

### attachErc8004TxHash()

> **attachErc8004TxHash**(`publicationKey`, `txHash`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:270](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L270)

Attach an onchain tx hash to a previously-queued ERC-8004 row.

#### Parameters

##### publicationKey

`string`

##### txHash

`string`

#### Returns

`Promise`\<`boolean`\>

***

### bucketWindowStart()

> **bucketWindowStart**(`now`, `cooldownHours`): `string`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:83](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L83)

Bucket a timestamp to the start of the cooldown window so every run
inside the same window resolves to the same key.

Default window is 24 hours; override via ALFACLUB_VIGILANTE_POST_COOLDOWN_HOURS.

#### Parameters

##### now

`Date`

##### cooldownHours

`number`

#### Returns

`string`

***

### getLatestSnapshotTs()

> **getLatestSnapshotTs**(): `Promise`\<`string` \| `null`\>

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:431](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L431)

#### Returns

`Promise`\<`string` \| `null`\>

***

### getSnapshotAt()

> **getSnapshotAt**(`snapshotTs`): `Promise`\<[`MetricsSnapshotRow`](#metricssnapshotrow)[]\>

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:446](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L446)

#### Parameters

##### snapshotTs

`string`

#### Returns

`Promise`\<[`MetricsSnapshotRow`](#metricssnapshotrow)[]\>

***

### hasPublication()

> **hasPublication**(`publicationKey`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:99](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L99)

#### Parameters

##### publicationKey

`string`

#### Returns

`Promise`\<`boolean`\>

***

### insertMetricsSnapshot()

> **insertMetricsSnapshot**(`rows`): `Promise`\<`number`\>

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:397](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L397)

#### Parameters

##### rows

readonly [`MetricsSnapshotRow`](#metricssnapshotrow)[]

#### Returns

`Promise`\<`number`\>

***

### listQueuedFeedback()

> **listQueuedFeedback**(`limit`): `Promise`\<[`PublicationRecord`](#publicationrecord)[]\>

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:301](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L301)

List ERC-8004 rows queued for autonomous submission. FIFO, excludes rows
that have already been submitted, abandoned, or that failed a selector
validation permanently. Callers should re-derive the target registry
address themselves and validate the stored calldata before submitting.

#### Parameters

##### limit

`number`

#### Returns

`Promise`\<[`PublicationRecord`](#publicationrecord)[]\>

***

### listRecentPublications()

> **listRecentPublications**(`kind`, `limit`): `Promise`\<[`PublicationRecord`](#publicationrecord)[]\>

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:188](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L188)

#### Parameters

##### kind

[`PublicationKind`](#publicationkind) | `null`

##### limit

`number` = `50`

#### Returns

`Promise`\<[`PublicationRecord`](#publicationrecord)[]\>

***

### makePublicationKey()

> **makePublicationKey**(`params`): `string`

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:64](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L64)

Stable publication key. Same `(creator, windowStart, kind)` → same key,
so re-running the cron within the same window is idempotent.

#### Parameters

##### params

###### creatorAddress

`string`

###### kind

[`PublicationKind`](#publicationkind)

###### windowStart

`string`

#### Returns

`string`

***

### markSubmissionAttemptFailed()

> **markSubmissionAttemptFailed**(`publicationKey`, `err`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:334](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L334)

Record a failed submission attempt without advancing the row past
`erc8004-queued`. The drain loop uses `submission_attempts` to decide
when to abandon.

#### Parameters

##### publicationKey

`string`

##### err

`string`

#### Returns

`Promise`\<`boolean`\>

***

### recentPublicationsForCreator()

> **recentPublicationsForCreator**(`creatorAddress`, `kind`, `limit`): `Promise`\<[`PublicationRecord`](#publicationrecord)[]\>

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:160](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L160)

#### Parameters

##### creatorAddress

`string`

##### kind

[`PublicationKind`](#publicationkind)

##### limit

`number` = `10`

#### Returns

`Promise`\<[`PublicationRecord`](#publicationrecord)[]\>

***

### recordPublication()

> **recordPublication**(`input`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/alfaclub/publicationLedger.ts:236](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/publicationLedger.ts#L236)

Insert a publication row. If the publication_key already exists, the
insert is skipped (primary-key conflict) and this function returns false.

#### Parameters

##### input

[`NewPublicationInput`](#newpublicationinput)

#### Returns

`Promise`\<`boolean`\>
