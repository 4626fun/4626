[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/chat/dmRouting

# src/components/chat/dmRouting

## Type Aliases

### DmRouteDecision

> **DmRouteDecision** = `object`

Defined in: [src/components/chat/dmRouting.ts:3](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/dmRouting.ts#L3)

#### Properties

##### notice

> **notice**: `string` \| `null`

Defined in: [src/components/chat/dmRouting.ts:5](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/dmRouting.ts#L5)

##### recipient

> **recipient**: [`DmRecipientResolution`](../../lib/xmtp/socialIdentity.md#dmrecipientresolution)

Defined in: [src/components/chat/dmRouting.ts:4](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/dmRouting.ts#L4)

##### reroutedToAgent

> **reroutedToAgent**: `boolean`

Defined in: [src/components/chat/dmRouting.ts:6](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/dmRouting.ts#L6)

## Functions

### resolveDmRoute()

> **resolveDmRoute**(`params`): [`DmRouteDecision`](#dmroutedecision)

Defined in: [src/components/chat/dmRouting.ts:9](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/dmRouting.ts#L9)

#### Parameters

##### params

###### agentAddress?

`string` \| `null`

###### agentDisplayName

`string`

###### connectedAddress?

`string` \| `null`

###### identityAddress?

`string` \| `null`

###### recipient

[`DmRecipientResolution`](../../lib/xmtp/socialIdentity.md#dmrecipientresolution)

#### Returns

[`DmRouteDecision`](#dmroutedecision)
