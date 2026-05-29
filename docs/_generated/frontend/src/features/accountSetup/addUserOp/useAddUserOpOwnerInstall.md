[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / src/features/accountSetup/addUserOp/useAddUserOpOwnerInstall

# src/features/accountSetup/addUserOp/useAddUserOpOwnerInstall

## Type Aliases

### AddUserOpOwnerInstallPublicClient

> **AddUserOpOwnerInstallPublicClient** = `Pick`\<`PublicClient`, `"getTransaction"` \| `"waitForTransactionReceipt"` \| `"readContract"` \| `"getBytecode"`\>

Defined in: [src/features/accountSetup/addUserOp/useAddUserOpOwnerInstall.ts:90](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/addUserOp/useAddUserOpOwnerInstall.ts#L90)

***

### UseAddUserOpOwnerInstallParams

> **UseAddUserOpOwnerInstallParams** = `object`

Defined in: [src/features/accountSetup/addUserOp/useAddUserOpOwnerInstall.ts:95](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/addUserOp/useAddUserOpOwnerInstall.ts#L95)

#### Properties

##### authHeaders()

> **authHeaders**: () => `Promise`\<`Record`\<`string`, `string`\>\>

Defined in: [src/features/accountSetup/addUserOp/useAddUserOpOwnerInstall.ts:98](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/addUserOp/useAddUserOpOwnerInstall.ts#L98)

###### Returns

`Promise`\<`Record`\<`string`, `string`\>\>

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null` \| `undefined`

Defined in: [src/features/accountSetup/addUserOp/useAddUserOpOwnerInstall.ts:96](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/addUserOp/useAddUserOpOwnerInstall.ts#L96)

##### enabled?

> `optional` **enabled**: `boolean`

Defined in: [src/features/accountSetup/addUserOp/useAddUserOpOwnerInstall.ts:100](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/addUserOp/useAddUserOpOwnerInstall.ts#L100)

##### onSuccess()?

> `optional` **onSuccess**: () => `void` \| `Promise`\<`void`\>

Defined in: [src/features/accountSetup/addUserOp/useAddUserOpOwnerInstall.ts:101](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/addUserOp/useAddUserOpOwnerInstall.ts#L101)

###### Returns

`void` \| `Promise`\<`void`\>

##### privyEmbeddedEoaAddress

> **privyEmbeddedEoaAddress**: `string` \| `null` \| `undefined`

Defined in: [src/features/accountSetup/addUserOp/useAddUserOpOwnerInstall.ts:97](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/addUserOp/useAddUserOpOwnerInstall.ts#L97)

##### publicClient

> **publicClient**: [`AddUserOpOwnerInstallPublicClient`](#adduseropownerinstallpublicclient) \| `undefined`

Defined in: [src/features/accountSetup/addUserOp/useAddUserOpOwnerInstall.ts:99](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/addUserOp/useAddUserOpOwnerInstall.ts#L99)

## Functions

### useAddUserOpOwnerInstall()

> **useAddUserOpOwnerInstall**(`params`): `object`

Defined in: [src/features/accountSetup/addUserOp/useAddUserOpOwnerInstall.ts:104](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/addUserOp/useAddUserOpOwnerInstall.ts#L104)

#### Parameters

##### params

[`UseAddUserOpOwnerInstallParams`](#useadduseropownerinstallparams)

#### Returns

`object`

##### alreadyOwner

> **alreadyOwner**: `boolean`

##### busy

> **busy**: `boolean`

##### callBundleId

> **callBundleId**: `string` \| `null`

##### eventLog

> **eventLog**: `string`[]

##### fundingAssessment

> **fundingAssessment**: [`CswFundingAssessment`](../../../lib/wallet/cswEntryPointFunding.md#cswfundingassessment) \| `null`

##### fundingLoading

> **fundingLoading**: `boolean`

##### handleSubmitUserOp()

> **handleSubmitUserOp**: () => `Promise`\<`boolean`\>

###### Returns

`Promise`\<`boolean`\>

##### inBaseApp

> **inBaseApp**: `boolean`

##### loadPrepare()

> **loadPrepare**: () => `Promise`\<\{ `alreadyOwner`: `true`; \} \| \{ `alreadyOwner`: `false`; `txRequest`: [`PreparedOwnerTxRequest`](../../../lib/wallet/zoraAddOwnerApi.md#preparedownertxrequest); \} \| `null`\>

###### Returns

`Promise`\<\{ `alreadyOwner`: `true`; \} \| \{ `alreadyOwner`: `false`; `txRequest`: [`PreparedOwnerTxRequest`](../../../lib/wallet/zoraAddOwnerApi.md#preparedownertxrequest); \} \| `null`\>

##### pageError

> **pageError**: `string` \| `null`

##### pageNotice

> **pageNotice**: `string` \| `null`

##### preparedTx

> **preparedTx**: [`PreparedOwnerTxRequest`](../../../lib/wallet/zoraAddOwnerApi.md#preparedownertxrequest) \| `null`

##### prepareLoading

> **prepareLoading**: `boolean`

##### refreshFunding()

> **refreshFunding**: () => `Promise`\<[`CswFundingAssessment`](../../../lib/wallet/cswEntryPointFunding.md#cswfundingassessment) \| `null`\>

###### Returns

`Promise`\<[`CswFundingAssessment`](../../../lib/wallet/cswEntryPointFunding.md#cswfundingassessment) \| `null`\>

##### submitPhase

> **submitPhase**: `"idle"` \| `"awaiting_signature"` \| `"broadcasting"` \| `"confirming"` \| `"verifying"`

##### txHash

> **txHash**: `string` \| `null`
