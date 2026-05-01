[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/lottery/amoeReplayStore

# server/\_lib/lottery/amoeReplayStore

## Interfaces

### AmoeReplayProofBlob

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:159](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L159)

#### Properties

##### proof

> **proof**: readonly `string`[]

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:160](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L160)

##### pubInputs

> **pubInputs**: readonly `string`[]

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:161](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L161)

***

### AmoeSubmissionInsertParams

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:113](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L113)

The shape we pass to `insertPending` — the minimum binding info
before the proof is generated.

#### Properties

##### creatorCoin

> **creatorCoin**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:119](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L119)

Lowercased creator coin address.

##### epoch

> **epoch**: `bigint`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:121](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L121)

AMOE epoch (`amoeSubmitZk.computeAmoeEpoch`).

##### pointsBurned

> **pointsBurned**: `number`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:129](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L129)

Points being burned (validated upstream).

##### signupId

> **signupId**: `bigint`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:115](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L115)

`profiles.id` (Postgres bigint) for the caller.

##### spendRefId

> **spendRefId**: `string`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:127](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L127)

Idempotency key used by the points ledger. Carried through the
row so an audit-time join from `points` -> `amoe_zk_submissions`
is one column.

##### wallet

> **wallet**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:117](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L117)

Caller's lowercased EVM wallet address.

***

### AmoeSubmissionMarkBroadcastingParams

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:164](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L164)

#### Properties

##### txHash?

> `optional` **txHash**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:166](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L166)

Set when relay returns the submitted hash.

***

### AmoeSubmissionMarkManagerDeclinedParams

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:175](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L175)

#### Properties

##### nextRetryAt?

> `optional` **nextRetryAt**: `Date`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:182](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L182)

When to retry next. If absent, `markManagerDeclined` computes
a default backoff from `retry_count`.

##### reason

> **reason**: `string`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:177](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L177)

##### txHash

> **txHash**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:176](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L176)

***

### AmoeSubmissionMarkProvenParams

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:136](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L136)

Marks a row as `proven` and writes the nullifier commitments. After
this call the unique constraint on `nonce_commit_hex` is in force.

#### Properties

##### nonceCommitHex

> **nonceCommitHex**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:138](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L138)

Hex `0x...` of the nonce commitment (pubInputs slot).

##### pointsBurnNullifierHex

> **pointsBurnNullifierHex**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:142](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L142)

Hex `0x...` of the points-burn nullifier (pubInputs slot).

##### proofBlob

> **proofBlob**: [`AmoeReplayProofBlob`](#amoereplayproofblob)

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:156](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L156)

The full proof + pubInputs blob, kept as JSONB for retries. We
GC this aggressively (see §7 of the design doc) because at ~5KB
per row it adds up.

##### twitterCreditNullifierHex?

> `optional` **twitterCreditNullifierHex**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:150](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L150)

Hex `0x...` of the twitter-credit nullifier (private input the
orchestrator derived from the user's twitter handle). Persisted
here so the publisher's projection step can recover it without
round-tripping the handle. Optional for backwards-compat with
pre-PR-5b callers; new code MUST supply it.

##### walletCommitHex

> **walletCommitHex**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:140](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L140)

Hex `0x...` of the wallet commitment (pubInputs slot).

***

### AmoeSubmissionMarkRejectedChainParams

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:185](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L185)

#### Properties

##### reason

> **reason**: `string`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:186](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L186)

##### txHash?

> `optional` **txHash**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:187](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L187)

***

### AmoeSubmissionMarkSettledParams

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:169](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L169)

#### Properties

##### blockNumber

> **blockNumber**: `bigint`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:171](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L171)

##### managerEntryId

> **managerEntryId**: `bigint` \| `null`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:172](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L172)

##### txHash

> **txHash**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:170](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L170)

***

### AmoeSubmissionRow

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:195](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L195)

The fully-shaped row read by `findById` / cron pickup. Mirrors the
`amoe_zk_submissions` table 1:1, but with bigints lifted out of
Postgres `bigint` (which `pg` returns as `string` by default).

#### Properties

##### blockNumber

> **blockNumber**: `bigint` \| `null`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:214](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L214)

##### broadcastAt

