/**
 * Authorize SolanaBridgeAdapter as a swap contract on CreatorLotteryManager.
 *
 * Env:
 * - LOTTERY_MANAGER (Base address)
 * - SOLANA_BRIDGE_ADAPTER (Base address)
 * - AUTHORIZE (optional, "true" or "false", defaults to "true")
 */

import { requireEnv } from '../config.js';
import { writeContract } from '../utils/onchain.js';

const LOTTERY_MANAGER_ABI = [
  {
    type: 'function',
    name: 'setAuthorizedSwapContract',
    inputs: [
      { name: 'swapContract', type: 'address' },
      { name: 'authorized', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

async function main() {
  const lotteryManager = requireEnv('LOTTERY_MANAGER') as `0x${string}`;
  const adapter = requireEnv('SOLANA_BRIDGE_ADAPTER') as `0x${string}`;
  const authorize = (process.env.AUTHORIZE ?? 'true').toLowerCase() !== 'false';

  const result = await writeContract({
    address: lotteryManager,
    abi: LOTTERY_MANAGER_ABI,
    functionName: 'setAuthorizedSwapContract',
    args: [adapter, authorize],
  });

  if (!result.success) {
    throw new Error(result.error ?? 'Authorization failed');
  }

  console.log(
    JSON.stringify({
      action: 'authorize-solana-adapter',
      lotteryManager,
      adapter,
      authorized: authorize,
      txHash: result.txHash,
      simulated: result.simulated ?? false,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
