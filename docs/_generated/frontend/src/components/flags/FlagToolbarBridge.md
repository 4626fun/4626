[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/flags/FlagToolbarBridge

# src/components/flags/FlagToolbarBridge

## Functions

### FlagToolbarBridge()

> **FlagToolbarBridge**(): `Element`

Defined in: [src/components/flags/FlagToolbarBridge.tsx:14](https://github.com/wenakita/4626/blob/c75a1c24d9b9350ac3d121d5a700640674fe0027/frontend/src/components/flags/FlagToolbarBridge.tsx#L14)

Renders the Vercel Flags SDK script tags so the Flags Explorer
(Vercel Toolbar) can discover and display flag state.

Also bootstraps the remote flags fetch for Vercel-managed (ui) flags.
Mount once near the root of the app shell.

#### Returns

`Element`
