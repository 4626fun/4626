[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/telegramTrading

# server/\_lib/telegramTrading

## Type Aliases

### TelegramActionTokenConsumeResult

> **TelegramActionTokenConsumeResult** = \{ `actionType`: `string`; `consumedAt`: `string`; `expiresAt`: `string`; `intentPayload`: `Record`\<`string`, `any`\>; `ok`: `true`; \} \| \{ `ok`: `false`; `reason`: `"not_found"` \| `"expired"` \| `"consumed"` \| `"scope_mismatch"`; \}

Defined in: [server/\_lib/telegramTrading.ts:145](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L145)

***

### TelegramActiveMessage

> **TelegramActiveMessage** = `object`

Defined in: [server/\_lib/telegramTrading.ts:129](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L129)

#### Properties

##### chatId

> **chatId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:130](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L130)

##### createdAt

> **createdAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:133](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L133)

##### messageId

> **messageId**: `number`

Defined in: [server/\_lib/telegramTrading.ts:132](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L132)

##### ownerTelegramUserId

> **ownerTelegramUserId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:131](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L131)

##### updatedAt

> **updatedAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:134](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L134)

***

### TelegramAuctionRow

> **TelegramAuctionRow** = `object`

Defined in: [server/\_lib/telegramTrading.ts:47](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L47)

#### Properties

##### ccaStrategyAddress

> **ccaStrategyAddress**: `string`

Defined in: [server/\_lib/telegramTrading.ts:49](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L49)

##### chainId

> **chainId**: `number`

Defined in: [server/\_lib/telegramTrading.ts:51](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L51)

##### creatorCoinAddress

> **creatorCoinAddress**: `string`

Defined in: [server/\_lib/telegramTrading.ts:50](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L50)

##### isSettled

> **isSettled**: `boolean`

Defined in: [server/\_lib/telegramTrading.ts:52](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L52)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/\_lib/telegramTrading.ts:48](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L48)

***

### TelegramChatTradePolicy

> **TelegramChatTradePolicy** = `object`

Defined in: [server/\_lib/telegramTrading.ts:55](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L55)

#### Properties

##### bidEnabled

> **bidEnabled**: `boolean`

Defined in: [server/\_lib/telegramTrading.ts:57](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L57)

##### buySellEnabled

> **buySellEnabled**: `boolean`

Defined in: [server/\_lib/telegramTrading.ts:56](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L56)

***

### TelegramFunnelMetrics

> **TelegramFunnelMetrics** = `object`

Defined in: [server/\_lib/telegramTrading.ts:208](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L208)

#### Properties

##### chatId

> **chatId**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:211](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L211)

##### conversion

> **conversion**: `object`

Defined in: [server/\_lib/telegramTrading.ts:225](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L225)

###### inlineChosenRatePct

> **inlineChosenRatePct**: `number` \| `null`

###### inlineChosenToLinkStartRatePct

> **inlineChosenToLinkStartRatePct**: `number` \| `null`

###### inlineChosenToTradeFlowStartRatePct

> **inlineChosenToTradeFlowStartRatePct**: `number` \| `null`

###### linkCompletionRatePct

> **linkCompletionRatePct**: `number` \| `null`

###### tradePreviewToConfirmRatePct

> **tradePreviewToConfirmRatePct**: `number` \| `null`

##### counts

> **counts**: `object`

Defined in: [server/\_lib/telegramTrading.ts:212](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L212)

###### inlinePmHandoff

> **inlinePmHandoff**: `number`

###### inlinePreparedSent

> **inlinePreparedSent**: `number`

###### inlineQueryAnswered

> **inlineQueryAnswered**: `number`

###### inlineResultChosen

> **inlineResultChosen**: `number`

###### linkCompleteFailed

> **linkCompleteFailed**: `number`

###### linkCompleteSuccess

> **linkCompleteSuccess**: `number`

###### linkStart

> **linkStart**: `number`

###### tradeConfirmed

> **tradeConfirmed**: `number`

###### tradeConfirmFailed

> **tradeConfirmFailed**: `number`

###### tradeFlowStarted

> **tradeFlowStarted**: `number`

###### tradePreviewReady

> **tradePreviewReady**: `number`

##### since

> **since**: `string`

Defined in: [server/\_lib/telegramTrading.ts:210](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L210)

##### windowHours

> **windowHours**: `number`

Defined in: [server/\_lib/telegramTrading.ts:209](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L209)

***

### TelegramHolderRoomMember

> **TelegramHolderRoomMember** = `object`

Defined in: [server/\_lib/telegramTrading.ts:73](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L73)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:76](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L76)

##### createdAt

> **createdAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:82](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L82)

##### graceUntil

> **graceUntil**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:79](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L79)

##### lastCheckedAt

> **lastCheckedAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:80](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L80)

##### lastEligibleAt

> **lastEligibleAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:78](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L78)

