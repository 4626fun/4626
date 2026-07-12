import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { erc20Abi, isAddress, maxUint256, parseAbi, type Address } from 'viem'
import { previewBribeClaim } from '@/lib/governance/bribePreview'

const rewardStreamFactoryAbi = parseAbi([
  'function streamOf(address vault) external view returns (address)',
  'function getOrCreateStream(address vault) external returns (address stream)',
  'function createStream(address vault) external returns (address stream)',
  'function gaugeVoting() external view returns (address)',
])

const rewardStreamAbi = parseAbi([
  'function vault() external view returns (address)',
  'function isRewardToken(address token) external view returns (bool)',
  'function epochTokenRewards(uint256 epoch, address token) external view returns (uint256)',
  'function hasClaimed(uint256 epoch, address token, address user) external view returns (bool)',
  'function previewClaim(address user, uint256 epoch, address token) external view returns (uint256 amount)',
  'function fund(address token, uint256 amount) external',
  'function claim(uint256 epoch, address token) external returns (uint256 amount)',
])

const gaugeVotingForStreamsAbi = parseAbi([
  'function currentEpoch() external view returns (uint256)',
  'function canReceiveStreams(address vault) external view returns (bool)',
  'function getVaultWeightAtEpoch(uint256 epoch, address vault) external view returns (uint256)',
  'function getUserVoteWeightAtEpoch(uint256 epoch, address user, address vault) external view returns (uint256)',
])

export interface useRewardStream4626Props {
  factoryAddress?: Address
  vault?: Address
  token?: Address
  claimEpoch?: number
  votingAddress?: Address
}

