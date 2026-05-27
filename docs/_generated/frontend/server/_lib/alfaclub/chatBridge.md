[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/chatBridge

# server/\_lib/alfaclub/chatBridge

## Type Aliases

### AlfaClubChatBridgeFlags

> **AlfaClubChatBridgeFlags** = `object`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:128](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L128)

#### Properties

##### apiBaseUrl

> **apiBaseUrl**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:135](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L135)

##### apiProxySecret

> **apiProxySecret**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:183](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L183)

Shared secret sent only to the configured proxy. Never forwarded
to AlfaClub directly.

##### apiProxyUrl

> **apiProxyUrl**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:178](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L178)

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

Defined in: [server/\_lib/alfaclub/chatBridge.ts:134](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L134)

##### enabled

> **enabled**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:130](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L130)

##### groupId

> **groupId**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:185](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L185)

##### historyLimit

> **historyLimit**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:187](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L187)

##### ingestJwt

> **ingestJwt**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:133](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L133)

##### jwt

> **jwt**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:132](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L132)

##### killSwitch

> **killSwitch**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:129](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L129)

##### pollIntervalMs

> **pollIntervalMs**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:186](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L186)

##### requestTimeoutMs

> **requestTimeoutMs**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:189](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L189)

##### roomId

> **roomId**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:131](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L131)

##### sendTimeoutMs

> **sendTimeoutMs**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:188](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L188)

##### telegramRelayBotToken

> **telegramRelayBotToken**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:193](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L193)

##### telegramRelayChatId

> **telegramRelayChatId**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:194](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L194)

##### telegramRelayEnabled

> **telegramRelayEnabled**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:192](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L192)

##### telegramRelayThreadId

> **telegramRelayThreadId**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:195](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L195)

##### websocketUrl

> **websocketUrl**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:184](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L184)

##### wsIngestAllRoomsEnabled

> **wsIngestAllRoomsEnabled**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:191](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L191)

##### wsLiveFallbackEnabled

> **wsLiveFallbackEnabled**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:190](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L190)

***

### AlfaClubChatBridgeSkipReason

> **AlfaClubChatBridgeSkipReason** = `"kill_switch"` \| `"disabled"` \| `"railway_blocked"` \| `"env_missing"` \| `"already_running"`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:216](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L216)

***

### AlfaClubChatBridgeTickResult

> **AlfaClubChatBridgeTickResult** = `object`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:223](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L223)

#### Properties

##### errors

> **errors**: `object`[]

Defined in: [server/\_lib/alfaclub/chatBridge.ts:230](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L230)

###### error

> **error**: `string`

###### messageId

> **messageId**: `string`

##### fetched

> **fetched**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:226](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L226)

##### processed

> **processed**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:228](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L228)

##### replied

> **replied**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:229](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L229)

##### roomId

> **roomId**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:225](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L225)

##### seeded

> **seeded**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:224](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L224)

##### unseen

> **unseen**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:227](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L227)

***

### AlfaClubCommandMessage

> **AlfaClubCommandMessage** = `object`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:198](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L198)

#### Properties

##### date

> **date**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:200](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L200)

##### id

> **id**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:199](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L199)

##### sender

> **sender**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:201](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L201)

##### text

> **text**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:202](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L202)

***

### AlfaClubMessageAttachment

> **AlfaClubMessageAttachment** = `object`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:107](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L107)

#### Properties

##### dims?

> `optional` **dims**: \[`number`, `number`\]

Defined in: [server/\_lib/alfaclub/chatBridge.ts:109](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L109)

##### duration?

> `optional` **duration**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:115](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L115)

##### filename?

> `optional` **filename**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:111](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L111)

##### mime\_type?

> `optional` **mime\_type**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:112](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L112)

##### preview?

> `optional` **preview**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:114](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L114)

##### size?

> `optional` **size**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:113](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L113)

##### type

> **type**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:110](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L110)

##### url

> **url**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:108](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L108)

***

### RunAlfaClubChatBridgeTickOnceResult

> **RunAlfaClubChatBridgeTickOnceResult** = \{ `data`: [`AlfaClubChatBridgeTickResult`](#alfaclubchatbridgetickresult); `intervalMs`: `number`; `ok`: `true`; `roomId`: `string`; \} \| \{ `intervalMs`: `number`; `ok`: `false`; `reason`: [`AlfaClubChatBridgeSkipReason`](#alfaclubchatbridgeskipreason); `roomId`: `string` \| `null`; \}

Defined in: [server/\_lib/alfaclub/chatBridge.ts:241](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L241)

***

### StartAlfaClubChatBridgeResult

> **StartAlfaClubChatBridgeResult** = `object`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:233](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L233)

#### Properties

##### intervalMs

> **intervalMs**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:236](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L236)