##### removedAt

> **removedAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:81](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L81)

##### roomChatId

> **roomChatId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:74](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L74)

##### status

> **status**: [`TelegramHolderRoomMemberStatus`](#telegramholderroommemberstatus-1)

Defined in: [server/\_lib/telegramTrading.ts:77](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L77)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:75](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L75)

##### updatedAt

> **updatedAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:83](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L83)

***

### TelegramHolderRoomMemberStatus

> **TelegramHolderRoomMemberStatus** = `"active"` \| `"grace"` \| `"removed"`

Defined in: [server/\_lib/telegramTrading.ts:71](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L71)

***

### TelegramHolderRoomPolicy

> **TelegramHolderRoomPolicy** = `object`

Defined in: [server/\_lib/telegramTrading.ts:60](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L60)

#### Properties

##### chatId

> **chatId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:61](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L61)

##### createdAt

> **createdAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:67](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L67)

##### enabled

> **enabled**: `boolean`

Defined in: [server/\_lib/telegramTrading.ts:66](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L66)

##### graceHours

> **graceHours**: `number`

Defined in: [server/\_lib/telegramTrading.ts:65](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L65)

##### minSharesRaw

> **minSharesRaw**: `string`

Defined in: [server/\_lib/telegramTrading.ts:64](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L64)

##### roomChatId

> **roomChatId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:63](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L63)

##### updatedAt

> **updatedAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:68](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L68)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/\_lib/telegramTrading.ts:62](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L62)

***

### TelegramHolderRoomRecheckRow

> **TelegramHolderRoomRecheckRow** = `object`

Defined in: [server/\_lib/telegramTrading.ts:86](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L86)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:97](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L97)

##### chatId

> **chatId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:87](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L87)

##### enabled

> **enabled**: `boolean`

Defined in: [server/\_lib/telegramTrading.ts:95](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L95)

##### graceHours

> **graceHours**: `number`

Defined in: [server/\_lib/telegramTrading.ts:94](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L94)

##### graceUntil

> **graceUntil**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:100](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L100)

##### lastCheckedAt

> **lastCheckedAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:101](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L101)

##### lastEligibleAt

> **lastEligibleAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:99](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L99)

##### linkStatus

> **linkStatus**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:92](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L92)

##### minSharesRaw

> **minSharesRaw**: `string`

Defined in: [server/\_lib/telegramTrading.ts:93](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L93)

##### ownerVerified

> **ownerVerified**: `boolean`

Defined in: [server/\_lib/telegramTrading.ts:91](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L91)

##### roomChatId

> **roomChatId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:89](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L89)

##### shareTokenAddress

> **shareTokenAddress**: `string`

Defined in: [server/\_lib/telegramTrading.ts:90](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L90)

##### status

> **status**: [`TelegramHolderRoomMemberStatus`](#telegramholderroommemberstatus-1)

Defined in: [server/\_lib/telegramTrading.ts:98](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L98)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:96](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L96)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/\_lib/telegramTrading.ts:88](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L88)

***

### TelegramInlineSignalFeed

> **TelegramInlineSignalFeed** = `object`

Defined in: [server/\_lib/telegramTrading.ts:117](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L117)

#### Properties

##### closedAt

> **closedAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:122](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L122)

##### createdAt

> **createdAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:125](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L125)

##### inlineMessageId

> **inlineMessageId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:118](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L118)

##### lastPushedAt

> **lastPushedAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:124](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L124)

##### lastRenderHash

> **lastRenderHash**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:123](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L123)

##### ownerTelegramUserId

> **ownerTelegramUserId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:120](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L120)

##### paused

> **paused**: `boolean`

Defined in: [server/\_lib/telegramTrading.ts:121](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L121)

##### sourceChatId

> **sourceChatId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:119](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L119)

##### updatedAt

> **updatedAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:126](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L126)

***

### TelegramLinkStartTokenClaim

> **TelegramLinkStartTokenClaim** = `object`

Defined in: [server/\_lib/telegramTrading.ts:199](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L199)

#### Properties

##### chatId

> **chatId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:201](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L201)

##### consumedAt

> **consumedAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:204](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L204)

##### createdAt

> **createdAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:205](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L205)

##### expiresAt

> **expiresAt**: `string`

Defined in: [server/\_lib/telegramTrading.ts:203](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L203)

##### privyUserId

> **privyUserId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:202](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L202)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:200](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L200)

***

### TelegramLinkStartTokenClaimAndConsumeResult

