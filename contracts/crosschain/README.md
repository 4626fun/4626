# Cross-chain domain (layout Phase 2)

Target home for bridge + messaging contracts currently under `contracts/utilities/`.

| Current path | Target |
|--------------|--------|
| `utilities/bridge/` | `crosschain/bridge/` |
| `utilities/messaging/CreatorShareOFT.sol` | `crosschain/messaging/creator/` |
| `utilities/messaging/agent/AgentShareOFT.sol` | `crosschain/messaging/agent/` |
| `utilities/messaging/OVaultHubComposer.sol` | `crosschain/messaging/shared/` |

Agent ShareOFT V4 mesh reuses OVaultHubComposer + Solana provisioner with `vaultKind=agent` registry metadata.
