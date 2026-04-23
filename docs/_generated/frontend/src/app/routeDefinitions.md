[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/app/routeDefinitions

# src/app/routeDefinitions

## Type Aliases

### PathRouteDef

> **PathRouteDef** = `object`

Defined in: [src/app/routeDefinitions.tsx:50](https://github.com/wenakita/4626/blob/main/frontend/src/app/routeDefinitions.tsx#L50)

#### Properties

##### element

> **element**: `ReactNode`

Defined in: [src/app/routeDefinitions.tsx:50](https://github.com/wenakita/4626/blob/main/frontend/src/app/routeDefinitions.tsx#L50)

##### path

> **path**: `string`

Defined in: [src/app/routeDefinitions.tsx:50](https://github.com/wenakita/4626/blob/main/frontend/src/app/routeDefinitions.tsx#L50)

## Variables

### ACCOUNT\_ROUTES

> `const` **ACCOUNT\_ROUTES**: [`PathRouteDef`](#pathroutedef)[]

Defined in: [src/app/routeDefinitions.tsx:89](https://github.com/wenakita/4626/blob/main/frontend/src/app/routeDefinitions.tsx#L89)

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

Defined in: [src/app/routeDefinitions.tsx:175](https://github.com/wenakita/4626/blob/main/frontend/src/app/routeDefinitions.tsx#L175)

***

### APP\_ACCEPTED\_ROUTES

> `const` **APP\_ACCEPTED\_ROUTES**: [`PathRouteDef`](#pathroutedef)[]

Defined in: [src/app/routeDefinitions.tsx:131](https://github.com/wenakita/4626/blob/main/frontend/src/app/routeDefinitions.tsx#L131)

***

### EXPLORE\_ROUTES

> `const` **EXPLORE\_ROUTES**: [`PathRouteDef`](#pathroutedef)[]

Defined in: [src/app/routeDefinitions.tsx:108](https://github.com/wenakita/4626/blob/main/frontend/src/app/routeDefinitions.tsx#L108)

***

### MARKETING\_ONLY\_ROUTES

> `const` **MARKETING\_ONLY\_ROUTES**: [`PathRouteDef`](#pathroutedef)[]

Defined in: [src/app/routeDefinitions.tsx:65](https://github.com/wenakita/4626/blob/main/frontend/src/app/routeDefinitions.tsx#L65)

## Functions

### renderPathRoutes()

> **renderPathRoutes**(`routes`, `transformElement?`): `Element`[]

Defined in: [src/app/routeDefinitions.tsx:52](https://github.com/wenakita/4626/blob/main/frontend/src/app/routeDefinitions.tsx#L52)

#### Parameters

##### routes

[`PathRouteDef`](#pathroutedef)[]

##### transformElement?

(`element`) => `ReactNode`

#### Returns

`Element`[]
