# AKITA full-stack redeploy — pre-launch checklist

Use this before **you** launch AKITA’s new vault stack on `https://app.4626.fun/deploy/vault`. Platform ops can finish everything here; the deploy session itself stays with the creator/operator wallet.

Related:

- [greenfield-launch-readiness.md](./greenfield-launch-readiness.md)
- [batcher-pipe-a-cutover.md](./deployment/batcher-pipe-a-cutover.md)
- [solana-share-mesh-creator-provisioning.md](./solana-share-mesh-creator-provisioning.md)
- [akita-solana-share-mesh-audit.md](./akita-solana-share-mesh-audit.md)

## Target redeploy state

| | Current snapshot | After redeploy |
|--|------------------------|----------------|
| Creator coin | `0x5b674196812451b7cec024fe9d22d2c0b172fa75` | **Same** |
| Vault / wrapper / ShareOFT | `0x82C06…` / `0x58Cd1…` / `0x4df30…` | **New CREATE2 addresses (`■AKITA`)** |
| Registry row | Absent until finalize | Registered during Phase 2 finalize |
| Solana mesh | Platform oftStore already live | Reuse batcher default peer (below) |
| Keeper DB | Points at current vault | **Re-backfill** after new addresses |

Wire LayerZero to the **new** `CreatorShareOFT` deployed in Phase 1 (`■AKITA` symbol).

## Smooth launch timeline

| When | You (deploy UI) | One command (automates the rest) |
|------|-----------------|----------------------------------|
| **Now** | — | `pnpm -C frontend ops:complete-akita-deploy prelaunch` |
| **Phase 1 done** | Copy vault / wrapper / ShareOFT (+ gauge/cca/oracle if shown) | `ops:complete-akita-deploy post-phase1 … --update-vultr` |
| **Before finalize** | Wait for Pipe A panel **ready**; run finalize in UI | (included in post-phase1 gate) |
| **After finalize** | — | `ops:complete-akita-deploy post-finalize … --update-vultr --backfill --write-defaults` |

**Still manual (cannot be skipped today):**

1. **LayerZero Base wire** on the new ShareOFT (once, in your LZ scaffold) — post-phase1 prints exact commands if blocked  
2. **Wrapper `setBeneficiaryOperator`** (your CSW) + **`configureCreatorMesh`** (protocol Safe) — post-finalize prints calldata  

Keeper registry backfill also runs automatically on vault settlement (`KEEPER_REGISTRY_AUTO_BOOTSTRAP_ENABLED=1` default).

## One-command gate

```bash
pnpm -C frontend ops:verify-akita-prelaunch --production
```

Optional Vultr systemd probe (requires SSH key to `VULTR_USERNAME@VULTR_IP_ADDRESS` in `frontend/.env`):

```bash
pnpm -C frontend ops:verify-akita-prelaunch --production --ssh-vultr
```

Exit `0` = platform + Vultr + Vercel chain + DB entitlements ready for you to open Deploy. Exit `1` = fix ✗ blockers.

Grant deploy entitlement (operator comp, optional):

```bash
pnpm -C frontend exec tsx scripts/ops/verify-akita-prelaunch-readiness.ts \
  --grant-comp --execute --confirm=GRANT-STRATEGY-COMP
```

That inserts `vault_full_deploy` (bundles Charm + Ajna + Solana mesh + Meteora entitlement).

## Platform — should already be green

| Check | Expect |
|-------|--------|
| Pipe A batcher | `verify-batcher-pipe-a-readiness.ts` exit **0** on `0xa99058…` |
| Production `solanaInfraStatus` | `readyForAutoRegistration: true`, `blockers: []` |
| Release target | `bash test/current-release-target-guard.sh` |
| Hook bytecode | `ops:verify-hook-mainnet-bytecode` → **PASS (canonical)** |

## Vultr (Solana ops host) — should already be green

Public HTTPS probes (no SSH required):

| Check | Expect |
|-------|--------|
| Orchestrator | `https://orchestrator.4626.fun/healthz` → `{"ok":true}` |
| Orchestrator auth | `POST /reconcile` with `SOLANA_ORCHESTRATOR_API_KEY` → `settle_fees` + `winner_relay` **200** |
| `relay_entries` paused | `POST /reconcile` action `relay_entries` → **503** `action_disabled:relay_entries` (correct until B2 pool) |
| Provisioner | `https://provisioner.4626.fun/healthz` + bearer → `ok: true`, `payerHealthy: true` |
| Provisioner DNS | Response `Server: nginx` — **not** Vercel SPA HTML |

Vercel → Vultr chain:

| Check | Expect |
|-------|--------|
| `POST /api/keeper/solana/reconcile` | With `KPR_API_KEY` → `status: completed`, `executed: true` |

On-host (optional SSH):

```bash
systemctl is-active solana-keeper-orchestrator   # active
curl -fsS http://127.0.0.1:8789/healthz          # ok:true
test -f /etc/4626/solana-keeper-orchestrator.env
```

Regenerate orchestrator env after hook upgrade:

```bash
sudo bash kpr/deploy/seed-solana-orchestrator-env.sh \
  --source /opt/4626/kpr/.env \
  --dest /etc/4626/solana-keeper-orchestrator.env \
  --hook-schema auto
sudo systemctl restart solana-keeper-orchestrator
```

Pre-deploy Vultr defaults (keep as-is):

- `SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0`
- `KEEPER_SOLANA_RECONCILE_ACTIONS=settle_fees,winner_relay` on Vercel (no `relay_entries` yet)

**Expected deferral (not a launch blocker):** `pnpm -C kpr preflight-orchestrator` can fail on adapter registration while `SOLANA_SHARE_OFT_MAPPING` still points at the current ShareOFT. Pipe A share mesh does not use `SolanaBridgeAdapter` for the 30% finalize bridge. Re-run preflight **after** redeploy with new ShareOFT (`■AKITA`) in `SOLANA_SHARE_OFT_MAPPING`.