export function useRewardStream4626({
  factoryAddress,
  vault,
  token,
  claimEpoch,
  votingAddress,
}: useRewardStream4626Props) {
  const { address: userAddress } = useAccount()
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>()

  const vaultOk = !!vault && isAddress(vault)
  const tokenOk = !!token && isAddress(token)
  const factoryOk = !!factoryAddress && isAddress(factoryAddress)

  const { data: streamAddress, refetch: refetchStream } = useReadContract({
    address: factoryAddress,
    abi: rewardStreamFactoryAbi,
    functionName: 'streamOf',
    args: vaultOk ? [vault!] : undefined,
    query: { enabled: factoryOk && vaultOk },
  })

  const stream =
    streamAddress && streamAddress !== '0x0000000000000000000000000000000000000000'
      ? (streamAddress as Address)
      : undefined

  const { data: currentEpoch, refetch: refetchEpoch } = useReadContract({
    address: votingAddress,
    abi: gaugeVotingForStreamsAbi,
    functionName: 'currentEpoch',
    query: { enabled: !!votingAddress },
  })

  const { data: canReceiveStreams, refetch: refetchCanReceiveStreams } = useReadContract({
    address: votingAddress,
    abi: gaugeVotingForStreamsAbi,
    functionName: 'canReceiveStreams',
    args: vaultOk ? [vault!] : undefined,
    query: { enabled: !!votingAddress && vaultOk },
  })

  const effectiveClaimEpoch = useMemo(() => {
    if (claimEpoch !== undefined && claimEpoch >= 0) return claimEpoch
    if (currentEpoch === undefined) return undefined
    const cur = Number(currentEpoch)
    return cur > 0 ? cur - 1 : undefined
  }, [claimEpoch, currentEpoch])

  const { data: isRewardToken, refetch: refetchIsRewardToken } = useReadContract({
    address: stream,
    abi: rewardStreamAbi,
    functionName: 'isRewardToken',
    args: tokenOk ? [token!] : undefined,
    query: { enabled: !!stream && tokenOk },
  })

  const { data: onchainPreview, refetch: refetchPreview } = useReadContract({
    address: stream,
    abi: rewardStreamAbi,
    functionName: 'previewClaim',
    args:
      stream && userAddress && tokenOk && effectiveClaimEpoch !== undefined
        ? [userAddress, BigInt(effectiveClaimEpoch), token!]
        : undefined,
    query: {
      enabled: !!stream && !!userAddress && tokenOk && effectiveClaimEpoch !== undefined,
    },
  })

  const { data: epochBag, refetch: refetchBag } = useReadContract({
    address: stream,
    abi: rewardStreamAbi,
    functionName: 'epochTokenRewards',
    args:
      stream && tokenOk && effectiveClaimEpoch !== undefined
        ? [BigInt(effectiveClaimEpoch), token!]
        : undefined,
    query: { enabled: !!stream && tokenOk && effectiveClaimEpoch !== undefined },
  })

  const { data: currentBag, refetch: refetchCurrentBag } = useReadContract({
    address: stream,
    abi: rewardStreamAbi,
    functionName: 'epochTokenRewards',
    args: stream && tokenOk && currentEpoch !== undefined ? [currentEpoch, token!] : undefined,
    query: { enabled: !!stream && tokenOk && currentEpoch !== undefined },
  })

  const { data: hasClaimed, refetch: refetchClaimed } = useReadContract({
    address: stream,
    abi: rewardStreamAbi,
    functionName: 'hasClaimed',
    args:
      stream && tokenOk && userAddress && effectiveClaimEpoch !== undefined
        ? [BigInt(effectiveClaimEpoch), token!, userAddress]
        : undefined,
    query: {
      enabled: !!stream && tokenOk && !!userAddress && effectiveClaimEpoch !== undefined,
    },
  })

  const { data: vaultWeightAtEpoch, refetch: refetchVaultWeight } = useReadContract({
    address: votingAddress,
    abi: gaugeVotingForStreamsAbi,
    functionName: 'getVaultWeightAtEpoch',
    args:
      vaultOk && effectiveClaimEpoch !== undefined
        ? [BigInt(effectiveClaimEpoch), vault!]
        : undefined,
    query: { enabled: !!votingAddress && vaultOk && effectiveClaimEpoch !== undefined },
  })

  const { data: userWeightAtEpoch, refetch: refetchUserWeight } = useReadContract({
    address: votingAddress,
    abi: gaugeVotingForStreamsAbi,
    functionName: 'getUserVoteWeightAtEpoch',
    args:
      vaultOk && userAddress && effectiveClaimEpoch !== undefined
        ? [BigInt(effectiveClaimEpoch), userAddress, vault!]
        : undefined,
    query: {
      enabled:
        !!votingAddress && vaultOk && !!userAddress && effectiveClaimEpoch !== undefined,
    },
  })

  const { data: tokenDecimals } = useReadContract({
    address: tokenOk ? token : undefined,
    abi: erc20Abi,
    functionName: 'decimals',
    query: { enabled: tokenOk },
  })

  const { data: tokenSymbol } = useReadContract({
    address: tokenOk ? token : undefined,
    abi: erc20Abi,
    functionName: 'symbol',
    query: { enabled: tokenOk },
  })

  const { data: tokenAllowance, refetch: refetchAllowance } = useReadContract({
    address: tokenOk ? token : undefined,
    abi: erc20Abi,
    functionName: 'allowance',
    args: userAddress && stream ? [userAddress, stream] : undefined,
    query: { enabled: tokenOk && !!userAddress && !!stream },
  })

  const { data: tokenBalance, refetch: refetchBalance } = useReadContract({
    address: tokenOk ? token : undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: tokenOk && !!userAddress },
  })

  const claimPreview = useMemo(() => {
    if (hasClaimed) return 0n
    if (onchainPreview !== undefined) return onchainPreview
    return previewBribeClaim({
      totalBribes: epochBag ?? 0n,
      userWeight: userWeightAtEpoch ?? 0n,
      vaultWeight: vaultWeightAtEpoch ?? 0n,
    })
  }, [hasClaimed, onchainPreview, epochBag, userWeightAtEpoch, vaultWeightAtEpoch])

  const { writeContract, isPending: isWritePending, error: writeError } = useWriteContract()
  const { isLoading: isWaitingForTx, isSuccess: txSuccess } = useWaitForTransactionReceipt({
    hash: pendingTxHash,
  })

  const onTxSuccess = useCallback((hash: `0x${string}`) => {
    setPendingTxHash(hash)
  }, [])

  const ensureStream = useCallback(() => {
    if (!factoryOk || !vaultOk) throw new Error('Factory or vault not set')
    writeContract(
      {
        address: factoryAddress!,
        abi: rewardStreamFactoryAbi,
        functionName: 'getOrCreateStream',
        args: [vault!],
      },
      { onSuccess: onTxSuccess },
    )
  }, [factoryOk, vaultOk, factoryAddress, vault, writeContract, onTxSuccess])

  const approveToken = useCallback(
    (amount?: bigint) => {
      if (!tokenOk || !stream) throw new Error('Token or stream not ready')
      writeContract(
        {
          address: token!,
          abi: erc20Abi,
          functionName: 'approve',
          args: [stream, amount ?? maxUint256],
        },
        { onSuccess: onTxSuccess },
      )
    },
    [tokenOk, stream, token, writeContract, onTxSuccess],
  )

  const fundStream = useCallback(
    (amount: bigint) => {
      if (!stream || !tokenOk) throw new Error('Stream or token not ready')
      if (amount <= 0n) throw new Error('Amount must be positive')
      writeContract(
        {
          address: stream,
          abi: rewardStreamAbi,
          functionName: 'fund',
          args: [token!, amount],
        },
        { onSuccess: onTxSuccess },
      )
    },
    [stream, tokenOk, token, writeContract, onTxSuccess],
  )

  const claimStream = useCallback(
    (epoch: number, claimToken: Address) => {
      if (!stream) throw new Error('Stream not ready')
      if (epoch < 0) throw new Error('Invalid epoch')
      writeContract(
        {
          address: stream,
          abi: rewardStreamAbi,
          functionName: 'claim',
          args: [BigInt(epoch), claimToken],
        },
        { onSuccess: onTxSuccess },
      )
    },
    [stream, writeContract, onTxSuccess],
  )

  const refetchAll = useCallback(() => {
    void refetchStream()
    void refetchEpoch()
    void refetchPreview()
    void refetchBag()
    void refetchCurrentBag()
    void refetchClaimed()
    void refetchAllowance()
    void refetchBalance()
    void refetchCanReceiveStreams()
    void refetchIsRewardToken()
    void refetchVaultWeight()
    void refetchUserWeight()
  }, [
    refetchStream,
    refetchEpoch,
    refetchPreview,
    refetchBag,
    refetchCurrentBag,
    refetchClaimed,
    refetchAllowance,
    refetchBalance,
    refetchCanReceiveStreams,
    refetchIsRewardToken,
    refetchVaultWeight,
    refetchUserWeight,
  ])

  // Refresh reads after a confirmed write (create stream / approve / fund / claim).
  useEffect(() => {
    if (txSuccess) refetchAll()
  }, [txSuccess, refetchAll])

  return {
    stream,
    currentEpoch: currentEpoch !== undefined ? Number(currentEpoch) : undefined,
    claimEpoch: effectiveClaimEpoch,
    canReceiveStreams: canReceiveStreams ?? false,
    isRewardToken: isRewardToken ?? false,
    currentEpochBag: currentBag ?? 0n,
    epochBag: epochBag ?? 0n,
    hasClaimed: hasClaimed ?? false,
    claimPreview,
    tokenDecimals: tokenDecimals !== undefined ? Number(tokenDecimals) : 18,
    tokenSymbol: (tokenSymbol as string | undefined) ?? undefined,
    tokenAllowance: tokenAllowance ?? 0n,
    tokenBalance: tokenBalance ?? 0n,
    ensureStream,
    approveToken,
    fundStream,
    claimStream,
    refetchAll,
    isPending: isWritePending || isWaitingForTx,
    txSuccess,
    pendingTxHash,
    writeError,
  }
}
