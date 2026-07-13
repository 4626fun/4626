/**
 * Keepr Remote ShareOFT Fee Flush
 *
 * The Privy server wallet calls flushFees on each spoke directly.
 *
 * Base leg: receiveBridgedFees() on gauge via ERC-4337 canonical CSW.
 */

import { getAddress, isAddress, type Address } from 'viem';
import {
  GaugeReceiveBridgedFeesABI,
  ShareOftFeeFlushABI,
} from '../kpr-workflows/contracts/abi/ShareOftFeeFlush.js';
import { alertInfo, alertWarning } from '../utils/alerts.js';
import { isDryRun, writeContract } from '../utils/onchain.js';
import {
  encodeContractCall,
  isRemoteShareOftFlushEnabled,
  parseRemoteShareOftFlushTargets,
  parseRemoteShareOftMapFallback,
  readRemoteContract,
  resolveHubGaugeController,
  sendRemotePayableTransaction,
  type RemoteShareOftFlushTarget,
} from '../utils/remoteFeeFlush.js';

const WORKFLOW_NAME = 'keepr-remote-fee-flush';

const BASE_SWEEP_DELAY_MS = Number(process.env.KPR_REMOTE_FEE_BASE_SWEEP_DELAY_MS ?? '15000');

type SendParam = {
  dstEid: number;
  to: `0x${string}`;
  amountLD: bigint;
  minAmountLD: bigint;
  extraOptions: `0x${string}`;
  composeMsg: `0x${string}`;
  oftCmd: `0x${string}`;
};

export type RemoteFeeFlushTargetResult = {
  label: string;
  chainId: number;
  lzEid: number;
  shareOft: string;
  pendingFees: string;
  flushThreshold: string;
  flushed: boolean;
  mode: 'hub' | 'spoke';
  flushTxHash?: string;
  skippedReason?: string;
  error?: string;
};

export type RemoteFeeFlushResult = {
  enabled: boolean;
  mode: 'hub' | 'spoke';
  targets: RemoteFeeFlushTargetResult[];
  hubGauge: string | null;
  receiveBridgedFeesCalled: boolean;
  receiveBridgedTxHash?: string;
  receiveBridgedError?: string;
};

function resolveFlushTargets(): RemoteShareOftFlushTarget[] {
  const primary = parseRemoteShareOftFlushTargets();
  if (primary.length > 0) return primary;
  return parseRemoteShareOftMapFallback();
}

async function readSpokePendingState(target: RemoteShareOftFlushTarget) {
  const pendingFees = await readRemoteContract<bigint>({
    chainId: target.chainId,
    rpcUrl: target.rpcUrl,
    address: target.shareOft,
    abi: ShareOftFeeFlushABI,
    functionName: 'pendingFees',
  });
  const flushThreshold = await readRemoteContract<bigint>({
    chainId: target.chainId,
    rpcUrl: target.rpcUrl,
    address: target.shareOft,
    abi: ShareOftFeeFlushABI,
    functionName: 'flushThreshold',
  });
  return { pendingFees, flushThreshold };
}

async function maybeFlushViaSpoke(target: RemoteShareOftFlushTarget): Promise<RemoteFeeFlushTargetResult> {
  const base: RemoteFeeFlushTargetResult = {
    label: target.label,
    chainId: target.chainId,
    lzEid: target.lzEid,
    shareOft: target.shareOft,
    pendingFees: '0',
    flushThreshold: '0',
    flushed: false,
    mode: 'spoke',
  };

  try {
    const isHub = await readRemoteContract<boolean>({
      chainId: target.chainId,
      rpcUrl: target.rpcUrl,
      address: target.shareOft,
      abi: ShareOftFeeFlushABI,
      functionName: 'isHub',
    });
    if (isHub) return { ...base, skippedReason: 'is_hub' };

    const { pendingFees, flushThreshold } = await readSpokePendingState(target);
    base.pendingFees = pendingFees.toString();
    base.flushThreshold = flushThreshold.toString();

    if (pendingFees === 0n) return { ...base, skippedReason: 'no_pending_fees' };
    if (pendingFees < flushThreshold) return { ...base, skippedReason: 'below_flush_threshold' };

    const nativeFee = await readRemoteContract<bigint>({
      chainId: target.chainId,
      rpcUrl: target.rpcUrl,
      address: target.shareOft,
      abi: ShareOftFeeFlushABI,
      functionName: 'quoteFlushFees',
    });
    if (nativeFee === 0n) return { ...base, skippedReason: 'zero_lz_quote' };

    const sendParam = await readRemoteContract<SendParam>({
      chainId: target.chainId,
      rpcUrl: target.rpcUrl,
      address: target.shareOft,
      abi: ShareOftFeeFlushABI,
      functionName: 'buildFlushSendParam',
    });

    const data = encodeContractCall({
      abi: ShareOftFeeFlushABI,
      functionName: 'flushFees',
      args: [sendParam, { nativeFee, lzTokenFee: 0n }],
    });

    const { txHash } = await sendRemotePayableTransaction({
      chainId: target.chainId,
      rpcUrl: target.rpcUrl,
      to: target.shareOft,
      data,
      value: nativeFee,
      dryRun: isDryRun(),
    });

    return { ...base, flushed: true, flushTxHash: txHash };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ...base, error: message };
  }
}

async function maybeReceiveBridgedFeesOnHub(gauge: Address): Promise<{
  called: boolean;
  txHash?: string;
  error?: string;
}> {
  try {
    if (BASE_SWEEP_DELAY_MS > 0 && !isDryRun()) {
      await new Promise((resolve) => setTimeout(resolve, BASE_SWEEP_DELAY_MS));
    }

    const result = await writeContract({
      address: gauge as `0x${string}`,
      abi: GaugeReceiveBridgedFeesABI,
      functionName: 'receiveBridgedFees',
    });

    if (!result.success) {
      return { called: true, error: result.error ?? 'receiveBridgedFees_failed' };
    }

    return { called: true, txHash: result.txHash };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { called: false, error: message };
  }
}

export async function executeRemoteShareOftFeeFlush(): Promise<RemoteFeeFlushResult> {
  const result: RemoteFeeFlushResult = {
    enabled: isRemoteShareOftFlushEnabled(),
    mode: 'spoke',
    targets: [],
    hubGauge: null,
    receiveBridgedFeesCalled: false,
  };

  if (!result.enabled) {
    await alertInfo(WORKFLOW_NAME, 'Remote ShareOFT fee flush disabled (KPR_REMOTE_SHARE_OFT_FLUSH_ENABLED!=1)');
    return result;
  }

  const hubGauge = resolveHubGaugeController();
  if (!hubGauge || !isAddress(hubGauge)) {
    await alertWarning(WORKFLOW_NAME, 'KPR_REMOTE_FEE_HUB_GAUGE unset — Base sweep will be skipped');
  } else {
    result.hubGauge = getAddress(hubGauge);
  }

  const targets = resolveFlushTargets();
  if (targets.length === 0) {
    await alertInfo(WORKFLOW_NAME, 'No REMOTE_SHARE_OFT_FLUSH_TARGETS configured');
    return result;
  }

  for (const target of targets) {
    const targetResult = await maybeFlushViaSpoke(target);
    result.targets.push(targetResult);
  }

  const anyFlushed = result.targets.some((target) => target.flushed);
  if (hubGauge && anyFlushed) {
    const sweep = await maybeReceiveBridgedFeesOnHub(getAddress(hubGauge));
    result.receiveBridgedFeesCalled = sweep.called;
    result.receiveBridgedTxHash = sweep.txHash;
    result.receiveBridgedError = sweep.error;
  }

  return result;
}
