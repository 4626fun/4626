[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/chatBridge

# server/\_lib/alfaclub/chatBridge

## Type Aliases

### AlfaClubChatBridgeFlags

> **AlfaClubChatBridgeFlags** = `object`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:139](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L139)

#### Properties

##### apiBaseUrl

> **apiBaseUrl**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:146](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L146)

##### apiProxySecret

> **apiProxySecret**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:194](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L194)

Shared secret sent only to the configured proxy. Never forwarded
to AlfaClub directly.

##### apiProxyUrl

> **apiProxyUrl**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:189](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L189)

Optional proxy origin for AlfaClub HTTP API calls
(`/api/websocket/room_history_paginate` +
`/api/websocket/update_read_msg` + optional
`/api/room/:roomId/message` passthrough).

Why this exists: AlfaClub's API origin is fronted by Cloudflare,
which has been observed to 403 (CF error 1010) requests from
Vercel's serverless egress IPs even with a fully-spec'd browser
fingerprint (see PR #491 + this PR). When that happens, an
operator can stand up a tiny relay (Cloudflare Worker, fly.io,
Railway service that does NOT enable
`ALFACLUB_CHAT_BRIDGE_ENABLED`, etc.) and point the Vercel
bridge at it via `ALFACLUB_CHAT_API_PROXY_URL`.

Contract for the proxy:
  - Accept GET `/api/websocket/room_history_paginate?...` and
    POST `/api/websocket/update_read_msg` at the same paths.
  - Pass the request through unchanged (same query, same
    Authorization header, same body, SAME `Origin`/`Referer`/
    `Sec-Fetch-Site` headers) to `https://api.alfaclub.app`.
  - Return the upstream response unchanged (status, headers,
    JSON body).
  - Command replies still execute on Vercel. Proxies MAY
    passthrough `/api/room/:roomId/message`; if not, the bridge
    falls back to direct upstream sends when it sees
    `path_not_allowed`.

Routing-vs-fingerprint contract: even when this proxy is set,
the bridge keeps the upstream AlfaClub browser-fingerprint
triplet (`Origin: https://alfaclub.app`, `Referer:
https://alfaclub.app/`, `Sec-Fetch-Site: same-site`) on the
outgoing request so the upstream Cloudflare WAF on
`api.alfaclub.app` sees the same fingerprint it would on a
direct call. The proxy's job is byte-faithful forwarding to
the upstream — it MUST NOT strip, rewrite, or override the
`Origin`/`Referer`/`Sec-Fetch-Site` headers (doing so would
weaken the fingerprint and re-trigger the original 1010 ban).

Set as `https://relay.example.com` (origin only). When unset,
the bridge calls `apiBaseUrl` directly.

##### botToken

> **botToken**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:145](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L145)

##### enabled

> **enabled**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:141](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L141)

##### groupId

> **groupId**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:196](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L196)

##### historyLimit

> **historyLimit**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:198](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L198)

##### ingestJwt

> **ingestJwt**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:144](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L144)

##### jwt

> **jwt**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:143](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L143)

##### killSwitch

> **killSwitch**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:140](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L140)

##### pollIntervalMs

> **pollIntervalMs**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:197](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L197)

##### requestTimeoutMs

> **requestTimeoutMs**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:200](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L200)

##### roomId

> **roomId**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:142](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L142)

##### sendTimeoutMs

> **sendTimeoutMs**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:199](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L199)

##### telegramRelayBotToken

> **telegramRelayBotToken**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:204](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L204)

##### telegramRelayChatId

> **telegramRelayChatId**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:205](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L205)

##### telegramRelayEnabled

> **telegramRelayEnabled**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:203](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L203)

##### telegramRelayThreadId

> **telegramRelayThreadId**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:206](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L206)

##### websocketUrl

> **websocketUrl**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:195](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L195)

##### wsIngestAllRoomsEnabled

> **wsIngestAllRoomsEnabled**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:202](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L202)

##### wsLiveFallbackEnabled

> **wsLiveFallbackEnabled**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:201](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L201)

***

### AlfaClubChatBridgeSkipReason

