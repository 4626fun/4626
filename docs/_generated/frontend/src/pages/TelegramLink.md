[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/pages/TelegramLink

# src/pages/TelegramLink

## Type Aliases

### TelegramLinkFlowState

> **TelegramLinkFlowState** = `"idle"` \| `"authenticating"` \| `"linking"` \| `"linked"` \| `"error"`

Defined in: [src/pages/TelegramLink.tsx:31](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/pages/TelegramLink.tsx#L31)

***

### TelegramLinkSessionState

> **TelegramLinkSessionState** = `"verifying"` \| `"ready"` \| `"error"`

Defined in: [src/pages/TelegramLink.tsx:30](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/pages/TelegramLink.tsx#L30)

## Functions

### formatTelegramSessionError()

> **formatTelegramSessionError**(`error`, `statusCode`): `string`

Defined in: [src/pages/TelegramLink.tsx:33](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/pages/TelegramLink.tsx#L33)

#### Parameters

##### error

`string`

##### statusCode

`number`

#### Returns

`string`

***

### getTelegramLinkSuccessMessage()

> **getTelegramLinkSuccessMessage**(`linkStatus`): `string`

Defined in: [src/pages/TelegramLink.tsx:50](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/pages/TelegramLink.tsx#L50)

#### Parameters

##### linkStatus

`string`

#### Returns

`string`

***

### getTelegramLinkViewState()

> **getTelegramLinkViewState**(`params`): `object`

Defined in: [src/pages/TelegramLink.tsx:56](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/pages/TelegramLink.tsx#L56)

#### Parameters

##### params

###### hasLinkContext

`boolean`

###### linkMessage

`string` \| `null`

###### linkState

[`TelegramLinkFlowState`](#telegramlinkflowstate)

###### privyAuthenticated

`boolean`

###### sessionError

`string` \| `null`

###### sessionState

[`TelegramLinkSessionState`](#telegramlinksessionstate)

#### Returns

`object`

##### canRetryLink

> **canRetryLink**: `boolean`

##### canSignIn

> **canSignIn**: `boolean`

##### statusMessage

> **statusMessage**: `string`

##### statusTitle

> **statusTitle**: `string`

##### statusVariant

> **statusVariant**: `string`

***

### TelegramLink()

> **TelegramLink**(): `Element`

Defined in: [src/pages/TelegramLink.tsx:105](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/pages/TelegramLink.tsx#L105)

#### Returns

`Element`
