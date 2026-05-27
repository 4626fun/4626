[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/zora/init

# src/lib/zora/init

## Functions

### initZoraCoinsSdk()

> **initZoraCoinsSdk**(): `Promise`\<`void`\>

Defined in: [src/lib/zora/init.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/init.ts#L10)

Initializes the Zora Coins SDK with a public (browser) API key.

Notes:
- This key is public by design. Restrict Allowed Origins in Zora Developer Settings.
- We lazy-load the SDK to avoid inflating the initial bundle.

#### Returns

`Promise`\<`void`\>