> **broadcastAt**: `Date` \| `null`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:211](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L211)

##### createdAt

> **createdAt**: `Date`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:209](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L209)

##### creatorCoin

> **creatorCoin**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:199](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L199)

##### epoch

> **epoch**: `bigint`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:200](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L200)

##### id

> **id**: `string`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:196](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L196)

##### lastRetryError

> **lastRetryError**: `string` \| `null`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:218](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L218)

##### managerEntryId

> **managerEntryId**: `bigint` \| `null`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:215](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L215)

##### nextRetryAt

> **nextRetryAt**: `Date` \| `null`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:217](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L217)

##### nonceCommitHex

> **nonceCommitHex**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:201](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L201)

##### pointsBurned

> **pointsBurned**: `bigint`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:206](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L206)

##### pointsBurnNullifierHex

> **pointsBurnNullifierHex**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:203](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L203)

##### proofBlob

> **proofBlob**: [`AmoeReplayProofBlob`](#amoereplayproofblob) \| `null`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:204](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L204)

##### provenAt

> **provenAt**: `Date` \| `null`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:210](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L210)

##### retryCount

> **retryCount**: `number`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:216](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L216)

##### retryStartedAt

> **retryStartedAt**: `Date` \| `null`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:225](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L225)

Timestamp at which a cron replica claimed this row for retry.
`null` for fresh / settled / abandoned rows; non-null only while
the row is in flight. The reclaim sweeper uses this to tell
"in flight by another replica" apart from "crashed mid-retry".

##### settledAt

> **settledAt**: `Date` \| `null`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:212](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L212)

##### signupId

> **signupId**: `bigint`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:197](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L197)

##### spendRefId

> **spendRefId**: `string`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:205](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L205)

##### state

> **state**: [`AmoeSubmissionState`](#amoesubmissionstate)

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:207](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L207)

##### stateReason

> **stateReason**: `string` \| `null`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:208](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L208)

##### txHash

> **txHash**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:213](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L213)

##### wallet

> **wallet**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:198](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L198)

##### walletCommitHex

> **walletCommitHex**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:202](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L202)

## Type Aliases

### AmoeSubmissionState

> **AmoeSubmissionState** = `"pending"` \| `"proven"` \| `"broadcast"` \| `"manager_declined"` \| `"settled"` \| `"prove_failed"` \| `"rejected_chain"` \| `"abandoned"`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:71](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L71)

Replay-store state enum. Lives here (not in a shared types file)
because every consumer is in this module's blast radius and we want
the source of truth co-located with the schema.

## Variables

### AMOE\_SUBMISSION\_TERMINAL\_STATES

> `const` **AMOE\_SUBMISSION\_TERMINAL\_STATES**: `ReadonlySet`\<[`AmoeSubmissionState`](#amoesubmissionstate)\>

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:85](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L85)

Terminal states — once a row reaches one of these, the state machine
never advances. Exported so the cron / retry endpoint can short-circuit.

***

### DEFAULT\_AMOE\_MAX\_RETRIES

> `const` **DEFAULT\_AMOE\_MAX\_RETRIES**: `8` = `8`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:97](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L97)

The retry budget for `manager_declined` rows. After this many
consecutive declines, the row transitions to `abandoned`.

Default 8. Tunable via `AMOE_MAX_RETRIES` env. We deliberately keep
the default low because each retry burns gas-priced relayer credits;
an eight-times-declined submission is almost certainly waiting on a
lottery-paused / coin-deactivated condition that requires manual ops.

***

### STRANDED\_CLAIM\_AGE\_MS

> `const` **STRANDED\_CLAIM\_AGE\_MS**: `number`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:861](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L861)

How long a claim is allowed to be in flight before reclaim treats
the row as stranded. Sized well above the worst-case prove + relay
round-trip (typically <30s), and well below the smallest backoff
(30 min) so reclaim never fights healthy retries.

## Functions

### \_\_resetAmoeReplayStoreSchemaEnsuredForTest()

> **\_\_resetAmoeReplayStoreSchemaEnsuredForTest**(): `void`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:238](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L238)

Reset the schema-ensured cache. Vitest only — production callers must
never need this because the bootstrap is idempotent.

