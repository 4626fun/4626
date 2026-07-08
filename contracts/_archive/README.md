# Archived contracts

Sources here are kept for audit history and optional manual redeploy experiments. They are **excluded from `forge build`** (`foundry.toml` `ignore`) and are **not** part of production deploy paths (`DeploymentBatcher`, bytecode store seeding, or keeper workflows).

| Path | Notes |
|------|-------|
| `strategies/launchpad/LBPStrategyWithTaxHook.sol` | Pre–CCA-launch-arm LBP experiment; superseded by `shared/shareoft-mesh/cca/CCALaunchArm.sol`. Deploy helper: `script/_archive/DeployLBPStrategyWithTaxHook.s.sol`. |
