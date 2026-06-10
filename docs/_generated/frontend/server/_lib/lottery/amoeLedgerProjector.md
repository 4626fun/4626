[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lottery/amoeLedgerProjector

# server/\_lib/lottery/amoeLedgerProjector

## Interfaces

### AmoeBurnContext

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:117](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L117)

#### Properties

##### twitterCreditNullifierHex

> **twitterCreditNullifierHex**: `string`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:121](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L121)

twitterCreditNullifier as 0x-hex (32 bytes).

##### walletAddress

> **walletAddress**: `string`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:119](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L119)

EVM wallet address as hex (with or without 0x).

***

### AmoeBurnContextLookupArgs

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:108](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L108)

Row shape returned by reading a candidate burn from L0.

Note: `wallet_address` and `twitter_credit_nullifier_hex` are NOT on
`points` — they come from the entry-submission record (looked up via
the caller-supplied `lookupBurnContext`).

#### Properties

##### signupId

> **signupId**: `bigint`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:112](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L112)

L0 signup_id (profiles.id).

##### sourcePointsId

> **sourcePointsId**: `bigint`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:110](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L110)

L0 points row id.

##### spendRefId

> **spendRefId**: `string`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:114](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L114)

L0 source_id (= the spendRefId used at debit time).

***

### ProjectAmoeBurnsToLedgerArgs

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:131](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L131)

Args for [projectAmoeBurnsToLedger](#projectamoeburnstoledger). The lookup callback is
required because the wallet + twitter-credit-nullifier needed to
compute `walletAddrCommit` live on the entry-submission record, not
on the `points` row. Tests pass an in-memory map; PR 5b's cron joins
against `amoe_zk_submissions`.

#### Properties

##### afterId?

> `optional` **afterId**: `bigint`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:169](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L169)

Optional cursor: only consider candidate rows whose `points.id` is
strictly greater than this value. The publisher uses this to advance
past rows that were permanently skipped (e.g. missing burn context),
which would otherwise occupy the head of every batch and starve
later rows. Defaults to 0n (start from the beginning of the epoch).

Note: this is an *additional* filter on top of the anti-join against
`amoe_points_burn_ledger.source_points_id`. Already-projected rows
are always excluded, so re-running with `afterId = 0n` is safe and
idempotent — the cursor is only useful as a starvation escape valve.

##### batchSize?

> `optional` **batchSize**: `number`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:156](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L156)

Optional: cap on how many rows to project per call. Defaults to 1000.
The publisher cron pages through epochs in chunks to bound a single
transaction's size.

##### db

> **db**: [`AmoeProjectorDb`](#amoeprojectordb)

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:133](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L133)

Database client.

##### epoch

> **epoch**: `bigint`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:138](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L138)

Epoch to project. Only `points` rows whose `created_at` falls in this
epoch are considered.

##### lookupBurnContext()

> **lookupBurnContext**: (`args`) => `Promise`\<[`AmoeBurnContext`](#amoeburncontext) \| `null`\>

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:148](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L148)

Resolve the wallet + twitter-credit nullifier for a given burn. Must
return `null` for burns without a matching entry-submission (the
projector then SKIPS that row — it cannot project a burn it cannot
bind to a wallet). Skipped rows are returned in the `skipped` count
for observability.

###### Parameters

###### args

[`AmoeBurnContextLookupArgs`](#amoeburncontextlookupargs)

###### Returns

`Promise`\<[`AmoeBurnContext`](#amoeburncontext) \| `null`\>

##### publisherRunId

> **publisherRunId**: `string`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:140](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L140)

UUID identifying the publisher run that owns these projections.

***

### ProjectAmoeBurnsToLedgerResult

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:188](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L188)

#### Properties

##### alreadyPresent

> **alreadyPresent**: `number`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:194](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L194)

Rows already present in L1 (idempotent re-run).

##### lastScannedId

> **lastScannedId**: `bigint` \| `null`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:204](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L204)

Highest `points.id` observed in this batch (or `null` if `scanned == 0`).
Callers paging through a large epoch should pass this back as
`afterId` on the next call to advance past permanently-skipped rows.

##### projected

> **projected**: `number`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:192](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L192)

Rows projected (newly inserted into L1).

##### rows

