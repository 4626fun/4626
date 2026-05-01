[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/xmtp/xmtpHelpers

# src/lib/xmtp/xmtpHelpers

## Type Aliases

### ParsedWireContent

> **ParsedWireContent** = `object`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:43](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L43)

#### Properties

##### content

> **content**: `string`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:44](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L44)

##### contentType

> **contentType**: `ChatMessageContentType`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:45](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L45)

##### replyToId

> **replyToId**: `string` \| `null`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:47](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L47)

##### richPreview?

> `optional` **richPreview**: `string`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L46)

***

### XmtpEnvLabel

> **XmtpEnvLabel** = `"production"` \| `"dev"` \| `"local"`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:120](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L120)

## Functions

### buildNotRegisteredDmMessage()

> **buildNotRegisteredDmMessage**(`params`): `string`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:254](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L254)

#### Parameters

##### params

###### canonicalizedFromAddress

`` `0x${string}` `` \| `null`

###### env

[`XmtpEnvLabel`](#xmtpenvlabel)

###### peerAddress

`` `0x${string}` ``

#### Returns

`string`

***

### encodeWireContent()

> **encodeWireContent**(`text`, `options?`): `string`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:109](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L109)

#### Parameters

##### text

`string`

##### options?

`SendChatMessageOptions`

#### Returns

`string`

***

### extractCanMessageResult()

> **extractCanMessageResult**(`result`, `address`): `boolean` \| `null`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:187](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L187)

#### Parameters

##### result

`unknown`

##### address

`` `0x${string}` ``

#### Returns

`boolean` \| `null`

***

### extractInstallationLimitInboxId()

> **extractInstallationLimitInboxId**(`message`): `string` \| `null`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:128](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L128)

#### Parameters

##### message

`string`

#### Returns

`string` \| `null`

***

### formatXmtpEnvLabel()

> **formatXmtpEnvLabel**(`env`): `string`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:122](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L122)

#### Parameters

##### env

[`XmtpEnvLabel`](#xmtpenvlabel)

#### Returns

`string`

***

### hexToBytes()

> **hexToBytes**(`hex`): `Uint8Array`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L18)

#### Parameters

##### hex

`string`

#### Returns

`Uint8Array`

***

### isInstallationLimitError()

> **isInstallationLimitError**(`message`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:153](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L153)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isOpfsAccessHandleError()

> **isOpfsAccessHandleError**(`message`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:171](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L171)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isScwSignatureValidationError()

> **isScwSignatureValidationError**(`message`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:163](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L163)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isWrongChainIdError()

> **isWrongChainIdError**(`message`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:158](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L158)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isXmtpEnvironmentMismatchError()

> **isXmtpEnvironmentMismatchError**(`message`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:145](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L145)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isXmtpNotRegisteredError()

> **isXmtpNotRegisteredError**(`message`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:136](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L136)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### normalizeEvmAddress()

> **normalizeEvmAddress**(`value`): `string` \| `null`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L32)

#### Parameters

##### value

`unknown`

#### Returns

`string` \| `null`

***

### parseWireContent()

> **parseWireContent**(`raw`): [`ParsedWireContent`](#parsedwirecontent)

Defined in: [src/lib/xmtp/xmtpHelpers.ts:54](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L54)

#### Parameters

##### raw

`string`

#### Returns

[`ParsedWireContent`](#parsedwirecontent)

***

### readCanMessageBoolean()

> **readCanMessageBoolean**(`value`): `boolean` \| `null`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:180](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L180)

#### Parameters

##### value

`unknown`

#### Returns

`boolean` \| `null`

***

### shouldFallbackToOriginalXmtpRecipient()

> **shouldFallbackToOriginalXmtpRecipient**(`params`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:236](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L236)

#### Parameters

##### params

###### canonicalizedFromAddress

`` `0x${string}` `` \| `null`

###### originalCanMessage

`boolean` \| `null`

###### peerAddress

`` `0x${string}` ``

###### peerCanMessage

`boolean` \| `null`

#### Returns

`boolean`

***

### truncateAddress()

> **truncateAddress**(`addr`): `string`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L27)

#### Parameters

##### addr

`string`

#### Returns

`string`
