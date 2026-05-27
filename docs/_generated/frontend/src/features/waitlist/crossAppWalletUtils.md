[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/crossAppWalletUtils

# src/features/waitlist/crossAppWalletUtils

## Type Aliases

### CrossAppAuthAction

> **CrossAppAuthAction** = `"link"` \| `"login"`

Defined in: [src/features/waitlist/crossAppWalletUtils.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/crossAppWalletUtils.ts#L8)

Privy cross-app auth helper for Zora linking during waitlist / account setup.

Canonical CSW resolution lives in `useAccountSetupController` and server
identity helpers — not here.

## Functions

### selectCrossAppAuthAction()

> **selectCrossAppAuthAction**(`params`): [`CrossAppAuthAction`](#crossappauthaction) \| `null`

Defined in: [src/features/waitlist/crossAppWalletUtils.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/crossAppWalletUtils.ts#L10)

#### Parameters

##### params

###### linkCrossAppAccount

`unknown`

###### loginWithCrossAppAccount

`unknown`

###### privyAuthed

`boolean`

#### Returns

[`CrossAppAuthAction`](#crossappauthaction) \| `null`
