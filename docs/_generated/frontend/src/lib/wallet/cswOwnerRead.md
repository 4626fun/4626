[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/wallet/cswOwnerRead

# src/lib/wallet/cswOwnerRead

## Functions

### fetchIsOwnerAddressViaApi()

> **fetchIsOwnerAddressViaApi**(`params`): `Promise`\<`boolean` \| `null`\>

Defined in: [src/lib/wallet/cswOwnerRead.ts:56](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerRead.ts#L56)

Server-side owner probe with RPC fallbacks — avoids false "not owner" reads from
wallet-injected or rate-limited browser RPC clients (DeployVault uses the same API).

#### Parameters

##### params

###### cswAddress

`string`

###### ownerAddress

`string`

#### Returns

`Promise`\<`boolean` \| `null`\>

***

### hasDeployedBytecode()

> **hasDeployedBytecode**(`bytecode`): `boolean`

Defined in: [src/lib/wallet/cswOwnerRead.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerRead.ts#L5)

#### Parameters

##### bytecode

`string` | `null` | `undefined`

#### Returns

`boolean`

***

### normalizeOwnerReadAddress()

> **normalizeOwnerReadAddress**(`value`): `string` \| `null`

Defined in: [src/lib/wallet/cswOwnerRead.ts:45](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerRead.ts#L45)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`string` \| `null`

***

### readCswBytecode()

> **readCswBytecode**(`publicClient`, `address`): `Promise`\<`` `0x${string}` `` \| `null`\>

Defined in: [src/lib/wallet/cswOwnerRead.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerRead.ts#L9)

#### Parameters

##### publicClient

`Pick`\<`PublicClient`, `"getBytecode"`\>

##### address

`string`

#### Returns

`Promise`\<`` `0x${string}` `` \| `null`\>

***

### readIsOwnerAddressIfDeployed()

> **readIsOwnerAddressIfDeployed**(`params`): `Promise`\<`boolean` \| `null`\>

Defined in: [src/lib/wallet/cswOwnerRead.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerRead.ts#L25)

Read `isOwnerAddress` only when the CSW has Base bytecode.
Returns `null` for counterfactual / not-yet-deployed addresses.

#### Parameters

##### params

###### cswAddress

`string`

###### ownerAddress

`string`

###### publicClient

`Pick`\<`PublicClient`, `"readContract"` \| `"getBytecode"`\>

#### Returns

`Promise`\<`boolean` \| `null`\>

***

### resolveEmbeddedOwnerOnCanonicalCsw()

> **resolveEmbeddedOwnerOnCanonicalCsw**(`params`): `Promise`\<`boolean` \| `null`\>

Defined in: [src/lib/wallet/cswOwnerRead.ts:80](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerRead.ts#L80)

Prefer server owner probe; fall back to local bytecode-guarded read.

#### Parameters

##### params

###### cswAddress

`string`

###### ownerAddress

`string`

###### publicClient

`Pick`\<`PublicClient`, `"readContract"` \| `"getBytecode"`\>

#### Returns

`Promise`\<`boolean` \| `null`\>
