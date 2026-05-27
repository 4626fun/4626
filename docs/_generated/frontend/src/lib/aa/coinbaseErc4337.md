[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/aa/coinbaseErc4337

# src/lib/aa/coinbaseErc4337

## Type Aliases

### PollUserOperationStatusOptions

> **PollUserOperationStatusOptions** = `object`

Defined in: [src/lib/aa/coinbaseErc4337.ts:488](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337.ts#L488)

#### Properties

##### maxDurationMs?

> `optional` **maxDurationMs**: `number`

Defined in: [src/lib/aa/coinbaseErc4337.ts:490](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337.ts#L490)

##### onError()?

> `optional` **onError**: (`error`) => `void`

Defined in: [src/lib/aa/coinbaseErc4337.ts:493](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337.ts#L493)

###### Parameters

###### error

`Error`

###### Returns

`void`

##### onStatusChange()?

> `optional` **onStatusChange**: (`status`, `txHash?`) => `void`

Defined in: [src/lib/aa/coinbaseErc4337.ts:492](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337.ts#L492)

###### Parameters

###### status

[`UserOpStatus`](#useropstatus)

###### txHash?

`Hex`

###### Returns

`void`

##### perCheckTimeoutMs?

> `optional` **perCheckTimeoutMs**: `number`

Defined in: [src/lib/aa/coinbaseErc4337.ts:491](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337.ts#L491)

##### pollIntervalMs?

> `optional` **pollIntervalMs**: `number`

Defined in: [src/lib/aa/coinbaseErc4337.ts:489](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337.ts#L489)

##### signal?

> `optional` **signal**: `AbortSignal`

Defined in: [src/lib/aa/coinbaseErc4337.ts:494](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337.ts#L494)

***

### PublicClientLike

> **PublicClientLike** = `object` & `Record`\<`string`, `any`\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:206](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337.ts#L206)

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

Defined in: [src/lib/aa/coinbaseErc4337.ts:486](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337.ts#L486)

***

### WalletClientLike

> **WalletClientLike** = `object` & `Record`\<`string`, `any`\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:211](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337.ts#L211)

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

> `const` **ERC4337\_ENTRYPOINT\_V06**: `string` = `ENTRYPOINT_V06`

Defined in: [src/lib/aa/coinbaseErc4337.ts:525](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337.ts#L525)

The canonical EntryPoint v0.6 address used by this module.
This is the ONLY EntryPoint version supported.

## Functions

### assertEntryPointV06()

> **assertEntryPointV06**(`address`): `void`

Defined in: [src/lib/aa/coinbaseErc4337.ts:531](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337.ts#L531)

Assert that a given address matches EntryPoint v0.6.
Use this to verify configuration matches expectations.

#### Parameters

##### address

`string`

#### Returns

`void`

***

### deriveEphemeralNonceKey()

> **deriveEphemeralNonceKey**(`ownerIndex`): `bigint`

Defined in: [src/lib/aa/coinbaseErc4337.ts:363](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337.ts#L363)

Fresh EntryPoint nonce key when the owner-index lane is blocked by AA25.

#### Parameters

##### ownerIndex

`number`

#### Returns

`bigint`

***

### pollCanonicalUserOpTransactionHash()

> **pollCanonicalUserOpTransactionHash**(`params`): `Promise`\<`` `0x${string}` ``\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:2463](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337.ts#L2463)

#### Parameters

##### params

###### bundlerUrl

`string`

###### maxDurationMs?

`number`

###### publicClient

[`PublicClientLike`](#publicclientlike)

###### signal?

`AbortSignal`

###### userOpHash

`` `0x${string}` ``

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### pollUserOperationStatus()

> **pollUserOperationStatus**(`params`): `Promise`\<\{ `status`: [`UserOpStatus`](#useropstatus); `txHash?`: `` `0x${string}` ``; \}\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:2380](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337.ts#L2380)

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

> **sendCoinbaseSmartWalletUserOperation**(`params`): `Promise`\<\{ `transactionHash`: `` `0x${string}` `` \| `null`; `userOpHash`: `` `0x${string}` ``; \}\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:1097](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337.ts#L1097)

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

###### onSubmissionStatus?

(`message`) => `void`

###### ownerAddress

`string`

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

`string`

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

###### skipPasskeyOwnerSlotsInProbe?

`boolean`

When true, skip owner index 0 during self-auth CSW probe (WebAuthn passkey slot).

###### skipPaymaster?

`boolean`

###### skipPreflightSimulation?

`boolean`

###### smartWallet

`string`

###### userOpSignMode?

`UserOpSignMode`

###### useTypedDataSigning?

`boolean`

###### verificationGasLimits?

`bigint`[]

###### version?

`"1"` \| `"1.1"`

###### waitForOnChainReceipt?

`boolean`

When false, return after bundler accepts the UserOp; receipt can be polled separately.

###### walletClient

[`WalletClientLike`](#walletclientlike)

#### Returns

`Promise`\<\{ `transactionHash`: `` `0x${string}` `` \| `null`; `userOpHash`: `` `0x${string}` ``; \}\>

***

### simulateSmartWalletCalls()

> **simulateSmartWalletCalls**(`params`): `Promise`\<\{ `directCallResult?`: \{ `error?`: `string`; `errorName?`: `string`; `revertData?`: `` `0x${string}` ``; `success`: `boolean`; \}; `error?`: `string`; `errorName?`: `string`; `revertData?`: `` `0x${string}` ``; `success`: `boolean`; \}\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:822](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337.ts#L822)

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

`string`

#### Returns

`Promise`\<\{ `directCallResult?`: \{ `error?`: `string`; `errorName?`: `string`; `revertData?`: `` `0x${string}` ``; `success`: `boolean`; \}; `error?`: `string`; `errorName?`: `string`; `revertData?`: `` `0x${string}` ``; `success`: `boolean`; \}\>

***

### verifyBundlerSupportsV06()

> **verifyBundlerSupportsV06**(`bundlerUrl`, `options?`): `Promise`\<`void`\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:113](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337.ts#L113)

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

***

### waitForEntryPointNonceAdvance()

> **waitForEntryPointNonceAdvance**(`params`): `Promise`\<\{ `advanced`: `boolean`; `nonce`: `bigint`; \}\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:405](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337.ts#L405)

Poll EntryPoint nonce until it advances past a stuck in-flight UserOp.

#### Parameters

##### params

###### maxWaitMs?

`number`

###### pollIntervalMs?

`number`

###### readNonce

() => `Promise`\<`bigint`\>

###### startingNonce

`bigint`

#### Returns

`Promise`\<\{ `advanced`: `boolean`; `nonce`: `bigint`; \}\>

## References

### fetchCoinbaseSmartWalletOwners

Re-exports [fetchCoinbaseSmartWalletOwners](coinbaseErc4337Owners.md#fetchcoinbasesmartwalletowners)

***

### findCoinbaseSmartWalletOwnerIndex

Re-exports [findCoinbaseSmartWalletOwnerIndex](coinbaseErc4337Owners.md#findcoinbasesmartwalletownerindex)

***

### resetOwnerIndexCacheForTests

Re-exports [resetOwnerIndexCacheForTests](coinbaseErc4337Owners.md#resetownerindexcachefortests)
