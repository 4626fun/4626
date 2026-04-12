[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/xmtp/identityResolver

# src/lib/xmtp/identityResolver

## Type Aliases

### XmtpIdentitySource

> **XmtpIdentitySource** = `"connected"` \| `"account-context"` \| `"waitlist"`

Defined in: [src/lib/xmtp/identityResolver.ts:4](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/xmtp/identityResolver.ts#L4)

***

### XmtpModeOverride

> **XmtpModeOverride** = `"EOA"` \| `"SMART_WALLET"` \| `null` \| `undefined`

Defined in: [src/lib/xmtp/identityResolver.ts:3](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/xmtp/identityResolver.ts#L3)

## Functions

### resolveModePreferredIdentity()

> **resolveModePreferredIdentity**(`input`): `ResolveModePreferredIdentityResult`

Defined in: [src/lib/xmtp/identityResolver.ts:26](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/xmtp/identityResolver.ts#L26)

#### Parameters

##### input

`ResolveModePreferredIdentityInput`

#### Returns

`ResolveModePreferredIdentityResult`

***

### shouldRequireAuthBackedXmtpIdentity()

> **shouldRequireAuthBackedXmtpIdentity**(`input`): `boolean`

Defined in: [src/lib/xmtp/identityResolver.ts:64](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/xmtp/identityResolver.ts#L64)

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

#### Returns

`boolean`
