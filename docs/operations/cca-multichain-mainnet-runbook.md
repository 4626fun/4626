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
| Robinhood (4663) | Bootstrap CCA factory v2.1.0 ourselves (`protocolFeeController = 0`) |

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
- **First broadcast stage:** `--broadcast --stage ensure-registry` runs
  `EnsureSpokeRegistry` (registry CREATE2 if missing + LZ/hub seed). OFT / oracle /
  arm CREATE2 still need salts/codeIds via Foundry (below) — not deploy-session.

## Deploy order (per expansion chain)

### 0. Preflight (all chains)

```bash
pnpm -C frontend ops:verify-cca-multichain
# Optional single chain:
pnpm -C frontend ops:verify-cca-multichain --chain robinhood
pnpm -C frontend ops:plan-akita-cca-spokes
```

Expect WARN (not FAIL) on Robinhood factory until step 1.

### 1. Robinhood only — bootstrap CCA factory v2.1.0

Deploy Uniswap ContinuousClearingAuctionFactory v2.1.0 at the CREATE2 vanity
`0x000000001F26a0044BaA66024e7b6599c61963F8` if salt/bytecode allow; otherwise
record the actual address and override via `setCcaFactoryV2` on the arm.

Constructor: `protocolFeeController = address(0)`.

Re-run preflight until Robinhood factory row is PASS.

### 2. Registry seed (Base hub)

```bash
# Includes Unichain 130 / EID 30320 after this branch
forge script script/SeedRegistry4626.s.sol:SeedRegistry4626 \
  --rpc-url $BASE_RPC_URL --broadcast
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

Ctor: `(shareOFT, address(0) /* ETH */, armPlaceholder, armPlaceholder, owner)` then
immediately `setRecipients(arm, arm)` so v2.x recipient-gated sweeps work.

```text
setCcaFactoryV2(CCA_FACTORY_V210)
setLaunchBlocksPerSecond(N)      # Arb=4, Robinhood=10; skip on ETH/Unichain
setLaunchBlockTimeSeconds(S)     # ETH=12, Unichain=1
setDefaultDuration(D)            # from ccaLaunchChains
setDefaultClaimDelay / setDefaultSweepDelayBlocks / setMigrationDelayBlocks
# Wire local oracle cache (script/ConfigureSpokeCcaOracle.s.sol):
setOracleConfig(spokeOracle, poolManager, taxHook, feeRecipient)
setMigrationConfig(positionManager, treasury, treasury, 1, sweepDelay)
# Do NOT setBackingVault to a Base vault address on a spoke chain.
```

Tax hooks remain per-chain TBD (Base-only until pinned). Foundry/AA on the spoke
RPC. Do not use Base `DeploymentBatcher` Phase 1 for spokes.

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

## Out of scope / follow-ups

- Per-chain tax hook addresses in CompleteAuction (Base-only until pinned).
- RPC same-origin proxy for Unichain/Robinhood (browser CORS).
- Bytecode-store reseed after CCA arm bytecode change (required before CREATE2 batcher deploys of the new arm).
- EVM-lane peer assessor parity with Solana `verify-share-mesh-lz` (template exists; dedicated verify TBD).
