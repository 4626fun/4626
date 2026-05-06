# Identity surface spec — nav header identity card + `/accounts` page

> **Canonical reference:** [docs/ACCOUNT_MODEL.md](../ACCOUNT_MODEL.md). The "mental model (ground truth)" diagram below predates the four-population taxonomy in ACCOUNT_MODEL.md §2; reconcile against the canonical doc when shipping any UI surface that displays addresses.

**Status:** draft spec, awaiting approval before build.
**Owner:** frontend.
**Trigger:** confusion about which of {external EOA, Privy embedded EOA, Coinbase Smart Wallet} is surfaced in the header; creator coin + basename not displayed anywhere prominent.

---

## Mental model (ground truth)

Every authenticated 4626 creator has up to four distinct addresses. The UI today exposes one or two of them arbitrarily, which is the root cause of the current confusion.

```
Privy user (human; email/social/wallet login)
│
├── (1) Privy-provisioned embedded EOA          — auto-created on signup, custody by Privy
│
├── (2) Canonical Smart Wallet (CSW, Coinbase)  ← the canonical onchain identity
│       owns: creator coin, 4626 vault, share tokens, lottery entries
│       signed by: Privy embedded EOA by default; optionally co-owned by (3)
│
└── (3) External EOA, optional                   — Rabby / MetaMask, added as CSW co-owner
         signs on behalf of CSW when active in wagmi
```

**Design principle:** the UI's primary identifier MUST be the one that matches what users say out loud and what they see on-chain — that's the **CSW**, because that's what holds the creator coin and owns the vault. External EOA + embedded EOA are signing keys, not identities.

Today's header surfaces (1) or whichever wagmi reports as connected. Neither (1) nor (3) is the "identity" — (2) is. The spec below reverses the priority.

---

## Nav header identity card

### Visual target

```
┌────────────────────────────────────────┐
│ [AVATAR]  akita.base.eth            ▾ │  ← CSW basename  (primary)
│           0x5b67…fa75  CSW  ⓘ          │  ← CSW short address + pill (secondary)
│           [●] $AKITA                    │  ← creator coin chip (tertiary; only if present)
└────────────────────────────────────────┘
```

### Resolution order (primary label)

Priority highest to lowest:

1. **CSW basename** (`akita.base.eth`, `creator.base.eth`, etc.)
2. **CSW ENS** (`akita.eth`) — less common on L2 but possible via L1 reverse resolver
3. **External EOA basename / ENS** — only if CSW has no name AND an external EOA is connected in wagmi
4. **Privy embedded EOA basename / ENS** — only if nothing else resolves
5. **Short CSW address**: `0x5b67…fa75` (never show the Privy embedded address as primary)

### Avatar (24×24 round)

1. CSW basename avatar (from `getBasenameProfile(csw)`)
2. CSW ENS avatar
3. External EOA basename/ENS avatar (if primary label is the external EOA)
4. **Deterministic jazzicon** — colorful generative SVG identicon derived from the address bytes. Same address always produces the same icon; this is the consistent "who" cue when no basename/ENS avatar is set. Sized to match the surrounding avatar slot (24×24 in the header, 48×48 on `/accounts`).

### Secondary line (always visible under primary)

- **CSW address** in short form (`0x5b67…fa75`)
- **`CSW` pill** next to it (subtle border, zinc text) with `ⓘ` icon
- **Tooltip on the pill**: "Your Coinbase Smart Wallet — this is the onchain identity that owns your vault and creator coin."
- **Click copies full address** with a "Copied" toast

### Creator coin chip (conditional tertiary line)

Shown ONLY when BOTH:
- `CreatorRegistry.getTokenForVault(csw) != address(0)` (the CSW has a registered creator coin), AND
- The coin resolves against the Zora profile API with a symbol + logo.

If either condition fails, the chip is simply **not rendered**. No empty-state, no `$UNKNOWN` fallback — the card gracefully loses a line. Creators without a coin just see the identity name + CSW address.

```
[●] $AKITA
```

