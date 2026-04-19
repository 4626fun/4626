[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/layout/AdminLayout

# src/components/layout/AdminLayout

## Functions

### AdminLayout()

> **AdminLayout**(): `Element`

Defined in: [src/components/layout/AdminLayout.tsx:57](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/layout/AdminLayout.tsx#L57)

Shared layout for all /admin/* routes.

Handles:
 1. Connect-wallet gate
 2. SIWE sign-in gate
 3. Tab navigation between admin sections

Once authenticated, child routes render via <Outlet />.

#### Returns

`Element`
