---
title: CREATE2 Registry
sidebar_position: 4
---

# CREATE2 Registry

Deterministic contract deployment using CREATE2.

## Overview

CREATE2 enables deploying contracts to the same address across chains.

## Usage

```solidity
// Compute deterministic address
address predicted = factory.computeAddress(salt, bytecodeHash);

// Deploy using CREATE2
factory.deploy(salt, bytecode);
```

## Benefits

- Same contract address on all chains
- Predictable deployment addresses
- Easier cross-chain configuration
