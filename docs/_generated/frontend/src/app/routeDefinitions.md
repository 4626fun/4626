[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/app/routeDefinitions

# src/app/routeDefinitions

## Type Aliases

### PathRouteDef

> **PathRouteDef** = `object`

Defined in: [src/app/routeDefinitions.tsx:52](https://github.com/wenakita/4626/blob/main/frontend/src/app/routeDefinitions.tsx#L52)

#### Properties

##### element

> **element**: `ReactNode`

Defined in: [src/app/routeDefinitions.tsx:52](https://github.com/wenakita/4626/blob/main/frontend/src/app/routeDefinitions.tsx#L52)

##### path

> **path**: `string`

Defined in: [src/app/routeDefinitions.tsx:52](https://github.com/wenakita/4626/blob/main/frontend/src/app/routeDefinitions.tsx#L52)

## Variables

### ACCOUNT\_ROUTES

> `const` **ACCOUNT\_ROUTES**: [`PathRouteDef`](#pathroutedef)[]

Defined in: [src/app/routeDefinitions.tsx:91](https://github.com/wenakita/4626/blob/main/frontend/src/app/routeDefinitions.tsx#L91)

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

Defined in: [src/app/routeDefinitions.tsx:189](https://github.com/wenakita/4626/blob/main/frontend/src/app/routeDefinitions.tsx#L189)

***

### APP\_ACCEPTED\_ROUTES

> `const` **APP\_ACCEPTED\_ROUTES**: [`PathRouteDef`](#pathroutedef)[]

Defined in: [src/app/routeDefinitions.tsx:137](https://github.com/wenakita/4626/blob/main/frontend/src/app/routeDefinitions.tsx#L137)

***

### EXPLORE\_ROUTES

> `const` **EXPLORE\_ROUTES**: [`PathRouteDef`](#pathroutedef)[]

Defined in: [src/app/routeDefinitions.tsx:114](https://github.com/wenakita/4626/blob/main/frontend/src/app/routeDefinitions.tsx#L114)

***

### MARKETING\_ONLY\_ROUTES

> `const` **MARKETING\_ONLY\_ROUTES**: [`PathRouteDef`](#pathroutedef)[]

Defined in: [src/app/routeDefinitions.tsx:67](https://github.com/wenakita/4626/blob/main/frontend/src/app/routeDefinitions.tsx#L67)

## Functions

### renderPathRoutes()

> **renderPathRoutes**(`routes`, `transformElement?`): `Element`[]

Defined in: [src/app/routeDefinitions.tsx:54](https://github.com/wenakita/4626/blob/main/frontend/src/app/routeDefinitions.tsx#L54)

#### Parameters

##### routes

[`PathRouteDef`](#pathroutedef)[]

##### transformElement?

(`element`) => `ReactNode`

#### Returns

`Element`[]
