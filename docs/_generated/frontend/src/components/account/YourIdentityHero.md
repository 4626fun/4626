[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/account/YourIdentityHero

# src/components/account/YourIdentityHero

## Functions

### AdvancedDisclosure()

> **AdvancedDisclosure**(`__namedParameters`): `Element`

Defined in: [src/components/account/YourIdentityHero.tsx:315](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/account/YourIdentityHero.tsx#L315)

Advanced / developer-mode disclosure wrapper for everything that
used to live at the top of `/accounts`. Keeps the page scannable
by default; click the summary to expand.

#### Parameters

##### \_\_namedParameters

###### children

`ReactNode`

###### defaultOpen?

`boolean` = `false`

###### summary?

`string` = `'Detailed Privy wallet list, provider linking, Arch B controls, session tooling.'`

###### title?

`string` = `'Advanced'`

#### Returns

`Element`

***

### SignersSection()

> **SignersSection**(`__namedParameters`): `Element`

Defined in: [src/components/account/YourIdentityHero.tsx:208](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/account/YourIdentityHero.tsx#L208)

`/accounts` two-column "Signers" section.

Left: active external EOA (Rabby / MetaMask / CBW) — with CTA when
none is connected. Right: Privy embedded EOA (auto-provisioned).

"co-owner of CSW" subtitle is intentionally NOT set for the external
EOA here — we'd need to call `CoinbaseSmartWallet.isOwner(eoa)` to
confirm and render that copy conditionally. Follow-up.

#### Parameters

##### \_\_namedParameters

###### onConnectExternal?

() => `void`

#### Returns

`Element`

***

### YourIdentityHero()

> **YourIdentityHero**(): `Element`

Defined in: [src/components/account/YourIdentityHero.tsx:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/account/YourIdentityHero.tsx#L24)

`/accounts` page hero — the primary "this is who you are onchain"
surface. Shows:

  - 48×48 avatar (basename/ENS → jazzicon fallback)
  - CSW basename/ENS (or short address if no name resolves)
  - "Coinbase Smart Wallet · Base" labeled subtitle
  - Copyable full CSW address
  - Creator coin chip with logo, symbol, name, and external links
    to Zora + 4626 explore (only when the coin resolves)

Uses the same hooks as the nav header card so queries are shared via
react-query / the basename cache.

#### Returns

`Element`
