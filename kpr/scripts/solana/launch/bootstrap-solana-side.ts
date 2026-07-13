/**
 * RETIRED: Twin registerSolanaBridgeToken bootstrap is no longer supported.
 *
 * Use LayerZero ShareOFT share-mesh provisioning instead:
 *   docs/_internal/operations/operations/solana/solana-share-mesh-creator-provisioning.md
 *   Registry4626.setRemoteOFTPeerBytes32(creatorToken, solanaEid, peer)
 *   + LZ OFT store / mint provisioning (not Twin wrap-token)
 *
 * Usage:
 *   pnpm -C kpr run solana:bootstrap-side          # exits 1 with guidance
 *   pnpm -C kpr run solana:bootstrap-side -- --help  # exits 0 with guidance
 */

const GUIDANCE = `RETIRED: Twin registerSolanaBridgeToken bootstrap is no longer supported.

Do NOT call /api/deploy/registerSolanaBridgeToken or Twin wrap-token provisioning.

Use LayerZero ShareOFT share-mesh instead:
  1. Follow docs/_internal/operations/operations/solana/solana-share-mesh-creator-provisioning.md
  2. Seed per-creator peer:
     Registry4626.setRemoteOFTPeerBytes32(creatorToken, solanaEid, peer)
  3. Provision Solana LZ OFT store + mint (Path 1), then optional Meteora (Path 2)
  4. Batcher shell only when needed:
     setSolanaDestination(...) + setOVaultRuntimeConfig(...)

Optional Meteora Alpha Vault DB upsert remains available separately:
  pnpm -C kpr run solana:register-meteora-vault
`

function main(): void {
  const help = process.argv.includes('--help') || process.argv.includes('-h')
  console.log(GUIDANCE)
  process.exit(help ? 0 : 1)
}

main()