- **Logo** (16×16 square, rounded corners): Zora profile's `mediaContent.previewImage.small` or the coin's `image` metadata
- **Symbol**: `$<SYMBOL>` in brand accent color
- **Click**: navigates to `/explore/creators/base/<tokenAddress>`

### Connected-wallet indicator (subtle)

Bottom-right of the card, a tiny dot:
- **Green dot**: external EOA connected via wagmi (Rabby, MetaMask, CBW, etc.)
- **Blue dot**: Privy embedded EOA is signing (no external wallet connected)
- **No dot**: session only, no active signer

Hover shows the active signer's short address + type (e.g. "Rabby EOA · 0xA…").

### Dropdown menu (expanded)

Three clearly labeled address rows:

```
┌──────────────────────────────────┐
│ CANONICAL                        │
│  [avatar] akita.base.eth         │
│           0x5b67…fa75    [copy]  │
│           Coinbase Smart Wallet   │
│                                   │
│ ACTIVE SIGNER                     │
│  [avatar] 0xA8d7…2eab    [copy]  │
│           Rabby EOA   (external)  │
│                                   │
│ EMBEDDED (auto)                   │
│           0xB05c…0FdD    [copy]  │
│           Privy embedded (idle)   │
│                                   │
│ ─────────────────────             │
│ • Account settings                │
│ • Connect another wallet          │
│ • Sign out                        │
└──────────────────────────────────┘
```

Rows hidden when that address doesn't exist (e.g. no external EOA connected → hide the "Active signer" section, show only "Canonical" + "Embedded").

### Copy/paste behavior

- Click on the short address or the copy icon → copies full 42-char address to clipboard
- Toast appears at top-right: "Copied 0x5b67…fa75" (1.2s fade)

---

## `/accounts` page reorganization

Today: the accounts page surfaces Privy wallets, linked providers, Rabby co-owner registration, advanced options — all at the same hierarchy, no visual priority.

### Proposed new top-of-page section: **"Your identity"**

A single large card above everything else:

```
┌─────────────────────────────────────────────────────────────┐
│ YOUR CANONICAL IDENTITY                                     │
│                                                             │
│  [48×48 AVATAR]   akita.base.eth                            │
│                   0x5b6741968…fa75   [copy]                 │
│                   Coinbase Smart Wallet · Base              │
│                                                             │
│  CREATOR COIN                                               │
│  [24×24 LOGO]  $AKITA · Akita Inu                           │
│                0x5b6741968…fa75 · $1.23 · 1.2M market cap   │
│                View on Zora ↗   View on 4626 ↗              │
└─────────────────────────────────────────────────────────────┘
```

- Avatar is larger (48×48) with the basename / ENS / jazzicon resolution chain above
- Primary name is the CSW's basename/ENS (or short address)
- Clear `Coinbase Smart Wallet · Base` label so there's no ambiguity about what this address is
- Creator coin row shows logo + symbol + name + current price + market cap (Zora API already returns these)
- Two links: Zora detail page + 4626 `/explore/creators/base/<coin>` page

### Below the canonical card: **"Signers"** section

Two sub-cards side-by-side:

```
┌─────────────────────────────┬─────────────────────────────┐
│ ACTIVE EXTERNAL SIGNER      │ EMBEDDED EOA                │
│                             │                             │
│ [avatar] 0xA8d7…2eab        │ [avatar] 0xB05c…0FdD        │
│          rabby.eth          │          Privy-managed      │
│          Rabby · MetaMask   │          Email OTP sign-in  │
│          co-owner of CSW    │          default signer     │
│                             │                             │
│ [Disconnect]  [Unlink]      │ [View backup phrase]        │
└─────────────────────────────┴─────────────────────────────┘
```

When external EOA isn't connected, the left card shows:

```
┌─────────────────────────────┐
│ CONNECT AN EXTERNAL SIGNER  │
│                             │
│ Add your Rabby, MetaMask,   │
│ or Coinbase Wallet as a     │
│ secondary signer on your    │
│ Coinbase Smart Wallet.      │
│                             │
│ [Connect wallet]            │
└─────────────────────────────┘
```

