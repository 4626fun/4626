import { useReadContract, useWriteContract, useAccount, useWaitForTransactionReceipt } from 'wagmi'
import { parseAbi } from 'viem'
import { useState, useCallback, useEffect, useMemo } from 'react'

// ve4626GaugeVoting ABI (relevant functions only)
const ve4626GaugeVotingAbi = parseAbi([
  // User functions
  'function vote(address[] calldata vaults, uint256[] calldata weights) external',
  'function resetVotes() external',
  
  // View functions
  'function getVaultWeight(address vault) external view returns (uint256)',
  'function getTotalWeight() external view returns (uint256)',
  'function getVaultWeightBps(address vault) external view returns (uint256)',
  'function getUserVotes(address user) external view returns (address[] memory vaults, uint256[] memory weights)',
  'function hasVotedThisEpoch(address user) external view returns (bool)',
  'function getEligibleVaults() external view returns (address[])',
  'function getWhitelistedVaults() external view returns (address[])',
  'function whitelistedVaultCount() external view returns (uint256)',
  'function canReceiveVotes(address vault) external view returns (bool)',
  
  // Epoch management
  'function currentEpoch() external view returns (uint256)',
  'function epochStartTime(uint256 epoch) external view returns (uint256)',
  'function epochEndTime(uint256 epoch) external view returns (uint256)',
  'function timeUntilNextEpoch() external view returns (uint256)',
  'function genesisEpochStart() external view returns (uint256)',
  
  // Constants
  'function EPOCH_DURATION() external view returns (uint256)',
  'function MAX_VAULTS_PER_VOTE() external view returns (uint256)',
])

// ve4626 ABI (relevant functions only)
const ve4626Abi = parseAbi([
  'function getVotingPower(address user) external view returns (uint256)',
  'function getTotalVotingPower() external view returns (uint256)',
  'function hasActiveLock(address user) external view returns (bool)',
  'function getRemainingLockTime(address user) external view returns (uint256)',
  'function lock(address token, uint256 amount, uint256 duration) external returns (uint256)',
  'function extendLock(uint256 newEnd) external returns (uint256)',
  'function increaseLock(uint256 amount) external returns (uint256)',
  'function unlock() external returns (uint256)',
])

export interface VaultVote {
  vault: string
  weight: bigint
  weightBps: number
}

export interface EpochInfo {
  currentEpoch: number
  epochStartTime: Date
  epochEndTime: Date
  timeRemaining: number // seconds
  epochDuration: number // seconds
}

export interface VotingPowerInfo {
  userPower: bigint
  totalPower: bigint
  hasActiveLock: boolean
  remainingLockTime: number
}

interface UseVe4626GaugeVotingProps {
  votingAddress?: `0x${string}`
  ve4626Address?: `0x${string}`
}

