[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/messaging/telegramTradingHelpers

# server/\_lib/messaging/telegramTradingHelpers

## Type Aliases

### TelegramActionTokenConsumeResult

> **TelegramActionTokenConsumeResult** = \{ `actionType`: `string`; `consumedAt`: `string`; `expiresAt`: `string`; `intentPayload`: `Record`\<`string`, `any`\>; `ok`: `true`; \} \| \{ `ok`: `false`; `reason`: `"not_found"` \| `"expired"` \| `"consumed"` \| `"scope_mismatch"`; \}

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:153](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L153)

***

### TelegramActiveMessage

> **TelegramActiveMessage** = `object`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:137](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L137)

#### Properties

##### chatId

> **chatId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:138](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L138)

##### createdAt

> **createdAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:141](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L141)

##### messageId

> **messageId**: `number`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:140](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L140)

##### ownerTelegramUserId

> **ownerTelegramUserId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:139](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L139)

##### updatedAt

> **updatedAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:142](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L142)

***

### TelegramAuctionRow

> **TelegramAuctionRow** = `object`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:55](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L55)

#### Properties

##### ccaStrategyAddress

> **ccaStrategyAddress**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:57](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L57)

##### chainId

> **chainId**: `number`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:59](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L59)

##### creatorCoinAddress

> **creatorCoinAddress**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:58](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L58)

##### isSettled

> **isSettled**: `boolean`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:60](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L60)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L56)

***

### TelegramChatTradePolicy

> **TelegramChatTradePolicy** = `object`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:63](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L63)

#### Properties

##### bidEnabled

> **bidEnabled**: `boolean`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:65](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L65)

##### buySellEnabled

> **buySellEnabled**: `boolean`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:64](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L64)

***

### TelegramFunnelMetrics

> **TelegramFunnelMetrics** = `object`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:216](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L216)

#### Properties

##### chatId

> **chatId**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:219](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L219)

##### conversion

> **conversion**: `object`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:233](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L233)

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

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:220](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L220)

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

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:218](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L218)

##### windowHours

> **windowHours**: `number`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:217](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L217)

***

### TelegramHolderRoomMember

> **TelegramHolderRoomMember** = `object`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:81](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L81)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:84](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L84)

##### createdAt

> **createdAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:90](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L90)

##### graceUntil

> **graceUntil**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:87](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L87)

##### lastCheckedAt

> **lastCheckedAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:88](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L88)

##### lastEligibleAt

> **lastEligibleAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:86](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L86)

##### removedAt

> **removedAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:89](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L89)

##### roomChatId

> **roomChatId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:82](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L82)

##### status

> **status**: [`TelegramHolderRoomMemberStatus`](#telegramholderroommemberstatus-1)

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:85](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L85)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:83](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L83)

##### updatedAt

> **updatedAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:91](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L91)

***

### TelegramHolderRoomMemberStatus

> **TelegramHolderRoomMemberStatus** = `"active"` \| `"grace"` \| `"removed"`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:79](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L79)

***

### TelegramHolderRoomPolicy

> **TelegramHolderRoomPolicy** = `object`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:68](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L68)

#### Properties

##### chatId

> **chatId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:69](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L69)

##### createdAt

> **createdAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:75](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L75)

##### enabled

> **enabled**: `boolean`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:74](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L74)

##### graceHours

> **graceHours**: `number`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:73](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L73)

##### minSharesRaw

> **minSharesRaw**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:72](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L72)

##### roomChatId

> **roomChatId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:71](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L71)

##### updatedAt

> **updatedAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:76](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L76)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:70](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L70)

***

### TelegramHolderRoomRecheckRow

> **TelegramHolderRoomRecheckRow** = `object`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:94](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L94)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:105](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L105)

##### chatId

> **chatId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:95](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L95)

##### enabled

> **enabled**: `boolean`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:103](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L103)

##### graceHours

> **graceHours**: `number`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:102](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L102)

##### graceUntil

> **graceUntil**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:108](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L108)

##### lastCheckedAt