### Advanced controls (collapsed by default)

Everything that's currently above-the-fold on `/accounts` moves under a collapsible "Advanced" section:

- Privy wallet list (all addresses Privy knows about for this user)
- Provider linking UI (Twitter, Telegram, etc.)
- Arch B enrollment + revoke
- Advanced co-owner configuration (custom address entry)
- Session token inspection

This reduces the cognitive load of the landing state to: "here's my identity, here's who signs, advanced stuff is hidden."

---

## Components to build

1. **`useCanonicalIdentity()` hook** — composed of:
   - `useAccount()` → external EOA (if connected)
   - `useSiweAuth()` → session address (the CSW or a fallback)
   - `usePrivyClient()` → Privy user + embedded wallet list
   - Returns `{cswAddress, externalEoaAddress, privyEmbeddedAddress, activeSigner: 'external' | 'embedded' | null, creatorCoinAddress}`
   - Creator coin address via one `CreatorRegistry.getTokenForVault(csw)` read (cached)

2. **`useBasenameForAddress(address)` hook** — thin wrapper over existing `getBasenameProfile`, returns `{name, avatar, loading}` with in-memory cache.

3. **`useCreatorCoinBadge(coinAddress)` hook** — fetches Zora profile for the coin address, returns `{symbol, name, logoUrl, priceUsd, marketCapUsd}` or null. Same API we already use in `CreatorEarnings.tsx`.

4. **`JazziconAvatar` component** — deterministic SVG identicon derived from address bytes. Used as the fallback when no basename/ENS avatar resolves. Same address always produces the same icon across the app, so users recognize their own addresses without reading the hex.

5. **`CanonicalIdentityCard` component** — the new top-right surface. Replaces the current `IdentityButton` in `ConnectButton.tsx` while preserving its click-to-open dropdown behavior.

6. **`YourIdentityHero` component** — the big card at the top of `/accounts`. Embedded at the top of `AccountsPage.tsx`.

7. **`SignersSection` component** — the two-column signer cards on `/accounts`.

8. **Copy-to-clipboard + toast utility** — reuse existing `Toast` component; add a `CopyableAddress` mini-component that shows short form + copy icon.

---

## Non-goals (out of scope for this spec)

- Changing any auth flows (sign-in, sign-out, co-owner registration). Read-only redesign of how existing identity state is *displayed*.
- Adding new identity providers (Lens, Farcaster, Twitter names directly in header). Basename + ENS only for now; Lens resolution stays where it is (`useIdentity` hook still exposes it, just not surfaced in the header card).
- Changing the `CreatorRegistry` or adding new endpoints. All address-to-name lookups go through existing libraries.
- Mobile responsive design overhaul. Design assumes the existing header layout; mobile sizing inherits the current rules (collapse dropdown to full-screen sheet below `md:` breakpoint).

---

## Decisions (from design review, 2026-04-19)

1. **Creator coin chip:** only rendered when the CSW has a registered coin AND its Zora profile resolves. If either fails, the chip is omitted — no `$UNKNOWN` fallback. Cleaner empty states.
2. **Avatar fallback:** deterministic jazzicon SVG. Same address produces the same icon across header, dropdown, and `/accounts` page so users recognize their own without reading hex.
3. **`/accounts` Advanced section:** collapsed behind a disclosure toggle with a one-line summary.
4. **"External signer" subtitle:** "co-owner of CSW" only shown when `CoinbaseSmartWallet.isOwner(eoa)` returns true. Otherwise labeled "external wallet — not yet linked" with a "Link as co-owner" CTA.

---

## Estimated effort

- Phase 1 (nav header card only): **2–3 hours** — hooks + component + wiring
- Phase 2 (accounts page hero + signers): **1–2 hours** — reuses phase 1 hooks
- Phase 3 (advanced collapsibility + copy-to-clipboard polish): **1 hour**

Total: **4–6 hours** for the full spec.

Ship phases independently; nav header card alone is a meaningful improvement even without the `/accounts` redesign.
