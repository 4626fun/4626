/**
 * Claim Prize to Solana — guided claim flow for Solana lottery winners.
 *
 * Flow:
 *   1. Frontend resolves user's Twin via adapter.getTwinAddress(solanaPubkey)
 *   2. Shows prize details (token, amount) at the Twin address
 *   3. User clicks "Claim to Solana"
 *   4. Frontend constructs EVM calls to be executed by the Twin:
 *      a) ERC20.approve(adapter, amount) on the prizeToken
 *      b) adapter.bridgeToSolana(token, amount, solanaPubkey)
 *   5. If user has a Base wallet connected (via Privy):
 *      - Sends both txs directly from the EVM wallet
 *   6. If user only has Solana:
 *      - Uses PayForRelay + bridge_call to execute the two calls from their Twin
 *   7. Prize arrives as wrapped SPL in user's Solana wallet
 *
 * Uses existing SolanaBridgeAdapter functions:
 *   - getTwinAddress
 *   - bridgeToSolana
 *   - encodeErc20ApproveCall
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  useAccount,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { type Address, encodeFunctionData, parseAbi, formatUnits } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ExternalLink, CheckCircle, AlertCircle, ArrowRight, Wallet, Copy, Check } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClaimPrizeToSolanaProps {
  /** The user's Solana wallet pubkey (base58 string) */
  solanaPubkey: string;
  /** Prize token address on Base (ShareOFT or other ERC-20) */
  prizeToken: Address;
  /** Prize amount in human-readable format */
  prizeAmount: string;
  /** Prize amount in raw wei/units */
  prizeAmountRaw: bigint;
  /** Token symbol for display */
  tokenSymbol: string;
  /** Token decimals (default 18) */
  tokenDecimals?: number;
  /** SolanaBridgeAdapter address on Base */
  adapterAddress: Address;
  /** Optional: Basescan URL prefix */
  explorerUrl?: string;
  /** Callback when claim is initiated */
  onClaimInitiated?: (txHash: string) => void;
  /** Callback when claim completes */
  onClaimComplete?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

type ClaimStep = 'idle' | 'resolving' | 'approve' | 'approve_pending' | 'bridge' | 'bridge_pending' | 'complete' | 'error';

// ---------------------------------------------------------------------------
// ABI (subset of SolanaBridgeAdapter + ERC-20)
// ---------------------------------------------------------------------------

const adapterAbi = parseAbi([
  'function getTwinAddress(bytes32 solanaAddress) view returns (address)',
  'function bridgeToSolana(address token, uint256 amount, bytes32 solanaDestination) payable',
  'function encodeErc20ApproveCall(address spender, uint256 amount) view returns (bytes)',
]);

