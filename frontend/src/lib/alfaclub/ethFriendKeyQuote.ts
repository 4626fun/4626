/**
 * Composite ETH → pair ERC-20 → FriendKey (ERC-1155) quote helpers.
 *
 * Sudoswap prices keys in the pair ERC-20 (Creator Coin today; ShareOFT when live).
 * ETH funding buys that ERC-20 first, so the UI must not treat ETH amount and key
 * quantity as a direct exchange rate.
 *
 * Naming: `*Akita*` helpers remain as aliases for the Creator Coin lane.
 */

export function estimateEthWeiForRequiredPairErc20(params: {
  requiredPairErc20: bigint
  probeEthWei: bigint
  probePairErc20Out: bigint
  /** Extra ETH buffer on top of the linear scale (default 1%). */
  bufferBps?: bigint
}): bigint {
  const required = params.requiredPairErc20
  const probeEthWei = params.probeEthWei
  const probeOut = params.probePairErc20Out
  if (required <= 0n) throw new Error('required_pair_erc20_invalid')
  if (probeEthWei <= 0n) throw new Error('probe_eth_invalid')
  if (probeOut <= 0n) throw new Error('probe_pair_erc20_invalid')

  const bufferBps = params.bufferBps ?? 100n
  if (bufferBps < 0n || bufferBps > 5_000n) throw new Error('buffer_bps_invalid')

  const raw = (required * probeEthWei + probeOut - 1n) / probeOut
  return (raw * (10_000n + bufferBps) + 9_999n) / 10_000n
}

/** @deprecated Prefer estimateEthWeiForRequiredPairErc20 */
export function estimateEthWeiForRequiredAkita(params: {
  requiredAkita: bigint
  probeEthWei: bigint
  probeAkitaOut: bigint
  bufferBps?: bigint
}): bigint {
  return estimateEthWeiForRequiredPairErc20({
    requiredPairErc20: params.requiredAkita,
    probeEthWei: params.probeEthWei,
    probePairErc20Out: params.probeAkitaOut,
    bufferBps: params.bufferBps,
  })
}

export function formatEthWeiForInput(wei: bigint): string {
  if (wei <= 0n) return ''
  const whole = wei / 10n ** 18n
  const frac = wei % 10n ** 18n
  if (frac === 0n) return whole.toString()
  const fracStr = frac.toString().padStart(18, '0').replace(/0+$/, '')
  return `${whole.toString()}.${fracStr}`
}

export function fundingCoversSudoswapBuy(params: {
  fundingPairErc20Out?: bigint
  requiredPairErc20?: bigint
  /** @deprecated Creator-coin lane alias */
  fundingAkitaOut?: bigint
  /** @deprecated Creator-coin lane alias */
  requiredAkita?: bigint
}): boolean {
  const funding =
    params.fundingPairErc20Out ?? params.fundingAkitaOut ?? 0n
  const required = params.requiredPairErc20 ?? params.requiredAkita ?? 0n
  return funding > 0n && funding >= required
}
