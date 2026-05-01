[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/account/CanonicalIdentityCard

# src/components/account/CanonicalIdentityCard

## Functions

### CanonicalIdentityCard()

> **CanonicalIdentityCard**(`__namedParameters`): `Element`

Defined in: [src/components/account/CanonicalIdentityCard.tsx:24](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/CanonicalIdentityCard.tsx#L24)

Top-right identity surface for authenticated users.

Displays the canonical smart wallet (CSW) as the primary identity,
with a clear "CSW" label so users never confuse it with their signing
EOA. Optional creator coin badge when the CSW owns a registered
creator coin via `CreatorRegistry.getTokenForVault(csw)`.

Used from within `ConnectButton.tsx` — the parent component still
owns the dropdown menu + auth actions; this component just renders
the trigger surface.

See `docs/design/identity-surface-spec.md` for the full design rationale.

#### Parameters

##### \_\_namedParameters

###### identity

[`CanonicalIdentity`](../../hooks/useCanonicalIdentity.md#canonicalidentity)

###### menuOpen

`boolean`

###### onToggle

() => `void`

###### variant?

`"nav"` \| `"compact"` = `'nav'`

#### Returns

`Element`

***

### CanonicalIdentityDropdown()

> **CanonicalIdentityDropdown**(`__namedParameters`): `Element`

Defined in: [src/components/account/CanonicalIdentityCard.tsx:122](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/CanonicalIdentityCard.tsx#L122)

Dropdown body content — canonical smart wallet first, then signer lanes.
The app-scoped sub-account is intentionally not surfaced here unless a
future route actively uses it as the transaction sender.

#### Parameters

##### \_\_namedParameters

###### identity

[`CanonicalIdentity`](../../hooks/useCanonicalIdentity.md#canonicalidentity)

###### onRequestConnectWallet?

() => `void`

#### Returns

`Element`
