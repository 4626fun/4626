[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/dev/localDevEnv

# server/\_lib/dev/localDevEnv

## Functions

### applyDeployDryRunLocalDevEnv()

> **applyDeployDryRunLocalDevEnv**(): `void`

Defined in: [server/\_lib/dev/localDevEnv.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dev/localDevEnv.ts#L26)

Apply deploy-dry-run env policy after Vite loads dotenv files from disk.

#### Returns

`void`

***

### applyLocalDevServerEnv()

> **applyLocalDevServerEnv**(): `void`

Defined in: [server/\_lib/dev/localDevEnv.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dev/localDevEnv.ts#L43)

Dev-server env normalization for local API handlers (Vite configureServer).

#### Returns

`void`

***

### filterDevelopmentRpcUrls()

> **filterDevelopmentRpcUrls**(`urls`): `string`[]

Defined in: [server/\_lib/dev/localDevEnv.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dev/localDevEnv.ts#L53)

Drop slow dev-only upstreams when faster URLs are already configured.

#### Parameters

##### urls

`string`[]

#### Returns

`string`[]

***

### isDeployDryRunContext()

> **isDeployDryRunContext**(): `boolean`

Defined in: [server/\_lib/dev/localDevEnv.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dev/localDevEnv.ts#L3)

Shared local-dev / deploy-dry-run env helpers for Vite + API handlers.

#### Returns

`boolean`

***

### isDeployDryRunDbDisabled()

> **isDeployDryRunDbDisabled**(): `boolean`

Defined in: [server/\_lib/dev/localDevEnv.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dev/localDevEnv.ts#L14)

Dry-run defaults skip Postgres unless DEPLOY_DRY_RUN_KEEP_DB_ENV=1.

#### Returns

`boolean`

***

### isDeployDryRunDbEnabled()

> **isDeployDryRunDbEnabled**(): `boolean`

Defined in: [server/\_lib/dev/localDevEnv.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dev/localDevEnv.ts#L9)

#### Returns

`boolean`

***

### resolveLocalDryRunRpcUrl()

> **resolveLocalDryRunRpcUrl**(): `string` \| `null`

Defined in: [server/\_lib/dev/localDevEnv.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dev/localDevEnv.ts#L18)

#### Returns

`string` \| `null`
