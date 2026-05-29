[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/layout/AppLoadingOverlay

# src/components/layout/AppLoadingOverlay

## Functions

### AppLoadingBootstrapGate()

> **AppLoadingBootstrapGate**(`props`): `Element`

Defined in: [src/components/layout/AppLoadingOverlay.tsx:125](https://github.com/wenakita/4626/blob/main/frontend/src/components/layout/AppLoadingOverlay.tsx#L125)

Full-screen bootstrap handoff: register the shared overlay and keep route
content out of the document until the gate closes.

#### Parameters

##### props

###### active

`boolean`

###### children

`ReactNode`

#### Returns

`Element`

***

### AppLoadingOverlay()

> **AppLoadingOverlay**(): `Element` \| `null`

Defined in: [src/components/layout/AppLoadingOverlay.tsx:159](https://github.com/wenakita/4626/blob/main/frontend/src/components/layout/AppLoadingOverlay.tsx#L159)

#### Returns

`Element` \| `null`

***

### AppLoadingProvider()

> **AppLoadingProvider**(`props`): `Element`

Defined in: [src/components/layout/AppLoadingOverlay.tsx:60](https://github.com/wenakita/4626/blob/main/frontend/src/components/layout/AppLoadingOverlay.tsx#L60)

#### Parameters

##### props

###### children

`ReactNode`

#### Returns

`Element`

***

### AppLoadingRegistrar()

> **AppLoadingRegistrar**(): `null`

Defined in: [src/components/layout/AppLoadingOverlay.tsx:148](https://github.com/wenakita/4626/blob/main/frontend/src/components/layout/AppLoadingOverlay.tsx#L148)

Register a full-screen bootstrap load. Always renders one shared overlay copy.

#### Returns

`null`

***

### useAppLoadingShellActive()

> **useAppLoadingShellActive**(): `boolean`

Defined in: [src/components/layout/AppLoadingOverlay.tsx:115](https://github.com/wenakita/4626/blob/main/frontend/src/components/layout/AppLoadingOverlay.tsx#L115)

True while bootstrap registrars are active or the overlay is finishing its hide delay.

#### Returns

`boolean`

***

### useOptionalAppLoadingActive()

> **useOptionalAppLoadingActive**(): `boolean`

Defined in: [src/components/layout/AppLoadingOverlay.tsx:73](https://github.com/wenakita/4626/blob/main/frontend/src/components/layout/AppLoadingOverlay.tsx#L73)

#### Returns

`boolean`
