[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/wallet/inAppBrowser

# src/lib/wallet/inAppBrowser

## Type Aliases

### InAppEnvironment

> **InAppEnvironment** = `object`

Defined in: [src/lib/wallet/inAppBrowser.ts:33](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/inAppBrowser.ts#L33)

Snapshot of the host environment we collect once per page render.  Pure
data; no React hooks here so it's safe to call from anywhere.

#### Properties

##### hasInjectedEthereum

> **hasInjectedEthereum**: `boolean`

Defined in: [src/lib/wallet/inAppBrowser.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/inAppBrowser.ts#L35)

True iff `window` and `window.ethereum` are available.

##### isAnyWalletInApp

> **isAnyWalletInApp**: `boolean`

Defined in: [src/lib/wallet/inAppBrowser.ts:45](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/inAppBrowser.ts#L45)

True for any wallet-managed in-app browser.  Catch-all for unknown
webviews that look enough like a wallet to warrant routing the user
out to a real browser.

##### isBaseAppInApp

> **isBaseAppInApp**: `boolean`

Defined in: [src/lib/wallet/inAppBrowser.ts:39](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/inAppBrowser.ts#L39)

True for the Base App / Toshi in-app browser.

##### isCoinbaseInApp

> **isCoinbaseInApp**: `boolean`

Defined in: [src/lib/wallet/inAppBrowser.ts:37](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/inAppBrowser.ts#L37)

True for the Coinbase Wallet in-app browser (Android + iOS).

##### userAgent

> **userAgent**: `string`

Defined in: [src/lib/wallet/inAppBrowser.ts:47](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/inAppBrowser.ts#L47)

Lower-cased userAgent string for telemetry / debug copy.

## Functions

### detectInAppEnvironment()

> **detectInAppEnvironment**(): [`InAppEnvironment`](#inappenvironment) \| `null`

Defined in: [src/lib/wallet/inAppBrowser.ts:54](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/inAppBrowser.ts#L54)

Inspects `window` and the injected provider.  Returns `null` during SSR
or when no `window` object is available.

#### Returns

[`InAppEnvironment`](#inappenvironment) \| `null`

***

### externalBrowserUrlFor()

> **externalBrowserUrlFor**(`path`): `string`

Defined in: [src/lib/wallet/inAppBrowser.ts:154](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/inAppBrowser.ts#L154)

Returns a `https://` URL the user can tap to open the current page in the
device default browser, escaping the wallet's in-app webview.

Coinbase Wallet's in-app browser respects standard `target="_blank"` only
when the link uses a custom intent or universal link.  The most reliable
cross-platform escape is to render an `<a href>` with the absolute URL
and `rel="noopener noreferrer external"` — the user sees a "Open in
external browser" affordance in the wallet's own overflow menu.  Newer
Android Coinbase Wallet builds also honour `intent://` URLs with the
`S.browser_fallback_url` extra; we prefer the simple absolute URL because
it works on iOS too.

#### Parameters

##### path

`string`

#### Returns

`string`

***

### isBaseAppInAppContext()

> **isBaseAppInAppContext**(`env`): `boolean`

Defined in: [src/lib/wallet/inAppBrowser.ts:109](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/inAppBrowser.ts#L109)

#### Parameters

##### env

[`InAppEnvironment`](#inappenvironment) | `null`

#### Returns

`boolean`
