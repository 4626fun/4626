[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/ui/Skeleton

# src/components/ui/Skeleton

## Functions

### Skeleton()

> **Skeleton**(`__namedParameters`): `Element`

Defined in: [src/components/ui/Skeleton.tsx:11](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/Skeleton.tsx#L11)

Shimmer skeleton block. Respects `prefers-reduced-motion`.
Use to replace content during loading to prevent layout shift.

#### Parameters

##### \_\_namedParameters

`SkeletonProps`

#### Returns

`Element`

***

### SkeletonRows()

> **SkeletonRows**(`__namedParameters`): `Element`

Defined in: [src/components/ui/Skeleton.tsx:41](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/Skeleton.tsx#L41)

Stack of skeleton rows for list/table loading states

#### Parameters

##### \_\_namedParameters

###### count?

`number` = `3`

###### rowClassName?

`string`

#### Returns

`Element`

***

### SkeletonText()

> **SkeletonText**(`__namedParameters`): `Element`

Defined in: [src/components/ui/Skeleton.tsx:27](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/Skeleton.tsx#L27)

Multi-line text skeleton — alias kept for backward compatibility

#### Parameters

##### \_\_namedParameters

###### className?

`string`

###### lines?

`number` = `3`

#### Returns

`Element`
