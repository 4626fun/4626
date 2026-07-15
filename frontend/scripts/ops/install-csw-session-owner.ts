#!/usr/bin/env node
/**
 * Install a deploy-session signer as owner on the operator CSW via Privy UserOp.
 *
 * Usage:
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/install-csw-session-owner.ts --owner 0x...
 */
import { createPublicClient, encodeFunctionData, getAddress, http, isAddress, type Address } from 'viem'
import { base } from 'viem/chains'

import {
  readCanonicalCswAddressEnv,
  readCanonicalCswOwnerIndexEnv,
  readCanonicalCswPrivyWalletIdEnv,
} from '../../server/_lib/wallet/canonicalCswEnv.js'
import {
  resolvePrivyCoinbaseSmartWalletOwnerContext,
  sendPrivyCoinbaseSmartWalletUserOperation,
} from '../../server/_lib/wallet/privyCoinbaseSmartWallet.js'
import { CSW_OWNER_INSTALL_ABI } from '../../src/lib/wallet/cswOwnerAbi.js'

function getArg(name) {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return ''
  const v = process.argv[idx + 1]
  if (!v || v.startsWith('--')) return ''
  return v
}

function readBundlerUrl() {
  const candidates = [
    process.env.CDP_PAYMASTER_URL,
    process.env.CDP_PAYMASTER_AND_BUNDLER_URL,
    process.env.CDP_PAYMASTER_AND_BUNDLER_ENDPOINT,
  ]
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim()
    if (value) return value
  }
  throw new Error('Bundler URL missing (CDP_PAYMASTER_URL).')
}

async function main() {
  const ownerRaw = getArg('--owner')
  if (!isAddress(ownerRaw)) throw new Error('Pass --owner 0x...')
  const newOwner = getAddress(ownerRaw)

  const smartWalletRaw = readCanonicalCswAddressEnv()
  const walletId = readCanonicalCswPrivyWalletIdEnv()
  const ownerIndexRaw = readCanonicalCswOwnerIndexEnv()
  if (!smartWalletRaw) throw new Error('CANONICAL_CSW_ADDRESS missing')
  if (!walletId) throw new Error('CANONICAL_CSW_PRIVY_WALLET_ID missing')

  const smartWallet = getAddress(smartWalletRaw)
  const publicClient = createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
  })

  const already = await publicClient.readContract({
    address: smartWallet,
    abi: CSW_OWNER_INSTALL_ABI,
    functionName: 'isOwnerAddress',
    args: [newOwner],
  })
  if (already) {
    console.log(`already_owner=${newOwner}`)
    return
  }

  const configuredOwnerIndex = ownerIndexRaw ? Number(ownerIndexRaw) : Number.NaN
  const ownerContext = await resolvePrivyCoinbaseSmartWalletOwnerContext({
    publicClient,
    walletId,
    smartWallet,
    expectedOwnerAddress: null,
    configuredOwnerIndex: Number.isFinite(configuredOwnerIndex) ? configuredOwnerIndex : null,
    allowConfiguredOwnerIndexFallback: true,
    maxScan: 512,
  })

  const data = encodeFunctionData({
    abi: CSW_OWNER_INSTALL_ABI,
    functionName: 'addOwnerAddress',
    args: [newOwner],
  })

  console.log(
    `installing owner=${newOwner} on csw=${smartWallet} via ownerIndex=${ownerContext.ownerIndex}`,
  )

  const result = await sendPrivyCoinbaseSmartWalletUserOperation({
    publicClient,
    bundlerUrl: readBundlerUrl(),
    walletId,
    smartWallet,
    ownerAddress: ownerContext.ownerAddress,
    ownerIndex: ownerContext.ownerIndex,
    calls: [{ to: smartWallet, data, value: 0n }],
    simulate: true,
  })

  console.log(`userOpHash=${result.userOpHash}`)
  console.log(`txHash=${result.txHash}`)

  const confirmed = await publicClient.readContract({
    address: smartWallet,
    abi: CSW_OWNER_INSTALL_ABI,
    functionName: 'isOwnerAddress',
    args: [newOwner],
  })
  if (!confirmed) throw new Error('owner install did not confirm on-chain')
  console.log('owner_install_ok=true')
}

main().catch((error) => {
  console.error(String(error instanceof Error ? error.message : error))
  process.exit(1)
})
