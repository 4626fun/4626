[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/authHealthStore

# server/\_lib/alfaclub/authHealthStore

## Type Aliases

### AlfaClubAuthHealthSnapshot

> **AlfaClubAuthHealthSnapshot** = `object`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:630](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L630)

#### Properties

##### bridge

> **bridge**: [`AlfaClubBridgeAuthHealthSnapshot`](#alfaclubbridgeauthhealthsnapshot)

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:658](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L658)

##### dbEnvStaleness

> **dbEnvStaleness**: [`DbEnvStalenessWarning`](#dbenvstalenesswarning) \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:631](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L631)

##### lastFailure

> **lastFailure**: [`RefreshFailurePayload`](#refreshfailurepayload) & `object` \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:645](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L645)

##### lastSuccess

> **lastSuccess**: [`RefreshSuccessPayload`](#refreshsuccesspayload) & `object` \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:632](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L632)

##### liveChatJwt

> **liveChatJwt**: \{ `expiresAt`: `string` \| `null`; `minutesUntilExpiry`: `number` \| `null`; `updatedAt`: `string` \| `null`; `writer`: `string` \| `null`; `writerAnomaly`: [`WriterAnomaly`](#writeranomaly); \} \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:651](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L651)

Snapshot of the chat_jwt row's writer + expiry, so the health endpoint
can surface anomalies on the live token row even when the most recent
refresh succeeded (e.g. a downstream writer overwrote the slot).

***

### AlfaClubBridgeAuthHealthSnapshot

> **AlfaClubBridgeAuthHealthSnapshot** = `object`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L54)

#### Properties

##### cfChallengeSustained

> **cfChallengeSustained**: `boolean`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:59](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L59)

##### consecutiveAuthFailures

> **consecutiveAuthFailures**: `number`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L56)

##### consecutiveCfChallenges

> **consecutiveCfChallenges**: `number`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:58](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L58)

##### lastAuthFailAt

> **lastAuthFailAt**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:55](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L55)

##### lastCfChallengeAt

> **lastCfChallengeAt**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:57](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L57)

##### lastProxyFallbackDirectAt

> **lastProxyFallbackDirectAt**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:61](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L61)

##### proxyFallbackDirectCount

> **proxyFallbackDirectCount**: `number`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:60](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L60)

##### socketBackoffMs

> **socketBackoffMs**: `number`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:63](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L63)

##### suppressedSocketAttempts

> **suppressedSocketAttempts**: `number`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:62](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L62)

***

### DbEnvStalenessWarning

> **DbEnvStalenessWarning** = `object`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:562](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L562)

#### Properties

##### access

> **access**: \{ `dbExpiresAt`: `string` \| `null`; `envConfigured`: `boolean`; `envExpiresAt`: `string` \| `null`; \} \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:569](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L569)

##### hint

> **hint**: `string`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:574](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L574)

##### identity

> **identity**: \{ `dbExpiresAt`: `string` \| `null`; `envConfigured`: `boolean`; `envExpiresAt`: `string` \| `null`; \} \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:564](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L564)

##### kind

> **kind**: `"db_lags_env"`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:563](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L563)

***

### RefreshFailurePayload

> **RefreshFailurePayload** = `object`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:201](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L201)

#### Properties

##### at

> **at**: `string`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:202](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L202)

##### detail

> **detail**: `string`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:206](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L206)

Already-redacted short label, never the raw error.

##### errorCode

> **errorCode**: `string`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:204](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L204)

##### status

> **status**: `"error"` \| `"missing_tokens"`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:203](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L203)

***

### RefreshSuccessPayload

> **RefreshSuccessPayload** = `object`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:181](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L181)

#### Properties

##### accessTokenExp

> **accessTokenExp**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:196](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L196)

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

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:182](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L182)

##### identityTokenExp

> **identityTokenExp**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:183](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L183)

##### rotatedRefresh

> **rotatedRefresh**: `boolean`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:198](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L198)

