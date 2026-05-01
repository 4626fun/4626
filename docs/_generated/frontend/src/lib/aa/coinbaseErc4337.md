[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/aa/coinbaseErc4337

# src/lib/aa/coinbaseErc4337

## Type Aliases

### PollUserOperationStatusOptions

> **PollUserOperationStatusOptions** = `object`

Defined in: [src/lib/aa/coinbaseErc4337.ts:414](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L414)

#### Properties

##### maxDurationMs?

> `optional` **maxDurationMs**: `number`

Defined in: [src/lib/aa/coinbaseErc4337.ts:416](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L416)

##### onError()?

> `optional` **onError**: (`error`) => `void`

Defined in: [src/lib/aa/coinbaseErc4337.ts:419](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L419)

###### Parameters

###### error

`Error`

###### Returns

`void`

##### onStatusChange()?

> `optional` **onStatusChange**: (`status`, `txHash?`) => `void`

Defined in: [src/lib/aa/coinbaseErc4337.ts:418](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L418)

###### Parameters

###### status

[`UserOpStatus`](#useropstatus)

###### txHash?

`Hex`

###### Returns

`void`

##### perCheckTimeoutMs?

> `optional` **perCheckTimeoutMs**: `number`

Defined in: [src/lib/aa/coinbaseErc4337.ts:417](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L417)

##### pollIntervalMs?

> `optional` **pollIntervalMs**: `number`

Defined in: [src/lib/aa/coinbaseErc4337.ts:415](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L415)

##### signal?

> `optional` **signal**: `AbortSignal`

Defined in: [src/lib/aa/coinbaseErc4337.ts:420](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L420)

***

### PublicClientLike

> **PublicClientLike** = `object` & `Record`\<`string`, `any`\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:200](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L200)

#### Type Declaration

##### chain

> **chain**: `object`

###### chain.id

> **id**: `number`

##### readContract()

> **readContract**: (`args`) => `Promise`\<`any`\>

###### Parameters

###### args

`any`

###### Returns

`Promise`\<`any`\>

***

### UserOpStatus

> **UserOpStatus** = `"pending"` \| `"confirmed"` \| `"failed"` \| `"timeout"`

Defined in: [src/lib/aa/coinbaseErc4337.ts:412](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L412)

***

### WalletClientLike

> **WalletClientLike** = `object` & `Record`\<`string`, `any`\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:205](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L205)

#### Type Declaration

##### request()

> **request**: (`args`) => `Promise`\<`any`\>

###### Parameters

###### args

`any`

###### Returns

`Promise`\<`any`\>

##### signMessage()?

> `optional` **signMessage**: (`args`) => `Promise`\<`any`\>

###### Parameters

###### args

`any`

###### Returns

`Promise`\<`any`\>

##### signTransaction()?

> `optional` **signTransaction**: (`args`) => `Promise`\<`any`\>

###### Parameters

###### args

`any`

###### Returns

`Promise`\<`any`\>

##### signTypedData()?

> `optional` **signTypedData**: (`args`) => `Promise`\<`any`\>

###### Parameters

###### args

`any`

###### Returns

`Promise`\<`any`\>

## Variables

### ERC4337\_ENTRYPOINT\_V06

> `const` **ERC4337\_ENTRYPOINT\_V06**: `` `0x${string}` `` = `ENTRYPOINT_V06`

Defined in: [src/lib/aa/coinbaseErc4337.ts:451](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L451)

The canonical EntryPoint v0.6 address used by this module.
This is the ONLY EntryPoint version supported.

## Functions

### assertEntryPointV06()

> **assertEntryPointV06**(`address`): `void`

Defined in: [src/lib/aa/coinbaseErc4337.ts:457](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L457)

Assert that a given address matches EntryPoint v0.6.
Use this to verify configuration matches expectations.

#### Parameters

##### address

`` `0x${string}` ``

#### Returns

`void`

***

### pollUserOperationStatus()