> **AlfaClubChatBridgeSkipReason** = `"kill_switch"` \| `"disabled"` \| `"railway_blocked"` \| `"env_missing"` \| `"already_running"`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:228](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L228)

***

### AlfaClubChatBridgeTickResult

> **AlfaClubChatBridgeTickResult** = `object`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:235](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L235)

#### Properties

##### errors

> **errors**: `object`[]

Defined in: [server/\_lib/alfaclub/chatBridge.ts:242](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L242)

###### error

> **error**: `string`

###### messageId

> **messageId**: `string`

##### fetched

> **fetched**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:238](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L238)

##### processed

> **processed**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:240](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L240)

##### replied

> **replied**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:241](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L241)

##### roomId

> **roomId**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:237](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L237)

##### seeded

> **seeded**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:236](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L236)

##### unseen

> **unseen**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:239](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L239)

***

### AlfaClubCommandMessage

> **AlfaClubCommandMessage** = `object`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:209](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L209)

#### Properties

##### date

> **date**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:211](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L211)

##### id

> **id**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:210](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L210)

##### sender

> **sender**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:212](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L212)

##### text

> **text**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:213](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L213)

***

### AlfaClubMessageAttachment

> **AlfaClubMessageAttachment** = `object`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:108](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L108)

#### Properties

##### dims?

> `optional` **dims**: \[`number`, `number`\]

Defined in: [server/\_lib/alfaclub/chatBridge.ts:110](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L110)

##### duration?

> `optional` **duration**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:116](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L116)

##### filename?

> `optional` **filename**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:112](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L112)

##### mime\_type?

> `optional` **mime\_type**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:113](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L113)

##### preview?

> `optional` **preview**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:115](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L115)

##### size?

> `optional` **size**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:114](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L114)

##### type

> **type**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:111](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L111)

##### url

> **url**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:109](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L109)

***

### RunAlfaClubChatBridgeTickOnceResult

> **RunAlfaClubChatBridgeTickOnceResult** = \{ `data`: [`AlfaClubChatBridgeTickResult`](#alfaclubchatbridgetickresult); `intervalMs`: `number`; `ok`: `true`; `roomId`: `string`; \} \| \{ `intervalMs`: `number`; `ok`: `false`; `reason`: [`AlfaClubChatBridgeSkipReason`](#alfaclubchatbridgeskipreason); `roomId`: `string` \| `null`; \}

Defined in: [server/\_lib/alfaclub/chatBridge.ts:253](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L253)

***

### RunBridgeTickOptions

> **RunBridgeTickOptions** = `object`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3049](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L3049)

#### Properties

##### ingestCommandCandidatesOnly?

> `optional` **ingestCommandCandidatesOnly**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3056](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L3056)

Cron mode: upsert only slash-command candidates into chat_ingest (less DB write churn).

##### seedHistoryOnlyOnFirstTick?

> `optional` **seedHistoryOnlyOnFirstTick**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3052](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L3052)

##### skipLiveWebSocket?

> `optional` **skipLiveWebSocket**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3054](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L3054)

Serverless cron: skip WS connect (no cross-invocation session). Default on via readAlfaClubCronSkipLiveWebSocket().

***

### StartAlfaClubChatBridgeResult

> **StartAlfaClubChatBridgeResult** = `object`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:245](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L245)

#### Properties

##### intervalMs

> **intervalMs**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:248](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L248)

##### reason?

> `optional` **reason**: [`AlfaClubChatBridgeSkipReason`](#alfaclubchatbridgeskipreason)

Defined in: [server/\_lib/alfaclub/chatBridge.ts:247](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L247)

##### roomId

> **roomId**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:249](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L249)

##### started

> **started**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:246](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L246)

##### stop()

> **stop**: () => `void`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:250](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L250)

###### Returns

`void`

## Variables

### \_ALFACLUB\_API\_BROWSER\_HEADERS\_FOR\_TESTS

> `const` **\_ALFACLUB\_API\_BROWSER\_HEADERS\_FOR\_TESTS**: `Record`\<`string`, `string`\> = `ALFACLUB_API_COMMON_BROWSER_HEADERS`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:1073](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L1073)

Exposed for unit tests — common (origin-agnostic) headers.

***

### \_shouldSuppressDeterministicReplyForTests()

