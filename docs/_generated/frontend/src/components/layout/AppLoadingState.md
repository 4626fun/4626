[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/layout/AppLoadingState

# src/components/layout/AppLoadingState

## Type Aliases

### AppLoadingStateProps

> **AppLoadingStateProps** = `object`

Defined in: [src/components/layout/AppLoadingState.tsx:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/layout/AppLoadingState.tsx#L10)

#### Properties

##### fillContainer?

> `optional` **fillContainer**: `boolean`

Defined in: [src/components/layout/AppLoadingState.tsx:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/layout/AppLoadingState.tsx#L17)

Fill a relative overlay shell instead of creating a second fixed layer.

##### intent?

> `optional` **intent**: [`LoadingIntent`](appLoadingIntents.md#loadingintent)

Defined in: [src/components/layout/AppLoadingState.tsx:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/layout/AppLoadingState.tsx#L11)

##### labelOverride?

> `optional` **labelOverride**: `string`

Defined in: [src/components/layout/AppLoadingState.tsx:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/layout/AppLoadingState.tsx#L12)

##### srStatusOverride?

> `optional` **srStatusOverride**: `string`

Defined in: [src/components/layout/AppLoadingState.tsx:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/layout/AppLoadingState.tsx#L13)

##### stabilizePattern?

> `optional` **stabilizePattern**: `boolean`

Defined in: [src/components/layout/AppLoadingState.tsx:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/layout/AppLoadingState.tsx#L15)

When true, session/page handoffs keep the same loader pattern (no animation reset).

## Functions

### AppLoadingState()

> **AppLoadingState**(`props`): `Element`

Defined in: [src/components/layout/AppLoadingState.tsx:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/layout/AppLoadingState.tsx#L25)

#### Parameters

##### props

[`AppLoadingStateProps`](#apploadingstateprops) = `{}`

#### Returns

`Element`
