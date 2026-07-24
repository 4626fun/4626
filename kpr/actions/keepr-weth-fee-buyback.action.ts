/**
 * Keepr Base WETH→■ buyback via gauge.processWETHFeesWithRoute.
 *
 * Offchain quote builds router calldata (Universal Router / aggregator).
 * Submit privately (builder/relay) — do not public-broadcast large batches.
 *
 * Required env:
 *   KPR_WETH_BUYBACK_GAUGE — Creator/Agent gauge address
 *   KPR_WETH_BUYBACK_ROUTER — allowlisted router
 *   KPR_WETH_BUYBACK_CALLDATA — 0x-prefixed swap calldata (recipient = gauge)
 *   KPR_WETH_BUYBACK_AMOUNT — WETH amount (wei)
 *   KPR_WETH_BUYBACK_MIN_OUT — min ShareOFT out (quote floor)
 */

import { getAddress, isAddress, type Address, type Hex } from 'viem';
import { alertCritical, alertInfo, alertWarning } from '../utils/alerts.js';
import { isDryRun, writeContract } from '../utils/onchain.js';

const WORKFLOW_NAME = 'keepr-weth-fee-buyback';

const ProcessWethFeesWithRouteABI = [
  {
    type: 'function',
    name: 'processWETHFeesWithRoute',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'wethAmount', type: 'uint256' },
      { name: 'router', type: 'address' },
      { name: 'swapCalldata', type: 'bytes' },
      { name: 'minShareOftOut', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

export type WethFeeBuybackResult = {
  gauge: string;
  router: string;
  wethAmount: string;
  minShareOftOut: string;
  txHash?: string;
  skippedReason?: string;
};

function requireEnv(name: string): string {
  const value = String(process.env[name] ?? '').trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export async function executeWethFeeBuyback(): Promise<WethFeeBuybackResult> {
  const gaugeRaw = requireEnv('KPR_WETH_BUYBACK_GAUGE');
  const routerRaw = requireEnv('KPR_WETH_BUYBACK_ROUTER');
  const calldata = requireEnv('KPR_WETH_BUYBACK_CALLDATA') as Hex;
  const wethAmount = BigInt(requireEnv('KPR_WETH_BUYBACK_AMOUNT'));
  const minShareOftOut = BigInt(requireEnv('KPR_WETH_BUYBACK_MIN_OUT'));

  if (!isAddress(gaugeRaw) || !isAddress(routerRaw)) {
    throw new Error('invalid_weth_buyback_addresses');
  }
  if (!calldata.startsWith('0x') || calldata.length < 10) {
    throw new Error('invalid_weth_buyback_calldata');
  }
  if (wethAmount <= 0n) {
    throw new Error('weth_buyback_amount_zero');
  }

  const gauge = getAddress(gaugeRaw) as Address;
  const router = getAddress(routerRaw) as Address;

  const result: WethFeeBuybackResult = {
    gauge,
    router,
    wethAmount: wethAmount.toString(),
    minShareOftOut: minShareOftOut.toString(),
  };

  if (isDryRun()) {
    result.skippedReason = 'dry_run';
    await alertInfo(WORKFLOW_NAME, 'Dry run — WETH buyback skipped');
    return result;
  }

  try {
    const write = await writeContract({
      address: gauge,
      abi: ProcessWethFeesWithRouteABI,
      functionName: 'processWETHFeesWithRoute',
      args: [wethAmount, router, calldata, minShareOftOut],
    });
    if (!write.success) {
      throw new Error(write.error ?? 'processWETHFeesWithRoute_failed');
    }
    result.txHash = write.txHash;
    await alertInfo(WORKFLOW_NAME, 'WETH→■ buyback submitted', {
      txHash: write.txHash,
      gauge,
      router,
      wethAmount: wethAmount.toString(),
    });
    if (!String(process.env.KPR_WETH_BUYBACK_PRIVATE_SUBMIT ?? '1').match(/^(0|false|no)$/i)) {
      await alertWarning(
        WORKFLOW_NAME,
        'Ensure this UserOp/tx was submitted via private relay (MEV). Public mempool broadcast is not recommended.',
      );
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await alertCritical(WORKFLOW_NAME, 'WETH→■ buyback failed', { error: message });
    throw error;
  }
}
