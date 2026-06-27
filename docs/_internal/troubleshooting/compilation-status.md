---
title: Compilation Status
sidebar_position: 1
---

# Compilation Status Issues

Fixing Solidity compilation errors.

## Common Issues

### Missing Dependencies

```bash
# Install all dependencies
forge install
```

### Version Mismatch

Ensure `foundry.toml` specifies correct version:

```toml
[profile.default]
solc_version = "0.8.20"
```

### Import Errors

```bash
# Update remappings
forge remappings > remappings.txt
```

## Full Rebuild

```bash
# Clean and rebuild
forge clean
forge build
```
