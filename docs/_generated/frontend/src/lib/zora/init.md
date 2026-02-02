[**creatorvault-miniapp**](../../../index.md)

***

[creatorvault-miniapp](../../../index.md) / src/lib/zora/init

# src/lib/zora/init

## Functions

### initZoraCoinsSdk()

> **initZoraCoinsSdk**(): `Promise`\<`void`\>

Defined in: [lib/zora/init.ts:10](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/zora/init.ts#L10)

Initializes the Zora Coins SDK with a public (browser) API key.

Notes:
- This key is public by design. Restrict Allowed Origins in Zora Developer Settings.
- We lazy-load the SDK to avoid inflating the initial bundle.

#### Returns

`Promise`\<`void`\>
