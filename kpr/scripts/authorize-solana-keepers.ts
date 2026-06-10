/**
 * Authorize the Solana keeper pubkey on SolanaBridgeAdapter for fee + entry relay.
 *
 * Env:
 * - SOLANA_BRIDGE_ADAPTER
 * - SOLANA_KEEPER_PUBKEY (base58) OR SOLANA_KEEPER_PUBKEY_BYTES32 (0x-prefixed)
 * - PRIVATE_KEY or KPR_PRIVATE_KEY (adapter owner)
 */

import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

import { requireEnv } from '../config.js';
import { solanaPubkeyToBytes32 } from '../utils/solana.js';

const ADAPTER_ABI = [
  {
    type: 'function',
    name: 'setFeeKeeper',
    inputs: [
      { name: 'keeperPubkey', type: 'bytes32' },
      { name: 'allowed', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setEntryKeeper',
    inputs: [
      { name: 'keeperPubkey', type: 'bytes32' },
      { name: 'allowed', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'authorizedFeeKeepers',
    inputs: [{ name: 'keeperPubkey', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'authorizedEntryKeepers',
    inputs: [{ name: 'keeperPubkey', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
] as const;

function resolveOwnerPrivateKey(): `0x${string}` {
  const raw = (process.env.PRIVATE_KEY ?? process.env.KPR_PRIVATE_KEY ?? '').trim();
  if (!raw) throw new Error('PRIVATE_KEY or KPR_PRIVATE_KEY required');
  return (raw.startsWith('0x') ? raw : `0x${raw}`) as `0x${string}`;
}

function resolveKeeperBytes32(): `0x${string}` {
  const direct = (process.env.SOLANA_KEEPER_PUBKEY_BYTES32 ?? '').trim();
  if (direct) return (direct.startsWith('0x') ? direct : `0x${direct}`) as `0x${string}`;
  return solanaPubkeyToBytes32(requireEnv('SOLANA_KEEPER_PUBKEY'));
}

async function main() {
  const adapter = requireEnv('SOLANA_BRIDGE_ADAPTER') as `0x${string}`;
  const keeperBytes32 = resolveKeeperBytes32();
  const allowed = (process.env.ALLOWED ?? 'true').toLowerCase() !== 'false';
  const rpcUrl = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org';
  const account = privateKeyToAccount(resolveOwnerPrivateKey());
  const wallet = createWalletClient({ account, chain: base, transport: http(rpcUrl, { timeout: 30_000 }) });
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl, { timeout: 30_000 }) });

  console.log(JSON.stringify({ adapter, keeperBytes32, allowed, owner: account.address }, null, 2));

  for (const fn of ['setFeeKeeper', 'setEntryKeeper'] as const) {
    const hash = await wallet.writeContract({
      address: adapter,
      abi: ADAPTER_ABI,
      functionName: fn,
      args: [keeperBytes32, allowed],
    });
    console.log(`${fn} tx: ${hash}`);
  }

  console.log(
    JSON.stringify(
      {
        authorizedFeeKeeper: await publicClient.readContract({
          address: adapter,
          abi: ADAPTER_ABI,
          functionName: 'authorizedFeeKeepers',
          args: [keeperBytes32],
        }),
        authorizedEntryKeeper: await publicClient.readContract({
          address: adapter,
          abi: ADAPTER_ABI,
          functionName: 'authorizedEntryKeepers',
          args: [keeperBytes32],
        }),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
