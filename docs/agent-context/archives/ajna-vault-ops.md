# ajna-vault-ops — skill archive

Tier 2. Load when operating nested Ajna sleeves (buffer vs bucket LP, keeper rebalance, KPR bucket manager), or when planning a greenfield cutover that ships Ajna (`v1.20.0` and later).

Related parent skill: [`yield-strategy-management.md`](./yield-strategy-management.md) (weights / `deployToStrategies`).

External mental model only: [Ajna Skills SKILL.md](https://github.com/ajna-finance/ajna-skills/blob/main/SKILL.md) — do **not** `npx skills add` into Cursor (third-party import off). Production custody is protocol Safe / Keepr — never `AJNA_SIGNER_PRIVATE_KEY`.

---

## v1.20.0 launch expectations (read this first)

Grounded in the 2026-07-28 AKITA live sleeve on Base. Treat these as the default post-Phase-3 story for every new creator vault until proven otherwise.

### What “done” looks like vs what you will see first

| Stage | Expected on-chain / UI | Common false alarm |
|-------|------------------------|--------------------|
| Phase 3 + weights wired | Adapter added; `strategyDebt` rises after allocate | “Ajna failed” because Ajnafi/UI shows $0 LP |
| `deployToStrategies` / rebalance | CREATOR lands in **inner vault buffer** (`bufferAssets` ≈ sleeve NAV) | Assuming buffer == lent |
| First `moveFromBuffer` | `getBuckets()` non-empty; pool `lenderInfo(minBucket, inner).lp > 0` | Skipping Ajna UI before this step |
| Steady state | Buffer ≈ `totalAssets * bufferRatio / 10_000` (default 10% floor); excess in min bucket | Chasing dust leftovers of a few hundred tokens as a deploy bug |

**Rule:** empty Ajna pool LP right after a full stack deploy is **normal** until buffer→bucket lend runs. Do not redeploy Phase 3 for that symptom alone.

### Mental model (nested sleeve only)

```
CreatorOVault idle CREATOR
  → deployToStrategies / rebalanceStrategies
    → ERC4626StrategyAdapter.deposit
      → AjnaERC4626Vault.deposit → AjnaVaultBuffer
        → ERC4626StrategyAdapter.moveFromBuffer(minBucket, assets)  # onlyOwner (Safe)
          → inner.moveFromBuffer (onlyAdapterAuthorized: msg.sender == AUTH.swapper == adapter)
            → AJNA_POOL.addQuoteToken (quote = creator token, collateral = USDC)
```

- Weights / `addStrategy` do **not** transfer tokens.
- Charm and Ajna coordinate only through the **parent vault idle** buffer — not strategy-to-strategy.
- Charm’s optional Ajna **borrow backstop** is a separate path from the **`ajna_sleeve` lending** lane.
- Greenfield default weights: Charm **4500** + Ajna **4500** + idle **1000** (`vault_full_deploy`).
- Default `ajnaBufferRatioBps` / auth `bufferRatio`: **1000** (keep ~10% of sleeve NAV in buffer after lend).

### Auth / custody invariants (will bite you)

1. Inner `AjnaERC4626Vault.moveFromBuffer` = `onlyAdapterAuthorized` → caller must be `AUTH.swapper()` (the adapter).
2. Adapter `ERC4626StrategyAdapter.moveFromBuffer` = `onlyOwner` → protocol treasury / automation Safe.
3. Keeper **EOA** calling the inner vault always reverts. Keepr must execute **adapter** `moveFromBuffer` via Safe.
4. `moveToBuffer` allows swapper **or** keeper — do not confuse with lend.
5. After any emergency swapper handoff, **restore `setSwapper(adapter)`** before leaving the session.
6. Protocol **automation Safe must be an Ajna keeper** (in addition to Keepr EOA). Phase 3 helper now `setKeeper(protocolAutomation, true)` at deploy; day-0 script re-asserts it.

### Emergency exit readiness (bake this in)

| Layer | Expected | Failure mode if missing |
|-------|----------|-------------------------|
| HEAD `ERC4626StrategyAdapter` | `emergencyWithdraw()` calls `_drainBucketsToBufferBestEffort()` then pulls buffer | Bucket LP stuck; `maxWithdraw==0`; vault emergency returns ~0 |
| Adapter selectors | `drainBucketsToBuffer`, `moveToBuffer`, `moveFromBuffer` present in runtime bytecode | Must use legacy keeper `inner.moveToBuffer` then vault emergency |
| Auth keepers | `isKeeper(protocolAutomation)==true` **and** Keepr EOA keeper | Automation cannot drain buckets without a one-off `setKeeper` |
| Unwind ops | `ensure-ajna-emergency-readiness` runs before `emergencyWithdrawFromStrategies` | Same AKITA B2 surprise: Charm clears, Ajna debt stuck |

Ops:

```bash
# Day-0 / any vault — wire keeper only (dry-run default; live needs --execute)
pnpm -C frontend exec tsx --env-file=.env scripts/ops/ensure-ajna-emergency-readiness.ts \
  --vault 0x... --no-drain
pnpm -C frontend exec tsx --env-file=.env scripts/ops/ensure-ajna-emergency-readiness.ts \
  --vault 0x... --no-drain --execute --confirm=AJNA-EMERGENCY-READY

# Emergency — keeper + legacy bucket drain (no-op drain when adapter self-drains)
pnpm -C frontend exec tsx --env-file=.env scripts/ops/ensure-ajna-emergency-readiness.ts \
  --vault 0x... --execute --confirm=AJNA-EMERGENCY-READY
```

Unwind script (`execute-akita-b2-unwind-csw.ts`) calls this before strategies unless `--skip-ajna-buffer`. Unwind itself defaults to dry-run and requires `--execute --confirm=AKITA-B2-UNWIND`.

### Bytecode / seal gates before calling the cutover “v1.20.0”

Seal and verify these in the bytecode store / `DEPLOY_BYTECODE` — AKITA taught us live code can lag source:

| Gate | Why | How to verify |
|------|-----|----------------|
| Adapter exposes `moveFromBuffer` | Live AKITA adapter bytecode **lacked** selector `0xd6506540`; keeper/Safe path through adapter impossible | `cast sig "moveFromBuffer(uint256,uint256)"` then check adapter runtime bytecode contains that selector |
| Adapter exposes `drainBucketsToBuffer` / `moveToBuffer` | Without these, vault `emergencyWithdrawFromStrategies` cannot realize bucket LP in one shot | Selectors `0xc7cc300d` / `0x070b49ba` in adapter runtime bytecode |
| Inner vault dust refund uses `balanceOf(this)` | Ajna can pull full `assets` while returning slightly lower `movedAssets` (empty-bucket dust). Refunding `assets - movedAssets` → `ERC20InsufficientBalance` | Source: `AjnaERC4626Vault.moveFromBuffer` must refund `ASSET_TOKEN.balanceOf(address(this))`, not `assets - movedAssets`. Confirm sealed bytecode matches that logic |
| Auth admin / pendingAdmin path known | Hot automation Safe must be able to `acceptAdmin` + `setSwapper` / `setKeeper` if handoff is ever needed | Read `admin()`, `pendingAdmin()`, `swapper()`, `isKeeper(automation)` on `AjnaVaultAuth` |
| Phase 3 helper sets automation keeper | New sleeves must ship with `isKeeper(protocolAutomation)==true` without a manual follow-up | Source: `DeploymentBatcherPhase3Helper` Ajna branch; reseal Phase 3 helper after this change |
| `ajna_vaults` registry row | Keeper dry_run→live needs registry config (`bufferRatioBps`, `minBucketIndex`, caps) | Row present; `automation_status` starts `dry_run` then flips `live` after inspect PASS |

If the sealed adapter still lacks `moveFromBuffer`, plan an explicit **swapper-handoff** ops path (see below) — do not assume Keepr alone can lend.

### Post-deploy day-0 checklist (every new vault)

1. **Inspect sleeve** (read-only): vault, adapter, inner, auth, pool, `strategyDebt`, `bufferAssets`, `innerTotalAssets`, `getBuckets`, `lenderInfo(minBucket, inner)`, `swapper == adapter`, pause=false.
2. Expect: `strategyDebt > 0` and `bufferAssets ≈ innerTotalAssets` and `lentIntoBuckets == false` until lend.
3. **Emergency readiness:** run `ensure-ajna-emergency-readiness.ts --vault … --no-drain` (acceptAdmin if needed, assert automation is keeper, report adapter selector gates).
4. **Dry-run** Keepr `POST /api/keeper/ajna/rebalance` (or ops script dry-run). Confirm prepared `move_from_buffer` amount respects buffer floor.
5. **Execute** only after explicit operator approval: adapter path preferred; handoff path only if adapter selector missing.
6. **Verify:** `lentIntoBuckets == true`, buffer near target floor, pool LP > 0, `swapper` still adapter, Ajna UI can show LP.
7. Flip registry `dry_run` → `live` only after one clean verify.

### Live AKITA reference (Base, 2026-07-28)

| Layer | Address | Note |
|-------|---------|------|
| CreatorOVault | `0x4626539E5C01cc32C29755146D31755e3adA848A` | Parent vault |
| Ajna adapter | `0xa1A3A32C22b1A10Ea27D1688d48b90b1Ac6eD505` | Live bytecode lacked `moveFromBuffer` |
| Inner AjnaERC4626Vault | `0xD43659Df75762051996EB4781f223623b627AA3A` | Dust refund bug still on live code |
| AjnaVaultAuth | `0xe89c27e554EA96B0B01410EE49612B0D99fe6951` | minBucket **4156**; admin = automation Safe |
| Ajna pool | `0xe26Bc313FDa07Ce9Cc530314d9a6B74592C652Db` | quote=AKITA, collateral=USDC |
| Protocol automation Safe | `0x08f0875E40781578F902998b2b831cc48d838eBE` | `acceptAdmin` / `setSwapper` |
| Protocol treasury Safe | `0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3` | Temporary swapper + dust + lend |

**Outcome after ops:** bucket `4156` held ~`2.25e25` LP; buffer near 10% floor; swapper restored to adapter. Remainder lend (~322k AKITA) also succeeded via handoff script.

### Swapper-handoff path (legacy / missing adapter selector only)

Use when adapter cannot `moveFromBuffer`. Prefer fixing seal for v1.20.0 so this is emergency-only.

Order (sequential Safe txs — **not** one MultiSend; MultiSend hit `GS013` in practice):

1. Automation Safe: `acceptAdmin` if `pendingAdmin` is automation and `admin` is not yet.
2. Automation Safe: `setSwapper(treasurySafe)`.
3. Measure Ajna dust via `debug_traceCall` on `inner.moveFromBuffer` (pool pull vs returned `movedAssets`). Prefund inner with creator token dust from treasury if needed.
4. Treasury Safe: `inner.moveFromBuffer(minBucket, moveAssets)`.
5. Automation Safe: `setSwapper(adapter)` — **mandatory restore**.
6. Verify LP + swapper.

No checked-in handoff script yet — run the six Safe steps above manually (or via one-off operator tooling). Prefer sealing adapter `moveFromBuffer` so Keepr/automation can lend without swapper handoff.

### Dust bug (source fix must ship in sealed v1.20.0)

In `AjnaERC4626Vault.moveFromBuffer`, after `addQuoteToken`:

- **Broken (live AKITA bytecode):** `_bufferDeposit(assets - movedAssets)` when `assets > movedAssets`.
- **Fixed in source (must reseal for v1.20.0):** refund whatever token balance remains on the vault:

```solidity
uint256 remaining = ASSET_TOKEN.balanceOf(address(this));
if (remaining > 0) {
    _bufferDeposit(remaining);
}
```

Until that is sealed everywhere, keep the dust-prefund workaround for any vault on the old bytecode.

### What not to expect / not to do

- Do **not** treat third-party `ajna-skills` execute + local private key as production custody.
- Do **not** call raw `AJNA_POOL.addQuoteToken` from an agent key for sleeve NAV.
- Do **not** assume `deployToStrategies` alone makes Ajna UIs non-empty.
- Do **not** leave `AUTH.swapper` pointed at treasury after a handoff.
- Do **not** cut `v1.20.0` greenfield solely because AKITA looked “empty” on Ajna — that was buffer-not-lent, then fixed with ops + learnings above.

---

## Base protocol addresses (parity with Ajna FAQ)

Source: [Deployment addresses](https://faqs.ajna.finance/info/deployment-addresses-and-bridges)

| Contract | Address |
|----------|---------|
| ERC20 factory | `0x214f62B5836D83f3D6c4f71F174209097B1A779C` |
| ERC721 factory | `0xeefEC5d1Cc4bde97279d01D88eFf9e0fEe981769` |
| PoolInfoUtils | `0x97fa9b0909C238D170C1ab3B5c728A3a45BBEcBa` |
| PoolInfoUtilsMulticall | `0x249BCE105719Ae4183204371697c2743800C225d` (not in frontend defaults) |
| PositionManager | `0x59710a4149A27585f1841b5783ac704a08274e64` |

Repo integration: hand-rolled `IAjnaPool` + viem — **no** `@ajna-finance/sdk` in production lanes.

## Command map (ajna-skills → 4626)

| ajna-skills | 4626 |
|-------------|------|
| `inspect-pool/bucket/position` | `inspectAjnaSleeve` / `GET …/deploy/v2/ajna/automation/status` → `sleeveInspect` |
| `prepare-lend` | `buildMoveFromBufferPreparedAction` / keeper dry_run `preparedAction` |
| `prepare-borrow` | Charm backstop + `/v1/build/ajna/_borrow` (not sleeve default) |
| `prepare-create-erc20-pool` | Phase 3 `DeploymentBatcher` `_resolveAjnaPool` |
| `prepare-approve-*` | vault `forceApprove` at deploy |
| `execute-prepared` | Keepr / protocol Safe — **never** `AJNA_SIGNER_PRIVATE_KEY` |
| `setMinBucket` / rebucket | Keepr `strategy.ajna.rebucket` + KPR `ajna-bucket-manager` |

## Inspect → prepare → execute → verify

1. **Inspect** — require `strategyDebt`, `bufferAssets`, `innerTotalAssets`, `minBucketLp` / `poolLenderLpAtMinBucket`, `trackedBuckets`, `lentIntoBuckets`, auth (`minBucketIndex`, pause, swapper==adapter), registry `automation_status`.
2. **Prepare** — unsigned `AjnaPreparedAction` (`move_from_buffer` or `none`). Check `signatureStatus` / `signatureReason`.
3. **Review** — dry_run ≠ live; confirm adapter owner is protocol treasury or automation Safe; confirm adapter has `moveFromBuffer` or plan handoff.
4. **Execute** — `POST /api/keeper/ajna/rebalance` (live) or Safe `adapter.moveFromBuffer`. Target **strategy adapter**, not inner vault (unless handoff).
5. **Verify** — re-inspect: `lentIntoBuckets=true`, buffer near target floor, pool lender LP nonzero, swapper==adapter.

## Ops endpoints / env

- Rebalance: `POST /api/keeper/ajna/rebalance`
- Status (+ sleeveInspect): `GET /api/deploy/v2/ajna/automation/status`
- Control: `POST /api/deploy/v2/ajna/automation/control`
- Enqueue fanout: `KEEPER_AJNA_MANAGER_ENQUEUE_ENABLED=true`
- Registry: `public.ajna_vaults` (`dry_run` \| `live` \| `paused` \| `halted`)
- Runbook: `docs/_internal/operations/vault/ajna-vault-manager-p0-runbook.md`
- Backfill: `pnpm -C frontend exec tsx scripts/ops/backfill-keepr-vault.ts`
- Hot Safe acceptAdmin: `scripts/ops/wire-akita-hot-automation-safe.ts`
- Emergency readiness / legacy bucket→buffer: `scripts/ops/ensure-ajna-emergency-readiness.ts`
- AKITA B2 unwind (CSW): `scripts/ops/execute-akita-b2-unwind-csw.ts` (dry-run default; `--execute --confirm=AKITA-B2-UNWIND`)
- Buffer lend (handoff): manual Safe sequence in § Swapper-handoff (no checked-in script)

## Repo map

- Inner vault: `contracts/shared/strategies/ajna/AjnaERC4626Vault.sol`
- Auth / buffer: `AjnaVaultAuth.sol`, `AjnaVaultBuffer.sol`
- Adapter: `contracts/shared/strategies/ERC4626StrategyAdapter.sol`
- Interface: `contracts/shared/interfaces/external/IAjnaPool.sol`
- Inspect/prepare: `frontend/server/_lib/ajnaVaultManager/ajnaSleeveInspect.ts`, `ajnaPreparedAction.ts` (may live on `docs/oda-commission-prompt` until merged)
- Keeper: `frontend/api/_handlers/keeper/_ajnaRebalance.ts`
- KPR: `kpr/actions/ajna-bucket-manager.action.ts`, `kpr/kpr-workflows/ajna-bucket-manager/`

## Cast smoke (read-only)

```bash
ADAPTER=0xa1A3A32C22b1A10Ea27D1688d48b90b1Ac6eD505
INNER=$(cast call $ADAPTER "ERC4626_VAULT()(address)" --rpc-url $RPC_URL)
cast call $INNER "bufferAssets()(uint256)" --rpc-url $RPC_URL
cast call $INNER "getBuckets()(uint256[])" --rpc-url $RPC_URL
POOL=$(cast call $INNER "AJNA_POOL()(address)" --rpc-url $RPC_URL)
cast call $POOL "lenderInfo(uint256,address)(uint256,uint256)" 4156 $INNER --rpc-url $RPC_URL
cast sig "moveFromBuffer(uint256,uint256)"
# confirm selector appears in adapter runtime bytecode before relying on Keepr adapter path
```

## Output format

When using this skill, report: vault + adapter + inner + pool, `lentIntoBuckets`, buffer vs target, whether adapter has `moveFromBuffer`, preparedAction kind, execution lane (adapter Safe vs handoff), and verification casts/tx.
