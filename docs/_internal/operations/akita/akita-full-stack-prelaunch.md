# AKITA full-stack redeploy — pre-launch checklist

> **Release truth:** v1.19.1 batcher `0xa18169caf37fa0347285B16aAFC2B09eCB43F145`.

Use this before **you** launch AKITA’s new vault stack on `https://app.4626.fun/deploy/vault`. Platform ops can finish everything here; the deploy session itself stays with the creator/operator wallet.

Related:

- **[akita-launch-operator-pack.md](./akita-launch-operator-pack.md) — deterministic in-order operator run sheet (start here on launch day)**
- [greenfield-launch-readiness.md](../operations/vault/greenfield-launch-readiness.md)
- [batcher-pipe-a-cutover.md](../deployment/batcher-pipe-a-cutover.md)
- [solana-share-mesh-creator-provisioning.md](../operations/solana/solana-share-mesh-creator-provisioning.md)
- [akita-solana-share-mesh-audit.md](../solana/akita-solana-share-mesh-audit.md)

## Target redeploy state

| | Current snapshot | After redeploy |
|--|------------------------|----------------|
| Creator coin | `0x5b674196812451b7cec024fe9d22d2c0b172fa75` | **Same** |
| Vault / wrapper / ShareOFT | `0x82C06…` / `0x58Cd1…` / `0x4df30…` | **New CREATE2 addresses (`■AKITA`)** |
| Registry row | Absent in the historical snapshot | Creator registered and explicit Solana peer seeded before Phase 2 finalize |
| Solana mesh | Historical standard-SPL B1 identity | Provision a fresh Token-2022 hook mint and regular-OFT Store after Base Phase 1; never reuse B1 for B2 |
| Keeper DB | Points at current vault | **Re-backfill** after new addresses |

Wire LayerZero to the **new** `CreatorShareOFT` deployed in Phase 1 (`■AKITA` symbol).

## Smooth launch timeline

| When | You (deploy UI) | One command (automates the rest) |
|------|-----------------|----------------------------------|
| **Now** | — | `pnpm -C frontend ops:verify-akita-prelaunch --production --phase1-only` |
| **Phase 1 done** | Provision fresh B2 mint/PDAs/Store, wire LZ + registry, then copy all addresses | `ops:complete-akita-deploy post-phase1 … --share-mesh-mint … --oft-store … --solana-share-peer … --update-vultr` |
| **Before finalize** | Wait for Pipe A panel **ready**; run finalize in UI | (included in post-phase1 gate) |
| **After finalize** | — | `ops:complete-akita-deploy post-finalize … --update-vultr --backfill --write-defaults` |

**Still manual (cannot be skipped today):**

1. **LayerZero Base wire** on the new ShareOFT (once, in your LZ scaffold) — post-phase1 prints exact commands if blocked
2. **Explicit AKITA registry peer** — call
   `Registry4626.setRemoteOFTPeerBytes32(AKITA, 30168, peer)` before finalize;
   never use a batcher-global peer
3. **Wrapper `setBeneficiaryOperator`** (your CSW) + **`configureCreatorMesh`** (protocol Safe), when the optional composer lane is intentionally configured — post-finalize prints calldata

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
| Pipe A batcher | `verify-batcher-pipe-a-readiness.ts` exit **0** on `0xa18169caf37fa0347285B16aAFC2B09eCB43F145` |
| Release target | `bash test/current-release-target-guard.sh` |
| Hook bytecode | `ops:verify-hook-mainnet-bytecode` → **PASS (canonical)** |

## Vultr (Solana ops host) — should already be green

Public HTTPS probes (no SSH required):

| Check | Expect |
|-------|--------|
| Orchestrator | `https://orchestrator.4626.fun/healthz` → `{"ok":true}` |
| Orchestrator auth | `POST /reconcile` with `SOLANA_ORCHESTRATOR_API_KEY` → configured `settle_fees` / `price_monitor` action **200** |
| Removed actions | Former entry-relay and winner-relay labels are rejected as unsupported |
| Optional hook provisioner | `https://provisioner.4626.fun/healthz` + bearer → `ok: true`, `payerHealthy: true`; not the LZ OFT provisioning path |
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

- `KEEPER_SOLANA_RECONCILE_ACTIONS=settle_fees,price_monitor` on Vercel

