import { decodeFunctionResult, zeroAddress } from 'viem';
import { requireEnv } from '../config.js';
import { readContract } from '../utils/onchain.js';
import {
  createAiFallbackResult,
  normalizeAiResult,
  sanitizeAlertsForAi,
  type PayoutIntegrityAlertLike,
  type PayoutIntegrityAiResult,
} from '../utils/payoutIntegrityAi.js';
import { selectRotatingItems } from '../utils/rotation.js';
import { GaugeControllerABI } from '../kpr-workflows/contracts/abi/GaugeController.js';
import { BurnStreamABI } from '../kpr-workflows/contracts/abi/BurnStream.js';
import { CreatorCoinABI } from '../kpr-workflows/contracts/abi/CreatorCoin.js';
import { ShareOFTABI } from '../kpr-workflows/contracts/abi/ShareOFT.js';
import { PayoutRouterABI } from '../kpr-workflows/contracts/abi/PayoutRouter.js';
import { ERC20ABI } from '../kpr-workflows/contracts/abi/ERC20.js';

type VaultInfo = {
  vaultAddress: `0x${string}`;
  chainId: number;
  creatorCoinAddress: `0x${string}`;
  shareTokenAddress?: `0x${string}`;
  gaugeControllerAddress?: `0x${string}`;
  burnStreamAddress?: `0x${string}`;
  payoutRouterAddress?: `0x${string}`;
  groupId: string;
};

type AlertInfo = {
  vaultAddress: string;
  alertType: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  details: Record<string, unknown>;
};

type AiAssessmentRequest = {
  vaultAddress: string;
  checksRun: number;
  alerts: PayoutIntegrityAlertLike[];
};

export type PayoutIntegrityMonitorResult = {
  vaultAddress: string;
  checksRun: number;
  alertsSent: number;
  alerts: string[];
  aiEnabled: boolean;
  aiVerdict: string;
  aiConfidence: number;
  aiSummary: string;
  aiSuggestedAction: string;
  aiProvider?: string;
  error: string;
};

type MonitorConfig = {
  apiBaseUrl: string;
  apiKey: string;
  chainId: number;
  expectedBurnShareBps: number;
  expectedLotteryShareBps: number;
  expectedCreatorShareBps: number;
  expectedProtocolShareBps: number;
  staleThresholdSeconds: number;
  rotationIntervalSeconds: number;
  expectedPayoutRecipientMode: 'gauge' | 'payout_router';
  expectedPayoutRecipient?: string;
  expectedTradeFeeCollector?: string;
  enforceTradeFeeCollectorAlignment: boolean;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'no') return false;
  return fallback;
}

function resolveExpectedPayoutRouterKeeper(): string | undefined {
  for (const candidate of [
    process.env.PAYOUT_ROUTER_KEEPER,
    process.env.KPR_KEEPER_ADDRESS,
    process.env.KPR_ADDRESS,
  ]) {
    const trimmed = candidate?.trim();
    if (trimmed && trimmed.startsWith('0x') && trimmed.length === 42) {
      return trimmed.toLowerCase();
    }
  }
  return undefined;
}

function loadMonitorConfig(): MonitorConfig {
  const apiBaseUrl = String(process.env.KPR_API_BASE_URL ?? 'https://4626.fun/api').replace(/\/$/, '');
  const apiKey = requireEnv('KPR_API_KEY');
  return {
    apiBaseUrl,
    apiKey,
    chainId: parsePositiveInt(process.env.CHAIN_ID, 8453),
    expectedBurnShareBps: parsePositiveInt(process.env.PAYOUT_EXPECTED_BURN_SHARE_BPS, 3000),
    expectedLotteryShareBps: parsePositiveInt(process.env.PAYOUT_EXPECTED_LOTTERY_SHARE_BPS, 1000),
    expectedCreatorShareBps: parsePositiveInt(process.env.PAYOUT_EXPECTED_CREATOR_SHARE_BPS, 0),
    expectedProtocolShareBps: parsePositiveInt(process.env.PAYOUT_EXPECTED_PROTOCOL_SHARE_BPS, 6000),
    staleThresholdSeconds: parsePositiveInt(process.env.PAYOUT_STALE_THRESHOLD_SECONDS, 7200),
    rotationIntervalSeconds: parsePositiveInt(process.env.PAYOUT_ROTATION_INTERVAL_SECONDS, 1800),
    expectedPayoutRecipientMode:
      String(process.env.PAYOUT_EXPECTED_PAYOUT_RECIPIENT_MODE ?? 'gauge').trim().toLowerCase() === 'payout_router'
        ? 'payout_router'
        : 'gauge',
    expectedPayoutRecipient: process.env.PAYOUT_EXPECTED_PAYOUT_RECIPIENT?.trim() || undefined,
    expectedTradeFeeCollector: process.env.PAYOUT_EXPECTED_TRADE_FEE_COLLECTOR?.trim() || undefined,
    enforceTradeFeeCollectorAlignment: parseBool(process.env.PAYOUT_ENFORCE_TRADE_FEE_ALIGNMENT, true),
  };
}

