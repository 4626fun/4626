#!/usr/bin/env node
/**
 * RETIRED: batcher-global setSolanaShareOftPeer is no longer used.
 *
 * Per-creator peers are seeded on Registry4626 via setRemoteOFTPeerBytes32.
 * See docs/_internal/operations/operations/solana/solana-share-mesh-creator-provisioning.md
 */
declare const process: {
  argv: string[]
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const RETIREMENT_MESSAGE = `RETIRED: Twin / batcher-global setSolanaShareOftPeer is no longer supported.

Use LayerZero ShareOFT share-mesh instead:
  1. Provision Solana LZ OFT store + mint
     docs/_internal/operations/operations/solana/solana-share-mesh-creator-provisioning.md
  2. Seed per-creator peer:
     Registry4626.setRemoteOFTPeerBytes32(creatorToken, solanaEid, peer)
  3. Batcher shell only (when needed):
     setSolanaDestination(...) + setOVaultRuntimeConfig(...)

Do NOT call setSolanaShareOftPeer or Twin wrap-token / registerSolanaBridgeToken.
`

function main(): void {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    process.stdout.write(RETIREMENT_MESSAGE)
    process.exit(0)
  }
  process.stderr.write(RETIREMENT_MESSAGE)
  process.exit(1)
}

main()
