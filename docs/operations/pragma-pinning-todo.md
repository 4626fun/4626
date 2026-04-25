---
title: Solc Pragma Pinning (L-07 follow-up)
sidebar_position: 31
---

# L-07 follow-up: pin deployable contracts to `pragma solidity 0.8.30`

## Status: deferred — manual review required

The audit (L-07, 2026-04-25) flagged that `contracts/**` mixes four
pragmas:

- `pragma solidity 0.8.30;`
- `pragma solidity ^0.8.0;`
- `pragma solidity ^0.8.20;`
- `pragma solidity ^0.8.22;`

Combined with `auto_detect_solc = true` in `foundry.toml`, this can
cause the build to silently select different solc versions for different
files, which complicates determinism guarantees and bytecode-equivalence
checks across deployments.

## Recommended remediation (not yet applied)

For every file under `contracts/` that compiles to deployable bytecode
(i.e. **not** an interface-only file), pin to the protocol-wide solc:

```diff
-pragma solidity ^0.8.20;
+pragma solidity 0.8.30;
```

Interface-only files (those with no implementation) may keep the caret
range, since interfaces have no bytecode.

## Why this is deferred to a follow-up PR

- Touches a large fraction of `contracts/**` files (≈100 files).
- Pinning to a stricter version can surface previously-tolerated solc
  warnings or new pragma conflicts that would otherwise pass.
- Pin-only changes still alter compiled bytecode (different solc minor
  versions emit different deploy code), so the change is **not**
  zero-impact for already-deployed addresses computed via CREATE2.

## Action items for the follow-up PR

1. Run `git grep -l "^pragma solidity ^0.8" -- contracts/` and triage:
   keep ranges only on interface-only files.
2. Switch `foundry.toml` to `auto_detect_solc = false` once all
   non-interface files are pinned.
3. Re-run the EIP-170 size gate and the full Foundry test suite.
4. Re-run any CREATE2 salt computations affected by deploy bytecode.

## References

- Audit finding: L-07 (audit 2026-04-25)
- Repo grep: `git grep -h "^pragma solidity" -- contracts/ | sort -u`
