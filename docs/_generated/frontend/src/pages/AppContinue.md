[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/pages/AppContinue

# src/pages/AppContinue

## Type Aliases

### AppContinueAutologinDecision

> **AppContinueAutologinDecision** = `"skip"` \| `"redeem_handoff"` \| `"wait_for_privy"` \| `"start_login"` \| `"bridge_existing_session"`

Defined in: [src/pages/AppContinue.tsx:48](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/pages/AppContinue.tsx#L48)

## Functions

### AppContinue()

> **AppContinue**(): `Element`

Defined in: [src/pages/AppContinue.tsx:120](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/pages/AppContinue.tsx#L120)

#### Returns

`Element`

***

### getAppContinueRetryDirective()

> **getAppContinueRetryDirective**(`input`): `AppContinueRetryDirective`

Defined in: [src/pages/AppContinue.tsx:57](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/pages/AppContinue.tsx#L57)

#### Parameters

##### input

###### privyAuthenticated

`boolean`

#### Returns

`AppContinueRetryDirective`

***

### resolveAppContinueAutologinDecision()

> **resolveAppContinueAutologinDecision**(`input`): [`AppContinueAutologinDecision`](#appcontinueautologindecision)

Defined in: [src/pages/AppContinue.tsx:79](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/pages/AppContinue.tsx#L79)

#### Parameters

##### input

`AppContinueAutologinDecisionInput`

#### Returns

[`AppContinueAutologinDecision`](#appcontinueautologindecision)

***

### shouldBootstrapTelegramMiniAppFlow()

> **shouldBootstrapTelegramMiniAppFlow**(`input`): `boolean`

Defined in: [src/pages/AppContinue.tsx:72](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/pages/AppContinue.tsx#L72)

#### Parameters

##### input

###### hasTelegramWebApp

`boolean`

###### nextPath

`string`

#### Returns

`boolean`

***

### shouldScheduleReadyWithoutSessionTimeout()

> **shouldScheduleReadyWithoutSessionTimeout**(`input`): `boolean`

Defined in: [src/pages/AppContinue.tsx:66](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/pages/AppContinue.tsx#L66)

#### Parameters

##### input

`AppContinueReadyTimeoutInput`

#### Returns

`boolean`
