[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lottery/amoeCreatorTarget

# server/\_lib/lottery/amoeCreatorTarget

## Type Aliases

### AmoeCreatorTargetResolution

> **AmoeCreatorTargetResolution** = \{ `creatorCoin`: `` `0x${string}` ``; `ok`: `true`; `source`: `"request"` \| `"protocol-default"`; \} \| \{ `error`: `"invalid_creator_coin"` \| `"amoe_default_creator_coin_not_configured"`; `ok`: `false`; \}

Defined in: [server/\_lib/lottery/amoeCreatorTarget.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeCreatorTarget.ts#L7)

## Functions

### readProtocolAmoeCreatorCoin()

> **readProtocolAmoeCreatorCoin**(): `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/lottery/amoeCreatorTarget.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeCreatorTarget.ts#L17)

#### Returns

`` `0x${string}` `` \| `null`

***

### resolveAmoeCreatorTarget()

> **resolveAmoeCreatorTarget**(`value`): [`AmoeCreatorTargetResolution`](#amoecreatortargetresolution)

Defined in: [server/\_lib/lottery/amoeCreatorTarget.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeCreatorTarget.ts#L25)

#### Parameters

##### value

`unknown`

#### Returns

[`AmoeCreatorTargetResolution`](#amoecreatortargetresolution)
