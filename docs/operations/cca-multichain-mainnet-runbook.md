# ■AKITA CCA multi-chain mainnet runbook

Read-only preflight first. Never paste private keys. Arms = ShareOFT mesh
(CCA, LP) — not yield strategies.

Canonical params: `frontend/src/config/ccaLaunchChains.ts`  
Preflight: `pnpm -C frontend ops:verify-cca-multichain` (exit 0 required)

## Scope

Coordinated ■AKITA CCA launch capability on:

| Chain | Status |
| ----- | ------ |
| Base | Live arm on CCA factory v1.1.0 |
| Ethereum / Arbitrum / Unichain | Uniswap CCA v2.1.0 already deployed |
| Robinhood (4663) | CCA factory v2.1.0 already live with `protocolFeeController = 0` (re-verify in preflight) |

## Hard gates (fail closed)

1. **Zero CCA protocol fee** on every chain — `migrate()` requires swept == `currencyRaised()`.
2. **Orbit block domain** — Arbitrum + Robinhood arms must use ArbSys-aware scheduling
   (`setLaunchBlocksPerSecond`: Arb=4, Robinhood=10) and CCA factory v2.1.0.
3. **Share-mesh LZ** before any share bridge / Pipe A:
   - Solana lane: `pnpm -C frontend ops:verify-share-mesh-lz` exit 0, confirmations `[15, 32]`, 3-of-5 DVNs.
   - EVM spokes: copy `docs/_internal/operations/templates/layerzero-evm-share-mesh.config.ts`
     → scaffold `layerzero.config.ts`, wire peers both directions, confirmations `[15, 15]`, 3-of-5 DVNs.
4. **No invented addresses** — pin `VITE_AKITA_*_<CHAIN>` only after deploy + verify.

## Operator entry (1-click-from-Base intent)

- **Admin UI:** `/admin` → ■AKITA CCA spokes card (pin status + copyable ops plan).
- **Plan:** `pnpm -C frontend ops:plan-akita-cca-spokes`
- **Preflight + checklist:** `pnpm -C frontend ops:deploy-akita-cca-spokes` (dry-run default).
- **Copy-paste forge recipe:** `pnpm -C frontend ops:deploy-akita-cca-spokes --print-commands`
- **Broadcast stages:** `--broadcast --stage ensure-registry` then
  `--stage bytecode-infra` (`EnsureSpokeBytecodeInfra` at spoke epoch `cca-spoke-v1` (`0x75FA…` / `0x7E38…`)). OFT / oracle / arm CREATE2 salts are filled by
  `--print-commands` from `akitaCcaSpokeCreate2.ts` — not deploy-session.

## Deploy order (per expansion chain)

### 0. Preflight (all chains)

```bash
pnpm -C frontend ops:verify-cca-multichain
# Optional single chain:
pnpm -C frontend ops:verify-cca-multichain --chain robinhood
pnpm -C frontend ops:plan-akita-cca-spokes
```

Expect WARN (not FAIL) on Robinhood factory until step 1.

### 1. Robinhood CCA factory

As of 2026-07-29 the v2.1.0 factory is already live at
`0x000000001F26a0044BaA66024e7b6599c61963F8` with `protocolFeeController = 0`.
If preflight ever shows empty code, re-bootstrap with feeController=0 (or
override via `setCcaFactoryV2` on the arm).

### 2. Registry seed (Base hub) — required before Unichain oracle/OFT

Live Base registry previously pointed Unichain (130) at the **canonical** LZ
address `0x1a44…` which has **no code on Unichain**. Re-seed so Unichain uses
`0x6F475642a6e85809B1c36Fa62763669b1b48DD5B` and EID `30320`:

```bash
# Focused fix (preferred):
forge script script/SeedBaseUnichainLzEndpoint.s.sol:SeedBaseUnichainLzEndpoint \
  --rpc-url $BASE_RPC_URL --broadcast
# Or full SeedRegistry4626 if you are re-seeding everything.
# Verify:
# cast call $REGISTRY "getLayerZeroEndpoint(uint256)(address)" 130 --rpc-url $BASE_RPC_URL
# expect 0x6F475642a6e85809B1c36Fa62763669b1b48DD5B
```

