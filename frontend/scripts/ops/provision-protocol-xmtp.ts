#!/usr/bin/env node
/**
 * One-shot XMTP installation bootstrap for the protocol CSW (`PROTOCOL_CSW_*`).
 *
 * Creates (or reuses) a local XMTP DB under `.tmp/protocol-xmtp/` and registers
 * a new installation for the Privy server signer on the protocol CSW.
 *
 * Usage:
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/provision-protocol-xmtp.ts
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { XmtpService } from '../../server/agents/eliza/plugins/xmtp/service.js'
import { createPrivyScwSigner } from '../../server/_lib/wallet/privyXmtpSigner.js'
import {
  readProtocolCswChainIdEnv,
  readProtocolCswOwnerIndexEnv,
  readProtocolCswPrivyWalletIdEnv,
  resolveServerAgentCswAddress,
} from '../../server/_lib/wallet/canonicalCswEnv.js'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(scriptDir, '../..')
const xmtpEnv = (process.env.XMTP_ENV ?? 'production').trim()
const dbPath = path.join(frontendRoot, '.tmp/protocol-xmtp/agent.db3')

async function main() {
  const cswAddress = resolveServerAgentCswAddress()
  const walletId = readProtocolCswPrivyWalletIdEnv()
  if (!walletId) {
    throw new Error('PROTOCOL_CSW_PRIVY_WALLET_ID or CANONICAL_CSW_PRIVY_WALLET_ID missing')
  }

  const ownerIndexRaw = readProtocolCswOwnerIndexEnv()
  const ownerIndexParsed = ownerIndexRaw ? Number(ownerIndexRaw) : Number.NaN
  const ownerIndex =
    Number.isFinite(ownerIndexParsed) && ownerIndexParsed >= 0 ? Math.floor(ownerIndexParsed) : undefined

  const signer = createPrivyScwSigner({
    walletId,
    cswAddress,
    ownerIndex,
    chainId: readProtocolCswChainIdEnv(),
  })

  const dbDir = path.dirname(dbPath)
  await fs.mkdir(dbDir, { recursive: true })

  const xmtp = new XmtpService({
    signer,
    env: xmtpEnv,
    dbPath,
    revokeOtherInstallations: false,
  })

  console.log('[provision-protocol-xmtp] starting…')
  console.log(`protocolCsw=${cswAddress}`)
  console.log(`privyWalletId=${walletId}`)
  console.log(`ownerIndex=${ownerIndex ?? '(auto)'}`)
  console.log(`dbPath=${dbPath}`)
  console.log(`xmtpEnv=${xmtpEnv}`)

  await xmtp.start()

  const address = xmtp.address?.toLowerCase?.() ?? cswAddress.toLowerCase()
  console.log('[provision-protocol-xmtp] success')
  console.log(`xmtpAddress=${address}`)
  console.log(`dmLink=https://xmtp.chat/dm/${address}`)
  console.log('Next: redeploy Railway Eliza with PROTOCOL_CSW_* env and a fresh/persistent XMTP DB volume.')

  await xmtp.stop?.()
}

main().catch((error) => {
  console.error(`[provision-protocol-xmtp] failed: ${String(error instanceof Error ? error.message : error)}`)
  process.exit(1)
})
