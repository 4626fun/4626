#!/usr/bin/env node
/**
 * RETIRED: Pipe A Safe wiring that proposed Twin setSolanaConfig(adapter, destination).
 *
 * Active path: setSolanaDestination + setOVaultRuntimeConfig + per-creator
 * Registry4626.setRemoteOFTPeerBytes32 (LayerZero ShareOFT).
 */
declare const process: {
  argv: string[]
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const RETIREMENT_MESSAGE = `RETIRED: execute-batcher-pipe-a-safe-wiring proposed Twin setSolanaConfig and is fail-closed.

Use LayerZero ShareOFT share-mesh instead:
  1. Provision Solana LZ OFT store + mint
     docs/_internal/operations/operations/solana/solana-share-mesh-creator-provisioning.md
  2. Seed per-creator peer:
     Registry4626.setRemoteOFTPeerBytes32(creatorToken, solanaEid, peer)
  3. Batcher shell only (when needed):
     setSolanaDestination(...) + setOVaultRuntimeConfig(...)

Do NOT call setSolanaConfig(adapter, ...) or setSolanaShareOftPeer.
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
