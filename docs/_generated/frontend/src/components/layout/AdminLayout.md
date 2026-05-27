[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/layout/AdminLayout

# src/components/layout/AdminLayout

## Functions

### AdminLayout()

> **AdminLayout**(): `Element`

Defined in: [src/components/layout/AdminLayout.tsx:64](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/layout/AdminLayout.tsx#L64)

Shared layout for all /admin/* routes.

Handles:
 1. Connect-wallet gate
 2. SIWE sign-in gate
 3. Tab navigation between admin sections

Once authenticated, child routes render via <Outlet />.

#### Returns

`Element`
