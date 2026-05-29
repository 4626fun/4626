import { formatEther, getAddress, parseAbi, type PublicClient } from 'viem'

import { ENTRY_POINT_V06_BASE } from '@/lib/wallet/cswOwnerAbi'

/** EntryPoint v0.6 per-account deposit bucket (StakeManager.balanceOf). */
export const ENTRY_POINT_BALANCE_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
])

/**
 * Funding requirements for Base App CSW owner install (EntryPoint self-call path).
 *
 * The addOwnerAddress call itself sends 0 ETH. The CSW still needs a small amount of
 * native ETH (or pre-funded EntryPoint deposit) so Base App can build and submit the
 * UserOperation through the EntryPoint (handleOps). Without it, Base App refuses to
 * generate the UserOp.
 */
export const MIN_CSW_USEROP_FUNDING_WEI = 50_000_000_000_000n // 0.00005 ETH — soft floor where Base App often fails

/** Recommended comfortable buffer for a single addOwner UserOp on Base. */
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

export type MapAddOwnerFundingErrorContext = {
  /** When true, on-chain prefund already passed our soft minimum — treat "funds" errors as Base App policy blocks. */
  fundingPreflightOk?: boolean
}

export function mapAddOwnerFundingErrorMessage(
  error: unknown,
  context?: MapAddOwnerFundingErrorContext,
): string | null {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()

  const looksLikeFundingSurface =
    lower.includes('enough funds') ||
    lower.includes('error generating transaction') ||
    lower.includes('insufficient funds') ||
    lower.includes('insufficient balance') ||
    lower.includes("didn't pay prefund") ||
    lower.includes('aa21')

  if (!looksLikeFundingSurface) return null

  if (context?.fundingPreflightOk) {
    return (
      'Base App refused to build the add-owner UserOp even though your CSW already has gas prefund. ' +
      'Coinbase often blocks third-party sites from owner-mutating selectors and shows a misleading ' +
      '"not enough funds" error — this is usually not a balance problem. ' +
      'For Base App wallets, use waitlist Step 2 → Connect Base App (sub-account signing lane) instead of this /add path.'
    )
  }

  return (
    'Base App cannot build the EntryPoint UserOp for the CSW self-call (addOwnerAddress). ' +
    'Your canonical smart wallet needs a small gas prefund. In Base App: go to your CSW → Receive → ' +
    'send ~0.001 ETH directly to it. Wait a few seconds, then tap "Rebuild preview" on this page. ' +
    'The actual addOwner call sends 0 value — this ETH is only for the UserOp gas.'
  )
}