> `const` **\_shouldSuppressDeterministicReplyForTests**: (`responseText`) => `boolean` = `shouldSuppressDeterministicReply`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:674](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L674)

Exposed for unit tests.

#### Parameters

##### responseText

`string`

#### Returns

`boolean`

## Functions

### \_classifyHistoryErrorForTests()

> **\_classifyHistoryErrorForTests**(`error`): `HistoryErrorKind`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3686](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L3686)

#### Parameters

##### error

`unknown`

#### Returns

`HistoryErrorKind`

***

### \_ensureLiveCommandSocketForTests()

> **\_ensureLiveCommandSocketForTests**(`params`): `void`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3873](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L3873)

#### Parameters

##### params

###### flags

[`AlfaClubChatBridgeFlags`](#alfaclubchatbridgeflags)

###### jwt

`string`

###### roomId

`string`

###### websocketUrl

`string`

#### Returns

`void`

***

### \_fetchRoomHistoryForTests()

> **\_fetchRoomHistoryForTests**(`params`): `Promise`\<`AlfaClubRoomHistoryMessage`[]\>

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3691](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L3691)

Test seam: exercise `fetchRoomHistory` against an injected fetch.

#### Parameters

##### params

###### apiBaseUrl

`string`

###### fingerprintBaseUrl?

`string`

###### jwt

`string`

###### limit

`number`

###### proxySecret?

`string` \| `null`

###### roomId

`string`

###### timeoutMs

`number`

#### Returns

`Promise`\<`AlfaClubRoomHistoryMessage`[]\>

***

### \_getBridgeAuthStateForTests()

> **\_getBridgeAuthStateForTests**(): `object`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3882](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L3882)

#### Returns

`object`

##### authFailFirstAt

> **authFailFirstAt**: `number` = `0`

##### authFailFlushTimer

> **authFailFlushTimer**: `RollupTimer`

##### authFailJwtSource

> **authFailJwtSource**: `BridgeJwtSource` \| `null`

##### authFailLastError

> **authFailLastError**: `string` \| `null`

##### authFailLastLoggedAt

> **authFailLastLoggedAt**: `number` = `Number.NEGATIVE_INFINITY`

##### authFailRepeats

> **authFailRepeats**: `number` = `0`

##### authFailRoomId

> **authFailRoomId**: `string` \| `null`

##### badJwtTtlMs

> **badJwtTtlMs**: `number` = `BAD_JWT_TTL_MS`

##### cfChallengeFirstAt

> **cfChallengeFirstAt**: `number` = `0`

##### cfChallengeFirstCfRay

> **cfChallengeFirstCfRay**: `string` \| `null`

##### cfChallengeFlushTimer

> **cfChallengeFlushTimer**: `RollupTimer`

##### cfChallengeLastCfRay

> **cfChallengeLastCfRay**: `string` \| `null`

##### cfChallengeLastHtmlErrorCode

> **cfChallengeLastHtmlErrorCode**: `string` \| `null`

##### cfChallengeRepeats

> **cfChallengeRepeats**: `number` = `0`

##### cfChallengeRoomId

> **cfChallengeRoomId**: `string` \| `null`

##### cfChallengeSustainedFlagged

> **cfChallengeSustainedFlagged**: `boolean` = `false`

##### lastBadJwt

> **lastBadJwt**: `string` \| `null`

##### lastBadJwtAt

> **lastBadJwtAt**: `number` = `0`

##### lastBadJwtWarnAt

> **lastBadJwtWarnAt**: `number` = `Number.NEGATIVE_INFINITY`

##### privyRefreshKickedThisTick

> **privyRefreshKickedThisTick**: `boolean` = `false`

##### socketBackoffMs

> **socketBackoffMs**: `number` = `0`

##### socketBackoffUntil

> **socketBackoffUntil**: `number` = `0`

##### wsBenignWindowByRoom

> **wsBenignWindowByRoom**: `Map`\<`string`, `number`[]\>

##### wsCloseAtMs

> **wsCloseAtMs**: `number`[]

##### wsCloseChurnLastLoggedAt

> **wsCloseChurnLastLoggedAt**: `number` = `Number.NEGATIVE_INFINITY`

