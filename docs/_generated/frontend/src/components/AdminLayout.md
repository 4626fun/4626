[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/components/AdminLayout

# src/components/AdminLayout

## Functions

### AdminLayout()

> **AdminLayout**(): `Element`

Defined in: [src/components/AdminLayout.tsx:52](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/AdminLayout.tsx#L52)

Shared layout for all /admin/* routes.

Handles:
 1. Connect-wallet gate
 2. SIWE sign-in gate
 3. Tab navigation between admin sections

Once authenticated, child routes render via <Outlet />.

#### Returns

`Element`
