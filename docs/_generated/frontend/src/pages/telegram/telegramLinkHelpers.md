[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/pages/telegram/telegramLinkHelpers

# src/pages/telegram/telegramLinkHelpers

## Type Aliases

### EmailSubmitDisabledReason

> **EmailSubmitDisabledReason** = `"not_collect_email"` \| `"empty"` \| `"invalid_email"`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:185](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L185)

***

### ExpiredOrErrorState

> **ExpiredOrErrorState** = `Extract`\<[`TelegramLinkState`](../../features/telegram-link/telegramLinkFlow.md#telegramlinkstate), \{ `tag`: `"expired_or_error"`; \}\>

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:427](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L427)

***

### FlowStateDescriptor

> **FlowStateDescriptor** = `object`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:486](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L486)

#### Properties

##### errorCode

> **errorCode**: `string` \| `null`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:489](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L489)

##### step

> **step**: `string` \| `null`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:488](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L488)

##### tag

> **tag**: [`TelegramLinkState`](../../features/telegram-link/telegramLinkFlow.md#telegramlinkstate)\[`"tag"`\]

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:487](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L487)

***

### HandoffCreateResponse

> **HandoffCreateResponse** = `object`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:34](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L34)

#### Properties

##### code

> **code**: `string`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L35)

##### expiresAt

> **expiresAt**: `string`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L36)

***

### LinkTelegramParams

> **LinkTelegramParams** = `object`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:39](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L39)

#### Properties

##### launchParams?

> `optional` **launchParams**: `object`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:40](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L40)

###### initDataRaw?

> `optional` **initDataRaw**: `string`

***

### OwnerSetupHandoffState

> **OwnerSetupHandoffState** = [`ExpiredOrErrorState`](#expiredorerrorstate) & `object`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:428](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L428)

#### Type Declaration

##### error

> **error**: [`FlowError`](../../features/telegram-link/telegramLinkFlow.md#flowerror) & `object`

###### Type Declaration

###### recoverable

> **recoverable**: `true`

***

### PrivyAuthBridgeResponse

> **PrivyAuthBridgeResponse** = `object`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:28](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L28)

#### Properties

##### address

> **address**: `string`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L29)

##### privyUserId?

> `optional` **privyUserId**: `string`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L31)

##### sessionToken

> **sessionToken**: `string`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L30)

***

### TelegramApiEnvelope

> **TelegramApiEnvelope**\<`T`\> = [`ApiEnvelope`](../../lib/api/apiEnvelope.md#apienvelope)\<`T`\> & `object`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L16)

#### Type Declaration

##### code?

> `optional` **code**: `string`

#### Type Parameters

##### T

`T`

***

### TelegramLinkCompleteData

> **TelegramLinkCompleteData** = `object`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L23)

#### Properties

##### account

> **account**: `unknown`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L25)

##### link

> **link**: [`TelegramLinkResult`](../../features/telegram-link/telegramLinkFlow.md#telegramlinkresult)

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L24)

***

### TelegramLinkReadyData

> **TelegramLinkReadyData** = `object`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L18)

#### Properties

##### account

> **account**: [`TelegramLinkReadyAccount`](../../features/telegram-link/telegramLinkFlow.md#telegramlinkreadyaccount) \| `null`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L20)

##### ready

> **ready**: `boolean`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L19)

## Variables

### EMBEDDED\_WALLET\_PROVISION\_TIMEOUT\_MS

> `const` **EMBEDDED\_WALLET\_PROVISION\_TIMEOUT\_MS**: `20000` = `20_000`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:49](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L49)

***

### OTP\_RESEND\_DELAY\_MS

> `const` **OTP\_RESEND\_DELAY\_MS**: `30000` = `30_000`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:45](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L45)

***

### OTP\_SEND\_TIMEOUT\_MS

> `const` **OTP\_SEND\_TIMEOUT\_MS**: `12000` = `12_000`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L46)

***

### PRIVY\_ACCESS\_TOKEN\_TIMEOUT\_MS

> `const` **PRIVY\_ACCESS\_TOKEN\_TIMEOUT\_MS**: `4000` = `4_000`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:48](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L48)

***

### PRIVY\_LINK\_TELEGRAM\_TIMEOUT\_MS

> `const` **PRIVY\_LINK\_TELEGRAM\_TIMEOUT\_MS**: `10000` = `10_000`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:51](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L51)

***

### PRIVY\_SYNC\_TIMEOUT\_MS

> `const` **PRIVY\_SYNC\_TIMEOUT\_MS**: `45000` = `45_000`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:47](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L47)

***

### TELEGRAM\_LINK\_COMPLETE\_REQUEST\_TIMEOUT\_MS

> `const` **TELEGRAM\_LINK\_COMPLETE\_REQUEST\_TIMEOUT\_MS**: `10000` = `10_000`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L52)

***

### TELEGRAM\_LINK\_READY\_REQUEST\_TIMEOUT\_MS

> `const` **TELEGRAM\_LINK\_READY\_REQUEST\_TIMEOUT\_MS**: `4000` = `4_000`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:50](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L50)