> **TelegramLinkStartTokenClaimAndConsumeResult** = \{ `ok`: `true`; `payload`: [`TelegramLinkStartTokenPayload`](#telegramlinkstarttokenpayload); `state`: `"consumed"`; \} \| \{ `consumedAt?`: `string` \| `null`; `existingPrivyUserId?`: `string`; `ok`: `false`; `reason`: `"invalid"` \| `"expired"` \| `"consumed"` \| `"claimed_by_other_user"`; \}

Defined in: [server/\_lib/telegramTrading.ts:186](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L186)

***

### TelegramLinkStartTokenClaimResult

> **TelegramLinkStartTokenClaimResult** = \{ `ok`: `true`; `payload`: [`TelegramLinkStartTokenPayload`](#telegramlinkstarttokenpayload); `state`: `"claimed"` \| `"reused"`; \} \| \{ `ok`: `false`; `reason`: `"invalid"` \| `"expired"` \| `"consumed"` \| `"claimed_by_other_user"`; \}

Defined in: [server/\_lib/telegramTrading.ts:175](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L175)

***

### TelegramLinkStartTokenPayload

> **TelegramLinkStartTokenPayload** = `object`

Defined in: [server/\_lib/telegramTrading.ts:158](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L158)

#### Properties

##### chatId

> **chatId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:160](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L160)

##### expiresAt

> **expiresAt**: `string`

Defined in: [server/\_lib/telegramTrading.ts:162](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L162)

##### issuedAt

> **issuedAt**: `string`

Defined in: [server/\_lib/telegramTrading.ts:161](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L161)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:159](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L159)

***

### TelegramLinkStartTokenReadResult

> **TelegramLinkStartTokenReadResult** = \{ `ok`: `true`; `payload`: [`TelegramLinkStartTokenPayload`](#telegramlinkstarttokenpayload); \} \| \{ `ok`: `false`; `reason`: `"invalid"` \| `"expired"`; \}

Defined in: [server/\_lib/telegramTrading.ts:165](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L165)

***

### TelegramMergePreflightResult

> **TelegramMergePreflightResult** = \{ `ok`: `true`; \} \| \{ `existingLinkStatus`: `string`; `existingPrivyUserId`: `string`; `existingProfileId`: `number` \| `null`; `ok`: `false`; `reason`: `"TELEGRAM_LINKED_TO_DIFFERENT_PRIVY"`; \}

Defined in: [server/\_lib/telegramTrading.ts:1670](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L1670)

***

### TelegramMiniAppSession

> **TelegramMiniAppSession** = `object`

Defined in: [server/\_lib/telegramTrading.ts:234](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L234)

#### Properties

##### authDate

> **authDate**: `number`

Defined in: [server/\_lib/telegramTrading.ts:241](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L241)

##### chatId

> **chatId**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:237](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L237)

##### chatInstance

> **chatInstance**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:239](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L239)

##### chatType

> **chatType**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:238](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L238)

##### createdAt

> **createdAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:243](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L243)

##### expiresAt

> **expiresAt**: `string`

Defined in: [server/\_lib/telegramTrading.ts:242](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L242)

##### initDataHash

> **initDataHash**: `string`

Defined in: [server/\_lib/telegramTrading.ts:240](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L240)

##### lastUsedAt

> **lastUsedAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:244](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L244)

##### revokedAt

> **revokedAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:245](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L245)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:235](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L235)

##### telegramUsername

> **telegramUsername**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:236](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L236)

***

### TelegramMiniAppSessionReadResult

> **TelegramMiniAppSessionReadResult** = \{ `ok`: `true`; `session`: [`TelegramMiniAppSession`](#telegramminiappsession); \} \| \{ `ok`: `false`; `reason`: `"invalid"` \| `"expired"` \| `"revoked"`; \}

Defined in: [server/\_lib/telegramTrading.ts:248](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L248)

***

### TelegramOnboardingSession

> **TelegramOnboardingSession** = `object`

Defined in: [server/\_lib/telegramTrading.ts:1449](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L1449)

#### Properties

##### expiresAt

> **expiresAt**: `string`

Defined in: [server/\_lib/telegramTrading.ts:1452](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L1452)

##### step

> **step**: [`TelegramOnboardingStep`](#telegramonboardingstep)

Defined in: [server/\_lib/telegramTrading.ts:1451](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L1451)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:1450](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L1450)

***

### TelegramOnboardingStep

> **TelegramOnboardingStep** = `"welcome"` \| `"csw_fork"` \| `"branch_create"` \| `"branch_link"`

Defined in: [server/\_lib/telegramTrading.ts:1447](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L1447)

***

### TelegramPortfolioSummary

> **TelegramPortfolioSummary** = `object`

Defined in: [server/\_lib/telegramTrading.ts:23](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L23)

#### Properties

##### bidCount

> **bidCount**: `number`

Defined in: [server/\_lib/telegramTrading.ts:28](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L28)

##### buyCount

> **buyCount**: `number`

Defined in: [server/\_lib/telegramTrading.ts:26](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L26)

##### link

> **link**: [`TelegramUserLink`](#telegramuserlink)

Defined in: [server/\_lib/telegramTrading.ts:24](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L24)

##### recentActions

> **recentActions**: `object`[]

Defined in: [server/\_lib/telegramTrading.ts:29](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L29)

###### actionType

> **actionType**: `string`

###### createdAt

> **createdAt**: `string`

###### status

> **status**: `string`

###### txHash

> **txHash**: `string` \| `null`

##### sellCount

> **sellCount**: `number`

Defined in: [server/\_lib/telegramTrading.ts:27](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L27)

##### successfulActions

> **successfulActions**: `number`

Defined in: [server/\_lib/telegramTrading.ts:25](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L25)

***

### TelegramScopedVault

> **TelegramScopedVault** = `object`

Defined in: [server/\_lib/telegramTrading.ts:37](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L37)

#### Properties

##### ccaStrategyAddress

> **ccaStrategyAddress**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:44](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L44)

##### chainId

> **chainId**: `number`

Defined in: [server/\_lib/telegramTrading.ts:41](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L41)

##### creatorCoinAddress

> **creatorCoinAddress**: `string`

Defined in: [server/\_lib/telegramTrading.ts:39](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L39)

##### groupId

> **groupId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:42](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L42)

##### isSettled

> **isSettled**: `boolean`

Defined in: [server/\_lib/telegramTrading.ts:43](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L43)

##### shareTokenAddress

> **shareTokenAddress**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:40](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L40)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/\_lib/telegramTrading.ts:38](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L38)

