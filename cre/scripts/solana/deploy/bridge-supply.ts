/**
 * Bridge ShareOFT supply from Base to Solana via the SolanaBridgeAdapter.
 *
 * This script calls the Base-side adapter to send tokens across the bridge.
 * The Solana side receives wrapped SPL tokens.
 *
 * Usage:
 *   pnpm solana:bridge-supply
 *
 * Required env:
 *   CRE_ETH_PRIVATE_KEY     - Base signer private key (hex, without 0x prefix)
 *   BASE_RPC_URL             - Base RPC endpoint
 *   SHARE_OFT_ADDRESS        - ShareOFT address on Base
 *   BRIDGE_AMOUNT            - Amount to bridge (in wei / smallest unit)
 *   SOLANA_DESTINATION        - Solana destination address (bytes32 hex)
 *
 * Optional env:
 *   SOLANA_BRIDGE_ADAPTER    - Bridge adapter address (default: from contracts)
 */

import { createPublicClient, createWalletClient, http, parseAbi, getAddress, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { requireEnv } from '../../../config.js';

const rpcUrl = requireEnv('BASE_RPC_URL');
const pk = `0x${requireEnv('CRE_ETH_PRIVATE_KEY')}` as Hex;
const account = privateKeyToAccount(pk);

const shareOft = getAddress(requireEnv('SHARE_OFT_ADDRESS'));
const bridgeAmount = BigInt(requireEnv('BRIDGE_AMOUNT'));
const solanaDestination = requireEnv('SOLANA_DESTINATION') as Hex;
const adapter = getAddress(
  process.env.SOLANA_BRIDGE_ADAPTER ?? '0x2414b595c4f18532A5836B6e2E6d536832c572e8',
);

const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, chain: base, transport: http(rpcUrl) });

const erc20Abi = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address owner) external view returns (uint256)',
]);

const bridgeAbi = parseAbi([
  'function bridgeToSolana(address token, uint256 amount, bytes32 solanaDestination) external',
]);

console.log('=== Bridge Supply to Solana ===');
console.log('Signer:      ', account.address);
console.log('ShareOFT:    ', shareOft);
console.log('Amount:      ', bridgeAmount.toString());
console.log('Destination: ', solanaDestination);
console.log('Adapter:     ', adapter);
console.log();

const balance = await publicClient.readContract({
  address: shareOft,
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [account.address],
});
console.log('Current balance:', balance.toString());

if (balance < bridgeAmount) {
  console.error(`Insufficient balance: have ${balance}, need ${bridgeAmount}`);
  process.exit(1);
}

console.log('Approving adapter...');
const approveTx = await walletClient.writeContract({
  address: shareOft,
  abi: erc20Abi,
  functionName: 'approve',
  args: [adapter, bridgeAmount],
});
await publicClient.waitForTransactionReceipt({ hash: approveTx });
console.log('  Approve tx:', approveTx);

console.log('Bridging to Solana...');
const bridgeTx = await walletClient.writeContract({
  address: adapter,
  abi: bridgeAbi,
  functionName: 'bridgeToSolana',
  args: [shareOft, bridgeAmount, solanaDestination],
});
const receipt = await publicClient.waitForTransactionReceipt({ hash: bridgeTx });
console.log('  Bridge tx:', bridgeTx);
console.log('  Status:   ', receipt.status);
