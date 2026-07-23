/**
 * Phase 0/1 lottery canary probe (read-only).
 * Usage: pnpm -C frontend exec tsx --env-file=.env scripts/ops/verify-lottery-canary-phase0.ts
 */
import { createPublicClient, http, getAddress, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'
import {
  verifyLotteryProductionReadiness,
  readLotteryBoostTimelockArmed,
} from '../../server/_lib/lottery/lotteryProductionReadiness.ts'
import { evaluateLotteryCanarySafety } from '../../server/_lib/lottery/lotteryCanarySafety.ts'

const LM_ABI = [
  { type: 'function', name: 'boostManager', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  // On-chain storage getter is `ve4626GaugeVoting` (LotteryManager4626); product contract is ve4626GaugeVoting.
  { type: 'function', name: 've4626GaugeVoting', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'oracleMaxStaleness', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function',
    name: 'oracleMaxDeviationBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'oracleDeviationWindow',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  { type: 'function', name: 'paused', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  {
    type: 'function',
    name: 'lotteryConfig',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'bool' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'singleVaultJackpotOnly',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'deferredVrfQueueLength',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

async function tryRead<T>(label: string, fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await fn() }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 160) : String(e).slice(0, 160) }
  }
}

async function main() {
  const rpc = process.env.BASE_RPC_URL
  if (!rpc) throw new Error('BASE_RPC_URL required')
  const lm = getAddress((process.env.LOTTERY_MANAGER || '0xB45E68a5867935a5734E4185977F81c528006650') as Address)
  const client = createPublicClient({ chain: base, transport: http(rpc) })

  const read = (functionName: string) =>
    client.readContract({ address: lm, abi: LM_ABI, functionName: functionName as never })

  const boostManager = await tryRead('boostManager', () => read('boostManager'))
  const vaultGauge = await tryRead('ve4626GaugeVoting', () => read('ve4626GaugeVoting'))
  const singleVault = await tryRead('singleVaultJackpotOnly', () => read('singleVaultJackpotOnly'))
  const deferred = await tryRead('deferredVrfQueueLength', () => read('deferredVrfQueueLength'))
  const staleness = await tryRead('oracleMaxStaleness', () => read('oracleMaxStaleness'))
  const maxDev = await tryRead('oracleMaxDeviationBps', () => read('oracleMaxDeviationBps'))
  const window = await tryRead('oracleDeviationWindow', () => read('oracleDeviationWindow'))
  const paused = await tryRead('paused', () => read('paused'))
  const config = await tryRead('lotteryConfig', () => read('lotteryConfig'))
  const timelockArmed = await tryRead('boostTimelockArmed(slot)', () =>
    readLotteryBoostTimelockArmed(client as never, lm),
  )

  const readiness = await verifyLotteryProductionReadiness({
    publicClient: client as never,
    lotteryManager: lm,
    requireBoostTimelockArmed: false,
  })

  const zero = '0x0000000000000000000000000000000000000000'
  const canarySafety = evaluateLotteryCanarySafety({
    singleVaultReadOk: singleVault.ok,
    singleVaultJackpotOnly: singleVault.ok ? singleVault.value : null,
    deferredQueueReadOk: deferred.ok,
    deferredVrfQueueLength: deferred.ok ? deferred.value : null,
  })
  const phase0 = {
    boostManagerZero: boostManager.ok && String(boostManager.value).toLowerCase() === zero,
    vaultGaugeZero: vaultGauge.ok && String(vaultGauge.value).toLowerCase() === zero,
    singleVaultPresent: singleVault.ok,
    deferredPresent: deferred.ok,
    singleVaultEnabled: canarySafety.singleVaultEnabled,
    deferredQueueEmpty: canarySafety.deferredQueueEmpty,
    oracleGuards:
      staleness.ok &&
      maxDev.ok &&
      window.ok &&
      Number(staleness.value) > 0 &&
      Number(maxDev.value) > 0 &&
      Number(window.value) > 0,
  }

  const report = {
    at: new Date().toISOString(),
    lotteryManager: lm,
    phase0,
    reads: {
      boostManager,
      vaultGauge,
      singleVault,
      deferred,
      staleness,
      maxDev,
      window,
      paused,
      lotteryConfig: config.ok
        ? {
            minSwapAmount: String((config.value as Hex[])[0]),
            rewardPercentage: String((config.value as unknown as bigint[])[1]),
            isActive: Boolean((config.value as unknown as unknown[])[2]),
            baseWinChance: String((config.value as unknown as bigint[])[3]),
            maxWinChance: String((config.value as unknown as bigint[])[4]),
            usdMultiplierBps: String((config.value as unknown as bigint[])[5]),
          }
        : config,
      timelockArmed,
    },
    readiness,
    env: {
      DEPLOY_ENFORCE_PHASE2_INVARIANTS: process.env.DEPLOY_ENFORCE_PHASE2_INVARIANTS ?? 'UNSET',
      KEEPER_ENFORCE_COMPLETION_INVARIANTS: process.env.KEEPER_ENFORCE_COMPLETION_INVARIANTS ?? 'UNSET',
      SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED:
        process.env.SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED ?? 'UNSET',
      X402_RELAYER_PRIVATE_KEY: process.env.X402_RELAYER_PRIVATE_KEY ? 'set' : 'UNSET',
    },
    verdict: {
      phase0BoostOff: phase0.boostManagerZero && phase0.vaultGaugeZero,
      remediationBytecode: phase0.singleVaultPresent && phase0.deferredPresent,
      readyForBaseOddsCanary:
        phase0.boostManagerZero &&
        phase0.vaultGaugeZero &&
        phase0.oracleGuards &&
        canarySafety.safe &&
        readiness.violations.filter((v) => v.severity === 'critical').length === 0,
      blocker: canarySafety.blocker,
    },
  }

  console.log(
    JSON.stringify(report, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2),
  )
  if (report.verdict.blocker) process.exitCode = 2
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