***

### TelegramSignalRow

> **TelegramSignalRow** = `object`

Defined in: [server/\_lib/telegramTrading.ts:137](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L137)

#### Properties

##### actionType

> **actionType**: `string`

Defined in: [server/\_lib/telegramTrading.ts:139](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L139)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/telegramTrading.ts:142](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L142)

##### status

> **status**: `string`

Defined in: [server/\_lib/telegramTrading.ts:140](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L140)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:138](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L138)

##### txHash

> **txHash**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:141](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L141)

***

### TelegramTradePercentPrompt

> **TelegramTradePercentPrompt** = `object`

Defined in: [server/\_lib/telegramTrading.ts:106](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L106)

#### Properties

##### actionType

> **actionType**: [`TelegramTradePercentPromptAction`](#telegramtradepercentpromptaction)

Defined in: [server/\_lib/telegramTrading.ts:109](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L109)

##### chatId

> **chatId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:107](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L107)

##### consumedAt

> **consumedAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:112](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L112)

##### createdAt

> **createdAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:113](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L113)

##### expiresAt

> **expiresAt**: `string`

Defined in: [server/\_lib/telegramTrading.ts:111](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L111)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:108](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L108)

##### updatedAt

> **updatedAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:114](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L114)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/\_lib/telegramTrading.ts:110](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L110)

***

### TelegramTradePercentPromptAction

> **TelegramTradePercentPromptAction** = `"buy"` \| `"sell"` \| `"bid"`

Defined in: [server/\_lib/telegramTrading.ts:104](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L104)

***

### TelegramUserLink

> **TelegramUserLink** = `object`

Defined in: [server/\_lib/telegramTrading.ts:7](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L7)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:12](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L12)

##### failureCount

> **failureCount**: `number`

Defined in: [server/\_lib/telegramTrading.ts:18](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L18)

##### lastFailureReason

> **lastFailureReason**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:19](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L19)

##### lastVerifiedAt

> **lastVerifiedAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:16](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L16)

##### linkedAt

> **linkedAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:15](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L15)

##### linkStatus

> **linkStatus**: `string`

Defined in: [server/\_lib/telegramTrading.ts:14](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L14)

##### ownerVerified

> **ownerVerified**: `boolean`

Defined in: [server/\_lib/telegramTrading.ts:13](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L13)

##### privyUserId

> **privyUserId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:11](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L11)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/telegramTrading.ts:10](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L10)

##### revokedAt

> **revokedAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:17](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L17)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [server/\_lib/telegramTrading.ts:8](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L8)

##### telegramUsername

> **telegramUsername**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:9](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L9)

##### unlinkRequestedAt

> **unlinkRequestedAt**: `string` \| `null`

Defined in: [server/\_lib/telegramTrading.ts:20](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L20)

## Functions

### claimAndConsumeTelegramLinkStartToken()

