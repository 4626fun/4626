[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/authHealthStore

# server/\_lib/alfaclub/authHealthStore

## Type Aliases

### AlfaClubAuthHealthSnapshot

> **AlfaClubAuthHealthSnapshot** = `object`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:558](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L558)

#### Properties

##### bridge

> **bridge**: [`AlfaClubBridgeAuthHealthSnapshot`](#alfaclubbridgeauthhealthsnapshot)

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:585](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L585)

##### lastFailure

> **lastFailure**: [`RefreshFailurePayload`](#refreshfailurepayload) & `object` \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:572](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L572)

##### lastSuccess

> **lastSuccess**: [`RefreshSuccessPayload`](#refreshsuccesspayload) & `object` \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:559](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L559)

##### liveChatJwt

> **liveChatJwt**: \{ `expiresAt`: `string` \| `null`; `minutesUntilExpiry`: `number` \| `null`; `updatedAt`: `string` \| `null`; `writer`: `string` \| `null`; `writerAnomaly`: [`WriterAnomaly`](#writeranomaly); \} \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:578](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L578)

Snapshot of the chat_jwt row's writer + expiry, so the health endpoint
can surface anomalies on the live token row even when the most recent
refresh succeeded (e.g. a downstream writer overwrote the slot).

***

### AlfaClubBridgeAuthHealthSnapshot

> **AlfaClubBridgeAuthHealthSnapshot** = `object`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:51](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L51)

#### Properties

##### cfChallengeSustained

> **cfChallengeSustained**: `boolean`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:56](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L56)

##### consecutiveAuthFailures

> **consecutiveAuthFailures**: `number`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:53](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L53)

##### consecutiveCfChallenges

> **consecutiveCfChallenges**: `number`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:55](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L55)

##### lastAuthFailAt

> **lastAuthFailAt**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:52](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L52)

##### lastCfChallengeAt

> **lastCfChallengeAt**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:54](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L54)

##### lastProxyFallbackDirectAt

> **lastProxyFallbackDirectAt**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:58](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L58)

##### proxyFallbackDirectCount

> **proxyFallbackDirectCount**: `number`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:57](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L57)

##### socketBackoffMs

> **socketBackoffMs**: `number`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:60](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L60)

##### suppressedSocketAttempts

> **suppressedSocketAttempts**: `number`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:59](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L59)

***

### RefreshFailurePayload

> **RefreshFailurePayload** = `object`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:197](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L197)

#### Properties

##### at

> **at**: `string`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:198](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L198)

##### detail

> **detail**: `string`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:202](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L202)

Already-redacted short label, never the raw error.

##### errorCode

> **errorCode**: `string`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:200](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L200)

##### status

> **status**: `"error"` \| `"missing_tokens"`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:199](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L199)

***

### RefreshSuccessPayload

> **RefreshSuccessPayload** = `object`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:177](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L177)

#### Properties

##### accessTokenExp

> **accessTokenExp**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:192](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L192)

ISO timestamp when the Privy ACCESS token (the bearer the refresher
sends to `https://auth.privy.io/api/v1/sessions`) expires. The
access token has its own ~1h TTL and can age out independently of
the identity token when Privy returns `privy_access_token: null`
for one or more refresh cycles. Surfacing this lets monitors alert
before a Privy 400 `missing_or_invalid_token` cliff (see incident
2026-05-01).

`null` when the bundle's access token has no decodable `exp`
claim (defensive — Privy access tokens are JWTs in practice).

##### at

> **at**: `string`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:178](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L178)

##### identityTokenExp

> **identityTokenExp**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:179](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L179)

##### rotatedRefresh

> **rotatedRefresh**: `boolean`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:194](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L194)

##### writer

> **writer**: `string`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:193](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L193)

***

### WriterAnomaly

> **WriterAnomaly** = `object`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:112](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L112)

#### Properties

##### isAnomalous

> **isAnomalous**: `boolean`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:113](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L113)

##### reason

> **reason**: `"unknown_writer"` \| `"legacy_in_process_refresher"` \| `"empty_writer"` \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:114](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L114)

##### writer

> **writer**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:119](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L119)

## Variables

### \_HEALTH\_KEYS\_FOR\_TESTS

> `const` **\_HEALTH\_KEYS\_FOR\_TESTS**: `object`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:678](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L678)

For tests only — health row keys.

#### Type Declaration

##### BRIDGE

> **BRIDGE**: `"chat_auth_health:bridge"` = `HEALTH_KEY_BRIDGE`

##### LAST\_FAILURE

> **LAST\_FAILURE**: `"chat_auth_health:last_failure"` = `HEALTH_KEY_LAST_FAILURE`

##### LAST\_SUCCESS

> **LAST\_SUCCESS**: `"chat_auth_health:last_success"` = `HEALTH_KEY_LAST_SUCCESS`

## Functions

### \_resetBridgeAuthHealthForTests()

> **\_resetBridgeAuthHealthForTests**(): `void`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:663](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L663)

#### Returns

`void`

***

### buildRefreshFailurePayload()

> **buildRefreshFailurePayload**(`params`): [`RefreshFailurePayload`](#refreshfailurepayload)

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:309](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L309)

#### Parameters

##### params

###### at

`string`

###### rawError

`string`

###### status

`"error"` \| `"missing_tokens"`

#### Returns

