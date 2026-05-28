import { formatEther, getAddress, parseAbi, type PublicClient } from 'viem'

import { ENTRY_POINT_V06_BASE } from '@/lib/wallet/cswOwnerAbi'

/** EntryPoint v0.6 per-account deposit bucket (StakeManager.balanceOf). */
export const ENTRY_POINT_BALANCE_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
])

/** Soft floor — below this, Base App often fails UserOp generation. */
export const MIN_CSW_USEROP_FUNDING_WEI = 50_000_000_000_000n // 0.00005 ETH

/** Comfortable buffer for addOwner UserOp gas on Base. */
export const RECOMMENDED_CSW_USEROP_FUNDING_WEI = 500_000_000_000_000n // 0.0005 ETH

export type CswFundingSnapshot = {
  cswNativeWei: bigint
  entryPointDepositWei: bigint
  totalAvailableWei: bigint
}

export type CswFundingAssessment =
  | { ok: true; snapshot: CswFundingSnapshot }
  | { ok: false; reason: 'zero' | 'low'; snapshot: CswFundingSnapshot }

export function assessCswUserOpFunding(snapshot: CswFundingSnapshot): CswFundingAssessment {
  const total = snapshot.cswNativeWei + snapshot.entryPointDepositWei
  const normalized: CswFundingSnapshot = { ...snapshot, totalAvailableWei: total }
  if (total === 0n) return { ok: false, reason: 'zero', snapshot: normalized }
  if (total < MIN_CSW_USEROP_FUNDING_WEI) return { ok: false, reason: 'low', snapshot: normalized }
  return { ok: true, snapshot: normalized }
}

export async function readCswUserOpFundingSnapshot(params: {
  publicClient: Pick<PublicClient, 'getBalance' | 'readContract'>
  cswAddress: string
}): Promise<CswFundingSnapshot> {
  const csw = getAddress(params.cswAddress)
  const [cswNativeWei, entryPointDepositWei] = await Promise.all([
    params.publicClient.getBalance({ address: csw }),
    params.publicClient.readContract({
      address: ENTRY_POINT_V06_BASE,
      abi: ENTRY_POINT_BALANCE_ABI,
      functionName: 'balanceOf',
      args: [csw],
    }),
  ])
  const totalAvailableWei = cswNativeWei + entryPointDepositWei
  return { cswNativeWei, entryPointDepositWei, totalAvailableWei }
}

export function formatEthCompact(wei: bigint): string {
  const ether = formatEther(wei)
  const parsed = Number(ether)
  if (!Number.isFinite(parsed) || parsed === 0) return '0 ETH'
  if (parsed < 0.0001) return `${ether} ETH`
  if (parsed < 1) return `${parsed.toFixed(4).replace(/\.?0+$/, '')} ETH`
  return `${parsed.toFixed(4)} ETH`
}

export function mapAddOwnerFundingErrorMessage(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  if (
    lower.includes('enough funds') ||
    lower.includes('error generating transaction') ||
    lower.includes('insufficient funds') ||
    lower.includes('insufficient balance') ||
    lower.includes("didn't pay prefund") ||
    lower.includes('aa21')
  ) {
    return (
      'Base App could not build the UserOp because your canonical smart wallet has little or no ETH ' +
      'for gas. Send about 0.001 ETH to your CSW in Base App (Assets → Receive), wait a few seconds, ' +
      'tap Rebuild preview, then submit again. The addOwner call itself sends 0 ETH — this is only gas prefund.'
    )
  }
  return null
}
