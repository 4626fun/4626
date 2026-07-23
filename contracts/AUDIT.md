# Audit scope map — 2026-07-23 (slim, remediated)

Pin auditors to:

- **Repo:** https://github.com/4626fun/4626
- **Tag / branch:** `audit/oda-2026-07-23-remediated`
- **Path root:** `contracts/`

Do **not** fall back to `github.com/wenakita/CreatorVault`.

Prior pin (immutable historical scope): [`audit/oda-2026-07-22` @ `423e0e3`](https://github.com/4626fun/4626/tree/audit/oda-2026-07-22/contracts).

One tight system per $1 engagement. Files present in this slice:

## 1 — Lottery stack

- `shared/lottery/manager/LotteryManager4626.sol`
- `shared/lottery/manager/LotteryManager4626PricingLib.sol`
- `shared/lottery/manager/VRFConsumer4626.sol`
- `shared/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol`
- `shared/lottery/zk/LotteryAmoeRouter.sol`
- `shared/lottery/zk/AmoePlonkVerifier.sol`
- `shared/lottery/zk/IAmoePlonkVerifier.sol`

Live Base: LM `0xB45E68a5867935a5734E4185977F81c528006650`, VRF `0x98fb5e0af3120B32E2E03400B6E51d0bde433670`, AMOE `0x630c3769Cf1D80c6cb8cCB7c011f5A76904C4C1e`.

## 2 — CreatorOVault + core module

- `creator/vault/CreatorOVault.sol`
- `creator/vault/modules/CreatorOVaultCoreModule.sol`
- `shared/vault/modules/OVaultModuleStorage.sol`
- `shared/vault/modules/OVaultModuleBase.sol`
- `shared/vault/modules/OVaultModuleConstants.sol`

Live Base: CreatorOVaultCoreModule `0x5A9F287910050c89cc3447f6Ac54990C2514466a`.

## 3 — CreatorShareOFT + wrapper

- `creator/vault/CreatorShareOFT.sol`
- `creator/vault/CreatorOVaultWrapper.sol`

## 4 — DeploymentBatcher (+ Phase1/2/3 modules in-file)

- `shared/deploy/batchers/DeploymentBatcher.sol`

Live Base: Batcher `0xa18169caf37fa0347285B16aAFC2B09eCB43F145`, Phase2Module `0x1217bA070DBf64303117939301788925030295d1`.

## 5 — Registry4626

- `shared/core/Registry4626.sol`

Live Base: `0x1365e9CEfc516f8A287c51FBaeF96FB4581c6CA2`.

## 6 — Charm + Ajna strategies

- `shared/strategies/ERC4626StrategyAdapter.sol`
- `shared/strategies/univ3/CharmStrategy4626.sol`
- `shared/strategies/ajna/AjnaERC4626Vault.sol`
- `shared/strategies/ajna/AjnaVaultAuth.sol`
- `shared/strategies/ajna/AjnaVaultBuffer.sol`
- `shared/strategies/ajna/AjnaVaultLibrary.sol`

## 7 — CreatorGaugeController

- `creator/revenue/CreatorGaugeController.sol`

## 8 — ve4626 + bribes

- `shared/governance/ve4626.sol`
- `shared/governance/ve4626GaugeVoting.sol`
- `shared/governance/ve4626BoostManager.sol`
- `shared/governance/ve4626Utility.sol`
- `shared/governance/bribes/BribeDepot4626.sol`

## Notes

- External deps (OZ, LZ, Uniswap, …) are not vendored here; review first-party logic in the listed files.
- Interfaces and non-scoped packages (agent lane, shareoft-mesh, aux batchers, recovery, etc.) are intentionally omitted from this public slice.
- Remediation delta vs `423e0e3`: see [REMEDIATIONS.md](./REMEDIATIONS.md).
