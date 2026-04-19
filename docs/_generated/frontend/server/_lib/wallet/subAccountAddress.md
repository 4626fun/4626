[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/wallet/subAccountAddress

# server/\_lib/wallet/subAccountAddress

## Variables

### \_\_internal

> `const` **\_\_internal**: `object`

Defined in: [server/\_lib/wallet/subAccountAddress.ts:94](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/subAccountAddress.ts#L94)

#### Type Declaration

##### CSW\_FACTORY\_ABI

> **CSW\_FACTORY\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `name`: `"owners"`; `type`: `"bytes[]"`; \}, \{ `name`: `"nonce"`; `type`: `"uint256"`; \}\]; `name`: `"getAddress"`; `outputs`: readonly \[\{ `type`: `"address"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"owners"`; `type`: `"bytes[]"`; \}, \{ `name`: `"nonce"`; `type`: `"uint256"`; \}\]; `name`: `"createAccount"`; `outputs`: readonly \[\{ `type`: `"address"`; \}\]; `stateMutability`: `"payable"`; `type`: `"function"`; \}\]

##### encodeOwnerBytes()

> **encodeOwnerBytes**: (`owner`) => `` `0x${string}` ``

Encode an owner EOA/contract address as the `bytes` entry expected by the CSW
factory's `bytes[] owners` input — a 32-byte ABI-encoded `address`.

###### Parameters

###### owner

`` `0x${string}` ``

###### Returns

`` `0x${string}` ``

***

### CSW\_FACTORY\_BASE

> `const` **CSW\_FACTORY\_BASE**: `Address` = `'0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a'`

Defined in: [server/\_lib/wallet/subAccountAddress.ts:23](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/subAccountAddress.ts#L23)

Coinbase Smart Wallet v1 factory on Base mainnet.

## Functions

### computeSubAccountAddress()

> **computeSubAccountAddress**(`params`): `Promise`\<`` `0x${string}` ``\>

Defined in: [server/\_lib/wallet/subAccountAddress.ts:76](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/subAccountAddress.ts#L76)

Compute the counterfactual CSW sub-account address via the factory's
`getAddress(owners, nonce)` view call. The factory derives the deploy
address via CREATE2 from its own address + the salt (nonce) + the init
bytecode (implementation + `initialize(owners)`); calling the view is the
safest way to get the exact value that the first-op initCode will produce.

#### Parameters

##### params

###### ownerEoa

`` `0x${string}` ``

###### parentCsw

`` `0x${string}` ``

###### profileId

`number`

###### publicClient

\{ \}

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### computeSubAccountSalt()

> **computeSubAccountSalt**(`params`): `` `0x${string}` ``

Defined in: [server/\_lib/wallet/subAccountAddress.ts:52](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/subAccountAddress.ts#L52)

Deterministic salt for a profile's sub-account. Stable across re-provisioning
attempts so an interrupted flow resumes to the same counterfactual address.

#### Parameters

##### params

###### parentCsw

`` `0x${string}` ``

###### profileId

`number`

#### Returns

`` `0x${string}` ``
