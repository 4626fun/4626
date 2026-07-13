#!/usr/bin/env node
/**
 * RETIRED: Safe proposals for setSolanaConfig / setSolanaShareOftPeer (Twin + global peer).
 *
 * Active path: LayerZero ShareOFT + Registry4626.setRemoteOFTPeerBytes32 +
 * setSolanaDestination / setOVaultRuntimeConfig on the batcher shell.
 */
declare const process: {
  argv: string[]
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const RETIREMENT_MESSAGE = `RETIRED: Twin / batcher-global Solana Safe config proposals are no longer supported.

This script previously proposed setSolanaConfig(adapter, destination) and/or
setSolanaShareOftPeer (batcher-global peer). Both are retired.

Use LayerZero ShareOFT share-mesh instead:
  1. Provision Solana LZ OFT store + mint
     docs/_internal/operations/operations/solana/solana-share-mesh-creator-provisioning.md
  2. Seed per-creator peer:
     Registry4626.setRemoteOFTPeerBytes32(creatorToken, solanaEid, peer)
  3. Batcher shell only (when needed):
     setSolanaDestination(...) + setOVaultRuntimeConfig(...)

pnpm alias batcher:solana:config:safe still points here and fails closed on purpose.
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
