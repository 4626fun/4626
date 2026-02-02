---
title: Token model
sidebar_position: 2
---

# Token model

The 4626 protocol uses a three-token system for each creator vault. This document explains the purpose and relationship between these tokens.

---

## Token types

| Symbol | Full name | Contract | Standard |
|--------|-----------|----------|----------|
| TOKEN | Creator Coin | Zora Creator Coin | ERC-20 |
| ▢TOKEN | Vault Shares | `CreatorOVault` | ERC-4626 |
| ■TOKEN | Wrapped Shares | `CreatorShareOFT` | LayerZero OFT |

### TOKEN (Creator Coin)

The underlying asset. Created on Zora's bonding curve platform, this is the original creator token that users deposit into the vault.

**Properties:**
- Standard ERC-20 token
- Issued by Zora's Creator Coin contracts
- Price determined by bonding curve or secondary markets
- The asset deposited into CreatorOVault

### ▢TOKEN (Vault Shares)

Receipt token issued when depositing TOKEN into the vault. Represents proportional ownership of all vault assets, including deployed capital and accumulated yield.

**Properties:**
- ERC-4626 compliant vault shares
- Value increases as vault generates yield
- Used internally for accounting
- Can be wrapped into ■TOKEN for trading

**Conversion:**
```
1 TOKEN deposited → ~1000 ▢TOKEN (due to 10^3 decimals offset)
```

The 1000x multiplier is a security feature preventing first-depositor inflation attacks.

### ■TOKEN (Wrapped Shares)

The user-facing tradeable token. Wrapping normalizes the 1000x multiplier so users see intuitive amounts.

**Properties:**
- LayerZero OFT (Omnichain Fungible Token)
- Can be transferred cross-chain
- 6.9% buy fee on DEX purchases
- Integrated with lottery system
- Price discovery via CCA auction at launch

**Conversion:**
```
1000 ▢TOKEN wrapped → 1 ■TOKEN
1 ■TOKEN unwrapped → 1000 ▢TOKEN
```

Result: **1 TOKEN deposited ≈ 1 ■TOKEN received** (clean UX)

---

## Token flow

```
                           DEPOSIT
                              │
                              ▼
┌─────────────┐       ┌─────────────────┐       ┌─────────────┐
│    TOKEN    │──────►│  CreatorOVault  │──────►│   ▢TOKEN    │
│(Creator Coin)│       │   (ERC-4626)    │       │(Vault Shares)│
└─────────────┘       └─────────────────┘       └─────────────┘
                                                       │
                                                       ▼ WRAP
                                              ┌─────────────────┐
                                              │     Wrapper     │
                                              └─────────────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │     ■TOKEN      │
                                              │  (ShareOFT)     │
                                              └─────────────────┘
                                                       │
                              ┌─────────────────────────┼─────────────────────────┐
                              │                         │                         │
                              ▼                         ▼                         ▼
                         CCA Auction              DEX Trading              Cross-chain
                        (fair launch)            (with 6.9% fee)           (LayerZero)
```

---

## Wrapper normalization

The vault uses a `10^3` decimals offset for security. The wrapper normalizes this for users:

| Direction | Conversion | Example |
|-----------|------------|---------|
| Wrap | ▢TOKEN / 1000 = ■TOKEN | 5000 ▢AKITA → 5 ■AKITA |
| Unwrap | ■TOKEN × 1000 = ▢TOKEN | 5 ■AKITA → 5000 ▢AKITA |

**Why the offset exists:**

The vault's `_decimalsOffset() = 3` creates 1000 "virtual shares" that make first-depositor inflation attacks economically infeasible. Without this, an attacker could manipulate share prices by depositing dust and inflating assets.

**User experience:**

Users interact primarily with ■TOKEN. When they deposit 100 AKITA, they receive approximately 100 ■AKITA. The underlying ▢AKITA mechanics are abstracted away.

---

## Price relationship

All three tokens represent claims on the same underlying value:

```
1 ■TOKEN = 1000 ▢TOKEN = (pricePerShare × 1000) TOKEN
```

As the vault generates yield, `pricePerShare` increases:
- ▢TOKEN value increases relative to TOKEN
- ■TOKEN value increases proportionally

**Example:**
- Initial: 1 ■AKITA ≈ 1 AKITA
- After 10% yield: 1 ■AKITA ≈ 1.1 AKITA

---

## Symbol conventions

The ▢ and ■ symbols are standard notation across all creator vaults:

| Creator | Creator Coin | Vault Shares | Wrapped OFT |
|---------|--------------|--------------|-------------|
| AKITA | AKITA | ▢AKITA | ■AKITA |
| DEGEN | DEGEN | ▢DEGEN | ■DEGEN |
| CLANKER | CLANKER | ▢CLANKER | ■CLANKER |

These symbols appear in:
- Token names and symbols
- UI displays
- Documentation
- Contract events

---

## Contract addresses

Each creator vault has three token addresses:

```solidity
// Example for AKITA vault
address TOKEN = 0x...;        // AKITA (Zora Creator Coin)
address VAULT = 0x...;        // CreatorOVault (also ▢AKITA)
address WRAPPER = 0x...;      // CreatorOVaultWrapper
address SHARE_OFT = 0x...;    // CreatorShareOFT (■AKITA)
```

The vault contract itself is the ▢TOKEN, as ERC-4626 vaults are their own share tokens.

---

## Integration

**DEX integrations:** Trade ■TOKEN (has buy fee, lottery, cross-chain).

**Yield tracking:** Use `vault.pricePerShare()` (starts at 1e18, increases with yield).

**Cross-chain:** Only ■TOKEN can bridge via LayerZero. See [OFT integration](/integrations/oft).

---

## Related

- [Architecture](/overview/architecture) - System design
- [Wrapper](/contracts/core/creator-ovault-wrapper) - Wrapper contract
- [Cross-chain](/integrations/oft) - LayerZero integration
