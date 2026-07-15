# AKITA launch operator pack (deterministic run order)

> One-page, in-order operator sheet for the AKITA vault redeploy. Every command here
> delegates to an existing ops script — no new product code. Source of truth:
> [akita-full-stack-prelaunch.md](./akita-full-stack-prelaunch.md) and
> `frontend/scripts/ops/complete-akita-deploy-ops.ts`.
>
> Release truth: v1.19.1 batcher `0xa18169caf37fa0347285B16aAFC2B09eCB43F145`.
> Share mesh mint (reused): `5puVV8bQZp4YoEfGq4RitQFRVC3SJiHBSydFuFZUXHQv` (`■AKITA`).
> Batcher default Solana share peer: `0xdf9a9ef76562adbfe0231e2c5cee77f24a1f9eac519d3fbb029fe5b454d9cd3f`.
> Hub composer: `0x7dF44cBB93a5191837a988f0Cc441E3811C39CD1`.

Rules for the operator:

- Run phases strictly in order. Do not start Phase 1 with any PRE gate red.
- One wrapper command per milestone (`prelaunch` / `post-phase1` / `post-finalize`).
  The wrapper saves pasted addresses to `frontend/scripts/ops/.akita-redeploy-state/<phase>.json`
  so later phases and postmortems can recover them — always paste addresses through the
  wrapper, not ad hoc.
- `--production` is mandatory on the prelaunch verify (without it the Vercel→Vultr
  checks probe `localhost:5174` and fail with false `fetch failed: null` blockers).

---

## PRE — before you click Deploy

### PRE-1. Is prelaunch green?

```bash
pnpm -C frontend ops:complete-akita-deploy prelaunch
# (equivalent to: pnpm -C frontend ops:verify-akita-prelaunch --production)
```

Required result: exit `0`, `ALL GATES PASS — platform, Vultr, Vercel chain, and entitlements ready.`
If any gate fails, stop and fix per the blocker table in
[akita-full-stack-prelaunch.md](./akita-full-stack-prelaunch.md). Known env quirk: if
`hook_mainnet_canonical` fails with "No default signer found", run
`solana config set --keypair ~/.config/solana/id.json` and re-run.

### PRE-2. Is the execution wallet correct?

- Deploy session runs from the **creator/operator wallet** on the canonical track:
  parent CSW (`profiles.csw_address`) + Privy embedded EOA confirmed as CSW owner
  (`executionMode === 'canonical'`, execution-ready per AGENTS.md account invariants).
- Wallet also needs gas headroom for both phases (finalize is payable — it attaches the
  LayerZero bridge fee).

### PRE-3. Is ≥50M AKITA balance/approval ready?

Creator coin: `0x5b674196812451b7cec024fe9d22d2c0b172fa75`. Need ≥ 50,000,000 tokens
held by the deploying CSW and approved for the vault deposit (spender = v1.19.1 batcher).
`BASE_RPC_URL` comes from `frontend/.env` (export it or inline it).

```bash
# balance (18 decimals — expect >= 50000000e18)
cast call 0x5b674196812451b7cec024fe9d22d2c0b172fa75 \
  'balanceOf(address)(uint256)' <YOUR_CSW> --rpc-url $BASE_RPC_URL

# allowance to the batcher
cast call 0x5b674196812451b7cec024fe9d22d2c0b172fa75 \
  'allowance(address,address)(uint256)' <YOUR_CSW> \
  0xa18169caf37fa0347285B16aAFC2B09eCB43F145 --rpc-url $BASE_RPC_URL
```

Semantics: the **balance** check is a hard gate. The **allowance** check is advisory —
the deploy UI can batch the approval inside the deploy session (CSW atomic batching), so
a zero allowance here is not by itself a blocker; it just means the approval must happen
in-session. If you pre-approve manually, do it from the CSW to the batcher above.

### PRE-4. Is `vault_full_deploy` entitlement active?

Covered by the `strategy_entitlement` gate in PRE-1. If missing, grant the operator comp:

```bash
pnpm -C frontend exec tsx scripts/ops/verify-akita-prelaunch-readiness.ts \
  --grant-comp --execute --confirm=GRANT-STRATEGY-COMP
```

Then re-run PRE-1 and confirm `strategy_entitlement` + `strategy_solana_mesh` pass.

### PRE-5. Is deploymentVersion fresh?

In the deploy session, use a **NEW `deploymentVersion` salt** so CREATE2 addresses differ
from the current stack (`vault 0x82C06…`, `wrapper 0x58Cd1…`, `shareOFT 0x4df30…`).
If the deploy UI previews any of those three current addresses, the salt is stale — bump it.

### PRE-6. Start deploy

