[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/xmtp/xmtpLocalInstallStorage

# src/lib/xmtp/xmtpLocalInstallStorage

## Type Aliases

### StoredInstallationMeta

> **StoredInstallationMeta** = `object`

Defined in: [src/lib/xmtp/xmtpLocalInstallStorage.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpLocalInstallStorage.ts#L5)

#### Properties

##### inboxId

> **inboxId**: `string`

Defined in: [src/lib/xmtp/xmtpLocalInstallStorage.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpLocalInstallStorage.ts#L6)

##### installationId

> **installationId**: `string`

Defined in: [src/lib/xmtp/xmtpLocalInstallStorage.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpLocalInstallStorage.ts#L7)

##### updatedAt

> **updatedAt**: `number`

Defined in: [src/lib/xmtp/xmtpLocalInstallStorage.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpLocalInstallStorage.ts#L8)

***

### XmtpEnv

> **XmtpEnv** = `"production"` \| `"dev"` \| `"local"`

Defined in: [src/lib/xmtp/xmtpLocalInstallStorage.ts:1](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpLocalInstallStorage.ts#L1)

## Variables

### ENC\_KEY\_HEX\_RE

> `const` **ENC\_KEY\_HEX\_RE**: `RegExp`

Defined in: [src/lib/xmtp/xmtpLocalInstallStorage.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpLocalInstallStorage.ts#L3)

## Functions

### buildXmtpDbPath()

> **buildXmtpDbPath**(`env`, `inboxId`): `string`

Defined in: [src/lib/xmtp/xmtpLocalInstallStorage.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpLocalInstallStorage.ts#L25)

#### Parameters

##### env

[`XmtpEnv`](#xmtpenv)

##### inboxId

`string`

#### Returns

`string`

***

### clearInstallationProvisioned()

> **clearInstallationProvisioned**(`env`, `address`): `void`

Defined in: [src/lib/xmtp/xmtpLocalInstallStorage.ts:86](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpLocalInstallStorage.ts#L86)

#### Parameters

##### env

[`XmtpEnv`](#xmtpenv)

##### address

`string`

#### Returns

`void`

***

### clearStoredEncKeyHex()

> **clearStoredEncKeyHex**(`env`, `address`): `void`

Defined in: [src/lib/xmtp/xmtpLocalInstallStorage.ts:57](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpLocalInstallStorage.ts#L57)

#### Parameters

##### env

[`XmtpEnv`](#xmtpenv)

##### address

`string`

#### Returns

`void`

***

### clearStoredInstallationMeta()

> **clearStoredInstallationMeta**(`env`, `address`): `void`

Defined in: [src/lib/xmtp/xmtpLocalInstallStorage.ts:136](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpLocalInstallStorage.ts#L136)

#### Parameters

##### env

[`XmtpEnv`](#xmtpenv)

##### address

`string`

#### Returns

`void`

***

### hasKnownXmtpInstallation()

> **hasKnownXmtpInstallation**(`env`, `address`): `boolean`

Defined in: [src/lib/xmtp/xmtpLocalInstallStorage.ts:145](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpLocalInstallStorage.ts#L145)

#### Parameters

##### env

[`XmtpEnv`](#xmtpenv)

##### address

`string`

#### Returns

`boolean`

***

### readInstallationProvisioned()

> **readInstallationProvisioned**(`env`, `address`): `boolean`

Defined in: [src/lib/xmtp/xmtpLocalInstallStorage.ts:68](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpLocalInstallStorage.ts#L68)

#### Parameters

##### env

[`XmtpEnv`](#xmtpenv)

##### address

`string`

#### Returns

`boolean`

***

### readStoredEncKeyHex()

> **readStoredEncKeyHex**(`env`, `address`): `string` \| `null`

Defined in: [src/lib/xmtp/xmtpLocalInstallStorage.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpLocalInstallStorage.ts#L29)

#### Parameters

##### env

[`XmtpEnv`](#xmtpenv)

##### address

`string`

#### Returns

`string` \| `null`

***

### readStoredInstallationMeta()

> **readStoredInstallationMeta**(`env`, `address`): [`StoredInstallationMeta`](#storedinstallationmeta) \| `null`

Defined in: [src/lib/xmtp/xmtpLocalInstallStorage.ts:95](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpLocalInstallStorage.ts#L95)

#### Parameters

##### env

[`XmtpEnv`](#xmtpenv)

##### address

`string`

#### Returns

[`StoredInstallationMeta`](#storedinstallationmeta) \| `null`

***

### writeInstallationProvisioned()

> **writeInstallationProvisioned**(`env`, `address`): `void`

Defined in: [src/lib/xmtp/xmtpLocalInstallStorage.ts:77](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpLocalInstallStorage.ts#L77)

#### Parameters

##### env

[`XmtpEnv`](#xmtpenv)

##### address

`string`

#### Returns

`void`

***

### writeStoredEncKeyHex()

> **writeStoredEncKeyHex**(`env`, `address`, `encKeyHex`): `void`

Defined in: [src/lib/xmtp/xmtpLocalInstallStorage.ts:45](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpLocalInstallStorage.ts#L45)

#### Parameters

##### env

[`XmtpEnv`](#xmtpenv)

##### address

`string`

##### encKeyHex

`string`

#### Returns

`void`

***

### writeStoredInstallationMeta()

> **writeStoredInstallationMeta**(`env`, `address`, `meta`): `void`

Defined in: [src/lib/xmtp/xmtpLocalInstallStorage.ts:117](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpLocalInstallStorage.ts#L117)

#### Parameters

##### env

[`XmtpEnv`](#xmtpenv)

##### address

`string`

##### meta

`Pick`\<[`StoredInstallationMeta`](#storedinstallationmeta), `"inboxId"` \| `"installationId"`\>

#### Returns

`void`
