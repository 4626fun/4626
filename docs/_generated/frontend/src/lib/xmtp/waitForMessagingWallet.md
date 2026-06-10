[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/xmtp/waitForMessagingWallet

# src/lib/xmtp/waitForMessagingWallet

## Type Aliases

### ResolvedMessagingWallet

> **ResolvedMessagingWallet** = `object`

Defined in: [src/lib/xmtp/waitForMessagingWallet.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/waitForMessagingWallet.ts#L20)

#### Properties

##### address

> **address**: `` `0x${string}` ``

Defined in: [src/lib/xmtp/waitForMessagingWallet.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/waitForMessagingWallet.ts#L21)

##### connector

> **connector**: `Connector` \| `undefined`

Defined in: [src/lib/xmtp/waitForMessagingWallet.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/waitForMessagingWallet.ts#L23)

##### walletClient

> **walletClient**: `WalletClient`

Defined in: [src/lib/xmtp/waitForMessagingWallet.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/waitForMessagingWallet.ts#L22)

## Variables

### WAITLIST\_EMBEDDED\_CONNECTOR\_ID

> `const` **WAITLIST\_EMBEDDED\_CONNECTOR\_ID**: `"privy-embedded-waitlist"` = `'privy-embedded-waitlist'`

Defined in: [src/lib/xmtp/waitForMessagingWallet.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/waitForMessagingWallet.ts#L6)

***

### WAITLIST\_MESSAGING\_WALLET\_SETTLE\_MS

> `const` **WAITLIST\_MESSAGING\_WALLET\_SETTLE\_MS**: `8000` = `8_000`

Defined in: [src/lib/xmtp/waitForMessagingWallet.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/waitForMessagingWallet.ts#L9)

Wagmi settle poll after embedded wallet connect.

***

### WAITLIST\_MESSAGING\_WALLET\_VERIFY\_MS

> `const` **WAITLIST\_MESSAGING\_WALLET\_VERIFY\_MS**: `500` = `500`

Defined in: [src/lib/xmtp/waitForMessagingWallet.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/waitForMessagingWallet.ts#L12)

Short re-verify when hooks already report messaging wallet ready.

## Functions

### isWaitlistMessagingWagmiConnector()

> **isWaitlistMessagingWagmiConnector**(`connectorId`): `boolean`

Defined in: [src/lib/xmtp/waitForMessagingWallet.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/waitForMessagingWallet.ts#L14)

#### Parameters

##### connectorId

`string` | `null` | `undefined`

#### Returns

`boolean`

***

### waitForMessagingWallet()

> **waitForMessagingWallet**(`config`, `options?`): `Promise`\<[`ResolvedMessagingWallet`](#resolvedmessagingwallet) \| `null`\>

Defined in: [src/lib/xmtp/waitForMessagingWallet.ts:37](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/waitForMessagingWallet.ts#L37)

#### Parameters

##### config

`Config`

##### options?

###### connectorPredicate?

(`connectorId`) => `boolean`

###### expectedAddress?

`string` \| `null`

###### timeoutMs?

`number`

#### Returns

`Promise`\<[`ResolvedMessagingWallet`](#resolvedmessagingwallet) \| `null`\>
