[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/ui/LoadingState

# src/components/ui/LoadingState

## Type Aliases

### BaseLoadingProps

> **BaseLoadingProps** = `object`

Defined in: [src/components/ui/LoadingState.tsx:25](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/LoadingState.tsx#L25)

#### Properties

##### className?

> `optional` **className**: `string`

Defined in: [src/components/ui/LoadingState.tsx:28](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/LoadingState.tsx#L28)

##### intent?

> `optional` **intent**: [`LoadingIntent`](../layout/appLoadingIntents.md#loadingintent)

Defined in: [src/components/ui/LoadingState.tsx:26](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/LoadingState.tsx#L26)

##### labelOverride?

> `optional` **labelOverride**: `string`

Defined in: [src/components/ui/LoadingState.tsx:27](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/LoadingState.tsx#L27)

***

### LoadingBlockProps

> **LoadingBlockProps** = [`BaseLoadingProps`](#baseloadingprops) & `object`

Defined in: [src/components/ui/LoadingState.tsx:57](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/LoadingState.tsx#L57)

#### Type Declaration

##### minHeightClassName?

> `optional` **minHeightClassName**: `string`

##### size?

> `optional` **size**: `LoadingSize`

***

### LoadingInlineProps

> **LoadingInlineProps** = [`BaseLoadingProps`](#baseloadingprops) & `object`

Defined in: [src/components/ui/LoadingState.tsx:31](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/LoadingState.tsx#L31)

#### Type Declaration

##### showLabel?

> `optional` **showLabel**: `boolean`

##### size?

> `optional` **size**: `LoadingSize`

***

### LoadingTextProps

> **LoadingTextProps** = [`BaseLoadingProps`](#baseloadingprops) & `object`

Defined in: [src/components/ui/LoadingState.tsx:49](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/LoadingState.tsx#L49)

#### Type Declaration

##### size?

> `optional` **size**: `LoadingSize`

## Functions

### LoadingBlock()

> **LoadingBlock**(`props`): `Element`

Defined in: [src/components/ui/LoadingState.tsx:62](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/LoadingState.tsx#L62)

#### Parameters

##### props

[`LoadingBlockProps`](#loadingblockprops)

#### Returns

`Element`

***

### LoadingInline()

> **LoadingInline**(`props`): `Element`

Defined in: [src/components/ui/LoadingState.tsx:36](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/LoadingState.tsx#L36)

#### Parameters

##### props

[`LoadingInlineProps`](#loadinginlineprops)

#### Returns

`Element`

***

### LoadingText()

> **LoadingText**(`props`): `Element`

Defined in: [src/components/ui/LoadingState.tsx:53](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/LoadingState.tsx#L53)

#### Parameters

##### props

[`LoadingTextProps`](#loadingtextprops)

#### Returns

`Element`
