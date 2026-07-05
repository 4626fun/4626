# Revenue domain (layout Phase 2)

Target home for oracles, routers, and vesting currently under `contracts/utilities/`.

| Current path | Target |
|--------------|--------|
| `utilities/routers/PayoutRouter.sol` | `revenue/creator/` |
| `utilities/routers/agent/AgentRevenueRouter.sol` | `revenue/agent/` |
| `revenue/agent/AgentOVaultTaxAdapter.sol` | V3 tax adapter |
| `utilities/oracles/` | `revenue/oracles/` |

Agent lane uses **AgentRevenueRouter** for `projectTaxRecipient` — never the raw ERC-4626 vault.
