[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/lottery/amoeLedgerPublisher

# server/\_lib/lottery/amoeLedgerPublisher

## Interfaces

### BroadcastSetPointsLedgerRoot()

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:137](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L137)

Adapter for the on-chain broadcast. Tests inject a stub; production
uses [defaultBroadcastSetPointsLedgerRoot](#defaultbroadcastsetpointsledgerroot) which encodes via
viem and submits via the configured signer.

> **BroadcastSetPointsLedgerRoot**(`args`): `Promise`\<\{ `txHash`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:138](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L138)

Adapter for the on-chain broadcast. Tests inject a stub; production
uses [defaultBroadcastSetPointsLedgerRoot](#defaultbroadcastsetpointsledgerroot) which encodes via
viem and submits via the configured signer.

#### Parameters

##### args

###### epoch

`bigint`

###### lotteryAmoeRouter

`` `0x${string}` ``

###### rootHex

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `txHash`: `` `0x${string}` ``; \}\>

***

### ConfirmTransactionReceipt()

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:151](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L151)

Adapter for receipt confirmation. Tests inject a stub; production
uses viem's `waitForTransactionReceipt`. Returns the block number on
success, or `null` on timeout (caller leaves the run in state 2 for
the next tick to re-poll).

> **ConfirmTransactionReceipt**(`args`): `Promise`\<\{ `blockNumber`: `bigint`; \} \| `null`\>

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:152](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L152)

Adapter for receipt confirmation. Tests inject a stub; production
uses viem's `waitForTransactionReceipt`. Returns the block number on
success, or `null` on timeout (caller leaves the run in state 2 for
the next tick to re-poll).

#### Parameters

##### args

###### timeoutMs

`number`

###### txHash

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `blockNumber`: `bigint`; \} \| `null`\>

***

### LookupBurnContext()

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:164](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L164)

Resolve a burn's on-chain identity (wallet + nullifier) at projection
time. The projector calls this for every L0 row it considers; we wire
it through `amoe_zk_submissions` so the wallet bound to the proof is
the same wallet bound to the L1 leaf.

> **LookupBurnContext**(`args`): `Promise`\<[`AmoeBurnContext`](amoeLedgerProjector.md#amoeburncontext) \| `null`\>

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:165](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L165)

Resolve a burn's on-chain identity (wallet + nullifier) at projection
time. The projector calls this for every L0 row it considers; we wire
it through `amoe_zk_submissions` so the wallet bound to the proof is
the same wallet bound to the L1 leaf.

#### Parameters

##### args

[`AmoeBurnContextLookupArgs`](amoeLedgerProjector.md#amoeburncontextlookupargs)

#### Returns

`Promise`\<[`AmoeBurnContext`](amoeLedgerProjector.md#amoeburncontext) \| `null`\>

***

### PublishEpochArgs

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:168](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L168)

#### Properties

##### broadcast

> **broadcast**: [`BroadcastSetPointsLedgerRoot`](#broadcastsetpointsledgerroot)

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:178](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L178)

Adapter for the on-chain root broadcast.

##### claimedBy

> **claimedBy**: `string`

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:174](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L174)

Identity stamped on the publisher_runs row.

##### confirm

> **confirm**: [`ConfirmTransactionReceipt`](#confirmtransactionreceipt)

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:180](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L180)

Adapter for confirmation polling.

##### db

> **db**: [`AmoePublisherDb`](#amoepublisherdb)

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:170](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L170)

Db pool.

##### epoch

> **epoch**: `bigint`

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:172](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L172)

Epoch to publish.

##### lookupBurnContext

> **lookupBurnContext**: [`LookupBurnContext`](#lookupburncontext)

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:182](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L182)

Lookup wallet/nullifier for projection.

##### lotteryAmoeRouter

> **lotteryAmoeRouter**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:176](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L176)

Address of the deployed `LotteryAmoeRouter`.

##### publisherVersion

> **publisherVersion**: `string`

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:184](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L184)

Publisher version (git SHA) stamped on the L2 row.

## Type Aliases

### AmoePublisherDb

> **AmoePublisherDb** = `object`

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:125](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L125)

Db pool shape this module needs.

#### Properties

##### sql()

> **sql**: (`strings`, ...`values`) => `Promise`\<\{ `rows`: `unknown`[]; \}\>

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:126](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L126)

###### Parameters

###### strings

`TemplateStringsArray`

###### values

...`unknown`[]

###### Returns

`Promise`\<\{ `rows`: `unknown`[]; \}\>

***

### PublishEpochOutcome

