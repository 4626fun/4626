# Standard Vault Naming Pattern

## Pattern

All CreatorVault Charm vaults use this consistent naming:

```
Name:   "CreatorVault: [token]/USDC"
Symbol: "CV-[token]-USDC"
```

---

## Examples

```solidity
// AKITA token vault:
Name:   "CreatorVault: akita/USDC"
Symbol: "CV-akita-USDC"

// DOGE token vault:
Name:   "CreatorVault: doge/USDC"
Symbol: "CV-doge-USDC"

// PEPE token vault:
Name:   "CreatorVault: pepe/USDC"
Symbol: "CV-pepe-USDC"

// SHIB token vault:
Name:   "CreatorVault: shib/USDC"
Symbol: "CV-shib-USDC"
```

---

## Deployment

```solidity
// Deploy with standard naming
batchDeployStrategies(
    TOKEN_ADDRESS,
    USDC_ADDRESS,
    VAULT_ADDRESS,
    AJNA_FACTORY,
    3000,
    sqrtPriceX96,
    CREATOR_ADDRESS,
    "CreatorVault: [token]/USDC",  // Replace [token] with lowercase symbol
    "CV-[token]-USDC"               // Replace [token] with lowercase symbol
);
```

---

## Naming Rules

1. Always use lowercase for token symbols (e.g., "akita" not "AKITA")
2. Always use format: `CreatorVault: [token]/USDC`
3. Always use symbol: `CV-[token]-USDC`
4. Quote token is always: `USDC` (uppercase)
5. No variations (consistency across all vaults)

---

## Token Symbol Convention

CreatorVault uses two special glyphs for vault-related tokens:

| Token Type | Symbol Format | Contract | Example |
|------------|---------------|----------|---------|
| Vault Token (ERC-4626 shares) | `▢{COIN}` | CreatorOVault.sol | ▢AKITA |
| Share Token (LayerZero OFT) | `■{COIN}` | CreatorShareOFT.sol | ■AKITA |

- **▢{COIN}**: Vault shares that stay on-chain and earn yield via strategies
- **■{COIN}**: Wrapped vault shares that are cross-chain capable and tradeable on DEXes

---

## Benefits

- Consistent branding across all vaults
- Easy to identify CreatorVault products
- Clear token pairing shown in name
- Professional appearance on block explorers
- No confusion between different vaults

---

This is the standard naming pattern for all CreatorVault Charm vaults.
