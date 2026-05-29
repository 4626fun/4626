[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/deploy/solanaShareMeshPreflight

# server/\_lib/deploy/solanaShareMeshPreflight

## Type Aliases

### OvaultMeshPreflightResult

> **OvaultMeshPreflightResult** = `object`

Defined in: [server/\_lib/deploy/solanaShareMeshPreflight.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/solanaShareMeshPreflight.ts#L26)

#### Properties

##### assetPeerSet

> **assetPeerSet**: `boolean`

Defined in: [server/\_lib/deploy/solanaShareMeshPreflight.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/solanaShareMeshPreflight.ts#L30)

##### depositEligible

> **depositEligible**: `boolean`

Defined in: [server/\_lib/deploy/solanaShareMeshPreflight.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/solanaShareMeshPreflight.ts#L28)

##### existingMintCompatible

> **existingMintCompatible**: `boolean`

Defined in: [server/\_lib/deploy/solanaShareMeshPreflight.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/solanaShareMeshPreflight.ts#L27)

##### meshStep

> **meshStep**: `"ovault_mesh_confirmed"`

Defined in: [server/\_lib/deploy/solanaShareMeshPreflight.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/solanaShareMeshPreflight.ts#L32)

##### redeemEligible

> **redeemEligible**: `boolean`

Defined in: [server/\_lib/deploy/solanaShareMeshPreflight.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/solanaShareMeshPreflight.ts#L29)

##### sharePeerSet

> **sharePeerSet**: `boolean`

Defined in: [server/\_lib/deploy/solanaShareMeshPreflight.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/solanaShareMeshPreflight.ts#L31)

## Variables

### DEFAULT\_OVAULT\_MESH\_PREFLIGHT\_RESULT

> `const` **DEFAULT\_OVAULT\_MESH\_PREFLIGHT\_RESULT**: [`OvaultMeshPreflightResult`](#ovaultmeshpreflightresult)

Defined in: [server/\_lib/deploy/solanaShareMeshPreflight.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/solanaShareMeshPreflight.ts#L35)

## Functions

### ensureShareMeshOvaultPreflight()

> **ensureShareMeshOvaultPreflight**(`params`): `Promise`\<[`OvaultMeshPreflightResult`](#ovaultmeshpreflightresult)\>

Defined in: [server/\_lib/deploy/solanaShareMeshPreflight.ts:109](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/solanaShareMeshPreflight.ts#L109)

#### Parameters

##### params

###### finalizeCall

\{ `data`: `` `0x${string}` ``; `to`: `string`; \}

###### finalizeCall.data

`` `0x${string}` ``

###### finalizeCall.to

`string`

###### ovaultRequested

`boolean`

###### publicClient

`Pick`\<`PublicClient`, `"readContract"`\>

#### Returns

`Promise`\<[`OvaultMeshPreflightResult`](#ovaultmeshpreflightresult)\>

***

### isLegacySolanaBridgePreflightEnabled()

> **isLegacySolanaBridgePreflightEnabled**(): `boolean`

Defined in: [server/\_lib/deploy/solanaShareMeshPreflight.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/solanaShareMeshPreflight.ts#L44)

#### Returns

`boolean`

***

### isOvaultRequestEnabled()

> **isOvaultRequestEnabled**(`solanaOvault`): `boolean`

Defined in: [server/\_lib/deploy/solanaShareMeshPreflight.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/solanaShareMeshPreflight.ts#L53)

#### Parameters

##### solanaOvault

`unknown`

#### Returns

`boolean`
