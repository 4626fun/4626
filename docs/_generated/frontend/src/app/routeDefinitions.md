[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / src/app/routeDefinitions

# src/app/routeDefinitions

## Type Aliases

### PathRouteDef

> **PathRouteDef** = `object`

Defined in: [src/app/routeDefinitions.tsx:53](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/app/routeDefinitions.tsx#L53)

#### Properties

##### children?

> `optional` **children**: [`PathRouteDef`](#pathroutedef)[]

Defined in: [src/app/routeDefinitions.tsx:57](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/app/routeDefinitions.tsx#L57)

##### element

> **element**: `ReactNode`

Defined in: [src/app/routeDefinitions.tsx:55](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/app/routeDefinitions.tsx#L55)

##### index?

> `optional` **index**: `boolean`

Defined in: [src/app/routeDefinitions.tsx:56](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/app/routeDefinitions.tsx#L56)

##### path

> **path**: `string`

Defined in: [src/app/routeDefinitions.tsx:54](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/app/routeDefinitions.tsx#L54)

## Variables

### ACCOUNT\_ROUTES

> `const` **ACCOUNT\_ROUTES**: [`PathRouteDef`](#pathroutedef)[]

Defined in: [src/app/routeDefinitions.tsx:101](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/app/routeDefinitions.tsx#L101)

`/accounts` is the identity + execution-scope surface (canonical CSW,
signers, sub-account state, advanced owner recovery).

Previously this route redirected to `/waitlist` because the waitlist
flow had absorbed the old `/accounts` content. Reinstated 2026-04-19
so the new identity card + ExecutionScopeCard + AutoProvisionMount
actually render somewhere users can reach them. `/waitlist` stays
focused on net-new onboarding (Zora link, owner install, points)
while `/accounts` handles day-two operations on an already-linked
identity.

Wrapped in `SmartWalletRoute` so `useSmartWallets()` is available —
the sub-account SpendPermission flow signs via Privy's ERC-1271
smart-wallet client for Zora-cross-app profiles whose Privy embedded
EOA isn't on the parent CSW owner list.

***

### ADMIN\_CHILD\_ROUTES

> `const` **ADMIN\_CHILD\_ROUTES**: [`PathRouteDef`](#pathroutedef)[]

Defined in: [src/app/routeDefinitions.tsx:207](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/app/routeDefinitions.tsx#L207)

***

### APP\_ACCEPTED\_ROUTES

> `const` **APP\_ACCEPTED\_ROUTES**: [`PathRouteDef`](#pathroutedef)[]

Defined in: [src/app/routeDefinitions.tsx:156](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/app/routeDefinitions.tsx#L156)

***

### EXPLORE\_LIST\_CHILD\_ROUTES

> `const` **EXPLORE\_LIST\_CHILD\_ROUTES**: [`PathRouteDef`](#pathroutedef)[]

Defined in: [src/app/routeDefinitions.tsx:124](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/app/routeDefinitions.tsx#L124)

***

### EXPLORE\_ROUTES

> `const` **EXPLORE\_ROUTES**: [`PathRouteDef`](#pathroutedef)[]

Defined in: [src/app/routeDefinitions.tsx:133](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/app/routeDefinitions.tsx#L133)

***

### MARKETING\_ONLY\_ROUTES

> `const` **MARKETING\_ONLY\_ROUTES**: [`PathRouteDef`](#pathroutedef)[]

Defined in: [src/app/routeDefinitions.tsx:76](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/app/routeDefinitions.tsx#L76)

## Functions

### renderPathRoutes()

> **renderPathRoutes**(`routes`, `transformElement?`): `Element`[]

Defined in: [src/app/routeDefinitions.tsx:60](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/app/routeDefinitions.tsx#L60)

#### Parameters

##### routes

[`PathRouteDef`](#pathroutedef)[]

##### transformElement?

(`element`) => `ReactNode`

#### Returns

`Element`[]
