[**4626-miniapp**](../../../index.md)

***

[4626-miniapp](../../../index.md) / src/lib/aa/coinbaseErc4337

# src/lib/aa/coinbaseErc4337

## Type Aliases

### CrossAppSignMessage()

> **CrossAppSignMessage** = (`message`, `options`) => `Promise`\<`string`\>

Defined in: [lib/aa/coinbaseErc4337.ts:844](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/aa/coinbaseErc4337.ts#L844)

Cross-app signing function type from Privy's useCrossAppAccounts

#### Parameters

##### message

`string`

##### options

###### address

`string`

#### Returns

`Promise`\<`string`\>

***

### PublicClientLike

> **PublicClientLike** = `object` & `Record`\<`string`, `any`\>

Defined in: [lib/aa/coinbaseErc4337.ts:88](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/aa/coinbaseErc4337.ts#L88)

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

### WalletClientLike

> **WalletClientLike** = `object` & `Record`\<`string`, `any`\>

Defined in: [lib/aa/coinbaseErc4337.ts:93](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/aa/coinbaseErc4337.ts#L93)

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

Defined in: [lib/aa/coinbaseErc4337.ts:492](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/aa/coinbaseErc4337.ts#L492)

The canonical EntryPoint v0.6 address used by this module.
This is the ONLY EntryPoint version supported.

## Functions

### assertEntryPointV06()

> **assertEntryPointV06**(`address`): `void`

Defined in: [lib/aa/coinbaseErc4337.ts:498](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/aa/coinbaseErc4337.ts#L498)

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

Defined in: [lib/aa/coinbaseErc4337.ts:551](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/aa/coinbaseErc4337.ts#L551)

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

Defined in: [lib/aa/coinbaseErc4337.ts:508](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/aa/coinbaseErc4337.ts#L508)

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

#### Returns

`Promise`\<\{ `ownerCount`: `number`; `ownerIndex`: `number` \| `null`; \}\>

***

### runSignatureExtractionHarness()

> **runSignatureExtractionHarness**(): `object`[]

Defined in: [lib/aa/coinbaseErc4337.ts:419](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/aa/coinbaseErc4337.ts#L419)

#### Returns

`object`[]

***

### sendCoinbaseSmartWalletUserOperation()

> **sendCoinbaseSmartWalletUserOperation**(`params`): `Promise`\<\{ `transactionHash`: `` `0x${string}` ``; `userOpHash`: `` `0x${string}` ``; \}\>

Defined in: [lib/aa/coinbaseErc4337.ts:1169](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/aa/coinbaseErc4337.ts#L1169)

#### Parameters

##### params

###### bundlerUrl

`string`

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

###### skipPaymaster?

`boolean`

###### skipPreflightSimulation?

`boolean`

###### smartWallet

`` `0x${string}` ``

###### userOpSignMode?

`UserOpSignMode`

###### version?

`"1"` \| `"1.1"`

###### walletClient

[`WalletClientLike`](#walletclientlike)

#### Returns

`Promise`\<\{ `transactionHash`: `` `0x${string}` ``; `userOpHash`: `` `0x${string}` ``; \}\>

***

### sendCrossAppUserOperation()

> **sendCrossAppUserOperation**(`params`): `Promise`\<\{ `transactionHash`: `` `0x${string}` ``; `userOpHash`: `` `0x${string}` ``; \}\>

Defined in: [lib/aa/coinbaseErc4337.ts:903](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/aa/coinbaseErc4337.ts#L903)

Send a UserOperation via ERC-4337 using cross-app signing.

This flow:
1. Builds the UserOperation for the smart wallet
2. Computes the UserOp hash
3. Opens a popup to Zora for the user to sign (no gas needed!)
4. Submits to bundler with paymaster (paymaster pays gas)
5. Waits for on-chain confirmation

#### Parameters

##### params

###### bundlerUrl

`string`

###### calls

`object`[]

###### crossAppSignMessage

[`CrossAppSignMessage`](#crossappsignmessage)

signMessage from useCrossAppAccounts

###### publicClient

[`PublicClientLike`](#publicclientlike)

###### smartWallet

`` `0x${string}` ``

The Coinbase Smart Wallet address

###### version?

`"1"` \| `"1.1"`

###### zoraEmbeddedWalletAddress

`` `0x${string}` ``

The Zora EOA that will sign

#### Returns

`Promise`\<\{ `transactionHash`: `` `0x${string}` ``; `userOpHash`: `` `0x${string}` ``; \}\>

***

### simulateSmartWalletCalls()

> **simulateSmartWalletCalls**(`params`): `Promise`\<\{ `directCallResult?`: \{ `error?`: `string`; `errorName?`: `string`; `revertData?`: `` `0x${string}` ``; `success`: `boolean`; \}; `error?`: `string`; `errorName?`: `string`; `revertData?`: `` `0x${string}` ``; `success`: `boolean`; \}\>

Defined in: [lib/aa/coinbaseErc4337.ts:1044](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/aa/coinbaseErc4337.ts#L1044)

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
