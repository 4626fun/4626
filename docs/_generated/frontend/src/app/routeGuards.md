[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/app/routeGuards

# src/app/routeGuards

## Functions

### AuthenticatedAppLayout()

> **AuthenticatedAppLayout**(): `Element`

Defined in: [src/app/routeGuards.tsx:104](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/app/routeGuards.tsx#L104)

#### Returns

`Element`

***

### getGenericNotFoundCta()

> **getGenericNotFoundCta**(`hostMode`): `object`

Defined in: [src/app/routeGuards.tsx:132](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/app/routeGuards.tsx#L132)

#### Parameters

##### hostMode

[`HostMode`](../lib/env/host.md#hostmode)

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

Defined in: [src/app/routeGuards.tsx:78](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/app/routeGuards.tsx#L78)

Redirect from 4626.fun to app.4626.fun when user hits app-only routes.

#### Returns

`Element` \| `null`

***

### marketingOnlyElement()

> **marketingOnlyElement**(`element`): `Element`

Defined in: [src/app/routeGuards.tsx:100](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/app/routeGuards.tsx#L100)

#### Parameters

##### element

`ReactNode`

#### Returns

`Element`

***

### MarketingOnlyRoute()

> **MarketingOnlyRoute**(`props`): `Element`

Defined in: [src/app/routeGuards.tsx:90](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/app/routeGuards.tsx#L90)

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

Defined in: [src/app/routeGuards.tsx:112](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/app/routeGuards.tsx#L112)

#### Returns

`Element`

***

### SessionAcceptedRoute()

> **SessionAcceptedRoute**(`props`): `Element`

Defined in: [src/app/routeGuards.tsx:120](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/app/routeGuards.tsx#L120)

#### Parameters

##### props

###### children?

`ReactNode`

#### Returns

`Element`

***

### SmartWalletRoute()

> **SmartWalletRoute**(`props`): `Element`

Defined in: [src/app/routeGuards.tsx:116](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/app/routeGuards.tsx#L116)

#### Parameters

##### props

###### children

`ReactNode`

#### Returns

`Element`
