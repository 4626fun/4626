[**4626-app**](../index.md)

***

[4626-app](../index.md) / src/App

# src/App

## Functions

### computeAcceptedFromAllowlist()

> **computeAcceptedFromAllowlist**(`params`): `boolean`

Defined in: [src/App.tsx:61](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/App.tsx#L61)

#### Parameters

##### params

###### allowlisted

`boolean`

###### mode

`ResolvedAllowlistMode`

#### Returns

`boolean`

***

### default()

> **default**(): `Element`

Defined in: [src/App.tsx:551](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/App.tsx#L551)

#### Returns

`Element`

***

### resolveAccess()

> **resolveAccess**(`routeId`, `state`): `AccessDecision`

Defined in: [src/App.tsx:101](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/App.tsx#L101)

#### Parameters

##### routeId

`RouteId`

##### state

`AccessState`

#### Returns

`AccessDecision`

***

### resolveAllowlistMode()

> **resolveAllowlistMode**(`params`): `ResolvedAllowlistMode`

Defined in: [src/App.tsx:52](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/App.tsx#L52)

#### Parameters

##### params

###### modeFromAddress?

`CreatorAllowlistMode` \| `null`

###### modeFromGlobal?

`CreatorAllowlistMode` \| `null`

#### Returns

`ResolvedAllowlistMode`

***

### useAccessContext()

> **useAccessContext**(): `AccessState`

Defined in: [src/App.tsx:231](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/App.tsx#L231)

#### Returns

`AccessState`
