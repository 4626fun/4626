[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/onchain/baseRpcUrl

# server/\_lib/onchain/baseRpcUrl

## Functions

### isLocalForkRpcUrl()

> **isLocalForkRpcUrl**(`rpcUrl`): `boolean`

Defined in: [server/\_lib/onchain/baseRpcUrl.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/baseRpcUrl.ts#L10)

True when the URL targets a local Anvil/Hardhat fork (deploy dry-run only).

#### Parameters

##### rpcUrl

`string`

#### Returns

`boolean`

***

### normalizeViemHttpRpcUrl()

> **normalizeViemHttpRpcUrl**(`rpcUrl`): `string`

Defined in: [server/\_lib/onchain/baseRpcUrl.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/baseRpcUrl.ts#L15)

viem `http()` cannot speak WebSocket — coerce ws(s) env URLs to http(s).

#### Parameters

##### rpcUrl

`string`

#### Returns

`string`

***

### resolveDeploySessionRpcUrl()

> **resolveDeploySessionRpcUrl**(): `string`

Defined in: [server/\_lib/onchain/baseRpcUrl.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/baseRpcUrl.ts#L52)

Deploy session / dry-run RPC. Prefers `DEPLOY_DRY_RUN_LOCAL_RPC_URL`, then any
localhost entry in `BASE_RPC_URL`, otherwise live mainnet.

#### Returns

`string`

***

### resolveServerBaseRpcUrl()

> **resolveServerBaseRpcUrl**(`options?`): `string`

Defined in: [server/\_lib/onchain/baseRpcUrl.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/baseRpcUrl.ts#L44)

#### Parameters

##### options?

###### allowLocalFork?

`boolean`

#### Returns

`string`

***

### resolveServerBaseRpcUrls()

> **resolveServerBaseRpcUrls**(`options?`): `string`[]

Defined in: [server/\_lib/onchain/baseRpcUrl.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/baseRpcUrl.ts#L36)

Server-side Base RPC for live mainnet reads (owner-install preview, Relay simulation, etc.).
Local fork URLs are ignored unless explicitly allowed — deploy dry-run must not leak into
`/api/onboarding/preview-*` when Anvil is not running.

#### Parameters

##### options?

###### allowLocalFork?

`boolean`

#### Returns

`string`[]
