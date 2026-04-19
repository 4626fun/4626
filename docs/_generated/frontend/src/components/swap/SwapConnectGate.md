[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/swap/SwapConnectGate

# src/components/swap/SwapConnectGate

## Functions

### SwapConnectGate()

> **SwapConnectGate**(`props`): `Element`

Defined in: [src/components/swap/SwapConnectGate.tsx:22](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/swap/SwapConnectGate.tsx#L22)

Route-level gate shown in place of the Swap form when the user cannot
meaningfully interact yet. Intentionally single-CTA per the waitlist /
onboarding simplicity rule — no secondary actions, no protocol jargon.

The gate state itself comes from `deriveSwapConnectGate` in
`frontend/src/lib/swap/connectGate.ts`, which is covered by unit tests.

#### Parameters

##### props

`SwapConnectGateProps`

#### Returns

`Element`
