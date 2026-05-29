[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/base/productionBaseReadClient

# src/lib/base/productionBaseReadClient

## Variables

### PRODUCTION\_BASE\_RPC\_PROXY

> `const` **PRODUCTION\_BASE\_RPC\_PROXY**: `"/api/rpc?chain=base&skipLocalFork=1"` = `'/api/rpc?chain=base&skipLocalFork=1'`

Defined in: [src/lib/base/productionBaseReadClient.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/base/productionBaseReadClient.ts#L5)

Same-origin Base reads that skip deploy-dry-run Anvil fork when present.

## Functions

### getProductionBaseReadClient()

> **getProductionBaseReadClient**(): `object`

Defined in: [src/lib/base/productionBaseReadClient.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/lib/base/productionBaseReadClient.ts#L13)

Mainnet Base reads for swap/permit paths that submit UserOps to live CDP infra.
Deploy-dry-run otherwise routes `/api/rpc?chain=base` through a local fork first.

#### Returns

`object`