##### wsErrorFirstAt

> **wsErrorFirstAt**: `number` = `0`

##### wsErrorFlushTimer

> **wsErrorFlushTimer**: `RollupTimer`

##### wsErrorLastCode

> **wsErrorLastCode**: `string` \| `null`

##### wsErrorLastErrno

> **wsErrorLastErrno**: `string` \| `null`

##### wsErrorLastHandshakeStatus

> **wsErrorLastHandshakeStatus**: `number` \| `null`

##### wsErrorLastLoggedAt

> **wsErrorLastLoggedAt**: `number` = `Number.NEGATIVE_INFINITY`

##### wsErrorLastMessage

> **wsErrorLastMessage**: `string` \| `null`

##### wsErrorLastPhase

> **wsErrorLastPhase**: `"connected"` \| `"unknown"` \| `"handshake"` \| `null`

##### wsErrorLastUpstream

> **wsErrorLastUpstream**: `string` \| `null`

##### wsErrorRepeats

> **wsErrorRepeats**: `number` = `0`

##### wsErrorRoomId

> **wsErrorRoomId**: `string` \| `null`

***

### \_isCloudflareChallengeErrorForTests()

> **\_isCloudflareChallengeErrorForTests**(`error`): `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3682](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L3682)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### \_isRoomHistoryAuthErrorForTests()

> **\_isRoomHistoryAuthErrorForTests**(`error`): `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3678](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L3678)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### \_markReadMessageForTests()

> **\_markReadMessageForTests**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3704](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L3704)

Test seam: exercise `markReadMessage` against an injected fetch.

#### Parameters

##### params

###### apiBaseUrl

`string`

###### fingerprintBaseUrl?

`string`

###### jwt

`string`

###### messageDate

`number`

###### proxySecret?

`string` \| `null`

###### roomId

`string`

###### timeoutMs

`number`

#### Returns

`Promise`\<`void`\>

***

### \_resetAlfaClubChatBridgeStateForTests()

> **\_resetAlfaClubChatBridgeStateForTests**(): `void`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3805](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L3805)

#### Returns

`void`

***

### \_runAlfaClubChatBridgeTickForTests()

> **\_runAlfaClubChatBridgeTickForTests**(`flags`, `options`): `Promise`\<[`AlfaClubChatBridgeTickResult`](#alfaclubchatbridgetickresult)\>

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3866](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L3866)

#### Parameters

##### flags

[`AlfaClubChatBridgeFlags`](#alfaclubchatbridgeflags)

##### options

[`RunBridgeTickOptions`](#runbridgetickoptions) = `{}`

#### Returns

`Promise`\<[`AlfaClubChatBridgeTickResult`](#alfaclubchatbridgetickresult)\>

***

### \_sendRoomMessageViaBotTokenForTests()

> **\_sendRoomMessageViaBotTokenForTests**(`params`): `Promise`\<`BotSendResultSummary`\>

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3716](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L3716)

#### Parameters

##### params

###### apiBaseUrl

`string`

###### botToken

`string`

###### idempotencyKey

`string`

###### proxySecret?

`string` \| `null`

###### replyToMessageId?

`string`

###### roomId

`string`

###### text

`string`

###### timeoutMs

`number`

#### Returns

`Promise`\<`BotSendResultSummary`\>

***

### \_sendRoomMessageViaBotTokenWithProxyFallbackForTests()

> **\_sendRoomMessageViaBotTokenWithProxyFallbackForTests**(`params`): `Promise`\<`BotSendResultSummary`\>

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3729](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L3729)

#### Parameters

##### params

###### apiBaseUrl

`string`

###### botToken

`string`

###### directApiBaseUrl

`string`

###### idempotencyKey

`string`

###### proxySecret?

`string` \| `null`

###### replyToMessageId?

`string`

###### roomId

`string`

###### text

`string`

###### timeoutMs

`number`

#### Returns

`Promise`\<`BotSendResultSummary`\>

***

### \_sendRoomMessageViaWebSocketForTests()

> **\_sendRoomMessageViaWebSocketForTests**(`params`): `Promise`\<`"ws_proxy_http"` \| `"websocket"`\>

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3743](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L3743)

#### Parameters

##### params

