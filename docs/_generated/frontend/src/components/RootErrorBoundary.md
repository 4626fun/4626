[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/components/RootErrorBoundary

# src/components/RootErrorBoundary

## Classes

### RootErrorBoundary

Defined in: [src/components/RootErrorBoundary.tsx:50](https://github.com/wenakita/4626/blob/main/frontend/src/components/RootErrorBoundary.tsx#L50)

#### Extends

- `Component`\<`RootErrorBoundaryProps`, `RootErrorBoundaryState`\>

#### Constructors

##### Constructor

> **new RootErrorBoundary**(`props`): [`RootErrorBoundary`](#rooterrorboundary)

Defined in: [src/components/RootErrorBoundary.tsx:51](https://github.com/wenakita/4626/blob/main/frontend/src/components/RootErrorBoundary.tsx#L51)

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

Defined in: [src/components/RootErrorBoundary.tsx:60](https://github.com/wenakita/4626/blob/main/frontend/src/components/RootErrorBoundary.tsx#L60)

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

Defined in: [src/components/RootErrorBoundary.tsx:75](https://github.com/wenakita/4626/blob/main/frontend/src/components/RootErrorBoundary.tsx#L75)

###### Returns

`void`

##### handleRetry()

> **handleRetry**(): `void`

Defined in: [src/components/RootErrorBoundary.tsx:67](https://github.com/wenakita/4626/blob/main/frontend/src/components/RootErrorBoundary.tsx#L67)

###### Returns

`void`

##### render()

> **render**(): `ReactNode`

Defined in: [src/components/RootErrorBoundary.tsx:81](https://github.com/wenakita/4626/blob/main/frontend/src/components/RootErrorBoundary.tsx#L81)

###### Returns

`ReactNode`

###### Overrides

`Component.render`

##### getDerivedStateFromError()

> `static` **getDerivedStateFromError**(`error`): `Partial`\<`RootErrorBoundaryState`\>

Defined in: [src/components/RootErrorBoundary.tsx:56](https://github.com/wenakita/4626/blob/main/frontend/src/components/RootErrorBoundary.tsx#L56)

###### Parameters

###### error

`Error`

###### Returns

`Partial`\<`RootErrorBoundaryState`\>
