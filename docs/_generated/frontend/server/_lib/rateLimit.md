[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/rateLimit

# server/\_lib/rateLimit

## Type Aliases

### RateLimitConfig

> **RateLimitConfig** = `object`

Defined in: [server/\_lib/rateLimit.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/rateLimit.ts#L30)

#### Properties

##### maxRequests

> **maxRequests**: `number`

Defined in: [server/\_lib/rateLimit.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/rateLimit.ts#L32)

##### windowMs

> **windowMs**: `number`

Defined in: [server/\_lib/rateLimit.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/rateLimit.ts#L31)

***

### RateLimitResult

> **RateLimitResult** = `object`

Defined in: [server/\_lib/rateLimit.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/rateLimit.ts#L35)

#### Properties

##### allowed

> **allowed**: `boolean`

Defined in: [server/\_lib/rateLimit.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/rateLimit.ts#L36)

##### remaining

> **remaining**: `number`

Defined in: [server/\_lib/rateLimit.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/rateLimit.ts#L37)

##### resetAt

> **resetAt**: `number`

Defined in: [server/\_lib/rateLimit.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/rateLimit.ts#L38)

## Variables

### RATE\_LIMITS

> `const` **RATE\_LIMITS**: `object`

Defined in: [server/\_lib/rateLimit.ts:79](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/rateLimit.ts#L79)

#### Type Declaration

##### adminAction

> `readonly` **adminAction**: `object`

###### adminAction.maxRequests

> `readonly` **maxRequests**: `30` = `30`

###### adminAction.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### agentAccessJoin

> `readonly` **agentAccessJoin**: `object`

###### agentAccessJoin.maxRequests

> `readonly` **maxRequests**: `60` = `60`

###### agentAccessJoin.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### agentAccessProofRequest

> `readonly` **agentAccessProofRequest**: `object`

###### agentAccessProofRequest.maxRequests

> `readonly` **maxRequests**: `40` = `40`

###### agentAccessProofRequest.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### agentAccessProofVerify

> `readonly` **agentAccessProofVerify**: `object`

###### agentAccessProofVerify.maxRequests

> `readonly` **maxRequests**: `40` = `40`

###### agentAccessProofVerify.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### agentCreative

> `readonly` **agentCreative**: `object`

###### agentCreative.maxRequests

> `readonly` **maxRequests**: `30` = `30`

###### agentCreative.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### agentFeedbackReview

> `readonly` **agentFeedbackReview**: `object`

###### agentFeedbackReview.maxRequests

> `readonly` **maxRequests**: `20` = `20`

###### agentFeedbackReview.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### agentFeedbackSubmit

> `readonly` **agentFeedbackSubmit**: `object`

###### agentFeedbackSubmit.maxRequests

> `readonly` **maxRequests**: `40` = `40`

###### agentFeedbackSubmit.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### agentIdentitySetWallet

> `readonly` **agentIdentitySetWallet**: `object`

###### agentIdentitySetWallet.maxRequests

> `readonly` **maxRequests**: `30` = `30`

###### agentIdentitySetWallet.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### agentsRead

> `readonly` **agentsRead**: `object`

###### agentsRead.maxRequests

> `readonly` **maxRequests**: `120` = `120`

###### agentsRead.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### agentsWrite

> `readonly` **agentsWrite**: `object`

###### agentsWrite.maxRequests

> `readonly` **maxRequests**: `30` = `30`

###### agentsWrite.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### auctionRead

> `readonly` **auctionRead**: `object`

###### auctionRead.maxRequests

> `readonly` **maxRequests**: `120` = `120`

###### auctionRead.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### authAgentWrite

> `readonly` **authAgentWrite**: `object`

###### authAgentWrite.maxRequests

> `readonly` **maxRequests**: `80` = `80`

###### authAgentWrite.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### authPrivy

> `readonly` **authPrivy**: `object`

###### authPrivy.maxRequests

> `readonly` **maxRequests**: `80` = `80`

###### authPrivy.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### authRead

> `readonly` **authRead**: `object`

###### authRead.maxRequests

> `readonly` **maxRequests**: `180` = `180`

###### authRead.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### authWrite

> `readonly` **authWrite**: `object`

###### authWrite.maxRequests

> `readonly` **maxRequests**: `120` = `120`

###### authWrite.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### buildAjnaCalldata

> `readonly` **buildAjnaCalldata**: `object`

###### buildAjnaCalldata.maxRequests

> `readonly` **maxRequests**: `120` = `120`

###### buildAjnaCalldata.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### buildAuctionSubmitBid

> `readonly` **buildAuctionSubmitBid**: `object`

###### buildAuctionSubmitBid.maxRequests

> `readonly` **maxRequests**: `80` = `80`

###### buildAuctionSubmitBid.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### buildCharmCalldata

> `readonly` **buildCharmCalldata**: `object`

###### buildCharmCalldata.maxRequests

> `readonly` **maxRequests**: `80` = `80`

###### buildCharmCalldata.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### buildGaugeVote

> `readonly` **buildGaugeVote**: `object`

###### buildGaugeVote.maxRequests

> `readonly` **maxRequests**: `80` = `80`

###### buildGaugeVote.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### buildVe4626Calldata

> `readonly` **buildVe4626Calldata**: `object`

###### buildVe4626Calldata.maxRequests

> `readonly` **maxRequests**: `80` = `80`

###### buildVe4626Calldata.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### charmRead

> `readonly` **charmRead**: `object`

###### charmRead.maxRequests

> `readonly` **maxRequests**: `120` = `120`

###### charmRead.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### chatCommandPreflight

> `readonly` **chatCommandPreflight**: `object`

###### chatCommandPreflight.maxRequests

> `readonly` **maxRequests**: `120` = `120`

###### chatCommandPreflight.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### chatTelemetry

> `readonly` **chatTelemetry**: `object`

###### chatTelemetry.maxRequests

> `readonly` **maxRequests**: `180` = `180`

###### chatTelemetry.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### creatorQuickstart

> `readonly` **creatorQuickstart**: `object`

###### creatorQuickstart.maxRequests

> `readonly` **maxRequests**: `20` = `20`

###### creatorQuickstart.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### creRuntimeDecisionsWrite

> `readonly` **creRuntimeDecisionsWrite**: `object`

###### creRuntimeDecisionsWrite.maxRequests

> `readonly` **maxRequests**: `60` = `60`

###### creRuntimeDecisionsWrite.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### creRuntimeIngestRead

> `readonly` **creRuntimeIngestRead**: `object`

###### creRuntimeIngestRead.maxRequests

> `readonly` **maxRequests**: `120` = `120`

###### creRuntimeIngestRead.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### creRuntimeIngestWrite

> `readonly` **creRuntimeIngestWrite**: `object`

###### creRuntimeIngestWrite.maxRequests

> `readonly` **maxRequests**: `60` = `60`

###### creRuntimeIngestWrite.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### creRuntimeTriggerWrite

> `readonly` **creRuntimeTriggerWrite**: `object`

###### creRuntimeTriggerWrite.maxRequests

> `readonly` **maxRequests**: `30` = `30`

###### creRuntimeTriggerWrite.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### cswLink

> `readonly` **cswLink**: `object`

###### cswLink.maxRequests

> `readonly` **maxRequests**: `10` = `10`

###### cswLink.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### deployCreate

> `readonly` **deployCreate**: `object`

###### deployCreate.maxRequests

> `readonly` **maxRequests**: `3` = `3`

###### deployCreate.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### deploySessionCancel

> `readonly` **deploySessionCancel**: `object`

###### deploySessionCancel.maxRequests

> `readonly` **maxRequests**: `20` = `20`

###### deploySessionCancel.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### deploySessionContinue

> `readonly` **deploySessionContinue**: `object`

###### deploySessionContinue.maxRequests

> `readonly` **maxRequests**: `30` = `30`

###### deploySessionContinue.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### deploySessionDryRun

> `readonly` **deploySessionDryRun**: `object`

###### deploySessionDryRun.maxRequests

> `readonly` **maxRequests**: `10` = `10`

###### deploySessionDryRun.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### deploySessionStart

> `readonly` **deploySessionStart**: `object`

###### deploySessionStart.maxRequests

> `readonly` **maxRequests**: `20` = `20`

###### deploySessionStart.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### deploySessionStatus

> `readonly` **deploySessionStatus**: `object`

###### deploySessionStatus.maxRequests

> `readonly` **maxRequests**: `240` = `240`

###### deploySessionStatus.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### exploreRead

> `readonly` **exploreRead**: `object`

###### exploreRead.maxRequests

> `readonly` **maxRequests**: `120` = `120`

###### exploreRead.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### gaugeRead

> `readonly` **gaugeRead**: `object`

###### gaugeRead.maxRequests

> `readonly` **maxRequests**: `120` = `120`

###### gaugeRead.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### general

> `readonly` **general**: `object`

###### general.maxRequests

> `readonly` **maxRequests**: `60` = `60`

###### general.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### lotteryRead

> `readonly` **lotteryRead**: `object`

###### lotteryRead.maxRequests

> `readonly` **maxRequests**: `120` = `120`

###### lotteryRead.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### lotteryWrite

> `readonly` **lotteryWrite**: `object`

###### lotteryWrite.maxRequests

> `readonly` **maxRequests**: `40` = `40`

###### lotteryWrite.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### paymasterRpc

> `readonly` **paymasterRpc**: `object`

###### paymasterRpc.maxRequests

> `readonly` **maxRequests**: `120` = `120`

###### paymasterRpc.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### smartWalletOwnerRead

> `readonly` **smartWalletOwnerRead**: `object`

###### smartWalletOwnerRead.maxRequests

> `readonly` **maxRequests**: `120` = `120`

###### smartWalletOwnerRead.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### solanaRouteProvision

> `readonly` **solanaRouteProvision**: `object`

###### solanaRouteProvision.maxRequests

> `readonly` **maxRequests**: `20` = `20`

###### solanaRouteProvision.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### solanaSetCanonical

> `readonly` **solanaSetCanonical**: `object`

###### solanaSetCanonical.maxRequests

> `readonly` **maxRequests**: `30` = `30`

###### solanaSetCanonical.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### solanaSweepEnqueue

> `readonly` **solanaSweepEnqueue**: `object`

###### solanaSweepEnqueue.maxRequests

> `readonly` **maxRequests**: `20` = `20`

###### solanaSweepEnqueue.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### solanaSweepProcess

> `readonly` **solanaSweepProcess**: `object`

###### solanaSweepProcess.maxRequests

> `readonly` **maxRequests**: `30` = `30`

###### solanaSweepProcess.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### specRead

> `readonly` **specRead**: `object`

###### specRead.maxRequests

> `readonly` **maxRequests**: `120` = `120`

###### specRead.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### telegramAdminWrite

> `readonly` **telegramAdminWrite**: `object`

###### telegramAdminWrite.maxRequests

> `readonly` **maxRequests**: `30` = `30`

###### telegramAdminWrite.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### telegramLinkRead

> `readonly` **telegramLinkRead**: `object`

###### telegramLinkRead.maxRequests

> `readonly` **maxRequests**: `120` = `120`

###### telegramLinkRead.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### telegramLinkWrite

> `readonly` **telegramLinkWrite**: `object`

###### telegramLinkWrite.maxRequests

> `readonly` **maxRequests**: `60` = `60`

###### telegramLinkWrite.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### telegramWebhookIngest

> `readonly` **telegramWebhookIngest**: `object`

###### telegramWebhookIngest.maxRequests

> `readonly` **maxRequests**: `1200` = `1200`

###### telegramWebhookIngest.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### vaultRead

> `readonly` **vaultRead**: `object`

###### vaultRead.maxRequests

> `readonly` **maxRequests**: `120` = `120`

###### vaultRead.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### ve4626Read

> `readonly` **ve4626Read**: `object`

###### ve4626Read.maxRequests

> `readonly` **maxRequests**: `120` = `120`

###### ve4626Read.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### waitlistSignup

> `readonly` **waitlistSignup**: `object`

###### waitlistSignup.maxRequests

> `readonly` **maxRequests**: `5` = `5`

###### waitlistSignup.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### workspaceActions

> `readonly` **workspaceActions**: `object`

###### workspaceActions.maxRequests

> `readonly` **maxRequests**: `40` = `40`

###### workspaceActions.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### workspaceRead

> `readonly` **workspaceRead**: `object`

###### workspaceRead.maxRequests

> `readonly` **maxRequests**: `120` = `120`

###### workspaceRead.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

## Functions

### checkRateLimit()

> **checkRateLimit**(`key`, `config`): [`RateLimitResult`](#ratelimitresult)

Defined in: [server/\_lib/rateLimit.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/rateLimit.ts#L45)

Check if a key is rate limited.
Returns whether the request is allowed and remaining quota.

#### Parameters

##### key

`string`

##### config

[`RateLimitConfig`](#ratelimitconfig)

#### Returns

[`RateLimitResult`](#ratelimitresult)

***

### getClientIp()

> **getClientIp**(`req`): `string`

Defined in: [server/\_lib/rateLimit.ts:197](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/rateLimit.ts#L197)

Helper to get client IP from request headers.

#### Parameters

##### req

###### headers?

`Record`\<`string`, `any`\>

#### Returns

`string`

***

### rateLimitKey()

> **rateLimitKey**(...`parts`): `string`

Defined in: [server/\_lib/rateLimit.ts:225](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/rateLimit.ts#L225)

Build a rate limit key from components.

#### Parameters

##### parts

...`string`[]

#### Returns

`string`
