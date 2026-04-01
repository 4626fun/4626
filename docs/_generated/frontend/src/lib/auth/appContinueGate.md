[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/auth/appContinueGate

# src/lib/auth/appContinueGate

## Type Aliases

### AppContinueGateInput

> **AppContinueGateInput** = `object`

Defined in: [src/lib/auth/appContinueGate.ts:1](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/appContinueGate.ts#L1)

#### Properties

##### privyAuthenticated

> **privyAuthenticated**: `boolean`

Defined in: [src/lib/auth/appContinueGate.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/appContinueGate.ts#L5)

##### privyClientStatus

> **privyClientStatus**: `"disabled"` \| `"loading"` \| `"ready"`

Defined in: [src/lib/auth/appContinueGate.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/appContinueGate.ts#L3)

##### privyReady

> **privyReady**: `boolean`

Defined in: [src/lib/auth/appContinueGate.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/appContinueGate.ts#L4)

##### siweAuthAddress

> **siweAuthAddress**: `string` \| `null` \| `undefined`

Defined in: [src/lib/auth/appContinueGate.ts:2](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/appContinueGate.ts#L2)

***

### AppContinuePrivyWaitInput

> **AppContinuePrivyWaitInput** = `object`

Defined in: [src/lib/auth/appContinueGate.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/appContinueGate.ts#L19)

#### Properties

##### handoffRedeemed

> **handoffRedeemed**: `boolean`

Defined in: [src/lib/auth/appContinueGate.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/appContinueGate.ts#L20)

##### privyAuthenticated

> **privyAuthenticated**: `boolean`

Defined in: [src/lib/auth/appContinueGate.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/appContinueGate.ts#L24)

##### privyClientStatus

> **privyClientStatus**: `"disabled"` \| `"loading"` \| `"ready"`

Defined in: [src/lib/auth/appContinueGate.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/appContinueGate.ts#L22)

##### privyReady

> **privyReady**: `boolean`

Defined in: [src/lib/auth/appContinueGate.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/appContinueGate.ts#L23)

##### siweAuthAddress

> **siweAuthAddress**: `string` \| `null` \| `undefined`

Defined in: [src/lib/auth/appContinueGate.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/appContinueGate.ts#L21)

## Functions

### shouldNavigateAfterAppEntryHandoff()

> **shouldNavigateAfterAppEntryHandoff**(`input`): `boolean`

Defined in: [src/lib/auth/appContinueGate.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/appContinueGate.ts#L8)

#### Parameters

##### input

[`AppContinueGateInput`](#appcontinuegateinput)

#### Returns

`boolean`

***

### shouldWaitForPrivyRehydrationAfterHandoff()

> **shouldWaitForPrivyRehydrationAfterHandoff**(`_input`): `boolean`

Defined in: [src/lib/auth/appContinueGate.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/appContinueGate.ts#L27)

#### Parameters

##### \_input

[`AppContinuePrivyWaitInput`](#appcontinueprivywaitinput)

#### Returns

`boolean`
