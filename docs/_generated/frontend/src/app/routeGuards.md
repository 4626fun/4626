[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / src/app/routeGuards

# src/app/routeGuards

## Functions

### AuthenticatedAppLayout()

> **AuthenticatedAppLayout**(): `Element`

Defined in: [src/app/routeGuards.tsx:109](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/app/routeGuards.tsx#L109)

#### Returns

`Element`

***

### getGenericNotFoundCta()

> **getGenericNotFoundCta**(`hostMode`): `object`

Defined in: [src/app/routeGuards.tsx:137](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/app/routeGuards.tsx#L137)

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

Defined in: [src/app/routeGuards.tsx:78](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/app/routeGuards.tsx#L78)

Redirect from 4626.fun to app.4626.fun when user hits app-only routes.

#### Returns

`Element` \| `null`

***

### marketingOnlyElement()

> **marketingOnlyElement**(`element`): `Element`

Defined in: [src/app/routeGuards.tsx:105](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/app/routeGuards.tsx#L105)

#### Parameters

##### element

`ReactNode`

#### Returns

`Element`

***

### MarketingOnlyRoute()

> **MarketingOnlyRoute**(`props`): `Element`

Defined in: [src/app/routeGuards.tsx:90](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/app/routeGuards.tsx#L90)

Restrict route content to marketing domain; app host redirects cross-origin.

#### Parameters

##### props

###### children

`ReactNode`

#### Returns

`Element`

***

### MarketingWaitlistRoute()

> **MarketingWaitlistRoute**(`props`): `Element`

Defined in: [src/app/routeGuards.tsx:101](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/app/routeGuards.tsx#L101)

Waitlist onboarding must run on 4626.fun so sub-accounts bind to the marketing domain.

#### Parameters

##### props

###### children

`ReactNode`

#### Returns

`Element`

***

### PublicAppLayout()

> **PublicAppLayout**(): `Element`

Defined in: [src/app/routeGuards.tsx:117](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/app/routeGuards.tsx#L117)

#### Returns

`Element`

***

### SessionAcceptedRoute()

> **SessionAcceptedRoute**(`props`): `Element`

Defined in: [src/app/routeGuards.tsx:125](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/app/routeGuards.tsx#L125)

#### Parameters

##### props

###### children?

`ReactNode`

#### Returns

`Element`

***

### SmartWalletRoute()

> **SmartWalletRoute**(`props`): `Element`

Defined in: [src/app/routeGuards.tsx:121](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/app/routeGuards.tsx#L121)

#### Parameters

##### props

###### children

`ReactNode`

#### Returns

`Element`