> **lastCheckedAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:109](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L109)

##### lastEligibleAt

> **lastEligibleAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:107](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L107)

##### linkStatus

> **linkStatus**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:100](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L100)

##### minSharesRaw

> **minSharesRaw**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:101](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L101)

##### ownerVerified

> **ownerVerified**: `boolean`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:99](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L99)

##### roomChatId

> **roomChatId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:97](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L97)

##### shareTokenAddress

> **shareTokenAddress**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:98](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L98)

##### status

> **status**: [`TelegramHolderRoomMemberStatus`](#telegramholderroommemberstatus-1)

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:106](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L106)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:104](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L104)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:96](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L96)

***

### TelegramInlineSignalFeed

> **TelegramInlineSignalFeed** = `object`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:125](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L125)

#### Properties

##### closedAt

> **closedAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:130](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L130)

##### createdAt

> **createdAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:133](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L133)

##### inlineMessageId

> **inlineMessageId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:126](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L126)

##### lastPushedAt

> **lastPushedAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:132](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L132)

##### lastRenderHash

> **lastRenderHash**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:131](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L131)

##### ownerTelegramUserId

> **ownerTelegramUserId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:128](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L128)

##### paused

> **paused**: `boolean`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:129](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L129)

##### sourceChatId

> **sourceChatId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:127](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L127)

##### updatedAt

> **updatedAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:134](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L134)

***

### TelegramLinkStartTokenClaim

> **TelegramLinkStartTokenClaim** = `object`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:207](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L207)

#### Properties

##### chatId

> **chatId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:209](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L209)

##### consumedAt

> **consumedAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:212](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L212)

##### createdAt

> **createdAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:213](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L213)

##### expiresAt

> **expiresAt**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:211](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L211)

##### privyUserId

> **privyUserId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:210](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L210)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:208](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L208)

***

### TelegramLinkStartTokenClaimAndConsumeResult

> **TelegramLinkStartTokenClaimAndConsumeResult** = \{ `ok`: `true`; `payload`: [`TelegramLinkStartTokenPayload`](#telegramlinkstarttokenpayload); `state`: `"consumed"`; \} \| \{ `consumedAt?`: `string` \| `null`; `existingPrivyUserId?`: `string`; `ok`: `false`; `reason`: `"invalid"` \| `"expired"` \| `"consumed"` \| `"claimed_by_other_user"`; \}

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:194](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L194)

***

### TelegramLinkStartTokenClaimResult

> **TelegramLinkStartTokenClaimResult** = \{ `ok`: `true`; `payload`: [`TelegramLinkStartTokenPayload`](#telegramlinkstarttokenpayload); `state`: `"claimed"` \| `"reused"`; \} \| \{ `ok`: `false`; `reason`: `"invalid"` \| `"expired"` \| `"consumed"` \| `"claimed_by_other_user"`; \}

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:183](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L183)

***

### TelegramLinkStartTokenPayload

> **TelegramLinkStartTokenPayload** = `object`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:166](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L166)

#### Properties

##### chatId

> **chatId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:168](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L168)

##### expiresAt

> **expiresAt**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:170](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L170)

##### issuedAt

> **issuedAt**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:169](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L169)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:167](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L167)

***

### TelegramLinkStartTokenRawPayload

> **TelegramLinkStartTokenRawPayload** = `object`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:444](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L444)

#### Properties

##### chatId

> **chatId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:446](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L446)

##### expiresAtMs

> **expiresAtMs**: `number`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:448](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L448)

##### issuedAtMs

> **issuedAtMs**: `number`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:447](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L447)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:445](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L445)

***

### TelegramLinkStartTokenReadResult

> **TelegramLinkStartTokenReadResult** = \{ `ok`: `true`; `payload`: [`TelegramLinkStartTokenPayload`](#telegramlinkstarttokenpayload); \} \| \{ `ok`: `false`; `reason`: `"invalid"` \| `"expired"`; \}

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:173](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L173)

***

### TelegramMiniAppSession

> **TelegramMiniAppSession** = `object`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:242](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L242)