> **pollUserOperationStatus**(`params`): `Promise`\<\{ `status`: [`UserOpStatus`](#useropstatus); `txHash?`: `` `0x${string}` ``; \}\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:2124](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L2124)

#### Parameters

##### params

###### bundlerClient

`any`

###### options?

[`PollUserOperationStatusOptions`](#polluseroperationstatusoptions)

###### userOpHash

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `status`: [`UserOpStatus`](#useropstatus); `txHash?`: `` `0x${string}` ``; \}\>

***

### sendCoinbaseSmartWalletUserOperation()

> **sendCoinbaseSmartWalletUserOperation**(`params`): `Promise`\<\{ `transactionHash`: `` `0x${string}` ``; `userOpHash`: `` `0x${string}` ``; \}\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:1023](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L1023)

#### Parameters

##### params

###### allowContractSignMessageFallback?

`boolean`

###### allowEoaSignMessageFallback?

`boolean`

###### bundlerUrl

`string`

###### bypassOwnerIndexCache?

`boolean`

###### calls

`object`[]

###### ownerAddress

`` `0x${string}` ``

###### ownerApprovalContext?

\{ `approvalRunId?`: `string` \| `null`; `attempt?`: `number` \| `null`; `customOwnerPolicyToken?`: `string` \| `null`; `executionMode?`: `string` \| `null`; `stage?`: `string` \| `null`; \}

###### ownerApprovalContext.approvalRunId?

`string` \| `null`

###### ownerApprovalContext.attempt?

`number` \| `null`

###### ownerApprovalContext.customOwnerPolicyToken?

`string` \| `null`

###### ownerApprovalContext.executionMode?

`string` \| `null`

###### ownerApprovalContext.stage?

`string` \| `null`

###### ownerIndexLookupAddress?

`` `0x${string}` ``

###### ownerIndexOverride?

`number`

###### ownerIsContract?

`boolean`

###### paymasterUrl?

`string`

###### publicClient

[`PublicClientLike`](#publicclientlike)

###### retryOnInvalidSignature?

`boolean`

###### retryOnPrefund?

`boolean`

###### retryWithLowGasContractSigner?

`boolean`

###### retryWithTypedDataSigning?

`boolean`

###### skipPaymaster?

`boolean`

###### skipPreflightSimulation?

`boolean`

###### smartWallet

`` `0x${string}` ``

###### userOpSignMode?

`UserOpSignMode`

###### useTypedDataSigning?

`boolean`

###### verificationGasLimits?

`bigint`[]

###### version?

`"1"` \| `"1.1"`

###### walletClient

[`WalletClientLike`](#walletclientlike)

#### Returns

`Promise`\<\{ `transactionHash`: `` `0x${string}` ``; `userOpHash`: `` `0x${string}` ``; \}\>

***

### simulateSmartWalletCalls()

> **simulateSmartWalletCalls**(`params`): `Promise`\<\{ `directCallResult?`: \{ `error?`: `string`; `errorName?`: `string`; `revertData?`: `` `0x${string}` ``; `success`: `boolean`; \}; `error?`: `string`; `errorName?`: `string`; `revertData?`: `` `0x${string}` ``; `success`: `boolean`; \}\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:748](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L748)

Pre-flight simulation: test if the calls would succeed when executed from the smart wallet.
This helps diagnose whether a UserOp failure is due to:
1. ERC-4337 / signature issues (simulation passes but UserOp fails)
2. Underlying call issues (simulation fails, meaning the contract call itself would revert)

Returns both the smart wallet execute simulation result AND a direct target call simulation.
The direct simulation helps identify if the target contract would revert even with correct msg.sender.

#### Parameters

##### params

###### calls

`object`[]

###### publicClient

[`PublicClientLike`](#publicclientlike)

###### smartWallet

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `directCallResult?`: \{ `error?`: `string`; `errorName?`: `string`; `revertData?`: `` `0x${string}` ``; `success`: `boolean`; \}; `error?`: `string`; `errorName?`: `string`; `revertData?`: `` `0x${string}` ``; `success`: `boolean`; \}\>

***

### verifyBundlerSupportsV06()

> **verifyBundlerSupportsV06**(`bundlerUrl`, `options?`): `Promise`\<`void`\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:107](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L107)

Verify the bundler supports EntryPoint v0.6.
Throws if the bundler doesn't support v0.6.

#### Parameters

##### bundlerUrl

`string`

##### options?

###### includeCredentials?

`boolean`

###### timeoutMs?

`number`

#### Returns

`Promise`\<`void`\>

## References

### fetchCoinbaseSmartWalletOwners

Re-exports [fetchCoinbaseSmartWalletOwners](coinbaseErc4337Owners.md#fetchcoinbasesmartwalletowners)

***

### findCoinbaseSmartWalletOwnerIndex

Re-exports [findCoinbaseSmartWalletOwnerIndex](coinbaseErc4337Owners.md#findcoinbasesmartwalletownerindex)

***

### resetOwnerIndexCacheForTests

Re-exports [resetOwnerIndexCacheForTests](coinbaseErc4337Owners.md#resetownerindexcachefortests)