export function useVe4626GaugeVoting({ votingAddress, ve4626Address }: UseVe4626GaugeVotingProps) {
  const { address: userAddress } = useAccount()
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>()

  // Read current epoch
  const { data: currentEpoch } = useReadContract({
    address: votingAddress,
    abi: ve4626GaugeVotingAbi,
    functionName: 'currentEpoch',
    query: { enabled: !!votingAddress },
  })

  // Read epoch timing
  const { data: timeUntilNextEpoch, refetch: refetchTimeRemaining } = useReadContract({
    address: votingAddress,
    abi: ve4626GaugeVotingAbi,
    functionName: 'timeUntilNextEpoch',
    query: { enabled: !!votingAddress },
  })

  const { data: epochDuration } = useReadContract({
    address: votingAddress,
    abi: ve4626GaugeVotingAbi,
    functionName: 'EPOCH_DURATION',
    query: { enabled: !!votingAddress },
  })

  const { data: genesisStart } = useReadContract({
    address: votingAddress,
    abi: ve4626GaugeVotingAbi,
    functionName: 'genesisEpochStart',
    query: { enabled: !!votingAddress },
  })

  // Read total weight
  const { data: totalWeight, refetch: refetchTotalWeight } = useReadContract({
    address: votingAddress,
    abi: ve4626GaugeVotingAbi,
    functionName: 'getTotalWeight',
    query: { enabled: !!votingAddress },
  })

  // Policy-aware vault discovery (surface registry when armed; else whitelist).
  // Falls back to getWhitelistedVaults if the deployment predates getEligibleVaults.
  const { data: eligibleVaults, isError: eligibleVaultsError } = useReadContract({
    address: votingAddress,
    abi: ve4626GaugeVotingAbi,
    functionName: 'getEligibleVaults',
    query: { enabled: !!votingAddress },
  })
  const { data: whitelistedVaultsFallback } = useReadContract({
    address: votingAddress,
    abi: ve4626GaugeVotingAbi,
    functionName: 'getWhitelistedVaults',
    query: { enabled: !!votingAddress && eligibleVaultsError },
  })
  const whitelistedVaults = eligibleVaultsError ? whitelistedVaultsFallback : eligibleVaults

  // Read user's votes
  const { data: userVotesRaw, refetch: refetchUserVotes } = useReadContract({
    address: votingAddress,
    abi: ve4626GaugeVotingAbi,
    functionName: 'getUserVotes',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!votingAddress && !!userAddress },
  })

  // Read if user voted this epoch
  const { data: hasVotedThisEpoch, refetch: refetchHasVoted } = useReadContract({
    address: votingAddress,
    abi: ve4626GaugeVotingAbi,
    functionName: 'hasVotedThisEpoch',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!votingAddress && !!userAddress },
  })

  // Read user's voting power from ve4626
  const { data: userVotingPower } = useReadContract({
    address: ve4626Address,
    abi: ve4626Abi,
    functionName: 'getVotingPower',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!ve4626Address && !!userAddress },
  })

  // Read total voting power from ve4626
  const { data: totalVotingPower } = useReadContract({
    address: ve4626Address,
    abi: ve4626Abi,
    functionName: 'getTotalVotingPower',
    query: { enabled: !!ve4626Address },
  })

  // Read if user has active lock
  const { data: hasActiveLock } = useReadContract({
    address: ve4626Address,
    abi: ve4626Abi,
    functionName: 'hasActiveLock',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!ve4626Address && !!userAddress },
  })

  // Read remaining lock time
  const { data: remainingLockTime } = useReadContract({
    address: ve4626Address,
    abi: ve4626Abi,
    functionName: 'getRemainingLockTime',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!ve4626Address && !!userAddress },
  })

  // Write contract hooks
  const { writeContract, isPending: isWritePending } = useWriteContract()

  // Wait for transaction
  const { isLoading: isWaitingForTx, isSuccess: txSuccess } = useWaitForTransactionReceipt({
    hash: pendingTxHash,
  })

  // Computed epoch info
  const epochInfo = useMemo<EpochInfo | undefined>(() => {
    if (currentEpoch === undefined || timeUntilNextEpoch === undefined || epochDuration === undefined || genesisStart === undefined) {
      return undefined
    }
    
    const epochNum = Number(currentEpoch)
    const duration = Number(epochDuration)
    const start = Number(genesisStart) + epochNum * duration
    const end = start + duration
    
    return {
      currentEpoch: epochNum,
      epochStartTime: new Date(start * 1000),
      epochEndTime: new Date(end * 1000),
      timeRemaining: Number(timeUntilNextEpoch),
      epochDuration: duration,
    }
  }, [currentEpoch, timeUntilNextEpoch, epochDuration, genesisStart])

  // Computed user votes
  const userVotes = useMemo<VaultVote[]>(() => {
    if (!userVotesRaw) return []
    const [vaults, weights] = userVotesRaw as [string[], bigint[]]
    return vaults.map((vault, i) => ({
      vault,
      weight: weights[i] ?? 0n,
      weightBps: totalWeight && totalWeight > 0n
        ? Number(((weights[i] ?? 0n) * 10000n) / totalWeight)
        : 0,
    }))
  }, [userVotesRaw, totalWeight])

  // Computed voting power info
  const votingPowerInfo = useMemo<VotingPowerInfo | undefined>(() => {
    if (userVotingPower === undefined || totalVotingPower === undefined) {
      return undefined
    }
    return {
      userPower: userVotingPower,
      totalPower: totalVotingPower,
      hasActiveLock: hasActiveLock ?? false,
      remainingLockTime: Number(remainingLockTime ?? 0n),
    }
  }, [userVotingPower, totalVotingPower, hasActiveLock, remainingLockTime])

  // Vote function
  const vote = useCallback(async (vaults: string[], weights: number[]) => {
    if (!votingAddress) throw new Error('Voting address not set')
    if (vaults.length !== weights.length) throw new Error('Vaults and weights must have same length')
    if (vaults.length === 0) throw new Error('Must vote for at least one vault')

    const weightsBigInt = weights.map(w => BigInt(w))

    writeContract(
      {
        address: votingAddress,
        abi: ve4626GaugeVotingAbi,
        functionName: 'vote',
        args: [vaults as `0x${string}`[], weightsBigInt],
      },
      {
        onSuccess: (hash) => {
          setPendingTxHash(hash)
        },
      }
    )
  }, [votingAddress, writeContract])

  // Reset votes function
  const resetVotes = useCallback(async () => {
    if (!votingAddress) throw new Error('Voting address not set')

    writeContract(
      {
        address: votingAddress,
        abi: ve4626GaugeVotingAbi,
        functionName: 'resetVotes',
      },
      {
        onSuccess: (hash) => {
          setPendingTxHash(hash)
        },
      }
    )
  }, [votingAddress, writeContract])

  // Refetch all data
  const refetchAll = useCallback(() => {
    void refetchTimeRemaining()
    void refetchTotalWeight()
    void refetchUserVotes()
    void refetchHasVoted()
  }, [refetchTimeRemaining, refetchTotalWeight, refetchUserVotes, refetchHasVoted])

  // Refresh reads after a confirmed vote / reset (mirror bribe/stream hooks).
  useEffect(() => {
    if (txSuccess) refetchAll()
  }, [txSuccess, refetchAll])

  return {
    // State
    epochInfo,
    totalWeight,
    whitelistedVaults: whitelistedVaults as string[] | undefined,
    userVotes,
    hasVotedThisEpoch,
    votingPowerInfo,
    
    // Actions
    vote,
    resetVotes,
    refetchAll,
    
    // Loading states
    isVoting: isWritePending || isWaitingForTx,
    txSuccess,
    pendingTxHash,
  }
}

// Helper hook to format time remaining
export function useTimeRemaining(seconds: number) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (days > 0) {
    return `${days}d ${hours}h`
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`
  }
  return `${secs}s`
}

// Helper to format voting power
export function formatVotingPower(power: bigint, decimals = 18): string {
  const value = Number(power) / 10 ** decimals
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`
  }
  return value.toFixed(2)
}


