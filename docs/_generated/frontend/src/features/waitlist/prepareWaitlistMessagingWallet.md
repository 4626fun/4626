[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/prepareWaitlistMessagingWallet

# src/features/waitlist/prepareWaitlistMessagingWallet

## Type Aliases

### PrepareWaitlistMessagingWalletInput

> **PrepareWaitlistMessagingWalletInput** = `object`

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L13)

#### Properties

##### activeConnectorId?

> `optional` **activeConnectorId**: `string` \| `null`

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L21)

##### connectAsync()

> **connectAsync**: (`variables`) => `Promise`\<`unknown`\>

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L18)

###### Parameters

###### variables

###### connector

`unknown`

###### Returns

`Promise`\<`unknown`\>

##### connectors

> **connectors**: `ReadonlyArray`\<\{ `id`: `string`; `name`: `string`; \}\>

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L19)

##### disconnectAsync()?

> `optional` **disconnectAsync**: () => `Promise`\<`unknown`\>

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L20)

###### Returns

`Promise`\<`unknown`\>

##### embeddedEoaAddress

> **embeddedEoaAddress**: `string` \| `null`

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L15)

##### ensureEmbeddedWallet()

> **ensureEmbeddedWallet**: () => `Promise`\<\{ `address`: `string`; \}\>

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L16)

###### Returns

`Promise`\<\{ `address`: `string`; \}\>

##### messagingWalletReady

> **messagingWalletReady**: `boolean`

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L22)

##### setActiveWallet()?

> `optional` **setActiveWallet**: (`wallet`) => `Promise`\<`unknown`\> \| `unknown`

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L17)

###### Parameters

###### wallet

`unknown`

###### Returns

`Promise`\<`unknown`\> \| `unknown`

##### wallets

> **wallets**: `unknown`[]

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L14)

***

### PrepareWaitlistMessagingWalletResult

> **PrepareWaitlistMessagingWalletResult** = \{ `ok`: `true`; \} \| \{ `error`: `string`; `ok`: `false`; \}

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L25)

## Variables

### WAITLIST\_EMBEDDED\_CONNECTOR\_ID

> `const` **WAITLIST\_EMBEDDED\_CONNECTOR\_ID**: `"privy-embedded-waitlist"` = `'privy-embedded-waitlist'`

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L5)

## Functions

### findLiveEmbeddedPrivyWallet()

> **findLiveEmbeddedPrivyWallet**(`wallets`, `embeddedEoaAddress`): `Record`\<`string`, `unknown`\> \| `null`

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:43](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L43)

#### Parameters

##### wallets

`unknown`[]

##### embeddedEoaAddress

`string` | `null`

#### Returns

`Record`\<`string`, `unknown`\> \| `null`

***

### isWaitlistMessagingWagmiConnector()

> **isWaitlistMessagingWagmiConnector**(`connectorId`): `boolean`

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L7)

#### Parameters

##### connectorId

`string` | `null` | `undefined`

#### Returns

`boolean`

***

### prepareWaitlistMessagingWallet()

> **prepareWaitlistMessagingWallet**(`input`): `Promise`\<[`PrepareWaitlistMessagingWalletResult`](#preparewaitlistmessagingwalletresult)\>

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:116](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L116)

#### Parameters

##### input

[`PrepareWaitlistMessagingWalletInput`](#preparewaitlistmessagingwalletinput)

#### Returns

`Promise`\<[`PrepareWaitlistMessagingWalletResult`](#preparewaitlistmessagingwalletresult)\>