#### Returns

`void`

***

### defaultRetryBackoffMs()

> **defaultRetryBackoffMs**(`retryCount`): `number`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:421](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L421)

Default retry backoff: `30 min × 2^retryCount + uniform(0, 5 min)`,
capped at 24h. Jitter avoids thundering-herd retries when a paused
lottery is unpaused and 50 declined rows all fire at the same minute.

#### Parameters

##### retryCount

`number`

#### Returns

`number`

***

### findActiveByNonceCommit()

> **findActiveByNonceCommit**(`nonceCommitHex`): `Promise`\<[`AmoeSubmissionRow`](#amoesubmissionrow) \| `null`\>

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:514](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L514)

Look up the active (non-terminal) submission for a given
`nonce_commit_hex`. Used pre-relay to short-circuit on a pre-existing
settled or in-flight row with the same commitment.

#### Parameters

##### nonceCommitHex

`` `0x${string}` ``

#### Returns

`Promise`\<[`AmoeSubmissionRow`](#amoesubmissionrow) \| `null`\>

***

### findById()

> **findById**(`id`): `Promise`\<[`AmoeSubmissionRow`](#amoesubmissionrow) \| `null`\>

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:496](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L496)

Look up by row id. Returns `null` if not found.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`AmoeSubmissionRow`](#amoesubmissionrow) \| `null`\>

***

### gcExpiredProofBlobs()

> **gcExpiredProofBlobs**(): `Promise`\<`number`\>

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:901](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L901)

Garbage-collect proof blobs whose `proof_kept_until` has passed.
Returns the number of rows scrubbed.

#### Returns

`Promise`\<`number`\>

***

### insertPending()

> **insertPending**(`params`): `Promise`\<`string`\>

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:442](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L442)

Insert a new `pending` row. Returns the generated submission UUID.

No uniqueness gate at this stage — multiple `pending` rows are
legal until proof generation pins `nonce_commit_hex`. This means the
caller is expected to dedupe via the unique constraint at `markProven`.

#### Parameters

##### params

