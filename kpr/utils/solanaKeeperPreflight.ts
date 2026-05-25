/**
 * Preflight checks for Solana keeper → Base adapter writes.
 *
 * Base-side relay/settle calls must originate from the keeper's deterministic
 * Twin (see SolanaBridgeAdapter.onlyTwin). Direct KPR EOA writes revert with
 * UnauthorizedTwin until a Solana→Base bridge attached-call path is used.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { createPublicClient, http, type Address } from 'viem';
import { base } from 'viem/chains';

import { requireEnv, parseDotenvJsonObject } from '../config.js';
import {
  CANONICAL_SOLANA_BRIDGE_ADAPTER,
  normalizeSolanaBridgeAdapter,
} from './solanaCanonicalAddresses.js';
import { solanaPubkeyToBytes32 } from './solana.js';

export const BASE_SOLANA_BRIDGE = '0x3eff766c76a1be2ce1acf2b69c78bcae257d5188' as const;

const bridgeViewAbi = [
  {
    type: 'function',
    name: 'getPredictedTwinAddress',
    inputs: [{ type: 'bytes32' }],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
] as const;

const adapterViewAbi = [
  {
    type: 'function',
    name: 'authorizedEntryKeepers',
    inputs: [{ type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'authorizedFeeKeepers',
    inputs: [{ type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'lotteryManager',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isRegistered',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
] as const;

export type KeeperBaseWritePreflight = {
  blockers: string[];
  warnings: string[];
  keeperPubkey: string;
  keeperBytes32: `0x${string}`;
  predictedTwin: Address;
  twinDeployed: boolean;
  authorizedEntryKeeper: boolean;
  authorizedFeeKeeper: boolean;
  lotteryManager: Address;
  mintChecks: Array<{
    mint: string;
    shareOft: string | null;
    shareOftRegistered: boolean;
    creatorConfigExists: boolean;
    pendingEntriesExists: boolean;
    pendingCount: number;
  }>;
};

function basePublicClient() {
  const rpcUrl = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org';
  return createPublicClient({ chain: base, transport: http(rpcUrl, { timeout: 30_000 }) });
}

export async function collectKeeperBaseWritePreflight(): Promise<KeeperBaseWritePreflight> {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const adapterRaw = requireEnv('SOLANA_BRIDGE_ADAPTER');
  const adapter = normalizeSolanaBridgeAdapter(adapterRaw) as Address;
  if (adapterRaw.trim().toLowerCase() !== adapter.toLowerCase()) {
    warnings.push(
      `SOLANA_BRIDGE_ADAPTER ${adapterRaw} is deprecated; using canonical ${CANONICAL_SOLANA_BRIDGE_ADAPTER}`,
    );
  }
  const keeperPubkey = requireEnv('SOLANA_KEEPER_PUBKEY');
  const keeperBytes32 = solanaPubkeyToBytes32(keeperPubkey);
  const client = basePublicClient();

  const [entryAuth, feeAuth, lotteryManager, predictedTwin] = await Promise.all([
    client.readContract({
      address: adapter,
      abi: adapterViewAbi,
      functionName: 'authorizedEntryKeepers',
      args: [keeperBytes32],
    }),
    client.readContract({
      address: adapter,
      abi: adapterViewAbi,
      functionName: 'authorizedFeeKeepers',
      args: [keeperBytes32],
    }),
    client.readContract({
      address: adapter,
      abi: adapterViewAbi,
      functionName: 'lotteryManager',
    }),
    client.readContract({
      address: BASE_SOLANA_BRIDGE,
      abi: bridgeViewAbi,
      functionName: 'getPredictedTwinAddress',
      args: [keeperBytes32],
    }),
  ]);

  const twinBytecode = await client.getBytecode({ address: predictedTwin });
  const twinDeployed = Boolean(twinBytecode && twinBytecode !== '0x');

  if (!entryAuth) blockers.push('authorizedEntryKeepers=false on SolanaBridgeAdapter');
  if (!feeAuth) blockers.push('authorizedFeeKeepers=false on SolanaBridgeAdapter');
  if (!lotteryManager || lotteryManager === '0x0000000000000000000000000000000000000000') {
    blockers.push('lotteryManager unset on SolanaBridgeAdapter');
  }
  if (!twinDeployed) {
    warnings.push(
      `keeper Twin ${predictedTwin} not deployed yet (first Solana→Base bridge message will deploy it)`,
    );
  }
  if (process.env.SOLANA_KEEPER_BASE_WRITES_ENABLED !== '1') {
    blockers.push(
      'SOLANA_KEEPER_BASE_WRITES_ENABLED!=1 (enable after keeper auth + registered ShareOFT + bridge lane)',
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

    const [pendingInfo, configInfo, registered] = await Promise.all([
      solConn.getAccountInfo(pendingEntriesPda),
      solConn.getAccountInfo(creatorConfigPda),
      shareOft
        ? client.readContract({
            address: adapter,
            abi: adapterViewAbi,
            functionName: 'isRegistered',
            args: [shareOft as Address],
          })
        : Promise.resolve(false),
    ]);

    let pendingCount = 0;
    if (pendingInfo?.data) {
      const data = pendingInfo.data as Buffer;
      pendingCount = data.readUInt32LE(44);
    }

    mintChecks.push({
      mint: mintStr,
      shareOft,
      shareOftRegistered: registered,
      creatorConfigExists: Boolean(configInfo),
      pendingEntriesExists: Boolean(pendingInfo),
      pendingCount,
    });

    if (!shareOft) blockers.push(`missing SOLANA_SHARE_OFT_MAPPING for mint ${mintStr}`);
    else if (!registered) {
      blockers.push(`ShareOFT ${shareOft} not registered on SolanaBridgeAdapter ${adapter}`);
    }
    if (!configInfo) {
      warnings.push(`CreatorConfig PDA missing for mint ${mintStr} (hook side not initialized)`);
    }
  }

  return {
    blockers,
    warnings,
    keeperPubkey,
    keeperBytes32,
    predictedTwin,
    twinDeployed,
    authorizedEntryKeeper: entryAuth,
    authorizedFeeKeeper: feeAuth,
    lotteryManager,
    mintChecks,
  };
}

export function formatKeeperPreflightSummary(preflight: KeeperBaseWritePreflight): string {
  if (preflight.blockers.length === 0) return 'ready';
  return preflight.blockers.join('; ');
}