> **PublishEpochOutcome** = \{ `epoch`: `bigint`; `kind`: `"finished"`; `rootHex`: `` `0x${string}` ``; `txHash`: `` `0x${string}` ``; \} \| \{ `epoch`: `bigint`; `kind`: `"finished_no_op"`; `reason`: `"empty_epoch"`; \} \| \{ `epoch`: `bigint`; `kind`: `"in_flight"`; `phase`: [`PublisherPhase`](#publisherphase); \} \| \{ `epoch`: `bigint`; `kind`: `"lost_claim"`; \} \| \{ `epoch`: `bigint`; `kind`: `"errored"`; `message`: `string`; `phase`: [`PublisherPhase`](#publisherphase); \}

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:188](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L188)

Outcome of a single epoch's pipeline run.

***

### PublisherPhase

> **PublisherPhase** = `"projecting"` \| `"building"` \| `"broadcasting"` \| `"confirming"` \| `"finished"` \| `"finished_no_op"` \| `"errored"`

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:195](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L195)

## Variables

### BACKFILL\_LOOKBACK\_EPOCHS

> `const` **BACKFILL\_LOOKBACK\_EPOCHS**: `14n` = `14n`

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:118](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L118)

How far back the cron will scan for unpublished closed epochs when
picking the next target. Bounded so a long outage doesn't make a
single tick scan unbounded history; ops can re-trigger the cron or
advance the horizon if real catch-up is needed beyond this.

14 epochs at the locked AMOE_EPOCH_LENGTH_SECONDS = 86_400 s = 14
days. Each tick still only publishes one epoch (MAX_EPOCHS_PER_TICK),
so a 14-day backlog drains in 14 ticks at 15-min cadence — about
3.5 hours — with plenty of margin.

***

### MAX\_EPOCHS\_PER\_TICK

> `const` **MAX\_EPOCHS\_PER\_TICK**: `1` = `1`

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:105](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L105)

Cap on epochs processed per tick. The cron is supposed to be the
common case (process the latest closed epoch); a value > 1 only
matters during outage backfill. Pin to 1 in production until §14
question 2 is resolved.

***

### MAX\_PROJECTOR\_ITERATIONS

> `const` **MAX\_PROJECTOR\_ITERATIONS**: `32` = `32`

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:90](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L90)

Hard cap on projector loop iterations within a single phase. Bounds
the cron tick's worst-case duration even if a misconfigured
`lookupBurnContext` returns null forever (the cursor advances anyway
but we still want a tick budget).

***

### RECEIPT\_WAIT\_TIMEOUT\_MS

> `const` **RECEIPT\_WAIT\_TIMEOUT\_MS**: `60000` = `60_000`

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:97](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L97)

How long to wait for the on-chain receipt before we give up on this
tick (we leave the L2 row in state 2 and the next tick will re-poll
via the confirming branch).

***

### STRANDED\_RUN\_RECLAIM\_AGE\_MS

> `const` **STRANDED\_RUN\_RECLAIM\_AGE\_MS**: `number`

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:82](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L82)

How long an in-flight publisher run can sit before reclaim treats it
as stranded. Sized above the worst-case `waitForTransactionReceipt`
(60 s) plus generous slack, and well below any sane cron cadence.

## Functions

### defaultBroadcastSetPointsLedgerRoot()

> **defaultBroadcastSetPointsLedgerRoot**(`args`): `Promise`\<\{ `txHash`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:808](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L808)

Default broadcaster — encodes the calldata and submits via the
configured signer (EOA or Privy CSW). Refuses to fall back to the
relay key (different on-chain role).

#### Parameters

##### args

###### epoch

`bigint`

###### lotteryAmoeRouter

`` `0x${string}` ``

###### rootHex

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `txHash`: `` `0x${string}` ``; \}\>

#### Throws

Error('no_publisher_key_configured') when no signer is set;
        the cron handler catches this and returns a 200 no-op.

***

### defaultConfirmTransactionReceipt()

> **defaultConfirmTransactionReceipt**(`args`): `Promise`\<\{ `blockNumber`: `bigint`; \} \| `null`\>

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:893](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L893)

Default receipt confirmer — wraps viem's `waitForTransactionReceipt`,
returns null on timeout (publisher leaves the run in 'confirming'
for the next tick to re-poll).

#### Parameters

##### args

###### timeoutMs

`number`

###### txHash

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `blockNumber`: `bigint`; \} \| `null`\>

***

### defaultLookupBurnContext()

> **defaultLookupBurnContext**(`db`, `args`): `Promise`\<[`AmoeBurnContext`](amoeLedgerProjector.md#amoeburncontext) \| `null`\>

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:938](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L938)

Default `lookupBurnContext` — joins against `amoe_zk_submissions` to
resolve `(wallet_address, twitter_credit_nullifier_hex)` for a given
`(signupId, spendRefId)`. Returns `null` when no matching submission
exists (the projector skips that L0 row).

The submission MUST have `nullifier_hex IS NOT NULL` — that is, the
proof has been generated. Burns whose proof never made it to the
submission table are orphaned and will be skipped permanently; this
is intentional — they have no on-chain identity to bind to.

#### Parameters

##### db