## Functions

### accountHasVerifiedFlag()

> **accountHasVerifiedFlag**(`value`): `boolean`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:74](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L74)

#### Parameters

##### value

`unknown`

#### Returns

`boolean`

***

### buildBindFailure()

> **buildBindFailure**(`message?`, `recoverable?`): [`FlowError`](../../features/telegram-link/telegramLinkFlow.md#flowerror)

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:289](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L289)

#### Parameters

##### message?

`string`

##### recoverable?

`boolean` = `true`

#### Returns

[`FlowError`](../../features/telegram-link/telegramLinkFlow.md#flowerror)

***

### buildLaunchParamFailure()

> **buildLaunchParamFailure**(): [`FlowError`](../../features/telegram-link/telegramLinkFlow.md#flowerror)

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:297](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L297)

#### Returns

[`FlowError`](../../features/telegram-link/telegramLinkFlow.md#flowerror)

***

### buildOtpSendError()

> **buildOtpSendError**(`error`): [`FlowError`](../../features/telegram-link/telegramLinkFlow.md#flowerror)

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:224](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L224)

#### Parameters

##### error

`unknown`

#### Returns

[`FlowError`](../../features/telegram-link/telegramLinkFlow.md#flowerror)

***

### buildOtpVerifyError()

> **buildOtpVerifyError**(`error`): [`FlowError`](../../features/telegram-link/telegramLinkFlow.md#flowerror)

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:241](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L241)

#### Parameters

##### error

`unknown`

#### Returns

[`FlowError`](../../features/telegram-link/telegramLinkFlow.md#flowerror)

***

### buildPrivySyncFailure()

> **buildPrivySyncFailure**(`message?`, `recoverable?`): [`FlowError`](../../features/telegram-link/telegramLinkFlow.md#flowerror)

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:281](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L281)

#### Parameters

##### message?

`string`

##### recoverable?

`boolean` = `true`

#### Returns

[`FlowError`](../../features/telegram-link/telegramLinkFlow.md#flowerror)

***

### buildTelegramSessionError()

> **buildTelegramSessionError**(`error`, `statusCode`): [`FlowError`](../../features/telegram-link/telegramLinkFlow.md#flowerror)

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:258](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L258)

#### Parameters

##### error

`string`

##### statusCode

`number`

#### Returns

[`FlowError`](../../features/telegram-link/telegramLinkFlow.md#flowerror)

***

### candidateEmailFromAccount()

> **candidateEmailFromAccount**(`value`): `string` \| `null`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:95](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L95)

#### Parameters

##### value

`unknown`

#### Returns

`string` \| `null`

***

### coerceErrorMessage()

> **coerceErrorMessage**(`error`, `fallback`): `string`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:173](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L173)

#### Parameters

##### error

`unknown`

##### fallback

`string`

#### Returns

`string`

***

### describeFlowState()

> **describeFlowState**(`state`): [`FlowStateDescriptor`](#flowstatedescriptor)

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:492](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L492)

#### Parameters

##### state

[`TelegramLinkState`](../../features/telegram-link/telegramLinkFlow.md#telegramlinkstate)

#### Returns

[`FlowStateDescriptor`](#flowstatedescriptor)

***

### extractPrivyUserIdFromUser()

> **extractPrivyUserIdFromUser**(`user`): `string`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:133](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L133)

#### Parameters

##### user

`unknown`

#### Returns

`string`

***

### extractPrivyVerifiedEmailFromUser()

> **extractPrivyVerifiedEmailFromUser**(`user`): `string` \| `null`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:106](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L106)

#### Parameters

##### user

`unknown`

#### Returns

`string` \| `null`

***

### formatFlowStateDescriptor()

> **formatFlowStateDescriptor**(`value`): `string`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:514](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L514)

#### Parameters

##### value

[`FlowStateDescriptor`](#flowstatedescriptor)

#### Returns

`string`

***

### formatTelegramHandle()

> **formatTelegramHandle**(`username`, `userId`): `string`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:442](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L442)

#### Parameters

##### username

`string` | `null`

##### userId

`string`

#### Returns

`string`

***

### getEmailSubmitAssessment()

> **getEmailSubmitAssessment**(`state`, `emailOverride?`): `object`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:187](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L187)

#### Parameters

##### state

[`TelegramLinkState`](../../features/telegram-link/telegramLinkFlow.md#telegramlinkstate)

##### emailOverride?

`string`

#### Returns

`object`

##### disabledReason

> **disabledReason**: [`EmailSubmitDisabledReason`](#emailsubmitdisabledreason) \| `null`

##### emailValid

> **emailValid**: `boolean`

##### normalizedEmail

> **normalizedEmail**: `string`

***

### getErrorGuidance()

> **getErrorGuidance**(`error`): `string`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:411](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L411)

#### Parameters

##### error

[`FlowError`](../../features/telegram-link/telegramLinkFlow.md#flowerror)

#### Returns

`string`

***

### getErrorTitle()

> **getErrorTitle**(`error`): `string`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:390](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L390)

#### Parameters

##### error

[`FlowError`](../../features/telegram-link/telegramLinkFlow.md#flowerror)

#### Returns

`string`

***

### getFlowDescription()

> **getFlowDescription**(`tag`): `string`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:347](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L347)

#### Parameters

##### tag

`string`

#### Returns

`string`

***

### getFlowHeadline()

> **getFlowHeadline**(`tag`): `string`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:324](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L324)

#### Parameters

##### tag

`string`

#### Returns

`string`

***

### getFlowProgressIndex()

> **getFlowProgressIndex**(`tag`): `number`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:370](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L370)

#### Parameters

##### tag

`"success"` | `"verify_telegram_session"` | `"collect_email"` | `"sending_email_code"` | `"enter_email_code"` | `"verifying_email_code"` | `"wait_for_privy_sync"` | `"bind_telegram"` | `"expired_or_error"`

#### Returns

`number`

***

### getTelemetryLinkContext()

> **getTelemetryLinkContext**(`state`): [`TelegramMiniAppLinkContext`](../../lib/telegram/telegramMiniAppLink.md#telegramminiapplinkcontext) \| `null`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:467](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L467)

#### Parameters

##### state

[`TelegramLinkState`](../../features/telegram-link/telegramLinkFlow.md#telegramlinkstate)

#### Returns

[`TelegramMiniAppLinkContext`](../../lib/telegram/telegramMiniAppLink.md#telegramminiapplinkcontext) \| `null`

***

### getTelemetryPhase()

> **getTelemetryPhase**(`state`): `string`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:477](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L477)

#### Parameters

##### state

[`TelegramLinkState`](../../features/telegram-link/telegramLinkFlow.md#telegramlinkstate)

#### Returns

`string`

***

### getTelemetryProof()

> **getTelemetryProof**(`state`): [`TelegramSessionProof`](../../features/telegram-link/telegramLinkFlow.md#telegramsessionproof) \| `null`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:450](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L450)

#### Parameters

##### state

[`TelegramLinkState`](../../features/telegram-link/telegramLinkFlow.md#telegramlinkstate)

#### Returns

[`TelegramSessionProof`](../../features/telegram-link/telegramLinkFlow.md#telegramsessionproof) \| `null`

***

### isOwnerSetupHandoffState()

> **isOwnerSetupHandoffState**(`state`): `state is OwnerSetupHandoffState`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:432](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L432)

#### Parameters

##### state

[`TelegramLinkState`](../../features/telegram-link/telegramLinkFlow.md#telegramlinkstate)

#### Returns

`state is OwnerSetupHandoffState`

***

### isTruthy()

> **isTruthy**(`value`): `boolean`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:64](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L64)

#### Parameters

##### value

`unknown`

#### Returns

`boolean`

***

### isValidEmail()

> **isValidEmail**(`email`): `boolean`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:181](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L181)

#### Parameters

##### email

`string`

#### Returns

`boolean`

***

### normalizeLower()

> **normalizeLower**(`value`): `string`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:60](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L60)

#### Parameters

##### value

`unknown`

#### Returns

`string`

***

### parseTelegramLinkReadyAccount()

> **parseTelegramLinkReadyAccount**(`data`, `expectedEmail`): [`TelegramLinkReadyAccount`](../../features/telegram-link/telegramLinkFlow.md#telegramlinkreadyaccount) \| `null`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:304](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L304)

#### Parameters

##### data

`unknown`

##### expectedEmail

`string`

#### Returns

[`TelegramLinkReadyAccount`](../../features/telegram-link/telegramLinkFlow.md#telegramlinkreadyaccount) \| `null`

***

### prefersLinkedHandoffCopy()

> **prefersLinkedHandoffCopy**(`state`): `boolean`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:438](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L438)

#### Parameters

##### state

[`OwnerSetupHandoffState`](#ownersetuphandoffstate)

#### Returns

`boolean`

***

### readPrivyAccessToken()

> **readPrivyAccessToken**(`read`): `Promise`\<`string`\>

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:159](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L159)

#### Parameters

##### read

() => `Promise`\<`unknown`\> | `null` | `undefined`

#### Returns

`Promise`\<`string`\>

***

### shortAddress()

> **shortAddress**(`value`): `string`

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:446](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L446)

#### Parameters

##### value

`string`

#### Returns

`string`

***

### sleep()

> **sleep**(`ms`): `Promise`\<`void`\>

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:56](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L56)

#### Parameters

##### ms

`number`

#### Returns

`Promise`\<`void`\>

***

### withTimeout()

> **withTimeout**\<`T`\>(`promise`, `timeoutMs`, `message`): `Promise`\<`T`\>

Defined in: [src/pages/telegram/telegramLinkHelpers.ts:145](https://github.com/wenakita/4626/blob/main/frontend/src/pages/telegram/telegramLinkHelpers.ts#L145)

#### Type Parameters

##### T

`T`

#### Parameters

##### promise

`Promise`\<`T`\>

##### timeoutMs

`number`

##### message

`string`

#### Returns

`Promise`\<`T`\>
