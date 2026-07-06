# Keeper automation — canonical single-EOA setup

Status: **canonical** · Updated: 2026-07-06

4626 uses **one hot keeper/automation EOA** on Base mainnet:

| Field | Value |
|-------|--------|
| **Address** | `0xed7eFE34D25a0B219de1b25AC99EB35E48CC1379` |
| **Private key env** | `KPR_PRIVATE_KEY` (server + `kpr/.env`) |
| **Public pins** | `PROTOCOL_AJNA_KEEPER`, `PAYOUT_ROUTER_KEEPER` (optional but recommended) |
| **Shell-safe aliases** | `KEEPER_AUTOMATION_PUBLIC_KEY`, `KEEPER_AUTOMATION_PRIVATE_KEY` |

Retired: separate `4626_KEEPER_AUTOMATION_*` / `0xed401e824df0F3de05Da00C939e81Df60c68a0Cd` (never used on-chain).

## Roles (do not conflate)

See [wallet-roles.md](./wallet-roles.md) for the full address map. This EOA is **not**:

- the canonical CSW (`0xAb6d5…967b5`)
- the Privy server wallet (`0x858c…0baf0`) used by Railway XMTP
- your admin Zora EOA (`0xB05Cf0…0FdD`)

It **is**:

- on-chain `keeper` for grandfathered AKITA vault `0x82C06E…4471`
- Ajna `keeper` baked into greenfield deploy Phase 3 calldata
- default signer for KPR tend/report, payout-router harvest, and Ajna `moveFromBuffer`

## Required env (production + local)

Pin all public addresses to the same EOA:

```bash
PROTOCOL_AJNA_KEEPER=0xed7eFE34D25a0B219de1b25AC99EB35E48CC1379
PAYOUT_ROUTER_KEEPER=0xed7eFE34D25a0B219de1b25AC99EB35E48CC1379
KPR_PRIVATE_KEY=0x...   # derives to the address above
```

Do **not** set legacy `4626_KEEPER_AUTOMATION_*` to a different address — that caused deploy/Ajna drift.

On Vercel you may still use `4626_KEEPER_AUTOMATION_PUBLIC_KEY` with the **same** address if the dashboard requires it; prefer `PROTOCOL_AJNA_KEEPER` in shell-local files.

## Verify

```bash
pnpm -C frontend exec tsx scripts/ops/verify-keeper-automation-alignment.ts
```

Exit 0 = env pins, KPR derivation, and AKITA on-chain keeper all match.

## Hot automation Safe (deployed 2026-07-06)

| Field | Value |
|-------|--------|
| **Address** | `0x08f0875E40781578F902998b2b831cc48d838eBE` |
| **Owners** | `0xed7e…1379` (keeper EOA) — threshold 1 |
| **Deployed via** | Protocol treasury Safe [`0x6097ef…c3f`](https://basescan.org/tx/0x6097ef9114614a406ebbf669ec9770f8bc7bb11d8ebace583fd83915229a7c3f) |
| **Env** | `PROTOCOL_AUTOMATION_SAFE`, `VITE_PROTOCOL_AUTOMATION` |

Keeper was **removed** from cold treasury Safe owners in the same session ([`0x94ac4b…b68`](https://basescan.org/tx/0x94ac4b9e8e2be59187175f47d5ffbeadb11f98da82e4bfbe54423a5465cf0b68)).

```bash
pnpm -C frontend ops:deploy-protocol-automation-safe -- --dry-run
pnpm -C frontend ops:deploy-protocol-automation-safe -- --execute
```

## Optional follow-up: Safe owner for Charm automation

Charm `rebalance()` and Ajna `setMinBucketIndex()` route through **`PROTOCOL_AUTOMATION_SAFE`** when configured. The keeper EOA must be an owner on that Safe (true for the hot Safe above).

Legacy note: before 2026-07-06, keeper was temporarily added to the **treasury** Safe — that was reversed when the hot Safe shipped.

Grandfathered AKITA vault tend/report does **not** require this step — only Safe-mediated strategy automation.

## Pick one AKITA execution lane

| Lane | When |
|------|------|
| **HTTP bridge** (default Vercel) | `KPR_USE_KEEPER_HTTP_BRIDGE=1`, funded `KPR_PRIVATE_KEY`, on-chain `keeper` = canonical EOA |
| **ERC-4337 CSW** (local ops) | `KPR_USE_KEEPER_HTTP_BRIDGE=0`, `KPR_ERC4337_ENABLED=true`, canonical CSW UserOps |

Do not run both against the same vault without an explicit primary.
