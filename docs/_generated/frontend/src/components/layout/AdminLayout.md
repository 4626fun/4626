[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/layout/AdminLayout

# src/components/layout/AdminLayout

## Functions

### AdminLayout()

> **AdminLayout**(): `Element`

Defined in: [src/components/layout/AdminLayout.tsx:57](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/components/layout/AdminLayout.tsx#L57)

Shared layout for all /admin/* routes.

Handles:
 1. Connect-wallet gate
 2. SIWE sign-in gate
 3. Tab navigation between admin sections

Once authenticated, child routes render via <Outlet />.

#### Returns

`Element`