[`AmoeSubmissionInsertParams`](#amoesubmissioninsertparams)

#### Returns

`Promise`\<`string`\>

***

### markAbandonedEpochRolled()

> **markAbandonedEpochRolled**(`id`): `Promise`\<[`AmoeSubmissionRow`](#amoesubmissionrow)\>

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:786](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L786)

Terminal: epoch rolled while submission was in flight. Same shape as
`markRejectedChain` but with a fixed reason; exists separately so we
can metric/alert independently.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`AmoeSubmissionRow`](#amoesubmissionrow)\>

***

### markBroadcasting()

> **markBroadcasting**(`id`, `params`): `Promise`\<[`AmoeSubmissionRow`](#amoesubmissionrow)\>

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:599](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L599)

Transition `proven → broadcast`. Optionally records the tx hash if
the relayer returns synchronously.

#### Parameters

##### id

`string`

##### params

[`AmoeSubmissionMarkBroadcastingParams`](#amoesubmissionmarkbroadcastingparams) = `{}`

#### Returns

`Promise`\<[`AmoeSubmissionRow`](#amoesubmissionrow)\>

***

### markManagerDeclined()

> **markManagerDeclined**(`id`, `params`): `Promise`\<[`AmoeSubmissionRow`](#amoesubmissionrow)\>

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:656](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L656)

Transition broadcast → `manager_declined`. Increments retry count
and schedules the next retry.

If the new `retry_count` reaches the budget, transitions to
`abandoned` instead (terminal, retry-budget-exhausted).

#### Parameters

##### id

`string`

##### params

[`AmoeSubmissionMarkManagerDeclinedParams`](#amoesubmissionmarkmanagerdeclinedparams)

#### Returns

`Promise`\<[`AmoeSubmissionRow`](#amoesubmissionrow)\>

***

### markProveFailed()

> **markProveFailed**(`id`, `reason`): `Promise`\<[`AmoeSubmissionRow`](#amoesubmissionrow)\>

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:731](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L731)

Terminal: prove crashed (witness invariant broken / snarkjs blew up).
Clears the proof blob (we have nothing useful to keep).

#### Parameters

##### id

`string`

##### reason

`string`

#### Returns

`Promise`\<[`AmoeSubmissionRow`](#amoesubmissionrow)\>

***

### markProven()

> **markProven**(`id`, `params`): `Promise`\<[`AmoeSubmissionRow`](#amoesubmissionrow)\>

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:540](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L540)

Transition `pending → proven`. Writes the three nullifier columns
and the proof blob.

Returns the row.

#### Parameters

##### id

`string`

##### params

[`AmoeSubmissionMarkProvenParams`](#amoesubmissionmarkprovenparams)

#### Returns

`Promise`\<[`AmoeSubmissionRow`](#amoesubmissionrow)\>

#### Throws

`AmoeBadRequestError('submission_in_flight')` when a different
        row already has the same `nonce_commit_hex` (PG unique
        constraint races collapse here).

***

### markRejectedChain()

> **markRejectedChain**(`id`, `params`): `Promise`\<[`AmoeSubmissionRow`](#amoesubmissionrow)\>

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:757](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L757)

Terminal: on-chain rejected with a non-ManagerDeclinedEntry revert
(bad proof, UnknownEpoch, etc.). User-actionable.

#### Parameters

##### id

`string`

##### params

[`AmoeSubmissionMarkRejectedChainParams`](#amoesubmissionmarkrejectedchainparams)

#### Returns

`Promise`\<[`AmoeSubmissionRow`](#amoesubmissionrow)\>

***

### markSettled()

> **markSettled**(`id`, `params`): `Promise`\<[`AmoeSubmissionRow`](#amoesubmissionrow)\>

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:624](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L624)

Transition any → `settled`. Clears `proof_blob` because settled rows
never need it again. Writes audit metadata.

#### Parameters

##### id

`string`

##### params

[`AmoeSubmissionMarkSettledParams`](#amoesubmissionmarksettledparams)

#### Returns

`Promise`\<[`AmoeSubmissionRow`](#amoesubmissionrow)\>

***

### pickRetriesForCron()

> **pickRetriesForCron**(`limit`): `Promise`\<[`AmoeSubmissionRow`](#amoesubmissionrow)[]\>

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:826](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L826)

Cron pickup query — claim up to `limit` rows that are due for retry.
Uses `FOR UPDATE SKIP LOCKED` so multiple cron replicas can run
safely in parallel.

Caller must process each returned row (call retry path) inside the
same transaction-equivalent (we lock for the duration of the cron
invocation; pg drivers hold the row lock until commit/rollback).

For simplicity and because the `getDb()` interface here is a
tagged-template wrapper without explicit transaction support, the
cron simply claims rows by setting `next_retry_at = NULL` (so it
won't be re-picked while in flight) inside the same UPDATE.

NOTE: this two-phase pattern (claim → process → restore on failure)
is a tiny bit weaker than `FOR UPDATE SKIP LOCKED` because a process
crash between claim and re-broadcast leaves the row stranded with
`next_retry_at = NULL`. The cron has a sweep query
(`reclaimStrandedRetries`) that recovers from that case.

#### Parameters

##### limit

`number`

#### Returns

`Promise`\<[`AmoeSubmissionRow`](#amoesubmissionrow)[]\>

***

### readAmoeMaxRetries()

> **readAmoeMaxRetries**(): `number`

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:99](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L99)

#### Returns

`number`

***

### reclaimStrandedRetries()

> **reclaimStrandedRetries**(): `Promise`\<`number`\>

Defined in: [server/\_lib/lottery/amoeReplayStore.ts:877](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeReplayStore.ts#L877)

Reclaim rows whose claim (`pickRetriesForCron` set
`next_retry_at = NULL` AND `retry_started_at = NOW()`) never
advanced to a new state because the worker crashed mid-retry.

Race-safety: only resurrect rows whose `retry_started_at` is older
than `STRANDED_CLAIM_AGE_MS` (15 minutes). Without this guard, an
overlapping cron tick would immediately requeue rows another
worker is actively processing, causing duplicate rebroadcasts and
unnecessary relay spend (Codex review on PR #444).

Sets `retry_started_at = NULL` so the row presents as a fresh,
unclaimed candidate after this update.

#### Returns

`Promise`\<`number`\>
