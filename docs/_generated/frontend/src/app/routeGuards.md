[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/app/routeGuards

# src/app/routeGuards

## Functions

### AuthenticatedAppLayout()

> **AuthenticatedAppLayout**(): `Element`

Defined in: [src/app/routeGuards.tsx:101](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/app/routeGuards.tsx#L101)

#### Returns

`Element`

***

### getGenericNotFoundCta()

> **getGenericNotFoundCta**(`hostMode`): `object`

Defined in: [src/app/routeGuards.tsx:129](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/app/routeGuards.tsx#L129)

#### Parameters

##### hostMode

[`HostMode`](../lib/host.md#hostmode)

#### Returns

`object`

##### hint

> **hint**: `string`

##### href

> **href**: `string`

##### label

> **label**: `string`

***

### HostGuard()

> **HostGuard**(): `Element` \| `null`

Defined in: [src/app/routeGuards.tsx:75](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/app/routeGuards.tsx#L75)

Redirect from 4626.fun to v1.4626.fun when user hits app-only routes.

#### Returns

`Element` \| `null`

***

### marketingOnlyElement()

> **marketingOnlyElement**(`element`): `Element`

Defined in: [src/app/routeGuards.tsx:97](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/app/routeGuards.tsx#L97)

#### Parameters

##### element

`ReactNode`

#### Returns

`Element`

***

### MarketingOnlyRoute()

> **MarketingOnlyRoute**(`props`): `Element`

Defined in: [src/app/routeGuards.tsx:87](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/app/routeGuards.tsx#L87)

Restrict route content to marketing domain; app host redirects cross-origin.

#### Parameters

##### props

###### children

`ReactNode`

#### Returns

`Element`

***

### PublicAppLayout()

> **PublicAppLayout**(): `Element`

Defined in: [src/app/routeGuards.tsx:109](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/app/routeGuards.tsx#L109)

#### Returns

`Element`

***

### SessionAcceptedRoute()

> **SessionAcceptedRoute**(`props`): `Element`

Defined in: [src/app/routeGuards.tsx:117](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/app/routeGuards.tsx#L117)

#### Parameters

##### props

###### children?

`ReactNode`

#### Returns

`Element`

***

### SmartWalletRoute()

> **SmartWalletRoute**(`props`): `Element`

Defined in: [src/app/routeGuards.tsx:113](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/app/routeGuards.tsx#L113)

#### Parameters

##### props

###### children

`ReactNode`

#### Returns

`Element`
