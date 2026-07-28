#!/usr/bin/env tsx
/**
 * AKITA B2 unwind (CSW owner lane):
 *   0) ensure Ajna emergency readiness (automation keeper + legacy buffer drain)
 *   1) emergencyWithdrawFromStrategies
 *   2) setMinimumTotalIdle(0)
 *   3) shutdownVault
 *   4) emergencyWithdraw(idle, recipient)
 *
 * Defaults to dry-run (snapshot + plan only). Destructive UserOps require:
 *   --execute --confirm=AKITA-B2-UNWIND
 *
 * Usage:
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/execute-akita-b2-unwind-csw.ts --dry-run
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/execute-akita-b2-unwind-csw.ts \
 *     --execute --confirm=AKITA-B2-UNWIND \
 *     [--vault 0x...] [--recipient 0x...] [--confirm-recipient=0x...] \
 *     [--step all|ajna-buffer|strategies|idle|shutdown|drain] [--skip-ajna-buffer] [--no-simulate]
 *
 * A partial strategy unwind still completes shutdown/drain containment, then exits 1.
 */
import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  http,
  isAddress,
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
  assertSuccessfulUserOperationReceipt,
  evaluateUnwindCompletion,
  parseUnwindStep,
  readCliValue,
} from '../../server/_lib/ajnaVaultManager/emergencyUnwindGuards.js'
import {
  ensureAjnaEmergencyReadiness,
  readAjnaTrackedBucketLp,
} from '../../server/_lib/ajnaVaultManager/ensureAjnaEmergencyReadiness.js'
import {
  readCanonicalCswAddressEnv,
  readCanonicalCswOwnerIndexEnv,
  readCanonicalCswPrivyWalletIdEnv,
} from '../../server/_lib/wallet/canonicalCswEnv.js'
import {
  createPrivyWalletBackedAccount,
  resolvePrivyCoinbaseSmartWalletOwnerContext,
} from '../../server/_lib/wallet/privyCoinbaseSmartWallet.js'

