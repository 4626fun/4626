[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/telegram-link/telegramLinkFlow

# src/features/telegram-link/telegramLinkFlow

## Type Aliases

### FlowError

> **FlowError** = `object`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L15)

#### Properties

##### code

> **code**: [`FlowErrorCode`](#flowerrorcode-1)

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L16)

##### message

> **message**: `string`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L17)

##### recoverable

> **recoverable**: `boolean`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L18)

***

### FlowErrorCode

> **FlowErrorCode** = `"INVALID_TELEGRAM_CONTEXT"` \| `"EXPIRED_TELEGRAM_SESSION"` \| `"TELEGRAM_BOT_NOT_CONFIGURED"` \| `"OTP_SEND_FAILED"` \| `"OTP_VERIFY_FAILED"` \| `"PRIVY_SYNC_FAILED"` \| `"BIND_TELEGRAM_FAILED"` \| `"STALE_TELEGRAM_LAUNCH_PARAMS"` \| `"RECOVERY_REQUIRED"` \| `"UNKNOWN"`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L3)

***

### TelegramLinkEvent

> **TelegramLinkEvent** = \{ `proof`: [`TelegramSessionProof`](#telegramsessionproof); `type`: `"TELEGRAM_VERIFIED"`; \} \| \{ `error`: [`FlowError`](#flowerror); `type`: `"TELEGRAM_VERIFY_FAILED"`; \} \| \{ `email`: `string`; `type`: `"EMAIL_CHANGED"`; \} \| \{ `email`: `string`; `type`: `"SUBMIT_EMAIL"`; \} \| \{ `resendAvailableAt?`: `number` \| `null`; `type`: `"EMAIL_CODE_SENT"`; \} \| \{ `error`: [`FlowError`](#flowerror); `type`: `"EMAIL_CODE_SEND_FAILED"`; \} \| \{ `code`: `string`; `type`: `"CODE_CHANGED"`; \} \| \{ `type`: `"SUBMIT_CODE"`; \} \| \{ `type`: `"EMAIL_CODE_VERIFIED"`; \} \| \{ `error`: [`FlowError`](#flowerror); `type`: `"EMAIL_CODE_VERIFY_FAILED"`; \} \| \{ `account`: [`TelegramLinkReadyAccount`](#telegramlinkreadyaccount); `type`: `"PRIVY_SYNC_READY"`; \} \| \{ `error`: [`FlowError`](#flowerror); `type`: `"PRIVY_SYNC_FAILED"`; \} \| \{ `type`: `"PRIVY_TELEGRAM_LINK_SKIPPED"`; \} \| \{ `type`: `"PRIVY_TELEGRAM_LINK_SUCCEEDED"`; \} \| \{ `error`: [`FlowError`](#flowerror); `type`: `"PRIVY_TELEGRAM_LINK_FAILED"`; \} \| \{ `link`: [`TelegramLinkResult`](#telegramlinkresult); `type`: `"BIND_TELEGRAM_SUCCEEDED"`; \} \| \{ `error`: [`FlowError`](#flowerror); `type`: `"BIND_TELEGRAM_FAILED"`; \} \| \{ `type`: `"RESEND_CODE"`; \} \| \{ `type`: `"RETRY"`; \} \| \{ `type`: `"RESET"`; \}

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:125](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L125)

***

### TelegramLinkReadyAccount

> **TelegramLinkReadyAccount** = `object`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:34](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L34)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L38)

##### email

> **email**: `string`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L36)

##### emailVerified

> **emailVerified**: `true`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:37](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L37)

##### privyUserId

> **privyUserId**: `string`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L35)

***

### TelegramLinkResult

> **TelegramLinkResult** = `object`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:41](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L41)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:47](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L47)

##### linkStatus

> **linkStatus**: `string`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L46)

##### ownerVerified

> **ownerVerified**: `boolean`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:48](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L48)

##### privyUserId

> **privyUserId**: `string`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:44](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L44)

##### profileId

> **profileId**: `number`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:45](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L45)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L42)

##### telegramUsername

> **telegramUsername**: `string` \| `null`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:43](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L43)

***

### TelegramLinkState

