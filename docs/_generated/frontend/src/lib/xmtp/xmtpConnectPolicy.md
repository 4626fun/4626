[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/xmtp/xmtpConnectPolicy

# src/lib/xmtp/xmtpConnectPolicy

## Type Aliases

### XmtpConnectIntent

> **XmtpConnectIntent** = `"auto"` \| `"user"`

Defined in: [src/lib/xmtp/xmtpConnectPolicy.ts:1](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectPolicy.ts#L1)

## Functions

### shouldAllowFirstTimeCreate()

> **shouldAllowFirstTimeCreate**(`input`): `boolean`

Defined in: [src/lib/xmtp/xmtpConnectPolicy.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectPolicy.ts#L31)

First-time browser install requires explicit user intent.
Passive/auto callers must not burn an installation slot.

#### Parameters

##### input

###### hasKnownInstallation

`boolean`

###### intent

[`XmtpConnectIntent`](#xmtpconnectintent)

###### opfsDatabaseExists

`boolean`

###### restoreSucceeded

`boolean`

#### Returns

`boolean`

***

### shouldAttemptXmtpRestore()

> **shouldAttemptXmtpRestore**(`input`): `boolean`

Defined in: [src/lib/xmtp/xmtpConnectPolicy.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectPolicy.ts#L7)

Prefer Client.build whenever local OPFS or prior install markers exist.
Never skip restore just because OPFS listing returned false once.

#### Parameters

##### input

###### hasKnownInstallation

`boolean`

###### opfsDatabaseExists

`boolean`

#### Returns

`boolean`

***

### shouldRefuseAutoCreateAfterFailedRestore()

> **shouldRefuseAutoCreateAfterFailedRestore**(`input`): `boolean`

Defined in: [src/lib/xmtp/xmtpConnectPolicy.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectPolicy.ts#L18)

Fail closed before Client.create when restore did not succeed but we still
have evidence of an existing browser/network installation.

#### Parameters

##### input

###### hasKnownInstallation

`boolean`

###### opfsDatabaseExists

`boolean`

###### restoreSucceeded

`boolean`

#### Returns

`boolean`
