/**
 * Preflight checks for Solana keeper orchestrator config.
 *
 * Twin/SolanaBridgeAdapter Base writes are retired — bridging uses LayerZero
 * ShareOFT with per-token Registry4626 peers. This preflight validates
 * Solana-side keeper config only and fail-closes any Base adapter write lane.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import type { Address } from 'viem';

import { requireEnv, parseDotenvJsonObject } from '../config.js';
import { normalizeLotteryManager } from './solanaCanonicalAddresses.js';
import { solanaPubkeyToBytes32 } from './solana.js';

export const TWIN_ADAPTER_RETIRED_BLOCKER =
  'SolanaBridgeAdapter/Twin transport retired (LayerZero ShareOFT only); Base adapter writes unavailable';

export type KeeperBaseWritePreflight = {
  blockers: string[];
  warnings: string[];
  keeperPubkey: string;
  keeperBytes32: `0x${string}`;
  lotteryManager: Address | null;
  mintChecks: Array<{
    mint: string;
    shareOft: string | null;
    creatorConfigExists: boolean;
    pendingEntriesExists: boolean;
    pendingCount: number;
  }>;
};

export async function collectKeeperBaseWritePreflight(): Promise<KeeperBaseWritePreflight> {
  const blockers: string[] = [TWIN_ADAPTER_RETIRED_BLOCKER];
  const warnings: string[] = [];

  const keeperPubkey = requireEnv('SOLANA_KEEPER_PUBKEY');
  const keeperBytes32 = solanaPubkeyToBytes32(keeperPubkey);

  const lotteryManagerRaw = process.env.LOTTERY_MANAGER?.trim();
  const lotteryManager = lotteryManagerRaw
    ? (normalizeLotteryManager(lotteryManagerRaw) as Address)
    : null;
  if (!lotteryManager) {
    blockers.push('LOTTERY_MANAGER unset (required for winner-relay reads)');
  }

  if (process.env.SOLANA_KEEPER_BASE_WRITES_ENABLED === '1') {
    blockers.push(
      'SOLANA_KEEPER_BASE_WRITES_ENABLED=1 but Twin adapter is retired; disable Base write flag',
    );
  }

  const creatorMints = (process.env.SOLANA_CREATOR_MINTS ?? '').split(',').filter(Boolean);
  const shareOftMapping = parseDotenvJsonObject('SOLANA_SHARE_OFT_MAPPING');

  if (creatorMints.length === 0) {
    blockers.push('SOLANA_CREATOR_MINTS empty');
  }

  const solConn = new Connection(requireEnv('SOLANA_RPC_URL'), 'confirmed');
  const programId = new PublicKey(requireEnv('SOLANA_PROGRAM_ID'));
  const mintChecks: KeeperBaseWritePreflight['mintChecks'] = [];

  for (const mintStr of creatorMints) {
    const shareOft = shareOftMapping[mintStr] ?? null;
    const mint = new PublicKey(mintStr);
    const [pendingEntriesPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('pending_entries'), mint.toBuffer()],
      programId,
    );
    const [creatorConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('creator_config'), mint.toBuffer()],
      programId,
    );

    const [pendingInfo, configInfo] = await Promise.all([
      solConn.getAccountInfo(pendingEntriesPda),
      solConn.getAccountInfo(creatorConfigPda),
    ]);

    let pendingCount = 0;
    if (pendingInfo?.data) {
      const data = pendingInfo.data as Buffer;
      pendingCount = data.readUInt32LE(44);
    }

    mintChecks.push({
      mint: mintStr,
      shareOft,
      creatorConfigExists: Boolean(configInfo),
      pendingEntriesExists: Boolean(pendingInfo),
      pendingCount,
    });

    if (!shareOft) blockers.push(`missing SOLANA_SHARE_OFT_MAPPING for mint ${mintStr}`);
    if (!configInfo) {
      warnings.push(`CreatorConfig PDA missing for mint ${mintStr} (hook side not initialized)`);
    }
  }

  return {
    blockers,
    warnings,
    keeperPubkey,
    keeperBytes32,
    lotteryManager,
    mintChecks,
  };
}

export function formatKeeperPreflightSummary(preflight: KeeperBaseWritePreflight): string {
  if (preflight.blockers.length === 0) return 'ready';
  return preflight.blockers.join('; ');
}
