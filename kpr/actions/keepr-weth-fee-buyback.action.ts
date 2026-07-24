/**
 * Keepr Base WETH→■ buyback via gauge.processWETHFeesWithRoute.
 *
 * Offchain quote builds router calldata (Universal Router / aggregator).
 * Short-TTL quote validation + private-submit confirmation (MEV).
 *
 * Required env: see utils/wethBuybackQuote.ts
 */

import { alertCritical, alertInfo } from '../utils/alerts.js';
import { isDryRun, writeContract } from '../utils/onchain.js';
import {
  assertWethBuybackPrivateSubmitReady,
  resolveWethBuybackRoute,
} from '../utils/wethBuybackQuote.js';

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
  quoteExpiresAtMs: number;
  txHash?: string;
  skippedReason?: string;
};

export async function executeWethFeeBuyback(): Promise<WethFeeBuybackResult> {
  const route = resolveWethBuybackRoute();

  const result: WethFeeBuybackResult = {
    gauge: route.gauge,
    router: route.router,
    wethAmount: route.wethAmount.toString(),
    minShareOftOut: route.minShareOftOut.toString(),
    quoteExpiresAtMs: route.quoteExpiresAtMs,
  };

  if (isDryRun()) {
    result.skippedReason = 'dry_run';
    await alertInfo(WORKFLOW_NAME, 'Dry run — WETH buyback skipped', {
      gauge: route.gauge,
      quoteExpiresAtMs: route.quoteExpiresAtMs,
    });
    return result;
  }

  assertWethBuybackPrivateSubmitReady();

  try {
    // Re-check TTL immediately before the effectful call.
    resolveWethBuybackRoute();

    const write = await writeContract({
      address: route.gauge as `0x${string}`,
      abi: ProcessWethFeesWithRouteABI,
      functionName: 'processWETHFeesWithRoute',
      args: [route.wethAmount, route.router, route.calldata, route.minShareOftOut],
    });
    if (!write.success) {
      throw new Error(write.error ?? 'processWETHFeesWithRoute_failed');
    }
    result.txHash = write.txHash;
    await alertInfo(WORKFLOW_NAME, 'WETH→■ buyback submitted', {
      txHash: write.txHash,
      gauge: route.gauge,
      router: route.router,
      wethAmount: route.wethAmount.toString(),
      minShareOftOut: route.minShareOftOut.toString(),
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await alertCritical(WORKFLOW_NAME, 'WETH→■ buyback failed', { error: message });
    throw error;
  }
}