async function fetchVaults(config: MonitorConfig): Promise<VaultInfo[]> {
  const response = await fetch(`${config.apiBaseUrl}/vaults/active?chainId=${config.chainId}`, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: { vaults?: VaultInfo[] } }
    | null;
  if (!response.ok || !body?.success) return [];
  return Array.isArray(body.data?.vaults) ? body.data.vaults : [];
}

async function sendAlert(config: MonitorConfig, alert: AlertInfo): Promise<boolean> {
  const response = await fetch(`${config.apiBaseUrl}/keeper/alert`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(alert),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json().catch(() => null)) as { success?: boolean } | null;
  return Boolean(response.ok && body?.success);
}

async function requestAiAssessment(
  config: MonitorConfig,
  request: AiAssessmentRequest,
): Promise<PayoutIntegrityAiResult> {
  const sanitizedRequest: AiAssessmentRequest = {
    vaultAddress: request.vaultAddress,
    checksRun: request.checksRun,
    alerts: sanitizeAlertsForAi(request.alerts) as PayoutIntegrityAlertLike[],
  };
  const response = await fetch(`${config.apiBaseUrl}/keeper/aiAssess`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sanitizedRequest),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: unknown; error?: string }
    | null;
  if (!response.ok || !body?.success || !body.data) {
    return createAiFallbackResult(request.alerts, body?.error ?? 'ai_assessment_failed');
  }
  return normalizeAiResult(body.data, request.alerts);
}

function formatAlert(alert: AlertInfo): string {
  return `[${alert.severity}] ${alert.alertType}: ${alert.message}`;
}

async function readAddress(address: `0x${string}`, abi: unknown, fn: string, args?: readonly unknown[]): Promise<string> {
  return (await readContract<string>({ address, abi: abi as never, functionName: fn, args })) as string;
}

async function readBigInt(address: `0x${string}`, abi: unknown, fn: string, args?: readonly unknown[]): Promise<bigint> {
  return (await readContract<bigint>({ address, abi: abi as never, functionName: fn, args })) as bigint;
}

