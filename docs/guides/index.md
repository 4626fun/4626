---
title: Guides
sidebar_position: 7
---

# Guides

Step-by-step guides and troubleshooting documentation.

**Who this is for:** Users who need help with specific tasks or issues.

---

## Troubleshooting

| Guide | Description |
|-------|-------------|
| [Delayed completion](./troubleshooting/delayed-completion) | Auction completion issues |
| [UserOp signature errors](./troubleshooting/userop-signature-errors) | ERC-4337 signature debugging |
| [Compilation status](./troubleshooting/compilation-status) | Contract compilation issues |

---

## Common tasks

### Deploying a vault

1. Review [pre-launch checklist](/operations/deployment/pre-launch)
2. Deploy contracts via [automation guide](/operations/automation/full-automation)
3. Verify deployment via [approvals checklist](/operations/deployment/approvals-checklist)

### Activating a vault

1. Ensure approvals are set
2. Use `VaultActivationBatcher` for 1-click activation
3. See [account abstraction](/overview/account-abstraction/activation)

### Adding strategies

1. Deploy strategy contracts
2. Add to vault with `addStrategy()`
3. Set idle buffer with `setMinimumTotalIdle()`
4. See [strategy architecture](/overview/architecture/strategy-architecture)

---

## Getting help

If documentation doesn't resolve your issue:

1. Check [ERC-4337 debugging](/reference/erc4337-debugging) for AA issues
2. Review contract source code in `contracts/`
3. Check test files in `test/` for usage examples
