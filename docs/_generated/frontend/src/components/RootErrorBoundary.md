[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/components/RootErrorBoundary

# src/components/RootErrorBoundary

## Classes

### RootErrorBoundary

Defined in: [src/components/RootErrorBoundary.tsx:95](https://github.com/wenakita/4626/blob/main/frontend/src/components/RootErrorBoundary.tsx#L95)

#### Extends

- `Component`\<`RootErrorBoundaryProps`, `RootErrorBoundaryState`\>

#### Constructors

##### Constructor

> **new RootErrorBoundary**(`props`): [`RootErrorBoundary`](#rooterrorboundary)

Defined in: [src/components/RootErrorBoundary.tsx:96](https://github.com/wenakita/4626/blob/main/frontend/src/components/RootErrorBoundary.tsx#L96)

###### Parameters

###### props

`RootErrorBoundaryProps`

###### Returns

[`RootErrorBoundary`](#rooterrorboundary)

###### Overrides

`Component<RootErrorBoundaryProps, RootErrorBoundaryState>.constructor`

#### Methods

##### componentDidCatch()

> **componentDidCatch**(`error`, `errorInfo`): `void`

Defined in: [src/components/RootErrorBoundary.tsx:105](https://github.com/wenakita/4626/blob/main/frontend/src/components/RootErrorBoundary.tsx#L105)

Catches exceptions generated in descendant components. Unhandled exceptions will cause
the entire component tree to unmount.

###### Parameters

###### error

`Error`

###### errorInfo

`ErrorInfo`

###### Returns

`void`

###### Overrides

`Component.componentDidCatch`

##### handleReload()

> **handleReload**(): `void`

Defined in: [src/components/RootErrorBoundary.tsx:122](https://github.com/wenakita/4626/blob/main/frontend/src/components/RootErrorBoundary.tsx#L122)

###### Returns

`void`

##### handleRetry()

> **handleRetry**(): `void`

Defined in: [src/components/RootErrorBoundary.tsx:114](https://github.com/wenakita/4626/blob/main/frontend/src/components/RootErrorBoundary.tsx#L114)

###### Returns

`void`

##### render()

> **render**(): `ReactNode`

Defined in: [src/components/RootErrorBoundary.tsx:126](https://github.com/wenakita/4626/blob/main/frontend/src/components/RootErrorBoundary.tsx#L126)

###### Returns

`ReactNode`

###### Overrides

`Component.render`

##### getDerivedStateFromError()

> `static` **getDerivedStateFromError**(`error`): `Partial`\<`RootErrorBoundaryState`\>

Defined in: [src/components/RootErrorBoundary.tsx:101](https://github.com/wenakita/4626/blob/main/frontend/src/components/RootErrorBoundary.tsx#L101)

###### Parameters

###### error

`Error`

###### Returns

`Partial`\<`RootErrorBoundaryState`\>
