import { createPublicClient, getAddress, http, type Address } from 'viem'
import { base } from 'viem/chains'

import {
  applyExecutorDropBuffer,
  resolveHubShareOft,
  type RemoteFeeFlushTarget,
} from './remoteFeeFlushConfig'
import { shareOftFeeFlushAbi } from './shareOftFeeFlushAbi'

export type SpokeFlushQuote = {
  pendingFees: bigint
  flushThreshold: bigint
  spokeLzFee: bigint
  hubLzFee: bigint
  executorNativeDrop: bigint
  ready: boolean
}

function baseRpcUrl(): string {
  return String(import.meta.env.VITE_BASE_RPC ?? 'https://mainnet.base.org')
}

function spokeClient(target: RemoteFeeFlushTarget) {
  return createPublicClient({
    chain: {
      ...base,
      id: target.chainId,
      name: target.label,
      rpcUrls: { default: { http: [target.rpcUrl] } },
    },
    transport: http(target.rpcUrl, { timeout: 30_000 }),
  })
}

function hubClient() {
  return createPublicClient({
    chain: base,
    transport: http(baseRpcUrl(), { timeout: 30_000 }),
  })
}

export async function quoteSpokeFlushFromHub(target: RemoteFeeFlushTarget): Promise<SpokeFlushQuote> {
  const spoke = spokeClient(target)
  const hub = hubClient()
  const hubShareOft = resolveHubShareOft()

  const [pendingFees, flushThreshold, spokeLzFee, hubIsHub] = await Promise.all([
    spoke.readContract({
      address: target.shareOft,
      abi: shareOftFeeFlushAbi,
      functionName: 'pendingFees',
    }),
    spoke.readContract({
      address: target.shareOft,
      abi: shareOftFeeFlushAbi,
      functionName: 'flushThreshold',
    }),
    spoke.readContract({
      address: target.shareOft,
      abi: shareOftFeeFlushAbi,
      functionName: 'quoteFlushFees',
    }),
    hub.readContract({
      address: hubShareOft,
      abi: shareOftFeeFlushAbi,
      functionName: 'isHub',
    }),
  ])

  if (!hubIsHub) {
    throw new Error('Configured hub ShareOFT is not marked isHub on Base')
  }

  const executorNativeDrop = applyExecutorDropBuffer(spokeLzFee)
  const hubQuote = await hub.readContract({
    address: hubShareOft,
    abi: shareOftFeeFlushAbi,
    functionName: 'quoteRemoteFeeFlushRequest',
    args: [target.lzEid, executorNativeDrop],
  })

  const ready = pendingFees > 0n && pendingFees >= flushThreshold && spokeLzFee > 0n

  return {
    pendingFees,
    flushThreshold,
    spokeLzFee,
    hubLzFee: hubQuote.nativeFee,
    executorNativeDrop,
    ready,
  }
}

export async function readGaugeUnaccountedShareOft(gauge: Address): Promise<bigint> {
  const hub = hubClient()
  const gaugeShareOft = await hub.readContract({
    address: gauge,
    abi: [
      {
        type: 'function',
        name: 'shareOFT',
        inputs: [],
        outputs: [{ type: 'address' }],
        stateMutability: 'view',
      },
      {
        type: 'function',
        name: 'accountedOFTBalance',
        inputs: [],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
      },
    ] as const,
    functionName: 'shareOFT',
  })

  const [shareOftBalance, accounted] = await Promise.all([
    hub.readContract({
      address: getAddress(gaugeShareOft as Address),
      abi: [
        {
          type: 'function',
          name: 'balanceOf',
          inputs: [{ type: 'address' }],
          outputs: [{ type: 'uint256' }],
          stateMutability: 'view',
        },
      ] as const,
      functionName: 'balanceOf',
      args: [gauge],
    }),
    hub.readContract({
      address: gauge,
      abi: [
        {
          type: 'function',
          name: 'accountedOFTBalance',
          inputs: [],
          outputs: [{ type: 'uint256' }],
          stateMutability: 'view',
        },
      ] as const,
      functionName: 'accountedOFTBalance',
    }),
  ])

  return shareOftBalance > accounted ? shareOftBalance - accounted : 0n
}