##### writer

> **writer**: `string`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:197](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L197)

***

### WriterAnomaly

> **WriterAnomaly** = `object`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:116](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L116)

#### Properties

##### isAnomalous

> **isAnomalous**: `boolean`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:117](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L117)

##### reason

> **reason**: `"unknown_writer"` \| `"legacy_in_process_refresher"` \| `"empty_writer"` \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:118](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L118)

##### writer

> **writer**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:123](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L123)

## Variables

### \_HEALTH\_KEYS\_FOR\_TESTS

> `const` **\_HEALTH\_KEYS\_FOR\_TESTS**: `object`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:763](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L763)

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

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:748](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L748)

#### Returns

`void`

***

### buildRefreshFailurePayload()

> **buildRefreshFailurePayload**(`params`): [`RefreshFailurePayload`](#refreshfailurepayload)

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:313](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L313)

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

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:209](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L209)

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

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:263](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L263)

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

### evaluateDbEnvStaleness()

> **evaluateDbEnvStaleness**(`params`): [`DbEnvStalenessWarning`](#dbenvstalenesswarning) \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:583](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L583)

Surfaces when Vercel env bootstrap JWTs expire later than the DB rows the
refresher actually reads (postmortem #16).

#### Parameters

##### params

###### dbAccessExpiresAt

`string` \| `null`

###### dbIdentityExpiresAt

`string` \| `null`

###### envAccessJwt

`string` \| `null`

###### envIdentityJwt

`string` \| `null`

###### slackMs?

`number`

#### Returns

[`DbEnvStalenessWarning`](#dbenvstalenesswarning) \| `null`

***

### evaluateWriterAnomaly()

> **evaluateWriterAnomaly**(`updatedBy`): [`WriterAnomaly`](#writeranomaly)

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:130](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L130)

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

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:671](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L671)

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

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:484](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L484)

Synchronous, in-memory snapshot. Used by the bridge itself (same
process as the writes) and by tests. Cross-process readers should use
`readBridgeAuthHealthSnapshotFromStorage`.

#### Returns

[`AlfaClubBridgeAuthHealthSnapshot`](#alfaclubbridgeauthhealthsnapshot)

***

### readBridgeAuthHealthSnapshotFromStorage()

> **readBridgeAuthHealthSnapshotFromStorage**(): `Promise`\<[`AlfaClubBridgeAuthHealthSnapshot`](#alfaclubbridgeauthhealthsnapshot)\>

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:530](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L530)

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

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:435](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L435)

#### Parameters

##### at

`string` = `...`

#### Returns

`void`

***

### recordBridgeCfChallenge()

> **recordBridgeCfChallenge**(`at`, `sustained`): `void`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:446](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L446)

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

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:456](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L456)

#### Returns

`void`

***

### recordBridgeHistorySuccess()

> **recordBridgeHistorySuccess**(): `void`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:441](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L441)

#### Returns

`void`

***

### recordBridgeProxyFallbackDirect()

> **recordBridgeProxyFallbackDirect**(`at`): `void`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:473](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L473)

#### Parameters

##### at

`string` = `...`

#### Returns

`void`

***

### recordBridgeSocketBackoff()

> **recordBridgeSocketBackoff**(`socketBackoffMs`): `void`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:468](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L468)

#### Parameters

##### socketBackoffMs

`number`

#### Returns

`void`

***

### recordBridgeSuppressedSocketAttempt()

> **recordBridgeSuppressedSocketAttempt**(): `void`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:463](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L463)

#### Returns

`void`

***

### recordRefreshFailure()

> **recordRefreshFailure**(`payload`, `writer`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:418](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L418)

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

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:411](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L411)

#### Parameters

##### payload

[`RefreshSuccessPayload`](#refreshsuccesspayload)

#### Returns

`Promise`\<`boolean`\>

***

### redactTokenMaterial()

> **redactTokenMaterial**(`input`): `string`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:165](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L165)

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