- URL: `https://app.4626.fun/deploy/vault`
- Creator coin: `0x5b674196812451b7cec024fe9d22d2c0b172fa75`
- Enable **Solana OVault mesh** in the session (Pipe A 30% ShareOFT auto-bridge at finalize).
- Optional rehearsal first: `pnpm -C frontend run dev:deploy-dry-run` (local Anvil fork).

---

## PHASE 1 DONE — before finalize

### P1-1. Record the new addresses (paste-point)

Copy from the deploy UI / session events: **vault, wrapper, ShareOFT** (required) and
**gauge, CCA, oracle** (if shown). Paste them into the wrapper — this is the canonical
recording step (it writes `.akita-redeploy-state/post-phase1.json`):

```bash
pnpm -C frontend ops:complete-akita-deploy post-phase1 \
  --share-oft 0xNEW_SHARE_OFT --vault 0xNEW_VAULT --wrapper 0xNEW_WRAPPER \
  --gauge 0xNEW_GAUGE --cca 0xNEW_CCA --oracle 0xNEW_ORACLE \
  --update-vultr
```

This runs `verify-post-phase1-mesh-readiness` and (with `--update-vultr`) pushes the
share-mesh mint → new ShareOFT mapping to the orchestrator early. `--update-vultr` needs
`VULTR_USERNAME` + `VULTR_IP_ADDRESS` (or `VULTR_SSH`) in `frontend/.env` — if SSH fails
it prints the manual env lines instead.

**Gauge/CCA/oracle pitfall:** if you omit `--gauge/--cca/--oracle`, the wrapper silently
falls back to the OLD `AKITA_DEFAULTS` addresses — the state JSON will then record the
previous stack's gauge/cca/oracle as if they were new, and a later `--write-defaults`
will no-op on them. If the deploy UI doesn't show these three, pull them from the Phase 1
transaction logs on Basescan (batcher `0xa18169ca…F145` internal deployments) or the
deploy-session events **before** running post-finalize. Do not proceed with defaults-inherited
values.

### P1-2. LayerZero Base wire (manual, once per new ShareOFT)

If P1-1 exits non-zero it prints this block; run it in your LZ scaffold
(e.g. `/tmp/4626-oft-mainnet`), pointed at the **new** ShareOFT.
**Scaffold recovery:** `/tmp` does not survive reboots. If the scaffold is missing,
recreate it from the LayerZero OFT Solana example (`npx create-lz-oapp@latest` → oft-solana
template, or clone the scaffold repo you used originally), restore `layerzero.config.ts`
and the Base deployment artifacts, and set signer env before wiring. Budget time for this
BEFORE launch day — do not discover a missing scaffold between Phase 1 and finalize.

```bash
# 1. Edit layerzero.config.ts → new ShareOFT deployment name/address
pnpm hardhat lz:oft:solana:init-config --oapp-config layerzero.config.ts
pnpm hardhat lz:oapp:wire --oapp-config layerzero.config.ts
```

The Solana oftStore side is already configured — this wires the Base OApp only.

### P1-3. Gate before finalize

Re-run P1-1 until it exits `0` (`✓ Post–Phase 1 complete`). Also confirm the deploy UI
**Pipe A panel shows ready**. Only then run finalize in the UI. Finalize will: register
the creator in `CreatorRegistry`, seed the registry peer, `setPeer(30168, …)` on the new
ShareOFT if needed, and bridge 30% ShareOFT to Solana (attach LZ fee — payable).

---

## AFTER FINALIZE — ops follow-through

### PF-1. One command (defaults + backfill + Vultr mapping)

```bash
pnpm -C frontend ops:complete-akita-deploy post-finalize \
  --share-oft 0xNEW_SHARE_OFT --vault 0xNEW_VAULT --wrapper 0xNEW_WRAPPER \
  --gauge 0xNEW_GAUGE --cca 0xNEW_CCA --oracle 0xNEW_ORACLE \
  --update-vultr --backfill --write-defaults
```

What each flag answers:

| Question | Flag / effect |
|----------|---------------|
| Update `AKITA_DEFAULTS`? | `--write-defaults` rewrites vault/wrapper/shareOFT/gauge/cca/oracle in `frontend/src/config/contracts.defaults.ts` (covers `ERC4626_DEFAULTS` aliases too). **Then commit + push + Vercel production deploy**, and update any Vercel env overrides. |
| Backfill keeper vault? | `--backfill` runs `scripts/ops/backfill-keepr-vault.ts --vault 0xNEW_VAULT --creator <akita> --execute` (upserts `keepr_vaults` + `ajna_vaults`; settlement auto-bootstrap is a backstop, not a substitute). |
| Update `SOLANA_SHARE_OFT_MAPPING`? | `--update-vultr` runs `ops:update-vultr-mapping --mint 5puVV8bQZp4YoEfGq4RitQFRVC3SJiHBSydFuFZUXHQv --share-oft 0xNEW_SHARE_OFT` — merges the mapping into `/etc/4626/solana-keeper-orchestrator.env`, ensures `SOLANA_CREATOR_MINTS` contains the mint, and restarts the service. Needs `VULTR_USERNAME`/`VULTR_IP_ADDRESS` (or `VULTR_SSH`) in `frontend/.env`; if SSH fails it prints the manual env lines + `sudo systemctl restart solana-keeper-orchestrator`. |

