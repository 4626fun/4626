[**creatorvault-miniapp**](../../../index.md)

***

[creatorvault-miniapp](../../../index.md) / src/lib/aa/coinbaseErc4337

# src/lib/aa/coinbaseErc4337

## Type Aliases

### CrossAppSignMessage()

> **CrossAppSignMessage** = (`message`, `options`) => `Promise`\<`string`\>

Defined in: [lib/aa/coinbaseErc4337.ts:688](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/aa/coinbaseErc4337.ts#L688)

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

Defined in: [lib/aa/coinbaseErc4337.ts:84](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/aa/coinbaseErc4337.ts#L84)

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

Defined in: [lib/aa/coinbaseErc4337.ts:89](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/aa/coinbaseErc4337.ts#L89)

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

Defined in: [lib/aa/coinbaseErc4337.ts:385](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/aa/coinbaseErc4337.ts#L385)

The canonical EntryPoint v0.6 address used by this module.
This is the ONLY EntryPoint version supported.

## Functions

### assertEntryPointV06()

> **assertEntryPointV06**(`address`): `void`

Defined in: [lib/aa/coinbaseErc4337.ts:391](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/aa/coinbaseErc4337.ts#L391)

Assert that a given address matches EntryPoint v0.6.
Use this to verify configuration matches expectations.

#### Parameters

##### address

`` `0x${string}` ``

#### Returns

`void`

***

### findCoinbaseSmartWalletOwnerIndex()

> **findCoinbaseSmartWalletOwnerIndex**(`params`): `Promise`\<\{ `ownerCount`: `number`; `ownerIndex`: `number` \| `null`; \}\>

Defined in: [lib/aa/coinbaseErc4337.ts:401](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/aa/coinbaseErc4337.ts#L401)

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

Defined in: [lib/aa/coinbaseErc4337.ts:312](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/aa/coinbaseErc4337.ts#L312)

#### Returns

`object`[]

***

### sendCoinbaseSmartWalletUserOperation()

> **sendCoinbaseSmartWalletUserOperation**(`params`): `Promise`\<\{ `transactionHash`: `` `0x${string}` ``; `userOpHash`: `` `0x${string}` ``; \}\>

Defined in: [lib/aa/coinbaseErc4337.ts:875](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/aa/coinbaseErc4337.ts#L875)

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

###### publicClient

[`PublicClientLike`](#publicclientlike)

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

Defined in: [lib/aa/coinbaseErc4337.ts:747](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/aa/coinbaseErc4337.ts#L747)

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
