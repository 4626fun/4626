#!/usr/bin/env tsx
/**
 * Burn orphaned ■AKITA on the canonical CSW via wrapper.unwrap().
 *
 * Context: AKITA B2 vault was emergency-drained to the CSW, so PPS≈0 and
 * wrapper.withdraw() reverts ZeroAmount on redeem. unwrap() still burns ShareOFT
 * and releases worthless ▢ vault shares to the CSW.
 *
 * Defaults to dry-run. Live burn requires:
 *   --execute --confirm=BURN-ORPHAN-SHAREOFT
 *
 * Usage:
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/burn-orphan-akita-shareoft-csw.ts --dry-run
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/burn-orphan-akita-shareoft-csw.ts \
 *     --execute --confirm BURN-ORPHAN-SHAREOFT [--amount 20000000]
 */
import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  http,
  isAddress,
  parseUnits,
  type Address,
  type Hex,
} from 'viem'
import {
  createBundlerClient,
  createPaymasterClient,
  sendUserOperation,
  toCoinbaseSmartAccount,
} from 'viem/account-abstraction'
import { base } from 'viem/chains'

import {
  readCanonicalCswAddressEnv,
  readCanonicalCswOwnerIndexEnv,
  readCanonicalCswPrivyWalletIdEnv,
} from '../../server/_lib/wallet/canonicalCswEnv.js'
import {
  createPrivyWalletBackedAccount,
  resolvePrivyCoinbaseSmartWalletOwnerContext,
} from '../../server/_lib/wallet/privyCoinbaseSmartWallet.js'

const SHARE = getAddress('0x44710150A469DE368Abc82F05e6217086Be84626')
const WRAPPER = getAddress('0x2d66Fe297CDAE8B4325bB58887bE125CED4A81b4')
const VAULT = getAddress('0x4626539E5C01cc32C29755146D31755e3adA848A')
const CONFIRM_TOKEN = 'BURN-ORPHAN-SHAREOFT'