###### attachments?

`unknown`

###### jwt

`string`

###### replyToMessageId?

`string`

###### roomId

`string`

###### text

`string`

###### timeoutMs

`number`

###### websocketUrl

`string`

###### wsProxyHttpSendUrl?

`string` \| `null`

###### wsProxySecret?

`string` \| `null`

#### Returns

`Promise`\<`"ws_proxy_http"` \| `"websocket"`\>

***

### buildAlfaClubOutboundFrame()

> **buildAlfaClubOutboundFrame**(`params`): `AlfaClubOutboundFrame`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:530](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L530)

#### Parameters

##### params

###### attachments?

`unknown`

###### replyToMessageId?

`string`

###### roomId

`string`

###### text

`string`

#### Returns

`AlfaClubOutboundFrame`

***

### buildAlfaClubReactionFrame()

> **buildAlfaClubReactionFrame**(`params`): `AlfaClubReactionFrame`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:547](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L547)

#### Parameters

##### params

###### emoji

`string`

###### messageId

`string`

###### roomId

`string`

#### Returns

`AlfaClubReactionFrame`

***

### collectAlfaClubCommandMessages()

> **collectAlfaClubCommandMessages**(`params`): [`AlfaClubCommandMessage`](#alfaclubcommandmessage)[]

Defined in: [server/\_lib/alfaclub/chatBridge.ts:676](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L676)

#### Parameters

##### params

###### messages

`AlfaClubRoomHistoryMessage`[]

###### seenMessageIds

`ReadonlySet`\<`string`\>

###### selfAddress?

`string`

#### Returns

[`AlfaClubCommandMessage`](#alfaclubcommandmessage)[]

***

### extractAlfaClubWsMessagesForTest()

> **extractAlfaClubWsMessagesForTest**(`payload`): `AlfaClubLiveInboundMessage`[]

Defined in: [server/\_lib/alfaclub/chatBridge.ts:891](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L891)

#### Parameters

##### payload

`unknown`

#### Returns

`AlfaClubLiveInboundMessage`[]

***

### isHistoryMessageCommandCandidate()

> **isHistoryMessageCommandCandidate**(`message`): `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:626](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L626)

Whether a history row could trigger the deterministic command executor.

#### Parameters

##### message

`AlfaClubRoomHistoryMessage`

#### Returns

`boolean`

***

### readAlfaClubBridgeReactionsEnabled()

> **readAlfaClubBridgeReactionsEnabled**(): `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:562](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L562)

#### Returns

`boolean`

***

### readAlfaClubChatBridgeFlags()

> **readAlfaClubChatBridgeFlags**(): [`AlfaClubChatBridgeFlags`](#alfaclubchatbridgeflags)

Defined in: [server/\_lib/alfaclub/chatBridge.ts:436](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L436)

#### Returns

[`AlfaClubChatBridgeFlags`](#alfaclubchatbridgeflags)

***

### readAlfaClubChatBridgeFlagsForCronTick()

> **readAlfaClubChatBridgeFlagsForCronTick**(): [`AlfaClubChatBridgeFlags`](#alfaclubchatbridgeflags)

Defined in: [server/\_lib/alfaclub/chatBridge.ts:517](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L517)

#### Returns

[`AlfaClubChatBridgeFlags`](#alfaclubchatbridgeflags)

***

### readAlfaClubCronSkipLiveWebSocket()

> **readAlfaClubCronSkipLiveWebSocket**(): `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:511](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L511)

Vercel cron ticks cannot keep a live WS between invocations — skip by default.

#### Returns

`boolean`

***

### resolveAlfaClubApiCallBaseUrl()

> **resolveAlfaClubApiCallBaseUrl**(`flags`): `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:380](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L380)

Pick the URL the bridge should hit for an AlfaClub HTTP API call
(the *routing* URL — where the request is actually sent).

If the operator has configured `ALFACLUB_CHAT_API_PROXY_URL`, use
it (proxy must implement the same paths and forward to AlfaClub
— see the doc comment on `AlfaClubChatBridgeFlags.apiProxyUrl`).
Otherwise fall back to `apiBaseUrl` (typically
`https://api.alfaclub.app`).

NOTE: The routing URL is intentionally distinct from the
*fingerprint* base used to derive `Origin`/`Referer`/`Sec-Fetch-Site`
— see `resolveAlfaClubFingerprintBaseUrl`. With a proxy in front of
`https://api.alfaclub.app`, the request still represents itself as
coming from the alfaclub.app web client; the proxy forwards
unchanged, so the upstream Cloudflare WAF must see the same
browser-fingerprint headers it would on a direct call.

Exported for tests. Production callers always pass the full
`flags` object.

#### Parameters

##### flags

###### apiBaseUrl

`string`

###### apiProxyUrl

`string` \| `null`

#### Returns

`string`

***

### resolveAlfaClubFingerprintBaseUrl()

> **resolveAlfaClubFingerprintBaseUrl**(`flags`): `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:415](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L415)

Pick the URL whose hostname determines the browser-fingerprint
triplet (`Origin`/`Referer`/`Sec-Fetch-Site`) for an AlfaClub HTTP
API call.

Routing-vs-fingerprint separation: when
`ALFACLUB_CHAT_API_PROXY_URL` is configured the bridge sends the
HTTP request to the proxy (the routing URL), but the upstream
Cloudflare WAF on `api.alfaclub.app` still inspects the
`Origin`/`Referer`/`Sec-Fetch-Site` triplet. The proxy contract
(see `AlfaClubChatBridgeFlags.apiProxyUrl`) is "forward unchanged"
— so the fingerprint must be derived from the upstream AlfaClub
API base, not from the proxy origin (which would yield `{}` for
an unknown host and weaken the fingerprint).

Resolution order:
  - `apiBaseUrl` is always the canonical upstream AlfaClub base
    (defaults to `https://api.alfaclub.app`); use it as the
    fingerprint source.
  - When the operator points the bridge at a custom non-AlfaClub
    `apiBaseUrl` (staging API, localhost replay) with NO proxy,
    `resolveAlfaClubOriginHeaders` will return `{}` for the
    unknown host — preserving the safe behavior of not emitting
    a contradictory `Origin: https://alfaclub.app` to a host that
    has nothing to do with alfaclub.app.

Exported for tests.

#### Parameters

##### flags

###### apiBaseUrl

`string`

###### apiProxyUrl

`string` \| `null`

#### Returns

`string`

***

### resolveAlfaClubOriginHeaders()

> **resolveAlfaClubOriginHeaders**(`apiBaseUrl`): `AlfaClubOriginHeaders`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:994](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L994)

Resolve the origin/referer/Sec-Fetch-Site triplet for an AlfaClub
API request. Returns an empty object for hosts not on the known
AlfaClub-family list.

#### Parameters

##### apiBaseUrl

`string`

#### Returns

`AlfaClubOriginHeaders`

***

### runAlfaClubChatBridgeTickOnce()

> **runAlfaClubChatBridgeTickOnce**(): `Promise`\<[`RunAlfaClubChatBridgeTickOnceResult`](#runalfaclubchatbridgetickonceresult)\>

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3517](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L3517)

#### Returns

`Promise`\<[`RunAlfaClubChatBridgeTickOnceResult`](#runalfaclubchatbridgetickonceresult)\>

***

### sendAlfaClubRoomText()

> **sendAlfaClubRoomText**(`params`): `Promise`\<\{ `lane`: `string`; \}\>

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3757](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L3757)

#### Parameters

##### params

###### attachments?

`unknown`

###### flags?

[`AlfaClubChatBridgeFlags`](#alfaclubchatbridgeflags)

###### jwt?

`string` \| `null`

###### replyToMessageId?

`string`

###### roomId?

`string` \| `null`

###### text

`string`

#### Returns

`Promise`\<\{ `lane`: `string`; \}\>

***

### startAlfaClubChatBridge()

> **startAlfaClubChatBridge**(`opts?`): [`StartAlfaClubChatBridgeResult`](#startalfaclubchatbridgeresult)

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3565](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L3565)

#### Parameters

##### opts?

###### onError?

(`error`) => `void`

###### onTick?

(`result`) => `void`

#### Returns

[`StartAlfaClubChatBridgeResult`](#startalfaclubchatbridgeresult)
