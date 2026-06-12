# $AKITA OFT-adapter lockbox — bridge design note

**Status: design only — not scheduled.** Written 2026-06-12 when the compose-deposit lane (Pipe B deposit side) was marked **dormant** in [solana-share-mesh-lottery-policy.md](../operations/solana-share-mesh-lottery-policy.md). This is the activation recipe if product later decides to make $AKITA bridgeable from Base to Solana / Ethereum / other chains.

**Bridge stack decision (2026-06-12): LayerZero OFT only.** Product explicitly ruled out Chainlink CCIP — one bridge vendor, aligned with the existing LZ stack (ShareOFT, Solana share mesh, DVN policy, peer tooling). Do not reintroduce CCIP/CCT designs for AKITA without a new product decision.

## Token constraints (verified on-chain 2026-06-12)

$AKITA `0x5b674196812451b7cec024fe9d22d2c0b172fa75` (Base) is a Zora creator coin:

| Probe | Result | Consequence |
|-------|--------|-------------|
| `owner()` | reverts (not Ownable) | No standard token-admin hook |
| `getCCIPAdmin()` | reverts (not implemented) | Same |
| Mint authority | none we control | **Burn/mint of AKITA itself on remote chains is impossible** |
| `payoutRecipient()` | canonical CSW `0xAb6d5C…967b5` | Creator-coin payout lane unaffected by any bridge |

The LZ `OFTAdapter` is the right fit precisely because of this shape: it needs no token admin rights at all — only ERC-20 `transferFrom`.

Every bridge option therefore reduces to the **lockbox pattern**: lock real AKITA in a contract on Base, mint a 1:1 representation remotely, burn-and-release on return. Base remains the canonical home of supply.

## Architecture: LayerZero OFT Adapter (hub-and-spoke)

Aligns with the existing stack — ShareOFT, the Solana share mesh, DVN policy, peer tooling, and keeper monitoring are all LayerZero already.

```text
Base (hub)                          Remote chains (spokes)
AKITA ──lock──► OFTAdapter ◄──LZ──► Solana OFT (SPL mint, EID 30168)
                    ▲       ◄──LZ──► Ethereum OFT (EID 30101)
                    └─ release on return; spokes burn/mint their local representation
```

- **Base:** LZ V2 `OFTAdapter` wrapping AKITA. No token admin rights needed — the adapter only needs ERC-20 `transferFrom`. Owner/delegate: protocol treasury Safe (`0x7d429e…`).
- **Solana:** LZ Solana OFT program + SPL mint, same `create-lz-oapp` / `lz:oft:solana:create` pipeline as the share mesh. This is a **new mint** — distinct from the legacy bridge-wrapped creator SPL (`9JWh…LJdp` via `SolanaBridgeAdapter`) and from the share mesh mint. Do not register it on `SolanaBridgeAdapter` (that lane is the retired creator-SPL wrap grain, and `registerToken` hard-reverts on re-registration anyway).
- **Other EVM chains:** standard OFT contract per chain, peered to the Base adapter hub. Ethereum→Solana transfers route through LZ directly between spokes or via the hub depending on peer wiring; simplest mesh is hub-routed.
- **DVN security:** reuse the mainnet share-mesh policy — **no required DVNs, 6-of-9 optional** (LayerZero Labs, Google, Nethermind, Horizen, Deutsche Telekom, Nansen, Frax, Wyoming, P-OPS). Never single-DVN `1/1`. See [budget paths § ULN](../operations/solana-share-mesh-budget-paths.md#uln-security--6-of-9-optional-dvns-mainnet).

### Cost estimate

Mirrors measured share-mesh Path 1 numbers ([budget doc](../operations/solana-share-mesh-budget-paths.md#measured-costs-2026-05-27-local-validator)):

| Component | Cost |
|-----------|------|
| Solana LZ OFT program deploy (~560 KB) | ~4.0 SOL one-time |
| Solana mint + OFT store + peer | ~0.02 SOL |
| Base `OFTAdapter` + per-EVM-spoke OFT deploys | gas only (Base/L2s trivial; Ethereum mainnet the largest) |
| Per-message DVN fees | ~6 verifiers billed per transfer (6-of-9 threshold) |

## Pipe B reactivation (compose deposits)

Once the Base `OFTAdapter` and Solana AKITA mint exist, the dormant compose-deposit lane activates with one owner call on `OVaultHubComposer` — no redeploy:

```solidity
configureCreatorMesh(
  creatorToken:   AKITA,
  vault:          <AKITA CreatorOVault wrapper>,
  assetMeshToken: <Base AKITA OFTAdapter>,   // composer checks sourceOft == assetMeshToken (Base-side address, NOT the Solana mint)
  shareMeshToken: <Base ShareOFT>,
  solanaEid:      30168,
  solanaAssetPeer / solanaSharePeer: <bytes32 peers>
)
```

`_composeDeposit` validates `srcEid == solanaEid` and `sourceOft == assetMeshToken`, deposits the unlocked AKITA into the vault wrapper, and delivers ShareOFT on Base.

## Rejected alternative: Chainlink CCIP CCT

Evaluated and ruled out 2026-06-12. CCIP v1.6 is live on Solana and CCT supports the same lock/release split, but AKITA exposes neither `owner()` nor `getCCIPAdmin()`, so registration would require Chainlink's governance-assisted manual process — and it would add a second bridge vendor (new pool contracts, rate limits, monitoring) alongside the LZ stack for no capability gain. Decision: **LayerZero OFT only.**

## Invariants when (if) this ships

- Base stays canonical: total remote supply == AKITA locked in the Base adapter. Add a keeper parity probe (locked balance vs sum of remote supplies) before announcing.
- Lottery policy unchanged: compose deposits and bridge receipts are **never** lottery-eligible — pool buy of the tradable share token only.
- Update [solana-share-mesh-lottery-policy.md](../operations/solana-share-mesh-lottery-policy.md) (lane B dormant → active) and the budget doc scope line as part of the activation PR, and restore deposit-readiness reporting to deploy preflight/infra status only if product wants it gating again (default: report-only, never gate).

## Activation checklist

1. Deploy Base `OFTAdapter` (owner = treasury Safe); deploy Solana OFT + mint (EID 30168) and any EVM spoke OFTs.
2. Wire peers both directions; apply 6-of-9 optional DVN config; `lz:oapp:wire --ci` + debug-verify thresholds.
3. Smoke-bridge a small amount Base → Solana → Base; confirm lock/release accounting.
4. `configureCreatorMesh(...)` on `OVaultHubComposer` with the Base adapter as `assetMeshToken`.
5. Compose-deposit smoke test from Solana; confirm ShareOFT delivery on Base.
6. Docs + keeper parity probe + ops runbook update.
