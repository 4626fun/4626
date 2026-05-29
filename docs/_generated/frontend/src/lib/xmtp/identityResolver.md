[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/xmtp/identityResolver

# src/lib/xmtp/identityResolver

## Type Aliases

### XmtpIdentitySource

> **XmtpIdentitySource** = `"connected"` \| `"account-context"` \| `"waitlist"`

Defined in: [src/lib/xmtp/identityResolver.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/identityResolver.ts#L4)

***

### XmtpModeOverride

> **XmtpModeOverride** = `"EOA"` \| `"SMART_WALLET"` \| `null` \| `undefined`

Defined in: [src/lib/xmtp/identityResolver.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/identityResolver.ts#L3)

## Functions

### resolveModePreferredIdentity()

> **resolveModePreferredIdentity**(`input`): `ResolveModePreferredIdentityResult`

Defined in: [src/lib/xmtp/identityResolver.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/identityResolver.ts#L27)

#### Parameters

##### input

`ResolveModePreferredIdentityInput`

#### Returns

`ResolveModePreferredIdentityResult`

***

### shouldRequireAuthBackedXmtpIdentity()

> **shouldRequireAuthBackedXmtpIdentity**(`input`): `boolean`

Defined in: [src/lib/xmtp/identityResolver.ts:74](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/identityResolver.ts#L74)

#### Parameters

##### input

###### accountContextSmartAddress?

`string` \| `null`

###### connectedAddress

`string`

###### enforceCanonicalForConnectedSigner

`boolean`

###### modeOverride?

[`XmtpModeOverride`](#xmtpmodeoverride)

###### waitlistCanonicalAddress?

`string` \| `null`

###### waitlistXmtpMemberAddress?

`string` \| `null`

#### Returns

`boolean`