#### Properties

##### authDate

> **authDate**: `number`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:249](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L249)

##### chatId

> **chatId**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:245](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L245)

##### chatInstance

> **chatInstance**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:247](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L247)

##### chatType

> **chatType**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:246](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L246)

##### createdAt

> **createdAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:251](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L251)

##### expiresAt

> **expiresAt**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:250](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L250)

##### initDataHash

> **initDataHash**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:248](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L248)

##### lastUsedAt

> **lastUsedAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:252](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L252)

##### revokedAt

> **revokedAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:253](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L253)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:243](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L243)

##### telegramUsername

> **telegramUsername**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:244](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L244)

***

### TelegramMiniAppSessionReadResult

> **TelegramMiniAppSessionReadResult** = \{ `ok`: `true`; `session`: [`TelegramMiniAppSession`](#telegramminiappsession); \} \| \{ `ok`: `false`; `reason`: `"invalid"` \| `"expired"` \| `"revoked"`; \}

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:256](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L256)

***

### TelegramPortfolioSummary

> **TelegramPortfolioSummary** = `object`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L31)

#### Properties

##### bidCount

> **bidCount**: `number`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L36)

##### buyCount

> **buyCount**: `number`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L34)

##### link

> **link**: [`TelegramUserLink`](#telegramuserlink)

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L32)

##### recentActions

> **recentActions**: `object`[]

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L37)

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

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L35)

##### successfulActions

> **successfulActions**: `number`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L33)

***

### TelegramScopedVault

> **TelegramScopedVault** = `object`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L45)

#### Properties

##### ccaStrategyAddress

> **ccaStrategyAddress**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L52)

##### chainId

> **chainId**: `number`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L49)

##### creatorCoinAddress

> **creatorCoinAddress**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L47)

##### groupId

> **groupId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L50)

##### isSettled

> **isSettled**: `boolean`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L51)

##### shareTokenAddress

> **shareTokenAddress**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L48)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L46)

***

### TelegramSignalRow

> **TelegramSignalRow** = `object`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:145](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L145)

#### Properties

##### actionType

> **actionType**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:147](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L147)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:150](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L150)

##### status

> **status**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:148](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L148)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:146](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L146)

##### txHash

> **txHash**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:149](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L149)

***

### TelegramTradePercentPrompt

> **TelegramTradePercentPrompt** = `object`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:114](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L114)

#### Properties

##### actionType

> **actionType**: [`TelegramTradePercentPromptAction`](#telegramtradepercentpromptaction)

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:117](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L117)

##### chatId

> **chatId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:115](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L115)

##### consumedAt

> **consumedAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:120](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L120)

##### createdAt

> **createdAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:121](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L121)

##### expiresAt

> **expiresAt**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:119](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L119)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:116](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L116)

##### updatedAt

> **updatedAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:122](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L122)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:118](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L118)

***

### TelegramTradePercentPromptAction

> **TelegramTradePercentPromptAction** = `"buy"` \| `"sell"` \| `"bid"`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:112](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L112)

***

### TelegramUserLink

> **TelegramUserLink** = `object`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L15)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L20)

##### failureCount

> **failureCount**: `number`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L26)

##### lastFailureReason

> **lastFailureReason**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L27)

##### lastVerifiedAt

> **lastVerifiedAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L24)

##### linkedAt

> **linkedAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L23)

##### linkStatus

> **linkStatus**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L22)

##### ownerVerified

> **ownerVerified**: `boolean`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L21)

##### privyUserId

> **privyUserId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L19)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L18)

##### revokedAt

> **revokedAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L25)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L16)

##### telegramUsername

> **telegramUsername**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L17)

##### unlinkRequestedAt

> **unlinkRequestedAt**: `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L28)

## Functions

### asTrimmed()

> **asTrimmed**(`value`): `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:270](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L270)

#### Parameters

##### value

`unknown`

#### Returns

`string`

***

### base64UrlDecodeToString()