### 3. Spoke registry + LZ endpoints

Spoke `CreatorOracle` ctor reads `Registry4626.getLayerZeroEndpoint(chainId)` and
`hubChainEid()`. Prefer the combined helper:

```bash
EXPECTED_CHAIN_ID=<id> forge script script/EnsureSpokeRegistry.s.sol:EnsureSpokeRegistry \
  --rpc-url $<CHAIN>_RPC_URL --broadcast
# or:
pnpm -C frontend ops:deploy-akita-cca-spokes --broadcast --stage ensure-registry --chain <key>
```

`EnsureSpokeRegistry` CREATE2-deploys if empty (default vanity `0x7776…4626`) then
seeds hub EID + LZ endpoints (Unichain uses non-canonical
`0x6F475642a6e85809B1c36Fa62763669b1b48DD5B`). Override `SALT`/`OWNER`/`EXPECTED_ADDRESS`
only when targeting Base registry address parity (`0xF60a…`).

### 4. Remote ShareOFT + peers

Per chain: deploy remote `CreatorShareOFT` (see `script/DeployRemoteShareOft.s.sol`),
then wire Base ↔ spoke peers both ways (EVM: `setPeer` / registry
`setRemoteOFTPeer`; Solana: existing Pipe A path).

Template: `docs/_internal/operations/templates/layerzero-evm-share-mesh.config.ts`.

**Spoke scope (not full vault stack):** remote ShareOFT + thin CreatorOracle +
CCALaunchArm. Vault / wrapper / gauge / Zora creator coin stay on Base.

### 5. Thin spoke CreatorOracle + Base broadcast

Do **not** sync lzRead inside `launchAuction`. Hub pushes price; spoke caches it.

Feeds: `ccaLaunchChains.ts` → `chainlinkEthUsd` / `sequencerUptimeFeed`.

```bash
# Spoke: CREATE2 deploy (QuoteLib must exist; registry LZ endpoint seeded)
EXPECTED_CHAIN_ID=<id> \
SET_CHAINLINK_ETH_USD=<from ccaLaunchChains> \
SET_SEQUENCER_UPTIME_FEED=<from ccaLaunchChains or unset> \
HUB_ORACLE=<Base AKITA oracle> \
forge script script/DeployRemoteCreatorOracle.s.sol:DeployRemoteCreatorOracle \
  --rpc-url $<CHAIN>_RPC_URL --broadcast

# Peers both ways
WIRE_SIDE=hub SPOKE_EID=<eid> HUB_ORACLE=… SPOKE_ORACLE=… \
  forge script script/WireCreatorOracleHubSpokePeers.s.sol --rpc-url $BASE_RPC_URL --broadcast
WIRE_SIDE=spoke HUB_ORACLE=… SPOKE_ORACLE=… \
  forge script script/WireCreatorOracleHubSpokePeers.s.sol --rpc-url $<CHAIN>_RPC_URL --broadcast

# After hub assetPriceUSD is live, push to spokes (keeper / operator)
DST_EIDS=30101,30110,30320,30416 HUB_ORACLE=… \
  forge script script/BroadcastCreatorOracleAssetPrice.s.sol \
  --rpc-url $BASE_RPC_URL --broadcast
```

CREATE2 address parity with Base oracle is optional (`ENFORCE_ADDRESS_PARITY=1` +
identical salt/codeId/ctor args; prefer `CHAINLINK_ETH_USD_CTOR=address(0)` then
`SET_CHAINLINK_ETH_USD` local). No `VITE_AKITA_ORACLE_*` pin required.

### 6. Deploy CCALaunchArm on the spoke

Use the combined helper (ctor + v2 factory + schedule + oracle + migration):

```bash
# Env values from `pnpm -C frontend ops:deploy-akita-cca-spokes --print-commands`
forge script script/DeploySpokeCcaLaunchArm.s.sol:DeploySpokeCcaLaunchArm \
  --rpc-url $<CHAIN>_RPC_URL --broadcast
```

