[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/account/trayEvents

# src/components/account/trayEvents

## Type Aliases

### AccountTrayOpenDetail

> **AccountTrayOpenDetail** = `object`

Defined in: [src/components/account/trayEvents.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayEvents.ts#L7)

#### Properties

##### section?

> `optional` **section**: [`AccountTraySection`](#accounttraysection)

Defined in: [src/components/account/trayEvents.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayEvents.ts#L8)

##### source?

> `optional` **source**: `"mobile-nav"` \| `"desktop-nav"` \| `"programmatic"`

Defined in: [src/components/account/trayEvents.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayEvents.ts#L10)

##### tab?

> `optional` **tab**: [`AccountTrayTab`](#accounttraytab)

Defined in: [src/components/account/trayEvents.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayEvents.ts#L9)

***

### AccountTraySection

> **AccountTraySection** = `"account"` \| `"portfolio"` \| `"points"`

Defined in: [src/components/account/trayEvents.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayEvents.ts#L4)

***

### AccountTrayTab

> **AccountTrayTab** = `"tokens"` \| `"activity"`

Defined in: [src/components/account/trayEvents.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayEvents.ts#L5)

***

### AccountWalletSummaryDetail

> **AccountWalletSummaryDetail** = `object`

Defined in: [src/components/account/trayEvents.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayEvents.ts#L18)

#### Properties

##### activeNetworkUsd

> **activeNetworkUsd**: `number` \| `null`

Defined in: [src/components/account/trayEvents.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayEvents.ts#L19)

## Variables

### ACCOUNT\_WALLET\_SUMMARY\_EVENT

> `const` **ACCOUNT\_WALLET\_SUMMARY\_EVENT**: `"vault:account-wallet-summary"` = `'vault:account-wallet-summary'`

Defined in: [src/components/account/trayEvents.ts:2](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayEvents.ts#L2)

***

### OPEN\_ACCOUNT\_TRAY\_EVENT

> `const` **OPEN\_ACCOUNT\_TRAY\_EVENT**: `"vault:open-account-tray"` = `'vault:open-account-tray'`

Defined in: [src/components/account/trayEvents.ts:1](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayEvents.ts#L1)

## Functions

### publishAccountWalletSummary()

> **publishAccountWalletSummary**(`detail`): `void`

Defined in: [src/components/account/trayEvents.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayEvents.ts#L22)

#### Parameters

##### detail

[`AccountWalletSummaryDetail`](#accountwalletsummarydetail)

#### Returns

`void`

***

### requestOpenAccountTray()

> **requestOpenAccountTray**(`detail`): `void`

Defined in: [src/components/account/trayEvents.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/trayEvents.ts#L13)

#### Parameters

##### detail

[`AccountTrayOpenDetail`](#accounttrayopendetail) = `{}`

#### Returns

`void`
