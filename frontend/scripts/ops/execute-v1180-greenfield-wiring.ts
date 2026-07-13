#!/usr/bin/env node
/**
 * RETIRED: v1.18.0 Safe wiring that included Twin setSolanaConfig(adapter, destination).
 *
 * Active batcher Solana shell: setSolanaDestination + setOVaultRuntimeConfig.
 * Per-creator peers: Registry4626.setRemoteOFTPeerBytes32 (LayerZero ShareOFT).
 */
declare const process: {
  argv: string[]
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const RETIREMENT_MESSAGE = `RETIRED: execute-v1180-greenfield-wiring included Twin setSolanaConfig and is fail-closed.

Use LayerZero ShareOFT share-mesh instead:
  1. Provision Solana LZ OFT store + mint
     docs/_internal/operations/operations/solana/solana-share-mesh-creator-provisioning.md
  2. Seed per-creator peer:
     Registry4626.setRemoteOFTPeerBytes32(creatorToken, solanaEid, peer)
  3. Batcher shell only (when needed):
     setSolanaDestination(...) + setOVaultRuntimeConfig(...)
     (plus wireDeploymentHelpers / setPhase1Module via current cutover runbooks)

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
