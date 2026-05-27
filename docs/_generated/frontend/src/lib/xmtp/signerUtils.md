[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/xmtp/signerUtils

# src/lib/xmtp/signerUtils

## Type Aliases

### StoredSignerType

> **StoredSignerType** = `"SCW"` \| `"EOA"` \| `null`

Defined in: [src/lib/xmtp/signerUtils.ts:1](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/signerUtils.ts#L1)

## Variables

### CANONICAL\_SCW\_CHAIN\_ID

> `const` **CANONICAL\_SCW\_CHAIN\_ID**: `8453` = `8453`

Defined in: [src/lib/xmtp/signerUtils.ts:3](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/signerUtils.ts#L3)

## Functions

### decideXmtpSignerType()

> **decideXmtpSignerType**(`params`): `object`

Defined in: [src/lib/xmtp/signerUtils.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/signerUtils.ts#L24)

#### Parameters

##### params

###### connector?

`unknown`

###### hasContractCode

`boolean` \| `null`

Whether the identity address has contract code on-chain.
- true: definitely a contract
- false: definitely no code
- null: unknown (RPC error / unsupported)

###### isCanonicalSmartWallet

`boolean`

###### modeOverride?

`"EOA"` \| `"SMART_WALLET"`

###### storedSignerType

[`StoredSignerType`](#storedsignertype)

###### walletChainId

`number`

Sanitized chain id of the connected wallet (defaults applied).

#### Returns

`object`

##### scwChainId

> **scwChainId**: `number`

##### signerType

> **signerType**: `"EOA"` \| `"SCW"`

***

### isCoinbaseWalletConnector()

> **isCoinbaseWalletConnector**(`connector`): `boolean`

Defined in: [src/lib/xmtp/signerUtils.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/signerUtils.ts#L15)

#### Parameters

##### connector

`unknown`

#### Returns

`boolean`

***

### resolveXmtpChainId()

> **resolveXmtpChainId**(`walletChainId`): `number`

Defined in: [src/lib/xmtp/signerUtils.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/signerUtils.ts#L5)

#### Parameters

##### walletChainId

`unknown`

#### Returns

`number`
