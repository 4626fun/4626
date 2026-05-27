[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/xmtp/xmtpConnectGuard

# src/lib/xmtp/xmtpConnectGuard

## Type Aliases

### XmtpConnectPrecheckDenyReason

> **XmtpConnectPrecheckDenyReason** = `"no_wallet"` \| `"reset_in_flight"` \| `"already_connected"` \| `"connect_in_flight"` \| `"cooldown"` \| `"wrong_origin"`

Defined in: [src/lib/xmtp/xmtpConnectGuard.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectGuard.ts#L14)

***

### XmtpConnectPrecheckInput

> **XmtpConnectPrecheckInput** = `object`

Defined in: [src/lib/xmtp/xmtpConnectGuard.ts:1](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectGuard.ts#L1)

#### Properties

##### alreadyHasClient

> **alreadyHasClient**: `boolean`

Defined in: [src/lib/xmtp/xmtpConnectGuard.ts:4](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectGuard.ts#L4)

##### canonicalAppOrigin

> **canonicalAppOrigin**: `string`

Defined in: [src/lib/xmtp/xmtpConnectGuard.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectGuard.ts#L10)

##### connectCooldownUntilMs

> **connectCooldownUntilMs**: `number`

Defined in: [src/lib/xmtp/xmtpConnectGuard.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectGuard.ts#L7)

##### connectInFlight

> **connectInFlight**: `boolean`

Defined in: [src/lib/xmtp/xmtpConnectGuard.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectGuard.ts#L5)

##### currentOrigin

> **currentOrigin**: `string`

Defined in: [src/lib/xmtp/xmtpConnectGuard.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectGuard.ts#L9)

##### hostname

> **hostname**: `string`

Defined in: [src/lib/xmtp/xmtpConnectGuard.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectGuard.ts#L11)

##### nowMs

> **nowMs**: `number`

Defined in: [src/lib/xmtp/xmtpConnectGuard.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectGuard.ts#L8)

##### resetLocalStateInFlight

> **resetLocalStateInFlight**: `boolean`

Defined in: [src/lib/xmtp/xmtpConnectGuard.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectGuard.ts#L6)

##### walletAddress

> **walletAddress**: `string` \| `null`

Defined in: [src/lib/xmtp/xmtpConnectGuard.ts:2](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectGuard.ts#L2)

##### walletClientReady

> **walletClientReady**: `boolean`

Defined in: [src/lib/xmtp/xmtpConnectGuard.ts:3](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectGuard.ts#L3)

***

### XmtpConnectPrecheckResult

> **XmtpConnectPrecheckResult** = \{ `allowed`: `true`; \} \| \{ `allowed`: `false`; `reason`: [`XmtpConnectPrecheckDenyReason`](#xmtpconnectprecheckdenyreason); `retryInSeconds?`: `number`; \}

Defined in: [src/lib/xmtp/xmtpConnectGuard.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectGuard.ts#L22)

## Functions

### buildWrongOriginConnectError()

> **buildWrongOriginConnectError**(`currentOrigin`, `canonicalAppOrigin`): `string`

Defined in: [src/lib/xmtp/xmtpConnectGuard.ts:86](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectGuard.ts#L86)

#### Parameters

##### currentOrigin

`string`

##### canonicalAppOrigin

`string`

#### Returns

`string`

***

### evaluateXmtpConnectPrecheck()

> **evaluateXmtpConnectPrecheck**(`input`): [`XmtpConnectPrecheckResult`](#xmtpconnectprecheckresult)

Defined in: [src/lib/xmtp/xmtpConnectGuard.ts:57](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectGuard.ts#L57)

Pure preflight gate mirrored at the top of provider.connect().
Blocks accidental connect churn on preview hosts, duplicate in-flight work, etc.

#### Parameters

##### input

[`XmtpConnectPrecheckInput`](#xmtpconnectprecheckinput)

#### Returns

[`XmtpConnectPrecheckResult`](#xmtpconnectprecheckresult)

***

### isCanonicalMessagingOrigin()

> **isCanonicalMessagingOrigin**(`input`): `boolean`

Defined in: [src/lib/xmtp/xmtpConnectGuard.ts:44](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectGuard.ts#L44)

#### Parameters

##### input

###### canonicalAppOrigin

`string`

###### currentOrigin

`string`

###### hostname

`string`

#### Returns

`boolean`

***

### isLocalDevHostname()

> **isLocalDevHostname**(`hostname`): `boolean`

Defined in: [src/lib/xmtp/xmtpConnectGuard.ts:30](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectGuard.ts#L30)

#### Parameters

##### hostname

`string`

#### Returns

`boolean`

***

### isTrustedMessagingHostname()

> **isTrustedMessagingHostname**(`hostname`): `boolean`

Defined in: [src/lib/xmtp/xmtpConnectGuard.ts:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectGuard.ts#L38)

#### Parameters

##### hostname

`string`

#### Returns

`boolean`