> **rows**: [`ProjectedBurnRow`](#projectedburnrow)[]

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:198](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L198)

Rows projected this run (for downstream verification).

##### scanned

> **scanned**: `number`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:190](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L190)

Total candidate L0 rows scanned for the epoch.

##### skippedMissingContext

> **skippedMissingContext**: `number`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:196](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L196)

Rows the lookup callback returned `null` for; skipped + counted.

***

### ProjectedBurnRow

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:172](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L172)

#### Properties

##### epoch

> **epoch**: `bigint`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:176](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L176)

##### leafHashHex

> **leafHashHex**: `string`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:183](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L183)

##### pointsBurned

> **pointsBurned**: `bigint`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:175](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L175)

##### pointsBurnedAsUSD

> **pointsBurnedAsUSD**: `bigint`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:181](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L181)

##### publisherRunId

> **publisherRunId**: `string`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:185](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L185)

##### signupId

> **signupId**: `bigint`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:173](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L173)

##### signupIdHashHex

> **signupIdHashHex**: `string`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:179](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L179)

##### sourcePointsId

> **sourcePointsId**: `bigint`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:184](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L184)

##### spendRefId

> **spendRefId**: `string`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:174](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L174)

##### spendRefIdHashHex

> **spendRefIdHashHex**: `string`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:180](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L180)

##### twitterCreditNullifierHex

> **twitterCreditNullifierHex**: `string`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:178](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L178)

##### walletAddrCommitHex

> **walletAddrCommitHex**: `string`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:182](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L182)

##### walletAddress

> **walletAddress**: `string`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:177](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L177)

## Type Aliases

### AmoeProjectorDb

> **AmoeProjectorDb** = `object`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:94](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L94)

Minimal db-pool shape this module needs. Mirrors `amoeReplayStore.ts`
for consistency with the rest of the AMOE server-side code.

#### Properties

##### sql()

> **sql**: (`strings`, ...`values`) => `Promise`\<\{ `rows`: `unknown`[]; \}\>

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:95](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L95)

###### Parameters

###### strings

`TemplateStringsArray`

###### values

...`unknown`[]

###### Returns

`Promise`\<\{ `rows`: `unknown`[]; \}\>

## Variables

### AMOE\_ENTRY\_SPEND\_SOURCE

> `const` **AMOE\_ENTRY\_SPEND\_SOURCE**: `"amoe_entry_spend"`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:84](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L84)

Source-tag for AMOE-entry burn rows in the operational `points` table.
Single point of truth — must match `consumeAmoeCreditsForEntry` in
`lotteryAmoe.ts`.

***

### AMOE\_POINTS\_TO\_USD\_E6

> `const` **AMOE\_POINTS\_TO\_USD\_E6**: `10000n`

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:77](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L77)

Conversion factor from AMOE points to USD-1e6 (`pointsBurnedAsUSD`).
Locked-spec value: `pointsBurnedAsUSD = points * 10_000`.

  100 points    → $1.00       → 1_000_000   (1e6) USD-1e6 units
  1_000_000 pts → $10_000.00  → 10_000_000_000 (1e10)

Mirrors `LotteryAmoeRouter.MAX_POINTS_AS_USD = 10_000 * 1_000_000`.

## Functions

### projectAmoeBurnsToLedger()

> **projectAmoeBurnsToLedger**(`args`): `Promise`\<[`ProjectAmoeBurnsToLedgerResult`](#projectamoeburnstoledgerresult)\>

Defined in: [server/\_lib/lottery/amoeLedgerProjector.ts:273](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerProjector.ts#L273)

Project AMOE points-burn rows for a single epoch from L0 (`points`) into
L1 (`amoe_points_burn_ledger`). Idempotent and side-effect-free for
already-projected rows (UNIQUE on `source_points_id`). Throws if the
AMOE signup salt is misconfigured.

Returns a per-run report describing what was done. Callers (the cron
in PR 5b, fixture tests) can use this to assert convergence.

#### Parameters

##### args

[`ProjectAmoeBurnsToLedgerArgs`](#projectamoeburnstoledgerargs)

#### Returns

`Promise`\<[`ProjectAmoeBurnsToLedgerResult`](#projectamoeburnstoledgerresult)\>
