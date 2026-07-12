import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { erc20Abi, isAddress, maxUint256, parseAbi, type Address } from 'viem'
import { previewBribeClaim } from '@/lib/governance/bribePreview'

const bribesFactoryAbi = parseAbi([
  'function bribeDepot4626Of(address vault) external view returns (address)',
  'function getOrCreateBribeDepot4626(address vault) external returns (address depot)',
  'function createBribeDepot4626(address vault) external returns (address depot)',
  'function gaugeVoting() external view returns (address)',
])

const bribeDepotAbi = parseAbi([
  'function vault() external view returns (address)',
  'function gaugeVoting() external view returns (address)',
  'function totalBribes(uint256 epoch, address token) external view returns (uint256)',
  'function claimed(uint256 epoch, address token, address user) external view returns (bool)',
  'function bribe(address token, uint256 amount) external',
  'function claim(uint256 epoch, address token) external returns (uint256 amount)',
])

const gaugeVotingForBribesAbi = parseAbi([
  'function currentEpoch() external view returns (uint256)',
  'function getVaultWeightAtEpoch(uint256 epoch, address vault) external view returns (uint256)',
  'function getUserVoteWeightAtEpoch(uint256 epoch, address user, address vault) external view returns (uint256)',
  'function canReceiveBribes(address vault) external view returns (bool)',
])

export interface useBribes4626Props {
  factoryAddress?: Address
  vault?: Address
  /** Reward / bribe ERC-20 */
  token?: Address
  /** Epoch for claim preview (defaults to currentEpoch - 1 when available) */
  claimEpoch?: number
  votingAddress?: Address
}