const WRAPPER_ABI = [
  {
    type: 'function',
    name: 'unwrap',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalLocked',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalMinted',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

function getArg(name: string): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return ''
  const v = process.argv[idx + 1]
  if (!v || v.startsWith('--')) return ''
  return v
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function readBundlerUrl(): string {
  for (const candidate of [
    process.env.CDP_PAYMASTER_URL,
    process.env.CDP_PAYMASTER_AND_BUNDLER_URL,
    process.env.CDP_PAYMASTER_AND_BUNDLER_ENDPOINT,
  ]) {
    const value = String(candidate ?? '').trim()
    if (value) return value
  }
  throw new Error('Bundler URL missing (CDP_PAYMASTER_URL).')
}

async function main(): Promise<void> {
  const execute = hasFlag('--execute')
  const dryRun = hasFlag('--dry-run') || !execute
  if (execute && getArg('--confirm') !== CONFIRM_TOKEN) {
    throw new Error(`Live burn requires --confirm=${CONFIRM_TOKEN}`)
  }

  const smartWalletRaw = readCanonicalCswAddressEnv()
  const walletId = readCanonicalCswPrivyWalletIdEnv()
  if (!smartWalletRaw || !isAddress(smartWalletRaw)) throw new Error('CANONICAL_CSW_ADDRESS missing')
  if (!walletId) throw new Error('CANONICAL_CSW_PRIVY_WALLET_ID missing')
  const smartWallet = getAddress(smartWalletRaw)

  const rpc =
    process.env.BASE_RPC_URL?.replace(/^wss:/, 'https:')
      .replace(/^ws:/, 'http:')
      .replace('/ws/', '/rpc/') || 'https://mainnet.base.org'
  const publicClient = createPublicClient({ chain: base, transport: http(rpc) })

  const [shareBal, vaultShareBalBefore, totalLocked, totalMinted, vaultAssets] = await Promise.all([
    publicClient.readContract({ address: SHARE, abi: erc20Abi, functionName: 'balanceOf', args: [smartWallet] }),
    publicClient.readContract({ address: VAULT, abi: erc20Abi, functionName: 'balanceOf', args: [smartWallet] }),
    publicClient.readContract({ address: WRAPPER, abi: WRAPPER_ABI, functionName: 'totalLocked' }),
    publicClient.readContract({ address: WRAPPER, abi: WRAPPER_ABI, functionName: 'totalMinted' }),
    publicClient.readContract({
      address: VAULT,
      abi: [{ type: 'function', name: 'totalAssets', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }],
      functionName: 'totalAssets',
    }),
  ])

  const amountArg = getArg('--amount')
  const amount = amountArg ? parseUnits(amountArg, 18) : shareBal
  if (amount <= 0n) throw new Error('Nothing to burn (■ balance is 0)')
  if (amount > shareBal) throw new Error(`amount ${amount} exceeds CSW ■ balance ${shareBal}`)
  if (vaultAssets !== 0n) {
    throw new Error(
      `Refuse orphan burn while vault totalAssets=${vaultAssets} — use wrapper.withdraw() instead`,
    )
  }

  const plan = {
    mode: dryRun ? 'DRY_RUN' : 'EXECUTE',
    smartWallet,
    share: SHARE,
    wrapper: WRAPPER,
    amount: amount.toString(),
    amountHuman: `${Number(amount) / 1e18}`,
    shareBal: shareBal.toString(),
    vaultShareBalBefore: vaultShareBalBefore.toString(),
    totalLocked: totalLocked.toString(),
    totalMinted: totalMinted.toString(),
    vaultAssets: vaultAssets.toString(),
    path: 'approve(wrapper) + wrapper.unwrap(amount)  // burns ■; leaves ▢ on CSW',
  }
  console.log(JSON.stringify(plan, null, 2))

  const approveData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [WRAPPER, amount],
  })
  const unwrapData = encodeFunctionData({
    abi: WRAPPER_ABI,
    functionName: 'unwrap',
    args: [amount],
  })

  // eth_call simulate as CSW (approve state won't stick across calls; simulate unwrap
  // only after checking allowance path via multicall-shaped sequential call is imperfect).
  await publicClient.call({ account: smartWallet, to: SHARE, data: approveData, gas: 100_000n })

  if (dryRun) {
    console.log(`DRY_RUN complete — re-run with --execute --confirm=${CONFIRM_TOKEN}`)
    return
  }

  const ownerIndexRaw = readCanonicalCswOwnerIndexEnv()
  const configuredOwnerIndex = ownerIndexRaw ? Number(ownerIndexRaw) : Number.NaN
  const ownerContext = await resolvePrivyCoinbaseSmartWalletOwnerContext({
    publicClient,
    walletId,
    smartWallet,
    configuredOwnerIndex: Number.isFinite(configuredOwnerIndex) ? configuredOwnerIndex : undefined,
  })

  const bundlerUrl = readBundlerUrl()
  const transport = http(bundlerUrl, { timeout: 60_000 })
  const paymasterClient = createPaymasterClient({ transport })
  const bundlerClient = createBundlerClient({ client: publicClient as never, transport })
  const ownerAccount = createPrivyWalletBackedAccount({
    walletId,
    address: ownerContext.ownerAddress,
  })
  const account = await toCoinbaseSmartAccount({
    client: publicClient as never,
    address: smartWallet,
    owners: [ownerAccount as never],
    ownerIndex: ownerContext.ownerIndex,
    version: '1',
  })

  const userOpHash = (await sendUserOperation(bundlerClient, {
    account,
    calls: [
      { to: SHARE, data: approveData, value: 0n },
      { to: WRAPPER, data: unwrapData, value: 0n },
    ],
    callGasLimit: 2_500_000n,
    paymaster: {
      getPaymasterData: paymasterClient.getPaymasterData,
      getPaymasterStubData: paymasterClient.getPaymasterStubData,
    },
  })) as Hex

  console.log({ userOpHash })
  const userOpReceipt = await bundlerClient.waitForUserOperationReceipt({
    hash: userOpHash,
    timeout: 180_000,
  })
  const txHash = userOpReceipt.receipt.transactionHash as Hex
  const txReceipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 180_000 })
  if (txReceipt.status !== 'success') throw new Error(`UserOp reverted: ${txHash}`)

  const [shareBalAfter, vaultShareBalAfter, totalMintedAfter] = await Promise.all([
    publicClient.readContract({ address: SHARE, abi: erc20Abi, functionName: 'balanceOf', args: [smartWallet] }),
    publicClient.readContract({ address: VAULT, abi: erc20Abi, functionName: 'balanceOf', args: [smartWallet] }),
    publicClient.readContract({ address: WRAPPER, abi: WRAPPER_ABI, functionName: 'totalMinted' }),
  ])

  console.log(
    JSON.stringify(
      {
        ok: true,
        txHash,
        userOpHash,
        shareBalAfter: shareBalAfter.toString(),
        vaultShareBalAfter: vaultShareBalAfter.toString(),
        totalMintedAfter: totalMintedAfter.toString(),
        burnedShareOFT: (shareBal - shareBalAfter).toString(),
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