> **base64UrlDecodeToString**(`input`): `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:401](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L401)

#### Parameters

##### input

`string`

#### Returns

`string` \| `null`

***

### base64UrlEncode()

> **base64UrlEncode**(`input`): `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:396](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L396)

#### Parameters

##### input

`string` | `Buffer`\<`ArrayBufferLike`\>

#### Returns

`string`

***

### createTelegramLinkStartToken()

> **createTelegramLinkStartToken**(`params`): `object`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:492](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L492)

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

### getTelegramLinkTokenSecret()

> **getTelegramLinkTokenSecret**(): `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:411](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L411)

#### Returns

`string`

***

### hashTelegramActionToken()

> **hashTelegramActionToken**(`token`): `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:423](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L423)

#### Parameters

##### token

`string`

#### Returns

`string`

***

### hashTelegramLinkStartToken()

> **hashTelegramLinkStartToken**(`token`): `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:431](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L431)

#### Parameters

##### token

`string`

#### Returns

`string`

***

### hashTelegramMiniAppSessionToken()

> **hashTelegramMiniAppSessionToken**(`token`): `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:427](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L427)

#### Parameters

##### token

`string`

#### Returns

`string`

***

### isTelegramFunnelEventsEnabled()

> **isTelegramFunnelEventsEnabled**(): `boolean`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:301](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L301)

#### Returns

`boolean`

***

### isTelegramFunnelEventsEnabledForChat()

> **isTelegramFunnelEventsEnabledForChat**(`chatId?`): `boolean`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:305](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L305)

#### Parameters

##### chatId?

`string` | `null`

#### Returns

`boolean`

***

### isTelegramFunnelMetricsEnabled()

> **isTelegramFunnelMetricsEnabled**(): `boolean`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:313](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L313)

#### Returns

`boolean`

***

### isTelegramFunnelMetricsEnabledForChat()

> **isTelegramFunnelMetricsEnabledForChat**(`chatId?`): `boolean`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:317](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L317)

#### Parameters

##### chatId?

`string` | `null`

#### Returns

`boolean`

***

### mapHolderRoomMemberRow()

> **mapHolderRoomMemberRow**(`row`): [`TelegramHolderRoomMember`](#telegramholderroommember)

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:567](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L567)

#### Parameters

##### row

`any`

#### Returns

