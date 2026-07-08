# Remediation — 4626 Contracts Audit 2026-07-08

## Shipped in this pass (P0)

### H-01 — Recovery escrow push-then-notify

| Change | Path |
|--------|------|
| Credit free custody; no `transferFrom` | `contracts/shared/vault/recovery/OVaultRecoveryEscrow.sol` |
| Unit test mint-before-notify | `test/vault/OVaultRecoveryEscrow.t.sol` |
| PoCs | `test/audit/Audit20260708.P0.t.sol` |

Vault push path (`CreatorOVaultCoreModule.notifyImpairmentRecovery`, strategy eject) unchanged — escrow now matches it.

### C-01 — ShareOFT salt + adopt safety

| Change | Path |
|--------|------|
| Salt includes `creatorToken` | `DeploymentBatcher.sol` (`DeploymentBatcherUtilsHelper`) |
| `Phase1ShareOFTAlreadyBound` on foreign vault | phase-1 finalize catch path |
| Frontend salt derivation | `frontend/src/lib/deploy/perVaultVanityVersionSearch.ts` + callers |
| Telegram deploy salt | `frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts` |
| Robinhood remote predict | `robinhoodShareBridgeWiring.ts` (+ test) |

**Ops note:** Next bytecode epoch must re-seed manifests for any address that was predicted with the pre-C01 salt. Vanity grinds must pass `creatorToken`.

### H-02 / H-03 — Lottery coverage

| Change | Path |
|--------|------|
| Block-start coverage snapshot | `CreatorShareOFT.sol`, `AgentShareOFT.sol` |
| Manager caps + uses eligible balance | `LotteryManager4626.sol` |
| AMOE reads ShareOFT (not lane coin) | `processAmoeEntry` |
| Parity test update | `test/CreatorLotteryManager.AmoeLinearParity.t.sol` |
| PoCs | `test/audit/Audit20260708.P0.t.sol` |

---

## Validation commands (must stay green)

```bash
forge test --match-path 'test/audit/Audit20260708.P0.t.sol'
forge test --match-contract CreatorOVaultImpairmentV1Test
forge test --match-contract OVaultRecoveryEscrowTest
forge test --match-path 'test/CreatorLotteryManager.AmoeLinearParity.t.sol'
```

---

## Remaining backlog (priority)

| Priority | IDs | Work |
|----------|-----|------|
| **P1** | H-04 | CCA migrate resistant to V4 init front-run |
| **P1** | H-05 | Charm share sizing + non-zero minOut |
| **P1** | H-08 | Mandatory phase-module codehash + timelock/freeze |
| **P2** | H-06, H-07 | Minter backing invariant; emergency always returns to vault |
| **P2** | M-01…M-15 | See audit-report.md |
| **P2** | Suite | Triage full `forge test` ~35 pre-existing failures |

---

## Deploy / bytecode impact

Changes that alter CREATE2 / initcode and require store re-seed before production deploys of **new** vaults:

- `DeploymentBatcher` (utils helper salt + phase-1 module errors)
- `CreatorShareOFT` / `AgentShareOFT` (coverage snapshot storage + lottery path)
- `LotteryManager4626` (coverage helpers)
- `OVaultRecoveryEscrow` (notify semantics)

Lane parity: both ShareOFT forks updated for lottery coverage; agent `_update` still has intentional fee-on-transfer wrapper divergence.