> **TelegramLinkState** = \{ `linkContext`: [`TelegramMiniAppLinkContext`](../../lib/telegram/telegramMiniAppLink.md#telegramminiapplinkcontext) \| `null`; `tag`: `"verify_telegram_session"`; \} \| \{ `email`: `string`; `emailError`: `string` \| `null`; `proof`: [`TelegramSessionProof`](#telegramsessionproof); `tag`: `"collect_email"`; \} \| \{ `email`: `string`; `proof`: [`TelegramSessionProof`](#telegramsessionproof); `tag`: `"sending_email_code"`; \} \| \{ `code`: `string`; `codeError`: `string` \| `null`; `email`: `string`; `proof`: [`TelegramSessionProof`](#telegramsessionproof); `resendAvailableAt`: `number` \| `null`; `tag`: `"enter_email_code"`; \} \| \{ `code`: `string`; `email`: `string`; `proof`: [`TelegramSessionProof`](#telegramsessionproof); `tag`: `"verifying_email_code"`; \} \| \{ `code`: `string`; `email`: `string`; `proof`: [`TelegramSessionProof`](#telegramsessionproof); `startedAt`: `number`; `tag`: `"wait_for_privy_sync"`; \} \| \{ `account`: [`TelegramLinkReadyAccount`](#telegramlinkreadyaccount); `proof`: [`TelegramSessionProof`](#telegramsessionproof); `step`: `"ensure_privy_link"` \| `"complete_backend"`; `tag`: `"bind_telegram"`; \} \| \{ `account`: [`TelegramLinkReadyAccount`](#telegramlinkreadyaccount); `link`: [`TelegramLinkResult`](#telegramlinkresult); `proof`: [`TelegramSessionProof`](#telegramsessionproof); `tag`: `"success"`; \} \| \{ `code?`: `string`; `email?`: `string`; `error`: [`FlowError`](#flowerror); `proof`: [`TelegramSessionProof`](#telegramsessionproof) \| `null`; `retryTarget?`: `RetryTarget`; `tag`: `"expired_or_error"`; \}

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:67](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L67)

***

### TelegramSessionProof

> **TelegramSessionProof** = `object`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L21)

#### Properties

##### chatId

> **chatId**: `string` \| `null`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L26)

##### chatInstance

> **chatInstance**: `string` \| `null`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:28](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L28)

##### chatType

> **chatType**: `string` \| `null`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L27)

##### expiresAt

> **expiresAt**: `string`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L29)

##### initDataRaw

> **initDataRaw**: `string`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L23)

##### linkContext

> **linkContext**: [`TelegramMiniAppLinkContext`](../../lib/telegram/telegramMiniAppLink.md#telegramminiapplinkcontext) \| `null`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L31)

##### sessionToken

> **sessionToken**: `string`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L22)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L24)

##### telegramUsername

> **telegramUsername**: `string` \| `null`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L25)

##### verifiedAt

> **verifiedAt**: `number`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L30)

## Functions

### createFlowError()

> **createFlowError**(`params`): [`FlowError`](#flowerror)

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:147](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L147)

#### Parameters

##### params

###### code

[`FlowErrorCode`](#flowerrorcode-1)

###### message

`string`

###### recoverable?

`boolean`

#### Returns

[`FlowError`](#flowerror)

***

### createInitialTelegramLinkState()

> **createInitialTelegramLinkState**(`linkContext`): [`TelegramLinkState`](#telegramlinkstate)

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:163](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L163)

#### Parameters

##### linkContext

[`TelegramMiniAppLinkContext`](../../lib/telegram/telegramMiniAppLink.md#telegramminiapplinkcontext) | `null`

#### Returns

[`TelegramLinkState`](#telegramlinkstate)

***

### hasMatchingPrivyTelegramAccount()

> **hasMatchingPrivyTelegramAccount**(`user`, `proof`): `boolean`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:437](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L437)

#### Parameters

##### user

\{ `linked_accounts?`: `LinkedTelegramAccount`[] \| `null`; `linkedAccounts?`: `LinkedTelegramAccount`[] \| `null`; \} | `null` | `undefined`

##### proof

[`TelegramSessionProof`](#telegramsessionproof)

#### Returns

`boolean`

***

### isTelegramLaunchParamError()

> **isTelegramLaunchParamError**(`code`): `boolean`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:452](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L452)

#### Parameters

##### code

`string` | `null` | `undefined`

#### Returns

`boolean`

***

### normalizeEmailCandidate()

> **normalizeEmailCandidate**(`value`): `string`

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:159](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L159)

#### Parameters

##### value

`string`

#### Returns

`string`

***

### telegramLinkReducer()

> **telegramLinkReducer**(`state`, `event`): [`TelegramLinkState`](#telegramlinkstate)

Defined in: [src/features/telegram-link/telegramLinkFlow.ts:221](https://github.com/wenakita/4626/blob/main/frontend/src/features/telegram-link/telegramLinkFlow.ts#L221)

#### Parameters

##### state

[`TelegramLinkState`](#telegramlinkstate)

##### event

[`TelegramLinkEvent`](#telegramlinkevent)

#### Returns

[`TelegramLinkState`](#telegramlinkstate)
