[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/auth/appContinueGate

# src/lib/auth/appContinueGate

## Type Aliases

### AppContinueGateInput

> **AppContinueGateInput** = `object`

Defined in: [src/lib/auth/appContinueGate.ts:1](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/auth/appContinueGate.ts#L1)

#### Properties

##### autoLogin

> **autoLogin**: `boolean`

Defined in: [src/lib/auth/appContinueGate.ts:2](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/auth/appContinueGate.ts#L2)

##### fromWaitlist

> **fromWaitlist**: `boolean`

Defined in: [src/lib/auth/appContinueGate.ts:3](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/auth/appContinueGate.ts#L3)

##### privyAuthenticated

> **privyAuthenticated**: `boolean`

Defined in: [src/lib/auth/appContinueGate.ts:7](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/auth/appContinueGate.ts#L7)

##### privyClientStatus

> **privyClientStatus**: `"disabled"` \| `"loading"` \| `"ready"`

Defined in: [src/lib/auth/appContinueGate.ts:5](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/auth/appContinueGate.ts#L5)

##### privyReady

> **privyReady**: `boolean`

Defined in: [src/lib/auth/appContinueGate.ts:6](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/auth/appContinueGate.ts#L6)

##### siweAuthAddress

> **siweAuthAddress**: `string` \| `null` \| `undefined`

Defined in: [src/lib/auth/appContinueGate.ts:4](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/auth/appContinueGate.ts#L4)

***

### AppContinuePrivyWaitInput

> **AppContinuePrivyWaitInput** = `object`

Defined in: [src/lib/auth/appContinueGate.ts:23](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/auth/appContinueGate.ts#L23)

#### Properties

##### handoffRedeemed

> **handoffRedeemed**: `boolean`

Defined in: [src/lib/auth/appContinueGate.ts:24](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/auth/appContinueGate.ts#L24)

##### privyAuthenticated

> **privyAuthenticated**: `boolean`

Defined in: [src/lib/auth/appContinueGate.ts:28](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/auth/appContinueGate.ts#L28)

##### privyClientStatus

> **privyClientStatus**: `"disabled"` \| `"loading"` \| `"ready"`

Defined in: [src/lib/auth/appContinueGate.ts:26](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/auth/appContinueGate.ts#L26)

##### privyReady

> **privyReady**: `boolean`

Defined in: [src/lib/auth/appContinueGate.ts:27](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/auth/appContinueGate.ts#L27)

##### siweAuthAddress

> **siweAuthAddress**: `string` \| `null` \| `undefined`

Defined in: [src/lib/auth/appContinueGate.ts:25](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/auth/appContinueGate.ts#L25)

## Functions

### shouldNavigateAfterWaitlistHandoff()

> **shouldNavigateAfterWaitlistHandoff**(`input`): `boolean`

Defined in: [src/lib/auth/appContinueGate.ts:10](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/auth/appContinueGate.ts#L10)

#### Parameters

##### input

[`AppContinueGateInput`](#appcontinuegateinput)

#### Returns

`boolean`

***

### shouldWaitForPrivyRehydrationAfterHandoff()

> **shouldWaitForPrivyRehydrationAfterHandoff**(`_input`): `boolean`

Defined in: [src/lib/auth/appContinueGate.ts:31](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/auth/appContinueGate.ts#L31)

#### Parameters

##### \_input

[`AppContinuePrivyWaitInput`](#appcontinueprivywaitinput)

#### Returns

`boolean`
