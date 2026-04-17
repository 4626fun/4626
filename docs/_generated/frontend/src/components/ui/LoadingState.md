[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/ui/LoadingState

# src/components/ui/LoadingState

## Type Aliases

### BaseLoadingProps

> **BaseLoadingProps** = `object`

Defined in: [src/components/ui/LoadingState.tsx:26](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/LoadingState.tsx#L26)

#### Properties

##### className?

> `optional` **className**: `string`

Defined in: [src/components/ui/LoadingState.tsx:29](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/LoadingState.tsx#L29)

##### intent?

> `optional` **intent**: [`LoadingIntent`](../layout/appLoadingIntents.md#loadingintent)

Defined in: [src/components/ui/LoadingState.tsx:27](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/LoadingState.tsx#L27)

##### labelOverride?

> `optional` **labelOverride**: `string`

Defined in: [src/components/ui/LoadingState.tsx:28](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/LoadingState.tsx#L28)

***

### LoadingBlockProps

> **LoadingBlockProps** = [`BaseLoadingProps`](#baseloadingprops) & `object`

Defined in: [src/components/ui/LoadingState.tsx:58](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/LoadingState.tsx#L58)

#### Type Declaration

##### minHeightClassName?

> `optional` **minHeightClassName**: `string`

##### size?

> `optional` **size**: `LoadingSize`

***

### LoadingInlineProps

> **LoadingInlineProps** = [`BaseLoadingProps`](#baseloadingprops) & `object`

Defined in: [src/components/ui/LoadingState.tsx:32](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/LoadingState.tsx#L32)

#### Type Declaration

##### showLabel?

> `optional` **showLabel**: `boolean`

##### size?

> `optional` **size**: `LoadingSize`

***

### LoadingTextProps

> **LoadingTextProps** = [`BaseLoadingProps`](#baseloadingprops) & `object`

Defined in: [src/components/ui/LoadingState.tsx:50](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/LoadingState.tsx#L50)

#### Type Declaration

##### size?

> `optional` **size**: `LoadingSize`

## Functions

### LoadingBlock()

> **LoadingBlock**(`props`): `Element`

Defined in: [src/components/ui/LoadingState.tsx:63](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/LoadingState.tsx#L63)

#### Parameters

##### props

[`LoadingBlockProps`](#loadingblockprops)

#### Returns

`Element`

***

### LoadingInline()

> **LoadingInline**(`props`): `Element`

Defined in: [src/components/ui/LoadingState.tsx:37](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/LoadingState.tsx#L37)

#### Parameters

##### props

[`LoadingInlineProps`](#loadinginlineprops)

#### Returns

`Element`

***

### LoadingText()

> **LoadingText**(`props`): `Element`

Defined in: [src/components/ui/LoadingState.tsx:54](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/LoadingState.tsx#L54)

#### Parameters

##### props

[`LoadingTextProps`](#loadingtextprops)

#### Returns

`Element`