Do **not** `setBackingVault` to a Base vault on a spoke. Spoke `TAX_HOOK=0` is
intentional: `CCALaunchArm.migrate` allows no-hook V4 pools (Base sell-tax hook
stays hub-only at `0xca975…`).

Optional spoke sell-tax (same Sourcify source, per-chain PoolManager/WETH):

```bash
# Pins: frontend/src/config/akitaCcaSpokeTaxHook.ts
# Mine: forge test --match-contract MineSpokeSellTaxHookSalts -vv
EXPECTED_CHAIN_ID=<id> POOL_MANAGER=<pm> WRAPPED_NATIVE=<weth> \
  forge script script/DeploySpokeSellTaxHook.s.sol:DeploySpokeSellTaxHook \
  --rpc-url $<CHAIN>_RPC_URL --broadcast
# Then pass TAX_HOOK=<predicted> into DeploySpokeCcaLaunchArm / ConfigureSpokeCcaOracle
```

### 7. Pin frontend env (spoke-minimal)

After verify, only:

```text
VITE_AKITA_SHARE_OFT_<CHAIN>=…
VITE_AKITA_CCA_STRATEGY_<CHAIN>=…
```

Suffixes: `ETHEREUM` | `ARBITRUM` | `UNICHAIN` | `ROBINHOOD`.
Do **not** require `VITE_AKITA_VAULT_*` / `WRAPPER_*` / `GAUGE_*` / `TOKEN_*` /
`ORACLE_*` on spokes — oracle is onchain-wired + Base broadcast.

Redeploy Vercel (`main` only — no PR previews).

### 8. Launch auction

Thursday-epoch schedule is strategy-enforced. Fast-chain step curves are automatic
(Arbitrum quarter-ramp; Robinhood uniform body). Do not pass custom steps from callers.

## Validation checklist

| Check | Command | Expect |
| ----- | ------- | ------ |
| CCA unit tests | `forge test --match-path 'test/CCALaunchArm.*'` | exit 0 |
| Deploy guards | `pnpm -C frontend validate:deploy-guards` | exit 0 |
| Chain config tests | `pnpm -C frontend exec vitest run src/config/ccaLaunchChains.test.ts src/lib/deploy/shareMeshLzPathwayPolicy.test.ts` | exit 0 |
| Multichain preflight | `pnpm -C frontend ops:verify-cca-multichain` | exit 0 |
| Solana mesh (if Pipe A) | `pnpm -C frontend ops:verify-share-mesh-lz --share-oft … --oft-store …` | exit 0 |

## Known gaps (do not treat as ready for Thursday launch)

- **Base registry Unichain LZ** must still be re-seeded on-chain
  (`SeedBaseUnichainLzEndpoint`) — code is ready; broadcast needs registry owner key.
- **Hub ShareOFT + hub oracle peers** for 30101/30110/30320/30416 are still zero
  until each spoke deploys — use `WireShareOftHubSpokePeers` /
  `WireCreatorOracleHubSpokePeers` from `--print-commands` after addresses exist.
- **Hub ShareOFT address parity unavailable** — AKITA phase-1 ShareOFT codeId
  `0x8c9de580…` was purged from the store; spokes use current codeId +
  `ENFORCE_ADDRESS_PARITY=0`, then peer-wire.
- Do **not** use `DeployUniversalBytecodeInfra` on spokes (wrong CREATE2 salts).
  Use `EnsureSpokeBytecodeInfra` / `--stage bytecode-infra` (epoch `cca-spoke-v1`).
  Base `0x8599`/`0xdffB` infra cannot be reproduced with current bytecode.
- CompleteAuction tax-hook UI remains Base-oriented (spokes have no sell-tax hook).
- RPC same-origin proxy for Unichain/Robinhood (browser CORS).
- Bytecode-store reseed after CCA arm bytecode change (required before CREATE2 batcher deploys of the new arm).
- EVM-lane peer assessor parity with Solana `verify-share-mesh-lz` (template exists; dedicated verify TBD).
