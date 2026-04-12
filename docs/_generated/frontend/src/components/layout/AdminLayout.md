[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/layout/AdminLayout

# src/components/layout/AdminLayout

## Functions

### AdminLayout()

> **AdminLayout**(): `Element`

Defined in: [src/components/layout/AdminLayout.tsx:52](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/components/layout/AdminLayout.tsx#L52)

Shared layout for all /admin/* routes.

Handles:
 1. Connect-wallet gate
 2. SIWE sign-in gate
 3. Tab navigation between admin sections

Once authenticated, child routes render via <Outlet />.

#### Returns

`Element`
