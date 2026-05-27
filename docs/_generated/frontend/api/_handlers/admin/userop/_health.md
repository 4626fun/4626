[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / api/\_handlers/admin/userop/\_health

# api/\_handlers/admin/userop/\_health

## Type Aliases

### PaymasterModeStat

> **PaymasterModeStat** = `object`

Defined in: [api/\_handlers/admin/userop/\_health.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L24)

#### Properties

##### count

> **count**: `number`

Defined in: [api/\_handlers/admin/userop/\_health.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L24)

##### mode

> **mode**: `string`

Defined in: [api/\_handlers/admin/userop/\_health.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L24)

***

### SignatureModeStat

> **SignatureModeStat** = `object`

Defined in: [api/\_handlers/admin/userop/\_health.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L23)

Admin-only aggregate view of ERC-4337 UserOp telemetry submitted by the
browser via POST /api/v1/chat/telemetry (event = 'xmtp_userop_submission_batch').

Source: chat_command_center_events table. Telemetry is sampled + batched, so
these numbers are indicative rather than exhaustive. Each batch payload
already contains success/error/timeout counts and p50/p95/p99 durations,
so we sum those across recent batches per window.

#### Properties

##### count

> **count**: `number`

Defined in: [api/\_handlers/admin/userop/\_health.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L23)

##### mode

> **mode**: `string`

Defined in: [api/\_handlers/admin/userop/\_health.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L23)

***

### SubmissionPathStat

> **SubmissionPathStat** = `object`

Defined in: [api/\_handlers/admin/userop/\_health.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L25)

#### Properties

##### count

> **count**: `number`

Defined in: [api/\_handlers/admin/userop/\_health.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L25)

##### path

> **path**: `string`

Defined in: [api/\_handlers/admin/userop/\_health.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L25)

***

### UserOpHealthResponse

> **UserOpHealthResponse** = `object`

Defined in: [api/\_handlers/admin/userop/\_health.ts:47](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L47)

#### Properties

##### admin

> **admin**: `string`

Defined in: [api/\_handlers/admin/userop/\_health.ts:48](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L48)

##### event

> **event**: `"xmtp_userop_submission_batch"`

Defined in: [api/\_handlers/admin/userop/\_health.ts:50](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L50)

##### source

> **source**: `"chat_command_center_events"`

Defined in: [api/\_handlers/admin/userop/\_health.ts:49](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L49)

##### windows

> **windows**: `object`

Defined in: [api/\_handlers/admin/userop/\_health.ts:51](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L51)

###### last24h

> **last24h**: [`WindowStats`](#windowstats)

###### last7d

> **last7d**: [`WindowStats`](#windowstats)

***

### WindowStats

> **WindowStats** = `object`

Defined in: [api/\_handlers/admin/userop/\_health.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L26)

#### Properties

##### avgP50Ms

> **avgP50Ms**: `number` \| `null`

Defined in: [api/\_handlers/admin/userop/\_health.ts:36](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L36)

##### avgP95Ms

> **avgP95Ms**: `number` \| `null`

Defined in: [api/\_handlers/admin/userop/\_health.ts:37](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L37)

##### avgP99Ms

> **avgP99Ms**: `number` \| `null`

Defined in: [api/\_handlers/admin/userop/\_health.ts:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L38)

##### batchCount

> **batchCount**: `number`

Defined in: [api/\_handlers/admin/userop/\_health.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L27)

##### errorCount

> **errorCount**: `number`

Defined in: [api/\_handlers/admin/userop/\_health.ts:30](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L30)

##### fallbackRate

> **fallbackRate**: `number` \| `null`

Defined in: [api/\_handlers/admin/userop/\_health.ts:34](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L34)

##### fallbackToSelfFundedCount

> **fallbackToSelfFundedCount**: `number`

Defined in: [api/\_handlers/admin/userop/\_health.ts:33](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L33)

##### firstEventAt

> **firstEventAt**: `string` \| `null`

Defined in: [api/\_handlers/admin/userop/\_health.ts:43](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L43)

##### lastEventAt

> **lastEventAt**: `string` \| `null`

Defined in: [api/\_handlers/admin/userop/\_health.ts:44](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L44)

##### ownerIsContractCount

> **ownerIsContractCount**: `number`

Defined in: [api/\_handlers/admin/userop/\_health.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L35)

##### paymasterModeBreakdown

> **paymasterModeBreakdown**: [`PaymasterModeStat`](#paymastermodestat)[]

Defined in: [api/\_handlers/admin/userop/\_health.ts:40](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L40)

##### signatureModeBreakdown

> **signatureModeBreakdown**: [`SignatureModeStat`](#signaturemodestat)[]

Defined in: [api/\_handlers/admin/userop/\_health.ts:39](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L39)

##### submissionPathBreakdown

> **submissionPathBreakdown**: [`SubmissionPathStat`](#submissionpathstat)[]

Defined in: [api/\_handlers/admin/userop/\_health.ts:41](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L41)

##### successCount

> **successCount**: `number`

Defined in: [api/\_handlers/admin/userop/\_health.ts:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L29)

##### successRate

> **successRate**: `number` \| `null`

Defined in: [api/\_handlers/admin/userop/\_health.ts:32](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L32)

##### timeoutCount

> **timeoutCount**: `number`

Defined in: [api/\_handlers/admin/userop/\_health.ts:31](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L31)

##### topErrorCodes

> **topErrorCodes**: `object`[]

Defined in: [api/\_handlers/admin/userop/\_health.ts:42](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L42)

###### code

> **code**: `string`

###### count

> **count**: `number`

##### totalSamples

> **totalSamples**: `number`

Defined in: [api/\_handlers/admin/userop/\_health.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L28)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/admin/userop/\_health.ts:259](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/admin/userop/_health.ts#L259)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
