[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/account/CanonicalIdentityCard

# src/components/account/CanonicalIdentityCard

## Functions

### CanonicalIdentityCard()

> **CanonicalIdentityCard**(`__namedParameters`): `Element`

Defined in: [src/components/account/CanonicalIdentityCard.tsx:29](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/CanonicalIdentityCard.tsx#L29)

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

###### activeNetworkLabel?

`string` \| `null` = `'Base'`

###### activeNetworkUsd?

`number` \| `null` = `null`

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

Defined in: [src/components/account/CanonicalIdentityCard.tsx:160](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/CanonicalIdentityCard.tsx#L160)

Dropdown body content — canonical smart wallet first, then signer lanes.
Sub-account is surfaced only for population (b) when it is the effective swap lane.

#### Parameters

##### \_\_namedParameters

###### disconnectingMainWallet?

`boolean`

###### identity

[`CanonicalIdentity`](../../hooks/useCanonicalIdentity.md#canonicalidentity)

###### onRequestConnectWallet?

() => `void`

###### onRequestDisconnectMainWallet?

() => `void`

###### onRequestSignOut?

() => `void`

###### signingOut?

`boolean`

#### Returns

`Element`