[`TelegramHolderRoomMember`](#telegramholderroommember)

***

### mapHolderRoomPolicyRow()

> **mapHolderRoomPolicyRow**(`row`): [`TelegramHolderRoomPolicy`](#telegramholderroompolicy)

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:554](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L554)

#### Parameters

##### row

`any`

#### Returns

[`TelegramHolderRoomPolicy`](#telegramholderroompolicy)

***

### mapTelegramActiveMessageRow()

> **mapTelegramActiveMessageRow**(`row`): [`TelegramActiveMessage`](#telegramactivemessage) \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:609](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L609)

#### Parameters

##### row

`any`

#### Returns

[`TelegramActiveMessage`](#telegramactivemessage) \| `null`

***

### mapTelegramInlineSignalFeedRow()

> **mapTelegramInlineSignalFeedRow**(`row`): [`TelegramInlineSignalFeed`](#telegraminlinesignalfeed)

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:595](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L595)

#### Parameters

##### row

`any`

#### Returns

[`TelegramInlineSignalFeed`](#telegraminlinesignalfeed)

***

### mapTradePercentPromptRow()

> **mapTradePercentPromptRow**(`row`): [`TelegramTradePercentPrompt`](#telegramtradepercentprompt)

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:582](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L582)

#### Parameters

##### row

`any`

#### Returns

[`TelegramTradePercentPrompt`](#telegramtradepercentprompt)

***

### normalizeAddress()

> **normalizeAddress**(`value`): `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:356](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L356)

#### Parameters

##### value

`unknown`

#### Returns

`string`

***

### normalizeHolderRoomMemberStatus()

> **normalizeHolderRoomMemberStatus**(`value`): [`TelegramHolderRoomMemberStatus`](#telegramholderroommemberstatus-1)

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:376](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L376)

#### Parameters

##### value

`unknown`

#### Returns

[`TelegramHolderRoomMemberStatus`](#telegramholderroommemberstatus-1)

***

### normalizeMiniAppInitDataHash()

> **normalizeMiniAppInitDataHash**(`value`): `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:361](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L361)

#### Parameters

##### value

`unknown`

#### Returns

`string`

***

### normalizeRawAmount()

> **normalizeRawAmount**(`value`): `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:366](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L366)

#### Parameters

##### value

`unknown`

#### Returns

`string`

***

### normalizeTelegramUserId()

> **normalizeTelegramUserId**(`value`): `bigint` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:325](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L325)

#### Parameters

##### value

`string` | `number` | `bigint`

#### Returns

`bigint` \| `null`

***

### normalizeTradeActionType()

> **normalizeTradeActionType**(`value`): [`TelegramTradePercentPromptAction`](#telegramtradepercentpromptaction)

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:383](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L383)

#### Parameters

##### value

`unknown`

#### Returns

[`TelegramTradePercentPromptAction`](#telegramtradepercentpromptaction)

***

### parseBoolean()

> **parseBoolean**(`value`, `defaultValue`): `boolean`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:274](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L274)

#### Parameters

##### value

`unknown`

##### defaultValue

`boolean`

#### Returns

`boolean`

***

### parseCsvSet()

> **parseCsvSet**(`raw`): `Set`\<`string`\>

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:282](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L282)

#### Parameters

##### raw

`string`

#### Returns

`Set`\<`string`\>

***

### parseGraceHours()

> **parseGraceHours**(`value`, `fallback`): `number`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:390](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L390)

#### Parameters

##### value

`unknown`

##### fallback

`number` = `24`

#### Returns

`number`

***

### parseJsonObject()

> **parseJsonObject**(`value`): `Record`\<`string`, `any`\>

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:344](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L344)

#### Parameters

##### value

`unknown`

#### Returns

`Record`\<`string`, `any`\>

***

### parseTelegramLinkStartTokenRaw()

> **parseTelegramLinkStartTokenRaw**(`token`): [`TelegramLinkStartTokenRawPayload`](#telegramlinkstarttokenrawpayload) \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:451](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L451)

#### Parameters

##### token

`string`

#### Returns

[`TelegramLinkStartTokenRawPayload`](#telegramlinkstarttokenrawpayload) \| `null`

***

### readTelegramFunnelMetricsRolloutChatIds()

> **readTelegramFunnelMetricsRolloutChatIds**(): `Set`\<`string`\>

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:295](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L295)

#### Returns

`Set`\<`string`\>

***

### readTelegramFunnelRolloutChatIds()

> **readTelegramFunnelRolloutChatIds**(): `Set`\<`string`\>

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:291](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L291)

#### Returns

`Set`\<`string`\>

***

### readTelegramLinkStartToken()

> **readTelegramLinkStartToken**(`token`): [`TelegramLinkStartTokenPayload`](#telegramlinkstarttokenpayload) \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:519](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L519)

#### Parameters

##### token

`string`

#### Returns

[`TelegramLinkStartTokenPayload`](#telegramlinkstarttokenpayload) \| `null`

***

### readTelegramLinkStartTokenStatus()

> **readTelegramLinkStartTokenStatus**(`token`): [`TelegramLinkStartTokenReadResult`](#telegramlinkstarttokenreadresult)

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:531](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L531)

#### Parameters

##### token

`string`

#### Returns

[`TelegramLinkStartTokenReadResult`](#telegramlinkstarttokenreadresult)

***

### signTelegramLinkPayload()

> **signTelegramLinkPayload**(`payloadB64`): `string`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:435](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L435)

#### Parameters

##### payloadB64

`string`

#### Returns

`string`

***

### toIso()

> **toIso**(`value`): `string` \| `null`

Defined in: [server/\_lib/messaging/telegramTradingHelpers.ts:335](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/telegramTradingHelpers.ts#L335)

#### Parameters

##### value

`unknown`

#### Returns

`string` \| `null`