const erc20Abi = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function symbol() view returns (string)',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function solanaPubkeyToBytes32(pubkey: string): `0x${string}` {
  let result = BigInt(0);
  for (const char of pubkey) {
    const idx = BASE58_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base58 character: ${char}`);
    result = result * 58n + BigInt(idx);
  }
  const hex = result.toString(16).padStart(64, '0');
  if (hex.length > 64) throw new Error('Decoded pubkey exceeds 32 bytes');
  return `0x${hex}`;
}

function truncateAddress(addr: string, start = 6, end = 4): string {
  if (addr.length <= start + end + 2) return addr;
  return `${addr.slice(0, start)}...${addr.slice(-end)}`;
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS = [
  { key: 'approve', label: 'Approve' },
  { key: 'bridge', label: 'Bridge' },
  { key: 'complete', label: 'Done' },
] as const;

function StepIndicator({ currentStep }: { currentStep: ClaimStep }) {
  const stepMap: Record<string, number> = {
    idle: -1, resolving: -1,
    approve: 0, approve_pending: 0,
    bridge: 1, bridge_pending: 1,
    complete: 2, error: -1,
  };
  const activeIdx = stepMap[currentStep] ?? -1;

  return (
    <div className="flex items-center justify-between mb-6">
      {STEPS.map((step, i) => {
        const isActive = i === activeIdx;
        const isDone = i < activeIdx;
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  isDone
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : isActive
                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 animate-pulse'
                    : 'bg-surface-700/50 text-gray-500 border border-surface-600/30'
                }`}
              >
                {isDone ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs ${isDone ? 'text-emerald-400' : isActive ? 'text-indigo-400' : 'text-gray-500'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-2 ${isDone ? 'bg-emerald-500/40' : 'bg-surface-600/30'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClaimPrizeToSolana({
  solanaPubkey,
  prizeToken,
  prizeAmount,
  prizeAmountRaw,
  tokenSymbol,
  tokenDecimals = 18,
  adapterAddress,
  explorerUrl = 'https://basescan.org',
  onClaimInitiated,
  onClaimComplete,
  onError,
}: ClaimPrizeToSolanaProps) {
  const [step, setStep] = useState<ClaimStep>('idle');
  const [twinAddress, setTwinAddress] = useState<Address | null>(null);
  const [prizeBalance, setPrizeBalance] = useState<bigint | null>(null);
  const [currentAllowance, setCurrentAllowance] = useState<bigint>(0n);
  const [errorMsg, setErrorMsg] = useState('');
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>();
  const [bridgeTxHash, setBridgeTxHash] = useState<`0x${string}` | undefined>();
  const [copied, setCopied] = useState(false);

  const { isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // Derive bytes32 from the Solana pubkey
  const pubkeyBytes32 = useMemo(() => {
    try {
      return solanaPubkeyToBytes32(solanaPubkey);
    } catch {
      return null;
    }
  }, [solanaPubkey]);

  // Resolve Twin address and check balance on mount
  useEffect(() => {
    if (!pubkeyBytes32 || !publicClient) return;

    const resolve = async () => {
      try {
        const twin = await publicClient.readContract({
          address: adapterAddress,
          abi: adapterAbi,
          functionName: 'getTwinAddress',
          args: [pubkeyBytes32],
        }) as Address;
        setTwinAddress(twin);

        // Check prize balance at Twin
        const balance = await publicClient.readContract({
          address: prizeToken,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [twin],
        }) as bigint;
        setPrizeBalance(balance);

        // Check current allowance (Twin → adapter)
        const allowance = await publicClient.readContract({
          address: prizeToken,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [twin, adapterAddress],
        }) as bigint;
        setCurrentAllowance(allowance);
      } catch (err) {
        console.error('Failed to resolve Twin:', err);
      }
    };

    resolve();
  }, [pubkeyBytes32, adapterAddress, prizeToken, publicClient]);

  // Wait for approve tx confirmation
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  });

  // When approve confirms, move to bridge step
  useEffect(() => {
    if (approveConfirmed && step === 'approve_pending') {
      setStep('bridge');
    }
  }, [approveConfirmed, step]);

  // Wait for bridge tx confirmation
  const { isSuccess: bridgeConfirmed } = useWaitForTransactionReceipt({
    hash: bridgeTxHash,
  });

  // When bridge confirms, move to complete
  useEffect(() => {
    if (bridgeConfirmed && step === 'bridge_pending') {
      setStep('complete');
      onClaimComplete?.();
    }
  }, [bridgeConfirmed, step, onClaimComplete]);

  const hasSufficientAllowance = currentAllowance >= prizeAmountRaw;
  const hasPrize = prizeBalance !== null && prizeBalance > 0n;

  // ---------------------------------------------------------------------------
  // Direct claim flow (user connected as Twin or has Base wallet access)
  // ---------------------------------------------------------------------------

  const handleApprove = useCallback(async () => {
    if (!pubkeyBytes32 || !twinAddress) return;

    try {
      setStep('approve');
      setErrorMsg('');

      const hash = await writeContractAsync({
        address: prizeToken,
        abi: erc20Abi,
        functionName: 'approve',
        args: [adapterAddress, prizeAmountRaw],
      });

      setApproveTxHash(hash);
      setStep('approve_pending');
      onClaimInitiated?.(hash);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStep('error');
      setErrorMsg(message);
      onError?.(message);
    }
  }, [pubkeyBytes32, twinAddress, prizeToken, adapterAddress, prizeAmountRaw, writeContractAsync, onClaimInitiated, onError]);

  const handleBridge = useCallback(async () => {
    if (!pubkeyBytes32 || !twinAddress) return;

    try {
      setStep('bridge');
      setErrorMsg('');

      const hash = await writeContractAsync({
        address: adapterAddress,
        abi: adapterAbi,
        functionName: 'bridgeToSolana',
        args: [prizeToken, prizeAmountRaw, pubkeyBytes32],
      });

      setBridgeTxHash(hash);
      setStep('bridge_pending');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStep('error');
      setErrorMsg(message);
      onError?.(message);
    }
  }, [pubkeyBytes32, twinAddress, prizeToken, prizeAmountRaw, adapterAddress, writeContractAsync, onError]);

  const handleClaim = useCallback(async () => {
    if (hasSufficientAllowance) {
      await handleBridge();
    } else {
      await handleApprove();
    }
  }, [hasSufficientAllowance, handleApprove, handleBridge]);

  // Continue to bridge after approve
  const handleContinueToBridge = useCallback(async () => {
    await handleBridge();
  }, [handleBridge]);

  // ---------------------------------------------------------------------------
  // Solana relay payload (PayForRelay + bridge_call)
  // ---------------------------------------------------------------------------

  const approveCalldata = useMemo(() => {
    if (!pubkeyBytes32) return '';
    return encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [adapterAddress, prizeAmountRaw],
    });
  }, [adapterAddress, prizeAmountRaw, pubkeyBytes32]);

  const bridgeCalldata = useMemo(() => {
    if (!pubkeyBytes32) return '';
    return encodeFunctionData({
      abi: adapterAbi,
      functionName: 'bridgeToSolana',
      args: [prizeToken, prizeAmountRaw, pubkeyBytes32],
    });
  }, [prizeToken, prizeAmountRaw, pubkeyBytes32]);

  const relayPayload = useMemo(() => {
    if (!pubkeyBytes32) return '';
    return JSON.stringify(
      {
        solanaPubkey,
        twinAddress,
        steps: [
          {
            type: 'bridge_call',
            payForRelay: true,
            call: {
              to: prizeToken,
              data: approveCalldata,
              value: '0',
            },
          },
          {
            type: 'bridge_call',
            payForRelay: true,
            call: {
              to: adapterAddress,
              data: bridgeCalldata,
              value: '0',
            },
          },
        ],
      },
      null,
      2,
    );
  }, [pubkeyBytes32, solanaPubkey, twinAddress, prizeToken, approveCalldata, adapterAddress, bridgeCalldata]);

  const handleCopyRelayPayload = useCallback(() => {
    if (!relayPayload) return;
    navigator.clipboard.writeText(relayPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [relayPayload]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-800/80 backdrop-blur-sm border border-surface-700/50 p-6 max-w-md w-full"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Claim Prize to Solana</h3>
          <p className="text-sm text-gray-400">Bridge winnings to your Solana wallet</p>
        </div>
      </div>

      {/* Step indicator (only show during active claim) */}
      {step !== 'idle' && step !== 'error' && <StepIndicator currentStep={step} />}

      {/* Prize details card */}
      <div className="rounded-xl bg-surface-700/40 border border-surface-600/30 p-4 mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Prize</span>
          <span className="text-sm font-semibold text-white">
            {prizeAmount} {tokenSymbol}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Solana Wallet</span>
          <span className="text-xs font-mono text-gray-300" title={solanaPubkey}>
            {truncateAddress(solanaPubkey)}
          </span>
        </div>
        {twinAddress && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Base Twin</span>
            <a
              href={`${explorerUrl}/address/${twinAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              {truncateAddress(twinAddress)}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Twin Balance</span>
          {prizeBalance !== null ? (
            <span className={`text-sm font-medium ${hasPrize ? 'text-emerald-400' : 'text-red-400'}`}>
              {hasPrize
                ? `${formatUnits(prizeBalance, tokenDecimals)} ${tokenSymbol}`
                : 'No funds'}
            </span>
          ) : (
            <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
          )}
        </div>
      </div>

      {/* Error state */}
      <AnimatePresence>
        {step === 'error' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 mb-4"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-red-300 break-words">{errorMsg}</p>
                <button
                  onClick={() => setStep('idle')}
                  className="mt-2 text-sm text-red-400 hover:text-red-300 underline underline-offset-2"
                >
                  Try again
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success state */}
      <AnimatePresence>
        {step === 'complete' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 mb-4"
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-emerald-300">Prize claimed successfully!</p>
                <p className="text-xs text-emerald-400/70 mt-0.5">
                  Tokens are bridging to your Solana wallet. This may take a few minutes.
                </p>
              </div>
            </div>
            {bridgeTxHash && (
              <a
                href={`${explorerUrl}/tx/${bridgeTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 mt-2"
              >
                View transaction <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      {step === 'idle' && (
        <div className="space-y-3">
          {isConnected ? (
            <button
              onClick={handleClaim}
              disabled={!hasPrize || !pubkeyBytes32}
              className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                hasPrize
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20'
                  : 'bg-surface-700/50 text-gray-500 cursor-not-allowed'
              }`}
            >
              {hasSufficientAllowance ? (
                <>Bridge to Solana <ArrowRight className="w-4 h-4" /></>
              ) : (
                <>Approve &amp; Bridge to Solana <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 text-center">
                No ETH? Use PayForRelay + bridge_call from your Solana wallet.
              </p>
              <button
                onClick={handleCopyRelayPayload}
                disabled={!hasPrize || !pubkeyBytes32}
                className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  hasPrize
                    ? 'bg-surface-700/60 hover:bg-surface-700/80 text-white border border-surface-600/50'
                    : 'bg-surface-700/50 text-gray-500 cursor-not-allowed'
                }`}
              >
                {copied ? (
                  <><Check className="w-4 h-4 text-emerald-400" /> Copied!</>
                ) : (
                  <><Copy className="w-4 h-4" /> Copy Solana Relay Payload</>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pending: Approve */}
      {(step === 'approve' || step === 'approve_pending') && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          <p className="text-sm text-gray-300">
            {step === 'approve' ? 'Confirm approval in your wallet...' : 'Waiting for approval confirmation...'}
          </p>
          {approveTxHash && (
            <a
              href={`${explorerUrl}/tx/${approveTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              View on explorer <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* Ready to bridge (after approve confirmed) */}
      {step === 'bridge' && !bridgeTxHash && (
        <button
          onClick={handleContinueToBridge}
          className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
        >
          Bridge to Solana <ArrowRight className="w-4 h-4" />
        </button>
      )}

      {/* Pending: Bridge */}
      {(step === 'bridge' && bridgeTxHash) || step === 'bridge_pending' ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          <p className="text-sm text-gray-300">
            Bridging to Solana... This may take a few minutes.
          </p>
          {bridgeTxHash && (
            <a
              href={`${explorerUrl}/tx/${bridgeTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              View on explorer <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      ) : null}

      {/* Footer note */}
      <p className="text-xs text-gray-500 text-center mt-4">
        {isConnected
          ? 'Gas is paid in ETH on Base. Bridge fees may apply.'
          : 'No ETH needed when claiming via PayForRelay + bridge_call.'}
      </p>
    </motion.div>
  );
}

export default ClaimPrizeToSolana;
