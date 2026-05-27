[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lottery/amoeBurnRefund

# server/\_lib/lottery/amoeBurnRefund

## Interfaces

### OrphanBurnCandidate

Defined in: [server/\_lib/lottery/amoeBurnRefund.ts:106](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeBurnRefund.ts#L106)

One orphan-burn candidate identified by [findOrphanBurns](#findorphanburns).
`pointsId` is the L0 `points.id` for diagnostic logging only — the
refund INSERT keys off `(signup_id, source_id, amount)` to remain
stable across schema changes.

#### Properties

##### burnedAt

> **burnedAt**: `string`

Defined in: [server/\_lib/lottery/amoeBurnRefund.ts:111](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeBurnRefund.ts#L111)

##### pointsBurned

> **pointsBurned**: `number`

Defined in: [server/\_lib/lottery/amoeBurnRefund.ts:110](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeBurnRefund.ts#L110)

##### pointsId

> **pointsId**: `bigint`

Defined in: [server/\_lib/lottery/amoeBurnRefund.ts:107](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeBurnRefund.ts#L107)

##### signupId

> **signupId**: `bigint`

Defined in: [server/\_lib/lottery/amoeBurnRefund.ts:108](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeBurnRefund.ts#L108)

##### spendRefId

> **spendRefId**: `string`

Defined in: [server/\_lib/lottery/amoeBurnRefund.ts:109](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeBurnRefund.ts#L109)

***

### RefundInsertOutcome

Defined in: [server/\_lib/lottery/amoeBurnRefund.ts:119](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeBurnRefund.ts#L119)

Outcome of [refundOrphanBurn](#refundorphanburn). `inserted=false` indicates the
refund row already existed (idempotent re-run). `inserted=true` is
a fresh refund.

#### Properties

##### inserted

> **inserted**: `boolean`

Defined in: [server/\_lib/lottery/amoeBurnRefund.ts:120](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeBurnRefund.ts#L120)

***

### RefundTickResult

Defined in: [server/\_lib/lottery/amoeBurnRefund.ts:382](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeBurnRefund.ts#L382)

Aggregate per-tick result. `scannedCount` is the number of orphan
candidates returned by [findOrphanBurns](#findorphanburns); `refundedCount` is
the number of those that produced a fresh INSERT (skipping any
idempotent-no-op rows). Any per-row error is captured in `errors`
— we keep going so a single bad row doesn't stall the queue.

#### Properties

##### errors

> **errors**: `object`[]

Defined in: [server/\_lib/lottery/amoeBurnRefund.ts:385](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeBurnRefund.ts#L385)

###### message

> **message**: `string`

###### pointsId

> **pointsId**: `string`

##### refundedCount

> **refundedCount**: `number`

Defined in: [server/\_lib/lottery/amoeBurnRefund.ts:384](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeBurnRefund.ts#L384)

##### scannedCount

> **scannedCount**: `number`

Defined in: [server/\_lib/lottery/amoeBurnRefund.ts:383](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeBurnRefund.ts#L383)

## Type Aliases

### AmoeBurnRefundDb

> **AmoeBurnRefundDb** = `object`

Defined in: [server/\_lib/lottery/amoeBurnRefund.ts:93](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeBurnRefund.ts#L93)

Db pool shape this module needs (matches `AmoePublisherDb`).

#### Properties

##### sql()

> **sql**: (`strings`, ...`values`) => `Promise`\<\{ `rows`: `unknown`[]; \}\>

Defined in: [server/\_lib/lottery/amoeBurnRefund.ts:94](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeBurnRefund.ts#L94)

###### Parameters

###### strings

`TemplateStringsArray`

###### values

...`unknown`[]

###### Returns

`Promise`\<\{ `rows`: `unknown`[]; \}\>

## Variables

### DEFAULT\_MAX\_REFUNDS\_PER\_TICK

> `const` **DEFAULT\_MAX\_REFUNDS\_PER\_TICK**: `50` = `50`

Defined in: [server/\_lib/lottery/amoeBurnRefund.ts:86](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeBurnRefund.ts#L86)

Default cap on refund rows emitted per cron tick. Keeps a single
tick bounded so a backlog drains across multiple ticks rather than
holding the function open for minutes.

***

### DEFAULT\_REFUND\_AGE\_EPOCHS

> `const` **DEFAULT\_REFUND\_AGE\_EPOCHS**: `7` = `7`

Defined in: [server/\_lib/lottery/amoeBurnRefund.ts:79](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeBurnRefund.ts#L79)

Default TTL before an unclaimed burn becomes refundable. Design
§5.1 calls for 7 epochs (~7 days).

## Functions

### findOrphanBurns()

> **findOrphanBurns**(`db`, `args`): `Promise`\<[`OrphanBurnCandidate`](#orphanburncandidate)[]\>

Defined in: [server/\_lib/lottery/amoeBurnRefund.ts:256](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeBurnRefund.ts#L256)

Find AMOE phase-A debit rows in `points` that:
  1. are older than `ageSec` seconds (`created_at` < NOW() - ageSec),
  2. have NO `amoe_zk_submissions` row in state `settled` for the
     same `(signup_id, spend_ref_id)` (phase B never landed),
  3. have NO existing `amoe_entry_refund` row keyed by the same
     `source_id` (refund hasn't run yet),
  4. HAVE a matching `amoe_burn_credits_intents` row written by the
     `POST /api/v1/lottery/amoe/burn-credits` handler.

Predicate (4) is the phase-A scope guard. Without it, legacy debits
from the older `POST /api/v1/lottery/amoe/submit` endpoint — which
also writes `source='amoe_entry_spend'` rows via
`consumeAmoeCreditsForEntry` but never writes `amoe_zk_submissions`
— would be misclassified as orphans and incorrectly refunded after
`REFUND_AGE_EPOCHS`, effectively granting free / duplicated AMOE
credits when `AMOE_REFUND_CRON_ENABLED=1` is turned on. The intents
table is the explicit forward marker that scopes the cron to phase-A
burns only. See docs/security/amoe-burn-then-submit-design.md §5.1.

Returns at most `limit` candidates, oldest-first, so a backlog
drains deterministically across ticks.

#### Parameters

##### db

[`AmoeBurnRefundDb`](#amoeburnrefunddb)

##### args

###### ageSec

`number`

###### limit

`number`

#### Returns

`Promise`\<[`OrphanBurnCandidate`](#orphanburncandidate)[]\>

***

### isAmoeBurnRefundCronEnabled()

> **isAmoeBurnRefundCronEnabled**(): `boolean`

Defined in: [server/\_lib/lottery/amoeBurnRefund.ts:134](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeBurnRefund.ts#L134)

Top-level enable for the refund cron. Distinct from
`AMOE_ZK_SUBMIT_ENABLED` (the feature) and
`AMOE_LEDGER_PUBLISHER_ENABLED` (the publisher cron) so ops can
pause refunds independently — e.g. while debugging an unexpected
orphan-burn rate.

#### Returns

`boolean`

***

### readMaxRefundsPerTick()

> **readMaxRefundsPerTick**(): `number`

Defined in: [server/\_lib/lottery/amoeBurnRefund.ts:157](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeBurnRefund.ts#L157)

Per-tick cap on refunds. Operators can raise/lower via
`AMOE_REFUND_MAX_PER_TICK`.

#### Returns

`number`

***

### readRefundAgeSec()

> **readRefundAgeSec**(): `number`

Defined in: [server/\_lib/lottery/amoeBurnRefund.ts:143](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeBurnRefund.ts#L143)

Refund-age TTL, in seconds. Operators can override via
`AMOE_REFUND_AGE_EPOCHS` (integer epochs ≥ 1). Out-of-range or
non-numeric values fall back to [DEFAULT\_REFUND\_AGE\_EPOCHS](#default_refund_age_epochs).

#### Returns

`number`

***

### refundOrphanBurn()

> **refundOrphanBurn**(`db`, `args`): `Promise`\<[`RefundInsertOutcome`](#refundinsertoutcome)\>

Defined in: [server/\_lib/lottery/amoeBurnRefund.ts:345](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeBurnRefund.ts#L345)

Insert a compensating `amoe_entry_refund` row for a single orphan
burn. Idempotent: relies on the existing
`points_unique_source_full` UNIQUE index on
`(signup_id, source, source_id)` — a second call with the same
`(signupId, spendRefId)` is a no-op (`inserted=false`).

The refund amount is positive and equals the magnitude of the
original debit. The view `points_amoe_eligible_balance` (post-
migration 035) maps `amoe_entry_refund` 1:1 into the eligible-
balance sum, so the user's AMOE-balance is fully restored on the
next phase-A attempt.

#### Parameters

##### db

[`AmoeBurnRefundDb`](#amoeburnrefunddb)

##### args

###### pointsBurned

`number`

###### signupId

`bigint`

###### spendRefId

`string`

#### Returns

`Promise`\<[`RefundInsertOutcome`](#refundinsertoutcome)\>

***

### requireBurnRefundDb()

> **requireBurnRefundDb**(): `Promise`\<[`AmoeBurnRefundDb`](#amoeburnrefunddb)\>

Defined in: [server/\_lib/lottery/amoeBurnRefund.ts:170](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeBurnRefund.ts#L170)

#### Returns

`Promise`\<[`AmoeBurnRefundDb`](#amoeburnrefunddb)\>

***

### runBurnRefundTick()

> **runBurnRefundTick**(`db`, `args`): `Promise`\<[`RefundTickResult`](#refundtickresult)\>

Defined in: [server/\_lib/lottery/amoeBurnRefund.ts:388](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeBurnRefund.ts#L388)

#### Parameters

##### db

[`AmoeBurnRefundDb`](#amoeburnrefunddb)

##### args

###### ageSec?

`number`

###### limit?

`number`

#### Returns

`Promise`\<[`RefundTickResult`](#refundtickresult)\>