## Vercel production env (Solana deploy lane)

| Variable | Expected |
|----------|----------|
| `SOLANA_DYNAMIC_ROUTE_ENABLED` | `1` |
| `SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL` | `https://provisioner.4626.fun/provision` |
| `SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET` | matches Vultr provisioner bearer |
| `SOLANA_ORCHESTRATOR_URL` | `https://orchestrator.4626.fun` (no path suffix) |
| `SOLANA_ORCHESTRATOR_API_KEY` | matches Vultr `/etc/4626/solana-keeper-orchestrator.env` |
| `KEEPER_SOLANA_RECONCILE_ENABLED` | `1` |
| `KEEPER_SOLANA_RECONCILE_ACTIONS` | `settle_fees,winner_relay` |

### Solana share mesh (AKITA #1 — reuse on redeploy)

| Item | Value |
|------|--------|
| Solana LZ OFT program | `6ste36Y7fcbzJXkVQj3ApEqYb3wFZsZX63gT6wymhy3s` |
| OFT store | `G3rfXFKvARH8emUVkiu6RrdSkXZQFGfsqKbF9P7EqXeN` |
| Share mesh mint | `5puVV8bQZp4YoEfGq4RitQFRVC3SJiHBSydFuFZUXHQv` (`■AKITA`) |
| Batcher `solanaShareOftPeer` | `0xdf9a9ef76562adbfe0231e2c5cee77f24a1f9eac519d3fbb029fe5b454d9cd3f` |
| ULN | 6-of-9 optional DVNs Base ↔ Solana (configured on Solana oftStore) |

No new Solana OFT deploy is required for AKITA redeploy if you keep this mesh identity.

## Before you click Deploy (your side)

1. **Wallet** — execution-ready on canonical track (parent CSW + Privy embedded owner).
2. **Balance** — ≥ **50,000,000** AKITA creator tokens for vault deposit (+ gas for phases).
3. **Entitlement** — **`vault_full_deploy`** active/pending (recommended: single $499 bundle).
   Legacy operator comps with separate `charm_active_lp` + `ajna_sleeve` +
   `solana_ovault_mesh` rows still satisfy deploy (AKITA path).
4. **Deploy UI** — `https://app.4626.fun/deploy/vault` with creator `0x5b6741…`.
5. **Fresh salts** — new `deploymentVersion` so CREATE2 addresses differ from current stack.
6. **Optional** — `pnpm -C frontend run dev:deploy-dry-run` on a fork first.

Enable **Solana OVault mesh** in the deploy session when you want Pipe A 30% ShareOFT auto-bridge at finalize.

## After Phase 1 — operator (before finalize)

When Phase 1 completes, record the **new ShareOFT address** from session events / UI.

1. **LayerZero Base wire (required for `send()` at finalize)**  
   In `/tmp/4626-oft-mainnet` (or fresh scaffold), point `layerzero.config.ts` at the **new ShareOFT** deployment name/address, then:
   ```bash
   pnpm hardhat lz:oft:solana:init-config --oapp-config layerzero.config.ts
   pnpm hardhat lz:oapp:wire --oapp-config layerzero.config.ts
   ```
   Solana oftStore is already configured; this step configures the **Base** OApp for the new ShareOFT.

2. **Phase 2 finalize** — batcher will:
   - Register creator in `CreatorRegistry`
   - Seed registry peer from batcher default if unset
   - `setPeer(30168, …)` on new ShareOFT if needed
   - Bridge 30% ShareOFT to Solana (payable finalize — attach LZ fee)

3. **Composer mesh (Safe on protocol treasury)**  
   After vault/wrapper addresses known:
   ```bash
   pnpm -C frontend exec tsx scripts/ops/plan-akita-share-mesh-phase-a.ts \
     --asset-mesh <base-asset-mesh-if-any> \
     --share-mesh <new-share-oft> \
     --solana-asset-peer 0x... \
     --solana-share-peer 0xdf9a9ef7...
   ```
   Submit `configureCreatorMesh` on `OVaultHubComposer` (`0x7dF44cBB…`). New wrapper bytecode supports `setBeneficiaryOperator(composer, true)` — run from wrapper owner before composer call if preflight requires it.

## After deploy — ops follow-through

| Task | Action |
|------|--------|
| Config | Update `AKITA_DEFAULTS` in `frontend/src/config/contracts.defaults.ts` + Vercel env overrides |
| Keeper | `scripts/ops/backfill-keepr-vault.ts` with **new** vault/share addresses |
| `SOLANA_SHARE_OFT_MAPPING` | Map share mesh mint → **new** ShareOFT (not `0x4df30…`) |
| Orchestrator | `seed-solana-orchestrator-env.sh --hook-schema auto`; keep `RELAY_ENTRIES_ENABLED=0` until B2 pool |
| Meteora B1 | Optional after Path 1 supply on Solana — `kpr solana:create-dlmm-pool` on share mesh mint |
| Prior stack | Keep documented for explorer traceability; avoid removing onchain history |

## Explicitly not required before Base vault live

- B2 devnet hook deploy (`COST_PROBE_HOOK_PROGRAM_KEYPAIR`)
- `relay_entries` enabled
- Meteora pool + LP
- Legacy `SolanaBridgeAdapter` registration of ShareOFT (mesh lane ≠ adapter grain)

## Verification after you finish

```bash
pnpm -C frontend exec tsx scripts/ops/read-akita-ovault-mesh-onchain.ts
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts
# Base smoke: ShareOFT buy → lottery entry on NEW share token
```