##### reason?

> `optional` **reason**: [`AlfaClubChatBridgeSkipReason`](#alfaclubchatbridgeskipreason)

Defined in: [server/\_lib/alfaclub/chatBridge.ts:235](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L235)

##### roomId

> **roomId**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:237](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L237)

##### started

> **started**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:234](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L234)

##### stop()

> **stop**: () => `void`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:238](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L238)

###### Returns

`void`

## Variables

### \_ALFACLUB\_API\_BROWSER\_HEADERS\_FOR\_TESTS

> `const` **\_ALFACLUB\_API\_BROWSER\_HEADERS\_FOR\_TESTS**: `Record`\<`string`, `string`\> = `ALFACLUB_API_COMMON_BROWSER_HEADERS`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:991](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L991)

Exposed for unit tests — common (origin-agnostic) headers.

***

### \_shouldSuppressDeterministicReplyForTests()

> `const` **\_shouldSuppressDeterministicReplyForTests**: (`responseText`) => `boolean` = `shouldSuppressDeterministicReply`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:607](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L607)

Exposed for unit tests.

#### Parameters

##### responseText

`string`

#### Returns

`boolean`

## Functions

### \_classifyHistoryErrorForTests()

> **\_classifyHistoryErrorForTests**(`error`): `HistoryErrorKind`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3256](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L3256)

#### Parameters

##### error

`unknown`

#### Returns

`HistoryErrorKind`

***

### \_ensureLiveCommandSocketForTests()

> **\_ensureLiveCommandSocketForTests**(`params`): `void`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3442](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L3442)

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

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3261](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L3261)

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

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3451](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L3451)

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

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3252](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L3252)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### \_isRoomHistoryAuthErrorForTests()

> **\_isRoomHistoryAuthErrorForTests**(`error`): `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3248](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L3248)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### \_markReadMessageForTests()

> **\_markReadMessageForTests**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3274](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L3274)

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

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3375](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L3375)

#### Returns

`void`

***

### \_runAlfaClubChatBridgeTickForTests()

> **\_runAlfaClubChatBridgeTickForTests**(`flags`): `Promise`\<[`AlfaClubChatBridgeTickResult`](#alfaclubchatbridgetickresult)\>

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3436](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L3436)

#### Parameters

##### flags

[`AlfaClubChatBridgeFlags`](#alfaclubchatbridgeflags)

#### Returns

`Promise`\<[`AlfaClubChatBridgeTickResult`](#alfaclubchatbridgetickresult)\>

***

### \_sendRoomMessageViaBotTokenForTests()

> **\_sendRoomMessageViaBotTokenForTests**(`params`): `Promise`\<`BotSendResultSummary`\>

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3286](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L3286)

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

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3299](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L3299)

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

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3313](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L3313)

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

Defined in: [server/\_lib/alfaclub/chatBridge.ts:498](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L498)

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

### collectAlfaClubCommandMessages()

> **collectAlfaClubCommandMessages**(`params`): [`AlfaClubCommandMessage`](#alfaclubcommandmessage)[]

Defined in: [server/\_lib/alfaclub/chatBridge.ts:609](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L609)

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

Defined in: [server/\_lib/alfaclub/chatBridge.ts:823](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L823)

#### Parameters

##### payload

`unknown`

#### Returns

`AlfaClubLiveInboundMessage`[]

***

### readAlfaClubChatBridgeFlags()

> **readAlfaClubChatBridgeFlags**(): [`AlfaClubChatBridgeFlags`](#alfaclubchatbridgeflags)

Defined in: [server/\_lib/alfaclub/chatBridge.ts:424](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L424)

#### Returns

[`AlfaClubChatBridgeFlags`](#alfaclubchatbridgeflags)

***

### resolveAlfaClubApiCallBaseUrl()

> **resolveAlfaClubApiCallBaseUrl**(`flags`): `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:368](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L368)

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

Defined in: [server/\_lib/alfaclub/chatBridge.ts:403](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L403)

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

Defined in: [server/\_lib/alfaclub/chatBridge.ts:912](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L912)

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

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3091](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L3091)

#### Returns

`Promise`\<[`RunAlfaClubChatBridgeTickOnceResult`](#runalfaclubchatbridgetickonceresult)\>

***

### sendAlfaClubRoomText()

> **sendAlfaClubRoomText**(`params`): `Promise`\<\{ `lane`: `string`; \}\>

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3327](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L3327)

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

Defined in: [server/\_lib/alfaclub/chatBridge.ts:3135](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chatBridge.ts#L3135)

#### Parameters

##### opts?

###### onError?

(`error`) => `void`

###### onTick?

(`result`) => `void`

#### Returns

[`StartAlfaClubChatBridgeResult`](#startalfaclubchatbridgeresult)