export async function executePayoutIntegrityMonitor(): Promise<PayoutIntegrityMonitorResult> {
  const config = loadMonitorConfig();
  const emptyAi = createAiFallbackResult([]);
  const vaults = (await fetchVaults(config))
    .filter((v) => v.gaugeControllerAddress)
    .sort((a, b) => a.vaultAddress.localeCompare(b.vaultAddress));
  const selected = selectRotatingItems(vaults, {
    now: new Date(),
    rotationIntervalSeconds: config.rotationIntervalSeconds,
    maxItems: 1,
  })[0];

  if (!selected?.gaugeControllerAddress) {
    return {
      vaultAddress: '',
      checksRun: 0,
      alertsSent: 0,
      alerts: [],
      aiEnabled: emptyAi.enabled,
      aiVerdict: emptyAi.verdict,
      aiConfidence: emptyAi.confidence ?? -1,
      aiSummary: emptyAi.summary,
      aiSuggestedAction: emptyAi.suggestedAction,
      ...(emptyAi.provider ? { aiProvider: emptyAi.provider } : {}),
      error: '',
    };
  }

  const gaugeAddr = selected.gaugeControllerAddress;
  const vaultAddr = selected.vaultAddress;
  const coinAddr = selected.creatorCoinAddress;
  const shareTokenAddr = selected.shareTokenAddress;
  const burnStreamAddr = selected.burnStreamAddress;
  const pendingAlerts: AlertInfo[] = [];
  let checksRun = 0;

  try {
    const payoutRecipient = (await readAddress(coinAddr, CreatorCoinABI, 'payoutRecipient')).toLowerCase();
    checksRun += 1;
    const mode = config.expectedPayoutRecipientMode;
    const modeExpected =
      mode === 'payout_router' ? selected.payoutRouterAddress?.toLowerCase() : gaugeAddr.toLowerCase();
    const expected = config.expectedPayoutRecipient?.toLowerCase() ?? modeExpected;
    if (!expected || payoutRecipient !== expected) {
      pendingAlerts.push({
        vaultAddress: vaultAddr,
        alertType: 'creator_coin_payout_recipient_mismatch',
        severity: 'critical',
        message: `Creator coin creatorCoinPayoutRecipient (external earnings lane) (${payoutRecipient}) != expected (${expected ?? 'unset'})`,
        details: { mode, payoutRecipient, expected: expected ?? null },
      });
    }
  } catch {
    // keep collecting other checks
  }

  if (config.enforceTradeFeeCollectorAlignment && shareTokenAddr) {
    try {
      const collector = (await readAddress(shareTokenAddr, ShareOFTABI, 'gaugeController')).toLowerCase();
      checksRun += 1;
      const expected = (config.expectedTradeFeeCollector ?? gaugeAddr).toLowerCase();
      if (collector !== expected) {
        pendingAlerts.push({
          vaultAddress: vaultAddr,
          alertType: 'trade_fee_collector_mismatch',
          severity: 'critical',
          message: `ShareOFT tradeFeeCollector (${collector}) != expected (${expected})`,
          details: { shareTokenAddress: shareTokenAddr, collector, expected },
        });
      }
    } catch {
      // noop
    }
  }

  try {
    const burnBps = Number(await readBigInt(gaugeAddr, GaugeControllerABI, 'burnShareBps'));
    const lotteryBps = Number(await readBigInt(gaugeAddr, GaugeControllerABI, 'lotteryShareBps'));
    const creatorBps = Number(await readBigInt(gaugeAddr, GaugeControllerABI, 'creatorShareBps'));
    const protocolBps = Number(await readBigInt(gaugeAddr, GaugeControllerABI, 'protocolShareBps'));
    const creatorTreasury = (await readAddress(gaugeAddr, GaugeControllerABI, 'creatorTreasury')).toLowerCase();
    checksRun += 1;
    const total = burnBps + lotteryBps + creatorBps + protocolBps;
    if (total !== 10000) {
      pendingAlerts.push({
        vaultAddress: vaultAddr,
        alertType: 'bps_sum_invalid',
        severity: 'critical',
        message: `GaugeController BPS sum is ${total}, expected 10000`,
        details: { burnBps, lotteryBps, creatorBps, protocolBps, total },
      });
    }
    if (
      burnBps !== config.expectedBurnShareBps ||
      lotteryBps !== config.expectedLotteryShareBps ||
      creatorBps !== config.expectedCreatorShareBps ||
      protocolBps !== config.expectedProtocolShareBps
    ) {
      pendingAlerts.push({
        vaultAddress: vaultAddr,
        alertType: 'bps_config_changed',
        severity: 'warning',
        message: 'GaugeController BPS config differs from expected values',
        details: {
          actual: { burnBps, lotteryBps, creatorBps, protocolBps },
          expected: {
            burnBps: config.expectedBurnShareBps,
            lotteryBps: config.expectedLotteryShareBps,
            creatorBps: config.expectedCreatorShareBps,
            protocolBps: config.expectedProtocolShareBps,
          },
        },
      });
    }
    if (creatorBps > 0 && creatorTreasury === zeroAddress) {
      pendingAlerts.push({
        vaultAddress: vaultAddr,
        alertType: 'creator_treasury_missing',
        severity: 'critical',
        message: `creatorShareBps is ${creatorBps} but creatorTreasury is zero`,
        details: { creatorBps, creatorTreasury },
      });
    }
  } catch {
    // noop
  }

  if (burnStreamAddr) {
    try {
      const activeShares = await readBigInt(burnStreamAddr, BurnStreamABI, 'activeShares');
      const activeEpochStart = Number(await readBigInt(burnStreamAddr, BurnStreamABI, 'activeEpochStart'));
      checksRun += 1;
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (activeShares > 0n && activeEpochStart > 0 && nowSeconds - activeEpochStart > config.staleThresholdSeconds) {
        pendingAlerts.push({
          vaultAddress: vaultAddr,
          alertType: 'burn_stream_stale',
          severity: 'warning',
          message: `Burn stream has active shares but epoch started ${nowSeconds - activeEpochStart}s ago`,
          details: { activeShares: activeShares.toString(), activeEpochStart },
        });
      }
    } catch {
      // noop
    }
  }

  if (selected.payoutRouterAddress) {
    const payoutRouterAddr = selected.payoutRouterAddress;
    try {
      const routerBurnStream = (await readAddress(payoutRouterAddr, PayoutRouterABI, 'burnStream')).toLowerCase();
      checksRun += 1;
      const expectedBurn = burnStreamAddr?.toLowerCase();
      if (!expectedBurn || routerBurnStream !== expectedBurn) {
        pendingAlerts.push({
          vaultAddress: vaultAddr,
          alertType: 'payout_router_burn_stream_mismatch',
          severity: 'critical',
          message: `PayoutRouter.burnStream (${routerBurnStream}) != registry burnStream (${expectedBurn ?? 'unset'})`,
          details: { payoutRouterAddress: payoutRouterAddr, routerBurnStream, expectedBurnStream: expectedBurn ?? null },
        });
      }
    } catch {
      // noop
    }

    try {
      const routerKeeper = (await readAddress(payoutRouterAddr, PayoutRouterABI, 'keeper')).toLowerCase();
      checksRun += 1;
      const expectedKeeper = resolveExpectedPayoutRouterKeeper();
      if (routerKeeper === zeroAddress) {
        pendingAlerts.push({
          vaultAddress: vaultAddr,
          alertType: 'payout_router_keeper_unset',
          severity: 'warning',
          message: 'PayoutRouter keeper is unset; harvest automation cannot run convertAndQueue',
          details: { payoutRouterAddress: payoutRouterAddr, expectedKeeper: expectedKeeper ?? null },
        });
      } else if (expectedKeeper && routerKeeper !== expectedKeeper) {
        pendingAlerts.push({
          vaultAddress: vaultAddr,
          alertType: 'payout_router_keeper_mismatch',
          severity: 'critical',
          message: `PayoutRouter.keeper (${routerKeeper}) != expected keeper (${expectedKeeper})`,
          details: { payoutRouterAddress: payoutRouterAddr, routerKeeper, expectedKeeper },
        });
      }
    } catch {
      // noop
    }

    if (burnStreamAddr) {
      try {
        const queuerAuthorized = await readContract<boolean>({
          address: burnStreamAddr,
          abi: BurnStreamABI,
          functionName: 'authorizedQueuers',
          args: [payoutRouterAddr],
        });
        checksRun += 1;
        if (!queuerAuthorized) {
          pendingAlerts.push({
            vaultAddress: vaultAddr,
            alertType: 'payout_router_queuer_unauthorized',
            severity: 'critical',
            message: 'PayoutRouter is not authorized to queue shares on VaultShareBurnStream',
            details: { payoutRouterAddress: payoutRouterAddr, burnStreamAddress: burnStreamAddr },
          });
        }
      } catch {
        // noop
      }
    }
  }

  try {
    const gaugeBalance = await readBigInt(vaultAddr, ERC20ABI, 'balanceOf', [gaugeAddr]);
    const lastDistribution = Number(await readBigInt(gaugeAddr, GaugeControllerABI, 'lastDistribution'));
    checksRun += 1;
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (gaugeBalance > 0n && lastDistribution > 0 && nowSeconds - lastDistribution > config.staleThresholdSeconds) {
      pendingAlerts.push({
        vaultAddress: vaultAddr,
        alertType: 'gauge_distribution_stale',
        severity: 'warning',
        message: `GaugeController holds ${gaugeBalance.toString()} vault shares but lastDistribution was ${nowSeconds - lastDistribution}s ago`,
        details: { gaugeBalance: gaugeBalance.toString(), lastDistribution },
      });
    }
  } catch {
    // noop
  }

  const aiAssessment = await requestAiAssessment(config, {
    vaultAddress: vaultAddr,
    checksRun,
    alerts: pendingAlerts,
  }).then((result) => ({
    enabled: result.enabled,
    verdict: result.verdict,
    confidence: result.confidence ?? -1,
    summary: result.summary,
    suggestedAction: result.suggestedAction,
    provider: result.provider,
  }));

  let alertsSent = 0;
  for (const alert of pendingAlerts) {
    if (await sendAlert(config, alert)) alertsSent += 1;
  }

  return {
    vaultAddress: vaultAddr,
    checksRun,
    alertsSent,
    alerts: pendingAlerts.map(formatAlert),
    aiEnabled: aiAssessment.enabled,
    aiVerdict: aiAssessment.verdict,
    aiConfidence: aiAssessment.confidence,
    aiSummary: aiAssessment.summary,
    aiSuggestedAction: aiAssessment.suggestedAction,
    ...(aiAssessment.provider ? { aiProvider: aiAssessment.provider } : {}),
    error: '',
  };
}
