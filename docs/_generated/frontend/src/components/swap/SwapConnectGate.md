[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/swap/SwapConnectGate

# src/components/swap/SwapConnectGate

## Functions

### SwapConnectGate()

> **SwapConnectGate**(`props`): `Element`

Defined in: [src/components/swap/SwapConnectGate.tsx:24](https://github.com/wenakita/4626/blob/main/frontend/src/components/swap/SwapConnectGate.tsx#L24)

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
