[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / src/features/accountSetup/zoraAddOwner/useZoraAddOwnerFlow

# src/features/accountSetup/zoraAddOwner/useZoraAddOwnerFlow

## Functions

### useZoraAddOwnerFlow()

> **useZoraAddOwnerFlow**(`params`): `object`

Defined in: [src/features/accountSetup/zoraAddOwner/useZoraAddOwnerFlow.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/zoraAddOwner/useZoraAddOwnerFlow.ts#L23)

#### Parameters

##### params

`UseZoraAddOwnerFlowParams`

#### Returns

`object`

##### alreadyOwner

> **alreadyOwner**: `boolean`

##### busy

> **busy**: `boolean`

##### handleEnableSigning()

> **handleEnableSigning**: () => `Promise`\<`boolean`\>

###### Returns

`Promise`\<`boolean`\>

##### loadPrepare()

> **loadPrepare**: () => `Promise`\<`PrepareAddPrivyOwnerResponse` \| `null`\>

###### Returns

`Promise`\<`PrepareAddPrivyOwnerResponse` \| `null`\>

##### pageError

> **pageError**: `string` \| `null`

##### pageNotice

> **pageNotice**: `string` \| `null`

##### prepareLoading

> **prepareLoading**: `boolean`

##### txHash

> **txHash**: `string` \| `null`

##### txRequest

> **txRequest**: [`PreparedOwnerTxRequest`](../../../lib/wallet/zoraAddOwnerApi.md#preparedownertxrequest) \| `null`
