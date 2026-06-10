[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/messaging/telegramTrading

# server/\_lib/messaging/telegramTrading

## Type Aliases

### TelegramMergePreflightResult

> **TelegramMergePreflightResult** = \{ `ok`: `true`; \} \| \{ `existingLinkStatus`: `string`; `existingPrivyUserId`: `string`; `existingProfileId`: `number` \| `null`; `ok`: `false`; `reason`: `"TELEGRAM_LINKED_TO_DIFFERENT_PRIVY"`; \}

Defined in: [server/\_lib/messaging/telegramTrading.ts:1252](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1252)

***

### TelegramOnboardingSession

> **TelegramOnboardingSession** = `object`

Defined in: [server/\_lib/messaging/telegramTrading.ts:1031](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1031)

#### Properties

##### expiresAt

> **expiresAt**: `string`

Defined in: [server/\_lib/messaging/telegramTrading.ts:1034](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1034)

##### step

> **step**: [`TelegramOnboardingStep`](#telegramonboardingstep)

Defined in: [server/\_lib/messaging/telegramTrading.ts:1033](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1033)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [server/\_lib/messaging/telegramTrading.ts:1032](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1032)

***

### TelegramOnboardingStep

> **TelegramOnboardingStep** = `"welcome"` \| `"csw_fork"` \| `"branch_create"` \| `"branch_link"`

Defined in: [server/\_lib/messaging/telegramTrading.ts:1029](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1029)

## Functions

### claimAndConsumeTelegramLinkStartToken()

> **claimAndConsumeTelegramLinkStartToken**(`params`): `Promise`\<[`TelegramLinkStartTokenClaimAndConsumeResult`](telegramTradingHelpers.md#telegramlinkstarttokenclaimandconsumeresult)\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:177](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L177)

#### Parameters

##### params

###### db

`Db`

###### privyUserId

`string`

###### token

`string`

#### Returns

`Promise`\<[`TelegramLinkStartTokenClaimAndConsumeResult`](telegramTradingHelpers.md#telegramlinkstarttokenclaimandconsumeresult)\>

***

### claimTelegramLinkStartToken()

> **claimTelegramLinkStartToken**(`params`): `Promise`\<[`TelegramLinkStartTokenClaimResult`](telegramTradingHelpers.md#telegramlinkstarttokenclaimresult)\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:119](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L119)

#### Parameters

##### params

###### db

`Db`

###### privyUserId

`string`

###### token

`string`

#### Returns

`Promise`\<[`TelegramLinkStartTokenClaimResult`](telegramTradingHelpers.md#telegramlinkstarttokenclaimresult)\>

***

### claimTelegramMiniAppReplayNonce()

> **claimTelegramMiniAppReplayNonce**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:358](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L358)

#### Parameters

##### params

###### authDate

`number`

###### db

`Db`

###### initDataHash

`string`

###### telegramUserId

`string` \| `number` \| `bigint`

###### ttlSeconds?

`number`

#### Returns

`Promise`\<`boolean`\>

***

### clearTelegramActiveMessage()

> **clearTelegramActiveMessage**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:2082](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L2082)

#### Parameters

##### params

###### chatId

`string`

###### db

`Db`

###### messageId?

`number` \| `null`

###### ownerTelegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<`void`\>

***

### clearTelegramTradePercentPrompt()

> **clearTelegramTradePercentPrompt**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1821](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1821)

#### Parameters

##### params

###### chatId

`string`

###### db

`Db`

###### telegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<`void`\>

***

### closeTelegramInlineSignalFeed()

> **closeTelegramInlineSignalFeed**(`params`): `Promise`\<[`TelegramInlineSignalFeed`](telegramTradingHelpers.md#telegraminlinesignalfeed) \| `null`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1973](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1973)

#### Parameters

##### params

###### db

`Db`

###### inlineMessageId

`string`

#### Returns

`Promise`\<[`TelegramInlineSignalFeed`](telegramTradingHelpers.md#telegraminlinesignalfeed) \| `null`\>

***

### consumeTelegramActionToken()

> **consumeTelegramActionToken**(`params`): `Promise`\<[`TelegramActionTokenConsumeResult`](telegramTradingHelpers.md#telegramactiontokenconsumeresult)\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:566](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L566)

#### Parameters

##### params

###### actionType?

`string`

###### chatId

`string`

###### db

`Db`

###### telegramUserId

`string` \| `number` \| `bigint`

###### token

`string`

#### Returns

`Promise`\<[`TelegramActionTokenConsumeResult`](telegramTradingHelpers.md#telegramactiontokenconsumeresult)\>

***

### consumeTelegramLinkStartToken()

> **consumeTelegramLinkStartToken**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:261](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L261)

#### Parameters

##### params

###### db

`Db`

###### privyUserId

`string`

###### token

`string`

#### Returns

`Promise`\<`boolean`\>

***

### consumeTelegramTradePercentPrompt()

> **consumeTelegramTradePercentPrompt**(`params`): `Promise`\<[`TelegramTradePercentPrompt`](telegramTradingHelpers.md#telegramtradepercentprompt) \| `null`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1792](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1792)

#### Parameters

##### params

###### chatId

`string`

###### db

`Db`

###### telegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<[`TelegramTradePercentPrompt`](telegramTradingHelpers.md#telegramtradepercentprompt) \| `null`\>

***

### createTelegramActionToken()

> **createTelegramActionToken**(`params`): `Promise`\<\{ `expiresAt`: `string`; `token`: `string`; \}\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:527](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L527)

#### Parameters

##### params

###### actionType

`string`

###### chatId

`string`

###### db

`Db`

###### intentPayload

`Record`\<`string`, `any`\>

###### telegramUserId

`string` \| `number` \| `bigint`

###### ttlSeconds?

`number`

#### Returns

`Promise`\<\{ `expiresAt`: `string`; `token`: `string`; \}\>

***

### createTelegramMiniAppSession()

> **createTelegramMiniAppSession**(`params`): `Promise`\<\{ `expiresAt`: `string`; `session`: [`TelegramMiniAppSession`](telegramTradingHelpers.md#telegramminiappsession); `sessionToken`: `string`; \} \| `null`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:396](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L396)

#### Parameters

##### params

###### authDate

`number`

###### chatId?

`string` \| `null`

###### chatInstance?

`string` \| `null`

###### chatType?

`string` \| `null`

###### db

`Db`

###### initDataHash

`string`

###### telegramUserId

`string` \| `number` \| `bigint`

###### telegramUsername?

`string` \| `null`

###### ttlSeconds?

`number`

#### Returns

`Promise`\<\{ `expiresAt`: `string`; `session`: [`TelegramMiniAppSession`](telegramTradingHelpers.md#telegramminiappsession); `sessionToken`: `string`; \} \| `null`\>

***

### ensureTelegramTradingSchema()

> **ensureTelegramTradingSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:721](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L721)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### finalizeTelegramLinkStartTokenConsumption()

> **finalizeTelegramLinkStartTokenConsumption**(`params`): `Promise`\<`"expired"` \| `"consumed"` \| `"other_user"` \| `"missing"`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:282](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L282)

#### Parameters

##### params

###### db

`Db`

###### privyUserId

`string`

###### token

`string`

#### Returns

`Promise`\<`"expired"` \| `"consumed"` \| `"other_user"` \| `"missing"`\>

***

### findReusableTelegramMiniAppSession()

> **findReusableTelegramMiniAppSession**(`params`): `Promise`\<[`TelegramMiniAppSession`](telegramTradingHelpers.md#telegramminiappsession) \| `null`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:459](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L459)

#### Parameters

##### params

###### authDate

`number`

###### chatId?

`string` \| `null`

###### db

`Db`

###### initDataHash

`string`

###### telegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<[`TelegramMiniAppSession`](telegramTradingHelpers.md#telegramminiappsession) \| `null`\>

***

### getHolderRoomPolicyByVault()

> **getHolderRoomPolicyByVault**(`params`): `Promise`\<[`TelegramHolderRoomPolicy`](telegramTradingHelpers.md#telegramholderroompolicy) \| `null`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1547](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1547)

#### Parameters

##### params

###### chatId

`string`

###### db

`Db`

###### vaultAddress

`string`

#### Returns

`Promise`\<[`TelegramHolderRoomPolicy`](telegramTradingHelpers.md#telegramholderroompolicy) \| `null`\>

***

### getTelegramActiveMessage()

> **getTelegramActiveMessage**(`params`): `Promise`\<[`TelegramActiveMessage`](telegramTradingHelpers.md#telegramactivemessage) \| `null`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:2019](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L2019)

#### Parameters

##### params

###### chatId

`string`

###### db

`Db`

###### ownerTelegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<[`TelegramActiveMessage`](telegramTradingHelpers.md#telegramactivemessage) \| `null`\>

***

### getTelegramChatTradePolicy()

> **getTelegramChatTradePolicy**(`params`): `Promise`\<[`TelegramChatTradePolicy`](telegramTradingHelpers.md#telegramchattradepolicy)\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1516](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1516)

#### Parameters

##### params

###### chatId

`string`

###### db

`Db`

#### Returns

`Promise`\<[`TelegramChatTradePolicy`](telegramTradingHelpers.md#telegramchattradepolicy)\>

***

### getTelegramFunnelMetrics()

> **getTelegramFunnelMetrics**(`params`): `Promise`\<[`TelegramFunnelMetrics`](telegramTradingHelpers.md#telegramfunnelmetrics)\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:2251](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L2251)

#### Parameters

##### params

###### chatId?

`string` \| `null`

###### db

`Db`

###### windowHours?

`number`

#### Returns

`Promise`\<[`TelegramFunnelMetrics`](telegramTradingHelpers.md#telegramfunnelmetrics)\>

***

### getTelegramInlineSignalFeedByInlineMessageId()

> **getTelegramInlineSignalFeedByInlineMessageId**(`params`): `Promise`\<[`TelegramInlineSignalFeed`](telegramTradingHelpers.md#telegraminlinesignalfeed) \| `null`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1888](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1888)

#### Parameters

##### params

###### db

`Db`

###### inlineMessageId

`string`

#### Returns

`Promise`\<[`TelegramInlineSignalFeed`](telegramTradingHelpers.md#telegraminlinesignalfeed) \| `null`\>

***

### getTelegramLinkByUserId()

> **getTelegramLinkByUserId**(`params`): `Promise`\<[`TelegramUserLink`](telegramTradingHelpers.md#telegramuserlink) \| `null`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1119](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1119)

#### Parameters

##### params

###### db

`Db`

###### telegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<[`TelegramUserLink`](telegramTradingHelpers.md#telegramuserlink) \| `null`\>

***

### getTelegramLinkStatus()

> **getTelegramLinkStatus**(`params`): `Promise`\<[`TelegramUserLink`](telegramTradingHelpers.md#telegramuserlink) \| `null`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1245](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1245)

#### Parameters

##### params

###### db

`Db`

###### telegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<[`TelegramUserLink`](telegramTradingHelpers.md#telegramuserlink) \| `null`\>

***

### getTelegramPortfolioSummary()

> **getTelegramPortfolioSummary**(`params`): `Promise`\<[`TelegramPortfolioSummary`](telegramTradingHelpers.md#telegramportfoliosummary) \| `null`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1418](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1418)

#### Parameters

##### params

###### db

`Db`

###### recentLimit?

`number`

###### telegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<[`TelegramPortfolioSummary`](telegramTradingHelpers.md#telegramportfoliosummary) \| `null`\>

***

### getTelegramTradePercentPrompt()

> **getTelegramTradePercentPrompt**(`params`): `Promise`\<[`TelegramTradePercentPrompt`](telegramTradingHelpers.md#telegramtradepercentprompt) \| `null`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1763](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1763)

#### Parameters

##### params

###### chatId

`string`

###### db

`Db`

###### telegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<[`TelegramTradePercentPrompt`](telegramTradingHelpers.md#telegramtradepercentprompt) \| `null`\>

***

### listHolderRoomMembersNeedingRecheck()

> **listHolderRoomMembersNeedingRecheck**(`params`): `Promise`\<[`TelegramHolderRoomRecheckRow`](telegramTradingHelpers.md#telegramholderroomrecheckrow)[]\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:2108](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L2108)

#### Parameters

##### params

###### chatId?

`string`

###### db

`Db`

###### limit?

`number`

#### Returns

`Promise`\<[`TelegramHolderRoomRecheckRow`](telegramTradingHelpers.md#telegramholderroomrecheckrow)[]\>

***

### listHolderRoomPolicies()

> **listHolderRoomPolicies**(`params`): `Promise`\<[`TelegramHolderRoomPolicy`](telegramTradingHelpers.md#telegramholderroompolicy)[]\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1567](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1567)

#### Parameters

##### params

###### chatId

`string`

###### db

`Db`

###### enabledOnly?

`boolean`

###### limit?

`number`

#### Returns

`Promise`\<[`TelegramHolderRoomPolicy`](telegramTradingHelpers.md#telegramholderroompolicy)[]\>

***

### listTelegramAuctions()

> **listTelegramAuctions**(`params`): `Promise`\<[`TelegramAuctionRow`](telegramTradingHelpers.md#telegramauctionrow)[]\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:2165](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L2165)

#### Parameters

##### params

###### chatId

`string`

###### db

`Db`

###### limit?

`number`

#### Returns

`Promise`\<[`TelegramAuctionRow`](telegramTradingHelpers.md#telegramauctionrow)[]\>

***

### listTelegramInlineSignalFeedsBySourceChat()

> **listTelegramInlineSignalFeedsBySourceChat**(`params`): `Promise`\<[`TelegramInlineSignalFeed`](telegramTradingHelpers.md#telegraminlinesignalfeed)[]\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1913](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1913)

#### Parameters

##### params

###### db

`Db`

###### includePaused?

`boolean`

###### limit?

`number`

###### sourceChatId

`string`

#### Returns

`Promise`\<[`TelegramInlineSignalFeed`](telegramTradingHelpers.md#telegraminlinesignalfeed)[]\>

***

### listTelegramScopedVaults()

> **listTelegramScopedVaults**(`params`): `Promise`\<[`TelegramScopedVault`](telegramTradingHelpers.md#telegramscopedvault)[]\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1467](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1467)

#### Parameters

##### params

###### chatId

`string`

###### db

`Db`

###### limit?

`number`

#### Returns

`Promise`\<[`TelegramScopedVault`](telegramTradingHelpers.md#telegramscopedvault)[]\>

***

### listTelegramSignals()

> **listTelegramSignals**(`params`): `Promise`\<[`TelegramSignalRow`](telegramTradingHelpers.md#telegramsignalrow)[]\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:2186](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L2186)

#### Parameters

##### params

###### chatId

`string`

###### db

`Db`

###### limit?

`number`

#### Returns

`Promise`\<[`TelegramSignalRow`](telegramTradingHelpers.md#telegramsignalrow)[]\>

***

### listTelegramUserBids()

> **listTelegramUserBids**(`params`): `Promise`\<[`TelegramSignalRow`](telegramTradingHelpers.md#telegramsignalrow)[]\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:2211](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L2211)

#### Parameters

##### params

###### db

`Db`

###### limit?

`number`

###### telegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<[`TelegramSignalRow`](telegramTradingHelpers.md#telegramsignalrow)[]\>

***

### logTelegramActionAudit()

> **logTelegramActionAudit**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:627](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L627)

#### Parameters

##### params

###### actionType

`string`

###### canonicalCswAddress

`string` \| `null`

###### chatId

`string`

###### correlationId?

`string` \| `null`

###### db

`Db`

###### errorCode?

`string` \| `null`

###### errorMessage?

`string` \| `null`

###### execution?

`Record`\<`string`, `any`\> \| `null`

###### intent

`Record`\<`string`, `any`\>

###### messageId?

`number` \| `null`

###### profileId

`number`

###### quote?

`Record`\<`string`, `any`\> \| `null`

###### status

`string`

###### telegramUserId

`string` \| `number` \| `bigint`

###### txHash?

`string` \| `null`

#### Returns

`Promise`\<`void`\>

***

### logTelegramFunnelEvent()

> **logTelegramFunnelEvent**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:687](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L687)

#### Parameters

##### params

###### actionType?

`string` \| `null`

###### chatId?

`string` \| `null`

###### context?

`Record`\<`string`, `any`\> \| `null`

###### db

`Db`

###### eventName

`string`

###### telegramUserId?

`string` \| `number` \| `bigint` \| `null`

#### Returns

`Promise`\<`void`\>

***

### readTelegramLinkStartTokenClaim()

> **readTelegramLinkStartTokenClaim**(`params`): `Promise`\<[`TelegramLinkStartTokenClaim`](telegramTradingHelpers.md#telegramlinkstarttokenclaim) \| `null`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:317](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L317)

#### Parameters

##### params

###### db

`Db`

###### token

`string`

#### Returns

`Promise`\<[`TelegramLinkStartTokenClaim`](telegramTradingHelpers.md#telegramlinkstarttokenclaim) \| `null`\>

***

### readTelegramMiniAppSession()

> **readTelegramMiniAppSession**(`params`): `Promise`\<[`TelegramMiniAppSessionReadResult`](telegramTradingHelpers.md#telegramminiappsessionreadresult)\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:492](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L492)

#### Parameters

##### params

###### db

`Db`

###### sessionToken

`string`

#### Returns

`Promise`\<[`TelegramMiniAppSessionReadResult`](telegramTradingHelpers.md#telegramminiappsessionreadresult)\>

***

### readTelegramOnboardingSession()

> **readTelegramOnboardingSession**(`params`): `Promise`\<[`TelegramOnboardingSession`](#telegramonboardingsession) \| `null`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1083](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1083)

#### Parameters

##### params

###### db

`Db`

###### telegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<[`TelegramOnboardingSession`](#telegramonboardingsession) \| `null`\>

***

### revokeTelegramLink()

> **revokeTelegramLink**(`params`): `Promise`\<\{ `link`: [`TelegramUserLink`](telegramTradingHelpers.md#telegramuserlink) \| `null`; `revoked`: `boolean`; \}\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1388](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1388)

#### Parameters

##### params

###### db

`Db`

###### reason?

`string`

###### telegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<\{ `link`: [`TelegramUserLink`](telegramTradingHelpers.md#telegramuserlink) \| `null`; `revoked`: `boolean`; \}\>

***

### runTelegramMergePreflight()

> **runTelegramMergePreflight**(`params`): `Promise`\<[`TelegramMergePreflightResult`](#telegrammergepreflightresult)\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1262](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1262)

#### Parameters

##### params

###### db

`Db`

###### privyUserId

`string`

###### telegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<[`TelegramMergePreflightResult`](#telegrammergepreflightresult)\>

***

### setTelegramInlineSignalFeedPaused()

> **setTelegramInlineSignalFeedPaused**(`params`): `Promise`\<[`TelegramInlineSignalFeed`](telegramTradingHelpers.md#telegraminlinesignalfeed) \| `null`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1944](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1944)

#### Parameters

##### params

###### db

`Db`

###### inlineMessageId

`string`

###### paused

`boolean`

#### Returns

`Promise`\<[`TelegramInlineSignalFeed`](telegramTradingHelpers.md#telegraminlinesignalfeed) \| `null`\>

***

### touchTelegramInlineSignalFeedPush()

> **touchTelegramInlineSignalFeedPush**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:2001](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L2001)

#### Parameters

##### params

###### db

`Db`

###### inlineMessageId

`string`

###### renderHash

`string`

#### Returns

`Promise`\<`void`\>

***

### tryInsertTelegramPrivateDmWelcomeSent()

> **tryInsertTelegramPrivateDmWelcomeSent**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1049](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1049)

Returns true when this was the first insert for the user (idempotent welcome gate).

#### Parameters

##### params

###### db

`Db`

###### telegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<`boolean`\>

***

### upsertHolderRoomMember()

> **upsertHolderRoomMember**(`params`): `Promise`\<[`TelegramHolderRoomMember`](telegramTradingHelpers.md#telegramholderroommember) \| `null`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1638](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1638)

#### Parameters

##### params

###### canonicalCswAddress

`string`

###### db

`Db`

###### graceUntil?

`string` \| `Date` \| `null`

###### lastCheckedAt?

`string` \| `Date` \| `null`

###### lastEligibleAt?

`string` \| `Date` \| `null`

###### removedAt?

`string` \| `Date` \| `null`

###### roomChatId

`string`

###### status?

[`TelegramHolderRoomMemberStatus`](telegramTradingHelpers.md#telegramholderroommemberstatus-1)

###### telegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<[`TelegramHolderRoomMember`](telegramTradingHelpers.md#telegramholderroommember) \| `null`\>

***

### upsertHolderRoomPolicy()

> **upsertHolderRoomPolicy**(`params`): `Promise`\<[`TelegramHolderRoomPolicy`](telegramTradingHelpers.md#telegramholderroompolicy) \| `null`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1588](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1588)

#### Parameters

##### params

###### chatId

`string`

###### db

`Db`

###### enabled?

`boolean`

###### graceHours?

`number`

###### minSharesRaw

`string` \| `number` \| `bigint`

###### roomChatId

`string`

###### vaultAddress

`string`

#### Returns

`Promise`\<[`TelegramHolderRoomPolicy`](telegramTradingHelpers.md#telegramholderroompolicy) \| `null`\>

***

### upsertTelegramActiveMessage()

> **upsertTelegramActiveMessage**(`params`): `Promise`\<[`TelegramActiveMessage`](telegramTradingHelpers.md#telegramactivemessage) \| `null`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:2042](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L2042)

#### Parameters

##### params

###### chatId

`string`

###### db

`Db`

###### messageId

`number`

###### ownerTelegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<[`TelegramActiveMessage`](telegramTradingHelpers.md#telegramactivemessage) \| `null`\>

***

### upsertTelegramInlineSignalFeed()

> **upsertTelegramInlineSignalFeed**(`params`): `Promise`\<[`TelegramInlineSignalFeed`](telegramTradingHelpers.md#telegraminlinesignalfeed) \| `null`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1836](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1836)

#### Parameters

##### params

###### db

`Db`

###### inlineMessageId

`string`

###### ownerTelegramUserId

`string` \| `number` \| `bigint`

###### sourceChatId

`string`

#### Returns

`Promise`\<[`TelegramInlineSignalFeed`](telegramTradingHelpers.md#telegraminlinesignalfeed) \| `null`\>

***

### upsertTelegramOnboardingSession()

> **upsertTelegramOnboardingSession**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1064](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1064)

#### Parameters

##### params

###### db

`Db`

###### step

[`TelegramOnboardingStep`](#telegramonboardingstep)

###### telegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<`void`\>

***

### upsertTelegramTradePercentPrompt()

> **upsertTelegramTradePercentPrompt**(`params`): `Promise`\<[`TelegramTradePercentPrompt`](telegramTradingHelpers.md#telegramtradepercentprompt) \| `null`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1705](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1705)

#### Parameters

##### params

###### actionType

[`TelegramTradePercentPromptAction`](telegramTradingHelpers.md#telegramtradepercentpromptaction)

###### chatId

`string`

###### db

`Db`

###### telegramUserId

`string` \| `number` \| `bigint`

###### ttlSeconds?

`number`

###### vaultAddress

`string`

#### Returns

`Promise`\<[`TelegramTradePercentPrompt`](telegramTradingHelpers.md#telegramtradepercentprompt) \| `null`\>

***

### upsertTelegramUserLink()

> **upsertTelegramUserLink**(`params`): `Promise`\<[`TelegramUserLink`](telegramTradingHelpers.md#telegramuserlink) \| `null`\>

Defined in: [server/\_lib/messaging/telegramTrading.ts:1297](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTrading.ts#L1297)

#### Parameters

##### params

###### canonicalCswAddress?

`string` \| `null`

###### db

`Db`

###### ownerVerified

`boolean`

###### privyUserId

`string`

###### profileId

`number`

###### telegramUserId

`string` \| `number` \| `bigint`

###### telegramUsername?

`string` \| `null`

#### Returns

`Promise`\<[`TelegramUserLink`](telegramTradingHelpers.md#telegramuserlink) \| `null`\>

## References

### asTrimmed

Re-exports [asTrimmed](telegramTradingHelpers.md#astrimmed)

***

### base64UrlDecodeToString

Re-exports [base64UrlDecodeToString](telegramTradingHelpers.md#base64urldecodetostring)

***

### base64UrlEncode

Re-exports [base64UrlEncode](telegramTradingHelpers.md#base64urlencode)

***

### createTelegramLinkStartToken

Re-exports [createTelegramLinkStartToken](telegramTradingHelpers.md#createtelegramlinkstarttoken)

***

### getTelegramLinkTokenSecret

Re-exports [getTelegramLinkTokenSecret](telegramTradingHelpers.md#gettelegramlinktokensecret)

***

### hashTelegramActionToken

Re-exports [hashTelegramActionToken](telegramTradingHelpers.md#hashtelegramactiontoken)

***

### hashTelegramLinkStartToken

Re-exports [hashTelegramLinkStartToken](telegramTradingHelpers.md#hashtelegramlinkstarttoken)

***

### hashTelegramMiniAppSessionToken

Re-exports [hashTelegramMiniAppSessionToken](telegramTradingHelpers.md#hashtelegramminiappsessiontoken)

***

### isTelegramFunnelEventsEnabled

Re-exports [isTelegramFunnelEventsEnabled](telegramTradingHelpers.md#istelegramfunneleventsenabled)

***

### isTelegramFunnelEventsEnabledForChat

Re-exports [isTelegramFunnelEventsEnabledForChat](telegramTradingHelpers.md#istelegramfunneleventsenabledforchat)

***

### isTelegramFunnelMetricsEnabled

Re-exports [isTelegramFunnelMetricsEnabled](telegramTradingHelpers.md#istelegramfunnelmetricsenabled)

***

### isTelegramFunnelMetricsEnabledForChat

Re-exports [isTelegramFunnelMetricsEnabledForChat](telegramTradingHelpers.md#istelegramfunnelmetricsenabledforchat)

***

### mapHolderRoomMemberRow

Re-exports [mapHolderRoomMemberRow](telegramTradingHelpers.md#mapholderroommemberrow)

***

### mapHolderRoomPolicyRow

Re-exports [mapHolderRoomPolicyRow](telegramTradingHelpers.md#mapholderroompolicyrow)

***

### mapTelegramActiveMessageRow

Re-exports [mapTelegramActiveMessageRow](telegramTradingHelpers.md#maptelegramactivemessagerow)

***

### mapTelegramInlineSignalFeedRow

Re-exports [mapTelegramInlineSignalFeedRow](telegramTradingHelpers.md#maptelegraminlinesignalfeedrow)

***

### mapTradePercentPromptRow

Re-exports [mapTradePercentPromptRow](telegramTradingHelpers.md#maptradepercentpromptrow)

***

### normalizeAddress

Re-exports [normalizeAddress](telegramTradingHelpers.md#normalizeaddress)

***

### normalizeHolderRoomMemberStatus

Re-exports [normalizeHolderRoomMemberStatus](telegramTradingHelpers.md#normalizeholderroommemberstatus)

***

### normalizeMiniAppInitDataHash

Re-exports [normalizeMiniAppInitDataHash](telegramTradingHelpers.md#normalizeminiappinitdatahash)

***

### normalizeRawAmount

Re-exports [normalizeRawAmount](telegramTradingHelpers.md#normalizerawamount)

***

### normalizeTelegramUserId

Re-exports [normalizeTelegramUserId](telegramTradingHelpers.md#normalizetelegramuserid)

***

### normalizeTradeActionType

Re-exports [normalizeTradeActionType](telegramTradingHelpers.md#normalizetradeactiontype)

***

### parseBoolean

Re-exports [parseBoolean](telegramTradingHelpers.md#parseboolean)

***

### parseCsvSet

Re-exports [parseCsvSet](telegramTradingHelpers.md#parsecsvset)

***

### parseGraceHours

Re-exports [parseGraceHours](telegramTradingHelpers.md#parsegracehours)

***

### parseJsonObject

Re-exports [parseJsonObject](telegramTradingHelpers.md#parsejsonobject)

***

### parseTelegramLinkStartTokenRaw

Re-exports [parseTelegramLinkStartTokenRaw](telegramTradingHelpers.md#parsetelegramlinkstarttokenraw)

***

### readTelegramFunnelMetricsRolloutChatIds

Re-exports [readTelegramFunnelMetricsRolloutChatIds](telegramTradingHelpers.md#readtelegramfunnelmetricsrolloutchatids)

***

### readTelegramFunnelRolloutChatIds

Re-exports [readTelegramFunnelRolloutChatIds](telegramTradingHelpers.md#readtelegramfunnelrolloutchatids)

***

### readTelegramLinkStartToken

Re-exports [readTelegramLinkStartToken](telegramTradingHelpers.md#readtelegramlinkstarttoken)

***

### readTelegramLinkStartTokenStatus

Re-exports [readTelegramLinkStartTokenStatus](telegramTradingHelpers.md#readtelegramlinkstarttokenstatus)

***

### signTelegramLinkPayload

Re-exports [signTelegramLinkPayload](telegramTradingHelpers.md#signtelegramlinkpayload)

***

### TelegramActionTokenConsumeResult

Re-exports [TelegramActionTokenConsumeResult](telegramTradingHelpers.md#telegramactiontokenconsumeresult)

***

### TelegramActiveMessage

Re-exports [TelegramActiveMessage](telegramTradingHelpers.md#telegramactivemessage)

***

### TelegramAuctionRow

Re-exports [TelegramAuctionRow](telegramTradingHelpers.md#telegramauctionrow)

***

### TelegramChatTradePolicy

Re-exports [TelegramChatTradePolicy](telegramTradingHelpers.md#telegramchattradepolicy)

***

### TelegramFunnelMetrics

Re-exports [TelegramFunnelMetrics](telegramTradingHelpers.md#telegramfunnelmetrics)

***

### TelegramHolderRoomMember

Re-exports [TelegramHolderRoomMember](telegramTradingHelpers.md#telegramholderroommember)

***

### TelegramHolderRoomMemberStatus

Re-exports [TelegramHolderRoomMemberStatus](telegramTradingHelpers.md#telegramholderroommemberstatus-1)

***

### TelegramHolderRoomPolicy

Re-exports [TelegramHolderRoomPolicy](telegramTradingHelpers.md#telegramholderroompolicy)

***

### TelegramHolderRoomRecheckRow

Re-exports [TelegramHolderRoomRecheckRow](telegramTradingHelpers.md#telegramholderroomrecheckrow)

***

### TelegramInlineSignalFeed

Re-exports [TelegramInlineSignalFeed](telegramTradingHelpers.md#telegraminlinesignalfeed)

***

### TelegramLinkStartTokenClaim

Re-exports [TelegramLinkStartTokenClaim](telegramTradingHelpers.md#telegramlinkstarttokenclaim)

***

### TelegramLinkStartTokenClaimAndConsumeResult

Re-exports [TelegramLinkStartTokenClaimAndConsumeResult](telegramTradingHelpers.md#telegramlinkstarttokenclaimandconsumeresult)

***

### TelegramLinkStartTokenClaimResult

Re-exports [TelegramLinkStartTokenClaimResult](telegramTradingHelpers.md#telegramlinkstarttokenclaimresult)

***

### TelegramLinkStartTokenPayload

Re-exports [TelegramLinkStartTokenPayload](telegramTradingHelpers.md#telegramlinkstarttokenpayload)

***

### TelegramLinkStartTokenReadResult

Re-exports [TelegramLinkStartTokenReadResult](telegramTradingHelpers.md#telegramlinkstarttokenreadresult)

***

### TelegramMiniAppSession

Re-exports [TelegramMiniAppSession](telegramTradingHelpers.md#telegramminiappsession)

***

### TelegramMiniAppSessionReadResult

Re-exports [TelegramMiniAppSessionReadResult](telegramTradingHelpers.md#telegramminiappsessionreadresult)

***

### TelegramPortfolioSummary

Re-exports [TelegramPortfolioSummary](telegramTradingHelpers.md#telegramportfoliosummary)

***

### TelegramScopedVault

Re-exports [TelegramScopedVault](telegramTradingHelpers.md#telegramscopedvault)

***

### TelegramSignalRow

Re-exports [TelegramSignalRow](telegramTradingHelpers.md#telegramsignalrow)

***

### TelegramTradePercentPrompt

Re-exports [TelegramTradePercentPrompt](telegramTradingHelpers.md#telegramtradepercentprompt)

***

### TelegramTradePercentPromptAction

Re-exports [TelegramTradePercentPromptAction](telegramTradingHelpers.md#telegramtradepercentpromptaction)

***

### TelegramUserLink

Re-exports [TelegramUserLink](telegramTradingHelpers.md#telegramuserlink)

***

### toIso

Re-exports [toIso](telegramTradingHelpers.md#toiso)