export function useBribes4626({
  factoryAddress,
  vault,
  token,
  claimEpoch,
  votingAddress,
}: useBribes4626Props) {
  const { address: userAddress } = useAccount()
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>()

  const vaultOk = !!vault && isAddress(vault)
  const tokenOk = !!token && isAddress(token)
  const factoryOk = !!factoryAddress && isAddress(factoryAddress)

  const { data: depotAddress, refetch: refetchDepot } = useReadContract({
    address: factoryAddress,
    abi: bribesFactoryAbi,
    functionName: 'bribeDepot4626Of',
    args: vaultOk ? [vault!] : undefined,
    query: { enabled: factoryOk && vaultOk },
  })

  const depot =
    depotAddress && depotAddress !== '0x0000000000000000000000000000000000000000'
      ? (depotAddress as Address)
      : undefined

  const resolvedVoting = votingAddress

  const { data: currentEpoch, refetch: refetchEpoch } = useReadContract({
    address: resolvedVoting,
    abi: gaugeVotingForBribesAbi,
    functionName: 'currentEpoch',
    query: { enabled: !!resolvedVoting },
  })

  const { data: canReceiveBribes, refetch: refetchCanReceiveBribes } = useReadContract({
    address: resolvedVoting,
    abi: gaugeVotingForBribesAbi,
    functionName: 'canReceiveBribes',
    args: vaultOk ? [vault!] : undefined,
    query: { enabled: !!resolvedVoting && vaultOk },
  })

  const effectiveClaimEpoch = useMemo(() => {
    if (claimEpoch !== undefined && claimEpoch >= 0) return claimEpoch
    if (currentEpoch === undefined) return undefined
    const cur = Number(currentEpoch)
    return cur > 0 ? cur - 1 : undefined
  }, [claimEpoch, currentEpoch])

  const { data: epochTotalBribes, refetch: refetchTotal } = useReadContract({
    address: depot,
    abi: bribeDepotAbi,
    functionName: 'totalBribes',
    args:
      depot && tokenOk && effectiveClaimEpoch !== undefined
        ? [BigInt(effectiveClaimEpoch), token!]
        : undefined,
    query: { enabled: !!depot && tokenOk && effectiveClaimEpoch !== undefined },
  })

  const { data: currentEpochTotalBribes, refetch: refetchCurrentTotal } = useReadContract({
    address: depot,
    abi: bribeDepotAbi,
    functionName: 'totalBribes',
    args:
      depot && tokenOk && currentEpoch !== undefined
        ? [currentEpoch, token!]
        : undefined,
    query: { enabled: !!depot && tokenOk && currentEpoch !== undefined },
  })

  const { data: hasClaimed, refetch: refetchClaimed } = useReadContract({
    address: depot,
    abi: bribeDepotAbi,
    functionName: 'claimed',
    args:
      depot && tokenOk && userAddress && effectiveClaimEpoch !== undefined
        ? [BigInt(effectiveClaimEpoch), token!, userAddress]
        : undefined,
    query: {
      enabled: !!depot && tokenOk && !!userAddress && effectiveClaimEpoch !== undefined,
    },
  })

  const { data: vaultWeightAtEpoch, refetch: refetchVaultWeight } = useReadContract({
    address: resolvedVoting,
    abi: gaugeVotingForBribesAbi,
    functionName: 'getVaultWeightAtEpoch',
    args:
      vaultOk && effectiveClaimEpoch !== undefined
        ? [BigInt(effectiveClaimEpoch), vault!]
        : undefined,
    query: { enabled: !!resolvedVoting && vaultOk && effectiveClaimEpoch !== undefined },
  })

  const { data: userWeightAtEpoch, refetch: refetchUserWeight } = useReadContract({
    address: resolvedVoting,
    abi: gaugeVotingForBribesAbi,
    functionName: 'getUserVoteWeightAtEpoch',
    args:
      vaultOk && userAddress && effectiveClaimEpoch !== undefined
        ? [BigInt(effectiveClaimEpoch), userAddress, vault!]
        : undefined,
    query: {
      enabled:
        !!resolvedVoting && vaultOk && !!userAddress && effectiveClaimEpoch !== undefined,
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
    args: userAddress && depot ? [userAddress, depot] : undefined,
    query: { enabled: tokenOk && !!userAddress && !!depot },
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
    return previewBribeClaim({
      totalBribes: epochTotalBribes ?? 0n,
      userWeight: userWeightAtEpoch ?? 0n,
      vaultWeight: vaultWeightAtEpoch ?? 0n,
    })
  }, [hasClaimed, epochTotalBribes, userWeightAtEpoch, vaultWeightAtEpoch])

  const { writeContract, isPending: isWritePending, error: writeError } = useWriteContract()
  const { isLoading: isWaitingForTx, isSuccess: txSuccess } = useWaitForTransactionReceipt({
    hash: pendingTxHash,
  })

  const onTxSuccess = useCallback(
    (hash: `0x${string}`) => {
      setPendingTxHash(hash)
    },
    [],
  )

  const ensureDepot = useCallback(() => {
    if (!factoryOk || !vaultOk) throw new Error('Factory or vault not set')
    writeContract(
      {
        address: factoryAddress!,
        abi: bribesFactoryAbi,
        functionName: 'getOrCreateBribeDepot4626',
        args: [vault!],
      },
      { onSuccess: onTxSuccess },
    )
  }, [factoryOk, vaultOk, factoryAddress, vault, writeContract, onTxSuccess])

  const approveToken = useCallback(
    (amount?: bigint) => {
      if (!tokenOk || !depot) throw new Error('Token or depot not ready')
      writeContract(
        {
          address: token!,
          abi: erc20Abi,
          functionName: 'approve',
          args: [depot, amount ?? maxUint256],
        },
        { onSuccess: onTxSuccess },
      )
    },
    [tokenOk, depot, token, writeContract, onTxSuccess],
  )

  const depositBribe = useCallback(
    (amount: bigint) => {
      if (!depot || !tokenOk) throw new Error('Depot or token not ready')
      if (amount <= 0n) throw new Error('Amount must be positive')
      writeContract(
        {
          address: depot,
          abi: bribeDepotAbi,
          functionName: 'bribe',
          args: [token!, amount],
        },
        { onSuccess: onTxSuccess },
      )
    },
    [depot, tokenOk, token, writeContract, onTxSuccess],
  )

  const claimBribe = useCallback(
    (epoch: number, claimToken: Address) => {
      if (!depot) throw new Error('Depot not ready')
      if (epoch < 0) throw new Error('Invalid epoch')
      writeContract(
        {
          address: depot,
          abi: bribeDepotAbi,
          functionName: 'claim',
          args: [BigInt(epoch), claimToken],
        },
        { onSuccess: onTxSuccess },
      )
    },
    [depot, writeContract, onTxSuccess],
  )

  const refetchAll = useCallback(() => {
    void refetchDepot()
    void refetchEpoch()
    void refetchTotal()
    void refetchCurrentTotal()
    void refetchClaimed()
    void refetchAllowance()
    void refetchBalance()
    void refetchCanReceiveBribes()
    void refetchVaultWeight()
    void refetchUserWeight()
  }, [
    refetchDepot,
    refetchEpoch,
    refetchTotal,
    refetchCurrentTotal,
    refetchClaimed,
    refetchAllowance,
    refetchBalance,
    refetchCanReceiveBribes,
    refetchVaultWeight,
    refetchUserWeight,
  ])

  // Refresh reads after a confirmed write (create depot / approve / bribe / claim).
  useEffect(() => {
    if (txSuccess) refetchAll()
  }, [txSuccess, refetchAll])

  return {
    depot,
    currentEpoch: currentEpoch !== undefined ? Number(currentEpoch) : undefined,
    claimEpoch: effectiveClaimEpoch,
    canReceiveBribes: canReceiveBribes ?? false,
    currentEpochTotalBribes: currentEpochTotalBribes ?? 0n,
    epochTotalBribes: epochTotalBribes ?? 0n,
    hasClaimed: hasClaimed ?? false,
    claimPreview,
    tokenDecimals: tokenDecimals !== undefined ? Number(tokenDecimals) : 18,
    tokenSymbol: (tokenSymbol as string | undefined) ?? undefined,
    tokenAllowance: tokenAllowance ?? 0n,
    tokenBalance: tokenBalance ?? 0n,
    ensureDepot,
    approveToken,
    depositBribe,
    claimBribe,
    refetchAll,
    isPending: isWritePending || isWaitingForTx,
    txSuccess,
    pendingTxHash,
    writeError,
  }
}