[`RefreshFailurePayload`](#refreshfailurepayload)

***

### buildRefreshSuccessPayload()

> **buildRefreshSuccessPayload**(`params`): [`RefreshSuccessPayload`](#refreshsuccesspayload)

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:205](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L205)

#### Parameters

##### params

###### accessTokenExpIso?

`string` \| `null`

###### at

`string`

###### identityTokenExpIso

`string` \| `null`

###### rotatedRefresh

`boolean`

###### writer

`string`

#### Returns

[`RefreshSuccessPayload`](#refreshsuccesspayload)

***

### classifyRefreshError()

> **classifyRefreshError**(`rawError`): `object`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:259](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L259)

Reduce a free-form refresher error message to a stable short code that
is safe to persist and surface from the health endpoint. Preserves the
fingerprintable `privy_refresh_failed:<status>` prefix when present and
truncates everything else through `redactTokenMaterial`.

When the Privy response body includes a recognised `code` (e.g.
`missing_or_invalid_token`, `invalid_refresh_token`), it is appended
to the error code as a third segment so monitors can distinguish
bearer-vs-refresh rejection without parsing the detail string.

#### Parameters

##### rawError

`string`

#### Returns

`object`

##### detail

> **detail**: `string`

##### errorCode

> **errorCode**: `string`

***

### evaluateWriterAnomaly()

> **evaluateWriterAnomaly**(`updatedBy`): [`WriterAnomaly`](#writeranomaly)

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:126](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L126)

Classifies an `updated_by` string against the single-writer invariant.
Pure function — no IO, safe to call from anywhere including tests.

#### Parameters

##### updatedBy

`string` | `null` | `undefined`

#### Returns

[`WriterAnomaly`](#writeranomaly)

***

### readAuthHealthSnapshot()

> **readAuthHealthSnapshot**(`params?`): `Promise`\<[`AlfaClubAuthHealthSnapshot`](#alfaclubauthhealthsnapshot)\>

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:598](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L598)

#### Parameters

##### params?

###### liveChatJwt?

\{ `expiresAtIso`: `string` \| `null`; `jwt`: `string` \| `null`; `updatedAt`: `string` \| `null`; `updatedBy`: `string` \| `null`; \} \| `null`

Live `chat_jwt` row metadata, looked up by the caller (we read it
here so the endpoint and the bridge tick share one query path).

###### now?

() => `number`

#### Returns

`Promise`\<[`AlfaClubAuthHealthSnapshot`](#alfaclubauthhealthsnapshot)\>

***

### readBridgeAuthHealthSnapshot()

> **readBridgeAuthHealthSnapshot**(): [`AlfaClubBridgeAuthHealthSnapshot`](#alfaclubbridgeauthhealthsnapshot)

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:480](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L480)

Synchronous, in-memory snapshot. Used by the bridge itself (same
process as the writes) and by tests. Cross-process readers should use
`readBridgeAuthHealthSnapshotFromStorage`.

#### Returns

[`AlfaClubBridgeAuthHealthSnapshot`](#alfaclubbridgeauthhealthsnapshot)

***

### readBridgeAuthHealthSnapshotFromStorage()

> **readBridgeAuthHealthSnapshotFromStorage**(): `Promise`\<[`AlfaClubBridgeAuthHealthSnapshot`](#alfaclubbridgeauthhealthsnapshot)\>

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:526](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L526)

Cross-process read path. Loads the bridge counters from the shared
`chat_auth_health:bridge` row. When shared storage is not reachable
(no DB binding, transient outage), falls back to the in-memory cache
and warn-logs once per process so the failure is observable without
spamming the log.

#### Returns

`Promise`\<[`AlfaClubBridgeAuthHealthSnapshot`](#alfaclubbridgeauthhealthsnapshot)\>

***

### recordBridgeAuthFailure()

> **recordBridgeAuthFailure**(`at`): `void`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:431](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L431)

#### Parameters

##### at

`string` = `...`

#### Returns

`void`

***

### recordBridgeCfChallenge()

> **recordBridgeCfChallenge**(`at`, `sustained`): `void`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:442](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L442)

#### Parameters

##### at

`string` = `...`

##### sustained

`boolean` = `false`

#### Returns

`void`

***

### recordBridgeCfChallengeRecovered()

> **recordBridgeCfChallengeRecovered**(): `void`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:452](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L452)

#### Returns

`void`

***

### recordBridgeHistorySuccess()

> **recordBridgeHistorySuccess**(): `void`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:437](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L437)

#### Returns

`void`

***

### recordBridgeProxyFallbackDirect()

> **recordBridgeProxyFallbackDirect**(`at`): `void`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:469](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L469)

#### Parameters

##### at

`string` = `...`

#### Returns

`void`

***

### recordBridgeSocketBackoff()

> **recordBridgeSocketBackoff**(`socketBackoffMs`): `void`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:464](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L464)

#### Parameters

##### socketBackoffMs

`number`

#### Returns

`void`

***

### recordBridgeSuppressedSocketAttempt()

> **recordBridgeSuppressedSocketAttempt**(): `void`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:459](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L459)

#### Returns

`void`

***

### recordRefreshFailure()

> **recordRefreshFailure**(`payload`, `writer`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:414](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L414)

#### Parameters

##### payload

[`RefreshFailurePayload`](#refreshfailurepayload)

##### writer

`string`

#### Returns

`Promise`\<`boolean`\>

***

### recordRefreshSuccess()

> **recordRefreshSuccess**(`payload`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:407](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L407)

#### Parameters

##### payload

[`RefreshSuccessPayload`](#refreshsuccesspayload)

#### Returns

`Promise`\<`boolean`\>

***

### redactTokenMaterial()

> **redactTokenMaterial**(`input`): `string`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:161](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/authHealthStore.ts#L161)

Defensive redactor. Strips JWT-shaped substrings (`xxx.yyy.zzz`),
`Bearer ...` headers, and obvious base64url runs. The error strings
surfaced by the refresher already trim Privy's response body to 200
chars and never include the token material we sent — this is a second
line of defense in case a future change accidentally widens the
passthrough.

#### Parameters

##### input

`string`

#### Returns

`string`
