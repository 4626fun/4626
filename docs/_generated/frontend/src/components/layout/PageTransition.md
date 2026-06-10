[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/layout/PageTransition

# src/components/layout/PageTransition

## Type Aliases

### PageTransitionSurfaceProps

> **PageTransitionSurfaceProps** = `object`

Defined in: [src/components/layout/PageTransition.tsx:28](https://github.com/wenakita/4626/blob/main/frontend/src/components/layout/PageTransition.tsx#L28)

#### Properties

##### children

> **children**: `ReactNode`

Defined in: [src/components/layout/PageTransition.tsx:30](https://github.com/wenakita/4626/blob/main/frontend/src/components/layout/PageTransition.tsx#L30)

##### className?

> `optional` **className**: `string`

Defined in: [src/components/layout/PageTransition.tsx:31](https://github.com/wenakita/4626/blob/main/frontend/src/components/layout/PageTransition.tsx#L31)

##### transitionKey

> **transitionKey**: `string`

Defined in: [src/components/layout/PageTransition.tsx:29](https://github.com/wenakita/4626/blob/main/frontend/src/components/layout/PageTransition.tsx#L29)

##### variant?

> `optional` **variant**: [`PageTransitionVariant`](#pagetransitionvariant)

Defined in: [src/components/layout/PageTransition.tsx:32](https://github.com/wenakita/4626/blob/main/frontend/src/components/layout/PageTransition.tsx#L32)

***

### PageTransitionVariant

> **PageTransitionVariant** = `"route"` \| `"nested"`

Defined in: [src/components/layout/PageTransition.tsx:10](https://github.com/wenakita/4626/blob/main/frontend/src/components/layout/PageTransition.tsx#L10)

## Functions

### PageTransitionNestedOutlet()

> **PageTransitionNestedOutlet**(`props`): `Element`

Defined in: [src/components/layout/PageTransition.tsx:59](https://github.com/wenakita/4626/blob/main/frontend/src/components/layout/PageTransition.tsx#L59)

Nested tab / sub-route transitions (Explore tabs, Admin sections).

#### Parameters

##### props

###### className?

`string`

#### Returns

`Element`

***

### PageTransitionOutlet()

> **PageTransitionOutlet**(): `Element`

Defined in: [src/components/layout/PageTransition.tsx:69](https://github.com/wenakita/4626/blob/main/frontend/src/components/layout/PageTransition.tsx#L69)

#### Returns

`Element`

***

### PageTransitionSurface()

> **PageTransitionSurface**(`props`): `Element`

Defined in: [src/components/layout/PageTransition.tsx:36](https://github.com/wenakita/4626/blob/main/frontend/src/components/layout/PageTransition.tsx#L36)

Shared fade + slight vertical shift for route and nested tab surfaces.

#### Parameters

##### props

[`PageTransitionSurfaceProps`](#pagetransitionsurfaceprops)

#### Returns

`Element`