> **claimAndConsumeTelegramLinkStartToken**(`params`): `Promise`\<[`TelegramLinkStartTokenClaimAndConsumeResult`](#telegramlinkstarttokenclaimandconsumeresult)\>

Defined in: [server/\_lib/telegramTrading.ts:595](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L595)

#### Parameters

##### params

###### db

`Db`

###### privyUserId

`string`

###### token

`string`

#### Returns

`Promise`\<[`TelegramLinkStartTokenClaimAndConsumeResult`](#telegramlinkstarttokenclaimandconsumeresult)\>

***

### claimTelegramLinkStartToken()

> **claimTelegramLinkStartToken**(`params`): `Promise`\<[`TelegramLinkStartTokenClaimResult`](#telegramlinkstarttokenclaimresult)\>

Defined in: [server/\_lib/telegramTrading.ts:537](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L537)

#### Parameters

##### params

###### db

`Db`

###### privyUserId

`string`

###### token

`string`

#### Returns

`Promise`\<[`TelegramLinkStartTokenClaimResult`](#telegramlinkstarttokenclaimresult)\>

***

### claimTelegramMiniAppReplayNonce()

> **claimTelegramMiniAppReplayNonce**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/telegramTrading.ts:776](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L776)

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

Defined in: [server/\_lib/telegramTrading.ts:2569](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L2569)

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

Defined in: [server/\_lib/telegramTrading.ts:2308](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L2308)

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

> **closeTelegramInlineSignalFeed**(`params`): `Promise`\<[`TelegramInlineSignalFeed`](#telegraminlinesignalfeed) \| `null`\>

Defined in: [server/\_lib/telegramTrading.ts:2460](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L2460)

#### Parameters

##### params

###### db

`Db`

###### inlineMessageId

`string`

#### Returns

`Promise`\<[`TelegramInlineSignalFeed`](#telegraminlinesignalfeed) \| `null`\>

***

### consumeTelegramActionToken()

> **consumeTelegramActionToken**(`params`): `Promise`\<[`TelegramActionTokenConsumeResult`](#telegramactiontokenconsumeresult)\>

Defined in: [server/\_lib/telegramTrading.ts:984](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L984)

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

`Promise`\<[`TelegramActionTokenConsumeResult`](#telegramactiontokenconsumeresult)\>

***

### consumeTelegramLinkStartToken()

> **consumeTelegramLinkStartToken**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/telegramTrading.ts:679](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L679)

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

> **consumeTelegramTradePercentPrompt**(`params`): `Promise`\<[`TelegramTradePercentPrompt`](#telegramtradepercentprompt) \| `null`\>

Defined in: [server/\_lib/telegramTrading.ts:2279](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L2279)

#### Parameters

##### params

###### chatId

`string`

###### db

`Db`

###### telegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<[`TelegramTradePercentPrompt`](#telegramtradepercentprompt) \| `null`\>

***

### createTelegramActionToken()

> **createTelegramActionToken**(`params`): `Promise`\<\{ `expiresAt`: `string`; `token`: `string`; \}\>

Defined in: [server/\_lib/telegramTrading.ts:945](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L945)

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

### createTelegramLinkStartToken()

> **createTelegramLinkStartToken**(`params`): `object`

Defined in: [server/\_lib/telegramTrading.ts:479](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L479)

#### Parameters

##### params

###### chatId

`string`

###### telegramUserId

`string` \| `number` \| `bigint`

###### ttlSeconds?

`number`

#### Returns

`object`

##### expiresAt

> **expiresAt**: `string`

##### token

> **token**: `string`

***

### createTelegramMiniAppSession()

> **createTelegramMiniAppSession**(`params`): `Promise`\<\{ `expiresAt`: `string`; `session`: [`TelegramMiniAppSession`](#telegramminiappsession); `sessionToken`: `string`; \} \| `null`\>

Defined in: [server/\_lib/telegramTrading.ts:814](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L814)

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

`Promise`\<\{ `expiresAt`: `string`; `session`: [`TelegramMiniAppSession`](#telegramminiappsession); `sessionToken`: `string`; \} \| `null`\>

***

### ensureTelegramTradingSchema()

> **ensureTelegramTradingSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/telegramTrading.ts:1139](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L1139)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### finalizeTelegramLinkStartTokenConsumption()

> **finalizeTelegramLinkStartTokenConsumption**(`params`): `Promise`\<`"expired"` \| `"consumed"` \| `"other_user"` \| `"missing"`\>

Defined in: [server/\_lib/telegramTrading.ts:700](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L700)

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

> **findReusableTelegramMiniAppSession**(`params`): `Promise`\<[`TelegramMiniAppSession`](#telegramminiappsession) \| `null`\>

Defined in: [server/\_lib/telegramTrading.ts:877](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L877)

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

`Promise`\<[`TelegramMiniAppSession`](#telegramminiappsession) \| `null`\>

***

### getHolderRoomPolicyByVault()

> **getHolderRoomPolicyByVault**(`params`): `Promise`\<[`TelegramHolderRoomPolicy`](#telegramholderroompolicy) \| `null`\>

Defined in: [server/\_lib/telegramTrading.ts:2034](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L2034)

#### Parameters

##### params

###### chatId

`string`

###### db

`Db`

###### vaultAddress

`string`

#### Returns

`Promise`\<[`TelegramHolderRoomPolicy`](#telegramholderroompolicy) \| `null`\>

***

### getTelegramActiveMessage()

> **getTelegramActiveMessage**(`params`): `Promise`\<[`TelegramActiveMessage`](#telegramactivemessage) \| `null`\>

Defined in: [server/\_lib/telegramTrading.ts:2506](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L2506)

#### Parameters

##### params

###### chatId

`string`

###### db

`Db`

###### ownerTelegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<[`TelegramActiveMessage`](#telegramactivemessage) \| `null`\>

***

### getTelegramChatTradePolicy()

> **getTelegramChatTradePolicy**(`params`): `Promise`\<[`TelegramChatTradePolicy`](#telegramchattradepolicy)\>

Defined in: [server/\_lib/telegramTrading.ts:1934](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L1934)

#### Parameters

##### params

###### chatId

`string`

###### db

`Db`

#### Returns

`Promise`\<[`TelegramChatTradePolicy`](#telegramchattradepolicy)\>

***

### getTelegramFunnelMetrics()

> **getTelegramFunnelMetrics**(`params`): `Promise`\<[`TelegramFunnelMetrics`](#telegramfunnelmetrics)\>

Defined in: [server/\_lib/telegramTrading.ts:2738](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L2738)

#### Parameters

##### params

###### chatId?

`string` \| `null`

###### db

`Db`

###### windowHours?

`number`

#### Returns

`Promise`\<[`TelegramFunnelMetrics`](#telegramfunnelmetrics)\>

***

### getTelegramInlineSignalFeedByInlineMessageId()

> **getTelegramInlineSignalFeedByInlineMessageId**(`params`): `Promise`\<[`TelegramInlineSignalFeed`](#telegraminlinesignalfeed) \| `null`\>

Defined in: [server/\_lib/telegramTrading.ts:2375](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L2375)

#### Parameters

##### params

###### db

`Db`

###### inlineMessageId

`string`

#### Returns

`Promise`\<[`TelegramInlineSignalFeed`](#telegraminlinesignalfeed) \| `null`\>

***

### getTelegramLinkByUserId()

> **getTelegramLinkByUserId**(`params`): `Promise`\<[`TelegramUserLink`](#telegramuserlink) \| `null`\>

Defined in: [server/\_lib/telegramTrading.ts:1537](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L1537)

#### Parameters

##### params

###### db

`Db`

###### telegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<[`TelegramUserLink`](#telegramuserlink) \| `null`\>

***

### getTelegramLinkStatus()

> **getTelegramLinkStatus**(`params`): `Promise`\<[`TelegramUserLink`](#telegramuserlink) \| `null`\>

Defined in: [server/\_lib/telegramTrading.ts:1663](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L1663)

#### Parameters

##### params

###### db

`Db`

###### telegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<[`TelegramUserLink`](#telegramuserlink) \| `null`\>

***

### getTelegramPortfolioSummary()

> **getTelegramPortfolioSummary**(`params`): `Promise`\<[`TelegramPortfolioSummary`](#telegramportfoliosummary) \| `null`\>

Defined in: [server/\_lib/telegramTrading.ts:1836](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L1836)

#### Parameters

##### params

###### db

`Db`

###### recentLimit?

`number`

###### telegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<[`TelegramPortfolioSummary`](#telegramportfoliosummary) \| `null`\>

***

### getTelegramTradePercentPrompt()

> **getTelegramTradePercentPrompt**(`params`): `Promise`\<[`TelegramTradePercentPrompt`](#telegramtradepercentprompt) \| `null`\>

Defined in: [server/\_lib/telegramTrading.ts:2250](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L2250)

#### Parameters

##### params

###### chatId

`string`

###### db

`Db`

###### telegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<[`TelegramTradePercentPrompt`](#telegramtradepercentprompt) \| `null`\>

***

### isTelegramFunnelEventsEnabled()

> **isTelegramFunnelEventsEnabled**(): `boolean`

Defined in: [server/\_lib/telegramTrading.ts:292](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L292)

#### Returns

`boolean`

***

### isTelegramFunnelEventsEnabledForChat()

> **isTelegramFunnelEventsEnabledForChat**(`chatId?`): `boolean`

Defined in: [server/\_lib/telegramTrading.ts:296](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L296)

#### Parameters

##### chatId?

`string` | `null`

#### Returns

`boolean`

***

### isTelegramFunnelMetricsEnabled()

> **isTelegramFunnelMetricsEnabled**(): `boolean`

Defined in: [server/\_lib/telegramTrading.ts:304](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L304)

#### Returns

`boolean`

***

### isTelegramFunnelMetricsEnabledForChat()

> **isTelegramFunnelMetricsEnabledForChat**(`chatId?`): `boolean`

Defined in: [server/\_lib/telegramTrading.ts:308](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L308)

#### Parameters

##### chatId?

`string` | `null`

#### Returns

`boolean`

***

### listHolderRoomMembersNeedingRecheck()

> **listHolderRoomMembersNeedingRecheck**(`params`): `Promise`\<[`TelegramHolderRoomRecheckRow`](#telegramholderroomrecheckrow)[]\>

Defined in: [server/\_lib/telegramTrading.ts:2595](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L2595)

#### Parameters

##### params

###### chatId?

`string`

###### db

`Db`

###### limit?

`number`

#### Returns

`Promise`\<[`TelegramHolderRoomRecheckRow`](#telegramholderroomrecheckrow)[]\>

***

### listHolderRoomPolicies()

> **listHolderRoomPolicies**(`params`): `Promise`\<[`TelegramHolderRoomPolicy`](#telegramholderroompolicy)[]\>

Defined in: [server/\_lib/telegramTrading.ts:2054](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L2054)

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

`Promise`\<[`TelegramHolderRoomPolicy`](#telegramholderroompolicy)[]\>

***

### listTelegramAuctions()

> **listTelegramAuctions**(`params`): `Promise`\<[`TelegramAuctionRow`](#telegramauctionrow)[]\>

Defined in: [server/\_lib/telegramTrading.ts:2652](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L2652)

#### Parameters

##### params

###### chatId

`string`

###### db

`Db`

###### limit?

`number`

#### Returns

`Promise`\<[`TelegramAuctionRow`](#telegramauctionrow)[]\>

***

### listTelegramInlineSignalFeedsBySourceChat()

> **listTelegramInlineSignalFeedsBySourceChat**(`params`): `Promise`\<[`TelegramInlineSignalFeed`](#telegraminlinesignalfeed)[]\>

Defined in: [server/\_lib/telegramTrading.ts:2400](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L2400)

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

`Promise`\<[`TelegramInlineSignalFeed`](#telegraminlinesignalfeed)[]\>

***

### listTelegramScopedVaults()

> **listTelegramScopedVaults**(`params`): `Promise`\<[`TelegramScopedVault`](#telegramscopedvault)[]\>

Defined in: [server/\_lib/telegramTrading.ts:1885](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L1885)

#### Parameters

##### params

###### chatId

`string`

###### db

`Db`

###### limit?

`number`

#### Returns

`Promise`\<[`TelegramScopedVault`](#telegramscopedvault)[]\>

***

### listTelegramSignals()

> **listTelegramSignals**(`params`): `Promise`\<[`TelegramSignalRow`](#telegramsignalrow)[]\>

Defined in: [server/\_lib/telegramTrading.ts:2673](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L2673)

#### Parameters

##### params

###### chatId

`string`

###### db

`Db`

###### limit?

`number`

#### Returns

`Promise`\<[`TelegramSignalRow`](#telegramsignalrow)[]\>

***

### listTelegramUserBids()

> **listTelegramUserBids**(`params`): `Promise`\<[`TelegramSignalRow`](#telegramsignalrow)[]\>

Defined in: [server/\_lib/telegramTrading.ts:2698](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L2698)

#### Parameters

##### params

###### db

`Db`

###### limit?

`number`

###### telegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<[`TelegramSignalRow`](#telegramsignalrow)[]\>

***

### logTelegramActionAudit()

> **logTelegramActionAudit**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/telegramTrading.ts:1045](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L1045)

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

Defined in: [server/\_lib/telegramTrading.ts:1105](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L1105)

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

### readTelegramLinkStartToken()

> **readTelegramLinkStartToken**(`token`): [`TelegramLinkStartTokenPayload`](#telegramlinkstarttokenpayload) \| `null`

Defined in: [server/\_lib/telegramTrading.ts:506](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L506)

#### Parameters

##### token

`string`

#### Returns

[`TelegramLinkStartTokenPayload`](#telegramlinkstarttokenpayload) \| `null`

***

### readTelegramLinkStartTokenClaim()

> **readTelegramLinkStartTokenClaim**(`params`): `Promise`\<[`TelegramLinkStartTokenClaim`](#telegramlinkstarttokenclaim) \| `null`\>

Defined in: [server/\_lib/telegramTrading.ts:735](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L735)

#### Parameters

##### params

###### db

`Db`

###### token

`string`

#### Returns

`Promise`\<[`TelegramLinkStartTokenClaim`](#telegramlinkstarttokenclaim) \| `null`\>

***

### readTelegramLinkStartTokenStatus()

> **readTelegramLinkStartTokenStatus**(`token`): [`TelegramLinkStartTokenReadResult`](#telegramlinkstarttokenreadresult)

Defined in: [server/\_lib/telegramTrading.ts:518](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L518)

#### Parameters

##### token

`string`

#### Returns

[`TelegramLinkStartTokenReadResult`](#telegramlinkstarttokenreadresult)

***

### readTelegramMiniAppSession()

> **readTelegramMiniAppSession**(`params`): `Promise`\<[`TelegramMiniAppSessionReadResult`](#telegramminiappsessionreadresult)\>

Defined in: [server/\_lib/telegramTrading.ts:910](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L910)

#### Parameters

##### params

###### db

`Db`

###### sessionToken

`string`

#### Returns

`Promise`\<[`TelegramMiniAppSessionReadResult`](#telegramminiappsessionreadresult)\>

***

### readTelegramOnboardingSession()

> **readTelegramOnboardingSession**(`params`): `Promise`\<[`TelegramOnboardingSession`](#telegramonboardingsession) \| `null`\>

Defined in: [server/\_lib/telegramTrading.ts:1501](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L1501)

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

> **revokeTelegramLink**(`params`): `Promise`\<\{ `link`: [`TelegramUserLink`](#telegramuserlink) \| `null`; `revoked`: `boolean`; \}\>

Defined in: [server/\_lib/telegramTrading.ts:1806](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L1806)

#### Parameters

##### params

###### db

`Db`

###### reason?

`string`

###### telegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<\{ `link`: [`TelegramUserLink`](#telegramuserlink) \| `null`; `revoked`: `boolean`; \}\>

***

### runTelegramMergePreflight()

> **runTelegramMergePreflight**(`params`): `Promise`\<[`TelegramMergePreflightResult`](#telegrammergepreflightresult)\>

Defined in: [server/\_lib/telegramTrading.ts:1680](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L1680)

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

> **setTelegramInlineSignalFeedPaused**(`params`): `Promise`\<[`TelegramInlineSignalFeed`](#telegraminlinesignalfeed) \| `null`\>

Defined in: [server/\_lib/telegramTrading.ts:2431](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L2431)

#### Parameters

##### params

###### db

`Db`

###### inlineMessageId

`string`

###### paused

`boolean`

#### Returns

`Promise`\<[`TelegramInlineSignalFeed`](#telegraminlinesignalfeed) \| `null`\>

***

### touchTelegramInlineSignalFeedPush()

> **touchTelegramInlineSignalFeedPush**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/telegramTrading.ts:2488](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L2488)

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

Defined in: [server/\_lib/telegramTrading.ts:1467](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L1467)

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

> **upsertHolderRoomMember**(`params`): `Promise`\<[`TelegramHolderRoomMember`](#telegramholderroommember) \| `null`\>

Defined in: [server/\_lib/telegramTrading.ts:2125](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L2125)

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

[`TelegramHolderRoomMemberStatus`](#telegramholderroommemberstatus-1)

###### telegramUserId

`string` \| `number` \| `bigint`

#### Returns

`Promise`\<[`TelegramHolderRoomMember`](#telegramholderroommember) \| `null`\>

***

### upsertHolderRoomPolicy()

> **upsertHolderRoomPolicy**(`params`): `Promise`\<[`TelegramHolderRoomPolicy`](#telegramholderroompolicy) \| `null`\>

Defined in: [server/\_lib/telegramTrading.ts:2075](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L2075)

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

`Promise`\<[`TelegramHolderRoomPolicy`](#telegramholderroompolicy) \| `null`\>

***

### upsertTelegramActiveMessage()

> **upsertTelegramActiveMessage**(`params`): `Promise`\<[`TelegramActiveMessage`](#telegramactivemessage) \| `null`\>

Defined in: [server/\_lib/telegramTrading.ts:2529](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L2529)

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

`Promise`\<[`TelegramActiveMessage`](#telegramactivemessage) \| `null`\>

***

### upsertTelegramInlineSignalFeed()

> **upsertTelegramInlineSignalFeed**(`params`): `Promise`\<[`TelegramInlineSignalFeed`](#telegraminlinesignalfeed) \| `null`\>

Defined in: [server/\_lib/telegramTrading.ts:2323](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L2323)

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

`Promise`\<[`TelegramInlineSignalFeed`](#telegraminlinesignalfeed) \| `null`\>

***

### upsertTelegramOnboardingSession()

> **upsertTelegramOnboardingSession**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/telegramTrading.ts:1482](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L1482)

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

> **upsertTelegramTradePercentPrompt**(`params`): `Promise`\<[`TelegramTradePercentPrompt`](#telegramtradepercentprompt) \| `null`\>

Defined in: [server/\_lib/telegramTrading.ts:2192](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L2192)

#### Parameters

##### params

###### actionType

[`TelegramTradePercentPromptAction`](#telegramtradepercentpromptaction)

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

`Promise`\<[`TelegramTradePercentPrompt`](#telegramtradepercentprompt) \| `null`\>

***

### upsertTelegramUserLink()

> **upsertTelegramUserLink**(`params`): `Promise`\<[`TelegramUserLink`](#telegramuserlink) \| `null`\>

Defined in: [server/\_lib/telegramTrading.ts:1715](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/telegramTrading.ts#L1715)

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

`Promise`\<[`TelegramUserLink`](#telegramuserlink) \| `null`\>