**Stop condition:** the wrapper exits non-zero and prints `✗ Post-finalize INCOMPLETE`
naming any failed substep (`update-vultr-mapping`, `backfill-keepr-vault`) — fix and
re-run until it exits 0. Even on `✓`, PF-4 verification below is mandatory before
treating the mesh as live; the `✓` only covers the automatable substeps.

### PF-2. Manual signer txs (printed by PF-1 with exact calldata)

1. **Wrapper owner (your CSW):** `setBeneficiaryOperator(0x7dF44cBB93a5191837a988f0Cc441E3811C39CD1, true)`
   on the new wrapper — PF-1 prints the encoded calldata.
2. **Protocol treasury Safe:** `configureCreatorMesh` on `OVaultHubComposer` —
   **DEFERRED, NOT A LAUNCH REQUIREMENT.** Product decision 2026-06-12
   (`docs/_internal/operations/operations/solana/solana-share-mesh-lottery-policy.md`):
   the compose-deposit lane (Pipe B) is **dormant** — $AKITA lives on Base only, no
   Base asset-mesh OFTAdapter or Solana AKITA OFT exists, and none should be deployed
   for launch. `configureCreatorMesh` reverts on zero `assetMeshToken`/`solanaAssetPeer`,
   so it CANNOT be called until the AKITA OFT-adapter lockbox ships
   (activation recipe: `docs/_internal/research/akita-oft-adapter-lockbox.md`).
   The lane is inert by construction (`CreatorMeshNotConfigured`) and does not gate
   the vault, the 30% finalize bridge, or Meteora trading. Skip this step at launch.
   Note: item 1 (`setBeneficiaryOperator`) is likewise only a prerequisite for this
   future composer activation — cheap to do at launch, but not required for it.
   If/when the lockbox ships, generate the Safe calldata with:
   ```bash
   pnpm -C frontend exec tsx scripts/ops/plan-akita-share-mesh-phase-a.ts \
     --asset-mesh 0xBASE_AKITA_OFT_ADAPTER \
     --share-mesh 0xNEW_SHARE_OFT \
     --solana-asset-peer 0xAKITA_SOLANA_OFT_PEER_BYTES32 \
     --solana-share-peer 0xdf9a9ef76562adbfe0231e2c5cee77f24a1f9eac519d3fbb029fe5b454d9cd3f \
     --solana-eid 30168
   ```
   Running it with fewer flags prints a checklist only ("Calldata preview skipped") —
   it will NOT produce the Safe payload.

### PF-3. Reseed orchestrator env (only if the hook was upgraded)

The `--update-vultr` mapping merge is usually sufficient. A full env reseed is only
needed after a hook schema change:

```bash
# on the Vultr host
sudo bash kpr/deploy/seed-solana-orchestrator-env.sh \
  --source /opt/4626/kpr/.env \
  --dest /etc/4626/solana-keeper-orchestrator.env \
  --hook-schema auto
sudo systemctl restart solana-keeper-orchestrator
```

Keep `SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0` until the B2 pool exists.

### PF-4. Final verification — prove the mesh is live

Two preconditions or these checks lie to you:

- `read-akita-ovault-mesh-onchain.ts` takes **no address flags** — it reads
  `AKITA_DEFAULTS` from `contracts.defaults.ts`. It is only meaningful AFTER the
  `--write-defaults` rewrite (or equivalent manual defaults update) is present on the
  machine running it. Without that, it green-lights the OLD stack.
- Solana mapping checks read the environment of the process performing them.
  Keep `SOLANA_SHARE_OFT_MAPPING` (and `SOLANA_CREATOR_MINTS` if needed) aligned
  with the new ShareOFT on the actual orchestrator host.

```bash
pnpm -C frontend exec tsx scripts/ops/read-akita-ovault-mesh-onchain.ts
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts
pnpm -C frontend ops:verify-akita-prelaunch --production   # full gate re-run, expect exit 0
# Base smoke: ShareOFT buy → lottery entry on the NEW share token
```

Done when: mesh read-back shows the new addresses wired, Pipe A readiness exits 0,
the prelaunch gate is green against the new stack, and the active orchestrator
mapping points at the new ShareOFT.

---

## Explicitly NOT required before Base vault live

- B2 devnet hook deploy or any removed Twin relay, Meteora pool + LP,
  `configureCreatorMesh` on `OVaultHubComposer` (compose-deposit lane is dormant —
  see PF-2 item 2; requires the future AKITA OFT-adapter lockbox first).