**Legacy-only warning:** adapter-registration failures concern the retired Twin
creator-SPL grain and do not gate Pipe A. Do not repair them by adding adapter
operations to the v1.19.0 Safe packet. Re-run active preflight after redeploy
with the new ShareOFT (`■AKITA`) in `SOLANA_SHARE_OFT_MAPPING`.

## Vercel production env (Solana deploy lane)

| Variable | Expected |
|----------|----------|
| `DEPLOYMENT_BATCHER` / `VITE_DEPLOYMENT_BATCHER` | `0xa18169caf37fa0347285B16aAFC2B09eCB43F145` |
| Batcher onchain runtime | destination + OVault runtime enabled; no adapter/global peer |
| `SOLANA_ORCHESTRATOR_URL` | `https://orchestrator.4626.fun` (no path suffix) |
| `SOLANA_ORCHESTRATOR_API_KEY` | matches Vultr `/etc/4626/solana-keeper-orchestrator.env` |
| `KEEPER_SOLANA_RECONCILE_ENABLED` | `1` |
| `KEEPER_SOLANA_RECONCILE_ACTIONS` | `settle_fees,price_monitor` |

### Solana share mesh (fresh AKITA B2 identity required)

| Item | Value |
|------|--------|
| Retired B1 identity | mint `5puV…XHQv`, Store `G3rf…XeN`, peer `0xdf9a…cd3f` — forbidden for B2 |
| Fresh B2 mint | Created after Base Phase 1; Token-2022, canonical TransferHook, zero fee |
| Fresh OFT Store | Regular-OFT Store bound to that exact mint after hook PDA initialization |
| AKITA registry peer | Fresh OFT Store encoded as bytes32; seed explicitly for `(AKITA, 30168)` |
| ULN | 3-of-5 optional DVNs Base ↔ Solana, verified on the fresh Store and Base ShareOFT |

Use two Base deploy sessions: Phase 1 only creates the new vault/wrapper/ShareOFT;
then provision and wire the fresh B2 mint/Store; only then create the remaining
Phase 2+ session with explicit `solanaOvault.mode=b2` and `shareMeshMint`.

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
   - Use the already-registered creator and its explicit `Registry4626` peer
   - `setPeer(30168, …)` on new ShareOFT if needed
   - Bridge 30% ShareOFT to Solana (payable finalize — attach LZ fee)

   If AKITA is not yet present in the active registry, register the creator
   coin first, then seed `setRemoteOFTPeerBytes32`; do not wait for finalize to
   invent or inherit a peer.

3. **Composer mesh (Safe on protocol treasury)**  
   After vault/wrapper addresses known:
   ```bash
   pnpm -C frontend exec tsx scripts/ops/plan-akita-share-mesh-phase-a.ts \
     --asset-mesh <base-asset-mesh-if-any> \
     --share-mesh <new-share-oft> \
     --solana-asset-peer 0x... \
     --solana-share-peer <FRESH_OFT_STORE_BYTES32>
   ```
   Submit `configureCreatorMesh` on `OVaultHubComposer` (`0x7dF44cBB…`). New wrapper bytecode supports `setBeneficiaryOperator(composer, true)` — run from wrapper owner before composer call if preflight requires it.

## After deploy — ops follow-through

| Task | Action |
|------|--------|
| Config | Update `AKITA_DEFAULTS` in `frontend/src/config/contracts.defaults.ts` + Vercel env overrides |
| Keeper | `scripts/ops/backfill-keepr-vault.ts` with **new** vault/share addresses |
| `SOLANA_SHARE_OFT_MAPPING` | Map share mesh mint → **new** ShareOFT (not `0x4df30…`) |
| Orchestrator | `seed-solana-orchestrator-env.sh --hook-schema auto`; configure only actions supported by the current orchestrator |
| Meteora B1 | Optional after Path 1 supply on Solana — `kpr solana:create-dlmm-pool` on share mesh mint |
| Prior stack | Keep documented for explorer traceability; avoid removing onchain history |

## Explicitly not required before Base vault live

- B2 devnet hook deploy (`COST_PROBE_HOOK_PROGRAM_KEYPAIR`)
- Meteora pool + LP
- Any retired Twin adapter registration
- Any batcher-global `solanaShareOftPeer` operation

## Verification after you finish

```bash
pnpm -C frontend exec tsx scripts/ops/read-akita-ovault-mesh-onchain.ts
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts
# Base smoke: ShareOFT buy → lottery entry on NEW share token
```