[`AmoePublisherDb`](#amoepublisherdb)

##### args

[`AmoeBurnContextLookupArgs`](amoeLedgerProjector.md#amoeburncontextlookupargs)

#### Returns

`Promise`\<[`AmoeBurnContext`](amoeLedgerProjector.md#amoeburncontext) \| `null`\>

***

### isAmoeLedgerPublisherEnabled()

> **isAmoeLedgerPublisherEnabled**(): `boolean`

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:761](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L761)

Whether the publisher cron is enabled. Defaults to false.

#### Returns

`boolean`

***

### pickNextEpochToPublish()

> **pickNextEpochToPublish**(`db`, `args`): `Promise`\<`bigint` \| `null`\>

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:438](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L438)

Pick the OLDEST unpublished closed epoch within the lookback horizon,
or null if every epoch in [latestClosedEpoch - lookback + 1, latestClosedEpoch]
already has a confirmed snapshot or a finished_no_op terminal run.

Backfill correctness: without this, the cron would always target only
`currentEpoch - 1`. If a tick was disabled or errored on an older
closed epoch, that epoch would be skipped permanently once time
advanced — leaving real submissions without a published root and
breaking proof/root consistency. With this, missed epochs get
retried until they confirm or fall outside the bounded horizon.

Returns the oldest epoch needing publish; the caller still publishes
only one per tick (MAX_EPOCHS_PER_TICK), so a backlog drains across
successive ticks.

#### Parameters

##### db

[`AmoePublisherDb`](#amoepublisherdb)

##### args

###### latestClosedEpoch

`bigint`

###### lookbackEpochs?

`bigint`

#### Returns

`Promise`\<`bigint` \| `null`\>

***

### publishEpoch()

> **publishEpoch**(`args`): `Promise`\<[`PublishEpochOutcome`](#publishepochoutcome)\>

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:502](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L502)

Run the full publish pipeline for a single epoch. Idempotent: if the
epoch's L2 row is already at state 2 (broadcast) or state 3
(confirmed), the function picks up where the previous tick left off
instead of re-projecting / re-building / re-broadcasting.

Returns a [PublishEpochOutcome](#publishepochoutcome) describing what was done. The
caller (cron handler) translates outcomes to log lines / metrics.

#### Parameters

##### args

[`PublishEpochArgs`](#publishepochargs)

#### Returns

`Promise`\<[`PublishEpochOutcome`](#publishepochoutcome)\>

***

### readAmoeLedgerPublisherBundlerUrl()

> **readAmoeLedgerPublisherBundlerUrl**(): `string` \| `null`

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:748](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L748)

#### Returns

`string` \| `null`

***

### readAmoeLedgerPublisherOwnerAddress()

> **readAmoeLedgerPublisherOwnerAddress**(): `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:734](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L734)

#### Returns

`` `0x${string}` `` \| `null`

***

### readAmoeLedgerPublisherPrivateKey()

> **readAmoeLedgerPublisherPrivateKey**(): `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:723](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L723)

Read the publisher EOA private key. Returns `null` if unset or
malformed.

#### Returns

`` `0x${string}` `` \| `null`

***

### readAmoeLedgerPublisherPrivyWalletId()

> **readAmoeLedgerPublisherPrivyWalletId**(): `string` \| `null`

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:729](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L729)

#### Returns

`string` \| `null`

***

### readAmoeLedgerPublisherSmartWallet()

> **readAmoeLedgerPublisherSmartWallet**(): `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:740](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L740)

#### Returns

`` `0x${string}` `` \| `null`

***

### readBaseRpcUrlForPublisher()

> **readBaseRpcUrlForPublisher**(): `string`

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:753](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L753)

#### Returns

`string`

***

### readPublisherClaimedBy()

> **readPublisherClaimedBy**(): `string`

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:766](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L766)

Pod identifier stamped on `claimed_by`.

#### Returns

`string`

***

### reclaimStrandedPublisherRuns()

> **reclaimStrandedPublisherRuns**(`db`, `options`): `Promise`\<`number`\>

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:401](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L401)

Mark in-flight runs whose `claimed_at` is older than the reclaim age
as `errored`. Called at the top of every cron tick before claiming
new epochs, so a crashed pod's claim can't permanently stall an
epoch.

Returns the number of rows reclaimed.

#### Parameters

##### db

[`AmoePublisherDb`](#amoepublisherdb)

##### options

###### reclaimAgeMs?

`number`

#### Returns

`Promise`\<`number`\>

***

### requirePublisherDb()

> **requirePublisherDb**(): `Promise`\<[`AmoePublisherDb`](#amoepublisherdb)\>

Defined in: [server/\_lib/lottery/amoeLedgerPublisher.ts:967](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeLedgerPublisher.ts#L967)

#### Returns

`Promise`\<[`AmoePublisherDb`](#amoepublisherdb)\>
