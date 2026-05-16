# Tamago ERC-4626 Reference Module

This directory vendors the [Bacon Labs Tamago](https://github.com/Bacon-labs/tamago)
formally-verified ERC-4626 implementation as a **reference** alongside
`CreatorOVault`. It is **not** wired into the production OVault module system,
governance, strategies, or LayerZero composers — it exists so we can:

1. Run Tamago's invariant test suite inside this repo's CI.
2. Compare Tamago's spec-correct ERC-4626 behavior against `CreatorOVault`'s
   OpenZeppelin-based implementation under identical inputs.
3. Keep the Verity source / Lean spec / Lean proof artifacts checked in for
   reviewer inspection.

## Origin

- Upstream: https://github.com/Bacon-labs/tamago
- Announcement: https://x.com/boredGenius/status/2053887607877316783
- Toolchain: https://tama.tools  (Tama 0.1.4 at vendor time)
- Verity language: https://veritylang.com
- License: MIT (see `LICENSE`)

## Layout

```
contracts/vault/tamago/
├── generated/                  Solidity emitted from Verity by `tama build`
│   ├── ERC20Deployer.sol
│   ├── ERC20Iface.sol
│   ├── ERC4626Deployer.sol     ← the formally-verified vault
│   ├── ERC4626Iface.sol
│   ├── ERC721{Deployer,Iface}.sol
│   ├── FixedPointMathLib{Deployer,Iface}.sol
│   ├── Ownable{Deployer,Iface}.sol
│   └── WETH{Deployer,Iface}.sol
├── verity/
│   ├── src/Tamago/Tokens/ERC4626.lean
│   ├── src/Tamago/Utils/FixedPointMathLib.lean
│   ├── spec/Tamago/Spec/Tokens/ERC4626Spec.lean
│   ├── spec/Tamago/Spec/Utils/FixedPointMathLibSpec.lean
│   ├── proof/Tamago/Proof/Tokens/ERC4626Proof.lean
│   ├── proof/Tamago/Proof/Utils/FixedPointMathLibProof.lean
│   └── common/Tamago/Common/ERC4626{Concrete,Ghost}.lean
└── test/
    ├── TamagoERC4626Mirror.t.sol      Upstream Foundry mirror tests (1.8k lines)
    └── CreatorOVaultParity.t.sol      Spec-parity comparison against CreatorOVault
```

## Foundry usage

A remapping is registered in `foundry.toml` and `remappings.txt`:

```
tamago/=contracts/vault/tamago/
```

So tests import the vendored artifacts as:

```solidity
import {ERC4626Deployer} from "tamago/generated/ERC4626Deployer.sol";
import {ERC4626Iface}    from "tamago/generated/ERC4626Iface.sol";
```

Run the suite:

```bash
forge test --match-path "contracts/vault/tamago/test/*.t.sol" -vv
```

The generated deployers are `pragma solidity ^0.8.20`; this repo compiles with
`solc 0.8.30` (compatible).

## Important caveats

- The `generated/` files are **byte-blob deployers** — they `create()` a
  contract from a hex runtime emitted by Verity. You cannot inherit from them
  or extend them; you can only deploy them and talk to the resulting address
  via the `*Iface` interface. This is intentional (the Verity-proven bytecode
  must not be modified) but it means Tamago's vault is **not** a drop-in
  replacement for `CreatorOVault`, which is OZ-ERC4626 based and is extended
  via modules, strategies, governance, and LayerZero composers.
- The Tamago vault uses a self-mintable ERC-20 from `ERC20Deployer.deploy(owner)`
  as its underlying asset in the upstream tests. The parity test below uses the
  same pattern so behavior is comparable apples-to-apples.
- The trust base for Tamago's Lean proofs is documented upstream in
  [`tama.toml`](https://github.com/Bacon-labs/tamago/blob/main/tama.toml) under
  `[trust.allow_axioms]`. Notably, the ERC-4626 proof trusts the configured
  asset implements standard `transfer/transferFrom` semantics (so wrapping a
  non-standard or rebasing asset voids the proof guarantee).

## Regenerating from Verity

If upstream Tamago updates, regenerate locally on a machine with ≥10 GB free
disk (Mathlib unpack is large):

```bash
# 1. Install Tama toolchain
curl -L https://tama.tools/install.sh | sh
. ~/.tama/env

# 2. Init a sibling workspace
mkdir -p /tmp/tamago-ws && cd /tmp/tamago-ws
tama init .

# 3. Install Tamago
tama install Bacon-labs/tamago
tama build

# 4. Re-vendor the generated Solidity into this repo
REPO=/path/to/4626
cp src/generated/verity/*.sol $REPO/contracts/vault/tamago/generated/
cp test/verity/tokens/ERC4626.t.sol \
   $REPO/contracts/vault/tamago/test/TamagoERC4626Mirror.t.sol

# 5. Re-fix the four import paths in TamagoERC4626Mirror.t.sol from
#    "../../../src/generated/verity/X.sol"  →  "tamago/generated/X.sol"

# 6. Re-vendor the Verity sources / specs / proofs (reference only)
```

If you also want to run Tamago's Lean proofs locally:

```bash
cd /tmp/tamago-ws
tama test     # builds Mathlib, runs Lean proofs + Foundry mirror tests
```

This typically takes 15–40 minutes on first run; subsequent runs are cached.