const VAULT_ABI = [
  {
    type: 'function',
    name: 'emergencyWithdrawFromStrategies',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setMinimumTotalIdle',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_minimumTotalIdle', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'shutdownVault',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'emergencyWithdraw',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'totalAssets',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalDebt',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'strategyDebt',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'minimumTotalIdle',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'isShutdown',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'asset',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const STRATEGY_ABI = [
  {
    type: 'function',
    name: 'getTotalAssets',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ERC4626_VAULT',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const DEFAULT_VAULT = '0x4626539E5C01cc32C29755146D31755e3adA848A' as Address
const AJNA = '0xa1A3A32C22b1A10Ea27D1688d48b90b1Ac6eD505' as Address
const CHARM = '0xEA0dCE880FCdaBAe5942B836F90751b49621598c' as Address
const CONFIRM_TOKEN = 'AKITA-B2-UNWIND'

function getArg(name: string): string {
  return readCliValue(process.argv, name)
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function parseMode(): { dryRun: boolean; execute: boolean; confirm: string } {
  const execute = hasFlag('--execute')
  const dryRun = hasFlag('--dry-run') || !execute
  return { dryRun, execute, confirm: getArg('--confirm') }
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
  const mode = parseMode()
  const vault = getAddress((getArg('--vault') || DEFAULT_VAULT) as Address)
  const step = parseUnwindStep(getArg('--step'))
  const noSimulate = hasFlag('--no-simulate')

  const smartWalletRaw = readCanonicalCswAddressEnv()
  const walletId = readCanonicalCswPrivyWalletIdEnv()
  if (!smartWalletRaw || !isAddress(smartWalletRaw)) throw new Error('CANONICAL_CSW_ADDRESS missing')
  if (!walletId) throw new Error('CANONICAL_CSW_PRIVY_WALLET_ID missing')
  const smartWallet = getAddress(smartWalletRaw)

  const recipientOverride = getArg('--recipient')
  const confirmRecipient = getArg('--confirm-recipient')
  let recipient = smartWallet
  if (recipientOverride) {
    if (!isAddress(recipientOverride)) throw new Error('Invalid --recipient')
    recipient = getAddress(recipientOverride)
    if (recipient !== smartWallet) {
      if (!confirmRecipient || getAddress(confirmRecipient as Address) !== recipient) {
        throw new Error(
          `Non-CSW --recipient ${recipient} requires matching --confirm-recipient=${recipient}`,
        )
      }
    }
  }

  if (mode.execute && mode.confirm !== CONFIRM_TOKEN) {
    throw new Error(`Live unwind requires --confirm=${CONFIRM_TOKEN}`)
  }

  const rpc =
    process.env.BASE_RPC_URL?.replace(/^wss:/, 'https:')
      .replace(/^ws:/, 'http:')
      .replace('/ws/', '/rpc/') || 'https://mainnet.base.org'
  const publicClient = createPublicClient({ chain: base, transport: http(rpc) })

  const owner = await publicClient.readContract({ address: vault, abi: VAULT_ABI, functionName: 'owner' })
  if (getAddress(owner) !== smartWallet) {
    throw new Error(`CSW ${smartWallet} is not vault owner ${owner}`)
  }

  const ownerIndexRaw = readCanonicalCswOwnerIndexEnv()
  const configuredOwnerIndex = ownerIndexRaw ? Number(ownerIndexRaw) : Number.NaN
  const ownerContext = mode.execute
    ? await resolvePrivyCoinbaseSmartWalletOwnerContext({
        publicClient,
        walletId,
        smartWallet,
        expectedOwnerAddress: null,
        configuredOwnerIndex: Number.isFinite(configuredOwnerIndex) ? configuredOwnerIndex : null,
        allowConfiguredOwnerIndexFallback: true,
        maxScan: 512,
      })
    : null

  const snapshot = async () => {
    const asset = await publicClient.readContract({ address: vault, abi: VAULT_ABI, functionName: 'asset' })
    const [totalAssets, totalDebt, ajnaDebt, charmDebt, minimumTotalIdle, isShutdown, vaultAssetBal, recipientBal] =
      await Promise.all([
        publicClient.readContract({ address: vault, abi: VAULT_ABI, functionName: 'totalAssets' }),
        publicClient.readContract({ address: vault, abi: VAULT_ABI, functionName: 'totalDebt' }),
        publicClient.readContract({
          address: vault,
          abi: VAULT_ABI,
          functionName: 'strategyDebt',
          args: [AJNA],
        }),
        publicClient.readContract({
          address: vault,
          abi: VAULT_ABI,
          functionName: 'strategyDebt',
          args: [CHARM],
        }),
        publicClient.readContract({ address: vault, abi: VAULT_ABI, functionName: 'minimumTotalIdle' }),
        publicClient.readContract({ address: vault, abi: VAULT_ABI, functionName: 'isShutdown' }),
        publicClient.readContract({
          address: asset,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [vault],
        }),
        publicClient.readContract({
          address: asset,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [recipient],
        }),
      ])
    return {
      asset,
      totalAssets: totalAssets.toString(),
      totalDebt: totalDebt.toString(),
      ajnaDebt: ajnaDebt.toString(),
      charmDebt: charmDebt.toString(),
      minimumTotalIdle: minimumTotalIdle.toString(),
      isShutdown,
      vaultAssetBal: vaultAssetBal.toString(),
      recipientBal: recipientBal.toString(),
    }
  }

  const before = await snapshot()
  const plan: string[] = []
  const results: Array<{ step: string; txHash?: Hex; userOpHash?: Hex; skipped?: string }> = []
  let unwindVerification: {
    complete: boolean
    totalDebt: string
    ajnaAdapterAssets: string | null
    remainingAjnaBuckets: Array<{ bucket: string; lp: string }>
    error: string | null
  } | null = null
  let ajnaReadinessError: string | null = null

  const runCall = async (label: string, data: Hex, callGasLimit = 2_000_000n) => {
    plan.push(label)
    if (mode.dryRun || !mode.execute) {
      if (!noSimulate) {
        await publicClient.call({ account: smartWallet, to: vault, data, gas: callGasLimit })
      }
      results.push({ step: label, skipped: mode.dryRun ? 'dry_run' : 'execute_required' })
      return
    }

    if (!ownerContext) throw new Error('owner context missing for execute')

    if (!noSimulate) {
      await publicClient.call({ account: smartWallet, to: vault, data, gas: callGasLimit })
    }

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
      calls: [{ to: vault, data, value: 0n }],
      callGasLimit,
      paymaster: {
        getPaymasterData: paymasterClient.getPaymasterData,
        getPaymasterStubData: paymasterClient.getPaymasterStubData,
      },
    })) as Hex

    const userOpReceipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
      timeout: 180_000,
    })
    assertSuccessfulUserOperationReceipt(userOpReceipt, label)
    const txHash = userOpReceipt.receipt.transactionHash as Hex
    const txReceipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 180_000 })
    if (txReceipt.status !== 'success') throw new Error(`UserOp reverted (${label}): ${txHash}`)
    results.push({ step: label, txHash, userOpHash })
  }

  const want = (name: string) => step === 'all' || step === name
  const skipAjnaBuffer = hasFlag('--skip-ajna-buffer')
  let ajnaReadiness: Awaited<ReturnType<typeof ensureAjnaEmergencyReadiness>> | null = null

  if (!skipAjnaBuffer && (want('ajna-buffer') || want('strategies') || step === 'all')) {
    try {
      ajnaReadiness = await ensureAjnaEmergencyReadiness({
        publicClient: publicClient as never,
        rpcUrl: rpc,
        vault,
        dryRun: mode.dryRun || !mode.execute,
        drainBuckets: true,
      })
      plan.push('ensureAjnaEmergencyReadiness')
    } catch (error) {
      const message = String((error as Error)?.message ?? error)
      if (message.includes('ajna_sleeve_not_found') && BigInt(before.ajnaDebt) === 0n) {
        plan.push('ensureAjnaEmergencyReadiness:skipped_no_sleeve')
      } else if (step === 'ajna-buffer') {
        throw error
      } else {
        ajnaReadinessError = message
        plan.push(`ensureAjnaEmergencyReadiness:failed:${message}`)
      }
    }
  }

  if (want('strategies')) {
    await runCall(
      'emergencyWithdrawFromStrategies',
      encodeFunctionData({ abi: VAULT_ABI, functionName: 'emergencyWithdrawFromStrategies' }),
      10_000_000n,
    )
  }

  if (want('idle')) {
    const mid = await snapshot()
    if (BigInt(mid.minimumTotalIdle) === 0n) {
      results.push({ step: 'setMinimumTotalIdle(0)', skipped: 'already_zero' })
    } else {
      await runCall(
        'setMinimumTotalIdle(0)',
        encodeFunctionData({ abi: VAULT_ABI, functionName: 'setMinimumTotalIdle', args: [0n] }),
      )
    }
  }

  if (want('shutdown')) {
    const mid = await snapshot()
    if (mid.isShutdown) {
      results.push({ step: 'shutdownVault', skipped: 'already_shutdown' })
    } else {
      await runCall(
        'shutdownVault',
        encodeFunctionData({ abi: VAULT_ABI, functionName: 'shutdownVault' }),
      )
    }
  }

  if (want('drain')) {
    const mid = await snapshot()
    if (!mid.isShutdown && mode.execute && !mode.dryRun) {
      throw new Error('Vault not shutdown; run --step shutdown first')
    }
    const amount = BigInt(mid.vaultAssetBal)
    if (amount === 0n) {
      results.push({ step: 'emergencyWithdraw', skipped: 'no_idle_balance' })
    } else if (!mid.isShutdown && (mode.dryRun || !mode.execute)) {
      plan.push(`emergencyWithdraw(${amount}, ${recipient}) [blocked: vault_not_shutdown]`)
      results.push({ step: `emergencyWithdraw(${amount}, ${recipient})`, skipped: 'vault_not_shutdown' })
    } else {
      await runCall(
        `emergencyWithdraw(${amount}, ${recipient})`,
        encodeFunctionData({
          abi: VAULT_ABI,
          functionName: 'emergencyWithdraw',
          args: [amount, recipient],
        }),
      )
    }
  }

  const after = mode.execute && !mode.dryRun ? await snapshot() : before
  if (mode.execute && !mode.dryRun && want('strategies')) {
    let ajnaAdapterAssets: bigint | null = null
    let remainingAjnaBuckets: Array<{ bucket: bigint; lp: bigint }> = []
    let verificationError: string | null = null
    try {
      const adapter = ajnaReadiness?.adapter ?? AJNA
      const innerVault =
        ajnaReadiness?.innerVault ??
        getAddress(
          await publicClient.readContract({
            address: adapter,
            abi: STRATEGY_ABI,
            functionName: 'ERC4626_VAULT',
          }),
        )
      ajnaAdapterAssets = await publicClient.readContract({
        address: adapter,
        abi: STRATEGY_ABI,
        functionName: 'getTotalAssets',
      })
      remainingAjnaBuckets = await readAjnaTrackedBucketLp({
        publicClient: publicClient as never,
        innerVault,
      })
    } catch (error) {
      verificationError = String((error as Error)?.message ?? error)
    }
    const complete = evaluateUnwindCompletion({
      totalDebt: BigInt(after.totalDebt),
      ajnaAdapterAssets,
      ajnaBucketLp: remainingAjnaBuckets.map(({ lp }) => lp),
      verificationError,
    })
    unwindVerification = {
      complete,
      totalDebt: after.totalDebt,
      ajnaAdapterAssets: ajnaAdapterAssets?.toString() ?? null,
      remainingAjnaBuckets: remainingAjnaBuckets.map(({ bucket, lp }) => ({
        bucket: bucket.toString(),
        lp: lp.toString(),
      })),
      error: verificationError,
    }
    results.push({
      step: 'verifyStrategyUnwind',
      ...(complete ? null : { skipped: 'residual_strategy_position' }),
    })
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: unwindVerification?.complete ?? true,
        mode: mode.execute && !mode.dryRun ? 'EXECUTE' : 'DRY_RUN',
        vault,
        recipient,
        recipientIsCanonicalCsw: recipient === smartWallet,
        step,
        noSimulate,
        plan,
        before,
        after,
        ajnaReadiness,
        ajnaReadinessError,
        unwindVerification,
        results,
      },
      null,
      2,
    )}\n`,
  )
  if (unwindVerification && !unwindVerification.complete) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  const err = error as Error & { causeMessage?: string; cause?: unknown }
  console.error(err?.message ?? error)
  if (err?.causeMessage) console.error('causeMessage=', err.causeMessage)
  if (err?.cause) console.error('cause=', err.cause)
  process.exit(1)
})
