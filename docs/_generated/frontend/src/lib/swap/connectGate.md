[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/swap/connectGate

# src/lib/swap/connectGate

## Type Aliases

### SwapConnectGateInput

> **SwapConnectGateInput** = `object`

Defined in: [src/lib/swap/connectGate.ts:22](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/swap/connectGate.ts#L22)

#### Properties

##### authBusy?

> `optional` **authBusy**: `boolean`

Defined in: [src/lib/swap/connectGate.ts:39](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/swap/connectGate.ts#L39)

True while a `signIn` / Privy login request is in flight. Keeps the
gate in a stable "signing-in" state during the short window between
session creation and wagmi attaching the wallet, avoiding a transient
"Connect a wallet to swap" flash right after the user signs in.

##### executionAddress

> **executionAddress**: `string` \| `null` \| `undefined`

Defined in: [src/lib/swap/connectGate.ts:32](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/swap/connectGate.ts#L32)

The canonical execution address resolved by `useAccountContext`.
Null/undefined means there is no signer wagmi can talk to yet, so
quote and swap endpoints would reject the request.

##### hasSession

> **hasSession**: `boolean`

Defined in: [src/lib/swap/connectGate.ts:26](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/swap/connectGate.ts#L26)

True when a 4626 session cookie is active for this principal.

##### sessionHydrated

> **sessionHydrated**: `boolean`

Defined in: [src/lib/swap/connectGate.ts:24](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/swap/connectGate.ts#L24)

True once useSiweAuth has finished its initial /api/auth/me probe.

***

### SwapConnectGateResult

> **SwapConnectGateResult** = `object`

Defined in: [src/lib/swap/connectGate.ts:42](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/swap/connectGate.ts#L42)

#### Properties

##### actionLabel

> **actionLabel**: `string`

Defined in: [src/lib/swap/connectGate.ts:50](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/swap/connectGate.ts#L50)

Primary CTA label; empty when state has no actionable button.

##### message

> **message**: `string`

Defined in: [src/lib/swap/connectGate.ts:48](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/swap/connectGate.ts#L48)

##### ready

> **ready**: `boolean`

Defined in: [src/lib/swap/connectGate.ts:45](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/swap/connectGate.ts#L45)

True when the swap form should render.

##### showSpinner

> **showSpinner**: `boolean`

Defined in: [src/lib/swap/connectGate.ts:52](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/swap/connectGate.ts#L52)

True when the gate should show a spinner instead of a CTA.

##### spinnerLabel

> **spinnerLabel**: `string`

Defined in: [src/lib/swap/connectGate.ts:54](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/swap/connectGate.ts#L54)

Accessible label for the spinner when shown.

##### state

> **state**: [`SwapConnectGateState`](#swapconnectgatestate)

Defined in: [src/lib/swap/connectGate.ts:43](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/swap/connectGate.ts#L43)

##### title

> **title**: `string`

Defined in: [src/lib/swap/connectGate.ts:47](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/swap/connectGate.ts#L47)

Human copy intended for the gate card.

***

### SwapConnectGateState

> **SwapConnectGateState** = `"hydrating"` \| `"signing-in"` \| `"signed-out"` \| `"wallet-required"` \| `"ready"`

Defined in: [src/lib/swap/connectGate.ts:15](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/swap/connectGate.ts#L15)

Pure state machine for the /swap route-level connect gate.

The swap form requires a fully-resolved execution wallet before it is
useful — quotes need an on-chain sender, and the session gate inside
`useSwapExecution` blocks `isReady` until a 4626 session is active.
Rather than letting users sit on a silently-disabled "Swap now" button,
/swap pre-gates on a single clear call-to-action.

This module is intentionally framework-free so it can be unit-tested
without mounting React. The `SwapConnectGate` component maps states to
UI, and `Swap.tsx` maps states to actions.

## Functions

### deriveSwapConnectGate()

> **deriveSwapConnectGate**(`input`): [`SwapConnectGateResult`](#swapconnectgateresult)

Defined in: [src/lib/swap/connectGate.ts:105](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/swap/connectGate.ts#L105)

#### Parameters

##### input

[`SwapConnectGateInput`](#swapconnectgateinput)

#### Returns

[`SwapConnectGateResult`](#swapconnectgateresult)
