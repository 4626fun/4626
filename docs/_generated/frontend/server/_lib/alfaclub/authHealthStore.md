[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/alfaclub/authHealthStore

# server/\_lib/alfaclub/authHealthStore

## Type Aliases

### AlfaClubAuthHealthSnapshot

> **AlfaClubAuthHealthSnapshot** = `object`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:307](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L307)

#### Properties

##### lastFailure

> **lastFailure**: [`RefreshFailurePayload`](#refreshfailurepayload) & `object` \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:309](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L309)

##### lastSuccess

> **lastSuccess**: [`RefreshSuccessPayload`](#refreshsuccesspayload) & `object` \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:308](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L308)

##### liveChatJwt

> **liveChatJwt**: \{ `expiresAt`: `string` \| `null`; `minutesUntilExpiry`: `number` \| `null`; `updatedAt`: `string` \| `null`; `writer`: `string` \| `null`; `writerAnomaly`: [`WriterAnomaly`](#writeranomaly); \} \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:315](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L315)

Snapshot of the chat_jwt row's writer + expiry, so the health endpoint
can surface anomalies on the live token row even when the most recent
refresh succeeded (e.g. a downstream writer overwrote the slot).

***

### RefreshFailurePayload

> **RefreshFailurePayload** = `object`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:145](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L145)

#### Properties

##### at

> **at**: `string`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:146](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L146)

##### detail

> **detail**: `string`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:150](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L150)

Already-redacted short label, never the raw error.

##### errorCode

> **errorCode**: `string`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:148](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L148)

##### status

> **status**: `"error"` \| `"missing_tokens"`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:147](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L147)

***

### RefreshSuccessPayload

> **RefreshSuccessPayload** = `object`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:138](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L138)

#### Properties

##### at

> **at**: `string`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:139](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L139)

##### identityTokenExp

> **identityTokenExp**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:140](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L140)

##### rotatedRefresh

> **rotatedRefresh**: `boolean`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:142](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L142)

##### writer

> **writer**: `string`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:141](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L141)

***

### WriterAnomaly

> **WriterAnomaly** = `object`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:73](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L73)

#### Properties

##### isAnomalous

> **isAnomalous**: `boolean`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:74](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L74)

##### reason

> **reason**: `"unknown_writer"` \| `"legacy_in_process_refresher"` \| `"empty_writer"` \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:75](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L75)

##### writer

> **writer**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:80](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L80)

## Variables

### \_HEALTH\_KEYS\_FOR\_TESTS

> `const` **\_HEALTH\_KEYS\_FOR\_TESTS**: `object`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:389](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L389)

For tests only — health row keys.

#### Type Declaration

##### LAST\_FAILURE

> **LAST\_FAILURE**: `"chat_auth_health:last_failure"` = `HEALTH_KEY_LAST_FAILURE`

##### LAST\_SUCCESS

> **LAST\_SUCCESS**: `"chat_auth_health:last_success"` = `HEALTH_KEY_LAST_SUCCESS`

## Functions

### buildRefreshFailurePayload()

> **buildRefreshFailurePayload**(`params`): [`RefreshFailurePayload`](#refreshfailurepayload)

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:205](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L205)

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

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:153](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L153)

#### Parameters

##### params

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

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:173](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L173)

Reduce a free-form refresher error message to a stable short code that
is safe to persist and surface from the health endpoint. Preserves the
fingerprintable `privy_refresh_failed:<status>` prefix when present and
truncates everything else through `redactTokenMaterial`.

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

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:87](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L87)

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

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:334](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L334)

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

### recordRefreshFailure()

> **recordRefreshFailure**(`payload`, `writer`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:299](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L299)

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

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:292](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L292)

#### Parameters

##### payload

[`RefreshSuccessPayload`](#refreshsuccesspayload)

#### Returns

`Promise`\<`boolean`\>

***

### redactTokenMaterial()

> **redactTokenMaterial**(`input`): `string`

Defined in: [server/\_lib/alfaclub/authHealthStore.ts:122](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/authHealthStore.ts#L122)

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
