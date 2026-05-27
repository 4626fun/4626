[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lottery/amoeReplayRetry

# server/\_lib/lottery/amoeReplayRetry

## Interfaces

### CronRetrySubmissionParams

Defined in: [server/\_lib/lottery/amoeReplayRetry.ts:90](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeReplayRetry.ts#L90)

The cron-only variant: skips the `callerSignupId` ownership check
because the cron runs as a system-level actor. Also drops
`submissionId` because the cron passes the id as a positional arg
to the per-row retry call.

#### Properties

##### currentEpoch

> **currentEpoch**: `bigint`

Defined in: [server/\_lib/lottery/amoeReplayRetry.ts:91](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeReplayRetry.ts#L91)

##### lotteryAmoeRouter

> **lotteryAmoeRouter**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeReplayRetry.ts:92](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeReplayRetry.ts#L92)

##### relay?

> `optional` **relay**: [`RetrySubmissionRelay`](#retrysubmissionrelay)

Defined in: [server/\_lib/lottery/amoeReplayRetry.ts:93](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeReplayRetry.ts#L93)

***

### RetrySubmissionParams

Defined in: [server/\_lib/lottery/amoeReplayRetry.ts:58](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeReplayRetry.ts#L58)

#### Properties

##### callerSignupId

> **callerSignupId**: `bigint`

Defined in: [server/\_lib/lottery/amoeReplayRetry.ts:68](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeReplayRetry.ts#L68)

Caller's signup_id (Postgres bigint). Required for ownership check
\u2014 a retry is rejected unless the caller owns the row.

For cron callers, pass the row's own `signup_id` value (the cron
is acting on behalf of the user and is allowed to retry their rows
regardless of who originally submitted them).

##### currentEpoch

> **currentEpoch**: `bigint`

Defined in: [server/\_lib/lottery/amoeReplayRetry.ts:74](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeReplayRetry.ts#L74)

Current epoch. Compared to the row's `epoch` \u2014 a mismatch means
the proof is no longer valid for the current epoch and the row is
abandoned with `epoch_rolled`.

##### lotteryAmoeRouter

> **lotteryAmoeRouter**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeReplayRetry.ts:76](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeReplayRetry.ts#L76)

Address of the deployed `LotteryAmoeRouter`.

##### relay?

> `optional` **relay**: [`RetrySubmissionRelay`](#retrysubmissionrelay)

Defined in: [server/\_lib/lottery/amoeReplayRetry.ts:81](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeReplayRetry.ts#L81)

Relay function. Production callers leave this as the default
(resolved by the caller), tests inject a mock.

##### submissionId

> **submissionId**: `string`

Defined in: [server/\_lib/lottery/amoeReplayRetry.ts:59](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeReplayRetry.ts#L59)

## Type Aliases

### RetrySubmissionOutcome

> **RetrySubmissionOutcome** = \{ `kind`: `"settled"`; `txHash`: `` `0x${string}` ``; \} \| \{ `kind`: `"manager_declined_again"`; `reason`: `string`; `retryCount`: `number`; \} \| \{ `kind`: `"abandoned_epoch_rolled"`; \} \| \{ `kind`: `"abandoned_budget_exhausted"`; \} \| \{ `kind`: `"rejected_chain"`; `reason`: `string`; \}

Defined in: [server/\_lib/lottery/amoeReplayRetry.ts:51](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeReplayRetry.ts#L51)

***

### RetrySubmissionRelay()

> **RetrySubmissionRelay** = (`params`) => `Promise`\<`` `0x${string}` ``\>

Defined in: [server/\_lib/lottery/amoeReplayRetry.ts:46](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeReplayRetry.ts#L46)

Relay function injected by callers. Production wires it to the same
`relayAmoeEntryZkTransaction` used by the submit handler; tests mock it.

#### Parameters

##### params

###### callData

`` `0x${string}` ``

###### to

`` `0x${string}` ``

#### Returns

`Promise`\<`` `0x${string}` ``\>

## Functions

### retrySubmissionById()

> **retrySubmissionById**(`params`): `Promise`\<[`RetrySubmissionOutcome`](#retrysubmissionoutcome)\>

Defined in: [server/\_lib/lottery/amoeReplayRetry.ts:241](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeReplayRetry.ts#L241)

Public: retry by id, with caller-ownership verification.

Used by the `POST /api/v1/lottery/amoe/retry-zk` HTTP endpoint.

Validates:
  1. Row exists.
  2. Caller owns the row (`signup_id === callerSignupId`).
  3. State is `manager_declined` (only retryable state).
  4. Current epoch matches the row's epoch.

#### Parameters

##### params

[`RetrySubmissionParams`](#retrysubmissionparams)

#### Returns

`Promise`\<[`RetrySubmissionOutcome`](#retrysubmissionoutcome)\>

#### Throws

AmoeBadRequestError('submission_not_found')

#### Throws

AmoeAuthorityError if caller doesn't own the row

#### Throws

AmoeBadRequestError('submission_not_retryable') for any state
        other than `manager_declined`

***

### retrySubmissionByIdAsCron()

> **retrySubmissionByIdAsCron**(`id`, `params`): `Promise`\<[`RetrySubmissionOutcome`](#retrysubmissionoutcome)\>

Defined in: [server/\_lib/lottery/amoeReplayRetry.ts:271](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeReplayRetry.ts#L271)

Public: retry by id from the cron path \u2014 skips the
caller-ownership check (the cron is a system actor).

#### Parameters

##### id

`string`

##### params

[`CronRetrySubmissionParams`](#cronretrysubmissionparams)

#### Returns

`Promise`\<[`RetrySubmissionOutcome`](#retrysubmissionoutcome)\>
