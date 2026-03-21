[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/aa/coinbaseErc4337

# src/lib/aa/coinbaseErc4337

## Type Aliases

### PollUserOperationStatusOptions

> **PollUserOperationStatusOptions** = `object`

Defined in: [src/lib/aa/coinbaseErc4337.ts:849](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/aa/coinbaseErc4337.ts#L849)

#### Properties

##### maxDurationMs?

> `optional` **maxDurationMs**: `number`

Defined in: [src/lib/aa/coinbaseErc4337.ts:851](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/aa/coinbaseErc4337.ts#L851)

##### onError()?

> `optional` **onError**: (`error`) => `void`

Defined in: [src/lib/aa/coinbaseErc4337.ts:854](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/aa/coinbaseErc4337.ts#L854)

###### Parameters

###### error

`Error`

###### Returns

`void`

##### onStatusChange()?

> `optional` **onStatusChange**: (`status`, `txHash?`) => `void`

Defined in: [src/lib/aa/coinbaseErc4337.ts:853](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/aa/coinbaseErc4337.ts#L853)

###### Parameters

###### status

[`UserOpStatus`](#useropstatus)

###### txHash?

`Hex`

###### Returns

`void`

##### perCheckTimeoutMs?

> `optional` **perCheckTimeoutMs**: `number`

Defined in: [src/lib/aa/coinbaseErc4337.ts:852](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/aa/coinbaseErc4337.ts#L852)

##### pollIntervalMs?

> `optional` **pollIntervalMs**: `number`

Defined in: [src/lib/aa/coinbaseErc4337.ts:850](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/aa/coinbaseErc4337.ts#L850)

##### signal?

> `optional` **signal**: `AbortSignal`

Defined in: [src/lib/aa/coinbaseErc4337.ts:855](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/aa/coinbaseErc4337.ts#L855)

***

### PublicClientLike

> **PublicClientLike** = `object` & `Record`\<`string`, `any`\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:266](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/aa/coinbaseErc4337.ts#L266)

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

Defined in: [src/lib/aa/coinbaseErc4337.ts:847](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/aa/coinbaseErc4337.ts#L847)

***

### WalletClientLike

> **WalletClientLike** = `object` & `Record`\<`string`, `any`\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:271](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/aa/coinbaseErc4337.ts#L271)

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

Defined in: [src/lib/aa/coinbaseErc4337.ts:1001](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/aa/coinbaseErc4337.ts#L1001)

The canonical EntryPoint v0.6 address used by this module.
This is the ONLY EntryPoint version supported.

## Functions

### applyBuilderDataSuffixToCalls()

> **applyBuilderDataSuffixToCalls**(`calls`, `chainId`, `dataSuffix`): `object`[]

Defined in: [src/lib/aa/coinbaseErc4337.ts:93](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/aa/coinbaseErc4337.ts#L93)

#### Parameters

##### calls

`object`[]

##### chainId

`number`

##### dataSuffix

`` `0x${string}` `` | `undefined`

#### Returns

`object`[]

***

### assertEntryPointV06()

> **assertEntryPointV06**(`address`): `void`

Defined in: [src/lib/aa/coinbaseErc4337.ts:1007](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/aa/coinbaseErc4337.ts#L1007)

Assert that a given address matches EntryPoint v0.6.
Use this to verify configuration matches expectations.

#### Parameters

##### address

`` `0x${string}` ``

#### Returns

`void`

***

### fetchCoinbaseSmartWalletOwners()

> **fetchCoinbaseSmartWalletOwners**(`params`): `Promise`\<`` `0x${string}` ``[]\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:1101](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/aa/coinbaseErc4337.ts#L1101)

#### Parameters

##### params

###### maxOwners?

`number`

###### publicClient

[`PublicClientLike`](#publicclientlike)

###### smartWallet

`` `0x${string}` ``

#### Returns

`Promise`\<`` `0x${string}` ``[]\>

***

### findCoinbaseSmartWalletOwnerIndex()

> **findCoinbaseSmartWalletOwnerIndex**(`params`): `Promise`\<\{ `ownerCount`: `number`; `ownerIndex`: `number` \| `null`; \}\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:1017](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/aa/coinbaseErc4337.ts#L1017)

#### Parameters

##### params

###### maxScan?

`number`

###### ownerAddress

`` `0x${string}` ``

###### publicClient

[`PublicClientLike`](#publicclientlike)

###### smartWallet

`` `0x${string}` ``

###### useCache?

`boolean`

#### Returns

`Promise`\<\{ `ownerCount`: `number`; `ownerIndex`: `number` \| `null`; \}\>

***

### pollUserOperationStatus()

> **pollUserOperationStatus**(`params`): `Promise`\<\{ `status`: [`UserOpStatus`](#useropstatus); `txHash?`: `` `0x${string}` ``; \}\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:2423](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/aa/coinbaseErc4337.ts#L2423)

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

### resetOwnerIndexCacheForTests()

> **resetOwnerIndexCacheForTests**(): `void`

Defined in: [src/lib/aa/coinbaseErc4337.ts:988](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/aa/coinbaseErc4337.ts#L988)

#### Returns

`void`

***

### runSignatureExtractionHarness()

> **runSignatureExtractionHarness**(): `object`[]

Defined in: [src/lib/aa/coinbaseErc4337.ts:906](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/aa/coinbaseErc4337.ts#L906)

#### Returns

`object`[]

***

### sendCoinbaseSmartWalletUserOperation()

> **sendCoinbaseSmartWalletUserOperation**(`params`): `Promise`\<\{ `transactionHash`: `` `0x${string}` ``; `userOpHash`: `` `0x${string}` ``; \}\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:1661](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/aa/coinbaseErc4337.ts#L1661)

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

Defined in: [src/lib/aa/coinbaseErc4337.ts:1422](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/aa/coinbaseErc4337.ts#L1422)

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

Defined in: [src/lib/aa/coinbaseErc4337.ts:173](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/aa/coinbaseErc4337.ts#L173)

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
